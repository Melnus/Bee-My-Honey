import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import { getCreditInfo, getCreditStatusLabel } from "../economy/credit.js";
import {
  LOAN_TIERS, hasActiveLoan, applyForLoan,
  hasActiveLending, generateBorrowerCandidates, lendToBorrower
} from "../economy/loan.js";
import { openBankingMenu } from "./bank-menu.js";

// ==========================================
// ローンメニュー UI / Loan Menu (借入・融資)
// ==========================================
export function openLoanMenu(player) {
  const lang = getLang(player);
  const info = getCreditInfo(player);
  const statusLabel = getCreditStatusLabel(player, lang);

  const body = lang === "ja"
    ? `信用状態: ${statusLabel}\n借入残高: ${info.loanBalance}E / 契約件数: ${info.loanCount}件\n延滞: ${info.loanOverdue ? "あり" : "なし"}`
    : `Credit: ${statusLabel}\nLoan Balance: ${info.loanBalance}E / Contracts: ${info.loanCount}\nOverdue: ${info.loanOverdue ? "Yes" : "No"}`;

  const form = new ActionFormData()
    .title(lang === "ja" ? "ローン窓口" : "Loan Desk")
    .body(body)
    .button(lang === "ja" ? "借りる" : "Borrow")
    .button(lang === "ja" ? "貸す" : "Lend")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openBankingMenu(player);
    if (res.selection === 0) return openBorrowMenu(player);
    if (res.selection === 1) return openLendMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openBorrowMenu(player) {
  const lang = getLang(player);

  if (hasActiveLoan(player)) {
    player.sendMessage(lang === "ja" ? "§c既に返済中のローンがあります。" : "§cYou already have an active loan.");
    return openLoanMenu(player);
  }

  const form = new ActionFormData()
    .title(lang === "ja" ? "借入プラン選択" : "Choose a Loan Plan");

  let body = lang === "ja" ? "難易度が高いほど必要な信用スコアと金利が上がります。\n" : "Higher difficulty needs higher credit score and interest.\n";
  form.body(body);

  LOAN_TIERS.forEach((tier) => {
    form.button(lang === "ja" ? `${tier.amount}E (難易度${tier.difficulty})` : `${tier.amount}E (Difficulty ${tier.difficulty})`);
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === LOAN_TIERS.length) return openLoanMenu(player);
    const result = applyForLoan(player, res.selection);
    if (!result.approved) {
      const msg = result.reason === "score_too_low"
        ? (lang === "ja" ? `§c審査に落ちました(信用スコア${result.score} / 必要${result.need})` : `§cApplication denied (score ${result.score} / needs ${result.need})`)
        : (lang === "ja" ? "§c既にローンを利用中です。" : "§cYou already have an active loan.");
      player.sendMessage(msg);
    } else {
      player.sendMessage(
        lang === "ja"
          ? `§a審査通過！${result.amount}Eを借り入れました。週${result.weeklyPayment}E×${result.weeks}週で返済してください。`
          : `§aApproved! Borrowed ${result.amount}E. Repay ${result.weeklyPayment}E/week for ${result.weeks} weeks.`
      );
    }
    openLoanMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openLendMenu(player) {
  const lang = getLang(player);

  if (hasActiveLending(player)) {
    player.sendMessage(lang === "ja" ? "§c既に貸し付け中です。完済または回収されるまでお待ちください。" : "§cYou already have an active loan out.");
    return openLoanMenu(player);
  }

  const candidates = generateBorrowerCandidates();
  const acc = getAccount(player);

  const form = new ActionFormData()
    .title(lang === "ja" ? "融資希望者一覧" : "Borrower Candidates")
    .body(lang === "ja" ? `所持: ${acc.emeralds}E` : `Balance: ${acc.emeralds}E`);

  candidates.forEach((c) => {
    const line = lang === "ja"
      ? `${c.name} - 希望額${c.amount}E / ${c.weeks}週 / 金利${Math.round(c.rate * 100)}% / 返済見込${Math.round(c.repayProbability * 100)}%`
      : `${c.name} - ${c.amount}E / ${c.weeks}w / ${Math.round(c.rate * 100)}% / ${Math.round(c.repayProbability * 100)}% likely`;
    form.button(line);
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === candidates.length) return openLoanMenu(player);
    const chosen = candidates[res.selection];
    const result = lendToBorrower(player, chosen);
    if (!result.ok) {
      player.sendMessage(lang === "ja" ? "§c資金が足りません。" : "§cInsufficient funds.");
    } else {
      player.sendMessage(
        lang === "ja"
          ? `§a${chosen.name}に${chosen.amount}Eを貸し付けました。${chosen.weeks}週後に結果がわかります。`
          : `§aLent ${chosen.amount}E to ${chosen.name}. Result in ${chosen.weeks} weeks.`
      );
    }
    openLoanMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
