import { regionDef } from "../data/village-regions.js";
import { world, system } from "@minecraft/server";
import { listCores, loadCore, saveCore } from "./core-registry.js";
import { getEntityAccount, saveEntityAccount } from "./account.js";
import { getPolicyParam } from "./policy.js";
import { unitPrice, reservedCash } from "./village-demand.js";
import { jobInputNeeds } from "./village-jobs.js";
import { creditEmeralds, FLOW } from "./ledger.js";
import { coreNamePair } from "../i18n/names.js";

// ==========================================
// 村のイベント(在庫の偏り型) / Village Events  (チケットB ★1段目。作者の決定 2026-11-06)
// ------------------------------------------
// 村ごとに、毎日、次の2種類を出す(core.events に保存)。
//   ★運んでよ(carry)  … 蔵の総数が上限(village_storehouse_cap)の75%を超えた村が、いちばん溜まっている品を、ほかの村へ運ぶよう頼む。
//        ・品目 = 先週つくった品のうち蔵に多いもの(なければ蔵に最も多い品)。数量 = 蔵の半分(1〜256個)。届け先 = いちばん近い、蔵に空きのある別の村。
//        ・出荷元の村の「蔵の門番」で引き受けると、その数が蔵から手持ちに渡る。届け先の村の「蔵の門番」で「届け物を渡す」と完了する。
//        ・運搬は手持ちでも専用シュルカーでも可。品物は届け先の蔵に入り、報酬は届け先の村が払う(単価 = 村の入荷の単価。距離の上乗せなし)。
//        ・期限は2週間。失敗(期限切れ)の罰はない。届け先が解散したら取り消し(品物は運んでいる人の手に残る)。
//        ・村が1つしかないワールドでは出さない。
//   ★緊急調達(urgent) … 職業の原料が1日分に足りない村が、足りない分を、通常の1.5倍の単価で、その場で買う(締め日を待たない)。
//        ・誰でも、手持ちか専用シュルカーから納められる。期限は2週間。原料が足りれば取り下げる。
// 蔵の上限は、品の総数。受け取ると上限を超える分は受け取らない。村の資金(現金 − 受注の予約)が足りなければ、払える分だけ払う。
// event = { id, type, itemId, qty, unit, exp, toId?, toNames?, by?, byName?, day }
// ==========================================
export const EVENT_DAYS = 14;
export const CAP_FILL = 0.75;
export const URGENT_MULT = 1.5;
export const CARRY_MAX = 256;
const DAY_KEY = "bmh_vev_day";

export const storeTotal = (core) => Object.values(core?.stock ?? {}).reduce((s, n) => s + Math.max(0, n), 0);
export const storeCap = (core) => Math.floor(getPolicyParam("village_storehouse_cap") * regionDef(core).capMult); // 地域で倍率が変わる(雪原は2倍)
const villages = () => listCores("village").filter((c) => !c.npc && !c.dissolving);

function nearestRoom(core, all, qty) {
  return all.filter((c) => c.id !== core.id && storeTotal(c) + qty <= storeCap(c))
    .sort((a, b) => dist(core, a) - dist(core, b))[0];
}
const dist = (a, b) => (a.dimId === b.dimId ? 0 : 1e9) + Math.hypot(a.x - b.x, a.z - b.z);

// 日次: 期限切れ・無効になったイベントを片付け、新しく出す。変更した村の数を返す。
export function updateVillageEvents(day) {
  const all = villages();
  let changed = 0;
  for (const core of all) {
    const before = JSON.stringify(core.events ?? []);
    const needs = jobInputNeeds(core);
    core.events = (core.events ?? []).filter((ev) => {
      if (day > ev.exp) return false;
      if (ev.type === "carry") return !!all.find((c) => c.id === ev.toId);
      if (ev.type === "urgent") return (core.stock?.[ev.itemId] ?? 0) < (needs[ev.itemId]?.perDay ?? 0);
      return false;
    });
    let n = core.events.length;
    // ★運んでよ
    if (all.length >= 2 && !core.events.some((e) => e.type === "carry") && storeTotal(core) >= storeCap(core) * CAP_FILL) {
      const made = Object.keys(core.lastShip?.produced ?? {}).filter((id) => (core.stock?.[id] ?? 0) >= 2).sort((a, b) => core.stock[b] - core.stock[a]);
      const itemId = made[0] ?? Object.entries(core.stock ?? {}).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (itemId) {
        const qty = Math.max(1, Math.min(CARRY_MAX, Math.floor(core.stock[itemId] / 2)));
        const to = nearestRoom(core, all, qty);
        if (to) core.events.push({ id: `carry:${day}:${n++}`, type: "carry", itemId, qty, unit: unitPrice(itemId), exp: day + EVENT_DAYS, toId: to.id, toNames: coreNamePair(to), by: null, day });
      }
    }
    // ★緊急調達
    if (!core.events.some((e) => e.type === "urgent")) {
      const acct = getEntityAccount(core.id);
      const free = (acct?.cash ?? 0) - reservedCash(core, day);
      let best = null;
      for (const [id, v] of Object.entries(needs)) {
        const short = Math.ceil(v.perDay - (core.stock?.[id] ?? 0));
        if (short > 0 && (!best || short > best.short)) best = { id, short };
      }
      if (best && free >= 1 && storeTotal(core) + best.short <= storeCap(core)) {
        core.events.push({ id: `urgent:${day}:${n++}`, type: "urgent", itemId: best.id, qty: best.short, unit: unitPrice(best.id) * URGENT_MULT, exp: day + EVENT_DAYS, by: null, day });
      }
    }
    if (JSON.stringify(core.events) !== before) { saveCore(core); changed++; }
  }
  return changed;
}

// 村の画面の1段目に出すイベント(その村で起きているもの。運んでよは、まだ引き受けられていないものだけ)
export function eventsAt(core, day = world.getDay()) {
  return (core?.events ?? []).filter((e) => day <= e.exp && (e.type === "urgent" || !e.by));
}

// 引き受けた運んでよのうち、この村(届け先)へ届けるもの。[{ hostId, ev }]
export function carriesFor(destId, player, day = world.getDay()) {
  const out = [];
  for (const c of villages()) for (const ev of c.events ?? []) if (ev.type === "carry" && ev.by === player.id && ev.toId === destId && day <= ev.exp) out.push({ hostId: c.id, ev });
  return out;
}
export function myCarries(player, day = world.getDay()) {
  const out = [];
  for (const c of villages()) for (const ev of c.events ?? []) if (ev.type === "carry" && ev.by === player.id && day <= ev.exp) out.push({ hostId: c.id, ev });
  return out;
}

// 引き受ける: 出荷元の蔵から数量を引いて、手持ちに渡す(give は呼び出し側)。戻り値: { ok, qty, itemId } | { ok:false, reason }
export function acceptCarry(coreId, evId, player, day = world.getDay()) {
  const core = loadCore(coreId);
  const ev = core?.events?.find((e) => e.id === evId);
  if (!ev || ev.type !== "carry" || ev.by || day > ev.exp) return { ok: false, reason: "gone" };
  if (!loadCore(ev.toId)) return { ok: false, reason: "dest_gone" };
  if ((core.stock?.[ev.itemId] ?? 0) < ev.qty) return { ok: false, reason: "no_stock" };
  core.stock[ev.itemId] -= ev.qty;
  ev.by = player.id; ev.byName = player.name;
  saveCore(core);
  return { ok: true, qty: ev.qty, itemId: ev.itemId };
}

// 受け取った品を、届け先の蔵に入れて報酬を払う(品物は呼び出し側が引いたあと)。n 個・係数 factor。
function settle(dest, itemId, n, factor, unit, player) {
  const acct = getEntityAccount(dest.id);
  const reward = Math.max(0, Math.floor(unit * n * factor));
  const free = Math.max(0, Math.floor((acct?.cash ?? 0) - reservedCash(dest)));
  const pay = acct ? Math.min(reward, free) : 0;
  if (acct && pay > 0) { acct.cash -= pay; saveEntityAccount(acct); }
  dest.stock = dest.stock ?? {};
  dest.stock[itemId] = (dest.stock[itemId] ?? 0) + n;
  if (pay > 0) creditEmeralds(player, pay, FLOW.VILLAGE_BUY, { from: dest.name });
  return { paid: pay, short: reward - pay, reward };
}

// 運んでよの完了。ops = { count(itemId), take(itemId, n) -> {n, factor} }。戻り値: { ok, paid, short } | { ok:false, reason }
export function deliverCarry(destId, hostId, evId, player, ops, day = world.getDay()) {
  const dest = loadCore(destId), host = loadCore(hostId);
  const ev = host?.events?.find((e) => e.id === evId);
  if (!dest || dest.dissolving) return { ok: false, reason: "dest_gone" };
  if (!ev || ev.type !== "carry" || ev.by !== player.id || ev.toId !== destId || day > ev.exp) return { ok: false, reason: "gone" };
  if (storeTotal(dest) + ev.qty > storeCap(dest)) return { ok: false, reason: "full" };
  if (ops.count(ev.itemId) < ev.qty) return { ok: false, reason: "not_enough", have: ops.count(ev.itemId), need: ev.qty };
  const got = ops.take(ev.itemId, ev.qty);
  const r = settle(dest, ev.itemId, got.n, got.factor, ev.unit, player);
  saveCore(dest);
  const h = loadCore(hostId);
  h.events = (h.events ?? []).filter((e) => e.id !== evId);
  saveCore(h);
  return { ok: true, qty: got.n, itemId: ev.itemId, ...r };
}

// 緊急調達に納める(qty は ev.qty まで)。
export function deliverUrgent(coreId, evId, qty, player, ops, day = world.getDay()) {
  const core = loadCore(coreId);
  const ev = core?.events?.find((e) => e.id === evId);
  if (!core || !ev || ev.type !== "urgent" || day > ev.exp) return { ok: false, reason: "gone" };
  const q = Math.min(Math.floor(qty), ev.qty);
  if (!(q >= 1)) return { ok: false, reason: "bad_qty" };
  if (storeTotal(core) + q > storeCap(core)) return { ok: false, reason: "full" };
  if (ops.count(ev.itemId) < q) return { ok: false, reason: "not_enough" };
  const got = ops.take(ev.itemId, q);
  const r = settle(core, ev.itemId, got.n, got.factor, ev.unit, player);
  ev.qty -= got.n;
  if (ev.qty <= 0) core.events = core.events.filter((e) => e.id !== evId);
  saveCore(core);
  return { ok: true, qty: got.n, itemId: ev.itemId, ...r };
}

export function startVillageEvents() {
  system.runInterval(() => {
    try {
      const day = world.getDay();
      if (world.getDynamicProperty(DAY_KEY) === day) return;
      world.setDynamicProperty(DAY_KEY, day);
      updateVillageEvents(day);
    } catch (e) { console.warn("[BeeMyHoney] village events: " + e); }
  }, 1200);
}
