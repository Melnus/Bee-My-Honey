import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { STOCKS, STOCK_ICONS } from "../data/market-data.js";
import { getStockPrice, getCurrentCycleDay, getWeekStockPrices, buildSparkline, buildIconWaveChart, applyTrade } from "../economy/market-engine.js";
import { getAccount } from "../economy/bank.js";
import { DIVIDEND_THRESHOLD, getDividendEligibility, claimDividend } from "../economy/dividends.js";
import { HRMHRM_STOCK_OPTION_THRESHOLD } from "../economy/labor.js";
import { QTY_STEP_DELTAS } from "./shared.js";
import { openTradingMenu } from "./trading-menu.js";

// ==========================================
// 株式市場メニュー UI / Stock Market Menu
// ==========================================
export function openStockMarketMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const form = new ActionFormData()
    .title(t(lang, STR.stockTitle))
    .body(t(lang, STR.stockBody, acc.emeralds));

  for (const [key, val] of Object.entries(STOCKS)) {
    const price = getStockPrice(key);
    const holds = player.getDynamicProperty(`acc_stock_${key}`) ?? 0;
    const bought = player.getDynamicProperty(`acc_stock_bought_${key}`) ?? 0;
    let pnlText = t(lang, STR.none);
    if (holds > 0) {
      const diff = price - bought;
      pnlText = diff > 0 ? `§a[+${diff}▲]` : diff < 0 ? `§c[${diff}▼]` : `[±0]`;
    }
    const spark = buildSparkline(getWeekStockPrices(key));
    form.button(`${t(lang, val.name)}\n${t(lang, STR.stockButtonLine, price, holds, pnlText)}\n${spark}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection >= Object.keys(STOCKS).length) return openTradingMenu(player);
    openStockTradeDialog(player, Object.keys(STOCKS)[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openStockTradeDialog(player, stockKey) {
  const lang = getLang(player);
  const s = STOCKS[stockKey];
  const price = getStockPrice(stockKey);
  const acc = getAccount(player);
  const holds = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
  const bought = player.getDynamicProperty(`acc_stock_bought_${stockKey}`) ?? 0;
  const day = getCurrentCycleDay();
  const waveChart = buildIconWaveChart(STOCK_ICONS[stockKey], getWeekStockPrices(stockKey), day);

  const divInfo = getDividendEligibility(player, stockKey);
  const isStockOption = s.dividendType === "stock_option";
  let divLabel = isStockOption
    ? t(lang, STR.stockOptionDivLabel)
    : !divInfo.eligible
    ? t(lang, STR.divBtnLocked, DIVIDEND_THRESHOLD)
    : divInfo.alreadyClaimedToday
    ? t(lang, STR.divBtnDoneToday)
    : t(lang, STR.divBtnReady);

  const form = new ActionFormData()
    .title(t(lang, s.name))
    .body(
      t(lang, STR.stockTradeBody, t(lang, s.desc), price, holds, bought, acc.emeralds) +
      `\n\n${t(lang, STR.waveChartLabel)}\n${waveChart}`
    )
    .button(t(lang, STR.stockBuyBtn))
    .button(t(lang, STR.stockSellBtn))
    .button(divLabel)
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openStockMarketMenu(player);
    if (res.selection === 0) openStockBuyModal(player, stockKey);
    else if (res.selection === 1) openStockSellModal(player, stockKey);
    else if (res.selection === 2) {
      if (isStockOption) {
        player.sendMessage(t(lang, STR.stockOptionDivInfo, HRMHRM_STOCK_OPTION_THRESHOLD));
        return openStockTradeDialog(player, stockKey);
      }
      claimDividend(player, stockKey);
      openStockTradeDialog(player, stockKey);
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openStockBuyModal(player, stockKey, qty = 1) {
  const lang = getLang(player);
  const s = STOCKS[stockKey];
  const price = getStockPrice(stockKey);
  const acc = getAccount(player);
  const maxShares = Math.floor(acc.emeralds / price);

  if (maxShares < 1) {
    player.sendMessage(t(lang, STR.stockNoFunds));
    return openStockTradeDialog(player, stockKey);
  }

  qty = Math.max(1, Math.min(qty, maxShares));
  const cost = price * qty;

  const form = new ActionFormData()
    .title(t(lang, STR.stockBuyModalTitle, t(lang, s.name)))
    .body(t(lang, STR.qtyStepBuyBody, t(lang, s.name), qty, price, cost, maxShares, acc.emeralds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmBuy))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openStockTradeDialog(player, stockKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], maxShares));
      return openStockBuyModal(player, stockKey, newQty);
    }
    const accNow = getAccount(player);
    const holdsNow = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
    const finalCost = price * qty;

    if (accNow.emeralds >= finalCost) {
      const prevBought = player.getDynamicProperty(`acc_stock_bought_${stockKey}`) ?? price;
      const newAvgBought = holdsNow > 0 ? (prevBought * holdsNow + price * qty) / (holdsNow + qty) : price;
      player.setDynamicProperty("acc_emeralds", accNow.emeralds - finalCost);
      player.setDynamicProperty(`acc_stock_${stockKey}`, holdsNow + qty);
      player.setDynamicProperty(`acc_stock_bought_${stockKey}`, Math.round(newAvgBought));
      applyTrade("stock", stockKey, qty, s.vol);
      player.sendMessage(t(lang, STR.stockBuyMsg, t(lang, s.name), qty, finalCost));
    } else {
      player.sendMessage(t(lang, STR.bankAccShortage));
    }
    openStockTradeDialog(player, stockKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openStockSellModal(player, stockKey, qty = 1) {
  const lang = getLang(player);
  const s = STOCKS[stockKey];
  const price = getStockPrice(stockKey);
  const holds = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
  const bought = player.getDynamicProperty(`acc_stock_bought_${stockKey}`) ?? 0;

  if (holds < 1) {
    player.sendMessage(t(lang, STR.stockSellShortage));
    return openStockTradeDialog(player, stockKey);
  }

  qty = Math.max(1, Math.min(qty, holds));
  const gain = price * qty;

  const form = new ActionFormData()
    .title(t(lang, STR.stockSellModalTitle, t(lang, s.name)))
    .body(t(lang, STR.qtyStepSellBody, t(lang, s.name), qty, price, gain, holds, holds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmSell))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openStockTradeDialog(player, stockKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], holds));
      return openStockSellModal(player, stockKey, newQty);
    }
    const acc = getAccount(player);
    const holdsNow = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
    if (holdsNow >= qty) {
      const finalGain = price * qty;
      const pnl = (price - bought) * qty;
      player.setDynamicProperty("acc_emeralds", acc.emeralds + finalGain);
      player.setDynamicProperty(`acc_stock_${stockKey}`, holdsNow - qty);
      applyTrade("stock", stockKey, -qty, s.vol);
      player.sendMessage(t(lang, STR.stockSellMsg, t(lang, s.name), qty, pnl));
    } else {
      player.sendMessage(t(lang, STR.stockSellShortage));
    }
    openStockTradeDialog(player, stockKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
