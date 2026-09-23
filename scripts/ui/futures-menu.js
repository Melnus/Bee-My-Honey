import { ActionFormData } from "@minecraft/server-ui";
import { world } from "@minecraft/server";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { FUTURES, FUTURES_ICONS } from "../data/market-data.js";
import { getFuturesPrice, getWeekFuturesPrices, getCurrentCycleDay, buildSparkline, buildIconWaveChart } from "../economy/market-engine.js";
import { getAccount } from "../economy/bank.js";
import { QTY_STEP_DELTAS } from "./shared.js";
import { openMainMenu } from "./main-menu.js";

// ==========================================
// 花の先物契約メニュー UI / Flower Futures Menu
// (バラ/アリウム/ヒスイラン/ヒマワリ/サクラの5種、銘柄ごとに最大1建玉)
// ==========================================
export const MARGIN_PER_CONTRACT = 5; // 証拠金(枚あたりエメラルド)
export const CONTRACT_DAYS = 2;       // 満期までの日数
export const SETTLE_MULTIPLIER = 2;   // 決済時の損益倍率

export function openFuturesMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);

  const introText = lang === "ja"
    ? `【花の先物契約】\n銘柄ごとに証拠金${MARGIN_PER_CONTRACT}Eで${CONTRACT_DAYS}日後の相場を予測。銘柄あたり1建玉まで。\n所持: ${acc.emeralds}E\n§c※決済で口座がマイナスになると債務不履行扱い！§r`
    : `[Flower Futures]\nMargin ${MARGIN_PER_CONTRACT}E per contract, ${CONTRACT_DAYS}-day maturity. One position per instrument.\nBalance: ${acc.emeralds}E\n§c*A negative balance on settlement triggers default!§r`;

  const form = new ActionFormData()
    .title(t(lang, STR.futuresTitle))
    .body(introText);

  for (const [key, f] of Object.entries(FUTURES)) {
    const price = getFuturesPrice(key);
    const qty = player.getDynamicProperty(`fut_qty_${key}`) ?? 0;
    const spark = buildSparkline(getWeekFuturesPrices(key));
    const posLabel = qty > 0
      ? (lang === "ja" ? `建玉 ${qty}枚` : `Position: ${qty}`)
      : (lang === "ja" ? "建玉なし" : "No position");
    form.button(`${t(lang, f.name)}\n${price}E/枚  ${posLabel}\n${spark}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const keys = Object.keys(FUTURES);
    if (res.canceled || res.selection >= keys.length) return openMainMenu(player);
    openFuturesDetail(player, keys[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openFuturesDetail(player, key) {
  const lang = getLang(player);
  const f = FUTURES[key];
  const price = getFuturesPrice(key);
  const day = getCurrentCycleDay();
  const waveChart = buildIconWaveChart(FUTURES_ICONS[key], getWeekFuturesPrices(key), day);

  const qty = player.getDynamicProperty(`fut_qty_${key}`) ?? 0;
  const strike = player.getDynamicProperty(`fut_strike_${key}`) ?? 0;
  const dueAbsDay = player.getDynamicProperty(`fut_due_${key}`) ?? 0;
  const absDay = world.getDay();
  const hasContract = qty > 0;
  const matured = hasContract && absDay >= dueAbsDay;

  let statusLine;
  if (!hasContract) {
    statusLine = lang === "ja" ? "現在、建玉はありません。" : "No open position.";
  } else {
    const dueDisplayDay = (dueAbsDay % 7) + 1;
    statusLine = lang === "ja"
      ? `建玉 ${qty}枚 / 建値 ${strike}E / 満期 ${dueDisplayDay}日目${matured ? "（決済可）" : "（未到来）"}`
      : `${qty} contracts @ ${strike}E, due day ${dueDisplayDay}${matured ? " (ready)" : ""}`;
  }

  const form = new ActionFormData()
    .title(t(lang, f.name))
    .body(`${t(lang, f.desc)}\n${lang === "ja" ? "現在値" : "Current"}: ${price}E\n${statusLine}\n\n${waveChart}`)
    .button(hasContract ? (lang === "ja" ? "決済する" : "Settle") : (lang === "ja" ? "契約する" : "Open Contract"))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openFuturesMenu(player);
    if (!hasContract) return openFuturesBuyModal(player, key);
    if (!matured) {
      player.sendMessage(lang === "ja" ? "まだ満期日ではありません。" : "Contract has not matured yet.");
      return openFuturesDetail(player, key);
    }
    settleFutures(player, key);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openFuturesBuyModal(player, key, qty = 1) {
  const lang = getLang(player);
  const f = FUTURES[key];
  const acc = getAccount(player);
  const maxQty = Math.max(1, Math.floor(acc.emeralds / MARGIN_PER_CONTRACT));
  qty = Math.max(1, Math.min(qty, maxQty));

  const form = new ActionFormData()
    .title(t(lang, f.name))
    .body(
      lang === "ja"
        ? `契約数量: ${qty}枚\n必要証拠金: ${qty * MARGIN_PER_CONTRACT}E (所持 ${acc.emeralds}E)\n満期まで${CONTRACT_DAYS}日、決済倍率×${SETTLE_MULTIPLIER}`
        : `Quantity: ${qty}\nMargin required: ${qty * MARGIN_PER_CONTRACT}E (have ${acc.emeralds}E)\nMatures in ${CONTRACT_DAYS} days, x${SETTLE_MULTIPLIER} on settlement`
    )
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(lang === "ja" ? "契約を確定" : "Confirm")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openFuturesDetail(player, key);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], maxQty));
      return openFuturesBuyModal(player, key, newQty);
    }
    const accNow = getAccount(player);
    const cost = qty * MARGIN_PER_CONTRACT;
    if (accNow.emeralds < cost) {
      player.sendMessage(t(lang, STR.futuresMarginShortage));
      return openFuturesDetail(player, key);
    }
    player.setDynamicProperty("acc_emeralds", accNow.emeralds - cost);
    const price = getFuturesPrice(key);
    const targetAbsDay = world.getDay() + CONTRACT_DAYS;
    player.setDynamicProperty(`fut_qty_${key}`, qty);
    player.setDynamicProperty(`fut_strike_${key}`, price);
    player.setDynamicProperty(`fut_due_${key}`, targetAbsDay);
    player.sendMessage(t(lang, STR.futuresOpenMsg, price, (targetAbsDay % 7) + 1));
    openFuturesMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function settleFutures(player, key) {
  const lang = getLang(player);
  const qty = player.getDynamicProperty(`fut_qty_${key}`) ?? 0;
  const strike = player.getDynamicProperty(`fut_strike_${key}`) ?? 0;
  const acc = getAccount(player);

  const settlementPrice = getFuturesPrice(key);
  const profit = (settlementPrice - strike) * SETTLE_MULTIPLIER * qty;

  player.setDynamicProperty(`fut_qty_${key}`, 0);
  player.setDynamicProperty(`fut_strike_${key}`, 0);
  player.setDynamicProperty(`fut_due_${key}`, 0);

  const newBalance = acc.emeralds + profit;
  if (newBalance >= 0) {
    player.setDynamicProperty("acc_emeralds", newBalance);
    player.sendMessage(t(lang, STR.futuresSettleMsg, settlementPrice, strike, profit));
  } else {
    // 証拠金以上の損失は口座を0にした上でハチの傭兵ペナルティ（既存仕様を踏襲）
    player.setDynamicProperty("acc_emeralds", 0);
    triggerBeePenalty(player);
  }
  openFuturesMenu(player);
}

function triggerBeePenalty(player) {
  const lang = getLang(player);
  player.sendMessage(t(lang, STR.futuresDefault));
  const dim = player.dimension;
  const loc = player.location;
  for (let i = 0; i < 2; i++) {
    dim.spawnEntity("minecraft:spider", {
      x: loc.x + (Math.random() - 0.5) * 3,
      y: loc.y + 1,
      z: loc.z + (Math.random() - 0.5) * 3
    });
  }
}
