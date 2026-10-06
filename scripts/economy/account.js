import { world } from "@minecraft/server";
import { getCommodityPrice } from "./market-engine.js";
import { COMMODITIES } from "../data/market-data.js";

// ==========================================
// 口座テンプレート / Entity Account Template  (dev/hrmhrm-accounting.md)
// ------------------------------------------
// プレイヤー個人の口座(bank.js の acc_*)とは別に、HRMHRM・村・法人が持つ「会社の口座」の型。
//   cash          … 現金(エメラルド、名目額)。資金不足の間はマイナスになりうる(借越。発行申請の対象)
//   receivables   … 貸出金などの債権(エメラルド)
//   liabilities   … 負債(エメラルド)
//   holdings      … 保有する現物資産 { 商品キー: 個数 }。時価評価の対象(貴金属を含む)
//   unsettledSince… 精算不能になった最初の週(解消されたら null)
//   population    … 村の人口(type: "village" のみ)
//   weekly        … 週次の締めの記録(直近 WEEKLY_KEEP 件)
// 1口座 = 1つの動的プロパティ(bmh_acct_<id>)。ID一覧は bmh_acct_ids。
//
// 介入のルール(2026-10-05決定。decideIntervention):
//   精算不能が INTERVENTION_GRACE_WEEKS(3)週を超えたら介入の対象。
//     村 … 人口が0なら登録解除(壊滅。残った資産は誰も回収せず消える) / 人口がいれば介入(HRMHRMが入る)
//     法人 … 内容に応じてHRMHRMが介入(買い取り救済 or 清算。判断の中身は法人テンプレートの実装時に決める)
//     HRMHRM … 介入の対象外
// ==========================================

export const ACCOUNT_TYPES = ["hrmhrm", "village", "company"];
export const PRECIOUS_METAL_KEYS = ["gold_ingot", "diamond"]; // 「貴金属」として扱う商品(COMMODITIESのキー)
export const INTERVENTION_GRACE_WEEKS = 3;
export const WEEKLY_KEEP = 26;
export const VALUATION_HAIRCUT = 0.1; // 裏打ちの計算では、時価の10%を掛け目として差し引く(担保評価)

const ACCT_PREFIX = "bmh_acct_";
const REGISTRY_KEY = "bmh_acct_ids";
const REQUESTS_KEY = "bmh_issuance_requests";
const INTERVENTIONS_KEY = "bmh_interventions";
const WRITEOFF_KEY = "bmh_writeoff_total";
const QUEUE_KEEP = 20;

function weekNow() {
  return Math.floor(world.getDay() / 7);
}

function readJson(key, fallback) {
  const raw = world.getDynamicProperty(key);
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[BeeMyHoney] account: ${key} unreadable: ${e}`);
    return fallback;
  }
}

function writeJson(key, value) {
  world.setDynamicProperty(key, JSON.stringify(value));
}

export function listAccountIds() {
  const ids = readJson(REGISTRY_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

export function getEntityAccount(id) {
  const acct = readJson(ACCT_PREFIX + id, null);
  return acct && acct.v === 1 ? acct : null;
}

export function saveEntityAccount(acct) {
  if (acct.weekly.length > WEEKLY_KEEP) acct.weekly.splice(0, acct.weekly.length - WEEKLY_KEEP);
  writeJson(ACCT_PREFIX + acct.id, acct);
}

export function createEntityAccount({ id, type, name = null, cash = 0, holdings = {}, population = null }) {
  if (!ACCOUNT_TYPES.includes(type)) throw new Error("account: unknown type " + type);
  if (getEntityAccount(id)) throw new Error("account: already exists " + id);
  const acct = {
    v: 1, id, type, name, createdWeek: weekNow(),
    cash, receivables: 0, liabilities: 0, holdings: { ...holdings },
    unsettledSince: null, population, processedWeek: weekNow() - 1, weekly: []
  };
  saveEntityAccount(acct);
  const ids = listAccountIds();
  if (!ids.includes(id)) writeJson(REGISTRY_KEY, [...ids, id]);
  return acct;
}

// 口座を消す(村の登録解除など)。消した時点の資産の時価(現金+債権+現物−負債 が正のぶん)を、消えたお金として記録する。
export function deleteEntityAccount(id) {
  const acct = getEntityAccount(id);
  if (!acct) return { ok: false, reason: "not_found", writtenOff: 0 };
  const sheet = getBalanceSheet(acct);
  const writtenOff = Math.max(0, Math.round(sheet.equity));
  world.setDynamicProperty(ACCT_PREFIX + id, undefined);
  writeJson(REGISTRY_KEY, listAccountIds().filter((x) => x !== id));
  world.setDynamicProperty(WRITEOFF_KEY, (world.getDynamicProperty(WRITEOFF_KEY) ?? 0) + writtenOff);
  return { ok: true, writtenOff };
}

export function getTotalWriteOff() {
  return world.getDynamicProperty(WRITEOFF_KEY) ?? 0;
}

// ---- 時価評価 ----
// 保有する現物資産を、いまの市場価格(小口取引の相場。getCommodityPrice)で評価する。
// 価格は 基準 × 掛率 × 相場パターン × 需要圧力 なので、インフレで貴金属の評価額も上がる。
export function valueHoldings(holdings) {
  const byKey = {};
  let total = 0;
  let precious = 0;
  for (const [key, units] of Object.entries(holdings)) {
    if (!COMMODITIES[key] || !(units > 0)) continue;
    const price = getCommodityPrice(key);
    const value = units * price;
    byKey[key] = { units, price, value };
    total += value;
    if (PRECIOUS_METAL_KEYS.includes(key)) precious += value;
  }
  return { total, precious, other: total - precious, byKey };
}

// 貸借対照表。coverage(貴金属の裏打ち)= 貴金属の時価 ×(1−掛け目) ÷ 負債(負債0なら null)。
export function getBalanceSheet(acct) {
  const v = valueHoldings(acct.holdings);
  const assets = acct.cash + acct.receivables + v.total;
  const equity = assets - acct.liabilities;
  return {
    cash: acct.cash,
    receivables: acct.receivables,
    holdingsValue: v.total,
    preciousValue: v.precious,
    otherHoldingsValue: v.other,
    preciousShare: assets > 0 ? v.precious / assets : 0,
    assets,
    liabilities: acct.liabilities,
    equity,
    coverage: acct.liabilities > 0 ? (v.precious * (1 - VALUATION_HAIRCUT)) / acct.liabilities : null,
    byKey: v.byKey
  };
}

// ---- 精算不能と介入 ----
// 支払い・精算の結果を記録する。失敗が続いている間は unsettledSince に最初の失敗の週を持つ。
export function recordSettlement(id, ok, week = weekNow()) {
  const acct = getEntityAccount(id);
  if (!acct) return null;
  if (ok) acct.unsettledSince = null;
  else if (acct.unsettledSince === null) acct.unsettledSince = week;
  saveEntityAccount(acct);
  return acct;
}

export function getUnsettledWeeks(acct, week = weekNow()) {
  return acct.unsettledSince === null ? 0 : week - acct.unsettledSince;
}

// action: "none" | "intervene" | "deregister"
export function decideIntervention(acct, week = weekNow()) {
  const weeks = getUnsettledWeeks(acct, week);
  if (acct.type === "hrmhrm" || weeks <= INTERVENTION_GRACE_WEEKS) return { action: "none", weeks };
  if (acct.type === "village") {
    return (acct.population ?? 0) <= 0 ? { action: "deregister", weeks, reason: "no_population" } : { action: "intervene", weeks, reason: "village_has_population" };
  }
  return { action: "intervene", weeks, reason: "company_unsettled" };
}

// ---- キュー(資金の申請・介入案件) ----
// 資金の申請は、開発銀行機構(dev-bank.js)が週ごとに審査する。介入案件は、介入の処理が実装されるまでの受け皿。
function trimQueue(queue, keepPending) {
  while (queue.length > QUEUE_KEEP) {
    const i = keepPending ? queue.findIndex((r) => r.status !== "pending" && r.status !== "open") : 0;
    queue.splice(i === -1 ? 0 : i, 1);
  }
}

function pushQueue(key, item, dedupe) {
  const queue = readJson(key, []);
  if (queue.some(dedupe)) return null;
  queue.push(item);
  trimQueue(queue, true);
  writeJson(key, queue);
  return item;
}

// 資金の申請(開発銀行機構への)。同じ申請者の未審査の申請があれば重ねない(null)。
export function applyForFunding(entityId, amount, reason) {
  const queue = readJson(REQUESTS_KEY, []);
  const nextId = queue.reduce((m, r) => Math.max(m, r.id ?? 0), 0) + 1;
  return pushQueue(REQUESTS_KEY, { id: nextId, entityId, amount: Math.round(amount), reason, week: weekNow(), status: "pending", decision: null }, (r) => r.entityId === entityId && r.status === "pending");
}
export function getFundingRequests() {
  return readJson(REQUESTS_KEY, []);
}
export function getPendingFundingRequests() {
  return getFundingRequests().filter((r) => r.status === "pending");
}
// status: "granted"(支給) / "rejected_liquidated"(却下して資産を売却) / "closed"(支給の必要なし)
export function resolveFundingRequest(id, status, decision) {
  const queue = readJson(REQUESTS_KEY, []);
  const req = queue.find((r) => r.id === id);
  if (!req) return false;
  req.status = status;
  req.decision = decision ?? null;
  writeJson(REQUESTS_KEY, queue);
  return true;
}

export function queueIntervention(entityId, type, reason, week = weekNow()) {
  return pushQueue(INTERVENTIONS_KEY, { entityId, type, reason, week, status: "open" }, (r) => r.entityId === entityId && r.status === "open") !== null;
}
export function getInterventions() {
  return readJson(INTERVENTIONS_KEY, []);
}
