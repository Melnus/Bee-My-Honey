import { itemLabel } from "../economy/item-names.js";
import { variantName } from "../data/variant-items-data.js";
import { world } from "@minecraft/server";
import { calendarLine, anniversariesOn, fixedFestivalLines, formatDate } from "../economy/calendar.js";
import { buildSparkline } from "../economy/market-engine.js";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import { getPolicyParam } from "../economy/policy.js";
import { hasCard, getAvailableCredit } from "../economy/mail-order.js";
import {
  referencePrice, exchangeTree, groupItems, itemInfo, listOffers, quote, buy, marketInfo, marketPrice, sellToMarket, MAX_BUY_QTY, searchItems, getPool, getInbox, listMyListings,
  createListing, cancelListing, listingFee, deliverInbox, shulkerContents, pullToPool, itemTrend
} from "../economy/exchange.js";
import { getFoodCategory, NEVER_SPOIL_ITEMS, FOOD_CATEGORY } from "../data/food-data.js";
import { getFmItem } from "../data/fresh-market-data.js";
import { openFreshMarket } from "./fresh-market-menu.js";
import { promptQuantity } from "./shared.js";
import {
  openCatalog, openBargainCorner, openPrimeMenu, openCardManagement, openDebtReliefMenu
} from "./mail-order-menu.js";

// ==========================================
// 取引所メニュー UI / Exchange Menu  (dev/exchange-spec.md)
// 書見台に紙でインタラクトして開く(旧「郵便販売」の入口を置き換えた)。
// 入荷・出荷は、登録した専用シュルカーが必要。
// ==========================================

// ---- 品目名 ----
// 取引リスト(data/exchange-items-data.js)の日本語名。英語と、リストにない品は、IDを読みやすく整えて出す。
export function exItemName(lang, itemId) { return itemLabel(itemId, lang); }

// 値動き(直近7日の取引)。上がった=緑▲ / 下がった=赤▼ / 変わらない=±0。
function trendChange(tr) {
  if (!tr || tr.dir === 0) return tr && tr.vol > 0 ? "§7[±0]§r" : "";
  const p = Math.abs(Math.round(tr.pct * 10) / 10);
  return tr.dir > 0 ? `§a[▲+${p}%]§r` : `§c[▼-${p}%]§r`;
}
function trendLine(lang, itemId) {
  const tr = itemTrend(itemId);
  if (!tr) return t(lang, STR.exTrendNone);
  return t(lang, STR.exTrendLine, buildSparkline(tr.values), Math.round(tr.last * 10) / 10, trendChange(tr));
}

// 品目名の横の目印。腐る(6日/12日)・腐らない・バルク(シュルカー単位)。
function marks(lang, itemId) {
  let out = "";
  const cat = getFoodCategory(itemId);
  if (cat === FOOD_CATEGORY.RAW) out += " " + t(lang, STR.exMarkDays, 6);
  else if (cat === FOOD_CATEGORY.PROCESSED) out += " " + t(lang, STR.exMarkDays, 12);
  else if (NEVER_SPOIL_ITEMS.has(itemId)) out += " " + t(lang, STR.exMarkNever);
  if (marketInfo(itemId)?.bulk) out += " " + t(lang, STR.exMarkBulk);
  const tr = itemTrend(itemId);
  if (tr && tr.dir !== 0) out += tr.dir > 0 ? " §a▲§r" : " §c▼§r";
  return out;
}

// 出品者の表示。村・会社は、言語に合った名前に [村]/[会社] を付ける。
function sellerLabel(lang, o) {
  if (o.sellerKind === "village" || o.sellerKind === "company" || o.sellerKind === "npc") {
    const nm = o.sellerNames?.[lang] ?? o.sellerName;
    return `${t(lang, o.sellerKind === "village" ? STR.exEntityVillage : o.sellerKind === "npc" ? STR.exEntityNpc : STR.exEntityCompany)}${nm}`;
  }
  return o.sellerName;
}

function guard(p) { return p.catch((e) => console.warn("[BeeMyHoney] UI error: " + e)); }

// ---- トップ ----
export function openExchangeMenu(player) {
  const lang = getLang(player);
  const credit = hasCard(player) ? t(lang, STR.mailCreditAvailable, getAvailableCredit(player)) : t(lang, STR.mailCreditNone);
  const inboxN = Object.keys(getInbox(player.id)).length;
  const form = new ActionFormData()
    .title(t(lang, STR.exTitle))
    .body(calendarLine(lang) + "\n\n" + t(lang, STR.exMenuBody, getAccount(player).emeralds, credit))
    .button(t(lang, STR.exBtnItems))
    .button(t(lang, STR.exBtnSearch))
    .button(t(lang, STR.exBtnShip))
    .button(t(lang, STR.exBtnInboxN, inboxN))
    .button(t(lang, STR.exBtnBargain))
    .button(t(lang, STR.exBtnCustomer))
    .button(t(lang, STR.exBtnLegal))
    .button(t(lang, STR.calBtn))
    .button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 8) return;
    if (res.selection === 7) return openCalendarView(player);
    if (res.selection === 0) return openItemCategories(player);
    if (res.selection === 1) return openSearch(player);
    if (res.selection === 2) return openShipMenu(player);
    if (res.selection === 3) return openInbox(player);
    if (res.selection === 4) return openBargainCorner(player, openExchangeMenu);
    if (res.selection === 5) return openCustomerService(player);
    if (res.selection === 6) return openDebtReliefMenu(player, openExchangeMenu);
  }));
}

// ---- カレンダーを見る(村以外の記念日) ----
function openCalendarView(player) {
  const lang = getLang(player);
  const today = anniversariesOn(world.getDay()).filter((a) => a.id !== "victory" && a.id !== "villagers");
  const note = today.length ? t(lang, STR.calTodayIs, today.map((a) => (lang === "en" ? a.en : a.ja)).join(" / ")) : t(lang, STR.calTodayNone);
  guard(new ActionFormData().title(t(lang, STR.calTitle)).body(t(lang, STR.calExBody, formatDate(world.getDay(), lang), fixedFestivalLines(lang).join("\n"), note))
    .button(t(lang, STR.back)).show(player).then(() => openExchangeMenu(player)));
}

// ---- カスタマーサービス(プライム・カード) ----
function openCustomerService(player) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, STR.exBtnCustomer))
    .body(t(lang, STR.exCustomerBody))
    .button(t(lang, STR.exBtnPrime))
    .button(t(lang, STR.exBtnCard))
    .button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openExchangeMenu(player);
    if (res.selection === 0) return openPrimeMenu(player, openCustomerService);
    if (res.selection === 1) return openCardManagement(player, openCustomerService);
  }));
}

// ---- 物品別リスト(分類 → 小分類 → 品目 → 品目ページ) ----
const gName = (lang, x) => (lang === "ja" ? x.ja : x.en);

function openItemCategories(player) {
  const lang = getLang(player);
  const tree = exchangeTree();
  const form = new ActionFormData().title(t(lang, STR.exCatTitle)).body(t(lang, STR.exCatBody));
  for (const c of tree) form.button(gName(lang, c));
  form.button(t(lang, STR.exCatIntangible));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === tree.length + 1) return openExchangeMenu(player);
    if (res.selection === tree.length) { player.sendMessage(t(lang, STR.exIntangibleMsg)); return openItemCategories(player); }
    openGroupList(player, tree[res.selection].key);
  }));
}

function openGroupList(player, catKey) {
  const lang = getLang(player);
  const cat = exchangeTree().find((c) => c.key === catKey);
  const form = new ActionFormData().title(gName(lang, cat)).body(t(lang, STR.exGroupBody));
  for (const g of cat.groups) form.button(t(lang, STR.exGroupLine, gName(lang, g), g.items.length));
  const extra = [];
  if (catKey === "rare") {
    extra.push({ label: STR.exRareGearBtn, run: () => openCatalog(player, "gear", (p) => openGroupList(p, catKey)) });
    extra.push({ label: STR.exRareBooksBtn, run: () => openCatalog(player, "books", (p) => openGroupList(p, catKey)) });
  }
  for (const e of extra) form.button(t(lang, e.label));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled) return openItemCategories(player);
    if (res.selection < cat.groups.length) return openGroupItems(player, catKey, cat.groups[res.selection].key);
    const e = extra[res.selection - cat.groups.length];
    if (e) return e.run();
    openItemCategories(player);
  }));
}

function openGroupItems(player, catKey, groupKey) {
  const lang = getLang(player);
  const cat = exchangeTree().find((c) => c.key === catKey);
  const g = cat.groups.find((x) => x.key === groupKey);
  const items = groupItems(catKey, groupKey);
  const form = new ActionFormData().title(gName(lang, g)).body(t(lang, STR.exCatBody));
  for (const it of items) {
    const name = exItemName(lang, it.itemId) + marks(lang, it.itemId);
    if (it.market !== null) form.button(t(lang, STR.exItemLineMarket, name, it.price, it.count));
    else form.button(it.count > 0 ? t(lang, STR.exItemLine, name, it.price, it.qty, it.count) : t(lang, STR.exItemLineNone, name));
  }
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === items.length) return openGroupList(player, catKey);
    openItemPage(player, items[res.selection].itemId, { cat: catKey, group: groupKey });
  }));
}

// ---- 検索 ----
function openSearch(player, initial = "") {
  const lang = getLang(player);
  const form = new ModalFormData()
    .title(t(lang, STR.exSearchTitle))
    .textField(t(lang, STR.exSearchLabel), t(lang, STR.exSearchHint), { defaultValue: initial })
    .toggle(t(lang, STR.formBackToggle), { defaultValue: false });
  guard(form.show(player).then((res) => {
    if (res.canceled || res.formValues[1]) return openExchangeMenu(player);
    const q = String(res.formValues[0] ?? "").trim();
    if (!q) { player.sendMessage(t(lang, STR.exSearchEmpty)); return openSearch(player); }
    openSearchResults(player, q);
  }));
}

function openSearchResults(player, q) {
  const lang = getLang(player);
  const hits = searchItems(q);
  if (!hits.length) { player.sendMessage(t(lang, STR.exSearchNone, q)); return openSearch(player, q); }
  const form = new ActionFormData().title(t(lang, STR.exSearchResultTitle, q)).body(t(lang, STR.exSearchResultBody, hits.length));
  for (const h of hits) {
    const cat = exchangeTree().find((c) => c.key === h.cat);
    const grp = cat.groups.find((g) => g.key === h.group);
    form.button(`${exItemName(lang, h.itemId)}${marks(lang, h.itemId)}\n§0${gName(lang, cat)} > ${gName(lang, grp)}§r`);
  }
  form.button(t(lang, STR.exSearchAgain));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === hits.length + 1) return openExchangeMenu(player);
    if (res.selection === hits.length) return openSearch(player, q);
    const h = hits[res.selection];
    openItemPage(player, h.itemId, { cat: h.cat, group: h.group, search: q });
  }));
}

// ---- 品目ページ ----
function openItemPage(player, itemId, ctx) {
  const lang = getLang(player);
  const name = exItemName(lang, itemId);
  const offers = listOffers(itemId);
  const shown = offers.slice(0, 8);
  const lines = shown.map((o) => (o.kind === "market" ? t(lang, STR.exOfferLineMarket, o.price, o.lot) : t(lang, STR.exOfferLine, sellerLabel(lang, o), o.qty, o.price))).join("\n")
    + (offers.length > shown.length ? "\n" + t(lang, STR.exOfferMore, offers.length - shown.length) : "");
  const buyable = offers.some((o) => !(o.kind === "player" && o.sellerId === player.id));
  const actions = [];
  if (buyable) actions.push({ label: STR.exBtnBuy, run: () => startBuy(player, itemId, ctx) });
  actions.push({ label: STR.exBtnListThis, run: () => openShipMenu(player) });
  if (marketInfo(itemId)) actions.push({ label: STR.exBtnSellMarket, run: () => startSellMarket(player, itemId, ctx) });
  if (getFmItem(itemId)) actions.push({ label: STR.exBtnFresh, run: () => openFreshMarket(player, () => openItemPage(player, itemId, ctx)) });
  const form = new ActionFormData()
    .title(t(lang, STR.exOfferTitle, name))
    .body(t(lang, STR.exOfferBody, getAccount(player).emeralds, lines || t(lang, STR.exNoOffersFirst), marks(lang, itemId)) + "\n\n" + trendLine(lang, itemId));
  for (const a of actions) form.button(t(lang, a.label));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === actions.length) return ctx.search ? openSearchResults(player, ctx.search) : openGroupItems(player, ctx.cat, ctx.group);
    actions[res.selection].run();
  }));
}

// ---- 購入 ----
function startBuy(player, itemId, ctx) {
  const lang = getLang(player);
  const name = exItemName(lang, itemId);
  const stock = listOffers(itemId).filter((o) => !(o.kind === "player" && o.sellerId === player.id)).reduce((a, o) => a + o.qty, 0);
  if (stock < 1) { player.sendMessage(t(lang, STR.exBuyNoStock, 0)); return openItemPage(player, itemId, ctx); }
  promptQuantity(player, {
    title: t(lang, STR.exBuyTitle, name),
    max: Math.min(stock, MAX_BUY_QTY),
    onSubmit: (qty) => confirmBuy(player, itemId, qty, ctx),
    onBack: () => openItemPage(player, itemId, ctx)
  });
}

function confirmBuy(player, itemId, qty, ctx) {
  const lang = getLang(player);
  const name = exItemName(lang, itemId);
  const q = quote(player.id, itemId, qty);
  if (!q.ok) { player.sendMessage(t(lang, STR.exBuyNoStock, q.available ?? 0)); return openItemPage(player, itemId, ctx); }
  const cash = getAccount(player).emeralds;
  const hrm = q.plan.filter((s) => s.kind === "hrmhrm").reduce((a, s) => a + s.take * s.price, 0);
  const fromCard = Math.max(0, hrm - Math.max(0, cash - (q.total - hrm)));
  const form = new ActionFormData()
    .title(t(lang, STR.exBuyTitle, name))
    .body(t(lang, STR.exBuyConfirmBody, name, qty, q.total, cash, fromCard))
    .button(t(lang, STR.exBtnConfirmBuy))
    .button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openItemPage(player, itemId, ctx);
    const r = buy(player, itemId, qty);
    if (!r.ok) {
      const msgs = {
        not_enough_stock: t(lang, STR.exBuyNoStock, r.available ?? 0),
        insufficient_funds: t(lang, STR.exBuyNoCash),
        no_card: t(lang, STR.exBuyNoCard),
        card_suspended: t(lang, STR.exBuySuspended),
        credit_limit: t(lang, STR.exBuyCreditLimit)
      };
      player.sendMessage(msgs[r.reason] ?? t(lang, STR.exBuyFailed));
      return openItemPage(player, itemId, ctx);
    }
    player.sendMessage(t(lang, STR.exBuyDone, name, r.qty, r.total, r.fromCard));
    reportDelivery(player, deliverInbox(player));
    openItemPage(player, itemId, ctx);
  }));
}

function reportDelivery(player, res) {
  const lang = getLang(player);
  if (!res.ok) return player.sendMessage(t(lang, res.reason === "unloaded" ? STR.exDeliverUnloaded : STR.exDeliverNoBinding));
  const sum = (m) => Object.values(m).reduce((a, n) => a + n, 0);
  const d = sum(res.delivered), l = sum(res.left);
  if (d > 0) player.sendMessage(t(lang, STR.exDelivered, d));
  if (l > 0) player.sendMessage(t(lang, STR.exDeliverPartial, l));
}

// ---- 入荷一覧 ----
function openInbox(player) {
  const lang = getLang(player);
  const inbox = getInbox(player.id);
  const ids = Object.keys(inbox);
  const form = new ActionFormData().title(t(lang, STR.exInboxTitle));
  if (!ids.length) {
    form.body(t(lang, STR.exInboxEmpty)).button(t(lang, STR.back));
    return guard(form.show(player).then(() => openExchangeMenu(player)));
  }
  const lines = ids.map((id) => `${exItemName(lang, id)} × ${inbox[id]}`).join("\n");
  form.body(t(lang, STR.exInboxBody, lines)).button(t(lang, STR.exBtnDeliver)).button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openExchangeMenu(player);
    reportDelivery(player, deliverInbox(player));
    openInbox(player);
  }));
}

// ---- 出荷一覧 ----
function openShipMenu(player) {
  const lang = getLang(player);
  const pool = getPool(player.id);
  const form = new ActionFormData()
    .title(t(lang, STR.exShipTitle))
    .body(t(lang, STR.exShipBody, Object.keys(pool).length, listMyListings(player.id).length, getPolicyParam("exchange_listing_fee_rate")))
    .button(t(lang, STR.exBtnPull))
    .button(t(lang, STR.exBtnPool))
    .button(t(lang, STR.exBtnMine))
    .button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openExchangeMenu(player);
    if (res.selection === 0) return openPull(player);
    if (res.selection === 1) return openPoolList(player);
    if (res.selection === 2) return openMyListings(player);
  }));
}

function openPull(player) {
  const lang = getLang(player);
  const c = shulkerContents(player);
  if (!c.ok) {
    player.sendMessage(t(lang, c.reason === "unloaded" ? STR.exPullUnloaded : STR.exPullNoBinding));
    return openShipMenu(player);
  }
  const ids = Object.keys(c.items).sort();
  const staleIds = Object.keys(c.stale ?? {}).sort();
  const staleText = staleIds.length ? "\n\n" + t(lang, STR.exPullStale, staleIds.map((id) => `${exItemName(lang, id)} × ${c.stale[id]}`).join("\n")) : "";
  const form = new ActionFormData().title(t(lang, STR.exBtnPull)).body((ids.length ? t(lang, STR.exPullBody) : t(lang, STR.exPullEmpty)) + staleText);
  for (const id of ids) form.button(t(lang, STR.exPoolLine, exItemName(lang, id), c.items[id]));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === ids.length) return openShipMenu(player);
    const id = ids[res.selection];
    promptQuantity(player, {
      title: exItemName(lang, id),
      max: c.items[id],
      onSubmit: (qty) => {
        const r = pullToPool(player, id, qty);
        if (!r.ok) player.sendMessage(t(lang, r.reason === "unloaded" ? STR.exPullUnloaded : STR.exPullNoBinding));
        else {
          if (r.moved > 0) player.sendMessage(t(lang, STR.exPullDone, exItemName(lang, id), r.moved));
          if (r.staleSkipped > 0) player.sendMessage(t(lang, STR.exPullStaleDone, exItemName(lang, id), r.staleSkipped));
        }
        openPull(player);
      },
      onBack: () => openPull(player)
    });
  }));
}

function openPoolList(player) {
  const lang = getLang(player);
  const pool = getPool(player.id);
  const ids = Object.keys(pool).filter((id) => pool[id] > 0).sort();
  const form = new ActionFormData().title(t(lang, STR.exBtnPool)).body(ids.length ? t(lang, STR.exPoolBody) : t(lang, STR.exPoolEmpty));
  for (const id of ids) form.button(t(lang, STR.exPoolLine, exItemName(lang, id), pool[id]));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === ids.length) return openShipMenu(player);
    openPoolItem(player, ids[res.selection]);
  }));
}

function openPoolItem(player, itemId) {
  const lang = getLang(player);
  if (!marketInfo(itemId)) return openListForm(player, itemId);
  const name = exItemName(lang, itemId);
  const form = new ActionFormData()
    .title(name)
    .body(t(lang, STR.exPoolItemBody, name, getPool(player.id)[itemId] ?? 0, marketPrice(itemId)))
    .button(t(lang, STR.exBtnListThis2))
    .button(t(lang, STR.exBtnSellMarket))
    .button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openPoolList(player);
    if (res.selection === 0) return openListForm(player, itemId);
    startSellMarket(player, itemId, null, () => openPoolList(player));
  }));
}

function parseIntStrict(raw) {
  const s = String(raw ?? "").trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  return /^\d+$/.test(s) ? Number(s) : null;
}

function openListForm(player, itemId, init = {}) {
  const lang = getLang(player);
  const name = exItemName(lang, itemId);
  const have = getPool(player.id)[itemId] ?? 0;
  if (have < 1) return openPoolList(player);
  const cap = referencePrice(itemId);
  const form = new ModalFormData()
    .title(t(lang, STR.exListTitle, name))
    .textField(t(lang, STR.exListQtyLabel, have), "1", { defaultValue: String(init.qty ?? have) })
    .textField(t(lang, STR.exListPriceLabel, cap), String(cap), { defaultValue: String(init.price ?? cap) })
    .toggle(t(lang, STR.formBackToggle), { defaultValue: false });
  guard(form.show(player).then((res) => {
    if (res.canceled || res.formValues[2]) return openPoolList(player);
    const qty = parseIntStrict(res.formValues[0]);
    const price = parseIntStrict(res.formValues[1]);
    if (qty === null || price === null || qty < 1 || qty > have || price < 1) {
      player.sendMessage(t(lang, STR.exListInvalid));
      return openListForm(player, itemId, { qty: qty ?? have, price: price ?? cap });
    }
    if (price > cap) {
      player.sendMessage(t(lang, STR.exListHigh, cap));
      return openListForm(player, itemId, { qty, price: cap });
    }
    confirmList(player, itemId, qty, price);
  }));
}

function confirmList(player, itemId, qty, price) {
  const lang = getLang(player);
  const name = exItemName(lang, itemId);
  const fee = listingFee(qty, price);
  const form = new ActionFormData()
    .title(t(lang, STR.exListTitle, name))
    .body(t(lang, STR.exListConfirmBody, name, qty, price, fee))
    .button(t(lang, STR.exBtnConfirmList))
    .button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openListForm(player, itemId, { qty, price });
    const r = createListing(player, itemId, qty, price);
    if (r.ok) player.sendMessage(t(lang, STR.exListDone, name, qty, price, r.fee));
    else {
      const msgs = {
        price_too_high: t(lang, STR.exListHigh, referencePrice(itemId)),
        not_in_pool: t(lang, STR.exListNoPool),
        too_many_listings: t(lang, STR.exListTooMany),
        board_full: t(lang, STR.exListBoardFull),
        insufficient_funds: t(lang, STR.exListNoCash, r.fee ?? fee)
      };
      player.sendMessage(msgs[r.reason] ?? t(lang, STR.exListInvalid));
    }
    openShipMenu(player);
  }));
}

// ---- 相場で売る(取引所プールの品を、相場でシステムに売る) ----
function startSellMarket(player, itemId, ctx, back = () => openItemPage(player, itemId, ctx)) {
  const lang = getLang(player);
  const name = exItemName(lang, itemId);
  const m = marketInfo(itemId);
  const have = getPool(player.id)[itemId] ?? 0;
  const max = Math.floor(have / m.lot) * m.lot;
  if (max < 1) {
    player.sendMessage(t(lang, have > 0 ? STR.exSellMarketLot : STR.exSellMarketNoPool, m.lot));
    return back();
  }
  const go = (qty) => {
    const r = sellToMarket(player, itemId, qty);
    player.sendMessage(r.ok ? t(lang, STR.exSellMarketDone, name, r.qty, r.price, r.total) : t(lang, STR.exSellMarketFailed));
    back();
  };
  if (m.lot > 1) return go(max); // バルクの品は、プールにある分を、箱単位でまとめて売る
  promptQuantity(player, { title: t(lang, STR.exSellMarketTitle, name, marketPrice(itemId)), max, onSubmit: go, onBack: back });
}

function openMyListings(player) {
  const lang = getLang(player);
  const mine = listMyListings(player.id);
  const day = world.getDay();
  const form = new ActionFormData().title(t(lang, STR.exMineTitle)).body(mine.length ? "" : t(lang, STR.exMineEmpty));
  for (const l of mine) form.button(t(lang, STR.exMineLine, exItemName(lang, l.itemId), l.qty, l.price, Math.max(0, l.exp - day)));
  form.button(t(lang, STR.back));
  guard(form.show(player).then((res) => {
    if (res.canceled || res.selection === mine.length) return openShipMenu(player);
    const l = mine[res.selection];
    const name = exItemName(lang, l.itemId);
    const f2 = new ActionFormData()
      .title(t(lang, STR.exMineTitle))
      .body(t(lang, STR.exCancelBody, name, l.qty, l.price))
      .button(t(lang, STR.exBtnCancelListing))
      .button(t(lang, STR.back));
    guard(f2.show(player).then((r2) => {
      if (r2.canceled || r2.selection === 1) return openMyListings(player);
      const r = cancelListing(player, l.itemId, l.id);
      player.sendMessage(r.ok ? t(lang, STR.exCancelDone, name, r.returned) : t(lang, STR.exCancelFailed));
      openMyListings(player);
    }));
  }));
}
