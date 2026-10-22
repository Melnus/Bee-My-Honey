import { world } from "@minecraft/server";
import { pickVillageName, pickHeadName } from "../i18n/names.js";
import { FLOW, creditEmeralds, debitEmeralds } from "./ledger.js";
import { scaleEInt } from "./price-level.js";
import { getPolicyParam } from "./policy.js";
import { adjustCredit, getCreditScore } from "./credit.js";
import {
  createEntityAccount, getEntityAccount, saveEntityAccount, deleteEntityAccount,
  valueHoldings, getInterventions, resolveIntervention
} from "./account.js";
import { HRMHRM_ID, ensureHrmhrmAccount } from "./hrmhrm.js";
import { repayLoansOnWindUp } from "./loan-market.js";
import { addToPool } from "./facility.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { getPriceLevel } from "./price-level.js";

// ==========================================
// 法人テンプレート / Corporate Template  (dev/corporate-template-spec.md)
// ------------------------------------------
// 鐘 = 村、ロードストーン = 会社 の「アイデンティティ」(ID・名前・口座)を登記・解散する仕組みのデータ層。
// 画面(ui/core-menu.js)とワールドのイベント(core-guard.js)は、ここの関数だけを呼ぶ。ブロックそのものには触らない。
//
//   core.id = 口座ID(account.js の entity 口座)。登記で口座を作り、解散で口座と一緒に墓標へ変わる。
//   記録は1コア=1キー(core:<ID>)。解散すると同じキーに墓標を書く(「解散した」のか「事故で消えた」のかを区別できる)。
//   登記の順序: 検証 → 登録料の引き落とし(HRMHRMの収益) → 口座の作成 → 保存 → 触媒の消費。触媒だけ失う事故を避ける。
//   解散 = 清算。現物は銀行(HRMHRM)が時価の一部で買い取り、残りがプラスなら代表へ払う(市場へは流さない)。
//   途中で止まっても再開できるよう、解散の意図(core.liq)を先に保存し、段階ごとの完了印を付けていく。
// ==========================================

export const CORE_PREFIX = "core:";
export const IDS_KEY = "core_ids";
const PENDING_KEY = "core_pending";   // オフラインの代表へ渡す清算の払い・信用の減点(次にログインした時に適用)
const COOLDOWN_KEY = "core_cooldowns"; // { プレイヤーID: 再登記できるようになる日 }
const BAD_DEBT_KEY = "core_baddebt";   // 清算しても足りなかった額の累計(銀行の貸倒れ)

export const NAME_MAX = 10;
export const APPLICANT_MAX = 20;
export const RANGE_XZ = 64; // 村の人員検知の箱(コアから 水平±64 / 高さ±32)
export const RANGE_Y = 32;
const RESERVED_NAMES = ["hrmhrm", "hrmhrmpartners", "hrmhrmpartnershld", "bmh", "beemyhoney", "bank", "銀行", "政府", "ハニカム", "運営", "管理者", "admin", "system"];

export const CORE_TYPES = { "minecraft:bell": "village", "minecraft:lodestone": "company" };

const recKey = (id) => CORE_PREFIX + id;
const posKey = (dimId, x, y, z) => `${dimId}|${x},${y},${z}`;
const today = () => world.getDay();

function readJson(key, fallback) {
  const raw = world.getDynamicProperty(key);
  if (typeof raw !== "string") return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}
const writeJson = (key, v) => world.setDynamicProperty(key, JSON.stringify(v));

// ---------- 保存と索引 ----------
// 位置→ID の索引。読み込み直後(早期実行)はワールドのデータに触れないので、最初に使う時に、保存済みの記録(core:*)から作る。
let idx = {};
let idxLoaded = false;
let lostIds = [];

function ensureIdx() {
  if (idxLoaded) return;
  idxLoaded = true;
  idx = {};
  const seen = new Set();
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(CORE_PREFIX)) continue;
    const c = readJson(key, null);
    if (!c?.id) continue;
    seen.add(c.id);
    if (c.dissolved) continue; // 墓標は索引に入れない
    idx[posKey(c.dimId, c.x, c.y, c.z)] = c.id;
  }
  // 控えにあるのに、記録も墓標もないID = 事故(データ欠損)
  const ids = (world.getDynamicProperty(IDS_KEY) || "").split(",").filter(Boolean);
  lostIds = ids.filter((id) => !seen.has(id));
}

export function getLostCoreIds() { ensureIdx(); return [...lostIds]; }
export function resetCoreIndexForTest() { idx = {}; idxLoaded = false; lostIds = []; }

export function readRec(id) { return readJson(recKey(id), undefined); }
export function loadCore(id) { const c = readRec(id); return c && !c.dissolved ? c : undefined; }
// 墓標があるIDには、古い参照からの保存を通さない(復活の防止)
export function saveCore(c) {
  if (readRec(c.id)?.dissolved) return false;
  writeJson(recKey(c.id), c);
  return true;
}
function addId(id) {
  const ids = (world.getDynamicProperty(IDS_KEY) || "").split(",").filter(Boolean);
  if (!ids.includes(id)) { ids.push(id); world.setDynamicProperty(IDS_KEY, ids.join(",")); }
}

export function getCoreAtPos(dimId, x, y, z) {
  ensureIdx();
  const id = idx[posKey(dimId, x, y, z)];
  return id ? loadCore(id) : undefined;
}
export function listCores(kind) {
  ensureIdx();
  const out = [];
  for (const id of Object.values(idx)) {
    const c = loadCore(id);
    if (c && (!kind || c.kind === kind)) out.push(c);
  }
  return out;
}
export function listTombstones() {
  const out = [];
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(CORE_PREFIX)) continue;
    const c = readJson(key, null);
    if (c?.dissolved) out.push(c);
  }
  return out;
}

// ---------- 名前・ID ----------

function newId() {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (id.length === 6 && !readRec(id) && !getEntityAccount(id)) return id;
  }
}

export function normalizeName(name) {
  return String(name ?? "").normalize("NFKC").toLowerCase().replace(/[\s　・._\-]/g, "");
}

// 会社名の検査: 1〜NAME_MAX文字、予約語と重複は不可。重複は日本語名・英語名のどちらとも比べる。
export function validateCompanyName(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  if ([...raw].length > NAME_MAX) return { ok: false, reason: "too_long" };
  const n = normalizeName(raw);
  if (RESERVED_NAMES.some((r) => n === normalizeName(r) || n.includes("hrmhrm"))) return { ok: false, reason: "reserved" };
  for (const c of listCores()) {
    if (normalizeName(c.name) === n || (c.nameEn && normalizeName(c.nameEn) === n)) return { ok: false, reason: "duplicate" };
  }
  return { ok: true, name: raw };
}

// ---------- 料金・クールダウン ----------
export function getRegistrationFee() { return scaleEInt(getPolicyParam("company_reg_fee")); }

export function getCooldownUntil(playerId) { return readJson(COOLDOWN_KEY, {})[playerId] ?? 0; }
function setCooldown(playerId, days) {
  if (!(days > 0)) return;
  const map = readJson(COOLDOWN_KEY, {});
  const until = today() + days;
  if ((map[playerId] ?? 0) < until) map[playerId] = until;
  for (const k of Object.keys(map)) if (map[k] <= today()) delete map[k]; // 切れたものを掃除
  writeJson(COOLDOWN_KEY, map);
}
export function cooldownDaysLeft(playerId) { return Math.max(0, getCooldownUntil(playerId) - today()); }

export function companyOf(playerId) {
  return listCores("company").find((c) => c.ownerId === playerId);
}

// 既存の村の検知の箱の中にある鐘は、村として登記できない
export function villageNear(dimId, x, y, z) {
  return listCores("village").find((c) => c.dimId === dimId && Math.abs(c.x - x) <= RANGE_XZ && Math.abs(c.z - z) <= RANGE_XZ && Math.abs(c.y - y) <= RANGE_Y);
}

// ---------- 登記 ----------
// spec = { kind, dimId, x, y, z, typeId, states, name }。触媒の確認と消費は呼び出し側が関数で渡す。
// 戻り値: { ok: true, core } | { ok: false, reason, ... }
export function registerCore(player, spec, { hasCatalyst = () => true, consumeCatalyst = () => true } = {}) {
  const { kind, dimId, x, y, z, typeId, states = {} } = spec;
  if (kind !== "village" && kind !== "company") return { ok: false, reason: "bad_kind" };
  ensureIdx();
  if (idx[posKey(dimId, x, y, z)]) return { ok: false, reason: "already_registered" };

  let name = null;
  let nameEn = null;
  let fee = 0;
  if (kind === "village") {
    const near = villageNear(dimId, x, y, z);
    if (near) return { ok: false, reason: "village_overlap", near };
  } else {
    const mine = companyOf(player.id);
    if (mine) return { ok: false, reason: "one_company", mine };
    const left = cooldownDaysLeft(player.id);
    if (left > 0) return { ok: false, reason: "cooldown", daysLeft: left };
    const v = validateCompanyName(spec.name);
    if (!v.ok) return { ok: false, reason: "name_" + v.reason };
    name = v.name;
    if (spec.nameEn) {
      // 英語名(任意)も、日本語名と同じ規則で検査する(同じ名前の二重指定は許す)
      if (normalizeName(spec.nameEn) !== normalizeName(name)) {
        const ve = validateCompanyName(spec.nameEn);
        if (!ve.ok) return { ok: false, reason: "name_" + ve.reason };
      }
      nameEn = String(spec.nameEn).trim();
    }
    fee = getRegistrationFee();
    const bal = player.getDynamicProperty("acc_emeralds") ?? 0;
    if (bal < fee) return { ok: false, reason: "insufficient_funds", fee, balance: bal };
  }
  if (!hasCatalyst()) return { ok: false, reason: "no_catalyst" };

  // ここから先は順序が大事: 料金 → 口座 → 保存 → 触媒
  if (fee > 0 && debitEmeralds(player, fee, FLOW.CORE_FEE, { to: "HRMHRM" }) <= 0) return { ok: false, reason: "insufficient_funds", fee };
  const id = newId();
  const village = kind === "village" ? pickVillageName() : null;
  const head = kind === "village" ? pickHeadName() : null;
  const core = {
    v: 1, id, kind, blockType: typeId, states, dimId, x, y, z,
    name: kind === "village" ? village.ja : name,
    nameEn: kind === "village" ? village.en : nameEn, // 村は日英を同時に生成。会社は任意の英語名(無ければ null)
    headName: kind === "village" ? head.ja : player.name, // 村長=ランダム / 社長=登記した人
    headNameEn: kind === "village" ? head.en : player.name,
    ownerId: player.id, ownerName: player.name, createdAt: today(),
    assets: [], // 保有施設(範囲登録。後続のアプデ)
    dissolving: false
  };
  if (kind === "company") { core.members = []; core.applicants = []; core.ownerSeenDay = today(); }
  try {
    createEntityAccount({ id, type: kind, name: { ja: core.name, en: core.nameEn ?? core.name }, population: kind === "village" ? 0 : null });
  } catch (e) {
    // 口座を作れなかった: 料金を戻して、登記は無かったことにする
    console.warn(`[BeeMyHoney] core ${id}: account creation failed: ${e}`);
    if (fee > 0) creditEmeralds(player, fee, FLOW.CORE_FEE, { from: "HRMHRM" });
    return { ok: false, reason: "account_failed" };
  }
  saveCore(core);
  addId(id);
  idx[posKey(dimId, x, y, z)] = id;
  if (!consumeCatalyst()) console.warn(`[BeeMyHoney] core ${id}: catalyst could not be consumed after registration`);
  return { ok: true, core, fee };
}

// ---------- 村の人口 ----------
// n = { adults, babies }。測れた日だけ呼ぶ(測れない日は呼ばない = 0扱いにしない)。
export function recordPopulation(core, n, day = today()) {
  const pop = n.adults + n.babies;
  core.pop = pop;
  core.popDay = day;
  core.popHistory = [...(core.popHistory ?? []), { d: day, n: pop }].slice(-30);
  if (pop > 0) { delete core.emptySince; delete core.lastZeroDay; }
  else { core.emptySince ??= day; core.lastZeroDay = day; }
  saveCore(core);
  const acct = getEntityAccount(core.id);
  if (acct) { acct.population = pop; saveEntityAccount(acct); }
  return pop;
}

// ---------- 会社の人員 ----------
export const isMember = (core, id) => (core.members ?? []).some((m) => m.id === id);
// 採用・見送りの権限: 社長、または社長が不在(オフライン)の間のメンバー。会計・契約・経営は代行できない。
export const canManagePeople = (core, playerId, onlineIds) =>
  core.kind === "company" && (core.ownerId === playerId || (isMember(core, playerId) && !onlineIds.has(core.ownerId)));

export function applyToCompany(id, player) {
  const c = loadCore(id);
  if (!c || c.kind !== "company") return { ok: false, reason: "not_found" };
  if (c.ownerId === player.id) return { ok: false, reason: "is_owner" };
  if (isMember(c, player.id)) return { ok: false, reason: "already_member" };
  c.applicants ??= [];
  if (c.applicants.some((a) => a.id === player.id)) return { ok: false, reason: "already_applied" };
  if (c.applicants.length >= APPLICANT_MAX) return { ok: false, reason: "full" };
  c.applicants.push({ id: player.id, name: player.name, d: today() });
  saveCore(c);
  return { ok: true };
}

export function reviewApplicant(id, actorId, applicantId, hire, onlineIds) {
  const c = loadCore(id);
  if (!c || !canManagePeople(c, actorId, onlineIds)) return { ok: false, reason: "forbidden" };
  const a = (c.applicants ?? []).find((x) => x.id === applicantId);
  if (!a) return { ok: false, reason: "not_found" };
  c.applicants = c.applicants.filter((x) => x.id !== applicantId);
  if (hire && !isMember(c, a.id)) c.members = [...(c.members ?? []), { id: a.id, name: a.name }];
  saveCore(c);
  return { ok: true, name: a.name, hired: !!hire };
}

export function leaveCompany(id, playerId) {
  const c = loadCore(id);
  if (!c || !isMember(c, playerId)) return { ok: false, reason: "not_member" };
  c.members = c.members.filter((m) => m.id !== playerId);
  saveCore(c);
  return { ok: true, name: c.name };
}

// ---------- 清算の見積もり ----------
// mode: "voluntary"(任意解散) | "forced"(強制解散)。現物は銀行が時価の一部で買い取る。
export function estimateLiquidation(core, mode) {
  const acct = getEntityAccount(core.id);
  const ratio = getPolicyParam(mode === "forced" ? "forced_liquidation_ratio" : "liquidation_ratio");
  const cash = acct?.cash ?? 0;
  const receivables = acct?.receivables ?? 0;
  const liabilities = acct?.liabilities ?? 0;
  const holdings = acct ? { ...acct.holdings } : {};
  const holdingsValue = acct ? valueHoldings(acct.holdings).total : 0;
  // 会社の在庫(仮想施設の産出)も、銀行が時価の一部で買い取る
  const stock = { ...(core.stock ?? {}) };
  let stockValue = 0;
  for (const [itemId, n] of Object.entries(stock)) if (n > 0) stockValue += getItemBasePriceExact(itemId) * getPriceLevel() * n;
  const bankBuy = Math.round((holdingsValue + stockValue) * ratio);
  const result = Math.round(cash + receivables + bankBuy - liabilities);
  // 村の清算は、残りがHRMHRMへ戻る(代表者への払いはなし。支給された運用資金を持ち逃げできないように)
  const payout = core.kind === "village" ? 0 : Math.max(0, result);
  const shortfall = Math.max(0, -result);
  // ペナルティ: 会社は常に(信用・再登記の待ち)。村は債務超過のときだけ信用。
  const isCompany = core.kind === "company";
  const penalized = isCompany || shortfall > 0;
  return {
    mode, ratio, cash: Math.round(cash), receivables: Math.round(receivables), liabilities: Math.round(liabilities),
    holdings, holdingsValue: Math.round(holdingsValue), stock, stockValue: Math.round(stockValue), bankBuy, result, payout, shortfall,
    creditRatio: penalized ? getPolicyParam(mode === "forced" ? "forced_credit_penalty" : "dissolve_credit_penalty") : 0,
    cooldownDays: isCompany ? getPolicyParam(mode === "forced" ? "forced_cooldown_days" : "dissolve_cooldown_days") : 0,
    hasAccount: !!acct
  };
}

// ---------- 解散の実行 ----------
export function onlineIdSet() { return new Set(world.getAllPlayers().map((p) => p.id)); }
// 会社ごとの「いまオンラインの人」。試験用に core.testAbsent があれば、社長は不在として扱う(1人で代行を試すため)。
export function onlineIdsFor(core) {
  const ids = onlineIdSet();
  if (core.testAbsent) ids.delete(core.ownerId);
  return ids;
}
const findOnline = (id) => world.getAllPlayers().find((p) => p.id === id);

function addPending(playerId, item) {
  const map = readJson(PENDING_KEY, {});
  (map[playerId] ??= { pay: [], credit: [] });
  if (item.pay) map[playerId].pay.push(item.pay);
  if (item.credit) map[playerId].credit.push(item.credit);
  writeJson(PENDING_KEY, map);
}

function applyCreditRatio(player, ratio) {
  if (!(ratio > 0)) return 0;
  const delta = Math.round(getCreditScore(player) * ratio);
  adjustCredit(player, -delta);
  return delta;
}

// ログインした時に、保留していた払いと減点を適用する。戻り値: { paid, penalty }(メッセージ用)
export function applyPendingFor(player) {
  const map = readJson(PENDING_KEY, {});
  const p = map[player.id];
  if (!p) return null;
  let paid = 0, penalty = 0;
  const from = [];
  for (const x of p.pay ?? []) { paid += creditEmeralds(player, x.a, FLOW.LIQUIDATION, { from: x.from }); from.push(x.from); }
  for (const r of p.credit ?? []) penalty += applyCreditRatio(player, r);
  delete map[player.id];
  writeJson(PENDING_KEY, map);
  return { paid, penalty, from };
}

export function getBadDebtTotal() { return world.getDynamicProperty(BAD_DEBT_KEY) ?? 0; }

function writeTombstone(core, reason) {
  world.setDynamicProperty(recKey(core.id), JSON.stringify({
    id: core.id, dissolved: true, reason, at: today(), name: core.name, kind: core.kind, ownerId: core.ownerId
  }));
  ensureIdx();
  delete idx[posKey(core.dimId, core.x, core.y, core.z)];
  resolveIntervention(core.id);
}

// 解散(清算)を実行する。途中で止まった場合は、同じ呼び出しで続きから再開する(core.liq の完了印を見る)。
// opts = { mode: "voluntary"|"forced", reason: "dissolved"|"forced"|"abandoned"|"empty"|"deregistered" }
// 戻り値: { ok, est, paidNow, offline }
export function dissolveCore(core, { mode = "voluntary", reason = "dissolved" } = {}) {
  const c = loadCore(core.id);
  if (!c) return { ok: false, reason: "not_found" };
  if (!c.liq) {
    c.dissolving = true;
    c.liq = { mode, reason, est: estimateLiquidation(c, mode), steps: { acct: false, pay: false, pen: false } };
    saveCore(c); // 意図を先に保存する
  }
  const liq = c.liq;
  const est = liq.est;

  // 1. 口座と在庫: 現物を銀行(HRMHRM)へ移し、口座を閉じる
  if (!liq.steps.acct) {
    const acct = getEntityAccount(c.id);
    const hr = ensureHrmhrmAccount();
    if (acct) repayLoansOnWindUp(acct); // 借りているローンを、残った現金から貸し手へ返す
    if (acct) for (const [k, n] of Object.entries(acct.holdings ?? {})) if (n > 0) hr.holdings[k] = (hr.holdings[k] ?? 0) + n;
    for (const [itemId, n] of Object.entries(est.stock ?? {})) addToPool(itemId, n);
    if (c.kind === "village") {
      // 村の資金は開発銀行機構の支給が元手なので、解散したら残りの現金はHRMHRMへ戻る(代表者へは払わない)。現物・在庫は無償でHRMHRMへ。
      hr.cash += Math.max(0, Math.floor(acct?.cash ?? 0));
    } else {
      hr.cash -= est.bankBuy;
    }
    saveEntityAccount(hr);
    if (acct) {
      acct.cash = 0; acct.receivables = 0; acct.liabilities = 0; acct.holdings = {};
      saveEntityAccount(acct);
      deleteEntityAccount(c.id);
    }
    liq.steps.acct = true;
    saveCore(c);
  }

  // 2. 清算の残りを代表へ(オフラインなら次のログインで)
  let offline = false;
  let paidNow = 0;
  if (!liq.steps.pay) {
    if (est.payout > 0) {
      const owner = findOnline(c.ownerId);
      if (owner) paidNow = creditEmeralds(owner, est.payout, FLOW.LIQUIDATION, { from: c.name });
      else { addPending(c.ownerId, { pay: { a: est.payout, from: String(c.name).slice(0, 24) } }); offline = true; }
    }
    liq.steps.pay = true;
    saveCore(c);
  }

  // 3. ペナルティ(信用スコア・再登記の待ち)と貸倒れの記録
  if (!liq.steps.pen) {
    if (est.creditRatio > 0) {
      const owner = findOnline(c.ownerId);
      if (owner) applyCreditRatio(owner, est.creditRatio);
      else { addPending(c.ownerId, { credit: est.creditRatio }); offline = true; }
    }
    if (est.cooldownDays > 0) setCooldown(c.ownerId, est.cooldownDays);
    if (est.shortfall > 0) world.setDynamicProperty(BAD_DEBT_KEY, getBadDebtTotal() + est.shortfall);
    liq.steps.pen = true;
    saveCore(c);
  }

  writeTombstone(c, liq.reason);
  return { ok: true, est, paidNow, offline, reason: liq.reason };
}

// 途中で止まった解散(dissolving)を再開する。保険のループから呼ぶ。
export function resumeDissolutions() {
  let n = 0;
  for (const c of listCores()) if (c.dissolving && c.liq) { dissolveCore(c, { mode: c.liq.mode, reason: c.liq.reason }); n++; }
  return n;
}

// ---------- 日次の保守 ----------
// 戻り値: 実行した処置 { action, ... } | null
//   社長の最終在席日の更新 / メンバーがいない会社は社長の不在が続くと強制解散 / 介入案件のある会社は強制解散 /
//   口座が消えた村(HRMHRMの介入で登録解除)は墓標に / 村の人口0が続けば登記を抹消
export function runUpkeep(core, { ownerOnline, day = today() } = {}) {
  if (core.dissolving) return null;
  const acct = getEntityAccount(core.id);
  if (!acct) {
    // 口座が閉じられている = HRMHRMの介入で登録解除された(村の壊滅など)。墓標にする。
    const r = dissolveCore(core, { mode: "forced", reason: "deregistered" });
    return { action: "deregistered", ...r };
  }
  if (core.kind === "company") {
    if (ownerOnline) {
      if (core.ownerSeenDay !== day) { core.ownerSeenDay = day; saveCore(core); }
    } else if ((core.members ?? []).length === 0 && day - (core.ownerSeenDay ?? day) >= getPolicyParam("company_absent_days")) {
      const r = dissolveCore(core, { mode: "forced", reason: "abandoned" });
      return { action: "abandoned", ...r };
    }
    if (getInterventions().some((r) => r.entityId === core.id && r.status === "open")) {
      const r = dissolveCore(core, { mode: "forced", reason: "forced" });
      return { action: "forced", ...r };
    }
    return null;
  }
  // 村: 借入依頼が貸し手を見つけられず、資金が運用の下限を割ったまま(介入案件 loan_unfilled)なら、強制解散して清算
  if (getInterventions().some((r) => r.entityId === core.id && r.status === "open" && r.reason === "loan_unfilled")) {
    const r = dissolveCore(core, { mode: "forced", reason: "forced" });
    return { action: "forced", ...r };
  }
  // 村: 測れた日が全て人口0のまま village_empty_weeks 週続いた
  if (core.emptySince !== undefined && core.lastZeroDay !== undefined && core.lastZeroDay - core.emptySince >= getPolicyParam("village_empty_weeks") * 7) {
    const r = dissolveCore(core, { mode: "forced", reason: "empty" });
    return { action: "empty", ...r };
  }
  return null;
}
