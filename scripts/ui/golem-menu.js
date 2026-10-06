import { creditEmeralds, debitEmeralds, FLOW } from "../economy/ledger.js";
import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { COMMODITIES, COMMODITY_ICONS, SHULKER_UNIT_QTY } from "../data/market-data.js";
import { itemLocKey } from "../data/mob-trade-data.js";
import { getCommodityPrice, getBulkCommodityPrice, getCurrentCycleDay, getWeekCommodityPrices, getWeekBulkCommodityPrices, buildIconWaveChart, applyTrade } from "../economy/market-engine.js";
import { getAccount, getItemCountWithBlocks, removeItemWithBlocks, giveItem, MAX_EMERALD_TX } from "../economy/bank.js";
import { buyBulkCommodity, sellBulkCommodity } from "../economy/trade.js";

// ==========================================
// ゴーレムの宝石取引（現物資産）UI / Golem Commodity Menu
// ==========================================
// アイテムの払い出しは bank.js の giveItem を使う。
// 少量は即時、大量付与時は system.runJob でtickをまたいで分割されるため、
// 以前この画面が独自に持っていた「同一tick内で大量ドロップして鯖に負荷をかける」問題を回避できる。
//
// v0.3.4 #1 でトップ画面を「希少資源(従来通りの小口取引)」「一般資源(シュルカー単位のバルク取引、
// economy/trade.js を参照)」の2カテゴリに分けた。カテゴリの判定は COMMODITIES[key].bulkOnly の
// 有無をそのまま使う(bulkOnly: true = 一般資源、なし = 希少資源)。

// ゴーレムのトップ画面：カテゴリ選択
export function openGolemMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);

  const form = new ActionFormData()
    .title(t(lang, STR.golemTitle))
    .body(`${t(lang, STR.golemShowoff)}\n\n${t(lang, STR.golemBalanceLabel, acc.emeralds)}\n\n${t(lang, STR.golemCategoryBody)}`)
    .button(t(lang, STR.golemCategoryRare))
    .button(t(lang, STR.golemCategoryGeneral))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled) return;
    switch (res.selection) {
      case 0:
        return openGolemCategoryMenu(player, "rare");
      case 1:
        return openGolemCategoryMenu(player, "general");
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// カテゴリ別の一覧画面。rare は既存の小口取引ダイアログへ、general はバルク取引ダイアログへ分岐する。
export function openGolemCategoryMenu(player, category) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const isRare = category === "rare";

  const form = new ActionFormData()
    .title(isRare ? t(lang, STR.golemCategoryRare) : t(lang, STR.golemCategoryGeneral))
    .body(t(lang, STR.golemBalanceLabel, acc.emeralds));

  const keys = Object.keys(COMMODITIES).filter((key) => !!COMMODITIES[key].bulkOnly !== isRare);
  for (const key of keys) {
    const c = COMMODITIES[key];
    const unitPrice = isRare ? getCommodityPrice(key) : getBulkCommodityPrice(key);
    const price = isRare ? unitPrice : Math.round(unitPrice * SHULKER_UNIT_QTY);
    form.button({
      rawtext: [
        { text: `${COMMODITY_ICONS[key] ?? "§7●"}§r ` },
        { translate: itemLocKey(c) },
        { text: `\n${price} E` }
      ]
    });
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === keys.length) return openGolemMenu(player);
    const key = keys[res.selection];
    return isRare ? openGolemTradeDialog(player, key) : openGolemBulkDialog(player, key);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 一般資源(bulkOnly)の取引画面。シュルカーボックス単位でのみ売買する(economy/trade.js)。
export function openGolemBulkDialog(player, key) {
  const lang = getLang(player);
  const c = COMMODITIES[key];
  const unitPrice = getBulkCommodityPrice(key);
  const acc = getAccount(player);
  const currentDay = getCurrentCycleDay();
  const weekPrices = getWeekBulkCommodityPrices(key).map((p) => Math.round(p * SHULKER_UNIT_QTY));
  const chart = buildIconWaveChart(COMMODITY_ICONS[key] ?? "§7●", weekPrices, currentDay);

  const body =
    `${t(lang, STR.golemBulkPriceLabel, Math.round(unitPrice * SHULKER_UNIT_QTY))}\n` +
    `${t(lang, STR.golemBalanceLabel, acc.emeralds)}\n\n${chart}`;

  const form = new ActionFormData()
    .title({ translate: itemLocKey(c) })
    .body(body)
    .button(t(lang, STR.golemBulkBuyButton))
    .button(t(lang, STR.golemBulkSellButton))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled) return;
    switch (res.selection) {
      case 0:
        return executeGolemBulkBuy(player, key);
      case 1:
        return executeGolemBulkSell(player, key);
      case 2:
        return openGolemCategoryMenu(player, "general");
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function executeGolemBulkBuy(player, key) {
  const lang = getLang(player);
  const c = COMMODITIES[key];
  const result = buyBulkCommodity(player, key, player.location);

  if (!result.ok) {
    const msg =
      result.reason === "noEmptyShulker" ? STR.golemBulkNoEmptyShulker :
      result.reason === "insufficientFunds" ? STR.golemBulkInsufficientFunds :
      STR.golemNothingToTrade;
    player.sendMessage(t(lang, msg));
    return openGolemBulkDialog(player, key);
  }

  player.sendMessage(t(lang, STR.golemBulkBuySuccess, c.name[lang] ?? c.name.ja, result.totalAmount));
  openGolemBulkDialog(player, key);
}

export function executeGolemBulkSell(player, key) {
  const lang = getLang(player);
  const c = COMMODITIES[key];
  const result = sellBulkCommodity(player, key, player.location);

  if (!result.ok) {
    const msg =
      result.reason === "noMatchingFullShulker" ? STR.golemBulkNoMatchingFullShulker :
      STR.golemNothingToTrade;
    player.sendMessage(t(lang, msg));
    return openGolemBulkDialog(player, key);
  }

  player.sendMessage(t(lang, STR.golemBulkSellSuccess, c.name[lang] ?? c.name.ja, result.totalAmount));
  openGolemBulkDialog(player, key);
}

// 個別の現物資産の取引画面（買う/売るをそれぞれ数量パターンで用意）
export function openGolemTradeDialog(player, key) {
  const lang = getLang(player);
  const c = COMMODITIES[key];
  const price = getCommodityPrice(key);
  const acc = getAccount(player);
  const held = getItemCountWithBlocks(player, c.itemId, c.blockId);
  const currentDay = getCurrentCycleDay();
  const chart = buildIconWaveChart(COMMODITY_ICONS[key] ?? "§7●", getWeekCommodityPrices(key), currentDay);

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
  // 単価が1E未満の品(クォーツ・レッドストーン等)を1個だけ買うと四捨五入で0Eになり、タダで手に入ってしまうため、最低1E
  const cost = Math.max(1, Math.round(price * qty));
  const acc = getAccount(player);

  if (acc.emeralds < cost) {
    player.sendMessage(t(lang, STR.golemInsufficientFunds));
    return openGolemTradeDialog(player, key);
  }

  giveItem(player, c.itemId, qty);
  debitEmeralds(player, cost, FLOW.COMMODITY_BUY);
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
  creditEmeralds(player, gain, FLOW.COMMODITY_SELL);
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
