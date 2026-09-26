import { world, system, ItemStack, EnchantmentTypes } from "@minecraft/server";
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

// 1回の取引で扱える最大数量。giveItem 側のtick分割で鯖クラッシュ自体は防げるが、
// UI側でも常識的な上限を設けておくことで、そもそも巨大な数量を選べないようにする。
export const MAX_EMERALD_TX = 2304; // 物理エメラルド: インベントリ最大収容数(36スタック×64)
export const MAX_E_TX = 2000000; // 電子取引残高(E)

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

// ブロック化されたアイテムも「素材9個」として換算した合計所持数を返す
// (例: ダイヤモンド3個 + ダイヤモンドブロック2個 = 3 + 2*9 = 21個)
export function getItemCountWithBlocks(player, typeId, blockTypeId, unitsPerBlock = 9) {
  return getItemCount(player, typeId) + getItemCount(player, blockTypeId) * unitsPerBlock;
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

// 1回の呼び出しを完全に同期処理してよい上限(スタック単位ではなく個数)。
// これを超える量は system.runJob を使ってtickをまたいで分割し、
// 大量ドロップによる同一tick内でのエンティティ大量生成(鯖負荷・ウォッチドッグ超過)を防ぐ。
const GIVE_ITEM_SYNC_LIMIT = 320; // 5スタック相当までは即時反映
const GIVE_ITEM_CHUNK_STACKS_PER_TICK = 32; // 分割処理時、1tickあたりに処理するスタック数

function giveItemStack(player, typeId, amount) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  const item = new ItemStack(typeId, amount);
  const leftover = container.addItem(item);
  if (leftover && leftover.amount > 0) {
    player.dimension.spawnItem(leftover, player.location);
  }
  return true;
}

function* giveItemJob(player, typeId, amount) {
  let left = amount;
  let processedThisTick = 0;
  while (left > 0) {
    if (!player.isValid) return; // プレイヤーが既にワールドを離れている場合は中断
    const s = Math.min(left, 64);
    if (!giveItemStack(player, typeId, s)) return; // インベントリ取得失敗時も中断
    left -= s;
    processedThisTick++;
    if (processedThisTick >= GIVE_ITEM_CHUNK_STACKS_PER_TICK) {
      processedThisTick = 0;
      yield;
    }
  }
}

// インベントリ満杯時に足元へ安全ドロップする改善版。
// 少量は即時反映、大量付与分は system.runJob でtickをまたいで分割処理する。
export function giveItem(player, typeId, amount) {
  if (amount <= 0) return;
  if (amount <= GIVE_ITEM_SYNC_LIMIT) {
    let left = amount;
    while (left > 0) {
      const s = Math.min(left, 64);
      if (!giveItemStack(player, typeId, s)) return;
      left -= s;
    }
    return;
  }
  system.runJob(giveItemJob(player, typeId, amount));
}

// エンチャント本などに実際のエンチャントを付与して渡す（無ければ無地のまま渡す＝既存挙動と互換）。
export function giveEnchantedItem(player, typeId, enchant) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const item = new ItemStack(typeId, 1);
  if (enchant && enchant.id) {
    try {
      const comp = item.getComponent("minecraft:enchantable");
      const type = EnchantmentTypes.get(enchant.id);
      if (comp && type) comp.addEnchantment({ type, level: enchant.level ?? 1 });
    } catch (e) {
      console.warn("[BeeMyHoney] Failed to apply enchantment " + enchant.id + ": " + e);
    }
  }
  const leftover = container.addItem(item);
  if (leftover && leftover.amount > 0) {
    player.dimension.spawnItem(leftover, player.location);
  }
}

// 素のアイテムだけでは足りない分をブロックを崩して充当し、amount個を取り除く。
// ブロックを崩すと余りが出る場合は足元へドロップして返す（ロスト防止）。
// ブロック換算込みでも保有数が足りない場合は何も取り除かず false を返す。
export function removeItemWithBlocks(player, typeId, blockTypeId, amount, unitsPerBlock = 9) {
  const rawCount = getItemCount(player, typeId);
  const blockCount = getItemCount(player, blockTypeId);
  if (rawCount + blockCount * unitsPerBlock < amount) return false;

  if (rawCount >= amount) {
    removeItem(player, typeId, amount);
    return true;
  }

  if (rawCount > 0) removeItem(player, typeId, rawCount);
  const remaining = amount - rawCount;
  const blocksToBreak = Math.ceil(remaining / unitsPerBlock);
  removeItem(player, blockTypeId, blocksToBreak);

  const change = blocksToBreak * unitsPerBlock - remaining;
  if (change > 0) giveItem(player, typeId, change);

  return true;
}
