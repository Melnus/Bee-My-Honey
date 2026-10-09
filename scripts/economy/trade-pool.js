import { world } from "@minecraft/server";

// ==========================================
// trade_pool (集計テンプレート) — 2形態
// ------------------------------------------
// dev/spec-03-templates-agreed.md(9/28版)で確定した形。poolTypeで実装を分ける。
//
//   shop型     — 例: Paws & Blackpots(エネルギー取引)。単一itemIdの実在庫カウンタのみ。
//                初期在庫ゼロ・無限供給しない(#1のCOMMODITIESとは根本的に別アーキテクチャ)。
//                価格をどう決めるかはこのモジュールの責務外(呼び出し側=各取引所の実装が持つ)。
//   exchange型 — 例: 生鮮市場。genreTag配下に複数のtrade_order(出品)がぶら下がる形で集計する。
//                出品はitemId別にも絞り込めるようにし(「魚種ごとに1ページ」という表示要件のため)、
//                価格推移はitemId単位で別に記録する(genreを跨いで混ぜて表示すると意味を成さないため)。
//
// ここではデータの出し入れだけを提供し、UIやfulfillMode("shipment"/"pool")の解釈は
// 呼び出し側(各取引所のeconomy/ui実装)が行う。世界共有のデータなので全てworldスコープの
// 動的プロパティに保存する(プレイヤー個別ではない)。
// ==========================================

function currentGlobalDay() {
  return world.getDay();
}

function readJson(key, fallback) {
  const raw = world.getDynamicProperty(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  world.setDynamicProperty(key, JSON.stringify(value));
}

// ==========================================
// shop型: 単一itemIdの実在庫カウンタ
// ==========================================

function shopStockKey(poolId) {
  return `pool_shop_${poolId}`;
}

export function getShopStock(poolId) {
  return world.getDynamicProperty(shopStockKey(poolId)) ?? 0;
}

// 在庫を増やす(誰かが実物を納品した時など)。負の数は渡さないこと。
export function addShopStock(poolId, qty) {
  if (!Number.isFinite(qty) || qty <= 0) return getShopStock(poolId);
  const next = getShopStock(poolId) + qty;
  world.setDynamicProperty(shopStockKey(poolId), next);
  return next;
}

// 在庫を減らす(誰かが引き出した時など)。在庫が足りなければ何もせず false を返す。
export function removeShopStock(poolId, qty) {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, stock: getShopStock(poolId) };
  const current = getShopStock(poolId);
  if (current < qty) return { ok: false, stock: current };
  const next = current - qty;
  world.setDynamicProperty(shopStockKey(poolId), next);
  return { ok: true, stock: next };
}

// 在庫が目標値(targetBaseline)を下回っていたら、そこまで補充する。既に上回っていれば何もしない。
// 「常に一定数を切らさない」品目(木炭・石炭など)向け。ネザー産品のように「初期在庫が尽きたら
// 終わり」にしたい品目には、この関数を呼ばずaddShopStock/removeShopStockだけを使えばよい。
export function replenishShopStock(poolId, targetBaseline) {
  const current = getShopStock(poolId);
  if (current >= targetBaseline) return current;
  world.setDynamicProperty(shopStockKey(poolId), targetBaseline);
  return targetBaseline;
}


// 出品(trade_orderの最小形)の想定フィールド:
// { id, issuer: {type, id}, itemId, unit, quantity, price, regionTag, createdDay, anonymize }

const PRICE_HISTORY_MAX_POINTS = 30; // 直近何件まで保持するか(グラフ用)
let _exchangeOrderSeq = 0;

function exchangeOrdersKey(genreTag) {
  return `pool_exchange_orders_${genreTag}`;
}

function priceHistoryKey(itemId) {
  return `pool_exchange_history_${itemId}`;
}

// genreTag配下の出品一覧を取得。itemIdを渡すとその品目だけに絞り込む。
// 「安い順」がspec-03の表示要件なので、デフォルトで価格昇順ソートして返す。
export function listExchangeOrders(genreTag, { itemId = null, sortByPrice = true } = {}) {
  const orders = readJson(exchangeOrdersKey(genreTag), []);
  const filtered = itemId ? orders.filter((o) => o.itemId === itemId) : orders;
  if (!sortByPrice) return filtered;
  return [...filtered].sort((a, b) => a.price - b.price);
}

// 新規出品を追加する。order は id/createdDay を自動採番するので呼び出し側では省略してよい。
export function addExchangeOrder(genreTag, order) {
  const orders = readJson(exchangeOrdersKey(genreTag), []);
  const entry = {
    id: `xo_${Date.now()}_${_exchangeOrderSeq++}`,
    createdDay: currentGlobalDay(),
    ...order
  };
  orders.push(entry);
  writeJson(exchangeOrdersKey(genreTag), orders);
  return entry;
}

// 出品を1件取り下げる(売れた・キャンセルされた等)。
export function removeExchangeOrder(genreTag, orderId) {
  const orders = readJson(exchangeOrdersKey(genreTag), []);
  const next = orders.filter((o) => o.id !== orderId);
  const removed = next.length !== orders.length;
  if (removed) writeJson(exchangeOrdersKey(genreTag), next);
  return removed;
}

// 出品を1件取得する。
export function getExchangeOrder(genreTag, orderId) {
  return readJson(exchangeOrdersKey(genreTag), []).find((o) => o.id === orderId) ?? null;
}

// 出品から qty 個ぶんを約定(消費)させる。残りが0になったら出品ごと取り下げる。
// 出品が無い/残数が足りない場合は何も変えず ok:false を返す。
export function consumeExchangeOrder(genreTag, orderId, qty) {
  const orders = readJson(exchangeOrdersKey(genreTag), []);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return { ok: false, reason: "notFound" };
  const order = orders[idx];
  if (!Number.isFinite(qty) || qty <= 0 || order.quantity < qty) return { ok: false, reason: "insufficient", order };
  order.quantity -= qty;
  const consumed = { ...order, quantity: qty };
  if (order.quantity <= 0) orders.splice(idx, 1);
  writeJson(exchangeOrdersKey(genreTag), orders);
  return { ok: true, order: consumed, remaining: Math.max(0, order.quantity) };
}

// 全出品を1件ずつ mapper に通す。mapper が null を返した出品は取り下げ、オブジェクトを返せば置き換える。
// 鮮度による目減りなど、巡回時の一括更新用。取り下げた件数を返す。
export function mutateExchangeOrders(genreTag, mapper) {
  const orders = readJson(exchangeOrdersKey(genreTag), []);
  const next = [];
  for (const o of orders) {
    const r = mapper(o);
    if (r) next.push(r);
  }
  writeJson(exchangeOrdersKey(genreTag), next);
  return orders.length - next.length;
}

// 巡回のたびに古い出品を除去する(spec-03の要件)。maxAgeDaysを超えたものを削除して件数を返す。
export function pruneExchangeOrders(genreTag, maxAgeDays) {
  const orders = readJson(exchangeOrdersKey(genreTag), []);
  const today = currentGlobalDay();
  const next = orders.filter((o) => today - o.createdDay <= maxAgeDays);
  const removedCount = orders.length - next.length;
  if (removedCount > 0) writeJson(exchangeOrdersKey(genreTag), next);
  return removedCount;
}

// 価格推移に1点追加する(itemId単位。約定した時や日次の代表値を記録する想定)。
// 直近PRICE_HISTORY_MAX_POINTS件だけ保持し、古いものから捨てる。
export function recordExchangePrice(itemId, price) {
  const history = readJson(priceHistoryKey(itemId), []);
  history.push({ day: currentGlobalDay(), price });
  while (history.length > PRICE_HISTORY_MAX_POINTS) history.shift();
  writeJson(priceHistoryKey(itemId), history);
  return history;
}

export function getExchangePriceHistory(itemId) {
  return readJson(priceHistoryKey(itemId), []);
}


