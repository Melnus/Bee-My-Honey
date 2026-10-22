import { world } from "@minecraft/server";
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
import {
  REQUEST_DAYS, playerTerms, postPlayerRequest, cancelRequest, findOwnRequest, listOpenRequests, fillRequest, lentLabel, deliverMail,
  borrowLimit, availableTiers
} from "../economy/loan-market.js";
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

const daysLeft = (req) => Math.max(1, req.day + REQUEST_DAYS - world.getDay());
const nameIn = (n, lang) => (typeof n === "string" ? n : (lang === "en" ? n.en || n.ja : n.ja || n.en));

// 借りる: 銀行(審査あり・即時) か 貸し手の募集(審査なし・依頼を掲示)
export function openBorrowMenu(player) {
  const lang = getLang(player);
  deliverMail(player);

  if (hasActiveLoan(player)) {
    player.sendMessage(t(lang, STR.loanAlreadyBorrowing));
    return openLoanMenu(player);
  }

  const own = findOwnRequest(player.id);
  const ownText = own ? t(lang, STR.loanBorrowTopOwn, own.amount, own.weeks, (own.rate * 100).toFixed(2), daysLeft(own)) : "";
  const form = new ActionFormData()
    .title(t(lang, STR.loanBorrowTopTitle))
    .body(t(lang, STR.loanBorrowTopBody, ownText))
    .button(t(lang, STR.loanBtnBank))
    .button(t(lang, STR.loanBtnPost));
  if (own) form.button(t(lang, STR.loanBtnCancelPost));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const backIndex = own ? 3 : 2;
    if (res.canceled || res.selection === backIndex) return openLoanMenu(player);
    if (res.selection === 0) return openBankBorrowMenu(player);
    if (res.selection === 1) return openPostRequestMenu(player);
    cancelRequest(player);
    player.sendMessage(t(lang, STR.loanPostCancelledMsg));
    openBorrowMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openPostRequestMenu(player) {
  const lang = getLang(player);
  const limit = borrowLimit(player);
  const tiers = availableTiers(player);
  if (tiers.length === 0) {
    player.sendMessage(t(lang, STR.loanPostNoAssets, limit, scaleEInt(LOAN_TIERS[0].amount)));
    return openBorrowMenu(player);
  }
  const form = new ActionFormData().title(t(lang, STR.loanPostTitle)).body(t(lang, STR.loanPostBody, limit));
  tiers.forEach((i) => {
    const tm = playerTerms(player, i);
    form.button(t(lang, STR.loanPostTierBtn, tm.amount, tm.weeks, (tm.rate * 100).toFixed(2), tm.weekly));
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === tiers.length) return openBorrowMenu(player);
    const r = postPlayerRequest(player, tiers[res.selection]);
    if (r.ok) player.sendMessage(t(lang, STR.loanPostedMsg, r.request.amount));
    else if (r.reason === "over_limit") player.sendMessage(t(lang, STR.loanPostOverLimit, r.limit));
    else player.sendMessage(t(lang, r.reason === "already_posted" ? STR.loanPostAlready : STR.loanDeniedAlreadyActive));
    openBorrowMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openBankBorrowMenu(player) {
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
    if (res.canceled || res.selection === LOAN_TIERS.length) return openBorrowMenu(player);
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

const MAX_LISTED_REQUESTS = 15;
const KIND_LABEL = { player: STR.loanKindPlayer, village: STR.loanKindVillage, company: STR.loanKindCompany };

// 貸す: 掲示中の依頼(個人・村・会社)を先に、窓口の融資希望者(NPC)をその下に並べる
export function openLendMenu(player) {
  const lang = getLang(player);
  deliverMail(player);

  if (hasActiveLending(player)) {
    player.sendMessage(t(lang, STR.loanAlreadyLending));
    return openLoanMenu(player);
  }

  const requests = listOpenRequests(player).slice(0, MAX_LISTED_REQUESTS);
  const candidates = generateBorrowerCandidates();
  const acc = getAccount(player);

  const form = new ActionFormData()
    .title(t(lang, STR.loanBorrowerListTitle))
    .body(t(lang, STR.loanLendListBody, acc.emeralds, requests.length));

  requests.forEach((r) => {
    form.button(t(lang, STR.loanRequestLine, t(lang, KIND_LABEL[r.kind] ?? STR.loanKindPlayer), nameIn(r.bname, lang), r.amount, r.weeks, (r.rate * 100).toFixed(2), Math.round(r.prob * 100), r.assets ?? null, daysLeft(r)));
  });
  candidates.forEach((c) => {
    form.button(t(lang, STR.loanRequestLine, t(lang, STR.loanKindNpc), c.name, c.amount, c.weeks, (c.rate * 100).toFixed(2), Math.round(c.repayProbability * 100), null, null));
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const total = requests.length + candidates.length;
    if (res.canceled || res.selection === total) return openLoanMenu(player);
    if (res.selection < requests.length) {
      const r = fillRequest(player, requests[res.selection].id);
      if (!r.ok) {
        if (r.reason === "over_lend_limit") { player.sendMessage(t(lang, STR.loanLendOverLimit, r.limit)); return openLoanMenu(player); }
        const key = { gone: STR.loanLendGone, borrower_offline: STR.loanLendBorrowerOffline, borrower_busy: STR.loanLendBorrowerBusy, already_lending: STR.loanAlreadyLending, insufficient_funds: STR.loanInsufficientFunds }[r.reason] ?? STR.loanLendGone;
        player.sendMessage(t(lang, key));
      } else {
        player.sendMessage(t(lang, STR.loanLentMarketMsg, nameIn(r.names, lang), r.terms.amount, r.terms.weeks, r.terms.weekly));
      }
      return openLoanMenu(player);
    }
    const chosen = candidates[res.selection - requests.length];
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
  deliverMail(player);
  const lines = [];

  const borrowing = hasActiveLoan(player);
  if (borrowing) {
    const { balance, principal, interest } = getLoanSplit(player);
    lines.push(t(
      lang, STR.loanManageBorrowLine,
      balance, principal, interest,
      player.getDynamicProperty("cr_loan_weekly_payment") ?? 0,
      player.getDynamicProperty("cr_loan_weeks_left") ?? 0
    ) + (player.getDynamicProperty("cr_loan_lender_name") ? "\n" + t(lang, STR.loanManageLender, player.getDynamicProperty("cr_loan_lender_name")) : ""));
  } else {
    lines.push(t(lang, STR.loanManageNoBorrow));
    const own = findOwnRequest(player.id);
    if (own) lines.push(t(lang, STR.loanManageOwnRequest, own.amount, own.weeks, daysLeft(own)));
  }

  if (hasActiveLending(player)) {
    lines.push(t(
      lang, STR.loanManageLendLine,
      player.getDynamicProperty("loan_lent_p2p") === 1 ? lentLabel(player, lang) : (player.getDynamicProperty("loan_lent_name") ?? ""),
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
