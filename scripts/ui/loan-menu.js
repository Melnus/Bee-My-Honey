import { scaleEInt } from "../economy/price-level.js";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import { getCreditInfo, getCreditStatusLabel } from "../economy/credit.js";
import {
  LOAN_TIERS, hasActiveLoan, applyForLoan, getLoanSplit, repayLoanEarly,
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
    .button(t(lang, STR.loanBtnManage))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openBankingMenu(player);
    if (res.selection === 0) return openBorrowMenu(player);
    if (res.selection === 1) return openLendMenu(player);
    if (res.selection === 2) return openLoanManageMenu(player);
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
    form.button(t(lang, STR.loanTierBtn, scaleEInt(tier.amount), tier.difficulty));
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
    const line = t(lang, STR.loanCandidateLine, c.name, c.amount, c.weeks, (c.rate * 100).toFixed(2), Math.round(c.repayProbability * 100));
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

// ==========================================
// 融資管理 / Loan Management (借入の確認・繰上返済・貸付の確認)
// ==========================================
export function openLoanManageMenu(player) {
  const lang = getLang(player);
  const lines = [];

  const borrowing = hasActiveLoan(player);
  if (borrowing) {
    const { balance, principal, interest } = getLoanSplit(player);
    lines.push(t(
      lang, STR.loanManageBorrowLine,
      balance, principal, interest,
      player.getDynamicProperty("cr_loan_weekly_payment") ?? 0,
      player.getDynamicProperty("cr_loan_weeks_left") ?? 0
    ));
  } else {
    lines.push(t(lang, STR.loanManageNoBorrow));
  }

  if (hasActiveLending(player)) {
    lines.push(t(
      lang, STR.loanManageLendLine,
      player.getDynamicProperty("loan_lent_name") ?? "",
      player.getDynamicProperty("loan_lent_amount") ?? 0,
      player.getDynamicProperty("loan_lent_weeks_left") ?? 0
    ));
  } else {
    lines.push(t(lang, STR.loanManageNoLend));
  }

  const form = new ActionFormData()
    .title(t(lang, STR.loanManageTitle))
    .body(lines.join("\n\n"));
  if (borrowing) form.button(t(lang, STR.loanBtnRepay));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const backIndex = borrowing ? 1 : 0;
    if (res.canceled || res.selection === backIndex) return openLoanMenu(player);
    return openRepayMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openRepayMenu(player) {
  const lang = getLang(player);
  if (!hasActiveLoan(player)) return openLoanManageMenu(player);

  const { balance, principal } = getLoanSplit(player);
  const acc = getAccount(player);

  // 利息がまだ残っていない(元本=残高)ローンでは、トグルを切り替えても結果は同じ。
  const form = new ModalFormData()
    .title(t(lang, STR.loanRepayTitle))
    .toggle(t(lang, STR.loanRepayToggle, principal, balance, acc.emeralds), { defaultValue: false });

  form.show(player).then((res) => {
    if (res.canceled) return openLoanManageMenu(player);
    const includeInterest = !!res.formValues[0];
    const result = repayLoanEarly(player, includeInterest);
    if (!result.ok) {
      if (result.reason === "insufficient_funds") {
        player.sendMessage(t(lang, STR.loanRepayShort, result.need, result.shortage));
      }
    } else if (result.closed) {
      player.sendMessage(t(lang, STR.loanRepayClosedMsg, result.paid));
    } else {
      player.sendMessage(t(lang, STR.loanRepayPartialMsg, result.paid, result.balance));
    }
    openLoanManageMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
