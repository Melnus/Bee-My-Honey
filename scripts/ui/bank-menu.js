import { creditEmeralds, debitEmeralds, FLOW, getAccountHistory } from "../economy/ledger.js";
import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getDepositRate, MAX_EMERALD_TX, getAccount, getItemCountWithBlocks, removeItemWithBlocks, giveItem } from "../economy/bank.js";
import { promptQuantity } from "./shared.js";
import { openTradingMenu } from "./trading-menu.js";
import { openLoanMenu } from "./loan-menu.js";

const EMERALD_ID = "minecraft:emerald";
const EMERALD_BLOCK_ID = "minecraft:emerald_block";

// ==========================================
// 口座管理メニュー UI / Bank Menu
// ==========================================
export function openBankingMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const invEmeralds = getItemCountWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID);

  const form = new ActionFormData()
    .title(t(lang, STR.bankTitle))
    .body(t(lang, STR.bankBody, acc.emeralds, invEmeralds, (getDepositRate() * 100).toFixed(2)))
    .button(t(lang, STR.bankDepositBtn))
    .button(t(lang, STR.bankWithdrawBtn))
    .button(t(lang, STR.bankLoanDeskBtn))
    .button(t(lang, STR.bankHistoryBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 4) return openTradingMenu(player);
    if (res.selection === 0) openBankDepositModal(player);
    else if (res.selection === 1) openBankWithdrawModal(player);
    else if (res.selection === 2) openLoanMenu(player);
    else if (res.selection === 3) openBankHistoryMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 株の売買と同じ「数量を±で調整してから確定する」方式の預け入れ画面（文言は銀行のまま）
export function openBankDepositModal(player, qty = null) {
  const lang = getLang(player);
  const invEmeralds = getItemCountWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID);

  if (invEmeralds < 1) {
    player.sendMessage(t(lang, STR.bankInvShortage));
    return openBankingMenu(player);
  }

  if (qty === null) {
    return promptQuantity(player, {
      title: t(lang, STR.bankDepositModalTitle),
      max: invEmeralds,
      onSubmit: (q) => openBankDepositModal(player, q),
      onBack: () => openBankingMenu(player)
    });
  }
  qty = Math.max(1, Math.min(qty, invEmeralds));

  const form = new ActionFormData()
    .title(t(lang, STR.bankDepositModalTitle))
    .body(t(lang, STR.bankDepositStepBody, qty, invEmeralds))
    .button(t(lang, STR.bankConfirmDeposit))
    .button(t(lang, STR.qtyEnter))
    .button(t(lang, STR.qtyAll))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openBankingMenu(player);
    if (res.selection === 1) return openBankDepositModal(player, null);
    if (res.selection === 2) return openBankDepositModal(player, invEmeralds);
    const invNow = getItemCountWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID);
    const acc = getAccount(player);
    if (invNow >= qty) {
      removeItemWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID, qty);
      creditEmeralds(player, qty, FLOW.DEPOSIT);
      player.sendMessage(t(lang, STR.bankDepositMsg, qty));
    } else {
      player.sendMessage(t(lang, STR.bankInvShortage));
    }
    openBankingMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 株の売買と同じ「数量を±で調整してから確定する」方式の引き出し画面（文言は銀行のまま）
export function openBankWithdrawModal(player, qty = null) {
  const lang = getLang(player);
  const acc = getAccount(player);

  if (acc.emeralds < 1) {
    player.sendMessage(t(lang, STR.bankAccShortage));
    return openBankingMenu(player);
  }

  const withdrawCap = Math.min(acc.emeralds, MAX_EMERALD_TX);
  if (qty === null) {
    return promptQuantity(player, {
      title: t(lang, STR.bankWithdrawModalTitle),
      max: withdrawCap,
      onSubmit: (q) => openBankWithdrawModal(player, q),
      onBack: () => openBankingMenu(player)
    });
  }
  qty = Math.max(1, Math.min(qty, withdrawCap));

  const form = new ActionFormData()
    .title(t(lang, STR.bankWithdrawModalTitle))
    .body(t(lang, STR.bankWithdrawStepBody, qty, acc.emeralds))
    .button(t(lang, STR.bankConfirmWithdraw))
    .button(t(lang, STR.qtyEnter))
    .button(t(lang, STR.qtyAll))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openBankingMenu(player);
    if (res.selection === 1) return openBankWithdrawModal(player, null);
    if (res.selection === 2) return openBankWithdrawModal(player, withdrawCap);
    const accNow = getAccount(player);
    if (accNow.emeralds >= qty) {
      debitEmeralds(player, qty, FLOW.WITHDRAW);
      giveItem(player, EMERALD_ID, qty);
      player.sendMessage(t(lang, STR.bankWithdrawMsg, qty));
    } else {
      player.sendMessage(t(lang, STR.bankAccShortage));
    }
    openBankingMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ==========================================
// 入出金履歴 / Account History (直近の入出金。新しい順)
// ==========================================
export function openBankHistoryMenu(player) {
  const lang = getLang(player);
  const list = getAccountHistory(player);

  const lines = list.map((e) => {
    const label = t(lang, STR.historyFlow[e.c] ?? STR.historyFlowUnknown);
    const party = e.p ? t(lang, e.w === "in" ? STR.historyFrom : STR.historyTo, e.p) : "";
    return t(lang, STR.historyLine, e.w === "in", e.a, e.d, label + party);
  });

  const form = new ActionFormData()
    .title(t(lang, STR.historyTitle))
    .body(lines.length > 0 ? lines.join("\n") : t(lang, STR.historyEmpty))
    .button(t(lang, STR.back));

  form.show(player).then(() => openBankingMenu(player))
    .catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
