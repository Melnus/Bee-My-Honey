import { externalVersion, startExternalItems, isAutoListable, isUnpriced, registerExternalNow } from "./external-items.js";
import { prettyName } from "../data/item-names-extra.js";
import { world, system, ItemStack } from "@minecraft/server";
import { creditEmeralds, debitEmeralds, FLOW } from "./ledger.js";
import { getAccount } from "./bank.js";
import { getPolicyParam } from "./policy.js";
import { getPriceLevel } from "./price-level.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { MAIL_ORDER_MARKUP } from "../data/village-pricing-data.js";
import { MAIL_ORDER_CATALOG } from "../data/mail-order-data.js";
import { EXCHANGE_TREE } from "../data/exchange-items-data.js";
import { COMMODITIES, SHULKER_UNIT_QTY } from "../data/market-data.js";
import { getCommodityPrice, getBulkCommodityPrice, applyTrade } from "./market-engine.js";
import { hasCard, getAvailableCredit } from "./mail-order.js";
import { getEntityAccount, createEntityAccount, saveEntityAccount } from "./account.js";
import { getPrivateShulkerBlock, depositToPrivateShulker } from "./private-shulker.js";
import { stackKey, makeStacks, isStaleStack } from "./variant-items.js";
import { variantName, bookKey } from "../data/variant-items-data.js";

// ==========================================
// 取引所 / Exchange  (dev/exchange-spec.md。0.5.6 の土台。UI・入口の置き換えは次)
// ------------------------------------------
// 郵便販売を置き換える取引所のエンジン。
//   ・出品者: HRMHRM(常設出品。実在庫制・価格は基準 × 1.25 × 掛率 = 購入側の上限)/ プレイヤー(出品)。
//   ・プレイヤーの取引所プール(ユーザー固有): 専用シュルカーから取り込んだ品を、いったんここに入れて、出品する。
//   ・出品: 出品時に輸送費(出品額の exchange_listing_fee_rate)を払う。取引所の専用口座(id "exchange")の収入。返金なし。
//   ・購入: 安い出品から自動で選ぶ。代金は口座残高から。HRMHRMの分は mail_order(HRMHRMの収益)、プレイヤーの分は exchange_buy / exchange_sell。
//   ・入荷: 買った品は、買い手の入荷一覧に入る。専用シュルカーへ届ける(入りきらない・読み込まれていない分は入荷一覧に残る)。
//   ・売り手がオフラインの間の代金は、保留にして、ログイン時に入る。
// 保存(世界): bmh_ex_l_<品目> = 出品の配列 / bmh_ex_items = 出品のある品目 / bmh_ex_seq = 出品IDの連番 / bmh_ex_hstock = HRMHRMの在庫 /
//   bmh_ex_proceeds = { playerId: 保留の代金 } / bmh_ex_pool_<playerId> = 取引所プール / bmh_ex_inbox_<playerId> = 入荷一覧 / bmh_ex_day = 日次処理の済んだ日
// ==========================================
export const EXCHANGE_ACCOUNT_ID = "exchange";
const MAX_LISTINGS_PER_ITEM = 60;
const ITEMS_KEY = "bmh_ex_items";
const SEQ_KEY = "bmh_ex_seq";
const HSTOCK_KEY = "bmh_ex_hstock";
const PROCEEDS_KEY = "bmh_ex_proceeds";
const DAY_KEY = "bmh_ex_day";

function readJson(key, fallback) {
  const raw = world.getDynamicProperty(key);
  if (typeof raw !== "string") return fallback;
  try { return JSON.parse(raw) ?? fallback; } catch (e) { return fallback; }
}
function writeJson(key, value) {
  if (value === null || (typeof value === "object" && Object.keys(value).length === 0 && !Array.isArray(value))) world.setDynamicProperty(key, undefined);
  else world.setDynamicProperty(key, JSON.stringify(value));
}
const listingKey = (itemId) => "bmh_ex_l_" + itemId.replace("minecraft:", "");
const poolKey = (pid) => "bmh_ex_pool_" + pid;
const inboxKey = (pid) => "bmh_ex_inbox_" + pid;

// ---- 価格 ----
// HRMHRMの売値(1個)。購入側の上限になる。
const UNPRICED_CAP = 100000; // 値付けの相手がない外部アドオンの品の、出品の上限(売り手が値段を決める)
export function referencePrice(itemId) {
  if (isUnpriced(itemId)) return UNPRICED_CAP;
  return Math.max(1, Math.round(getItemBasePriceExact(itemId) * MAIL_ORDER_MARKUP * getPriceLevel()));
}

// ---- 値動きの記録(直近7日の取引。1日ごとの平均単価) ----
// 買えた取引(プレイヤー・村・会社・NPC・HRMHRM・相場)ごとに、その日の数量と代金を足す。品目ごとに1つの保存先。
const HIST_DAYS = 7;
const histKey = (itemId) => "bmh_ex_h_" + itemId.replace("minecraft:", "");
export function recordTrade(itemId, qty, unitPrice, day = world.getDay()) {
  if (!(qty > 0) || !(unitPrice > 0)) return;
  try {
    const key = histKey(itemId);
    const h = readJson(key, []).filter((e) => e[0] > day - HIST_DAYS);
    let e = h.find((x) => x[0] === day);
    if (!e) { e = [day, 0, 0]; h.push(e); }
    e[1] += qty; e[2] += qty * unitPrice;
    world.setDynamicProperty(key, JSON.stringify(h));
  } catch (err) { console.warn("[BeeMyHoney] exchange history: " + err); }
}
// 戻り値: { values:[直近7日の平均単価(取引のない日は前の日のまま)], last, dir:1|0|-1, pct, vol } | null(記録なし)
//   dir/pct は、最後に取引のあった日の平均単価を、その前に取引のあった日と比べたもの。
export function itemTrend(itemId, day = world.getDay()) {
  const h = readJson(histKey(itemId), []).filter((e) => e[0] > day - HIST_DAYS && e[0] <= day).sort((a, b) => a[0] - b[0]);
  if (!h.length) return null;
  const avg = (e) => e[2] / e[1];
  const values = [];
  let cur = avg(h[0]);
  for (let d = day - HIST_DAYS + 1; d <= day; d++) { const e = h.find((x) => x[0] === d); if (e) cur = avg(e); values.push(cur); }
  const last = avg(h[h.length - 1]);
  const prev = h.length > 1 ? avg(h[h.length - 2]) : null;
  const pct = prev ? ((last - prev) / prev) * 100 : 0;
  return { values, last, dir: !prev || Math.abs(pct) < 0.5 ? 0 : pct > 0 ? 1 : -1, pct, vol: h.reduce((a, e) => a + e[1], 0) };
}

// ---- HRMHRMの常設出品(郵便販売のカタログのうち、品目IDが決まっている通常の品) ----
let standingCache = null;
export function standingItems() {
  if (standingCache) return standingCache;
  const out = new Map();
  for (const [catKey, list] of Object.entries(MAIL_ORDER_CATALOG)) {
    for (const e of list) {
      if (catKey === "books") { // 通販のエンチャント本(最大レベル)は、取引所では「ID#種類」の品目の常設出品にする
        if (!e.enchant) continue;
        const key = bookKey(e.enchant.id, e.enchant.level);
        if (isTradable(key) && (e.standingStock ?? 0) > 0) out.set(key, Math.max(out.get(key) ?? 0, e.standingStock));
        continue;
      }
      if (e.enchant || e.enchantPool) continue;
      const ids = e.variants ? e.variants.map((v) => v.itemId) : e.itemId ? [e.itemId] : [];
      for (const id of ids) {
        if (!isTradable(id)) continue; // 取引リスト(exchange-items-data.js)にない品は、常設出品にしない
        const qty = (e.standingStock ?? 0) * (e.giveAmount ?? 1);
        if (qty > 0) out.set(id, Math.max(out.get(id) ?? 0, qty));
      }
    }
  }
  standingCache = out;
  return out;
}

// ---- 取引リスト(分類 → 小分類 → 品目) ----
// data/exchange-items-data.js の表を引く。表にある品だけが取引できる。
let treeIndex = null, treeIndexVersion = -1;
const fullId = (short) => (short.split("#")[0].includes(":") ? short : "minecraft:" + short); // 外部アドオンの品は、名前空間つきで入っている
function index() {
  if (treeIndex && treeIndexVersion === externalVersion()) return treeIndex;
  treeIndexVersion = externalVersion();
  treeIndex = new Map();
  for (const cat of EXCHANGE_TREE) for (const g of cat.groups) for (const [short, ja] of g.items) treeIndex.set(fullId(short), { cat: cat.key, group: g.key, ja });
  return treeIndex;
}
export function exchangeTree() { return EXCHANGE_TREE; }
export function isTradable(itemId) { return index().has(itemId); }
export function itemInfo(itemId) { return index().get(itemId) ?? null; }
// 分類(fresh / general / rare)。表にない品は null。
export function categoryOf(itemId) { return index().get(itemId)?.cat ?? null; }

// 小分類の品目(出品がない品も含める)。
//   戻り値: [{ itemId, ja, price(最安。相場も含める。何も無ければ null), qty(出品の在庫。相場は数えない), count(出品の件数。相場は数えない), market(相場の取引がある品なら、相場の単価) }] 表の順
export function groupItems(catKey, groupKey) {
  const cat = EXCHANGE_TREE.find((c) => c.key === catKey);
  const g = cat?.groups.find((x) => x.key === groupKey);
  if (!g) return [];
  return g.items.map(([short, ja]) => {
    const itemId = fullId(short);
    const offers = listOffers(itemId);
    const real = offers.filter((o) => o.kind !== "market");
    return {
      itemId, ja, price: offers.length ? offers[0].price : null,
      qty: real.reduce((a, o) => a + o.qty, 0), count: real.length, market: marketPrice(itemId)
    };
  });
}

// ---- 検索(品名の一部。ひらがな・カタカナ・大文字小文字・全角半角の違いは無視。日本語名・英語名・IDで探す) ----
export function normalizeQuery(q) {
  return String(q ?? "").normalize("NFKC").toLowerCase().replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s_・]+/g, "");
}
function englishName(itemId) {
  const v = variantName(itemId, "en");
  if (v) return v;
  return prettyName(itemId);
}
// 戻り値: [{ itemId, ja, cat, group }](名前の先頭一致が先、あとは表の順)。空の検索語は空。出品のない品も含める。
export function searchItems(query, limit = 40) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const hits = [];
  let order = 0;
  for (const [itemId, info] of index()) {
    const names = [normalizeQuery(info.ja), normalizeQuery(englishName(itemId)), normalizeQuery(itemId.replace(/^[a-z0-9_.-]+:/, ""))];
    const pos = names.map((n) => n.indexOf(q)).filter((i) => i >= 0);
    order++;
    if (pos.length) hits.push({ itemId, ja: info.ja, cat: info.cat, group: info.group, rank: Math.min(...pos) === 0 ? 0 : 1, order });
  }
  hits.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return hits.slice(0, limit).map(({ rank, order, ...x }) => x);
}

// その分類の品目のうち、出品のある品。戻り値: [{ itemId, price(最安), qty }] ID順
export function listCategoryItems(cat) {
  const out = [];
  for (const [itemId, info] of index()) {
    if (info.cat !== cat) continue;
    const offers = listOffers(itemId).filter((o) => o.kind !== "market");
    if (offers.length) out.push({ itemId, price: offers[0].price, qty: offers.reduce((a, o) => a + o.qty, 0) });
  }
  return out.sort((a, b) => a.itemId.localeCompare(b.itemId));
}

function hstock() {
  const st = readJson(HSTOCK_KEY, null);
  const init = {};
  for (const [id, qty] of standingItems()) init[id] = qty;
  return st ? { ...init, ...st } : init; // 保存のない品(取引リストに新しく入った品)は、常設数から始める
}
export function getHrmhrmStock(itemId) { return hstock()[itemId] ?? 0; }

// ---- プレイヤーの取引所プールと入荷一覧(ユーザー固有) ----
export function getPool(playerId) { return readJson(poolKey(playerId), {}); }
export function getInbox(playerId) { return readJson(inboxKey(playerId), {}); }
function addTo(key, playerId, itemId, qty) {
  const m = readJson(key(playerId), {});
  m[itemId] = (m[itemId] ?? 0) + qty;
  writeJson(key(playerId), m);
}
function takeFrom(key, playerId, itemId, qty) {
  const m = readJson(key(playerId), {});
  if ((m[itemId] ?? 0) < qty) return false;
  m[itemId] -= qty;
  if (m[itemId] <= 0) delete m[itemId];
  writeJson(key(playerId), m);
  return true;
}
export const addToPool = (pid, itemId, qty) => addTo(poolKey, pid, itemId, qty);
export const addToInbox = (pid, itemId, qty) => addTo(inboxKey, pid, itemId, qty);

// ---- 出品 ----
function readListings(itemId) { return readJson(listingKey(itemId), []); }
function writeListings(itemId, list) {
  writeJson(listingKey(itemId), list.length ? list : null);
  const items = new Set(readJson(ITEMS_KEY, []));
  if (list.length) items.add(itemId); else items.delete(itemId);
  writeJson(ITEMS_KEY, [...items]);
}
function nextId() {
  const n = (world.getDynamicProperty(SEQ_KEY) ?? 0) + 1;
  world.setDynamicProperty(SEQ_KEY, n);
  return n;
}
// 出品者(プレイヤー・村・会社・NPC会社)の、いまの出品の一覧。[{ itemId, qty, price, exp }]。村の「蔵の門番」の画面で使う。
export function listingsOf(sellerId) {
  const out = [];
  for (const id of readJson(ITEMS_KEY, [])) for (const l of readListings(id)) if (l.sellerId === sellerId && l.qty > 0) out.push({ itemId: id, qty: l.qty, price: l.price, exp: l.exp });
  return out;
}

export function listingCountOf(playerId) {
  let n = 0;
  for (const id of readJson(ITEMS_KEY, [])) n += readListings(id).filter((l) => l.sellerId === playerId).length;
  return n;
}
export function listingFee(qty, unitPrice) {
  return Math.max(1, Math.round(qty * unitPrice * getPolicyParam("exchange_listing_fee_rate")));
}

// 取引所の口座(専用口座)の収入にする。口座が無ければ作る。
function addToExchangeAccount(amount) {
  let acct = getEntityAccount(EXCHANGE_ACCOUNT_ID);
  if (!acct) acct = createEntityAccount({ id: EXCHANGE_ACCOUNT_ID, type: "exchange", name: "Exchange", cash: 0 });
  acct.cash += amount;
  saveEntityAccount(acct);
}

// 取引所プールの品を出品する。戻り値: { ok:true, id, fee } | { ok:false, reason }
//   reason: bad_qty | bad_price | not_tradable | price_too_high | not_in_pool | too_many_listings | board_full | insufficient_funds
export function createListing(player, itemId, qty, unitPrice) {
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: "bad_qty" };
  if (!Number.isInteger(unitPrice) || unitPrice < 1) return { ok: false, reason: "bad_price" };
  registerExternalNow(itemId); // 外部アドオンの品は、出品するときに品目のページを作る
  if (!isTradable(itemId)) return { ok: false, reason: "not_tradable" };
  if (unitPrice > referencePrice(itemId)) return { ok: false, reason: "price_too_high" };
  if ((getPool(player.id)[itemId] ?? 0) < qty) return { ok: false, reason: "not_in_pool" };
  if (listingCountOf(player.id) >= getPolicyParam("exchange_max_listings")) return { ok: false, reason: "too_many_listings" };
  const list = readListings(itemId);
  if (list.length >= MAX_LISTINGS_PER_ITEM) return { ok: false, reason: "board_full" };
  const fee = listingFee(qty, unitPrice);
  if (getAccount(player).emeralds < fee) return { ok: false, reason: "insufficient_funds", fee };
  debitEmeralds(player, fee, FLOW.EXCHANGE_FEE);
  addToExchangeAccount(fee);
  takeFrom(poolKey, player.id, itemId, qty);
  const day = world.getDay();
  const listing = { id: nextId(), sellerId: player.id, sellerName: player.name, itemId, qty, price: unitPrice, day, exp: day + getPolicyParam("exchange_listing_days") };
  list.push(listing);
  writeListings(itemId, list);
  try { player.setDynamicProperty("tut_ex_listed", 1); } catch (e) {} // 導入クエスト「取引所に出品する」の印
  return { ok: true, id: listing.id, fee };
}

// 出品を取り下げる。残りの品は取引所プールへ戻る(輸送費は返らない)。
export function cancelListing(player, itemId, listingId) {
  const list = readListings(itemId);
  const i = list.findIndex((l) => l.id === listingId);
  if (i === -1) return { ok: false, reason: "not_found" };
  if (list[i].sellerId !== player.id) return { ok: false, reason: "not_yours" };
  const [l] = list.splice(i, 1);
  writeListings(itemId, list);
  addToPool(l.sellerId, itemId, l.qty);
  return { ok: true, returned: l.qty };
}

export function listMyListings(playerId) {
  const out = [];
  for (const id of readJson(ITEMS_KEY, [])) out.push(...readListings(id).filter((l) => l.sellerId === playerId));
  return out.sort((a, b) => a.id - b.id);
}

// 品目ごとの出品(安い順・古い順)。HRMHRMの常設出品は、在庫があれば先頭ではなく価格の順に並ぶ。
// ---- 相場(旧・ゴーレムの現物取引)。取引所の常設の取引相手として統合(0.5.8) ----
// 価格は market-engine の相場(基準 × 掛率 × 週のパターン × 需要圧力)。在庫は無制限で、売り買いの代金はシステムとの間で動く(台帳: commodity_* / bulk_*。market群)。
// バルクの品(COMMODITIES の bulkOnly)は、シュルカー1箱(1,728個)単位でだけ、相場と取引できる。小口は HRMHRM・プレイヤーの出品から買う。
const MARKET_QTY = 1e9;
const marketByItem = (() => {
  const m = new Map();
  for (const [key, c] of Object.entries(COMMODITIES)) m.set(c.itemId, { key, bulk: !!c.bulkOnly, lot: c.bulkOnly ? SHULKER_UNIT_QTY : 1, volatility: c.volatility });
  return m;
})();
export function marketInfo(itemId) { return marketByItem.get(itemId) ?? null; }
export function marketPrice(itemId) {
  const m = marketByItem.get(itemId);
  if (!m) return null;
  return Math.max(1, Math.round(m.bulk ? getBulkCommodityPrice(m.key) : getCommodityPrice(m.key)));
}
function applyMarketTrade(m, qty, sign) {
  if (m.bulk) applyTrade("commodity_bulk", m.key, sign * (qty / m.lot) * SHULKER_DEMAND_UNITS, m.volatility);
  else applyTrade("commodity", m.key, sign * qty, m.volatility);
}
const SHULKER_DEMAND_UNITS = 24; // trade.js と同じ(シュルカー1箱が需要圧力に与える重み)

// 相場に売る。取引所プールの品を、相場で売る(バルクの品は1,728個の倍数)。戻り値: { ok:true, total, price, qty } | { ok:false, reason: "no_market" | "bad_qty" | "bad_lot" | "not_in_pool" }
export function sellToMarket(player, itemId, qty) {
  const m = marketByItem.get(itemId);
  if (!m) return { ok: false, reason: "no_market" };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: "bad_qty" };
  if (qty % m.lot !== 0) return { ok: false, reason: "bad_lot" };
  if ((getPool(player.id)[itemId] ?? 0) < qty) return { ok: false, reason: "not_in_pool" };
  const price = marketPrice(itemId);
  const total = price * qty;
  takeFrom(poolKey, player.id, itemId, qty);
  creditEmeralds(player, total, m.bulk ? FLOW.BULK_SELL : FLOW.COMMODITY_SELL, { to: "market" });
  applyMarketTrade(m, qty, -1);
  return { ok: true, total, price, qty };
}

export function listOffers(itemId) {
  const offers = readListings(itemId).map((l) => ({ kind: "player", listingId: l.id, sellerId: l.sellerId, sellerName: l.sellerName, sellerNames: l.sellerNames, sellerKind: l.sellerKind, qty: l.qty, price: l.price, day: l.day }));
  const hs = getHrmhrmStock(itemId);
  if (standingItems().has(itemId) && hs > 0) offers.push({ kind: "hrmhrm", sellerName: "HRMHRM", qty: hs, price: referencePrice(itemId), day: -1 });
  const m = marketByItem.get(itemId);
  // システム出品(相場)は、HRMHRMがある品ではHRMHRMの売値以上にそろえる(相場が安いと、HRMHRMの在庫が買われなくなるため)
  if (m) offers.push({ kind: "market", sellerName: "相場", qty: MARKET_QTY, price: standingItems().has(itemId) ? Math.max(marketPrice(itemId), referencePrice(itemId)) : marketPrice(itemId), day: -2, lot: m.lot });
  return offers.sort((a, b) => a.price - b.price || offerTier(a) - offerTier(b) || a.day - b.day);
}
// 同じ値段のときの順番: プレイヤー(村・会社を含む) → NPC会社 → HRMHRM → システム(相場)
export function offerTier(o) {
  if (o.kind === "market") return 3;
  if (o.kind === "hrmhrm") return 2;
  return o.sellerKind === "npc" ? 1 : 0;
}

// 買うときの見積り。安い出品から選ぶ(自分の出品は除く)。戻り値: { ok:true, plan, total } | { ok:false, reason: "bad_qty" | "not_enough_stock" }
export const MAX_BUY_QTY = 5184; // 1回に買える上限(シュルカー3箱分。相場は在庫が無制限なので、入荷の山が膨らまないよう区切る)
export function quote(buyerId, itemId, qty) {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_BUY_QTY) return { ok: false, reason: "bad_qty" };
  const plan = [];
  let left = qty;
  let total = 0;
  for (const o of listOffers(itemId)) {
    if (o.kind === "player" && o.sellerId === buyerId) continue;
    let n = Math.min(left, o.qty);
    if (o.kind === "market") n = Math.floor(n / o.lot) * o.lot; // バルクの品は、シュルカー1箱単位でだけ
    if (n < 1) continue;
    plan.push({ ...o, take: n });
    total += n * o.price;
    left -= n;
    if (left === 0) break;
  }
  if (left > 0) return { ok: false, reason: "not_enough_stock", available: qty - left };
  return { ok: true, plan, total };
}

function creditSeller(offer, amount) {
  if (offer.sellerKind === "village" || offer.sellerKind === "company" || offer.sellerKind === "npc") { creditEntity(offer.sellerId, amount); return; }
  const sellerId = offer.sellerId;
  const p = world.getPlayers().find((x) => x.id === sellerId);
  if (p) { creditEmeralds(p, amount, FLOW.EXCHANGE_SELL, { from: "exchange" }); return; }
  const m = readJson(PROCEEDS_KEY, {});
  m[sellerId] = (m[sellerId] ?? 0) + amount;
  writeJson(PROCEEDS_KEY, m);
}

// 村・会社の口座へ入れる(プレイヤーのお金が、村・会社の口座へ移る。新しく出るお金ではない)。週の記録には exchangeRevenue として積み、次の週次処理で収益に入れる。
function creditEntity(entityId, amount) {
  const acct = getEntityAccount(entityId);
  if (!acct) return; // 口座が消えた(解散など)場合は、取引所の専用口座へ回す
  acct.cash += amount;
  acct.exchangeRevenue = (acct.exchangeRevenue ?? 0) + amount;
  saveEntityAccount(acct);
}

// ---- 村・会社の出荷(取引所への出品) ----
// 週の締めに、村(消費されない原料)・会社(保持数を超えた在庫)が出荷する品を、取引所に出品する。
//   ・出品者は村・会社の口座。売れた代金は、その口座に入る(買い手の残高から移る)。出荷の自動売却(相場以下で現金化)の置き換え。
//   ・単価 = 基準価格 × 掛率 × 出荷の掛け率(村 village_ship_ratio / 会社 company_ship_ratio)。HRMHRMの売値を超えない。
//   ・同じ品の出品は1本にまとめる(数量を足し、単価・期限を新しくする)。売れ残りは期限(exchange_listing_days)で出品者のプール(= 村・会社の id)へ戻り、次の週にまとめて出す。
//   ・輸送費は取らない(村・会社の収支を再検算するまでの暫定)。
//   ・取引リストにない品は出品できない。呼び出し側が従来どおり自動売却する(unlisted で返す)。
// 戻り値: { listed: {itemId: n}, unlisted: {itemId: n} }
export function entityShippingEnabled() { return getPolicyParam("exchange_entity_shipping") >= 1; }
export function entityListingPrice(itemId, ratio) {
  const raw = Math.round(getItemBasePriceExact(itemId) * getPriceLevel() * ratio);
  return Math.max(1, Math.min(raw, referencePrice(itemId)));
}
export function shipToExchange({ entityId, kind, names, items, ratio }) {
  const listed = {}; const unlisted = {};
  const pool = getPool(entityId);
  const all = { ...items };
  for (const [id, n] of Object.entries(pool)) if (n > 0) all[id] = (all[id] ?? 0) + n; // 前の週の売れ残り(プール)も、今週の値段で出し直す
  const day = world.getDay();
  for (const [itemId, qty] of Object.entries(all)) {
    if (!(qty > 0)) continue;
    const fromPool = pool[itemId] ?? 0;
    if (!isTradable(itemId)) { if (items[itemId] > 0) unlisted[itemId] = items[itemId]; continue; }
    const list = readListings(itemId);
    let l = list.find((x) => x.sellerId === entityId);
    if (!l && list.length >= MAX_LISTINGS_PER_ITEM) { if (items[itemId] > 0) unlisted[itemId] = items[itemId]; continue; }
    if (fromPool > 0) takeFrom(poolKey, entityId, itemId, fromPool);
    if (!l) {
      l = { id: nextId(), sellerId: entityId, sellerName: names.en, sellerNames: names, sellerKind: kind, itemId, qty: 0, price: 0, day, exp: 0 };
      list.push(l);
    }
    l.qty += qty;
    l.price = entityListingPrice(itemId, ratio);
    l.day = day;
    l.exp = day + getPolicyParam("exchange_listing_days");
    writeListings(itemId, list);
    listed[itemId] = (listed[itemId] ?? 0) + qty;
  }
  return { listed, unlisted };
}


// ---- 口座(村・会社・NPC)が買い手になる ----
// 最安の出品(プレイヤー・村・会社・NPC)から、単価の上限 maxUnitPrice 以内で、口座の現金の範囲だけ買う。HRMHRMの在庫と相場(システム出品)は、
// allowHrmhrm を指定したときだけ(HRMHRMは在庫から)買える。相場からは買わない。代金は買い手の口座から出て、売り手(プレイヤーならその残高)へ移る。
// 品物は呼び出し側が受け取る(戻り値の qty)。買えた分だけ返す。
// deferDebit を指定すると、買い手の口座からは引かない(週の締めの途中で、読み込み済みの口座を後で保存する処理のため)。引くのは呼び出し側。
// 戻り値: { qty, spent }
export function buyForEntity({ entityId, itemId, qty, maxUnitPrice, budget = Infinity, allowHrmhrm = false, deferDebit = false }) {
  const acct = getEntityAccount(entityId);
  if (!acct || !(qty > 0) || !isTradable(itemId)) return { qty: 0, spent: 0 };
  let left = Math.floor(qty);
  let cash = Math.min(Math.floor(acct.cash), budget);
  let bought = 0; let spent = 0;
  for (const o of listOffers(itemId)) {
    if (left <= 0 || cash <= 0) break;
    if (o.kind === "market") continue;
    if (o.kind === "hrmhrm" && !allowHrmhrm) continue;
    if (o.sellerId === entityId) continue; // 自分の出品は買わない(プレイヤー・村・会社とも)
    if (o.price > maxUnitPrice) break; // 安い順なので、ここから先は全部上限を超える
    const n = Math.min(left, o.qty, Math.floor(cash / o.price));
    if (n < 1) continue;
    const amount = n * o.price;
    if (o.kind === "hrmhrm") {
      const st = hstock();
      st[itemId] = Math.max(0, (st[itemId] ?? 0) - n);
      writeJson(HSTOCK_KEY, st);
    } else {
      creditSeller(o, amount);
      const list = readListings(itemId);
      const l = list.find((x) => x.id === o.listingId);
      l.qty -= n;
      writeListings(itemId, list.filter((x) => x.qty > 0));
    }
    cash -= amount; left -= n; bought += n; spent += amount;
    recordTrade(itemId, n, o.price);
  }
  if (spent > 0 && !deferDebit) { // deferDebit: 呼び出し側(週次の締め)が、spent をまとめて口座から引く
    const a = getEntityAccount(entityId); // 売り手が同じ口座の別名義でないことを保証できないので、読み直してから引く
    a.cash -= spent;
    a.exchangeExpense = (a.exchangeExpense ?? 0) + spent;
    saveEntityAccount(a);
  }
  return { qty: bought, spent };
}

// 買う。プレイヤーの出品の代金は、口座残高から払う(カードは使えない。お金が新しく出るのを防ぐ)。HRMHRMの分は、残高の不足をカード(リボ)に回せる。
// 戻り値: { ok:true, total, qty, fromCard } | { ok:false, reason: "bad_qty" | "not_enough_stock" | "insufficient_funds" | "no_card" | "card_suspended" | "credit_limit", total? }
export function buy(player, itemId, qty) {
  const q = quote(player.id, itemId, qty);
  if (!q.ok) return q;
  const cash = getAccount(player).emeralds;
  const hrm = q.plan.filter((s) => s.kind === "hrmhrm").reduce((a, s) => a + s.take * s.price, 0);
  const playersTotal = q.total - hrm;
  if (cash < playersTotal) return { ok: false, reason: "insufficient_funds", total: q.total };
  const cashForHrm = cash - playersTotal;
  const fromCard = Math.max(0, hrm - cashForHrm);
  if (fromCard > 0) {
    if (player.getDynamicProperty("cr_card_suspended")) return { ok: false, reason: "card_suspended", total: q.total };
    if (!hasCard(player)) return { ok: false, reason: "no_card", total: q.total };
    if (getAvailableCredit(player) < fromCard) return { ok: false, reason: "credit_limit", total: q.total };
  }
  if (hrm - fromCard > 0) debitEmeralds(player, hrm - fromCard, FLOW.MAIL_ORDER, { to: "HRMHRM" });
  if (fromCard > 0) player.setDynamicProperty("cr_card_balance", (player.getDynamicProperty("cr_card_balance") ?? 0) + fromCard);
  for (const s of q.plan) {
    recordTrade(itemId, s.take, s.price);
    if (s.kind === "hrmhrm") {
      const st = hstock();
      st[itemId] = Math.max(0, (st[itemId] ?? 0) - s.take);
      writeJson(HSTOCK_KEY, st);
    } else if (s.kind === "market") {
      const m = marketByItem.get(itemId);
      debitEmeralds(player, s.take * s.price, m.bulk ? FLOW.BULK_BUY : FLOW.COMMODITY_BUY, { to: "market" });
      applyMarketTrade(m, s.take, +1);
    } else {
      const amount = s.take * s.price;
      debitEmeralds(player, amount, FLOW.EXCHANGE_BUY, { to: s.sellerName });
      creditSeller(s, amount);
      const list = readListings(itemId);
      const l = list.find((x) => x.id === s.listingId);
      l.qty -= s.take;
      writeListings(itemId, list.filter((x) => x.qty > 0));
    }
  }
  addToInbox(player.id, itemId, qty);
  return { ok: true, total: q.total, qty, hrmhrm: hrm, fromCard };
}

// 保留の代金(売り手がオフラインだった分)を、ログインした本人の口座へ入れる。戻り値: 入れた額
export function claimProceeds(player) {
  const m = readJson(PROCEEDS_KEY, {});
  const amount = m[player.id] ?? 0;
  if (!(amount > 0)) return 0;
  delete m[player.id];
  writeJson(PROCEEDS_KEY, m);
  creditEmeralds(player, amount, FLOW.EXCHANGE_SELL, { from: "exchange" });
  return amount;
}

// ---- 入荷(専用シュルカーへ) ----
// 入荷一覧の品を、専用シュルカーへ届ける。入りきらない分・届けられない分は入荷一覧に残る。
//   戻り値: { ok:true, delivered:{id:n}, left:{id:n} } | { ok:false, reason: "no_binding" | "unloaded" }
export function deliverInbox(player, getBlock) {
  const inbox = getInbox(player.id);
  const ids = Object.keys(inbox);
  if (!ids.length) return { ok: true, delivered: {}, left: {} };
  const stacks = [];
  const unbuilt = {}; // 作れなかった品(キーに対応するアイテムが作れない)は、入荷一覧に残す
  for (const id of ids) {
    const made = makeStacks(id, inbox[id]);
    const n = made.reduce((a, s) => a + s.amount, 0);
    if (n < inbox[id]) unbuilt[id] = inbox[id] - n;
    stacks.push(...made);
  }
  const res = depositToPrivateShulker(player.id, stacks, getBlock);
  if (!res.ok) return res;
  const leftover = { ...unbuilt };
  for (const s of res.leftover) { const k = stackKey(s) ?? s.typeId; leftover[k] = (leftover[k] ?? 0) + s.amount; }
  const delivered = {};
  for (const id of ids) {
    const d = inbox[id] - (leftover[id] ?? 0);
    if (d > 0) delivered[id] = d;
  }
  writeJson(inboxKey(player.id), leftover);
  if (Object.keys(delivered).length) { try { player.setDynamicProperty("tut_ex_received", 1); } catch (e) {} } // 導入クエスト「取引所で買って受け取る」の印
  return { ok: true, delivered, left: leftover };
}

// ---- 出荷(専用シュルカーから取引所プールへ) ----
// 取引できる品だけを取り込む(通常の品と、単独のエンチャント本・ポーション。名前・説明・傷み・複数エンチャント・エンチャント済みの道具は除く)。戻り値: { ok:true, moved } | { ok:false, reason: "no_binding" | "unloaded" }
// 専用シュルカーにある、取り込める品(通常の品)の一覧。戻り値: { ok:true, items:{id:n} } | { ok:false, reason }
export function shulkerContents(player, getBlock) {
  const block = getPrivateShulkerBlock(player.id, getBlock);
  if (block === null) return { ok: false, reason: "no_binding" };
  if (block === undefined) return { ok: false, reason: "unloaded" };
  const c = block.getComponent("minecraft:inventory")?.container;
  if (!c) return { ok: false, reason: "unloaded" };
  const items = {}; const stale = {};
  for (let i = 0; i < c.size; i++) {
    const s = c.getItem(i);
    const k = s ? stackKey(s) : null;
    if (!k || !(isTradable(k) || isAutoListable(k))) continue; // 取引リストにない品(外部アドオン・マイクラの更新で増えた品)は、取り込むときに自動で載る
    if (isStaleStack(s)) { stale[k] = (stale[k] ?? 0) + s.amount; continue; } // 鮮度が80%未満の食品は受け付けない(シュルカーに残る)
    items[k] = (items[k] ?? 0) + s.amount;
  }
  return { ok: true, items, stale };
}

export function pullToPool(player, itemId, qty, getBlock) {
  const block = getPrivateShulkerBlock(player.id, getBlock);
  if (block === null) return { ok: false, reason: "no_binding" };
  if (block === undefined) return { ok: false, reason: "unloaded" };
  const c = block.getComponent("minecraft:inventory")?.container;
  if (!c) return { ok: false, reason: "unloaded" };
  registerExternalNow(itemId); // 外部アドオンの品は、プールに入れた時点で取引リストに載せる
  if (!isTradable(itemId)) return { ok: true, moved: 0 };
  let need = qty; let staleSkipped = 0;
  for (let i = 0; i < c.size && need > 0; i++) {
    const s = c.getItem(i);
    if (!s || stackKey(s) !== itemId) continue;
    if (isStaleStack(s)) { staleSkipped += s.amount; continue; } // 鮮度が低い品は取り込まない(シュルカーに残る)
    const n = Math.min(need, s.amount);
    if (n === s.amount) c.setItem(i, undefined);
    else { s.amount -= n; c.setItem(i, s); }
    need -= n;
  }
  const moved = qty - need;
  if (moved > 0) addToPool(player.id, itemId, moved);
  return { ok: true, moved, staleSkipped };
}

// ---- 日次の処理: 期限切れの出品の片付け / HRMHRMの在庫の補充 ----
export function expireListings(day = world.getDay()) {
  let n = 0;
  for (const id of readJson(ITEMS_KEY, [])) {
    const list = readListings(id);
    const keep = list.filter((l) => {
      if (l.exp > day) return true;
      addToPool(l.sellerId, id, l.qty); // 残りの品は、出品者の取引所プールへ戻る(オフラインでも戻せる)
      n++;
      return false;
    });
    if (keep.length !== list.length) writeListings(id, keep);
  }
  return n;
}

export function refillHrmhrm() {
  const ratio = getPolicyParam("exchange_hrmhrm_refill_ratio");
  const st = hstock();
  for (const [id, standing] of standingItems()) {
    const cur = st[id] ?? 0;
    if (cur < standing) st[id] = Math.min(standing, cur + Math.max(1, Math.ceil(standing * ratio)));
  }
  writeJson(HSTOCK_KEY, st);
}

// HRMHRMの常設出品の仕入れ: 在庫が常設数に足りない品を、まず取引所の出品(プレイヤー・村・会社・NPC)から買う。
// 単価は 基準価格 × 掛率 × hrmhrm_exchange_buy_ratio まで、1日の予算は HRMHRMの現金 × hrmhrm_buy_budget_ratio まで。買えなかった分は、従来どおり補充(refillHrmhrm)される。
// 売り手には代金が入る(HRMHRMの口座から)。戻り値: { itemId: 買った数 }
const HRMHRM_ACCOUNT_ID = "hrmhrm";
export function restockHrmhrm() {
  const acct = getEntityAccount(HRMHRM_ACCOUNT_ID);
  const ratio = getPolicyParam("hrmhrm_exchange_buy_ratio");
  const share = getPolicyParam("hrmhrm_buy_budget_ratio");
  if (!acct || !(ratio > 0) || !(share > 0)) return {};
  let budget = Math.max(0, Math.floor(acct.cash * share));
  const st = hstock();
  const bought = {};
  for (const [id, standing] of standingItems()) {
    if (budget <= 0) break;
    const cur = st[id] ?? 0;
    if (cur >= standing) continue;
    const cap = Math.max(1, Math.floor(getItemBasePriceExact(id) * getPriceLevel() * ratio));
    const r = buyForEntity({ entityId: HRMHRM_ACCOUNT_ID, itemId: id, qty: standing - cur, maxUnitPrice: cap, budget });
    if (r.qty > 0) { st[id] = cur + r.qty; bought[id] = r.qty; budget -= r.spent; }
  }
  if (Object.keys(bought).length > 0) writeJson(HSTOCK_KEY, st);
  return bought;
}

export function dailyUpkeep(day = world.getDay()) {
  const done = world.getDynamicProperty(DAY_KEY);
  if (done === day) return false;
  world.setDynamicProperty(DAY_KEY, day);
  expireListings(day);
  if (done !== undefined) { restockHrmhrm(); refillHrmhrm(); }
  return true;
}

// ---- 確認用の管理コマンド(UI ができるまで。実機で取引の流れを試す) ----
//   /scriptevent bmh:exchange pull <品目> <数量>      専用シュルカー → 取引所プール
//   /scriptevent bmh:exchange list <品目> <数量> <単価>  プールの品を出品
//   /scriptevent bmh:exchange offers <品目>            出品の一覧(安い順)
//   /scriptevent bmh:exchange buy <品目> <数量>        買う(入荷一覧へ → 専用シュルカーへ届く)
//   /scriptevent bmh:exchange mine | cancel <出品ID> <品目> | pool | inbox | deliver | refill
const withNs = (x) => (x.includes(":") ? x : "minecraft:" + x);
export function adminCommand(player, message) {
  const [cmd, a, b, c] = String(message ?? "").trim().split(/\s+/);
  const say = (m) => { try { player.sendMessage(m); } catch (e) {} };
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k.replace("minecraft:", "")} x${v}`).join(", ") || "(none)";
  if (cmd === "pull") { const r = pullToPool(player, withNs(a), Number(b)); say(r.ok ? `pulled ${r.moved}` : r.reason); }
  else if (cmd === "list") { const r = createListing(player, withNs(a), Number(b), Number(c)); say(r.ok ? `listed #${r.id} (freight ${r.fee} E)` : r.reason); }
  else if (cmd === "offers") say(listOffers(withNs(a)).map((o) => `${o.sellerName}${o.listingId ? " #" + o.listingId : ""}: ${o.qty} @ ${o.price} E`).join("\n") || "(none)");
  else if (cmd === "buy") { const r = buy(player, withNs(a), Number(b)); say(r.ok ? `bought ${r.qty} for ${r.total} E` : r.reason + (r.total ? ` (${r.total} E)` : "")); }
  else if (cmd === "mine") say(listMyListings(player.id).map((l) => `#${l.id} ${l.itemId.replace("minecraft:", "")}: ${l.qty} @ ${l.price} E (until day ${l.exp})`).join("\n") || "(none)");
  else if (cmd === "cancel") { const r = cancelListing(player, withNs(b), Number(a)); say(r.ok ? `returned ${r.returned}` : r.reason); }
  else if (cmd === "pool") say("pool: " + fmt(getPool(player.id)));
  else if (cmd === "inbox") say("inbox: " + fmt(getInbox(player.id)));
  else if (cmd === "deliver") { const r = deliverInbox(player); say(r.ok ? `delivered: ${fmt(r.delivered)} / left: ${fmt(r.left)}` : r.reason); }
  else if (cmd === "refill") { refillHrmhrm(); say("HRMHRM stock refilled"); }
  else say("usage: pull|list|offers|buy|mine|cancel|pool|inbox|deliver|refill");
}

export function startExchange() {
  startExternalItems();
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    try { claimProceeds(ev.player); } catch (e) { console.warn("[BeeMyHoney] exchange spawn: " + e); }
  });
  system.runInterval(() => {
    try { dailyUpkeep(); } catch (e) { console.warn("[BeeMyHoney] exchange upkeep: " + e); }
  }, 1200);
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:exchange" || ev.sourceEntity?.typeId !== "minecraft:player") return;
    try { adminCommand(ev.sourceEntity, ev.message); } catch (e) { console.warn("[BeeMyHoney] bmh:exchange: " + e); }
  });
}
