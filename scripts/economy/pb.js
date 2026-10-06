import { world, ItemStack } from "@minecraft/server";
import {
  PB_ITEMS,
  PB_SELL_RATIO,
  PB_PRICE_FACTOR_MIN,
  PB_PRICE_FACTOR_MAX,
  PB_MOOD_MAX,
  PB_MOOD_DISCOUNT_PER_POINT,
  PB_PET_MOOD_GAIN,
  PB_GIFT_MOOD_GAIN,
  PB_GIFT_FISH
} from "../data/pb-data.js";
import { getShopStock, addShopStock, removeShopStock, replenishShopStock } from "./trade-pool.js";
import { getAccount, getItemCount, removeItem } from "./bank.js";
import { hasQualification } from "./labor.js";

// ==========================================
// Paws & Blackpots (PB) ロジック
// ------------------------------------------
// 在庫は trade-pool.js の shop型(poolId = `pb_${key}`)。日替わり処理は専用のフックを持たず、
// 画面を開くたびに ensurePbFresh() で「初期化されていなければ初期在庫を入れる」
// 「今日まだ補充していなければ restock:true の品目だけ補充する」を遅延実行する
// (誰もオンラインでない日があっても、次に開いた時点で辻褄が合う)。
// ==========================================

const INIT_MARK_PREFIX = "pb_init_";
const LAST_RESTOCK_KEY = "pb_last_restock_day";
const MOOD_KEY = "pb_mood";
const MOOD_DAY_KEY = "pb_mood_day";
const PET_DAY_KEY = "pb_pet_day";

function poolId(item) {
  return `pb_${item.key}`;
}

export function getPbItem(key) {
  return PB_ITEMS.find((i) => i.key === key) ?? null;
}

// 初期在庫の投入と、日替わりの補充。画面を開く前に必ず呼ぶ。
export function ensurePbFresh() {
  const today = world.getDay();

  for (const item of PB_ITEMS) {
    const mark = INIT_MARK_PREFIX + item.key;
    if (!world.getDynamicProperty(mark)) {
      addShopStock(poolId(item), item.initialStock);
      world.setDynamicProperty(mark, true);
    }
  }

  if (world.getDynamicProperty(LAST_RESTOCK_KEY) !== today) {
    for (const item of PB_ITEMS) {
      if (item.restock) replenishShopStock(poolId(item), item.targetStock);
    }
    world.setDynamicProperty(LAST_RESTOCK_KEY, today);
  }
}

export function getPbStock(item) {
  return getShopStock(poolId(item));
}

// ---- 価格(ネコの気まぐれ) ----

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// 日付+品目キーから決まる0〜1の疑似乱数(同じ日・同じ品目なら誰が見ても同じ値になる)
function dailyRandom(itemKey, day) {
  let a = (day * 1000 + hashString(itemKey)) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// その日のネコの言い値(機嫌による値引き前)
export function getPbDailyPrice(item, day = world.getDay()) {
  const factor = PB_PRICE_FACTOR_MIN + dailyRandom(item.key, day) * (PB_PRICE_FACTOR_MAX - PB_PRICE_FACTOR_MIN);
  return Math.max(1, Math.round(item.basePrice * factor));
}

// ---- ネコの機嫌(プレイヤーごと・その日限り) ----

export function getPbMood(player) {
  if (player.getDynamicProperty(MOOD_DAY_KEY) !== world.getDay()) return 0;
  return player.getDynamicProperty(MOOD_KEY) ?? 0;
}

function addPbMood(player, gain) {
  const next = Math.min(PB_MOOD_MAX, getPbMood(player) + gain);
  player.setDynamicProperty(MOOD_KEY, next);
  player.setDynamicProperty(MOOD_DAY_KEY, world.getDay());
  return next;
}

export function getPbDiscountPercent(player) {
  return Math.round(getPbMood(player) * PB_MOOD_DISCOUNT_PER_POINT * 100);
}

// このプレイヤーが実際に払う購入価格(機嫌による値引き後)
export function getPbBuyPrice(player, item) {
  const discounted = getPbDailyPrice(item) * (1 - getPbMood(player) * PB_MOOD_DISCOUNT_PER_POINT);
  return Math.max(1, Math.round(discounted));
}

// 納品(買取)価格。機嫌は関係なく、その日の言い値に対する固定比率。
export function getPbSellPrice(item) {
  return Math.max(1, Math.ceil(getPbDailyPrice(item) * PB_SELL_RATIO));
}

// 撫でる(1日1回)
export function petPbCat(player) {
  if (player.getDynamicProperty(PET_DAY_KEY) === world.getDay()) return { ok: false, reason: "alreadyPetted" };
  player.setDynamicProperty(PET_DAY_KEY, world.getDay());
  const mood = addPbMood(player, PB_PET_MOOD_GAIN);
  return { ok: true, mood };
}

// 魚をあげる(タラ/サケを1匹消費)。機嫌が上限ならあげない(魚を無駄にしない)。
export function giftFishToPbCat(player) {
  if (getPbMood(player) >= PB_MOOD_MAX) return { ok: false, reason: "moodMax" };
  const inv = player.getComponent("inventory")?.container;
  if (!inv) return { ok: false, reason: "noFish" };

  for (let i = 0; i < inv.size; i++) {
    const stack = inv.getItem(i);
    if (!stack || !PB_GIFT_FISH.includes(stack.typeId)) continue;
    if (stack.amount > 1) {
      stack.amount -= 1;
      inv.setItem(i, stack);
    } else {
      inv.setItem(i, undefined);
    }
    const mood = addPbMood(player, PB_GIFT_MOOD_GAIN);
    return { ok: true, mood };
  }
  return { ok: false, reason: "noFish" };
}

// ---- 売買(小口・1個ずつ。既存の動物交易と同じ操作感) ----

export function buyFromPb(player, item) {
  if (item.license && !hasQualification(player, item.license)) return { ok: false, reason: "licenseRequired" };

  const price = getPbBuyPrice(player, item);
  const acc = getAccount(player);
  if (acc.apple < price) return { ok: false, reason: "insufficientCurrency" };

  // 1回の購入は1口(lot個)。在庫もlot個ずつ減る
  const removed = removeShopStock(poolId(item), item.lot);
  if (!removed.ok) return { ok: false, reason: "soldOut" };

  // ベルボート方式(動物交易と同じ): インベントリへ直接付与せず足元にドロップする
  player.dimension.spawnItem(new ItemStack(item.id, item.lot), player.location);
  player.setDynamicProperty("acc_curr_apple", acc.apple - price);
  return { ok: true, price };
}

export function sellToPb(player, item) {
  // 1回の納品は1口(lot個)。lot個そろっていなければ受け付けない
  if (getItemCount(player, item.id) < item.lot) return { ok: false, reason: "noItem" };
  removeItem(player, item.id, item.lot);

  const price = getPbSellPrice(item);
  const acc = getAccount(player);
  player.setDynamicProperty("acc_curr_apple", acc.apple + price);
  addShopStock(poolId(item), item.lot);
  return { ok: true, price };
}
