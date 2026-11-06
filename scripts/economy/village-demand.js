import { getItemBasePriceExact } from "./village-pricing.js";
import { coreNamePair } from "../i18n/names.js";
import { shipToExchange, entityShippingEnabled, buyForEntity } from "./exchange.js";
import { getPriceLevel } from "./price-level.js";
import { getPolicyParam } from "./policy.js";
import { listCores, loadCore, saveCore } from "./core-registry.js";
import { NPC_COMPANIES } from "../data/npc-company-data.js";
import { jobInputNeeds, jobInputKeep, runVillageProduction, productPrice } from "./village-jobs.js";
import { getEntityAccount, saveEntityAccount } from "./account.js";
import { currentGlobalDay } from "./labor.js";
import { regionDef, regionImports } from "../data/village-regions.js";
import { VILLAGE_SHIP_ITEMS } from "../data/convert-data.js";
export { VILLAGE_SHIP_ITEMS };

// ==========================================
// 村の入荷(人ごと・日ごとの必要数 = 枠)と週次の加工・出荷 / Village Demand  (dev/village-company-flow-spec.md 第3章)
// ------------------------------------------
// ・入荷: 毎日、村ごとに数品目を抽選し、人口に比例した必要数(枠)を決める。受注済みが必要数に達したら「倉庫がいっぱい」で止まる。
//   価格は動かさない(需要圧力は使わない)。1個の単価 = 基準価格 × 掛率 × village_buy_ratio。
// ・支払い: 村の口座から。受注した時点で、(口座の現金 − 他の受注の予約額)の範囲までしか受けない。
// ・在庫: 納品された物資は村の在庫(core.stock)へ。週の締めで、変換表のとおり加工し、出荷品を相場以下(village_ship_ratio)で
//   市場へ売って口座に戻す。変換表に無い品(作物・廃棄物など)は村の中で消費される。
// 村の受注の保存: core.orders = [{ key, who(名前), whoId(プレイヤーID), itemId, qty, reward, day, expiresWeek, done }]
// 受注の照合はIDを優先する(ゲーマータグを変えても、受けた注文に辿り着ける)。古い注文(whoIdなし)は名前で照合する。
// ==========================================

// 入荷の品目。weight = 人口1人あたりの必要数にかける係数(village_need_per_pop が元)
export const VILLAGE_BUY_TABLE = [
  // 食料
  { itemId: "minecraft:wheat", weight: 1 }, { itemId: "minecraft:potato", weight: 1 }, { itemId: "minecraft:carrot", weight: 1 },
  { itemId: "minecraft:beetroot", weight: 0.8 }, { itemId: "minecraft:pumpkin", weight: 0.5 }, { itemId: "minecraft:melon_slice", weight: 1 },
  { itemId: "minecraft:sweet_berries", weight: 0.8 },
  { itemId: "minecraft:porkchop", weight: 0.6 }, { itemId: "minecraft:chicken", weight: 0.6 }, { itemId: "minecraft:rabbit", weight: 0.4 },
  { itemId: "minecraft:cod", weight: 0.6 }, { itemId: "minecraft:salmon", weight: 0.5 },
  // 木
  { itemId: "minecraft:oak_sapling", weight: 0.5 }, { itemId: "minecraft:spruce_sapling", weight: 0.5 }, { itemId: "minecraft:birch_sapling", weight: 0.5 },
  { itemId: "minecraft:stick", weight: 1.5 }, { itemId: "minecraft:feather", weight: 0.6 }, { itemId: "minecraft:white_wool", weight: 0.5 },
  // 鉱石・燃料・農業・廃棄
  { itemId: "minecraft:raw_iron", weight: 0.4 }, { itemId: "minecraft:raw_copper", weight: 0.4 },
  { itemId: "minecraft:charcoal", weight: 0.6 }, { itemId: "minecraft:bone_meal", weight: 0.5 }, { itemId: "minecraft:rotten_flesh", weight: 1 }
];


// 会社の入荷: 会社の工場・在庫で足りない分を自動で依頼にする。target = 1日あたりの在庫の目標数(company_need_scale を掛ける)。
// 金の原石は工場で金インゴットに加工される。ダイヤ・糸は会社の在庫に入り、保持数を超えた分は週の締めで換金される。
export const COMPANY_BUY_TABLE = [
  { itemId: "minecraft:raw_gold", target: 32 },
  { itemId: "minecraft:diamond", target: 8 },
  { itemId: "minecraft:string", target: 128 }
];

export const NEED_MAX = 2000;
const listNpcCores = () => NPC_COMPANIES.map((d) => loadCore(d.id)).filter((c) => c && c.npc && !c.dissolving);
export const ORDERS_KEEP = 300; // 村・会社の記録(動的プロパティ ~32KB)に入る注文の上限。超えたら新しい受注を断る(古い注文は日・週で自然に消える)
const BOARD_VILLAGES_MAX = 6; // 掲示に出す村の数(プレイヤーに近い順)

const weekNow = () => Math.floor(currentGlobalDay() / 7);

function seedOf(coreId, day) {
  let h = 2166136261;
  for (let i = 0; i < coreId.length; i++) h = Math.imul(h ^ coreId.charCodeAt(i), 16777619);
  return (h ^ Math.imul(day, 2654435761)) >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1個あたりの名目単価(小数のまま。報酬は数量を掛けてから切り捨てる)
export function unitPrice(itemId, kind = "village") {
  return getItemBasePriceExact(itemId) * getPriceLevel() * getPolicyParam(kind === "company" ? "company_buy_ratio" : "village_buy_ratio");
}

// 村の注文の整理: 期限切れ(受注中のもの)と、前の日までに納品済みのものを落とす
export function pruneOrders(core, day = currentGlobalDay()) {
  const week = Math.floor(day / 7);
  const before = (core.orders ?? []).length;
  core.orders = (core.orders ?? []).filter((o) => (o.done ? o.day >= day : o.expiresWeek > week));
  return core.orders.length !== before;
}

const isMine = (o, who, whoId) => (o.whoId && whoId ? o.whoId === whoId : o.who === who);

// 予約額(受注中で未納品の報酬の合計)。期限切れの注文は、まだ片付いていなくても数えない
export function reservedCash(core, day = currentGlobalDay()) {
  const week = Math.floor(day / 7);
  return (core.orders ?? []).filter((o) => !o.done && o.expiresWeek > week).reduce((s, o) => s + o.reward, 0);
}

// その日の枠。人口0の村・解散中の村は空。
// 戻り値: [{ itemId, need, taken, left, unit }]。同じ日・同じ村なら、誰が見ても同じ(種 = 村ID × 日)。
// 村の枠は人ごと(who = プレイヤー名)。種 = 村ID × 日付 × 人 なので、毎日・人ごとに品目も量も違う。1人で埋められる量にして、
// 「誰かが全部やりきって他の人は何もできない」を避ける(早い者勝ちにしない)。会社の枠は在庫の不足分なので共有。
export function getVillageSlots(core, day = currentGlobalDay(), who = null, whoId = null) {
  if (core?.kind === "company") return getCompanySlots(core, day);
  if (!core || core.kind !== "village" || core.dissolving || !who) return [];
  const pop = core.pop ?? 0;
  if (!(pop > 0)) return [];
  const r = rng(seedOf(core.id + "|" + who, day));
  const pool = [...VILLAGE_BUY_TABLE];
  const n = Math.min(pool.length, Math.max(1, Math.round(getPolicyParam("village_items_per_day"))));
  const perPop = getPolicyParam("village_need_per_pop");
  const out = [];
  // 職業ブロックのある村は、職業の原料が先に枠に載る(量は、ブロックの数 × 1日の加工回数で決まる。人口ではない)。残りの枠は従来の固定表から。
  const jobNeeds = Object.entries(jobInputNeeds(core));
  const jobPicks = [];
  while (jobPicks.length < Math.min(n, 2) && jobNeeds.length > 0) jobPicks.push(jobNeeds.splice(Math.floor(r() * jobNeeds.length), 1)[0]);
  for (const [itemId, v] of jobPicks) {
    const need = Math.min(NEED_MAX, Math.max(1, Math.round(v.perDay * (0.7 + 0.6 * r()))));
    const taken = (core.orders ?? []).filter((o) => o.day === day && o.itemId === itemId && isMine(o, who, whoId)).reduce((s, o) => s + o.qty, 0);
    out.push({ itemId, need, taken, left: Math.max(0, need - taken), unit: unitPrice(itemId) });
    const k = pool.findIndex((e) => e.itemId === itemId);
    if (k >= 0) pool.splice(k, 1);
  }
  // 地域タイプで、品目の抽選の重みが変わる(重みがすべて1なら、従来と同じ並びになる)
  const dem = regionDef(core).demand ?? {};
  const pickIndex = () => {
    const total = pool.reduce((s, e) => s + (dem[e.itemId] ?? 1), 0);
    let t = r() * total;
    for (let k = 0; k < pool.length; k++) { t -= dem[pool[k].itemId] ?? 1; if (t < 0) return k; }
    return pool.length - 1;
  };
  for (let i = jobPicks.length; i < n && pool.length > 0; i++) {
    const e = pool.splice(pickIndex(), 1)[0];
    const need = Math.min(NEED_MAX, Math.max(1, Math.round(pop * perPop * e.weight * (0.7 + 0.6 * r()))));
    const taken = (core.orders ?? []).filter((o) => o.day === day && o.itemId === e.itemId && isMine(o, who, whoId)).reduce((s, o) => s + o.qty, 0);
    out.push({ itemId: e.itemId, need, taken, left: Math.max(0, need - taken), unit: unitPrice(e.itemId) });
  }
  return out;
}

// 会社の枠: 目標数 − (その日の初めの在庫)。今日の納品で在庫が増えた分は戻して数える(受注済みと二重に数えないため)。
function getCompanySlots(core, day) {
  if (core.dissolving) return [];
  if (core.npc) return getNpcSlots(core, day);
  const scale = getPolicyParam("company_need_scale");
  const out = [];
  for (const e of COMPANY_BUY_TABLE) {
    const deliveredToday = (core.orders ?? []).filter((o) => o.day === day && o.itemId === e.itemId && o.done).reduce((s, o) => s + o.qty, 0);
    const startStock = (core.stock?.[e.itemId] ?? 0) - deliveredToday;
    const need = Math.min(NEED_MAX, Math.max(0, Math.round(e.target * scale) - Math.max(0, startStock)));
    if (need <= 0) continue;
    const taken = (core.orders ?? []).filter((o) => o.day === day && o.itemId === e.itemId).reduce((s, o) => s + o.qty, 0);
    out.push({ itemId: e.itemId, need, taken, left: Math.max(0, need - taken), unit: unitPrice(e.itemId, "company") });
  }
  return out;
}

// NPC会社の枠: 毎日の運用(economy/npc-company.js)が決めた依頼 core.npcWant({ 原料: 数 })。今日すでに受注した分を引く。
function getNpcSlots(core, day) {
  const out = [];
  for (const [itemId, need] of Object.entries(core.npcWant ?? {})) {
    if (!(need > 0)) continue;
    const taken = (core.orders ?? []).filter((o) => o.day === day && o.itemId === itemId).reduce((s, o) => s + o.qty, 0);
    const total = Math.min(NEED_MAX, need);
    out.push({ itemId, need: total, taken, left: Math.max(0, total - taken), unit: unitPrice(itemId, "company") });
  }
  return out;
}

export function slotQuestId(coreId, day, itemId) {
  return `v_${day}_${coreId}_${itemId.replace("minecraft:", "")}`;
}

// 村(会社)の資金: 口座の現金、受注で予約済みの額、いま新しく約束できる額(= 現金 − 予約)
export function getCoreFunds(core) {
  const cash = Math.max(0, getEntityAccount(core.id)?.cash ?? 0);
  const reserved = reservedCash(core);
  return { cash, reserved, free: Math.max(0, cash - reserved) };
}

// 注文を受ける数量の上限(枠の残り と 資金)。資金 = 口座の現金 − 予約額。
export function maxOrderQty(core, slot) {
  const funds = Math.floor(getCoreFunds(core).free);
  const byFunds = slot.unit > 0 ? Math.floor(funds / slot.unit) : slot.left;
  return Math.max(0, Math.min(slot.left, byFunds));
}

// プレイヤーに近い順に、枠のある村の掲示を返す(同じディメンションのみ)。
export function getVillageBoard(player, day = currentGlobalDay(), kind = "village") {
  const loc = player.location;
  const list = listCores(kind)
    .filter((c) => !c.dissolving && c.dimId === player.dimension.id)
    .map((c) => ({ core: c, dist: Math.hypot(c.x - loc.x, c.z - loc.z) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, BOARD_VILLAGES_MAX);
  if (kind === "company") {
    // NPC会社(位置なし)は、距離に関係なく掲示に載る
    for (const c of listNpcCores()) list.unshift({ core: c, dist: 0 });
  }
  const out = [];
  for (const { core, dist } of list) {
    const slots = getVillageSlots(core, day, player.name, player.id);
    if (slots.length > 0) out.push({ core, dist: Math.round(dist), slots, day });
  }
  return out;
}

// 受注。reason: noVillage / noSlot / full / noFunds / badQty
export function claimVillageOrder(player, coreId, itemId, qty, day = currentGlobalDay()) {
  const core = loadCore(coreId);
  if (!core || (core.kind !== "village" && core.kind !== "company") || core.dissolving) return { ok: false, reason: "noVillage" };
  if (pruneOrders(core, day)) saveCore(core);
  if ((core.orders ?? []).length >= ORDERS_KEEP) return { ok: false, reason: "full" };
  const slot = getVillageSlots(core, day, player.name, player.id).find((s) => s.itemId === itemId);
  if (!slot) return { ok: false, reason: "noSlot" };
  if (slot.left <= 0) return { ok: false, reason: "full" };
  const cap = maxOrderQty(core, slot);
  if (cap <= 0) return { ok: false, reason: "noFunds" };
  const q = Math.floor(qty);
  if (!(q >= 1) || q > cap) return { ok: false, reason: "badQty", max: cap };
  const reward = Math.max(1, Math.floor(slot.unit * q));
  const key = slotQuestId(coreId, day, itemId);
  const expiresWeek = Math.floor(day / 7) + 1;
  core.orders ??= [];
  core.orders.push({ key, who: player.name, whoId: player.id, itemId, qty: q, reward, day, expiresWeek, done: false });
  if (!saveCore(core)) return { ok: false, reason: "noVillage" };
  return { ok: true, key, itemId, qty: q, reward, expiresWeek, day, villageName: core.name, villageNames: coreNamePair(core), coreId, kind: core.kind };
}

// 受注の取り消し(放棄)。枠と予約が戻る。
export function cancelVillageOrder(coreId, key, who, whoId = null) {
  const core = loadCore(coreId);
  if (!core) return false;
  const i = (core.orders ?? []).findIndex((o) => o.key === key && isMine(o, who, whoId) && !o.done);
  if (i === -1) return false;
  core.orders.splice(i, 1);
  return saveCore(core);
}

// 納品の前の確認(品物を消費する前に呼ぶ): 村(会社)が残っていて、その注文が生きているか。
export function canCompleteVillageOrder(coreId, key, who, whoId = null) {
  const core = loadCore(coreId);
  if (!core || core.dissolving) return { ok: false, reason: "villageGone" };
  if (!(core.orders ?? []).some((x) => x.key === key && isMine(x, who, whoId) && !x.done)) return { ok: false, reason: "orderGone" };
  return { ok: true };
}

// 納品の確定(品物は呼び出し側が消費済み)。村の口座から払い、在庫に入れる。
// 戻り値: { ok, paid, short } / reason: noVillage / noOrder。口座の現金が予約額に満たない時(週の運用で減った場合)は払える分だけ。
export function completeVillageOrder(coreId, key, who, whoId = null) {
  const core = loadCore(coreId);
  if (!core) return { ok: false, reason: "noVillage" };
  const o = (core.orders ?? []).find((x) => x.key === key && isMine(x, who, whoId) && !x.done);
  if (!o) return { ok: false, reason: "noOrder" };
  const acct = getEntityAccount(coreId);
  const pay = acct ? Math.max(0, Math.min(o.reward, Math.floor(acct.cash))) : 0;
  if (acct && pay > 0) { acct.cash -= pay; saveEntityAccount(acct); }
  o.done = true;
  core.stock ??= {};
  core.stock[o.itemId] = (core.stock[o.itemId] ?? 0) + o.qty;
  saveCore(core);
  return { ok: true, paid: pay, short: o.reward - pay, qty: o.qty, itemId: o.itemId, villageName: core.name, villageNames: coreNamePair(core) };
}

// 週の締め: 村は加工しない。在庫のうち、消費されない原料(VILLAGE_SHIP_ITEMS)だけを相場以下で市場へ出荷して現金にする。
// それ以外(食料・骨粉・腐った肉)は村の中で消費されて消える。戻り値 { cash, shipped: {itemId: n}, consumed: {itemId: n} }
export function settleVillageStock(accountId) {
  const core = loadCore(accountId);
  if (!core || core.kind !== "village") return null;
  const stock = core.stock ?? {};
  const level = getPriceLevel();
  const shipRatio = getPolicyParam("village_ship_ratio");
  const shipped = {};
  const consumed = {};
  let cash = 0;
  // 職業ブロックのある村: 原料の不足を取引所で買い(プレイヤーの納品のあと)、手工業で加工する。作った物は取引所へ出品する。
  core.stock = stock;
  const acct0 = getEntityAccount(accountId);
  const budget = Math.max(0, Math.floor((acct0?.cash ?? 0) - reservedCash(core))) * getPolicyParam("village_buy_budget_ratio");
  const prod = runVillageProduction(core, budget);
  const madeItems = { ...prod.produced };
  for (const id of Object.keys(madeItems)) stock[id] = Math.max(0, (stock[id] ?? 0) - madeItems[id]);
  // 地域の特産品: 人口に応じて生まれ、そのまま取引所へ出品される(蔵には入れない)
  const specPer = getPolicyParam("village_specialty_per_pop");
  if (specPer > 0 && (core.pop ?? 0) > 0) {
    for (const sp of regionDef(core).specialty ?? []) {
      const q = Math.floor((core.pop ?? 0) * specPer * sp.perPop);
      if (q >= 1) { madeItems[sp.itemId] = (madeItems[sp.itemId] ?? 0) + q; prod.produced[sp.itemId] = (prod.produced[sp.itemId] ?? 0) + q; }
    }
  }
  const keepInputs = jobInputKeep(core);
  for (const [itemId, n] of Object.entries(stock)) {
    if (!(n > 0)) continue;
    const keepN = Math.min(n, keepInputs[itemId] ?? 0);
    const rest = n - keepN;
    if (!(rest > 0)) continue;
    if (VILLAGE_SHIP_ITEMS.has(itemId)) shipped[itemId] = rest;
    else consumed[itemId] = rest;
  }
  let madeListed = {};
  let madeUnlisted = {};
  if (Object.keys(madeItems).length > 0) {
    if (entityShippingEnabled()) {
      const r = shipToExchange({ entityId: accountId, kind: "village", names: coreNamePair(core), items: madeItems, ratio: getPolicyParam("village_product_ratio") });
      madeListed = r.listed; madeUnlisted = r.unlisted;
    } else madeUnlisted = madeItems;
    for (const [itemId, n] of Object.entries(madeUnlisted)) cash += productPrice(itemId) * 0.8 * n; // 出品できない品は、従来の出荷と同じく掛け目を引いて自動売却
  }
  // 出荷: 取引所へ出品する(売れた代金は、その時に村の口座へ入る)。出品できない品(取引リストに無い)と、切り替えが0の時は、従来どおり相場以下で自動売却する。
  let listed = {};
  let toMarket = shipped;
  if (entityShippingEnabled()) {
    const r = shipToExchange({ entityId: accountId, kind: "village", names: coreNamePair(core), items: shipped, ratio: shipRatio });
    listed = r.listed;
    toMarket = r.unlisted;
  }
  for (const [itemId, n] of Object.entries(toMarket)) cash += getItemBasePriceExact(itemId) * level * shipRatio * n;
  // 在庫: 持ち越す原料だけ残す(ほかは出荷・消費・出品済み)
  const carried = {};
  for (const [itemId, k] of Object.entries(keepInputs)) { const n = Math.min(stock[itemId] ?? 0, k); if (n > 0) carried[itemId] = n; }
  core.stock = carried;
  pruneOrders(core); // 古い注文を片付ける
  for (const [id, n] of Object.entries(madeListed)) listed[id] = (listed[id] ?? 0) + n;
  // 村同士の取引: 地域の需要の品を、取引所(他の村・プレイヤーの出品)から買う。買った分は消費される。予算は、職業の原料を買った残りの空き現金から。
  const imported = {}; let importSpent = 0;
  const tradeBudget = Math.max(0, Math.floor((acct0?.cash ?? 0) - reservedCash(core) - prod.spent)) * getPolicyParam("village_trade_budget_ratio");
  if (tradeBudget > 0 && entityShippingEnabled() && (core.pop ?? 0) > 0) {
    let left = tradeBudget;
    for (const im of regionImports(core)) {
      if (left <= 0) break;
      const want = Math.floor((core.pop ?? 0) * im.perPop);
      if (want < 1) continue;
      const cap = Math.max(1, getItemBasePriceExact(im.itemId) * getPriceLevel() * 1.25);
      const r = buyForEntity({ entityId: accountId, itemId: im.itemId, qty: want, maxUnitPrice: cap, budget: left, deferDebit: true });
      if (r.qty > 0) { imported[im.itemId] = r.qty; importSpent += r.spent; left -= r.spent; }
    }
  }
  const result = { cash: Math.floor(cash), shipped, consumed, listed, produced: prod.produced, bought: prod.bought, imported, spent: Math.round(prod.spent + importSpent) };
  core.lastShip = { week: weekNow(), ...result }; // 管理メニューの在庫管理に出す「先週の出荷」
  saveCore(core);
  return result;
}
