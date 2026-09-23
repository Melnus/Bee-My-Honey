import { world, system } from "@minecraft/server";
import { getAccount, giveItem, giveEnchantedItem } from "./bank.js";
import { adjustCredit, getCreditScore, recordOverdue, clearOverdue } from "./credit.js";
import { getStockPrice } from "./market-engine.js";
import {
  MAIL_ORDER_CATEGORIES, MAIL_ORDER_CATALOG, MAIL_ORDER_RARE_POOL,
  BARGAIN_DISCOUNT, BARGAIN_ITEM_COUNT
} from "../data/mail-order-data.js";
import { AD_COPY } from "../data/market-data.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// ==========================================
// 郵便販売・クレジットカード / Mail Order & Credit Card
// リボ払いは「契約時に固定した最低返済額」を採用した現実準拠の設計。
// 残高が増えても最低返済額は据え置かれるため、利息負けして
// 元金がほぼ減らない状態(いわゆるリボ地獄)を体験させる。
// ==========================================

// 信用スコア帯ごとの利用限度額と、契約時に固定される最低返済額
const CARD_TIERS = [
  { minScore: 750, limit: 1000, minPayment: 60 },
  { minScore: 650, limit: 500, minPayment: 35 },
  { minScore: 550, limit: 250, minPayment: 20 },
  { minScore: 450, limit: 100, minPayment: 12 }
];

export const CARD_WEEKLY_INTEREST_RATE = 0.03; // 週3%（現実のリボ年利15%前後を週次にデフォルメ）

export function getCardTierForScore(score) {
  return CARD_TIERS.find((t) => score >= t.minScore) ?? null;
}

export function hasCard(player) {
  return (player.getDynamicProperty("cr_card_limit") ?? 0) > 0;
}

// カード申込。信用スコアに応じた限度額・固定最低返済額で発行する。
export function applyForCard(player) {
  if (hasCard(player)) return { approved: false, reason: "already_has_card" };
  const score = getCreditScore(player);
  const tier = getCardTierForScore(score);
  if (!tier) return { approved: false, reason: "score_too_low", score };

  player.setDynamicProperty("cr_card_limit", tier.limit);
  player.setDynamicProperty("cr_card_balance", 0);
  player.setDynamicProperty("cr_card_min_payment", tier.minPayment);
  player.setDynamicProperty("cr_card_suspended", false);
  return { approved: true, limit: tier.limit, minPayment: tier.minPayment };
}

export function getAvailableCredit(player) {
  const limit = player.getDynamicProperty("cr_card_limit") ?? 0;
  const balance = player.getDynamicProperty("cr_card_balance") ?? 0;
  return Math.max(0, limit - balance);
}

// ==========================================
// 日替わりカタログ解決 / Daily Catalog Resolution
// ==========================================
// 決定論的な日替わり乱数（同じ日なら全プレイヤーで同じ結果になる。mob-trade-menu.jsと同じ方式）
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

// variants持ちのエントリを当日分の1点に解決する。通常エントリはそのまま返す。
function resolveEntry(entry, salt = 0) {
  if (!entry.variants || entry.variants.length === 0) return entry;
  const day = world.getDay();
  const rng = mulberry32(day * 1000 + hashString(entry.key) + salt);
  const pick = entry.variants[Math.floor(rng() * entry.variants.length)];
  return { ...entry, itemId: pick.itemId, name: pick.name, variants: undefined };
}

export function getMailOrderCategories() {
  return MAIL_ORDER_CATEGORIES;
}

// カテゴリ一覧画面に出す日替わり広告。上場7社×3本のコピーから1本を
// 日付シードで決定論的に選ぶ（全プレイヤー共通・お買い得コーナーと同じ方式）。
export function getDailyAdCopy() {
  const day = world.getDay();
  const companies = Object.keys(AD_COPY);
  const companyRng = mulberry32(day * 1000 + hashString("mail_order_ad_company"));
  const company = companies[Math.floor(companyRng() * companies.length)];
  const phrases = AD_COPY[company];
  const phraseRng = mulberry32(day * 1000 + hashString("mail_order_ad_phrase_" + company));
  return phrases[Math.floor(phraseRng() * phrases.length)];
}

// カテゴリ内カタログを当日分に解決して返す
export function getCatalogForCategory(catKey) {
  const list = MAIL_ORDER_CATALOG[catKey] ?? [];
  return list.map((e) => resolveEntry(e));
}

// 「今日のお買い得コーナー」: レアプールから日替わりで5点を選び、割引価格を付けて返す
export function getTodayBargainItems() {
  const day = world.getDay();
  const rng = mulberry32(day * 1000 + hashString("mail_order_bargain"));
  const shuffled = [...MAIL_ORDER_RARE_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, BARGAIN_ITEM_COUNT).map((e) => {
    const resolved = resolveEntry(e, 99);
    const discounted = Math.max(1, Math.round(resolved.price * BARGAIN_DISCOUNT));
    return { ...resolved, originalPrice: resolved.price, price: discounted };
  });
}

// ==========================================
// 郵便販売 送料・プライム会員 / Shipping & Prime Membership
// ==========================================
export const MAIL_SHIPPING_FEE = 2; // 1回の注文ごとにかかる送料(E)
export const PRIME_STANDARD_WEEKLY_FEE = 15; // Skeinプライムスタンダードのサブスク料(E/週)
export const SKEIN_PRIME_PREMIUM_THRESHOLD = 300; // プライムプレミアムに加入できる最低SKN評価額(E)

export function hasMailOrderPrimeStandard(player) {
  return !!player.getDynamicProperty("mail_prime_standard");
}

export function subscribeMailOrderPrime(player) {
  player.setDynamicProperty("mail_prime_standard", true);
}

export function unsubscribeMailOrderPrime(player) {
  player.setDynamicProperty("mail_prime_standard", false);
}

// 週次のプライムスタンダード自動引き落とし。残高不足なら自動解約する。
export function applyMailOrderPrimeBilling() {
  for (const player of world.getPlayers()) {
    if (!hasMailOrderPrimeStandard(player)) continue;
    const acc = getAccount(player);
    const lang = getLang(player);
    if (acc.emeralds >= PRIME_STANDARD_WEEKLY_FEE) {
      player.setDynamicProperty("acc_emeralds", acc.emeralds - PRIME_STANDARD_WEEKLY_FEE);
      player.sendMessage(t(lang, STR.primeStandardBilled, PRIME_STANDARD_WEEKLY_FEE));
    } else {
      unsubscribeMailOrderPrime(player);
      player.sendMessage(t(lang, STR.primeStandardCanceled));
    }
  }
}

export function getSkeinStockValue(player) {
  const holds = player.getDynamicProperty("acc_stock_skein") ?? 0;
  return holds * getStockPrice("skein");
}

export function isSkeinPrimePremiumEligible(player) {
  return getSkeinStockValue(player) >= SKEIN_PRIME_PREMIUM_THRESHOLD;
}

export function hasSkeinPrimePremium(player) {
  return !!player.getDynamicProperty("skein_prime_premium");
}

// 保有額を満たしていれば加入/脱退を切り替える。満たさなくなっていれば自動解除。
export function toggleSkeinPrimePremium(player) {
  if (hasSkeinPrimePremium(player)) {
    player.setDynamicProperty("skein_prime_premium", false);
    return { ok: true, active: false };
  }
  if (!isSkeinPrimePremiumEligible(player)) {
    return { ok: false, reason: "not_eligible" };
  }
  player.setDynamicProperty("skein_prime_premium", true);
  return { ok: true, active: true };
}

// 配達エスコート演出: プライムプレミアム会員の元に、荷物と一緒にオウムが飛来する。
function spawnDeliveryParrot(player) {
  try {
    const parrot = player.dimension.spawnEntity("minecraft:parrot", player.location);
    const lang = getLang(player);
    const doesTrick = Math.random() < 0.3;
    player.sendMessage(t(lang, doesTrick ? STR.primeParrotTrick : STR.primeParrotArrive));
    if (doesTrick) {
      try { player.dimension.playSound("mob.parrot.imitate.enderman", player.location); } catch (e) {}
    }
    system.runTimeout(() => {
      try { parrot.remove(); } catch (e) {}
    }, 200);
  } catch (e) {
    console.warn("[BeeMyHoney] Failed to spawn delivery parrot: " + e);
  }
}

// 郵便販売カタログでの購入。所持エメラルド優先、不足分をカード(リボ払い)に回す。
// プライムスタンダード会員は送料が無料になる。
export function purchaseItem(player, item, qty = 1) {
  if (player.getDynamicProperty("cr_card_suspended")) {
    return { ok: false, reason: "card_suspended" };
  }
  const shipping = hasMailOrderPrimeStandard(player) ? 0 : MAIL_SHIPPING_FEE;
  const totalCost = item.price * qty + shipping;
  const acc = getAccount(player);

  const fromCash = Math.min(acc.emeralds, totalCost);
  const remaining = totalCost - fromCash;

  if (remaining > 0) {
    if (!hasCard(player)) return { ok: false, reason: "no_card" };
    const available = getAvailableCredit(player);
    if (available < remaining) return { ok: false, reason: "credit_limit" };
  }

  player.setDynamicProperty("acc_emeralds", acc.emeralds - fromCash);
  if (remaining > 0) {
    const balance = player.getDynamicProperty("cr_card_balance") ?? 0;
    player.setDynamicProperty("cr_card_balance", balance + remaining);
  }

  if (item.enchant || item.enchantPool) {
    const enchant = item.enchant ?? item.enchantPool[Math.floor(Math.random() * item.enchantPool.length)];
    for (let i = 0; i < qty; i++) giveEnchantedItem(player, item.itemId, enchant);
  } else {
    giveItem(player, item.itemId, qty * (item.giveAmount ?? 1));
  }

  if (hasSkeinPrimePremium(player)) spawnDeliveryParrot(player);

  return { ok: true, fromCash, fromCard: remaining, shipping };
}

// 任意タイミングでの追加返済（一括返済ボタン用）。
export function payCardBalance(player, amount) {
  const acc = getAccount(player);
  const balance = player.getDynamicProperty("cr_card_balance") ?? 0;
  const pay = Math.min(amount, balance, acc.emeralds);
  if (pay <= 0) return 0;
  player.setDynamicProperty("acc_emeralds", acc.emeralds - pay);
  player.setDynamicProperty("cr_card_balance", balance - pay);
  return pay;
}

// 週次の請求処理。「利息を先に残高へ加算→固定最低返済額を天引き」の順で、
// 実際のリボ払いと同じ順序にしてある。
export function applyCardBilling() {
  for (const player of world.getPlayers()) {
    if (!hasCard(player)) continue;
    let balance = player.getDynamicProperty("cr_card_balance") ?? 0;
    if (balance <= 0) continue;

    const interest = Math.ceil(balance * CARD_WEEKLY_INTEREST_RATE);
    balance += interest;

    const minPayment = player.getDynamicProperty("cr_card_min_payment") ?? 0;
    const acc = getAccount(player);
    const pay = Math.min(minPayment, balance, acc.emeralds);

    if (pay >= minPayment || pay >= balance) {
      player.setDynamicProperty("acc_emeralds", acc.emeralds - pay);
      balance -= pay;
      player.setDynamicProperty("cr_card_balance", balance);
      player.setDynamicProperty("cr_card_payment_count", (player.getDynamicProperty("cr_card_payment_count") ?? 0) + 1);
      adjustCredit(player, "cardPaymentOnTime");
      clearCardOverdue(player);
      player.sendMessage(`§a[カード] 利息${interest}E込みで${pay}E返済。残高: ${balance}E`);
    } else {
      player.setDynamicProperty("cr_card_balance", balance); // 利息だけは残高に計上される
      recordCardOverdue(player);
      player.sendMessage(`§c[カード] 最低返済額(${minPayment}E)を支払えませんでした。残高: ${balance}E`);
    }
  }
}

function recordCardOverdue(player) {
  player.setDynamicProperty("cr_card_overdue", true);
  const streak = (player.getDynamicProperty("cr_card_overdue_streak") ?? 0) + 1;
  player.setDynamicProperty("cr_card_overdue_streak", streak);
  adjustCredit(player, "overdue");
  if (streak >= 3) {
    suspendCard(player);
  }
}

function clearCardOverdue(player) {
  player.setDynamicProperty("cr_card_overdue", false);
  player.setDynamicProperty("cr_card_overdue_streak", 0);
}

export function suspendCard(player) {
  player.setDynamicProperty("cr_card_suspended", true);
  adjustCredit(player, "cardSuspended");
}

export function reactivateCard(player) {
  player.setDynamicProperty("cr_card_suspended", false);
  player.setDynamicProperty("cr_card_overdue_streak", 0);
}

// ---------- 破産・債務整理(カメさん窓口) ----------
// 組み直し: 最低返済額を下げて延滞を解消する。利息は引き続き発生し、信用情報は軽く悪化。
export function restructureCard(player) {
  const balance = player.getDynamicProperty("cr_card_balance") ?? 0;
  if (balance <= 0) return { ok: false, reason: "no_balance" };
  const minPayment = player.getDynamicProperty("cr_card_min_payment") ?? 10;
  const newMin = Math.max(3, Math.floor(minPayment * 0.6));
  player.setDynamicProperty("cr_card_min_payment", newMin);
  clearCardOverdue(player);
  player.setDynamicProperty("cr_debt_restructured", true);
  adjustCredit(player, "debtRestructured");
  return { ok: true, newMin };
}

// 債務整理: 残債を減額する代わりにカードを一定期間停止し、信用情報を大きく悪化させる。
export function settleCardDebt(player) {
  const balance = player.getDynamicProperty("cr_card_balance") ?? 0;
  if (balance <= 0) return { ok: false, reason: "no_balance" };
  const reduced = Math.floor(balance * 0.5);
  player.setDynamicProperty("cr_card_balance", reduced);
  clearCardOverdue(player);
  player.setDynamicProperty("cr_debt_settled", true);
  suspendCard(player);
  adjustCredit(player, "debtSettled");
  return { ok: true, reduced };
}
