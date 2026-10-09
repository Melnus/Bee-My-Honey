import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { CURRENCIES } from "../data/market-data.js";
import { itemLocKey } from "../data/mob-trade-data.js";
import { FM_GENRES, FM_BUY_QUANTITIES, FM_LIST_MAX_ORDERS, FM_CHART_POINTS } from "../data/fresh-market-data.js";
import { GENRE_TAGS, REGION_TAGS, getRegionTagAt } from "../data/tag-dictionary.js";
import { getAccount } from "../economy/bank.js";
import { buildSparkline } from "../economy/market-engine.js";
import { getExchangePriceHistory } from "../economy/trade-pool.js";
import {
  ensureFreshMarketMaintained,
  claimFreshMarketEarnings,
  listItemOrders,
  countGenreOrders,
  getOrderFreshnessPercent,
  getSuggestedPrice,
  findDeliverableShulker,
  deliverToMarket,
  buyFromOrder
} from "../economy/fresh-market.js";

// ==========================================
// 生鮮市場 UI / Fresh Market Menu
// ------------------------------------------
// GLB窓口(苔ブロック+植木鉢)の画面から入る。構成:
//   トップ(ジャンル一覧) → ジャンルページ(品目一覧+納品) → 品目ページ(価格推移+出品リスト) → 購入数量
// 出品は匿名で、UIには出品番号(#no)だけを出す(issuerは代金の入金先解決用に内部保持)。
// 戻り先(GLB窓口のトップ)は onBack で受け取る(mob-trade-menu.js との循環importを避けるため)。
// ==========================================

function locName(item) {
  return { translate: itemLocKey({ id: item.id, key: item.locKey }) };
}

function currencyName(lang) {
  return t(lang, CURRENCIES.glow_berry.name);
}

function regionLabel(lang, regionTag) {
  return REGION_TAGS[regionTag] ? t(lang, REGION_TAGS[regionTag].name) : regionTag;
}

// 価格推移の1行グラフ。履歴が2件未満なら「まだ約定履歴がありません」。
function buildHistoryText(lang, itemId) {
  const history = getExchangePriceHistory(itemId).slice(-FM_CHART_POINTS);
  if (history.length < 2) return t(lang, STR.fmChartNone);
  const prices = history.map((h) => h.price);
  return `${buildSparkline(prices)}\n${t(lang, STR.fmChartLatest, prices[prices.length - 1], currencyName(lang))}`;
}

// トップ: ジャンル一覧
export function openFreshMarket(player, onBack) {
  const lang = getLang(player);
  ensureFreshMarketMaintained();

  const earned = claimFreshMarketEarnings(player);
  if (earned > 0) player.sendMessage(t(lang, STR.fmEarnings, earned, currencyName(lang)));

  const acc = getAccount(player);
  const form = new ActionFormData()
    .title(t(lang, STR.fmTitle))
    .body(t(lang, STR.fmBody, acc.glow_berry, currencyName(lang)));

  for (const genre of FM_GENRES) {
    const name = t(lang, GENRE_TAGS[genre.tag].name);
    form.button(`${GENRE_TAGS[genre.tag].icon}§r ${name}${t(lang, STR.fmGenreLine, countGenreOrders(genre.tag))}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === FM_GENRES.length) return onBack();
    openFmGenre(player, FM_GENRES[res.selection], onBack);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ジャンルページ: 品目一覧(最安値・出品件数) + 納品
function openFmGenre(player, genre, onBack) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const cur = currencyName(lang);

  const form = new ActionFormData()
    .title(t(lang, GENRE_TAGS[genre.tag].name))
    .body(t(lang, STR.fmGenreBody, t(lang, GENRE_TAGS[genre.tag].name), acc.glow_berry, cur));

  for (const item of genre.items) {
    const orders = listItemOrders(genre.tag, item.id);
    const line = orders.length > 0
      ? t(lang, STR.fmItemLine, orders[0].price, cur, orders.length)
      : t(lang, STR.fmItemNoneLine);
    form.button({ rawtext: [locName(item), { text: line }] });
  }
  form.button(t(lang, STR.fmDeliverBtn));
  form.button(t(lang, STR.back));

  const n = genre.items.length;
  form.show(player).then((res) => {
    if (res.canceled || res.selection === n + 1) return openFreshMarket(player, onBack);
    if (res.selection === n) return openFmDeliverConfirm(player, genre, onBack);
    openFmItem(player, genre, genre.items[res.selection], onBack);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 品目ページ: 上=価格推移グラフ / 下=出品リスト(安い順・上位のみ)
function openFmItem(player, genre, item, onBack) {
  const lang = getLang(player);
  const cur = currencyName(lang);
  const orders = listItemOrders(genre.tag, item.id).slice(0, FM_LIST_MAX_ORDERS);

  const body = `${t(lang, STR.fmChartHeader)}\n${buildHistoryText(lang, item.id)}` +
    (orders.length === 0 ? `\n\n${t(lang, STR.fmNoOrders)}` : "");

  const form = new ActionFormData()
    .title(locName(item))
    .body(body);

  for (const o of orders) {
    const pct = getOrderFreshnessPercent(o);
    const fresh = pct === null ? t(lang, STR.fmFreshNone) : t(lang, STR.fmFreshLabel, pct);
    const own = o.issuer?.id === player.id ? t(lang, STR.fmOwnMark) : "";
    form.button(
      t(lang, STR.fmOrderLine, o.no, o.price, cur, o.quantity) + own +
      t(lang, STR.fmOrderMeta, fresh, regionLabel(lang, o.regionTag))
    );
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === orders.length) return openFmGenre(player, genre, onBack);
    const order = orders[res.selection];
    if (order.issuer?.id === player.id) {
      player.sendMessage(t(lang, STR.fmBuyOwn));
      return openFmItem(player, genre, item, onBack);
    }
    openFmBuyQuantity(player, genre, item, order, onBack);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 購入数量の選択(1個 / 16個 / 64個 / 残り全部)
function openFmBuyQuantity(player, genre, item, order, onBack) {
  const lang = getLang(player);
  const cur = currencyName(lang);
  const acc = getAccount(player);

  // 1回の受け取りが1スタックを超えないよう、選択肢は64個まで
  const options = FM_BUY_QUANTITIES.filter((q) => q <= order.quantity);
  if (order.quantity <= 64 && !options.includes(order.quantity)) options.push(order.quantity);

  const form = new ActionFormData()
    .title(locName(item))
    .body(t(lang, STR.fmBuyQtyBody, order.no, order.price, cur, order.quantity, acc.glow_berry));
  for (const q of options) form.button(t(lang, STR.fmBuyQtyBtn, q, order.price * q, cur));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === options.length) return openFmItem(player, genre, item, onBack);
    executeFmBuy(player, genre, item, order, options[res.selection], onBack);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function executeFmBuy(player, genre, item, order, qty, onBack) {
  const lang = getLang(player);
  const result = buyFromOrder(player, genre.tag, order.id, qty);

  if (!result.ok) {
    const msg = result.reason === "insufficientCurrency" ? t(lang, STR.fmBuyInsufficient)
      : result.reason === "insufficientStock" ? t(lang, STR.fmBuyLack, result.available)
      : t(lang, STR.fmBuyGone);
    player.sendMessage(msg);
  } else {
    player.sendMessage({
      rawtext: [
        { text: t(lang, STR.mobTradeBuySuccessPrefix) },
        locName(item),
        { text: t(lang, STR.fmBuyDoneSuffix, qty, result.total, currencyName(lang)) }
      ]
    });
  }
  openFmItem(player, genre, item, onBack);
}

// 納品: 近くの満載シュルカーを探し、内訳と価格の目安を見せてから価格入力モーダルへ
function openFmDeliverConfirm(player, genre, onBack) {
  const lang = getLang(player);
  const cur = currencyName(lang);

  const found = findDeliverableShulker(player, genre.tag);
  if (!found) {
    player.sendMessage(t(lang, STR.fmDeliverNone));
    return openFmGenre(player, genre, onBack);
  }

  const regionTag = getRegionTagAt(player.dimension, player.location);
  const kinds = genre.items.filter((i) => found.counts[i.id]);

  const rawtext = [{ text: t(lang, STR.fmDeliverHeader, t(lang, GENRE_TAGS[genre.tag].name), regionLabel(lang, regionTag)) }];
  for (const item of kinds) {
    const band = getSuggestedPrice(item.id, regionTag);
    rawtext.push(locName(item));
    rawtext.push({ text: t(lang, STR.fmDeliverKindSuffix, found.counts[item.id], band.lo, band.hi, cur) });
    rawtext.push({ text: `${buildHistoryText(lang, item.id)}\n` });
  }

  const form = new ActionFormData()
    .title(t(lang, STR.fmDeliverBtn))
    .body({ rawtext })
    .button(t(lang, STR.fmDeliverInputBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection !== 0) return openFmGenre(player, genre, onBack);
    // Action → Modal の連続表示は同tick内だと落ちる環境があるため、1tick遅らせる
    system.run(() => openFmDeliverPrices(player, genre, kinds, regionTag, onBack));
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 価格入力モーダル(品目ごとに1欄。初期値=価格の目安)
function openFmDeliverPrices(player, genre, kinds, regionTag, onBack) {
  const lang = getLang(player);
  const cur = currencyName(lang);

  const form = new ModalFormData().title(t(lang, STR.fmDeliverBtn));
  for (const item of kinds) {
    const band = getSuggestedPrice(item.id, regionTag);
    form.textField(
      { rawtext: [locName(item), { text: t(lang, STR.fmDeliverPriceLabel, band.lo, band.hi, cur) }] },
      String(band.suggested),
      { defaultValue: String(band.suggested) }
    );
  }

  form.show(player).then((res) => {
    if (res.canceled) return openFmGenre(player, genre, onBack);
    const prices = {};
    kinds.forEach((item, i) => {
      prices[item.id] = Number(String(res.formValues[i] ?? "").trim());
    });

    const result = deliverToMarket(player, genre.tag, prices);
    if (!result.ok) {
      player.sendMessage(t(lang, result.reason === "boardFull" ? STR.fmDeliverBoardFull : STR.fmDeliverNone));
    } else {
      player.sendMessage(t(lang, STR.fmDeliverDone, result.orders.length));
    }
    openFmGenre(player, genre, onBack);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}


