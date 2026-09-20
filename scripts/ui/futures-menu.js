import { ActionFormData } from "@minecraft/server-ui";
import { world } from "@minecraft/server";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getCurrentCycleDay } from "../economy/market-engine.js";
import { getAccount } from "../economy/bank.js";
import { openMainMenu } from "./main-menu.js";

// ==========================================
// 花の先物契約メニュー UI / Flower Futures Menu
// ==========================================
export function openFuturesMenu(player) {
  const lang = getLang(player);
  const day = getCurrentCycleDay();
  const acc = getAccount(player);
  const absDay = world.getDay();
  const dueAbsDay = player.getDynamicProperty("futures_due_abs_day") ?? 0;
  const strikeRate = player.getDynamicProperty("futures_strike_price") ?? 0;
  const hasContract = dueAbsDay > 0;
  const dueDisplayDay = hasContract ? (dueAbsDay % 7) + 1 : 0;

  const statusLine = hasContract
    ? t(lang, STR.futuresActive, strikeRate, dueDisplayDay, day)
    : t(lang, STR.futuresNone);

  const form = new ActionFormData()
    .title(t(lang, STR.futuresTitle))
    .body(t(lang, STR.futuresBody, statusLine))
    .button(hasContract ? t(lang, STR.futuresSettle) : t(lang, STR.futuresOpen))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openMainMenu(player);
    if (!hasContract) {
      if (acc.emeralds >= 5) {
        player.setDynamicProperty("acc_emeralds", acc.emeralds - 5);
        const targetAbsDay = absDay + 2;
        const currentFlowerIndex = 15 + Math.floor(Math.random() * 10);
        player.setDynamicProperty("futures_due_abs_day", targetAbsDay);
        player.setDynamicProperty("futures_strike_price", currentFlowerIndex);
        player.sendMessage(t(lang, STR.futuresOpenMsg, currentFlowerIndex, (targetAbsDay % 7) + 1));
      } else {
        player.sendMessage(t(lang, STR.futuresMarginShortage));
      }
    } else {
      if (absDay >= dueAbsDay) {
        const settlementPrice = 5 + Math.floor(Math.random() * 30);
        const profit = (settlementPrice - strikeRate) * 2;
        player.setDynamicProperty("futures_due_abs_day", 0);
        player.setDynamicProperty("futures_strike_price", 0);

        const newBalance = acc.emeralds + profit;
        if (newBalance >= 0) {
          player.setDynamicProperty("acc_emeralds", newBalance);
          player.sendMessage(t(lang, STR.futuresSettleMsg, settlementPrice, strikeRate, profit));
        } else {
          player.setDynamicProperty("acc_emeralds", 0);
          triggerBeePenalty(player);
        }
      } else {
        player.sendMessage(t(lang, STR.futuresNotMatured, dueDisplayDay));
      }
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function triggerBeePenalty(player) {
  const lang = getLang(player);
  player.sendMessage(t(lang, STR.futuresDefault));
  const dim = player.dimension;
  const loc = player.location;

  // ハチに雇われた傭兵という設定でクモを2匹召喚
  for (let i = 0; i < 2; i++) {
    dim.spawnEntity("minecraft:spider", {
      x: loc.x + (Math.random() - 0.5) * 3,
      y: loc.y + 1,
      z: loc.z + (Math.random() - 0.5) * 3
    });
  }
}
