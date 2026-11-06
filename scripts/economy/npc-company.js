import { world, system } from "@minecraft/server";
import { NPC_COMPANIES } from "../data/npc-company-data.js";
import { STOCKS } from "../data/market-data.js";
import { getPolicyParam } from "./policy.js";
import { scaleE, getPriceLevel } from "./price-level.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { MAIL_ORDER_MARKUP } from "../data/village-pricing-data.js";
import { createEntityAccount, getEntityAccount } from "./account.js";
import { saveCore, loadCore } from "./core-registry.js";
import { grantStartupFunds } from "./dev-bank.js";
import { reservedCash } from "./village-demand.js";
import { buyForEntity, shipToExchange, dailyUpkeep, isTradable, referencePrice, listOffers, getPool } from "./exchange.js";

// ==========================================
// NPC会社 / NPC Companies  (dev/sketch/sketch-npc-companies.md)
// ------------------------------------------
// 株式市場の各社のうち製品を持つ4社(data/npc-company-data.js)を、プレイヤーの会社の小規模版として動かす。
//   ・仮想のコア(core:<ID>。位置なし)と、口座(種別 npc)を持つ。開業の最初の日に、開発銀行が最低限の資金を支給する。以降の不足は、週次の運用(entity-ops.js)の申請。
//   ・毎日: ①今日の加工に要る原料を、取引所の出品(プレイヤー・村・会社)から、基準価格以内で買う。
//          ②足りない分は、会社クエスト(掲示板の「会社」)で依頼にする(core.npcWant)。納品されたら在庫に入り、次の日から使える。
//          ③在庫の原料で加工する(1日に npc_runs_per_day 回まで・レシピごと)。
//          ④製品を取引所へ自動で出品する。単価 = HRMHRMの売値 × npc_price_ratio(原価を割る品は出さない)。売れ残りは期限で戻り、翌日出し直す。
//   ・原料の買いが各原料のシンクになる。プレイヤーの会社・村が育ったら、冬眠(npc_company_enabled = 0)させて、株式だけを残す想定。
// 仮想コアの保存: core.npc = true, kind: "company", stock(原料と、まだ出していない製品), orders(クエストの受注), npcWant({ 原料: 依頼の数 })
// ==========================================
const DAY_KEY = "bmh_npc_day";
const INPUT_BUY_CAP = 1.0;     // 原料を買う上限 = 基準価格 × 掛率 × この倍率
const LIST_CAP_DAYS = 4;       // 出品の在庫は、1日の製造量のこの日数分まで(売れ残りを溜め込まない)
const WANT_DAYS = 2;           // クエストで依頼する量 = 何日分の不足か

const ownerName = (def) => STOCKS[def.stock]?.name ?? { ja: def.id, en: def.id };
const plainName = (def) => {
  const n = ownerName(def);
  return { ja: n.ja.replace(/\s*\(.*\)$/, ""), en: n.en.replace(/\s*\(.*\)$/, "") };
};

export function npcDefs() { return NPC_COMPANIES; }
export function npcEnabled() { return getPolicyParam("npc_company_enabled") >= 1; }

// 口座と仮想コアを作る(なければ)。作った最初の日に、開発銀行から開業の資金が出る。
export function ensureNpc(def) {
  let created = false;
  if (!getEntityAccount(def.id)) {
    createEntityAccount({ id: def.id, type: "npc", name: plainName(def).en });
    grantStartupFunds(def.id, scaleE(getPolicyParam("npc_startup_base")));
    created = true;
  }
  let core = loadCore(def.id);
  if (!core) {
    const nm = plainName(def);
    core = { id: def.id, kind: "company", npc: true, name: nm.ja, nameEn: nm.en, dimId: "minecraft:overworld", x: 0, y: 0, z: 0, createdAt: world.getDay(), stock: {}, orders: [], npcWant: {} };
    saveCore(core);
    created = true;
  }
  return created;
}

// 出品の単価(1個)。HRMHRMの売値 × npc_price_ratio。
export function npcListPrice(itemId) {
  return Math.max(1, Math.round(referencePrice(itemId) * getPolicyParam("npc_price_ratio")));
}
const inputCap = (itemId) => Math.max(1, Math.floor(getItemBasePriceExact(itemId) * getPriceLevel() * INPUT_BUY_CAP));

// 1回の加工の原価の目安(原料の買い上限で見積もる)と、製品1個あたりの原価
export function recipeUnitCost(r) {
  let c = 0;
  for (const [id, n] of Object.entries(r.inputs)) c += getItemBasePriceExact(id) * getPriceLevel() * INPUT_BUY_CAP * n;
  return c / r.outQty;
}

function pendingOrdered(core, itemId) {
  const week = Math.floor(world.getDay() / 7);
  return (core.orders ?? []).filter((o) => !o.done && o.itemId === itemId && o.expiresWeek > week).reduce((s, o) => s + o.qty, 0);
}

function listedQty(def, itemId) {
  return listOffers(itemId).filter((o) => o.kind === "player" && o.sellerId === def.id).reduce((s, o) => s + o.qty, 0);
}

// 1社の1日。戻り値: { bought, produced, listed, want, skipped }
export function runNpcDay(def) {
  ensureNpc(def);
  const out = { bought: {}, produced: {}, listed: {}, want: {}, skipped: [] };
  let core = loadCore(def.id);
  if (!core) return out;
  core.stock ??= {};
  const baseRuns = Math.max(1, Math.floor(getPolicyParam("npc_runs_per_day")));
  // レシピごとの1日の回数: runs の指定があれば、政策(npc_runs_per_day)の基準16に対する比で増減。なければ政策の値そのまま。
  const runsOf = (r) => (r.runs ? Math.max(1, Math.round((r.runs * baseRuns) / 16)) : baseRuns);
  const selfMade = new Set(def.recipes.map((r) => r.out)); // 自社で作る品(中間のポーションなど)は、取引所から買わない

  // 出品の在庫が溜まっている製品は、今日は作らない
  const active = [];
  for (const r of def.recipes) {
    const held = (core.stock[r.out] ?? 0) + listedQty(def, r.out) + (loadPool(def.id, r.out));
    if (held >= runsOf(r) * r.outQty * LIST_CAP_DAYS) { out.skipped.push(r.out); continue; }
    active.push(r);
  }

  // ① 今日の原料の必要数 → 取引所で買う
  const need = {};
  for (const r of active) for (const [id, n] of Object.entries(r.inputs)) need[id] = (need[id] ?? 0) + n * runsOf(r);
  for (const [id, total] of Object.entries(need)) {
    if (selfMade.has(id)) continue;
    const short = total - (core.stock[id] ?? 0);
    if (short <= 0) continue;
    const free = Math.max(0, Math.floor((getEntityAccount(def.id)?.cash ?? 0) - reservedCash(core)));
    const r = buyForEntity({ entityId: def.id, itemId: id, qty: short, maxUnitPrice: inputCap(id), budget: free });
    if (r.qty > 0) { core.stock[id] = (core.stock[id] ?? 0) + r.qty; out.bought[id] = r.qty; }
  }

  // ② なお足りない分は、会社クエストの依頼にする(受注済みの未納品ぶんは引く)
  core.npcWant = {};
  for (const [id, total] of Object.entries(need)) {
    if (selfMade.has(id)) continue;
    const short = total * WANT_DAYS - (core.stock[id] ?? 0) - pendingOrdered(core, id);
    if (short > 0 && isTradable(id) && !id.includes("#") && !selfMade.has(id)) { core.npcWant[id] = Math.ceil(short); out.want[id] = core.npcWant[id]; }
  }

  // ③ 加工
  for (const r of active) {
    let n = runsOf(r);
    for (const [id, q] of Object.entries(r.inputs)) n = Math.min(n, Math.floor((core.stock[id] ?? 0) / q));
    if (n < 1) continue;
    // 原価を割る値段しかつかない品は作らない
    if (npcListPrice(r.out) < Math.ceil(recipeUnitCost(r) * 0.5)) { out.skipped.push(r.out); continue; }
    for (const [id, q] of Object.entries(r.inputs)) core.stock[id] -= q * n;
    core.stock[r.out] = (core.stock[r.out] ?? 0) + n * r.outQty;
    out.produced[r.out] = n * r.outQty;
  }
  saveCore(core);

  // ④ 製品を出品する
  const items = {};
  for (const r of def.recipes) if ((core.stock[r.out] ?? 0) > 0) items[r.out] = core.stock[r.out];
  if (Object.keys(items).length > 0) {
    const ratio = getPolicyParam("npc_price_ratio") * MAIL_ORDER_MARKUP;
    const res = shipToExchange({ entityId: def.id, kind: "npc", names: plainName(def), items, ratio });
    for (const id of Object.keys(res.listed)) core.stock[id] = Math.max(0, (core.stock[id] ?? 0) - (items[id] ?? 0));
    out.listed = res.listed;
    saveCore(core);
  }
  return out;
}

// 取引所プール(売れ残りが戻る先)にある数
function loadPool(id, itemId) { return getPool(id)[itemId] ?? 0; }

// 全社の日次(1日に1回)。dailyUpkeep(期限切れの出品の回収・HRMHRMの補充)を先に済ませる。
export function npcDaily(day = world.getDay()) {
  if (world.getDynamicProperty(DAY_KEY) === day) return false;
  world.setDynamicProperty(DAY_KEY, day);
  dailyUpkeep(day);
  if (!npcEnabled()) return true;
  for (const def of NPC_COMPANIES) {
    try { runNpcDay(def); } catch (e) { console.warn("[BeeMyHoney] npc " + def.id + ": " + e); }
  }
  return true;
}

export function startNpcCompanies() {
  system.runInterval(() => {
    try { npcDaily(); } catch (e) { console.warn("[BeeMyHoney] npc daily: " + e); }
  }, 1200 + 40);
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:npc") return;
    const target = ev.sourceEntity;
    const say = (m) => (target && typeof target.sendMessage === "function" ? target.sendMessage(m) : console.warn("[BeeMyHoney] " + m));
    const arg = String(ev.message ?? "").trim();
    if (arg === "run") { world.setDynamicProperty(DAY_KEY, undefined); npcDaily(); say("[NPC] ran daily"); return; }
    say(npcReport());
  });
}

export function npcReport() {
  const lines = [`[NPC会社] 稼働=${npcEnabled() ? "ON" : "冬眠"}`];
  for (const def of NPC_COMPANIES) {
    const a = getEntityAccount(def.id); const c = loadCore(def.id);
    if (!a) { lines.push(`${def.id}: (未開業)`); continue; }
    const st = Object.entries(c?.stock ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${k.replace("minecraft:", "")}×${n}`).join(" ");
    lines.push(`${def.id} ${plainName(def).ja}: 現金 ${Math.round(a.cash)}E / 在庫 ${st || "なし"} / 依頼 ${Object.keys(c?.npcWant ?? {}).length}品`);
  }
  return lines.join("\n");
}
