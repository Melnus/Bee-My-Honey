import { world, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { CURRENCIES, CURRENCY_ICONS } from "../data/market-data.js";
import { MOB_NAMES, MOB_TRADE_ITEMS, itemLocKey } from "../data/mob-trade-data.js";
import { getCurrencyRate, getCurrentCycleDay, getWeekCurrencyRates, buildIconWaveChart } from "../economy/market-engine.js";
import { getAccount } from "../economy/bank.js";

// ==========================================
// 動物交易（モブトレード）UI / Mob Trade Menu
// ==========================================

// 決定論的な日替わりシャッフル用の簡易PRNG（同じ日・同じ通貨なら全プレイヤーで同じ結果になる）
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// currKeyごとに「今日」入れ替わる最大5品目のラインナップを返す(buy/sellで少しシードをずらして別々の並びにする)
function pickDailyItems(currKey, mode, count = 5) {
  const pool = MOB_TRADE_ITEMS[currKey] ?? [];
  const day = world.getDay();
  const seed = day * 1000 + hashString(currKey) + (mode === "sell" ? 7 : 0);
  const rng = mulberry32(seed);

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function findItemSlot(container, typeId) {
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (stack && stack.typeId === typeId) return i;
  }
  return -1;
}

// 交易窓口トップ画面
export function openMobTradeMenu(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const acc = getAccount(player);
  const mobName = t(lang, MOB_NAMES[currKey]);
  const curName = t(lang, c.name);

  const body =
    `${t(lang, STR.mobTradeShowoff, mobName, curName)}\n\n` +
    `${t(lang, STR.mobTradeHoldLabel, acc[currKey], curName)}`;

  const form = new ActionFormData()
    .title(curName)
    .body(body)
    .button(t(lang, STR.mobTradeBuyBtn))
    .button(t(lang, STR.mobTradeSellBtn))
    .button(t(lang, STR.mobTradeRateBtn))
    .button(t(lang, STR.mobTradeLeaveBtn));

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) openMobBuyList(player, currKey);
    else if (res.selection === 1) openMobSellList(player, currKey);
    else if (res.selection === 2) openMobRateInfo(player, currKey);
    else if (res.selection === 3) openMobLeaveDialog(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 今日の取引商品（外貨をつかって実アイテムを買う）
export function openMobBuyList(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const curName = t(lang, c.name);
  const acc = getAccount(player);
  const items = pickDailyItems(currKey, "buy");

  const form = new ActionFormData()
    .title(t(lang, STR.mobTradeBuyTitle))
    .body(`${t(lang, STR.mobTradeBuyDesc)}\n${t(lang, STR.mobTradeYourBalance, acc[currKey], curName)}`);

  for (const item of items) {
    form.button({
      rawtext: [
        { translate: itemLocKey(item) },
        { text: t(lang, STR.mobTradeItemLine, item.value, curName) }
      ]
    });
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === items.length) return openMobTradeMenu(player, currKey);
    confirmMobBuy(player, currKey, items[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function confirmMobBuy(player, currKey, item) {
  const lang = getLang(player);
  const acc = getAccount(player);

  if (acc[currKey] < item.value) {
    player.sendMessage(t(lang, STR.mobTradeInsufficientCurrency));
    return openMobBuyList(player, currKey);
  }

  // ベルボート方式：インベントリへ直接付与せず、足元にドロップする
  player.dimension.spawnItem(new ItemStack(item.id, 1), player.location);
  player.setDynamicProperty(`acc_curr_${currKey}`, acc[currKey] - item.value);
  player.sendMessage({
    rawtext: [
      { text: t(lang, STR.mobTradeBuySuccessPrefix) },
      { translate: itemLocKey(item) },
      { text: t(lang, STR.mobTradeBuySuccessSuffix) }
    ]
  });
  openMobBuyList(player, currKey);
}

// 今日の買取商品（実アイテムを渡して外貨に変換する）
export function openMobSellList(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const curName = t(lang, c.name);
  const items = pickDailyItems(currKey, "sell");

  const form = new ActionFormData()
    .title(t(lang, STR.mobTradeSellTitle))
    .body(t(lang, STR.mobTradeSellDesc));

  for (const item of items) {
    const price = Math.max(1, Math.ceil(item.value * 0.6));
    form.button({
      rawtext: [
        { translate: itemLocKey(item) },
        { text: t(lang, STR.mobTradeSellItemLine, price, curName) }
      ]
    });
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === items.length) return openMobTradeMenu(player, currKey);
    confirmMobSell(player, currKey, items[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function confirmMobSell(player, currKey, item) {
  const lang = getLang(player);
  const inv = player.getComponent("inventory")?.container;
  if (!inv) return openMobSellList(player, currKey);

  const slot = findItemSlot(inv, item.id);
  if (slot === -1) {
    player.sendMessage({
      rawtext: [
        { text: t(lang, STR.mobTradeNoItemPrefix) },
        { translate: itemLocKey(item) },
        { text: t(lang, STR.mobTradeNoItemSuffix) }
      ]
    });
    return openMobSellList(player, currKey);
  }

  const stack = inv.getItem(slot);
  if (stack.amount > 1) {
    stack.amount -= 1;
    inv.setItem(slot, stack);
  } else {
    inv.setItem(slot, undefined);
  }

  const price = Math.max(1, Math.ceil(item.value * 0.6));
  const acc = getAccount(player);
  player.setDynamicProperty(`acc_curr_${currKey}`, acc[currKey] + price);
  player.sendMessage({
    rawtext: [
      { text: t(lang, STR.mobTradeSellSuccessPrefix) },
      { translate: itemLocKey(item) },
      { text: t(lang, STR.mobTradeSellSuccessSuffix, price, t(lang, CURRENCIES[currKey].name)) }
    ]
  });
  openMobSellList(player, currKey);
}

// 換金レート画面（株式/外貨と同じアイコン浮き沈みチャートを流用）
export function openMobRateInfo(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const currentDay = getCurrentCycleDay();
  const chart = buildIconWaveChart(CURRENCY_ICONS[currKey], getWeekCurrencyRates(currKey), currentDay);

  let refLines = "";
  for (const key of Object.keys(CURRENCIES)) {
    if (key === currKey) continue;
    const other = CURRENCIES[key];
    refLines += `${CURRENCY_ICONS[key]}§r ${t(lang, STR.mobTradeRateLine, t(lang, other.name), getCurrencyRate(key))}\n`;
  }

  const body =
    `${chart}\n\n` +
    `${t(lang, STR.mobTradeRateLine, t(lang, c.name), rate)}\n\n` +
    `${t(lang, STR.mobTradeRefOthers)}\n${refLines}`;

  const form = new ActionFormData()
    .title(t(lang, STR.mobTradeRateTitle))
    .body(body)
    .button(t(lang, STR.back));

  form.show(player).then(() => openMobTradeMenu(player, currKey))
    .catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 終了ダイアログ（なでる/追い払う）
export function openMobLeaveDialog(player, currKey) {
  const lang = getLang(player);
  const mobName = t(lang, MOB_NAMES[currKey]);

  const form = new ActionFormData()
    .title(t(lang, STR.mobTradeLeaveTitle))
    .body(t(lang, STR.mobTradeLeaveBody))
    .button(t(lang, STR.mobTradePetBtn))
    .button(t(lang, STR.mobTradeShooBtn));

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      player.sendMessage(t(lang, STR.mobTradePetResult, mobName));
    } else if (res.selection === 1) {
      try {
        player.applyDamage(1, { cause: "none" });
      } catch (e) {
        console.warn("[BeeMyHoney] Shoo damage error: " + e);
      }
      player.sendMessage(t(lang, STR.mobTradeShooResult, mobName));
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
