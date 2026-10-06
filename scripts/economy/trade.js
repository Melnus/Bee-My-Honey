import { creditEmeralds, debitEmeralds, FLOW } from "./ledger.js";
import { ItemStack } from "@minecraft/server";
import { COMMODITIES, SHULKER_UNIT_QTY, BLOCK_UNIT_SIZE } from "../data/market-data.js";
import { getGenreTag } from "../data/tag-dictionary.js";
import { getBulkCommodityPrice, applyTrade } from "./market-engine.js";
import { getAccount } from "./bank.js";

// シュルカー1箱分の取引が需要圧力に与える影響量。
// 需要圧力(market-engine.js)は「1回の売買個数 × DEMAND_IMPACT_SCALE(0.015) × volatility」で
// 効果を計算し、±MAX_DEMAND_PRESSURE(0.6)でクランプする設計。これは小口取引(数個〜数百個)を
// 前提にしたスケールで、シュルカー実数量の1,728をそのまま渡すと、volatilityが最も低い銘柄
// (丸石0.1)でも1728*0.015*0.1=2.592となり、クランプ上限0.6を軽く超えて一発で天井/床に
// 張り付いてしまう(=1回の取引で即座に価格が暴落/暴騰する)。
// そのため、需要圧力への入力だけは実数量と切り離し、「シュルカー1箱=この個数分の小口取引が
// 起きたのと同じ影響」という換算値を別に定義する。現物の受け渡し数量・代金計算には影響しない。
const SHULKER_DEMAND_UNITS = 24;

// ==========================================
// v0.3.4 #1: 単位・バルク取引 (trade_order)
// ------------------------------------------
// シュルカーボックス(27スタック=1,728個)を大口現物取引の標準単位とする。
// labor.js の getNearbyContainers (クエスト納品の集荷箱走査) と同じ発想だが、
// こちらは「チェスト/樽の中身を合算」ではなく「シュルカー1箱の状態(空/満載/中途半端)」
// を個別に見る必要があるため、専用の走査・判定関数を用意する。
//
// v0.3.4の間は法人格制度が未実装のため、1回の取引はシュルカー1個分(SHULKER_UNIT_QTY)を
// 上限とする。将来 trade_order を発注/受注型(issuer/claimedBy を持つ形)に拡張する際も、
// ここでの「1トレード=1シュルカー」という粒度はそのまま踏襲する想定。
//
// trade_order の想定フィールド(今回はhrmhrm即時約定のみのため、下記構造をその場で
// 組み立てて返すだけで永続化はしない。将来プレイヤー間の指値注文に拡張する際に
// quest_listing 同様、動的プロパティへ保存する形にする):
// {
//   kind: "trade",
//   issuer: { type: "hrmhrm", id: null },   // 将来: "company" | "player" も乗る想定
//   commodityKey,                            // COMMODITIES のキー
//   unit: "shulker",
//   qty: SHULKER_UNIT_QTY,
//   side: "buy" | "sell",                    // プレイヤーから見た向き
//   unitPrice, totalAmount,
//   status: "completed",
//   claimedBy: { type: "player", id: null }
// }
// ==========================================

const SHULKER_BOX_TYPE_FRAGMENT = "shulker_box";

function isShulkerBox(typeId) {
  return typeId.includes(SHULKER_BOX_TYPE_FRAGMENT);
}

// 起点の周囲(半径 radius)にあるシュルカーボックスのブロック+インベントリを集める。
// labor.js の getNearbyContainers と同じ走査範囲・スタイルに合わせている。
export function getNearbyShulkerBoxes(dimension, origin, radius = 6) {
  const boxes = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const loc = { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
        let block;
        try {
          block = dimension.getBlock(loc);
        } catch (e) {
          continue;
        }
        if (!block || !isShulkerBox(block.typeId)) continue;
        const inv = block.getComponent("minecraft:inventory")?.container;
        if (inv) boxes.push({ block, container: inv });
      }
    }
  }
  return boxes;
}

// シュルカー1箱の中身を判定する(空箱探し専用。銘柄を問わない汎用版)。
// state: "empty"(空・引き出し用に使える) | "full"(単一アイテムが1,728個ぴったり・納品対象)
//        | "partial"(単一アイテムだが満載未満) | "mixed"(複数アイテムが混在・対象外)
export function classifyShulkerBox(container) {
  let itemId = null;
  let total = 0;
  let mixed = false;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    if (itemId === null) itemId = item.typeId;
    else if (item.typeId !== itemId) mixed = true;
    total += item.amount;
  }
  if (total === 0) return { state: "empty", itemId: null, total: 0 };
  if (mixed) return { state: "mixed", itemId: null, total };
  if (total >= SHULKER_UNIT_QTY) return { state: "full", itemId, total };
  return { state: "partial", itemId, total };
}

// 鉄/銅のようにインゴットとブロック(1個=9個換算, market-data.js の BLOCK_UNIT_SIZE)の
// 両方が存在する銘柄向け。シュルカーの中身をこの銘柄のitemId/blockIdだけで合算し、
// 対象外のアイテムが1つでも混じっていれば mixed として弾く。
// (丸石・ガラスのようにblockIdが無い銘柄はitemIdのみで合算されるので、既存の
// classifyShulkerBoxと実質同じ挙動になる)
function sumShulkerValueForCommodity(container, def) {
  let total = 0;
  let mixed = false;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    if (item.typeId === def.itemId) total += item.amount;
    else if (def.blockId && item.typeId === def.blockId) total += item.amount * BLOCK_UNIT_SIZE;
    else mixed = true;
  }
  return { total, mixed };
}

// v0.3.4 #3(生鮮市場)向け: ジャンル単位のシュルカー判定。
// 上の sumShulkerValueForCommodity は「単一銘柄(product)のitemId/blockIdぴったり」しか
// 認めない前提だが、生鮮市場のような"ジャンル(genre)"取引は「タグ辞書上、同じgenreタグを
// 持つアイテムなら混在していてもOK」という別ルールになる(spec-03-fresh-market.md セクションD)。
// そのため判定関数自体をproduct/genreで分け、trade_order側が製品単位かジャンル単位かを
// 指定して呼び分ける想定にしている(例: サケとタラが混在していても、両方 genre:seafood
// タグなら合算してOKと判定する)。#3本体(プール・trade_post)はまだ未実装で、この関数は
// タグ辞書の受け皿として先出しで用意したもの。
export function sumShulkerValueForGenre(container, genreTag) {
  let total = 0;
  let mixed = false;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    if (getGenreTag(item.typeId) === genreTag) total += item.amount;
    else mixed = true;
  }
  return { total, mixed };
}

// 空のシュルカーボックスをスタック上限まで単一アイテムで埋める(64個入りを27スロット)。
function fillShulkerWithItem(container, itemId, qty) {
  let left = qty;
  let slot = 0;
  while (left > 0 && slot < container.size) {
    const amount = Math.min(64, left);
    container.setItem(slot, new ItemStack(itemId, amount));
    left -= amount;
    slot++;
  }
}

function emptyShulker(container) {
  for (let i = 0; i < container.size; i++) container.setItem(i, undefined);
}

// 買い: 隣接する「空」のシュルカーを1つ探し、1,728個ぴったり詰めて代金を引く。
// (法人格未実装のため1回1シュルカー分まで。空箱が複数あっても最初の1つだけを使う)
// ブロック化できる銘柄(鉄/銅)でも、払い出しは常にインゴット形態にする。ブロックで払い出すと
// 192個しかスロットが埋まらず「満載」の見た目と合わなくなるため。
export function buyBulkCommodity(player, commodityKey, originLocation) {
  const def = COMMODITIES[commodityKey];
  if (!def) return { ok: false, reason: "unknownCommodity" };

  const origin = originLocation ?? player.location;
  const boxes = getNearbyShulkerBoxes(player.dimension, origin);
  const target = boxes.find((b) => classifyShulkerBox(b.container).state === "empty");
  if (!target) return { ok: false, reason: "noEmptyShulker" };

  const unitPrice = getBulkCommodityPrice(commodityKey);
  const totalAmount = Math.round(unitPrice * SHULKER_UNIT_QTY);

  const acc = getAccount(player);
  if (acc.emeralds < totalAmount) return { ok: false, reason: "insufficientFunds", totalAmount };

  fillShulkerWithItem(target.container, def.itemId, SHULKER_UNIT_QTY);
  debitEmeralds(player, totalAmount, FLOW.BULK_BUY);
  applyTrade("commodity_bulk", commodityKey, SHULKER_DEMAND_UNITS, def.volatility);

  return { ok: true, side: "buy", commodityKey, unitPrice, totalAmount, qty: SHULKER_UNIT_QTY };
}

// 売り: 隣接するシュルカーのうち、この銘柄のitemId/blockId換算合計が1,728以上あり、
// かつ他の銘柄が混じっていないものを1つ探し、中身を空にして代金を払う。
// (鉄/銅はインゴット・ブロックどちらでも、混在させても合算できる。丸石/ガラスはblockId
// が無いので実質インゴット専用銘柄と同じ扱いになる。端数が出ても代金は常にSHULKER_UNIT_QTY分
// 固定なので、多く詰めた分はプレイヤーの持ち出しになるだけで過剰受け取りは発生しない)
export function sellBulkCommodity(player, commodityKey, originLocation) {
  const def = COMMODITIES[commodityKey];
  if (!def) return { ok: false, reason: "unknownCommodity" };

  const origin = originLocation ?? player.location;
  const boxes = getNearbyShulkerBoxes(player.dimension, origin);
  const target = boxes.find((b) => {
    const v = sumShulkerValueForCommodity(b.container, def);
    return !v.mixed && v.total >= SHULKER_UNIT_QTY;
  });
  if (!target) return { ok: false, reason: "noMatchingFullShulker" };

  const unitPrice = getBulkCommodityPrice(commodityKey);
  const totalAmount = Math.round(unitPrice * SHULKER_UNIT_QTY);

  emptyShulker(target.container);
  const acc = getAccount(player);
  creditEmeralds(player, totalAmount, FLOW.BULK_SELL);
  applyTrade("commodity_bulk", commodityKey, -SHULKER_DEMAND_UNITS, def.volatility);

  return { ok: true, side: "sell", commodityKey, unitPrice, totalAmount, qty: SHULKER_UNIT_QTY };
}
