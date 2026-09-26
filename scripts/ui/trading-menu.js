import { ActionFormData } from "@minecraft/server-ui";
import { getLang, setLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getCurrentCycleDay } from "../economy/market-engine.js";
import { getAccount, getTotalNetWorth } from "../economy/bank.js";
import { STOCKS } from "../data/market-data.js";
import { openBankingMenu } from "./bank-menu.js";
import { openForexMenu } from "./forex-menu.js";
import { openStockMarketMenu } from "./stock-menu.js";
import { openFuturesMenu } from "./futures-menu.js";
import { openWalletMenu } from "./wallet-menu.js";

// ==========================================
// UI メニュー実装 / メインメニュー・言語設定
// ==========================================
export function openTradingMenu(player) {
  const lang = getLang(player);
  const day = getCurrentCycleDay();
  const acc = getAccount(player);
  const netWorth = getTotalNetWorth(player);

  const form = new ActionFormData()
    .title(t(lang, STR.mainTitle))
    .body(t(lang, STR.mainBody, day, acc.emeralds, netWorth))
    .button(t(lang, STR.btnBank), "textures/items/emerald")
    .button(t(lang, STR.btnForex), "textures/items/gold_ingot")
    .button(t(lang, STR.btnStock, Object.keys(STOCKS).length), "textures/items/iron_ingot")
    .button(t(lang, STR.btnFutures), "textures/blocks/flower_tulip_red")
    .button(t(lang, STR.btnWallet), "textures/items/honeycomb")
    .button(t(lang, STR.btnLang, lang));

  form.show(player).then((res) => {
    if (res.canceled) return;
    switch (res.selection) {
      case 0: openBankingMenu(player); break;
      case 1: openForexMenu(player); break;
      case 2: openStockMarketMenu(player); break;
      case 3: openFuturesMenu(player); break;
      case 4: openWalletMenu(player); break;
      case 5: openLanguageMenu(player); break;
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openLanguageMenu(player) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, STR.langTitle))
    .body(t(lang, STR.langBody))
    .button(t(lang, STR.langBtnJa))
    .button(t(lang, STR.langBtnEn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openTradingMenu(player);
    const newLang = res.selection === 0 ? "ja" : "en";
    setLang(player, newLang);
    player.sendMessage(t(newLang, STR.langSetMsg));
    openTradingMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
