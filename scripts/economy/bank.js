import { world, ItemStack } from "@minecraft/server";
import { CURRENCIES, STOCKS } from "../data/market-data.js";
import { getCurrencyRate, getStockPrice } from "./market-engine.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// ==========================================
// 口座＆インベントリ管理（ロスト防止対応）
// Bank Account & Inventory Helpers
// ==========================================
// 銀行の利率設計: 銀行(安定・低リターン) < 株式 < 外貨/仮想通貨(不安定・高リターン)
// 外貨・株式は変動率(volatility)が大きく元本割れもあり得るのに対し、
// 銀行預金は変動なしの固定利子(元本保証)にすることで、リスク許容度に応じた住み分けを作る。
export const BANK_INTEREST_RATE = 0.015; // 週1.5%固定（複利で毎週の経済リセット時に付与）

export function getAccount(player) {
  return {
    emeralds: player.getDynamicProperty("acc_emeralds") ?? 0,
    honeycomb: player.getDynamicProperty("acc_curr_honeycomb") ?? 0,
    apple: player.getDynamicProperty("acc_curr_apple") ?? 0,
    sweet_berry: player.getDynamicProperty("acc_curr_sweet_berry") ?? 0,
    glow_berry: player.getDynamicProperty("acc_curr_glow_berry") ?? 0,
    chorus_fruit: player.getDynamicProperty("acc_curr_chorus_fruit") ?? 0
  };
}

// 週次の経済リセット時に、その時点でオンラインのプレイヤーへ利子チェックをかける
export function applyBankInterest() {
  for (const p of world.getPlayers()) {
    checkAndGrantBankInterest(p);
  }
}

// その週の中でどこか1回でもログインしていれば利子がもらえるようにする。
// 「最後に利子を受け取った週番号」をプレイヤーごとに記録し、現在の週番号とズレていたら
// (=前回付与から少なくとも1週間経過している、または今週まだ受け取っていない)その場で付与する。
// これにより「週の切り替わりの瞬間にオンラインである必要」がなくなる。
export function getWeekNumber() {
  return Math.floor(world.getDay() / 7);
}

export function checkAndGrantBankInterest(player) {
  const currentWeek = getWeekNumber();
  const lastWeek = player.getDynamicProperty("bank_interest_week");

  // 初回ログイン時(記録なし)は付与せず、今週分としてマークするだけにする
  if (lastWeek === undefined) {
    player.setDynamicProperty("bank_interest_week", currentWeek);
    return;
  }
  if (lastWeek === currentWeek) return; // 今週分は受け取り済み

  const acc = getAccount(player);
  const interest = Math.floor(acc.emeralds * BANK_INTEREST_RATE);
  if (interest > 0) {
    player.setDynamicProperty("acc_emeralds", acc.emeralds + interest);
    const lang = getLang(player);
    player.sendMessage(t(lang, STR.bankInterestMsg, interest));
  }
  player.setDynamicProperty("bank_interest_week", currentWeek);
}

// ログイン時にも同じチェックをかける（週の途中でログインしても、その週分を取りこぼさないように）を
// 開始する。main.js の起動時に一度だけ呼び出す。
export function startBankInterestOnSpawn() {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    checkAndGrantBankInterest(event.player);
  });
}

export function getTotalNetWorth(player) {
  const acc = getAccount(player);
  let total = acc.emeralds;
  for (const [key] of Object.entries(CURRENCIES)) {
    total += acc[key] * getCurrencyRate(key);
  }
  for (const [key] of Object.entries(STOCKS)) {
    const holds = player.getDynamicProperty(`acc_stock_${key}`) ?? 0;
    total += holds * getStockPrice(key);
  }
  return Math.round(total);
}

export function getItemCount(player, typeId) {
  let count = 0;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return 0;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item && item.typeId === typeId) count += item.amount;
  }
  return count;
}

export function removeItem(player, typeId, amount) {
  let left = amount;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item && item.typeId === typeId) {
      if (item.amount <= left) {
        left -= item.amount;
        container.setItem(i, undefined);
      } else {
        item.amount -= left;
        container.setItem(i, item);
        left = 0;
      }
      if (left <= 0) break;
    }
  }
}

// インベントリ満杯時に足元へ安全ドロップする改善版
export function giveItem(player, typeId, amount) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  let left = amount;
  while (left > 0) {
    const s = Math.min(left, 64);
    const item = new ItemStack(typeId, s);
    const leftover = container.addItem(item);
    if (leftover && leftover.amount > 0) {
      player.dimension.spawnItem(leftover, player.location);
    }
    left -= s;
  }
}
