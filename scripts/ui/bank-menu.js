import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { BANK_INTEREST_RATE, getAccount, getItemCountWithBlocks, removeItemWithBlocks, giveItem } from "../economy/bank.js";
import { QTY_STEP_DELTAS } from "./shared.js";
import { openMainMenu } from "./main-menu.js";
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
    .body(t(lang, STR.bankBody, acc.emeralds, invEmeralds, (BANK_INTEREST_RATE * 100).toFixed(1)))
    .button(t(lang, STR.bankDepositBtn))
    .button(t(lang, STR.bankWithdrawBtn))
    .button(lang === "ja" ? "ローン窓口" : "Loan Desk")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openMainMenu(player);
    if (res.selection === 0) openBankDepositModal(player);
    else if (res.selection === 1) openBankWithdrawModal(player);
    else if (res.selection === 2) openLoanMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 株の売買と同じ「数量を±で調整してから確定する」方式の預け入れ画面（文言は銀行のまま）
export function openBankDepositModal(player, qty = 10) {
  const lang = getLang(player);
  const invEmeralds = getItemCountWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID);

  if (invEmeralds < 1) {
    player.sendMessage(t(lang, STR.bankInvShortage));
    return openBankingMenu(player);
  }

  qty = Math.max(1, Math.min(qty, invEmeralds));

  const form = new ActionFormData()
    .title(t(lang, STR.bankDepositModalTitle))
    .body(t(lang, STR.bankDepositStepBody, qty, invEmeralds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.bankConfirmDeposit))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openBankingMenu(player);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], invEmeralds));
      return openBankDepositModal(player, newQty);
    }
    const invNow = getItemCountWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID);
    const acc = getAccount(player);
    if (invNow >= qty) {
      removeItemWithBlocks(player, EMERALD_ID, EMERALD_BLOCK_ID, qty);
      player.setDynamicProperty("acc_emeralds", acc.emeralds + qty);
      player.sendMessage(t(lang, STR.bankDepositMsg, qty));
    } else {
      player.sendMessage(t(lang, STR.bankInvShortage));
    }
    openBankingMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 株の売買と同じ「数量を±で調整してから確定する」方式の引き出し画面（文言は銀行のまま）
export function openBankWithdrawModal(player, qty = 10) {
  const lang = getLang(player);
  const acc = getAccount(player);

  if (acc.emeralds < 1) {
    player.sendMessage(t(lang, STR.bankAccShortage));
    return openBankingMenu(player);
  }

  qty = Math.max(1, Math.min(qty, acc.emeralds));

  const form = new ActionFormData()
    .title(t(lang, STR.bankWithdrawModalTitle))
    .body(t(lang, STR.bankWithdrawStepBody, qty, acc.emeralds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.bankConfirmWithdraw))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openBankingMenu(player);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], acc.emeralds));
      return openBankWithdrawModal(player, newQty);
    }
    const accNow = getAccount(player);
    if (accNow.emeralds >= qty) {
      player.setDynamicProperty("acc_emeralds", accNow.emeralds - qty);
      giveItem(player, EMERALD_ID, qty);
      player.sendMessage(t(lang, STR.bankWithdrawMsg, qty));
    } else {
      player.sendMessage(t(lang, STR.bankAccShortage));
    }
    openBankingMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
