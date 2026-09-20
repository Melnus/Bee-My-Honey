import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { CURRENCIES, CURRENCY_ICONS } from "../data/market-data.js";
import { getCurrencyRate, getCurrentCycleDay, getWeekCurrencyRates, buildSparkline, buildIconWaveChart } from "../economy/market-engine.js";
import { getAccount } from "../economy/bank.js";
import { QTY_STEP_DELTAS } from "./shared.js";
import { openMainMenu } from "./main-menu.js";

// ==========================================
// 外貨為替市場メニュー UI / Forex Menu
// ==========================================
export function openForexMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const form = new ActionFormData()
    .title(t(lang, STR.forexTitle))
    .body(t(lang, STR.forexBody, acc.emeralds));

  for (const [key, val] of Object.entries(CURRENCIES)) {
    const rate = getCurrencyRate(key);
    const hold = acc[key];
    const buyRate = player.getDynamicProperty(`acc_rate_${key}`) ?? rate;

    let diffText = t(lang, STR.none);
    if (hold > 0) {
      const diff = parseFloat((rate - buyRate).toFixed(1));
      diffText = diff > 0 ? `§a[+${diff}▲]` : diff < 0 ? `§c[${diff}▼]` : `[±0]`;
    }
    const spark = buildSparkline(getWeekCurrencyRates(key));
    form.button(`${t(lang, val.name)}\n${t(lang, STR.forexButtonLine, rate, hold, diffText)}\n${spark}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection >= Object.keys(CURRENCIES).length) return openMainMenu(player);
    openForexTradeDialog(player, Object.keys(CURRENCIES)[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openForexTradeDialog(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const acc = getAccount(player);
  const hold = acc[currKey];
  const buyRate = player.getDynamicProperty(`acc_rate_${currKey}`) ?? 0;
  const day = getCurrentCycleDay();
  const waveChart = buildIconWaveChart(CURRENCY_ICONS[currKey], getWeekCurrencyRates(currKey), day);

  const form = new ActionFormData()
    .title(t(lang, c.name))
    .body(
      t(lang, STR.forexTradeBody, t(lang, c.desc), rate, hold, buyRate, acc.emeralds) +
      `\n\n${t(lang, STR.waveChartLabel)}\n${waveChart}`
    )
    .button(t(lang, STR.forexBuyBtn))
    .button(t(lang, STR.forexSellBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openForexMenu(player);
    if (res.selection === 0) openForexBuyModal(player, currKey);
    else if (res.selection === 1) openForexSellModal(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openForexBuyModal(player, currKey, qty = 1) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const acc = getAccount(player);
  const maxUnits = Math.floor(acc.emeralds / rate);

  if (maxUnits < 1) {
    player.sendMessage(t(lang, STR.forexNoFunds));
    return openForexTradeDialog(player, currKey);
  }

  qty = Math.max(1, Math.min(qty, maxUnits));
  const unitCost = Math.round(rate * 10) / 10;
  const cost = Math.round(rate * qty);

  const form = new ActionFormData()
    .title(t(lang, STR.forexBuyModalTitle, t(lang, c.name)))
    .body(t(lang, STR.qtyStepBuyBody, t(lang, c.name), qty, unitCost, cost, maxUnits, acc.emeralds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmBuy))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openForexTradeDialog(player, currKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], maxUnits));
      return openForexBuyModal(player, currKey, newQty);
    }
    const accNow = getAccount(player);
    const holdNow = accNow[currKey];
    const finalCost = Math.round(rate * qty);

    if (accNow.emeralds >= finalCost) {
      const prevRate = player.getDynamicProperty(`acc_rate_${currKey}`) ?? rate;
      const newAvgRate = holdNow > 0 ? (prevRate * holdNow + rate * qty) / (holdNow + qty) : rate;
      player.setDynamicProperty("acc_emeralds", accNow.emeralds - finalCost);
      player.setDynamicProperty(`acc_curr_${currKey}`, holdNow + qty);
      player.setDynamicProperty(`acc_rate_${currKey}`, parseFloat(newAvgRate.toFixed(2)));
      player.sendMessage(t(lang, STR.forexBuyMsg, t(lang, c.name), qty, finalCost));
    } else {
      player.sendMessage(t(lang, STR.bankAccShortage));
    }
    openForexTradeDialog(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openForexSellModal(player, currKey, qty = 1) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const acc = getAccount(player);
  const hold = acc[currKey];
  const buyRate = player.getDynamicProperty(`acc_rate_${currKey}`) ?? rate;

  if (hold < 1) {
    player.sendMessage(t(lang, STR.forexSellShortage));
    return openForexTradeDialog(player, currKey);
  }

  qty = Math.max(1, Math.min(qty, hold));
  const unitCost = Math.round(rate * 10) / 10;
  const gain = Math.round(rate * qty);

  const form = new ActionFormData()
    .title(t(lang, STR.forexSellModalTitle, t(lang, c.name)))
    .body(t(lang, STR.qtyStepSellBody, t(lang, c.name), qty, unitCost, gain, hold, hold))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmSell))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openForexTradeDialog(player, currKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], hold));
      return openForexSellModal(player, currKey, newQty);
    }
    const accNow = getAccount(player);
    const holdNow = accNow[currKey];
    if (holdNow >= qty) {
      const finalGain = Math.round(rate * qty);
      const pnl = Math.round((rate - buyRate) * qty);
      player.setDynamicProperty("acc_emeralds", accNow.emeralds + finalGain);
      player.setDynamicProperty(`acc_curr_${currKey}`, holdNow - qty);
      player.sendMessage(t(lang, STR.forexSellMsg, t(lang, c.name), qty, pnl));
    } else {
      player.sendMessage(t(lang, STR.forexSellShortage));
    }
    openForexTradeDialog(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
