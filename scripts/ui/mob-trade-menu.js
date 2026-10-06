import { world, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { CURRENCIES, CURRENCY_ICONS } from "../data/market-data.js";
import { MOB_NAMES, MOB_TRADE_ITEMS, itemLocKey } from "../data/mob-trade-data.js";
import { getCurrencyRate, getCurrentCycleDay, getWeekCurrencyRates, buildIconWaveChart } from "../economy/market-engine.js";
import { getAccount, getItemCount, removeItem } from "../economy/bank.js";
import { PB_ITEMS, PB_MOOD_MAX } from "../data/pb-data.js";
import { hasQualification } from "../economy/labor.js";
import { openFreshMarket } from "./fresh-market-menu.js";
import { ensurePbFresh, getPbStock, getPbBuyPrice, getPbSellPrice, getPbMood, getPbDiscountPercent, petPbCat, giftFishToPbCat, buyFromPb, sellToPb } from "../economy/pb.js";

// ==========================================
// 動物交易（モブトレード）UI / Mob Trade Menu
// ==========================================
// アイテムの払い出しは bank.js の giveItem を使う。
// 少量は即時、大量付与時は system.runJob でtickをまたいで分割されるため、
// 以前この画面が独自に持っていた「同一tick内で大量ドロップして鯖に負荷をかける」問題を回避できる。
// v0.3.4: 材木取引はここから分岐させず、現物取引(golem-menu.js)の一般資源に統合する方針に変更。

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

// 1口(lot個)の表示用。lotが1なら空文字(従来どおり品名だけ)
function lotText(lang, item) {
  return (item.lot ?? 1) > 1 ? t(lang, STR.mobTradeLotSuffix, item.lot) : "";
}

// 交易窓口トップ画面
// 窓口ごとに「買取」と「換金レート」の間へ専用の入口を差し込む(APL=猫の店PB、GLB=生鮮市場)。
// ボタンの有無で選択インデックスがずれるので、ボタンと処理を対にした配列で管理する。
export function openMobTradeMenu(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const acc = getAccount(player);
  const mobName = t(lang, MOB_NAMES[currKey]);
  const curName = t(lang, c.name);

  const body =
    `${t(lang, STR.mobTradeShowoff, mobName, curName)}\n\n` +
    `${t(lang, STR.mobTradeHoldLabel, acc[currKey], curName)}`;

  const actions = [
    { label: STR.mobTradeBuyBtn, run: () => openMobBuyList(player, currKey) },
    { label: STR.mobTradeSellBtn, run: () => openMobSellList(player, currKey) }
  ];
  if (currKey === "apple") actions.push({ label: STR.mobTradePbBtn, run: () => openPbShop(player, currKey) });
  if (currKey === "glow_berry") {
    actions.push({
      label: STR.mobTradeFmBtn,
      run: () => openFreshMarket(player, () => openMobTradeMenu(player, currKey))
    });
  }
  actions.push({ label: STR.mobTradeRateBtn, run: () => openMobRateInfo(player, currKey) });
  actions.push({ label: STR.mobTradeLeaveBtn, run: () => openMobLeaveDialog(player, currKey) });

  const form = new ActionFormData().title(curName).body(body);
  for (const a of actions) form.button(t(lang, a.label));

  form.show(player).then((res) => {
    if (res.canceled) return;
    actions[res.selection]?.run();
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
        { text: lotText(lang, item) + t(lang, STR.mobTradeItemLine, item.value, curName) }
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
  player.dimension.spawnItem(new ItemStack(item.id, item.lot ?? 1), player.location);
  player.setDynamicProperty(`acc_curr_${currKey}`, acc[currKey] - item.value);
  player.sendMessage({
    rawtext: [
      { text: t(lang, STR.mobTradeBuySuccessPrefix) },
      { translate: itemLocKey(item) },
      { text: lotText(lang, item) + t(lang, STR.mobTradeBuySuccessSuffix) }
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
        { text: lotText(lang, item) + t(lang, STR.mobTradeSellItemLine, price, curName) }
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
  const lot = item.lot ?? 1;

  // 買取は1口(lot個)単位。lot個そろっていなければ受け付けない
  if (getItemCount(player, item.id) < lot) {
    player.sendMessage({
      rawtext: [
        { text: t(lang, STR.mobTradeNoItemPrefix) },
        { translate: itemLocKey(item) },
        { text: lotText(lang, item) + t(lang, STR.mobTradeNoItemSuffix) }
      ]
    });
    return openMobSellList(player, currKey);
  }
  removeItem(player, item.id, lot);

  const price = Math.max(1, Math.ceil(item.value * 0.6));
  const acc = getAccount(player);
  player.setDynamicProperty(`acc_curr_${currKey}`, acc[currKey] + price);
  player.sendMessage({
    rawtext: [
      { text: t(lang, STR.mobTradeSellSuccessPrefix) },
      { translate: itemLocKey(item) },
      { text: lotText(lang, item) + t(lang, STR.mobTradeSellSuccessSuffix, price, t(lang, CURRENCIES[currKey].name)) }
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

// ==========================================
// Paws & Blackpots (PB) — 猫の店 UI (APL窓口から入る)
// ==========================================

// 店のトップ画面: 品目一覧(そのまま購入)+ 納品 / 撫でる / 魚をあげる
export function openPbShop(player, currKey) {
  const lang = getLang(player);
  ensurePbFresh();
  const acc = getAccount(player);
  const curName = t(lang, CURRENCIES.apple.name);
  const mood = getPbMood(player);
  const moodLabel = t(lang, STR.pbMoodLabels)[Math.min(mood, PB_MOOD_MAX)];

  const form = new ActionFormData()
    .title(t(lang, STR.pbTitle))
    .body(t(lang, STR.pbBody, acc.apple, curName, moodLabel, getPbDiscountPercent(player)));

  for (const item of PB_ITEMS) {
    const stock = getPbStock(item);
    const price = getPbBuyPrice(player, item);
    const line = stock <= 0 ? t(lang, STR.pbItemSoldOutLine)
      : item.license && !hasQualification(player, item.license) ? t(lang, STR.pbItemLicenseLine, price, curName)
      : t(lang, STR.pbItemLine, price, curName, stock);
    form.button({ rawtext: [{ translate: itemLocKey({ id: item.id, key: item.locKey }) }, { text: lotText(lang, item) + line }] });
  }
  form.button(t(lang, STR.pbSellBtn));
  form.button(t(lang, STR.pbPetBtn));
  form.button(t(lang, STR.pbGiftBtn));
  form.button(t(lang, STR.back));

  const n = PB_ITEMS.length;
  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection < n) return executePbBuy(player, currKey, PB_ITEMS[res.selection]);
    if (res.selection === n) return openPbSellList(player, currKey);
    if (res.selection === n + 1) return executePbPet(player, currKey);
    if (res.selection === n + 2) return executePbGift(player, currKey);
    return openMobTradeMenu(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function executePbBuy(player, currKey, item) {
  const lang = getLang(player);
  const result = buyFromPb(player, item);
  if (!result.ok) {
    const msg = result.reason === "licenseRequired" ? STR.pbLicenseRequired
      : result.reason === "soldOut" ? STR.pbSoldOut
      : STR.mobTradeInsufficientCurrency;
    player.sendMessage(t(lang, msg));
  } else {
    player.sendMessage({
      rawtext: [
        { text: t(lang, STR.mobTradeBuySuccessPrefix) },
        { translate: itemLocKey({ id: item.id, key: item.locKey }) },
        { text: lotText(lang, item) + t(lang, STR.mobTradeBuySuccessSuffix) }
      ]
    });
  }
  openPbShop(player, currKey);
}

function openPbSellList(player, currKey) {
  const lang = getLang(player);
  const curName = t(lang, CURRENCIES.apple.name);

  const form = new ActionFormData()
    .title(t(lang, STR.pbSellTitle))
    .body(t(lang, STR.pbSellDesc));
  for (const item of PB_ITEMS) {
    form.button({
      rawtext: [
        { translate: itemLocKey({ id: item.id, key: item.locKey }) },
        { text: lotText(lang, item) + t(lang, STR.mobTradeSellItemLine, getPbSellPrice(item), curName) }
      ]
    });
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === PB_ITEMS.length) return openPbShop(player, currKey);
    executePbSell(player, currKey, PB_ITEMS[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function executePbSell(player, currKey, item) {
  const lang = getLang(player);
  const result = sellToPb(player, item);
  if (!result.ok) {
    player.sendMessage({
      rawtext: [
        { text: t(lang, STR.mobTradeNoItemPrefix) },
        { translate: itemLocKey({ id: item.id, key: item.locKey }) },
        { text: lotText(lang, item) + t(lang, STR.mobTradeNoItemSuffix) }
      ]
    });
  } else {
    player.sendMessage({
      rawtext: [
        { text: t(lang, STR.mobTradeSellSuccessPrefix) },
        { translate: itemLocKey({ id: item.id, key: item.locKey }) },
        { text: lotText(lang, item) + t(lang, STR.mobTradeSellSuccessSuffix, result.price, t(lang, CURRENCIES.apple.name)) }
      ]
    });
  }
  openPbSellList(player, currKey);
}

function executePbPet(player, currKey) {
  const lang = getLang(player);
  const result = petPbCat(player);
  if (!result.ok) player.sendMessage(t(lang, STR.pbPetAlready));
  else player.sendMessage(t(lang, STR.pbPetDone, t(lang, STR.pbMoodLabels)[result.mood]));
  openPbShop(player, currKey);
}

function executePbGift(player, currKey) {
  const lang = getLang(player);
  const result = giftFishToPbCat(player);
  if (!result.ok) {
    player.sendMessage(t(lang, result.reason === "moodMax" ? STR.pbMoodMax : STR.pbNoFish));
  } else {
    player.sendMessage(t(lang, STR.pbGiftDone, t(lang, STR.pbMoodLabels)[result.mood]));
  }
  openPbShop(player, currKey);
}
