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

  const body = t(lang, STR.loanDeskBody, statusLabel, info.loanBalance, info.loanCount, info.loanOverdue);

  const form = new ActionFormData()
    .title(t(lang, STR.loanDeskTitle))
    .body(body)
    .button(t(lang, STR.loanBtnBorrow))
    .button(t(lang, STR.loanBtnLend))
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
    player.sendMessage(t(lang, STR.loanAlreadyBorrowing));
    return openLoanMenu(player);
  }

  const form = new ActionFormData()
    .title(t(lang, STR.loanBorrowPlanTitle));

  form.body(t(lang, STR.loanBorrowPlanBody));

  LOAN_TIERS.forEach((tier) => {
    form.button(t(lang, STR.loanTierBtn, tier.amount, tier.difficulty));
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === LOAN_TIERS.length) return openLoanMenu(player);
    const result = applyForLoan(player, res.selection);
    if (!result.approved) {
      const msg = result.reason === "score_too_low"
        ? t(lang, STR.loanDeniedScoreLow, result.score, result.need)
        : t(lang, STR.loanDeniedAlreadyActive);
      player.sendMessage(msg);
    } else {
      player.sendMessage(t(lang, STR.loanApprovedMsg, result.amount, result.weeklyPayment, result.weeks));
    }
    openLoanMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openLendMenu(player) {
  const lang = getLang(player);

  if (hasActiveLending(player)) {
    player.sendMessage(t(lang, STR.loanAlreadyLending));
    return openLoanMenu(player);
  }

  const candidates = generateBorrowerCandidates();
  const acc = getAccount(player);

  const form = new ActionFormData()
    .title(t(lang, STR.loanBorrowerListTitle))
    .body(t(lang, STR.loanBalanceBody, acc.emeralds));

  candidates.forEach((c) => {
    const line = t(lang, STR.loanCandidateLine, c.name, c.amount, c.weeks, Math.round(c.rate * 100), Math.round(c.repayProbability * 100));
    form.button(line);
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === candidates.length) return openLoanMenu(player);
    const chosen = candidates[res.selection];
    const result = lendToBorrower(player, chosen);
    if (!result.ok) {
      player.sendMessage(t(lang, STR.loanInsufficientFunds));
    } else {
      player.sendMessage(t(lang, STR.loanLentMsg, chosen.name, chosen.amount, chosen.weeks));
    }
    openLoanMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
