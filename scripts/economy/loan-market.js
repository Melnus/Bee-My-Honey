import { world } from "@minecraft/server";
import { scaleE, scaleEInt } from "./price-level.js";
import { creditEmeralds, debitEmeralds, FLOW } from "./ledger.js";
import { getAccount, getTotalNetWorth } from "./bank.js";
import { getPolicyParam } from "./policy.js";
import { getLenderRate, getRepayProbability } from "./rates.js";
import { getCreditScore, clearOverdue } from "./credit.js";
import { LOAN_TIERS, termWeeks, hasActiveLoan, hasActiveLending, registerP2pHooks } from "./loan.js";
import { getEntityAccount, saveEntityAccount, registerDeleteHook, queueIntervention } from "./account.js";
import { getProfile } from "./entity-ops.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// ==========================================
// 借入依頼の掲示板 / Loan Request Board  (dev/loan-market-spec.md)
// ------------------------------------------
// 「借りる」から出した依頼と、資金が足りない村・会社が出す依頼が、「貸す」の候補に並ぶ。
//   依頼 = { id, kind: "player"|"village"|"company", bid(借り手のID), bname{ja,en}, amount, weeks, rate, prob, day }
//   依頼は掲示から7日以上たった最初の週の締めで消える(7〜13日)。
//   村・会社の依頼が消えて、なお現金が運用の下限を割っているなら、介入案件(loan_unfilled)として清算手続きへ進む。
// 貸す側のスロットは既存と同じ(同時に1件)。借りた側は cr_loan_* を銀行のローンと共用し、cr_loan_lender に貸し手IDが入る。
// 貸し手へのお金(返済・完了の通知)は、オフラインなら郵便受け(bmh_loan_mail)に入り、次のログインで届く。
// お金の動きは p2p_* の台帳カテゴリ(市場のグループ。発行でも回収でもない)。銀行のローンとは混ぜない。
// ==========================================
export const REQUEST_DAYS = 7;
export const ENTITY_REPAY_PROB = 0.9; // 村・会社の返済見込み(固定)
export const ENTITY_SHORT_FACTOR = 2; // 村・会社が「足りない」とみなす水準 = 目標準備金 × この係数(自由に使える現金がこれ未満)
const REQ_KEY = "bmh_loan_requests";
const MAIL_KEY = "bmh_loan_mail";
const SEQ_KEY = "bmh_loan_req_seq";
const MAX_REQUESTS = 60;
const MAIL_KEEP = 20;
const ENTITY_OVERDUE_LIMIT = 4;

const today = () => world.getDay();
const nameOf = (n) => (typeof n === "string" ? { ja: n, en: n } : n);
const label = (n, lang) => (lang === "en" ? n.en || n.ja : n.ja || n.en);

function readJson(key, fallback) {
  const raw = world.getDynamicProperty(key);
  if (typeof raw !== "string") return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}
const writeJson = (key, v) => world.setDynamicProperty(key, JSON.stringify(v));
const findOnline = (id) => world.getAllPlayers().find((p) => p.id === id);

// ---------- 条件 ----------
export function loanTerms(tier, prob) {
  const weeks = termWeeks(tier.difficulty);
  const rate = getLenderRate(prob, weeks);
  const amount = scaleEInt(tier.amount);
  const totalDue = Math.round(amount * (1 + rate * weeks));
  return { amount, weeks, rate, prob, totalDue, weekly: Math.ceil(totalDue / weeks) };
}
export function playerTerms(player, tierIndex) {
  return loanTerms(LOAN_TIERS[tierIndex], getRepayProbability(getCreditScore(player)));
}

// ---------- 資産額による上限 ----------
// 借りられる額 = 借り手の純資産(口座・外貨・株 − 借入) × loan_borrow_asset_ratio
// 貸せる額     = 貸し手の資産(口座・外貨・株) × loan_lend_asset_ratio(全財産を貸し込めない)
export function playerAssets(player) {
  return Math.max(0, getTotalNetWorth(player) - (player.getDynamicProperty("cr_loan_balance") ?? 0));
}
export const borrowLimit = (player) => Math.floor(playerAssets(player) * getPolicyParam("loan_borrow_asset_ratio"));
export const lendLimit = (player) => Math.floor(getTotalNetWorth(player) * getPolicyParam("loan_lend_asset_ratio"));
// いま依頼できる段(LOAN_TIERS の添字)
export function availableTiers(player) {
  const limit = borrowLimit(player);
  return LOAN_TIERS.map((tier, i) => ({ i, amount: scaleEInt(tier.amount) })).filter((x) => x.amount <= limit).map((x) => x.i);
}

// ---------- 掲示板 ----------
export function getRequests() {
  const r = readJson(REQ_KEY, []);
  return Array.isArray(r) ? r : [];
}
export function findOwnRequest(bid) {
  return getRequests().find((r) => r.bid === bid);
}
function pushRequest(req) {
  const list = getRequests();
  // IDは増え続ける(掲示が空になっても再利用しない。貸付の識別(lid)に使うので、古い貸付の通知と取り違えないため)
  const seq = Math.max(world.getDynamicProperty(SEQ_KEY) ?? 0, list.reduce((m, r) => Math.max(m, r.id ?? 0), 0)) + 1;
  world.setDynamicProperty(SEQ_KEY, seq);
  req.id = seq;
  list.push(req);
  while (list.length > MAX_REQUESTS) list.shift();
  writeJson(REQ_KEY, list);
  return req;
}

export function postPlayerRequest(player, tierIndex) {
  if (!LOAN_TIERS[tierIndex]) return { ok: false, reason: "bad_tier" };
  if (hasActiveLoan(player)) return { ok: false, reason: "already_active" };
  if (findOwnRequest(player.id)) return { ok: false, reason: "already_posted" };
  const tm = playerTerms(player, tierIndex);
  const limit = borrowLimit(player);
  if (tm.amount > limit) return { ok: false, reason: "over_limit", limit };
  const req = pushRequest({ kind: "player", bid: player.id, bname: nameOf(player.name), amount: tm.amount, weeks: tm.weeks, rate: tm.rate, prob: tm.prob, assets: Math.round(playerAssets(player)), day: today() });
  return { ok: true, request: req, terms: tm };
}

export function cancelRequest(player) {
  const list = getRequests();
  const keep = list.filter((r) => !(r.kind === "player" && r.bid === player.id));
  if (keep.length === list.length) return false;
  writeJson(REQ_KEY, keep);
  return true;
}

// 貸す側に見せる依頼。自分の依頼・オフラインの借り手・口座の無い村/会社は除く。古い順。
export function listOpenRequests(lender) {
  return getRequests().filter((r) => {
    if (r.kind === "player") return r.bid !== lender.id && !!findOnline(r.bid);
    return !!getEntityAccount(r.bid);
  }).sort((a, b) => a.day - b.day || a.id - b.id);
}

// 村・会社の資金不足。自由に使える現金(口座の現金 − 予約額)が 目標準備金×ENTITY_SHORT_FACTOR 未満なら、その差が不足額。
export function entityShortage(acct, reserved = 0) {
  const threshold = scaleE(getProfile(acct).targetReserveBase) * ENTITY_SHORT_FACTOR;
  const free = acct.cash - reserved;
  return { threshold, free, shortage: Math.max(0, threshold - free) };
}

// 村・会社の依頼。不足額があり、依頼がまだ無ければ1件出す。金額は不足額に合う段のうち、資産(assets)の loan_borrow_asset_ratio 以内。
// 呼び出し側は先に在庫などの物資を売って、それでも足りない分だけを依頼にする(物資を溜め込んだまま借りない)。
// core = { id, kind, names: {ja,en} }。出したら依頼を、出さなければ null を返す。
export function postEntityRequestIfShort(core, acct, reserved = 0, assets = 0) {
  if (!acct) return null;
  const { shortage } = entityShortage(acct, reserved);
  if (!(shortage > 0)) return null;
  if (findOwnRequest(core.id)) return null;
  if ((acct.loans ?? []).length >= 2) return null;
  const cap = Math.floor(Math.max(0, assets) * getPolicyParam("loan_borrow_asset_ratio"));
  const fit = LOAN_TIERS.filter((x) => scaleEInt(x.amount) <= cap);
  if (fit.length === 0) return null; // 資産に対して借りられる額がない
  const tier = fit.find((x) => scaleEInt(x.amount) >= shortage) ?? fit[fit.length - 1];
  const tm = loanTerms(tier, ENTITY_REPAY_PROB);
  return pushRequest({ kind: core.kind, bid: core.id, bname: core.names, amount: tm.amount, weeks: tm.weeks, rate: tm.rate, prob: tm.prob, assets: Math.round(assets), day: today() });
}

// ---------- 貸す ----------
function setLending(lender, r, tm) {
  const nm = nameOf(r.bname);
  lender.setDynamicProperty("loan_lent_active", 1);
  lender.setDynamicProperty("loan_lent_amount", tm.amount);
  lender.setDynamicProperty("loan_lent_weeks_left", tm.weeks);
  lender.setDynamicProperty("loan_lent_original_weeks", tm.weeks);
  lender.setDynamicProperty("loan_lent_rate", tm.rate);
  lender.setDynamicProperty("loan_lent_prob", Math.round(tm.prob * 100));
  lender.setDynamicProperty("loan_lent_name", nm.ja);
  lender.setDynamicProperty("loan_lent_name_en", nm.en);
  lender.setDynamicProperty("loan_lent_p2p", 1);
  lender.setDynamicProperty("loan_lent_lid", r.id);
  // 期間+猶予を過ぎても完了の知らせが無ければ、貸し倒れとして閉じる(借り手が来なくなっても貸し手のスロットが固まらない)
  lender.setDynamicProperty("loan_lent_due_week", Math.floor(today() / 7) + tm.weeks + getPolicyParam("loan_lend_grace_weeks"));
}

// 貸している相手の名前(表示する言語で)
export function lentLabel(player, lang) {
  const ja = player.getDynamicProperty("loan_lent_name") ?? "";
  const en = player.getDynamicProperty("loan_lent_name_en");
  return lang === "en" && en ? en : ja;
}

export function fillRequest(lender, id) {
  const list = getRequests();
  const r = list.find((x) => x.id === id);
  if (!r) return { ok: false, reason: "gone" };
  if (hasActiveLending(lender)) return { ok: false, reason: "already_lending" };
  if (r.kind === "player" && r.bid === lender.id) return { ok: false, reason: "own" };
  if (getAccount(lender).emeralds < r.amount) return { ok: false, reason: "insufficient_funds" };
  const maxLend = lendLimit(lender);
  if (r.amount > maxLend) return { ok: false, reason: "over_lend_limit", limit: maxLend };
  const nm = nameOf(r.bname);
  const totalDue = Math.round(r.amount * (1 + r.rate * r.weeks));
  const weekly = Math.ceil(totalDue / r.weeks);
  const tm = { amount: r.amount, weeks: r.weeks, rate: r.rate, prob: r.prob, totalDue, weekly };

  if (r.kind === "player") {
    const b = findOnline(r.bid);
    if (!b) return { ok: false, reason: "borrower_offline" };
    if (hasActiveLoan(b)) return { ok: false, reason: "borrower_busy" };
    debitEmeralds(lender, r.amount, FLOW.P2P_LEND, { to: nm.ja });
    creditEmeralds(b, r.amount, FLOW.P2P_BORROW, { from: lender.name });
    b.setDynamicProperty("cr_loan_balance", totalDue);
    b.setDynamicProperty("cr_loan_weekly_payment", weekly);
    b.setDynamicProperty("cr_loan_weeks_left", r.weeks);
    b.setDynamicProperty("cr_loan_principal_left", r.amount);
    b.setDynamicProperty("cr_loan_count", (b.getDynamicProperty("cr_loan_count") ?? 0) + 1);
    b.setDynamicProperty("cr_loan_lender", lender.id);
    b.setDynamicProperty("cr_loan_lender_name", lender.name);
    b.setDynamicProperty("cr_loan_lid", r.id);
    clearOverdue(b);
    b.sendMessage(t(getLang(b), STR.loanMarketFilledBorrower, lender.name, r.amount, weekly, r.weeks));
  } else {
    const acct = getEntityAccount(r.bid);
    if (!acct) { writeJson(REQ_KEY, list.filter((x) => x.id !== id)); return { ok: false, reason: "gone" }; }
    debitEmeralds(lender, r.amount, FLOW.P2P_LEND, { to: nm.ja });
    acct.cash += r.amount;
    acct.liabilities += totalDue;
    (acct.loans ??= []).push({ id: r.id, lenderId: lender.id, lenderName: lender.name, name: nm, balance: totalDue, weekly, weeksLeft: r.weeks, principalLeft: r.amount, overdue: 0 });
    saveEntityAccount(acct);
  }
  setLending(lender, r, tm);
  writeJson(REQ_KEY, getRequests().filter((x) => x.id !== id));
  return { ok: true, terms: tm, kind: r.kind, names: nm };
}

// ---------- 貸し手への配達(郵便受け) ----------
function deliver(p, ev) {
  const lang = getLang(p);
  if (ev.bonus > 0) creditEmeralds(p, ev.bonus, FLOW.P2P_RETURN, { from: "—" }); // 溢れた通知から合算された受取
  const nm = label(nameOf(ev.name), lang);
  if (ev.k === "pay") {
    creditEmeralds(p, ev.a, FLOW.P2P_RETURN, { from: nameOf(ev.name).ja });
    if (typeof ev.weeksLeft === "number" && sameLoan(p, ev)) p.setDynamicProperty("loan_lent_weeks_left", ev.weeksLeft);
    p.sendMessage(t(lang, STR.loanMailPay, nm, ev.a));
  } else if (ev.k === "close") {
    // 別の貸付のスロットを消さないよう、同じ貸付(lid)の時だけ閉じる(期限切れで先に閉じた貸付の完了通知が、あとから来ることがある)
    if (!sameLoan(p, ev)) return;
    closeLending(p);
    p.sendMessage(t(lang, ev.ok ? STR.loanMailClosedOk : STR.loanMailClosedLost, nm));
  }
}

const sameLoan = (p, ev) => p.getDynamicProperty("loan_lent_p2p") === 1 && p.getDynamicProperty("loan_lent_lid") === ev.lid;
function closeLending(p) {
  for (const k of ["loan_lent_active", "loan_lent_amount", "loan_lent_weeks_left", "loan_lent_original_weeks", "loan_lent_p2p"]) p.setDynamicProperty(k, 0);
  for (const k of ["loan_lent_name_en", "loan_lent_lid", "loan_lent_due_week"]) p.setDynamicProperty(k, undefined);
}

// 期間+猶予を過ぎた貸付を、貸し倒れとして閉じる。閉じたら true。
export function expireLending(p) {
  if (p.getDynamicProperty("loan_lent_p2p") !== 1) return false;
  const due = p.getDynamicProperty("loan_lent_due_week");
  if (typeof due !== "number" || Math.floor(today() / 7) <= due) return false;
  const lang = getLang(p);
  const label = lentLabel(p, lang);
  closeLending(p);
  p.sendMessage(t(lang, STR.loanMailClosedLost, label));
  return true;
}

export function mailTo(pid, ev) {
  const p = findOnline(pid);
  if (p) { deliver(p, ev); return; }
  const map = readJson(MAIL_KEY, {});
  const box = (map[pid] ??= []);
  const last = box[box.length - 1];
  if (ev.k === "pay" && last && last.k === "pay" && last.lid === ev.lid && JSON.stringify(last.name) === JSON.stringify(ev.name)) { last.a += ev.a; last.weeksLeft = ev.weeksLeft; }
  else box.push(ev);
  // 溢れたら古い順に捨てるが、受け取るお金(pay)は捨てずに、残る通知へ合算する
  while (box.length > MAIL_KEEP) {
    const old = box.shift();
    box[0].bonus = (box[0].bonus ?? 0) + (old.k === "pay" ? old.a : 0) + (old.bonus ?? 0);
  }
  writeJson(MAIL_KEY, map);
}

export function deliverMail(player) {
  const map = readJson(MAIL_KEY, {});
  const box0 = map[player.id];
  if (!box0 || box0.length === 0) { expireLending(player); return 0; }
  const box = map[player.id];
  if (!box || box.length === 0) return 0;
  delete map[player.id];
  writeJson(MAIL_KEY, map);
  for (const ev of box) deliver(player, ev);
  expireLending(player);
  return box.length;
}

// ---------- 村・会社の返済(週次。口座を更新するが保存は呼び出し側) ----------
export function settleEntityLoans(acct, record) {
  const loans = acct.loans ?? [];
  if (loans.length === 0) return;
  let failed = false;
  const keep = [];
  for (const L of loans) {
    const pay = Math.min(L.weekly, L.balance);
    if (acct.cash >= pay) {
      const interest = L.balance > 0 ? pay * (1 - Math.min(1, L.principalLeft / L.balance)) : 0;
      acct.cash -= pay;
      acct.liabilities = Math.max(0, acct.liabilities - pay);
      L.principalLeft = Math.max(0, L.principalLeft - (pay - interest));
      L.balance -= pay;
      L.weeksLeft -= 1;
      L.overdue = 0;
      record.expense += interest; record.net -= interest; record.cashDelta -= pay;
      mailTo(L.lenderId, { k: "pay", a: Math.round(pay), name: L.name, weeksLeft: Math.max(0, L.weeksLeft), lid: L.id });
      if (L.balance <= 0 || L.weeksLeft <= 0) {
        acct.liabilities = Math.max(0, acct.liabilities - Math.max(0, L.balance));
        mailTo(L.lenderId, { k: "close", ok: L.balance <= 0, name: L.name, lid: L.id });
      } else keep.push(L);
    } else {
      failed = true;
      L.overdue = (L.overdue ?? 0) + 1;
      if (L.overdue >= ENTITY_OVERDUE_LIMIT) {
        acct.liabilities = Math.max(0, acct.liabilities - L.balance); // 貸倒れ(返ってこない)
        mailTo(L.lenderId, { k: "close", ok: false, name: L.name, lid: L.id });
      } else keep.push(L);
    }
  }
  acct.loans = keep;
  if (failed) { if (acct.unsettledSince === null) acct.unsettledSince = record.week; }
  else if (acct.unsettledSince !== null) acct.unsettledSince = null;
}

// ---------- 週の締めでの掲示の整理 ----------
// 掲示から REQUEST_DAYS 日以上たった依頼を消す。村・会社の依頼が消えた時、現金が運用の下限を割っていれば介入案件(清算手続き)にする。
export function expireRequests(week) {
  const weekEnd = (week + 1) * 7;
  const list = getRequests();
  const gone = list.filter((r) => weekEnd - r.day >= REQUEST_DAYS);
  if (gone.length === 0) return 0;
  writeJson(REQ_KEY, list.filter((r) => weekEnd - r.day < REQUEST_DAYS));
  for (const r of gone) {
    if (r.kind === "player") {
      const b = findOnline(r.bid);
      if (b) b.sendMessage(t(getLang(b), STR.loanMarketExpired, r.amount));
      continue;
    }
    const acct = getEntityAccount(r.bid);
    if (acct && acct.cash < scaleE(getProfile(acct).minReserveBase)) queueIntervention(r.bid, acct.type, "loan_unfilled", week);
  }
  return gone.length;
}

// 解散の時、残っているローンを口座の現金から古い順に返す(足りなければ貸し倒れ。残りは registerDeleteHook が通知する)。
// acct を更新して、返した合計を返す(保存は呼び出し側)。
export function repayLoansOnWindUp(acct) {
  let paid = 0;
  const keep = [];
  for (const L of acct.loans ?? []) {
    const pay = Math.min(L.balance, Math.max(0, Math.floor(acct.cash)));
    if (pay > 0) {
      acct.cash -= pay;
      acct.liabilities = Math.max(0, acct.liabilities - pay);
      L.balance -= pay;
      paid += pay;
      mailTo(L.lenderId, { k: "pay", a: pay, name: L.name, weeksLeft: 0, lid: L.id });
    }
    if (L.balance > 0) keep.push(L); // 残りは貸し倒れ(削除フックが通知)
    else mailTo(L.lenderId, { k: "close", ok: true, name: L.name, lid: L.id });
  }
  acct.loans = keep;
  return paid;
}

// 口座が消える時(解散・登録解除)、残っているローンは貸し倒れとして貸し手へ知らせる
registerDeleteHook((acct) => {
  for (const L of acct.loans ?? []) mailTo(L.lenderId, { k: "close", ok: false, name: L.name, lid: L.id });
});

registerP2pHooks({
  pay: (lenderId, borrowerName, amount, weeksLeft, lid) => mailTo(lenderId, { k: "pay", a: Math.round(amount), name: borrowerName, weeksLeft, lid }),
  close: (lenderId, borrowerName, ok, lid) => mailTo(lenderId, { k: "close", ok, name: borrowerName, lid }),
  tick: (player) => expireLending(player)
});

export function startLoanMarket() {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    try { deliverMail(ev.player); } catch (e) { console.warn("[BeeMyHoney] loan mail: " + e); }
  });
}
