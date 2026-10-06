import { scaleEInt } from "../economy/price-level.js";
import { applyEmeraldDelta, debitEmeralds, FLOW } from "../economy/ledger.js";
import { ActionFormData } from "@minecraft/server-ui";
import { world } from "@minecraft/server";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { FUTURES, FUTURES_ICONS } from "../data/market-data.js";
import { getFuturesPrice, getWeekFuturesPrices, getCurrentCycleDay, buildSparkline, buildIconWaveChart } from "../economy/market-engine.js";
import { getAccount } from "../economy/bank.js";
import { promptQuantity } from "./shared.js";
import { openTradingMenu } from "./trading-menu.js";

// ==========================================
// 花の先物契約メニュー UI / Flower Futures Menu
// (バラ/アリウム/ヒスイラン/ヒマワリ/サクラの5種、銘柄ごとに最大1建玉)
// ==========================================
export const MARGIN_PER_CONTRACT = 5; // 証拠金(枚あたり。ベース単位E)
export const getMarginPerContract = () => scaleEInt(MARGIN_PER_CONTRACT);
export const CONTRACT_DAYS = 2;       // 満期までの日数
export const SETTLE_MULTIPLIER = 2;   // 決済時の損益倍率

export function openFuturesMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);

  const introText = t(lang, STR.futuresIntroBody, getMarginPerContract(), CONTRACT_DAYS, acc.emeralds);

  const form = new ActionFormData()
    .title(t(lang, STR.futuresTitle))
    .body(introText);

  for (const [key, f] of Object.entries(FUTURES)) {
    const price = getFuturesPrice(key);
    const qty = player.getDynamicProperty(`fut_qty_${key}`) ?? 0;
    const spark = buildSparkline(getWeekFuturesPrices(key));
    const posLabel = qty > 0
      ? t(lang, STR.futuresPosLabelHeld, qty)
      : t(lang, STR.futuresPosLabelNone);
    form.button(`${t(lang, f.name)}\n${t(lang, STR.futuresPriceLine, price)}  ${posLabel}\n${spark}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const keys = Object.keys(FUTURES);
    if (res.canceled || res.selection >= keys.length) return openTradingMenu(player);
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
    statusLine = t(lang, STR.futuresNoPositionLine);
  } else {
    const dueDisplayDay = (dueAbsDay % 7) + 1;
    const readyNote = matured ? t(lang, STR.futuresReadyNote) : t(lang, STR.futuresNotReadyNote);
    statusLine = t(lang, STR.futuresPositionLine, qty, strike, dueDisplayDay, readyNote);
  }

  const form = new ActionFormData()
    .title(t(lang, f.name))
    .body(`${t(lang, f.desc)}\n${t(lang, STR.futuresCurrentPriceLabel)}: ${price}E\n${statusLine}\n\n${waveChart}`)
    .button(hasContract ? t(lang, STR.futuresBtnSettle) : t(lang, STR.futuresBtnOpenContract))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openFuturesMenu(player);
    if (!hasContract) return openFuturesBuyModal(player, key);
    if (!matured) {
      player.sendMessage(t(lang, STR.futuresNotMaturedMsg));
      return openFuturesDetail(player, key);
    }
    settleFutures(player, key);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openFuturesBuyModal(player, key, qty = null) {
  const lang = getLang(player);
  const f = FUTURES[key];
  const acc = getAccount(player);
  const maxQty = Math.max(1, Math.floor(acc.emeralds / getMarginPerContract()));
  if (qty === null) {
    return promptQuantity(player, {
      title: t(lang, f.name),
      max: maxQty,
      onSubmit: (q) => openFuturesBuyModal(player, key, q),
      onBack: () => openFuturesDetail(player, key)
    });
  }
  qty = Math.max(1, Math.min(qty, maxQty));

  const form = new ActionFormData()
    .title(t(lang, f.name))
    .body(t(lang, STR.futuresBuyModalBody, qty, qty * getMarginPerContract(), acc.emeralds, CONTRACT_DAYS, SETTLE_MULTIPLIER))
    .button(t(lang, STR.futuresBtnConfirm))
    .button(t(lang, STR.qtyEnter))
    .button(t(lang, STR.qtyAll))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openFuturesDetail(player, key);
    if (res.selection === 1) return openFuturesBuyModal(player, key, null);
    if (res.selection === 2) return openFuturesBuyModal(player, key, maxQty);
    const accNow = getAccount(player);
    const cost = qty * getMarginPerContract();
    if (accNow.emeralds < cost) {
      player.sendMessage(t(lang, STR.futuresMarginShortage));
      return openFuturesDetail(player, key);
    }
    debitEmeralds(player, cost, FLOW.FUTURES_MARGIN);
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
    applyEmeraldDelta(player, profit, FLOW.FUTURES_SETTLE);
    player.sendMessage(t(lang, STR.futuresSettleMsg, settlementPrice, strike, profit));
  } else {
    // 証拠金以上の損失は口座を0にした上でハチの傭兵ペナルティ（既存仕様を踏襲）
    applyEmeraldDelta(player, profit, FLOW.FUTURES_SETTLE); // 残高を超える損失は口座0止まり(clamp)
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
