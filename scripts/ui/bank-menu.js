import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { BANK_INTEREST_RATE, getAccount, getItemCount, removeItem, giveItem } from "../economy/bank.js";
import { openMainMenu } from "./main-menu.js";

// ==========================================
// 口座管理メニュー UI / Bank Menu
// ==========================================
export function openBankingMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const invEmeralds = getItemCount(player, "minecraft:emerald");

  const form = new ActionFormData()
    .title(t(lang, STR.bankTitle))
    .body(t(lang, STR.bankBody, acc.emeralds, invEmeralds, (BANK_INTEREST_RATE * 100).toFixed(1)))
    .button(t(lang, STR.bankDeposit10))
    .button(t(lang, STR.bankDepositAll))
    .button(t(lang, STR.bankWithdraw10))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openMainMenu(player);
    if (res.selection === 0) {
      if (invEmeralds >= 10) {
        removeItem(player, "minecraft:emerald", 10);
        player.setDynamicProperty("acc_emeralds", acc.emeralds + 10);
        player.sendMessage(t(lang, STR.bankDepositMsg, 10));
      } else player.sendMessage(t(lang, STR.bankInvShortage));
    } else if (res.selection === 1) {
      if (invEmeralds > 0) {
        removeItem(player, "minecraft:emerald", invEmeralds);
        player.setDynamicProperty("acc_emeralds", acc.emeralds + invEmeralds);
        player.sendMessage(t(lang, STR.bankDepositMsg, invEmeralds));
      } else player.sendMessage(t(lang, STR.bankInvShortage));
    } else if (res.selection === 2) {
      if (acc.emeralds >= 10) {
        player.setDynamicProperty("acc_emeralds", acc.emeralds - 10);
        giveItem(player, "minecraft:emerald", 10);
        player.sendMessage(t(lang, STR.bankWithdrawMsg, 10));
      } else player.sendMessage(t(lang, STR.bankAccShortage));
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
