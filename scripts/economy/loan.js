import { world } from "@minecraft/server";
import { getAccount } from "./bank.js";
import { adjustCredit, getCreditScore, recordOverdue, clearOverdue } from "./credit.js";

// ==========================================
// ローン制度 / Loan System (借入・融資)
// 借入・融資ともに5段階の金額から選ぶ。難易度が高い(=高額)ほど
// 必要な信用スコアが上がり、金利も上がる。
// プレイヤーが借りるのは同時に1件まで、貸すのも同時に1件まで（シンプル化）。
// ==========================================
export const LOAN_TIERS = [
  { amount: 25, difficulty: 1 },
  { amount: 100, difficulty: 2 },
  { amount: 250, difficulty: 3 },
  { amount: 500, difficulty: 4 },
  { amount: 1000, difficulty: 5 }
];

// 審査に必要な最低スコア（難易度1〜5に対応）
function requiredScore(difficulty) {
  return 380 + difficulty * 40; // 難易度1:420 〜 難易度5:580
}

// 難易度・スコアから週利(%)を算出。スコアが高いほど優遇。
function weeklyInterestRate(difficulty, score) {
  const base = 0.03 + difficulty * 0.01; // 4%〜8%
  const discount = Math.max(0, (score - 600) / 100) * 0.01;
  return Math.max(0.02, base - discount);
}

// 難易度に応じた返済期間(週)
function termWeeks(difficulty) {
  return 4 + difficulty * 2; // 6〜14週
}

// ---------- 借入 (プレイヤー→銀行) ----------
export function hasActiveLoan(player) {
  return (player.getDynamicProperty("cr_loan_balance") ?? 0) > 0;
}

// tierIndex(0-4)の融資枠に申し込む。承認可否と条件をまとめて返す。
export function applyForLoan(player, tierIndex) {
  const tier = LOAN_TIERS[tierIndex];
  const score = getCreditScore(player);
  const need = requiredScore(tier.difficulty);

  if (hasActiveLoan(player)) {
    return { approved: false, reason: "already_active" };
  }
  if (score < need) {
    return { approved: false, reason: "score_too_low", need, score };
  }

  const rate = weeklyInterestRate(tier.difficulty, score);
  const weeks = termWeeks(tier.difficulty);
  const totalDue = Math.round(tier.amount * (1 + rate * weeks));
  const weeklyPayment = Math.ceil(totalDue / weeks);

  const acc = getAccount(player);
  player.setDynamicProperty("acc_emeralds", acc.emeralds + tier.amount);
  player.setDynamicProperty("cr_loan_balance", totalDue);
  player.setDynamicProperty("cr_loan_weekly_payment", weeklyPayment);
  player.setDynamicProperty("cr_loan_weeks_left", weeks);
  player.setDynamicProperty("cr_loan_count", (player.getDynamicProperty("cr_loan_count") ?? 0) + 1);
  clearOverdue(player);

  return { approved: true, amount: tier.amount, rate, weeks, weeklyPayment, totalDue };
}

// 週次の自動引き落とし。すべてのオンラインプレイヤーに対して呼ぶ。
export function applyLoanBilling() {
  for (const player of world.getPlayers()) {
    // 融資中(貸し手側)のポジションも同じ週次サイクルで満期を進める
    if (hasActiveLending(player)) {
      const result = tickLendingWeek(player);
      if (result) {
        const name = player.getDynamicProperty("loan_lent_name") ?? "";
        if (result.success) {
          player.sendMessage(`§a[融資] ${name}が完済しました。元本+利子 ${result.totalReturn}E を受け取りました。`);
        } else {
          player.sendMessage(`§c[融資] ${name}がデフォルトしました。回収できたのは ${result.partial}E のみです。`);
        }
      }
    }

    if (!hasActiveLoan(player)) continue;

    const acc = getAccount(player);
    const payment = player.getDynamicProperty("cr_loan_weekly_payment") ?? 0;
    const balance = player.getDynamicProperty("cr_loan_balance") ?? 0;
    const pay = Math.min(payment, balance);

    if (acc.emeralds >= pay) {
      player.setDynamicProperty("acc_emeralds", acc.emeralds - pay);
      const newBalance = balance - pay;
      const weeksLeft = Math.max(0, (player.getDynamicProperty("cr_loan_weeks_left") ?? 1) - 1);
      player.setDynamicProperty("cr_loan_balance", newBalance);
      player.setDynamicProperty("cr_loan_weeks_left", weeksLeft);

      if (newBalance <= 0 || weeksLeft <= 0) {
        finishLoan(player, newBalance <= 0);
      } else {
        clearOverdue(player);
      }
      player.sendMessage(`§a[ローン] 今週分 ${pay}E を返済しました。残高: ${Math.max(0, newBalance)}E`);
    } else {
      recordOverdue(player);
      player.sendMessage(`§c[ローン] 残高不足で返済できませんでした。信用情報に延滞が記録されました。`);
      const overdueStreak = player.getDynamicProperty("cr_loan_overdue_streak") ?? 0;
      const streak = overdueStreak + 1;
      player.setDynamicProperty("cr_loan_overdue_streak", streak);
      if (streak >= 4) {
        defaultLoan(player);
      }
    }
  }
}

function finishLoan(player, paidOff) {
  player.setDynamicProperty("cr_loan_balance", 0);
  player.setDynamicProperty("cr_loan_weekly_payment", 0);
  player.setDynamicProperty("cr_loan_weeks_left", 0);
  player.setDynamicProperty("cr_loan_overdue_streak", 0);
  clearOverdue(player);
  if (paidOff) {
    player.setDynamicProperty("cr_loan_paid_count", (player.getDynamicProperty("cr_loan_paid_count") ?? 0) + 1);
    adjustCredit(player, "loanPaidOff");
    player.sendMessage(`§a[ローン] 完済しました！信用情報が改善しました。`);
  }
}

function defaultLoan(player) {
  player.setDynamicProperty("cr_default", true);
  player.setDynamicProperty("cr_loan_overdue_streak", 0);
  adjustCredit(player, "default");
  finishLoan(player, false);
  player.sendMessage(`§4§l[債務不履行]§r §c長期延滞によりローンが強制的に打ち切られました。`);
}

// ---------- 融資 (プレイヤー→NPC借り手) ----------
const BORROWER_NAMES_JA = ["カメ吉", "ウサ子", "ヒツジ丸", "ブタ助", "ネコ美"];

export function generateBorrowerCandidates() {
  const candidates = [];
  for (let i = 0; i < 5; i++) {
    const tier = LOAN_TIERS[Math.floor(Math.random() * LOAN_TIERS.length)];
    const score = 350 + Math.floor(Math.random() * 450); // 350〜800のランダム信用力
    const weeks = termWeeks(tier.difficulty);
    const rate = weeklyInterestRate(tier.difficulty, score);
    // スコアが高いほど返済確率が上がる（0.4〜0.97の範囲）
    const repayProbability = Math.min(0.97, Math.max(0.4, (score - 300) / 550));
    candidates.push({
      name: BORROWER_NAMES_JA[i],
      amount: tier.amount,
      weeks,
      rate,
      score,
      repayProbability
    });
  }
  return candidates;
}

export function hasActiveLending(player) {
  return (player.getDynamicProperty("loan_lent_active") ?? 0) === 1;
}

export function lendToBorrower(player, candidate) {
  const acc = getAccount(player);
  if (acc.emeralds < candidate.amount) return { ok: false, reason: "insufficient_funds" };
  if (hasActiveLending(player)) return { ok: false, reason: "already_lending" };

  player.setDynamicProperty("acc_emeralds", acc.emeralds - candidate.amount);
  player.setDynamicProperty("loan_lent_active", 1);
  player.setDynamicProperty("loan_lent_amount", candidate.amount);
  player.setDynamicProperty("loan_lent_weeks_left", candidate.weeks);
  player.setDynamicProperty("loan_lent_rate", candidate.rate);
  player.setDynamicProperty("loan_lent_prob", Math.round(candidate.repayProbability * 100));
  player.setDynamicProperty("loan_lent_name", candidate.name);
  return { ok: true };
}

// 融資の満期処理は週次サイクルの中で融資中プレイヤーのみ個別に進める（UIから呼び出す想定）。
// 満期に達したら resolveLending() を呼んで結果を確定させる。
export function tickLendingWeek(player) {
  if (!hasActiveLending(player)) return null;
  const weeksLeft = Math.max(0, (player.getDynamicProperty("loan_lent_weeks_left") ?? 1) - 1);
  player.setDynamicProperty("loan_lent_weeks_left", weeksLeft);
  if (weeksLeft <= 0) return resolveLending(player);
  return null;
}

export function resolveLending(player) {
  const amount = player.getDynamicProperty("loan_lent_amount") ?? 0;
  const rate = player.getDynamicProperty("loan_lent_rate") ?? 0;
  const weeks = 1;
  const probPercent = player.getDynamicProperty("loan_lent_prob") ?? 50;
  const success = Math.random() * 100 < probPercent;

  const acc = getAccount(player);
  let result;
  if (success) {
    const totalReturn = Math.round(amount * (1 + rate * weeks * 4)); // 簡易利息還元
    player.setDynamicProperty("acc_emeralds", acc.emeralds + totalReturn);
    result = { success: true, amount, totalReturn };
  } else {
    // デフォルト: 元本の一部(30%)のみ回収
    const partial = Math.round(amount * 0.3);
    player.setDynamicProperty("acc_emeralds", acc.emeralds + partial);
    result = { success: false, amount, partial };
  }

  player.setDynamicProperty("loan_lent_active", 0);
  player.setDynamicProperty("loan_lent_amount", 0);
  player.setDynamicProperty("loan_lent_weeks_left", 0);
  return result;
}
