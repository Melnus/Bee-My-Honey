import { getItemBasePriceExact } from "./village-pricing.js";
import { getPolicyParam } from "./policy.js";
import { getVillageSlots, pruneOrders, ORDERS_KEEP } from "./village-demand.js";
import { saveCore } from "./core-registry.js";
import { currentGlobalDay } from "./labor.js";

// ==========================================
// 村の物々交換 / Village Barter  (チケットB: 寄り合い所「欲しいものはないか聞く」)
// ------------------------------------------
// プレイヤーが、村の「今日の欲しいもの(入荷の枠)」にある品を手持ちから渡し、代わりに村の蔵にある品を受け取る。その場での交換(手持ちのみ)。
//   ・渡した品は村の蔵に入り、その日の枠の受注済みの数に数える(クエストの納品と二重には受けられない)。報酬はエメラルドではなく品物。
//   ・受け取れる数 = 渡した品の価値 × village_barter_ratio(既定0.9。村に有利)÷ 受け取る品の基準価格。取引所の基準価格で換算する。
//   ・村の蔵にある数までしか受け取れない。村の口座の現金は動かない。
// 受注の記録(core.orders)には、報酬0・納品済みの注文として残る(枠の受注済みの数の計算が、そのまま使える)。
// ==========================================

// 受け取れる数(蔵の在庫の範囲)。戻り値: { ok, n } | { ok:false, reason }
export function barterQuote(core, wantId, qty, takeId) {
  if (!core || core.kind !== "village" || core.dissolving) return { ok: false, reason: "no_village" };
  if (!(qty >= 1)) return { ok: false, reason: "bad_qty" };
  if (wantId === takeId) return { ok: false, reason: "same_item" };
  const have = Math.floor(core.stock?.[takeId] ?? 0);
  if (have < 1) return { ok: false, reason: "no_stock" };
  const give = getItemBasePriceExact(wantId) * qty * getPolicyParam("village_barter_ratio");
  const n = Math.min(have, Math.floor(give / getItemBasePriceExact(takeId)));
  return n >= 1 ? { ok: true, n } : { ok: false, reason: "too_little" };
}

// 村の蔵から受け取れる品(在庫のある品)。
export function barterStockItems(core) {
  return Object.entries(core?.stock ?? {}).filter(([, n]) => n >= 1).map(([id, n]) => ({ itemId: id, n: Math.floor(n) })).sort((a, b) => b.n - a.n);
}

// 交換する。player = { id, name }。ops = { remove(itemId, n) -> bool(手持ちから引けたか), add(itemId, n) }(持ち物の出し入れは呼び出し側)。
// 通常の受注と同じく、入口で古い注文を片付け、注文の上限(ORDERS_KEEP)を超えるなら断る。
// 記録(saveCore)が成功してから、受け取る品を渡す。保存に失敗したら、渡した品を返して交換ごと取り消す(品物だけ動く状態を作らない)。
// 戻り値: { ok, n, core } | { ok:false, reason }。保存は中で済ませる。
export function barterExecute(core, player, wantId, qty, takeId, ops, day = currentGlobalDay()) {
  pruneOrders(core, day);
  if ((core.orders ?? []).length >= ORDERS_KEEP) return { ok: false, reason: "full" };
  const slot = getVillageSlots(core, day, player.name, player.id).find((s) => s.itemId === wantId);
  if (!slot || slot.left < 1) return { ok: false, reason: "no_slot" };
  if (qty > slot.left) return { ok: false, reason: "over_need" };
  const q = barterQuote(core, wantId, qty, takeId);
  if (!q.ok) return q;
  if (!ops.remove(wantId, qty)) return { ok: false, reason: "not_enough" };
  const before = { stock: { ...(core.stock ?? {}) }, orders: [...(core.orders ?? [])] };
  core.stock = core.stock ?? {};
  core.stock[wantId] = (core.stock[wantId] ?? 0) + qty;
  core.stock[takeId] = (core.stock[takeId] ?? 0) - q.n;
  core.orders = core.orders ?? [];
  core.orders.push({ key: "barter:" + day + ":" + player.id + ":" + wantId + ":" + core.orders.length, who: player.name, whoId: player.id, itemId: wantId, qty, reward: 0, day, expiresWeek: Math.floor(day / 7) + 1, done: true });
  let saved = false;
  try { saved = saveCore(core) !== false; } catch (e) { console.warn("[BeeMyHoney] barter save failed: " + e); }
  if (!saved) {
    core.stock = before.stock; core.orders = before.orders;
    ops.add(wantId, qty); // 渡した品を返す
    return { ok: false, reason: "save_failed" };
  }
  ops.add(takeId, q.n);
  return { ok: true, n: q.n, core };
}
