import { world, ItemStack } from "@minecraft/server";
import {
  FM_GENRES,
  getFmGenre,
  getFmItem,
  FM_MAX_ORDERS_PER_GENRE,
  FM_PRICE_MIN,
  FM_PRICE_MAX,
  FM_SUGGEST_BAND,
  FM_NONPERISHABLE_MAX_AGE_DAYS
} from "../data/fresh-market-data.js";
import { getFoodCategory, FOOD_MARKET_SHELF_LIFE_TICKS } from "../data/food-data.js";
import { getFoodClock } from "./freshness.js";
import { getGenreTag, REGION_TAGS, getRegionTagAt } from "../data/tag-dictionary.js";
import {
  listExchangeOrders,
  addExchangeOrder,
  consumeExchangeOrder,
  mutateExchangeOrders,
  recordExchangePrice
} from "./trade-pool.js";
import { getNearbyShulkerBoxes } from "./trade.js";
import { getAccount } from "./bank.js";

// ==========================================
// 生鮮市場 ロジック
// ------------------------------------------
// trade-pool.js の exchange型(genreTag配下の出品集計+itemId単位の価格推移)を土台にした
// trade_order方式のオーダーボード。UIは ui/fresh-market-menu.js。
//
// 出品(trade_order)の形:
// { id, no, issuer:{type,id}, itemId, genreTag, unit:"item", quantity, originalQuantity,
//   price, regionTag, createdDay, createdClock, anonymize:true, fulfillMode:"pool", status:"open" }
//   ・issuerは代金の入金先解決のための内部データ。UIには出しない(出品番号 no だけ出す)
//   ・createdClock は出品時の食品クロック(freshness.js のtick積算値)。鮮度はこれからの経過tickで決まる
//   ・quantityは残数。鮮度の目減りと購入で減り、0になったら取り下げ
// ==========================================

const ORDER_SEQ_KEY = "fm_order_seq";
const EARNINGS_PREFIX = "fm_earnings_";

// ---- 鮮度 ----

// 出品の鮮度%(0〜100)。鮮度の概念が無い品目(生コンブ等)は null。
export function getOrderFreshnessPercent(order, now = getFoodClock()) {
  const category = getFoodCategory(order.itemId);
  if (!category) return null;
  if (typeof order.createdClock !== "number") return 100; // 旧データ。次の保守で起点が刻印される
  const life = FOOD_MARKET_SHELF_LIFE_TICKS[category];
  const age = Math.max(0, now - order.createdClock);
  return Math.max(0, Math.round((1 - age / life) * 100));
}

// 出品の保守(古い出品の除去+鮮度による目減り)。画面を開くたびに、その時点の経過tickで計算する。
// 専用の巡回フックを持たないので、誰もオンラインでなくても次に開いた時点で辻褄が合う。
// 腐った分は「腐った肉に置き換え」ではなく、単に出品数量から消える(仮想在庫のため)。
export function ensureFreshMarketMaintained() {
  const now = getFoodClock();
  const today = world.getDay();

  for (const genre of FM_GENRES) {
    mutateExchangeOrders(genre.tag, (o) => {
      const category = getFoodCategory(o.itemId);
      if (!category) {
        // 鮮度の無い品目は日数で古い出品を除去するだけ
        return today - o.createdDay >= FM_NONPERISHABLE_MAX_AGE_DAYS ? null : o;
      }
      // 旧データ(createdClock無し)は、初めて保守された時点を起点にする
      if (typeof o.createdClock !== "number") return { ...o, createdClock: now };
      const life = FOOD_MARKET_SHELF_LIFE_TICKS[category];
      const age = Math.max(0, now - o.createdClock);
      if (age >= life) return null;
      const allowed = Math.floor(o.originalQuantity * (1 - age / life));
      if (allowed <= 0) return null;
      return o.quantity > allowed ? { ...o, quantity: allowed } : o;
    });
  }
}

// ---- 掲示板の参照 ----

export function listItemOrders(genreTag, itemId) {
  return listExchangeOrders(genreTag, { itemId });
}

export function getCheapestPrice(genreTag, itemId) {
  const orders = listItemOrders(genreTag, itemId);
  return orders.length > 0 ? orders[0].price : null;
}

export function countGenreOrders(genreTag) {
  return listExchangeOrders(genreTag, { sortByPrice: false }).length;
}

// ---- 価格の目安 ----

// 産地(regionタグ)補正込みの目安価格と、その予想価格帯。
export function getSuggestedPrice(itemId, regionTag) {
  const item = getFmItem(itemId);
  const base = item ? item.basePrice : 1;
  const modifier = REGION_TAGS[regionTag]?.priceModifier ?? 0;
  const suggested = Math.max(FM_PRICE_MIN, Math.round(base * (1 + modifier)));
  const lo = Math.max(FM_PRICE_MIN, Math.round(suggested * (1 - FM_SUGGEST_BAND)));
  const hi = Math.min(FM_PRICE_MAX, Math.max(lo, Math.round(suggested * (1 + FM_SUGGEST_BAND))));
  return { suggested, lo, hi };
}

// ---- 納品(シュルカー → 出品) ----

// シュルカー1箱の中身を、指定ジャンルの「満載」として判定する(spec-03 D: genre-based判定)。
// 満載 = 全スロットが埋まり、各スロットがそのアイテムの最大スタック数ぴったり。
// 最大スタック数が1のアイテム(牛乳バケツ等)でも27個で満載になる(スタックサイズ依存)。
// ジャンル外のアイテムが1つでも混じっていれば不可。同ジャンルなら複数アイテムの混在はOK。
// 戻り値: { ok, counts: {itemId: 個数} }
export function scanGenreShulker(container, genreTag) {
  const counts = {};
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) return { ok: false, counts: {} };
    if (getGenreTag(item.typeId) !== genreTag) return { ok: false, counts: {} };
    const max = item.maxAmount ?? 64;
    if (item.amount !== max) return { ok: false, counts: {} };
    counts[item.typeId] = (counts[item.typeId] ?? 0) + item.amount;
  }
  return { ok: Object.keys(counts).length > 0, counts };
}

// プレイヤーの近くから、このジャンルで満載のシュルカーを1つ探す。
export function findDeliverableShulker(player, genreTag) {
  const boxes = getNearbyShulkerBoxes(player.dimension, player.location);
  for (const b of boxes) {
    const scan = scanGenreShulker(b.container, genreTag);
    if (scan.ok) return { box: b, counts: scan.counts };
  }
  return null;
}

function nextOrderNo() {
  const n = (world.getDynamicProperty(ORDER_SEQ_KEY) ?? 0) + 1;
  world.setDynamicProperty(ORDER_SEQ_KEY, n);
  return n;
}

// 納品の確定。prices は { itemId: 価格(GLB/個) }。シュルカーを空にして、アイテム種ごとに1出品を作る。
// 産地(regionTag)は納品したその場のバイオームから決まる。
export function deliverToMarket(player, genreTag, prices) {
  const found = findDeliverableShulker(player, genreTag);
  if (!found) return { ok: false, reason: "noShulker" };

  const kinds = Object.keys(found.counts);
  if (countGenreOrders(genreTag) + kinds.length > FM_MAX_ORDERS_PER_GENRE) return { ok: false, reason: "boardFull" };

  const regionTag = getRegionTagAt(player.dimension, player.location);
  const created = [];
  for (const itemId of kinds) {
    const raw = Math.round(Number(prices[itemId]));
    const price = Number.isFinite(raw) ? Math.min(FM_PRICE_MAX, Math.max(FM_PRICE_MIN, raw)) : getSuggestedPrice(itemId, regionTag).suggested;
    const qty = found.counts[itemId];
    created.push(
      addExchangeOrder(genreTag, {
        no: nextOrderNo(),
        issuer: { type: "player", id: player.id },
        itemId,
        genreTag,
        unit: "item",
        quantity: qty,
        originalQuantity: qty,
        price,
        regionTag,
        createdClock: getFoodClock(),
        anonymize: true,
        fulfillMode: "pool",
        status: "open"
      })
    );
  }

  for (let i = 0; i < found.box.container.size; i++) found.box.container.setItem(i, undefined);
  return { ok: true, orders: created, regionTag };
}

// ---- 購入 ----

function spawnStacks(player, itemId, qty) {
  const max = new ItemStack(itemId, 1).maxAmount ?? 64;
  let left = qty;
  while (left > 0) {
    const n = Math.min(max, left);
    player.dimension.spawnItem(new ItemStack(itemId, n), player.location);
    left -= n;
  }
}

// 出品から qty 個を購入する。代金は出品者の売上台帳(未受取)に積み、買い手のGLBから引く。
export function buyFromOrder(player, genreTag, orderId, qty) {
  const orders = listExchangeOrders(genreTag, { sortByPrice: false });
  const order = orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: "notFound" };
  if (order.quantity < qty) return { ok: false, reason: "insufficientStock", available: order.quantity };

  const total = order.price * qty;
  const acc = getAccount(player);
  if (acc.glow_berry < total) return { ok: false, reason: "insufficientCurrency", total };

  const consumed = consumeExchangeOrder(genreTag, orderId, qty);
  if (!consumed.ok) return { ok: false, reason: "notFound" };

  player.setDynamicProperty("acc_curr_glow_berry", acc.glow_berry - total);
  const key = EARNINGS_PREFIX + order.issuer.id;
  world.setDynamicProperty(key, (world.getDynamicProperty(key) ?? 0) + total);
  recordExchangePrice(order.itemId, order.price);
  spawnStacks(player, order.itemId, qty);
  return { ok: true, total, order: consumed.order };
}

// ---- 売上の受け取り ----

// 自分の出品が売れた分のGLBを口座に入金する(市場を開いたときに自動で実行)。入金額を返す。
export function claimFreshMarketEarnings(player) {
  const key = EARNINGS_PREFIX + player.id;
  const amount = world.getDynamicProperty(key) ?? 0;
  if (amount <= 0) return 0;
  const acc = getAccount(player);
  player.setDynamicProperty("acc_curr_glow_berry", acc.glow_berry + amount);
  world.setDynamicProperty(key, 0);
  return amount;
}
