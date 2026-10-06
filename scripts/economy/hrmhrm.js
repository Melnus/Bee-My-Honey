import { world, system } from "@minecraft/server";
import { getWeekFlows, getCurrentWeek } from "./ledger.js";
import { scaleE, getPriceLevel } from "./price-level.js";
import {
  listAccountIds, getEntityAccount, saveEntityAccount, createEntityAccount, deleteEntityAccount,
  getBalanceSheet, decideIntervention, queueIntervention, getInterventions, getTotalWriteOff, getPendingFundingRequests
} from "./account.js";
import { emptyWeekRecord, runManagement, finalizeWeek } from "./entity-ops.js";
import { processFundingRequests, formatDevBankReport } from "./dev-bank.js";

// ==========================================
// HRMHRMの会計と週次の運用 / HRMHRM Accounting & Weekly Run  (dev/hrmhrm-accounting.md, dev/development-bank.md)
// ------------------------------------------
// このファイルがHRMHRM専用なのは2点だけ:
//   ・初期の資本金(HRMHRM_INITIAL)
//   ・「システム全体の相手方」としての週の収益・費用を、発行台帳(ledger.js)の週ごとの記録から作る(closeWeekFromLedger)
// 口座のテンプレート(account.js)・運用(entity-ops.js)・資金の審査(dev-bank.js)は、村・法人もそのまま使う。
//
// プレイヤーとのお金のやり取り(台帳)の扱い:
//   収益  … プレイヤーが払った: 郵便販売・プライム・保険料・事故補償/違約金・カード返済
//   費用  … プレイヤーへ払った: クエスト賃金・派遣マージン・雇用ボーナス・預金利息・配当
//   貸出  … 融資(ローン)の貸し出し/返済 → 債権(返済が元本を超えた分は利息収益)
//   借入  … プレイヤーの融資(貸し手として預かる分)→ 負債(返戻が元本を超えた分は利息費用)
//   含めない … 市場(ゴーレム・バルク・外貨・株・先物)との交換と、換金(入出金・換算)。市場は外部の相手方として扱う。
// 現金はマイナスになりうる(借越)。
//
// 週次の流れ(runHrmhrmWeekly。終わった週を順に追いつく):
//   各口座の週の締め → 運用(下限を割れば開発銀行機構に申請。余剰があれば貴金属を買う)
//   → 開発銀行機構が申請を審査(売れる資産があれば却下して売却 / なければ最低限の運用資金を支給)
//   → 精算不能の介入の判定(3週超: 村は人口0で登録解除・人口ありで介入。法人は介入)
// ==========================================

export const HRMHRM_ID = "hrmhrm";
export const HRMHRM_INITIAL = {
  cashBase: 40000,
  holdings: { gold_ingot: 50000, diamond: 20000 } // 個数(ベース価格で金約2.7万E・ダイヤ約3万E相当)
};
const REVENUE_OUT = ["mail_order", "prime_fee", "insurance", "labor_compensation", "labor_penalty", "card_payment"];
const EXPENSE_IN = ["quest_wage", "dispatch_margin", "hire_bonus", "bank_interest", "dividend"];
const MAX_CATCH_UP_WEEKS = 52;

function sumOf(map, keys) {
  let s = 0;
  for (const k of keys) s += map[k] ?? 0;
  return s;
}

export function ensureHrmhrmAccount() {
  const existing = getEntityAccount(HRMHRM_ID);
  if (existing) return existing;
  return createEntityAccount({
    id: HRMHRM_ID, type: "hrmhrm", name: { ja: "HRMHRM Partners HLD", en: "HRMHRM Partners HLD" },
    cash: Math.round(scaleE(HRMHRM_INITIAL.cashBase)), holdings: { ...HRMHRM_INITIAL.holdings }
  });
}

// 1週ぶんの台帳から、現金・債権・負債を更新して週次の記録を返す(まだ保存しない)。
export function closeWeekFromLedger(acct, week) {
  const flows = getWeekFlows(week);
  const revenue = sumOf(flows.out, REVENUE_OUT);
  const expense = sumOf(flows.in, EXPENSE_IN);

  // 貸出(債権): 貸し出しで増え、返済で減る。返済が残高を超えた分は利息収益
  const loanOut = flows.in.loan_disbursed ?? 0;
  const loanBack = flows.out.loan_repaid ?? 0;
  let receivables = acct.receivables + loanOut - loanBack;
  let loanInterest = 0;
  if (receivables < 0) { loanInterest = -receivables; receivables = 0; }

  // 借入(負債): プレイヤーの融資(HRMHRMが借り手)。預かりで増え、返戻で減る。返戻が残高を超えた分は利息費用
  const lentIn = flows.out.lend_out ?? 0;
  const lentBack = flows.in.lend_return ?? 0;
  let liabilities = acct.liabilities + lentIn - lentBack;
  let lendingInterest = 0;
  if (liabilities < 0) { lendingInterest = -liabilities; liabilities = 0; }

  const cashDelta = revenue + loanBack + lentIn - expense - loanOut - lentBack;
  acct.cash += cashDelta;
  acct.receivables = receivables;
  acct.liabilities = liabilities;

  return {
    week, revenue: revenue + loanInterest, expense: expense + lendingInterest,
    net: revenue + loanInterest - expense - lendingInterest, cashDelta, actions: []
  };
}

// 村・法人の精算不能を調べ、決めたルール(account.js の decideIntervention)に従って処理する。
export function runInterventionCheck(week) {
  const results = [];
  for (const id of listAccountIds()) {
    if (id === HRMHRM_ID) continue;
    const acct = getEntityAccount(id);
    if (!acct) continue;
    const d = decideIntervention(acct, week);
    if (d.action === "deregister") {
      const r = deleteEntityAccount(id);
      results.push({ id, action: "deregister", writtenOff: r.writtenOff });
    } else if (d.action === "intervene") {
      queueIntervention(id, acct.type, d.reason, week);
      results.push({ id, action: "intervene" });
    }
  }
  return results;
}

// 終わった週を、未処理のぶんだけ順に締める(日付が飛んでも追いつく。何度呼んでも二重に処理しない)。戻り値は処理した週数。
export function runHrmhrmWeekly() {
  ensureHrmhrmAccount();
  const current = getCurrentWeek();
  const to = current - 1;
  const pointers = listAccountIds().map((id) => getEntityAccount(id)?.processedWeek).filter((w) => typeof w === "number");
  let from = Math.min(...pointers) + 1;
  if (to < from) return 0;
  if (to - from + 1 > MAX_CATCH_UP_WEEKS) from = to - MAX_CATCH_UP_WEEKS + 1;

  for (let w = from; w <= to; w++) {
    for (const id of listAccountIds()) {
      const acct = getEntityAccount(id);
      if (!acct || acct.processedWeek >= w) continue;
      const record = id === HRMHRM_ID ? closeWeekFromLedger(acct, w) : emptyWeekRecord(w);
      runManagement(acct, record);
      finalizeWeek(acct, record);
      saveEntityAccount(acct);
    }
    processFundingRequests(w);
    runInterventionCheck(w);
  }
  return to - from + 1;
}

// ---- レポート ----
const fmt = (n) => Math.round(n).toLocaleString("en-US");

export function formatHrmhrmReport() {
  const acct = ensureHrmhrmAccount();
  const s = getBalanceSheet(acct);
  const last = acct.weekly[acct.weekly.length - 1];
  const lines = [
    `[HRMHRM] level x${getPriceLevel().toFixed(3)} / processed week ${acct.processedWeek}`,
    `資産 ${fmt(s.assets)}E = 現金 ${fmt(s.cash)} + 債権 ${fmt(s.receivables)} + 現物 ${fmt(s.holdingsValue)}(貴金属 ${fmt(s.preciousValue)})`,
    `負債 ${fmt(s.liabilities)}E / 純資産 ${fmt(s.equity)}E / 貴金属の割合 ${(s.preciousShare * 100).toFixed(1)}%` + (s.coverage === null ? "" : ` / 裏打ち ${s.coverage.toFixed(2)}倍`)
  ];
  const holdings = Object.entries(s.byKey).map(([k, v]) => `${k} ${fmt(v.units)}個 @${v.price.toFixed(2)}E`).join(", ");
  if (holdings) lines.push(`保有: ${holdings}`);
  if (last) lines.push(`直近の週(w${last.week}): 収益 ${fmt(last.revenue)} / 費用 ${fmt(last.expense)} / 損益 ${fmt(last.net)}` + (last.actions.length ? ` / 動き: ${last.actions.map((a) => a.type).join(",")}` : ""));
  const req = getPendingFundingRequests();
  if (req.length) lines.push(`資金の申請(審査待ち): ${req.map((r) => r.entityId + " " + fmt(r.amount) + " E / " + r.reason).join(", ")}`);
  const inter = getInterventions().filter((r) => r.status === "open");
  if (inter.length) lines.push(`介入案件: ${inter.map((r) => r.entityId + "(" + r.reason + ")").join(", ")}`);
  if (getTotalWriteOff() > 0) lines.push(`消えたお金(登録解除): ${fmt(getTotalWriteOff())}E`);
  return lines.join("\n");
}

export function startHrmhrm() {
  // 口座の作成は、スクリプトの読み込みが終わってから(読み込み中はワールドの動的プロパティに触れない)
  system.run(() => {
    try { ensureHrmhrmAccount(); } catch (e) { console.warn("[BeeMyHoney] hrmhrm init: " + e); }
  });
  system.runInterval(() => {
    try { runHrmhrmWeekly(); } catch (e) { console.warn("[BeeMyHoney] hrmhrm weekly: " + e); }
  }, 1200);
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:account") return;
    const arg = ev.message.trim();
    let text;
    if (arg === "" || arg === "hrmhrm") text = formatHrmhrmReport() + "\n" + formatDevBankReport();
    else if (arg === "list") text = "[Accounts] " + (listAccountIds().join(", ") || "(none)");
    else text = "usage: hrmhrm | list";
    const target = ev.sourceEntity;
    if (target && typeof target.sendMessage === "function") target.sendMessage(text);
    else console.warn("[BeeMyHoney] " + text);
  });
}
