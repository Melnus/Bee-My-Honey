import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { COMMODITIES, COMMODITY_ICONS } from "../data/market-data.js";
import { itemLocKey } from "../data/mob-trade-data.js";
import { getCommodityPrice, getCurrentCycleDay, getWeekCommodityPrices, buildIconWaveChart, applyTrade } from "../economy/market-engine.js";
import { getAccount, getItemCountWithBlocks, removeItemWithBlocks, giveItem, MAX_EMERALD_TX } from "../economy/bank.js";

// ==========================================
// ゴーレムの宝石取引（現物資産）UI / Golem Commodity Menu
// ==========================================
// アイテムの払い出しは bank.js の giveItem を使う。
// 少量は即時、大量付与時は system.runJob でtickをまたいで分割されるため、
// 以前この画面が独自に持っていた「同一tick内で大量ドロップして鯖に負荷をかける」問題を回避できる。

// ゴーレムのトップ画面：3つの現物資産から選ぶ
export function openGolemMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);

  const form = new ActionFormData()
    .title(t(lang, STR.golemTitle))
    .body(`${t(lang, STR.golemShowoff)}\n\n${t(lang, STR.golemBalanceLabel, acc.emeralds)}`);

  const keys = Object.keys(COMMODITIES);
  for (const key of keys) {
    const c = COMMODITIES[key];
    const price = getCommodityPrice(key);
    form.button({
      rawtext: [
        { text: `${COMMODITY_ICONS[key]}§r ` },
        { translate: itemLocKey(c) },
        { text: `\n${price} E` }
      ]
    });
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === keys.length) return;
    openGolemTradeDialog(player, keys[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 個別の現物資産の取引画面（買う/売るをそれぞれ数量パターンで用意）
export function openGolemTradeDialog(player, key) {
  const lang = getLang(player);
  const c = COMMODITIES[key];
  const price = getCommodityPrice(key);
  const acc = getAccount(player);
  const held = getItemCountWithBlocks(player, c.itemId, c.blockId);
  const currentDay = getCurrentCycleDay();
  const chart = buildIconWaveChart(COMMODITY_ICONS[key], getWeekCommodityPrices(key), currentDay);

  const body =
    `${t(lang, STR.golemHoldLabel, held)}\n` +
    `${t(lang, STR.golemPriceLabel, price)}\n` +
    `${t(lang, STR.golemBalanceLabel, acc.emeralds)}\n\n${chart}`;

  const form = new ActionFormData()
    .title({ translate: itemLocKey(c) })
    .body(body)
    .button(t(lang, STR.golemBuy1))
    .button(t(lang, STR.golemBuy5))
    .button(t(lang, STR.golemBuyMax))
    .button(t(lang, STR.golemSell1))
    .button(t(lang, STR.golemSell5))
    .button(t(lang, STR.golemSellAll))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        return executeGolemBuy(player, key, 1);
      case 1:
        return executeGolemBuy(player, key, 5);
      case 2: {
        const maxQty = Math.min(Math.floor(acc.emeralds / price), MAX_EMERALD_TX);
        return executeGolemBuy(player, key, maxQty);
      }
      case 3:
        return executeGolemSell(player, key, 1);
      case 4:
        return executeGolemSell(player, key, 5);
      case 5:
        return executeGolemSell(player, key, held);
      case 6:
        return openGolemMenu(player);
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function executeGolemBuy(player, key, qty) {
  const lang = getLang(player);
  const c = COMMODITIES[key];

  if (qty <= 0) {
    player.sendMessage(t(lang, STR.golemNothingToTrade));
    return openGolemTradeDialog(player, key);
  }

  const price = getCommodityPrice(key);
  const cost = Math.round(price * qty);
  const acc = getAccount(player);

  if (acc.emeralds < cost) {
    player.sendMessage(t(lang, STR.golemInsufficientFunds));
    return openGolemTradeDialog(player, key);
  }

  giveItem(player, c.itemId, qty);
  player.setDynamicProperty("acc_emeralds", acc.emeralds - cost);
  applyTrade("commodity", key, qty, c.volatility);

  player.sendMessage({
    rawtext: [
      { text: t(lang, STR.golemBuyRawtextPrefix, qty) },
      { translate: itemLocKey(c) },
      { text: t(lang, STR.golemBuyRawtextSuffix, qty, cost) }
    ]
  });
  openGolemTradeDialog(player, key);
}

export function executeGolemSell(player, key, qty) {
  const lang = getLang(player);
  const c = COMMODITIES[key];

  if (qty <= 0) {
    player.sendMessage(t(lang, STR.golemNothingToTrade));
    return openGolemTradeDialog(player, key);
  }

  if (!removeItemWithBlocks(player, c.itemId, c.blockId, qty)) {
    player.sendMessage(t(lang, STR.golemInsufficientItems));
    return openGolemTradeDialog(player, key);
  }

  const price = getCommodityPrice(key);
  const gain = Math.round(price * qty);
  const acc = getAccount(player);
  player.setDynamicProperty("acc_emeralds", acc.emeralds + gain);
  applyTrade("commodity", key, -qty, c.volatility);

  player.sendMessage({
    rawtext: [
      { text: t(lang, STR.golemSellRawtextPrefix, qty) },
      { translate: itemLocKey(c) },
      { text: t(lang, STR.golemSellRawtextSuffix, qty, gain) }
    ]
  });
  openGolemTradeDialog(player, key);
}
