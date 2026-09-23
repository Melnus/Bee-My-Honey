import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import { getCreditInfo } from "../economy/credit.js";
import {
  hasCard, applyForCard, getAvailableCredit, purchaseItem, payCardBalance,
  restructureCard, settleCardDebt,
  getMailOrderCategories, getCatalogForCategory, getTodayBargainItems, getDailyAdCopy,
  MAIL_SHIPPING_FEE, PRIME_STANDARD_WEEKLY_FEE, SKEIN_PRIME_PREMIUM_THRESHOLD,
  hasMailOrderPrimeStandard, subscribeMailOrderPrime, unsubscribeMailOrderPrime,
  hasSkeinPrimePremium, isSkeinPrimePremiumEligible, toggleSkeinPrimePremium, getSkeinStockValue
} from "../economy/mail-order.js";

// ==========================================
// 郵便販売メニュー UI / Mail Order Menu
// 書見台に紙でインタラクトして開く
// ==========================================
export function openMailOrderMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const info = getCreditInfo(player);

  const body = lang === "ja"
    ? `地平線の彼方から、あなたのチェストまで。§o- Skein -§r\n所持: ${acc.emeralds}E\nカード利用可能額: ${hasCard(player) ? getAvailableCredit(player) + "E" : "未発行"}\nカード延滞: ${info.cardOverdue ? "あり" : "なし"}`
    : `From beyond the horizon, to your chest. §o- Skein -§r\nBalance: ${acc.emeralds}E\nAvailable credit: ${hasCard(player) ? getAvailableCredit(player) + "E" : "No card"}\nCard overdue: ${info.cardOverdue ? "Yes" : "No"}`;

  const form = new ActionFormData()
    .title(lang === "ja" ? "郵便販売 (Skein)" : "Mail Order (Skein)")
    .body(body)
    .button(t(lang, STR.mailBrowseCategoriesBtn))
    .button(t(lang, STR.mailBargainBtn))
    .button(t(lang, STR.mailPrimeBtn, hasMailOrderPrimeStandard(player) || hasSkeinPrimePremium(player)))
    .button(lang === "ja" ? "カード管理" : "Manage Card")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 4) return;
    if (res.selection === 0) return openCategoryList(player);
    if (res.selection === 1) return openBargainCorner(player);
    if (res.selection === 2) return openPrimeMenu(player);
    if (res.selection === 3) return openCardManagement(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- カテゴリ一覧 ----------
function openCategoryList(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const categories = getMailOrderCategories();

  const ad = getDailyAdCopy();
  const adLine = `§o${lang === "ja" ? ad.ja : ad.en}§r`;

  const form = new ActionFormData()
    .title(t(lang, STR.mailCategoryListTitle))
    .body(`${t(lang, STR.mailCategoryListBody, acc.emeralds)}\n\n${adLine}`);

  categories.forEach((cat) => {
    form.button(`${t(lang, cat.name)}\n§0(${t(lang, cat.tier)})§r`);
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === categories.length) return openMailOrderMenu(player);
    openCatalog(player, categories[res.selection].key);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- 通常カタログ（カテゴリ別） ----------
function openCatalog(player, catKey) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const fee = hasMailOrderPrimeStandard(player) ? 0 : MAIL_SHIPPING_FEE;
  const items = getCatalogForCategory(catKey);

  const form = new ActionFormData()
    .title(lang === "ja" ? "カタログ" : "Catalog")
    .body(t(lang, STR.mailCatalogBody, acc.emeralds, fee));

  items.forEach((item) => {
    form.button(`${t(lang, item.name)}\n${item.price}E`);
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === items.length) return openCategoryList(player);
    handlePurchase(player, items[res.selection], () => openCatalog(player, catKey));
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- 本日のお買い得コーナー（レア5点・割引） ----------
function openBargainCorner(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const items = getTodayBargainItems();

  const form = new ActionFormData()
    .title(t(lang, STR.mailBargainTitle))
    .body(t(lang, STR.mailBargainBody, acc.emeralds));

  items.forEach((item) => {
    form.button(`${t(lang, item.name)}\n${t(lang, STR.mailBargainButtonLine, item.price, item.originalPrice)}`);
  });
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === items.length) return openMailOrderMenu(player);
    handlePurchase(player, items[res.selection], () => openBargainCorner(player));
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- 購入処理の共通ハンドラ ----------
function handlePurchase(player, item, reopen) {
  const lang = getLang(player);
  const result = purchaseItem(player, item, 1);
  if (!result.ok) {
    const msgs = {
      card_suspended: lang === "ja" ? "§cカードが利用停止中です。" : "§cYour card is suspended.",
      no_card: lang === "ja" ? "§c現金が足りず、カードも未発行です。" : "§cNot enough cash, and no card on file.",
      credit_limit: lang === "ja" ? "§c利用限度額を超えています。" : "§cExceeds your credit limit."
    };
    player.sendMessage(msgs[result.reason] ?? (lang === "ja" ? "§c購入できませんでした。" : "§cCould not purchase."));
  } else {
    player.sendMessage(t(lang, STR.mailPurchaseMsg, t(lang, item.name), result.fromCash, result.fromCard, result.shipping));
  }
  reopen();
}

// ---------- プライム会員管理 ----------
function openPrimeMenu(player) {
  const lang = getLang(player);
  const sknValue = Math.round(getSkeinStockValue(player));
  const premiumActive = hasSkeinPrimePremium(player);
  const premiumEligible = isSkeinPrimePremiumEligible(player);
  const standardActive = hasMailOrderPrimeStandard(player);

  const form = new ActionFormData()
    .title(t(lang, STR.mailPrimeTitle))
    .body(t(lang, STR.mailPrimeBody, PRIME_STANDARD_WEEKLY_FEE, sknValue, SKEIN_PRIME_PREMIUM_THRESHOLD, premiumActive, premiumEligible))
    .button(standardActive ? t(lang, STR.mailPrimeStandardUnsubBtn) : t(lang, STR.mailPrimeStandardSubBtn))
    .button(premiumActive ? t(lang, STR.mailPrimePremiumUnsubBtn) : t(lang, STR.mailPrimePremiumSubBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openMailOrderMenu(player);
    if (res.selection === 0) {
      if (standardActive) {
        unsubscribeMailOrderPrime(player);
        player.sendMessage(t(lang, STR.mailPrimeStandardUnsubMsg));
      } else {
        subscribeMailOrderPrime(player);
        player.sendMessage(t(lang, STR.mailPrimeStandardSubMsg));
      }
    } else if (res.selection === 1) {
      const result = toggleSkeinPrimePremium(player);
      if (!result.ok) {
        player.sendMessage(t(lang, STR.mailPrimePremiumNotEligible));
      } else {
        player.sendMessage(t(lang, result.active ? STR.mailPrimePremiumSubMsg : STR.mailPrimePremiumUnsubMsg));
      }
    }
    openPrimeMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- カード管理（既存機能） ----------
function openCardManagement(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const info = getCreditInfo(player);

  if (!hasCard(player)) {
    const form = new ActionFormData()
      .title(lang === "ja" ? "カード発行" : "Card Application")
      .body(lang === "ja" ? "後払いクレジットカードに申し込みますか？限度額は信用スコアで決まります。" : "Apply for a credit card? Limit is based on your credit score.")
      .button(lang === "ja" ? "申し込む" : "Apply")
      .button(t(lang, STR.back));

    form.show(player).then((res) => {
      if (res.canceled || res.selection === 1) return openMailOrderMenu(player);
      const result = applyForCard(player);
      if (!result.approved) {
        player.sendMessage(lang === "ja" ? `§c審査に通りませんでした(信用スコア${result.score})。` : `§cApplication denied (score ${result.score}).`);
      } else {
        player.sendMessage(
          lang === "ja"
            ? `§aカードが発行されました。限度額${result.limit}E / 最低返済額${result.minPayment}E(固定)`
            : `§aCard issued. Limit ${result.limit}E / Fixed min payment ${result.minPayment}E`
        );
      }
      openMailOrderMenu(player);
    }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
    return;
  }

  const body = lang === "ja"
    ? `利用限度額: ${info.cardLimit}E\n利用残高: ${info.cardBalance}E\n最低返済額(固定): ${info.cardMinPayment}E\n延滞: ${info.cardOverdue ? "あり" : "なし"}`
    : `Limit: ${info.cardLimit}E\nBalance: ${info.cardBalance}E\nFixed min payment: ${info.cardMinPayment}E\nOverdue: ${info.cardOverdue ? "Yes" : "No"}`;

  const form = new ActionFormData()
    .title(lang === "ja" ? "カード管理" : "Card Management")
    .body(body)
    .button(lang === "ja" ? "一括返済する" : "Pay Full Balance")
    .button(lang === "ja" ? "カメさんに相談する(債務整理)" : "Talk to the Turtle (Debt Relief)")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openMailOrderMenu(player);
    if (res.selection === 0) {
      const paid = payCardBalance(player, info.cardBalance);
      player.sendMessage(paid > 0
        ? (lang === "ja" ? `§a${paid}Eを一括返済しました。` : `§aPaid off ${paid}E.`)
        : (lang === "ja" ? "§c返済する残高がないか、現金が不足しています。" : "§cNo balance to pay, or insufficient cash."));
      return openCardManagement(player);
    }
    if (res.selection === 1) return openDebtReliefMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// カメさんによる債務整理窓口。返済に行き詰まったプレイヤーの救済措置。
function openDebtReliefMenu(player) {
  const lang = getLang(player);
  const info = getCreditInfo(player);

  if (info.cardBalance <= 0) {
    player.sendMessage(lang === "ja" ? "現在、整理すべき債務はありません。" : "You have no debt to relieve.");
    return openCardManagement(player);
  }

  const form = new ActionFormData()
    .title(lang === "ja" ? "カメさんの相談窓口" : "The Turtle's Advisory Desk")
    .body(
      lang === "ja"
        ? `現在の残高: ${info.cardBalance}E\n\n【組み直し】最低返済額を下げ、延滞を解消。利息は継続。信用情報が軽く悪化。\n\n【債務整理】残債を半額に。カードは一定期間停止し、信用情報が大きく悪化。`
        : `Current balance: ${info.cardBalance}E\n\n[Restructure] Lower min payment, clear overdue. Interest continues. Minor credit hit.\n\n[Settle] Reduce balance by half. Card suspended. Major credit hit.`
    )
    .button(lang === "ja" ? "返済計画を組み直す" : "Restructure Plan")
    .button(lang === "ja" ? "債務整理する" : "Settle Debt")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openCardManagement(player);
    if (res.selection === 0) {
      const result = restructureCard(player);
      player.sendMessage(lang === "ja" ? `§a最低返済額を${result.newMin}Eに変更しました。` : `§aMin payment lowered to ${result.newMin}E.`);
    } else {
      const result = settleCardDebt(player);
      player.sendMessage(
        lang === "ja"
          ? `§e残債を${result.reduced}Eに減額しました。カードは利用停止になります。`
          : `§eBalance reduced to ${result.reduced}E. Card is now suspended.`
      );
    }
    openCardManagement(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
