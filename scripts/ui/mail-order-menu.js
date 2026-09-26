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

  const creditText = hasCard(player) ? t(lang, STR.mailCreditAvailable, getAvailableCredit(player)) : t(lang, STR.mailCreditNone);
  const body = t(lang, STR.mailMenuBody, acc.emeralds, creditText, info.cardOverdue);

  const form = new ActionFormData()
    .title(t(lang, STR.mailMenuTitle))
    .body(body)
    .button(t(lang, STR.mailBrowseCategoriesBtn))
    .button(t(lang, STR.mailBargainBtn))
    .button(t(lang, STR.mailPrimeBtn, hasMailOrderPrimeStandard(player) || hasSkeinPrimePremium(player)))
    .button(t(lang, STR.mailBtnManageCard))
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
  const adLine = `§o${t(lang, ad)}§r`;

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
    .title(t(lang, STR.mailCatalogTitle))
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
      card_suspended: t(lang, STR.mailCardSuspendedMsg),
      no_card: t(lang, STR.mailNoCardMsg),
      credit_limit: t(lang, STR.mailCreditLimitMsg)
    };
    player.sendMessage(msgs[result.reason] ?? t(lang, STR.mailPurchaseFailedMsg));
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
      .title(t(lang, STR.mailCardApplyTitle))
      .body(t(lang, STR.mailCardApplyBody))
      .button(t(lang, STR.mailCardApplyBtn))
      .button(t(lang, STR.back));

    form.show(player).then((res) => {
      if (res.canceled || res.selection === 1) return openMailOrderMenu(player);
      const result = applyForCard(player);
      if (!result.approved) {
        player.sendMessage(t(lang, STR.mailCardDeniedMsg, result.score));
      } else {
        player.sendMessage(t(lang, STR.mailCardIssuedMsg, result.limit, result.minPayment));
      }
      openMailOrderMenu(player);
    }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
    return;
  }

  const body = t(lang, STR.mailCardManagementBody, info.cardLimit, info.cardBalance, info.cardMinPayment, info.cardOverdue);

  const form = new ActionFormData()
    .title(t(lang, STR.mailCardManagementTitle))
    .body(body)
    .button(t(lang, STR.mailBtnPayFull))
    .button(t(lang, STR.mailBtnTalkToTurtle))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openMailOrderMenu(player);
    if (res.selection === 0) {
      const paid = payCardBalance(player, info.cardBalance);
      player.sendMessage(paid > 0 ? t(lang, STR.mailPaidFullMsg, paid) : t(lang, STR.mailNoBalanceOrCashMsg));
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
    player.sendMessage(t(lang, STR.mailNoDebtMsg));
    return openCardManagement(player);
  }

  const form = new ActionFormData()
    .title(t(lang, STR.mailTurtleDeskTitle))
    .body(t(lang, STR.mailTurtleDeskBody, info.cardBalance))
    .button(t(lang, STR.mailBtnRestructure))
    .button(t(lang, STR.mailBtnSettleDebt))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openCardManagement(player);
    if (res.selection === 0) {
      const result = restructureCard(player);
      player.sendMessage(t(lang, STR.mailRestructuredMsg, result.newMin));
    } else {
      const result = settleCardDebt(player);
      player.sendMessage(t(lang, STR.mailSettledMsg, result.reduced));
    }
    openCardManagement(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
