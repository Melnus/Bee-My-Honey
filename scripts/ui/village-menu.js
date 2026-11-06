import { regionDef } from "../data/village-regions.js";
import { JOB_BLOCKS } from "../data/village-jobs-data.js";
import { storeCap } from "../economy/village-events.js";
import * as mc from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { coreName, headName } from "../i18n/names.js";
import { itemLabel } from "../economy/item-names.js";
import { getEntityAccount } from "../economy/account.js";
import { getPolicyParam } from "../economy/policy.js";
import { stockValue } from "../economy/company-facility.js";
import { getVillageSlots, reservedCash } from "../economy/village-demand.js";
import { jobCounts } from "../economy/village-jobs.js";
import { listingsOf } from "../economy/exchange.js";
import { barterExecute, barterStockItems, barterQuote } from "../economy/village-barter.js";
import { stackKey } from "../economy/variant-items.js";
import { currentGlobalDay } from "../economy/labor.js";
import { loadCore, saveCore } from "../economy/core-registry.js";
import { promptQuantity } from "./shared.js";
import { countNearby, openDissolveConfirm, requestLines } from "./core-menu.js";
import { eventsAt, carriesFor, acceptCarry, deliverCarry, deliverUrgent } from "../economy/village-events.js";
import { countCarried, takeCarried, giveCarried } from "../economy/carry.js";
import { anniversariesOn, calendarLine, giftAvailable, markGiftClaimed, formatDate, toDate, getVillagersDay, worldRecordLine } from "../economy/calendar.js";
import { giveRewards } from "../economy/tutorial-chain.js";

// ==========================================
// 村専用の画面 / Village Menu  (チケットB。会社の画面のコピーをやめて、村の役割に合わせた)
// ------------------------------------------
// 鐘を触ったときの、村の管理メニュー(会社は従来どおり core-menu.js の6ボタン)。
//   1段目 ★運んでよイベント / 2段目 ★記念日イベント … 発生したときだけ(未実装。出さない)
//   寄り合い所に行く  … 仕事を聞いてみる(職業ブロックのまとめ)/ 欲しいものはないか聞く(物々交換)/ 掲示板のことを聞く(村からの依頼の状況)
//   蔵の門番に尋ねる  … 蔵の在庫・先週つくった品・取引所への出品状況
//   村長の部屋に行く  … 人数・村の懐事情・契約を切る(旧「解散手続き」)
// ==========================================
const fmtN = (n) => Math.round(n).toLocaleString("en-US");
const warn = (e) => console.warn("[BeeMyHoney] village UI error: " + e);
const list = (arr, lang) => (arr.length ? arr.join("\n") : t(lang, STR.vmNone));

export function openVillageMenu(player, core) {
  const lang = getLang(player);
  const day = currentGlobalDay();
  const events = eventsAt(core, day);
  const anns = anniversariesOn(day);
  const f = new ActionFormData()
    .title(t(lang, STR.coreMenuTitleVillage))
    .body(t(lang, STR.coreMenuBody, true, coreName(core, lang), headName(core, lang), core.id));
  const acts = [];
  for (const ev of events) { // 1段目: ★運んでよ / ★緊急調達(起きているときだけ)
    const left = Math.max(0, ev.exp - day);
    if (ev.type === "carry") f.button(t(lang, STR.vmEvCarryBtn, itemLabel(ev.itemId, lang), ev.qty, destName(ev, lang), left)); else f.button(t(lang, STR.vmEvUrgentBtn, itemLabel(ev.itemId, lang), ev.qty, left));
    acts.push(() => (ev.type === "carry" ? openCarryEvent(player, core.id, ev.id) : openUrgentEvent(player, core.id, ev.id)));
  }
  for (const a of anns) { // 2段目: ★記念日(その日だけ)
    f.button(t(lang, STR.vmAnnBtn, lang === "en" ? a.en : a.ja));
    acts.push(() => openAnniversary(player, core.id, a));
  }
  f.button(t(lang, STR.vmBtnMeeting)).button(t(lang, STR.vmBtnGate)).button(t(lang, STR.vmBtnHead));
  const n = acts.length;
  f.show(player).then((r) => {
    if (r.canceled) return;
    if (r.selection < n) return acts[r.selection]();
    if (r.selection === n) return openMeeting(player, core.id);
    if (r.selection === n + 1) return openGate(player, core.id);
    return openHeadRoom(player, core.id);
  }).catch(warn);
}
const destName = (ev, lang) => (lang === "en" ? ev.toNames?.en : ev.toNames?.ja) ?? ev.toNames?.en ?? "?";
const back = (player, id) => { const c = loadCore(id); if (c) openVillageMenu(player, c); };

// ---------- 寄り合い所 ----------
function openMeeting(player, id) {
  const lang = getLang(player);
  new ActionFormData().title(t(lang, STR.vmMeetingTitle)).body(t(lang, STR.vmMeetingBody))
    .button(t(lang, STR.vmBtnJobs)).button(t(lang, STR.vmBtnWants)).button(t(lang, STR.vmBtnBoard)).button(t(lang, STR.coreBtnBack))
    .show(player).then((r) => {
      if (r.canceled || r.selection === 3) return back(player, id);
      if (r.selection === 0) return openJobs(player, id);
      if (r.selection === 1) return openWants(player, id);
      return openBoard(player, id);
    }).catch(warn);
}
const meetingBack = (player, id) => openMeeting(player, id);

// 仕事を聞いてみる: 職業ブロックの状況のまとめ
function openJobs(player, id) {
  const core = loadCore(id); if (!core) return;
  const lang = getLang(player);
  const perDay = Math.max(1, Math.floor(getPolicyParam("village_job_runs")));
  const all = jobCounts(core); // 検知された職業は全部出す(レシピのないものは「いまは何も作らない」と注記)
  const producing = all.filter((j) => j.recipes.length > 0);
  const lines = [...producing, ...all.filter((j) => j.recipes.length === 0)].map((j) => j.recipes.length > 0
    ? t(lang, STR.vmJobLine, lang === "en" ? j.en : j.ja, j.n, j.recipes.map((r) => itemLabel(r.out, lang)).join(", "), perDay * j.n)
    : t(lang, STR.vmJobLineIdle, lang === "en" ? j.en : j.ja, j.n));
  new ActionFormData().title(t(lang, STR.vmJobsTitle)).body(all.length ? t(lang, STR.vmJobsBody, lines.join("\n"), perDay) : t(lang, STR.vmJobsNone))
    .button(t(lang, STR.coreBtnBack)).show(player).then(() => meetingBack(player, id)).catch(warn);
}

// ---------- 欲しいものはないか聞く(物々交換) ----------
const holdings = (player, itemId) => {
  let n = 0;
  const inv = player.getComponent("inventory")?.container;
  for (let i = 0; inv && i < inv.size; i++) { const s = inv.getItem(i); if (s && stackKey(s) === itemId) n += s.amount; }
  return n;
};
function removeFromPlayer(player, itemId, qty) {
  if (holdings(player, itemId) < qty) return false;
  const inv = player.getComponent("inventory").container;
  let need = qty;
  for (let i = 0; i < inv.size && need > 0; i++) {
    const s = inv.getItem(i);
    if (!s || stackKey(s) !== itemId) continue;
    const n = Math.min(need, s.amount);
    if (n === s.amount) inv.setItem(i, undefined); else { s.amount -= n; inv.setItem(i, s); }
    need -= n;
  }
  return true;
}
function giveToPlayer(player, itemId, n) {
  let left = n;
  while (left > 0) {
    const st = new mc.ItemStack(itemId, 1);
    st.amount = Math.min(left, st.maxAmount ?? 64);
    left -= st.amount;
    const rest = player.getComponent("inventory")?.container?.addItem(st);
    if (rest) player.dimension.spawnItem(rest, player.location);
  }
}

function openWants(player, id) {
  const core = loadCore(id); if (!core) return;
  const lang = getLang(player);
  const slots = getVillageSlots(core, currentGlobalDay(), player.name, player.id).filter((s) => s.left > 0);
  const f = new ActionFormData().title(t(lang, STR.vmWantsTitle));
  if (!slots.length) { f.body(t(lang, STR.vmWantsNone)).button(t(lang, STR.coreBtnBack)).show(player).then(() => meetingBack(player, id)).catch(warn); return; }
  f.body(t(lang, STR.vmWantsBody, Math.round(getPolicyParam("village_barter_ratio") * 100)));
  for (const s of slots) f.button(t(lang, STR.vmWantBtn, itemLabel(s.itemId, lang), s.left, holdings(player, s.itemId)));
  f.button(t(lang, STR.coreBtnBack));
  f.show(player).then((r) => {
    if (r.canceled || r.selection === slots.length) return meetingBack(player, id);
    const slot = slots[r.selection];
    const have = holdings(player, slot.itemId);
    if (have < 1) { player.sendMessage(t(lang, STR.vmBarterNoHave)); return openWants(player, id); }
    if (!barterStockItems(core).filter((x) => x.itemId !== slot.itemId).length) { player.sendMessage(t(lang, STR.vmBarterNoStock)); return openWants(player, id); }
    promptQuantity(player, {
      title: itemLabel(slot.itemId, lang), max: Math.min(slot.left, have),
      onSubmit: (qty) => pickTake(player, id, slot.itemId, qty),
      onBack: () => openWants(player, id)
    });
  }).catch(warn);
}

function pickTake(player, id, wantId, qty) {
  const core = loadCore(id); if (!core) return;
  const lang = getLang(player);
  const opts = barterStockItems(core).filter((x) => x.itemId !== wantId)
    .map((x) => ({ ...x, q: barterQuote(core, wantId, qty, x.itemId) })).filter((x) => x.q.ok);
  if (!opts.length) { player.sendMessage(t(lang, STR.vmBarterNoStock)); return openWants(player, id); }
  const f = new ActionFormData().title(t(lang, STR.vmWantsTitle)).body(t(lang, STR.vmBarterPick, itemLabel(wantId, lang), qty));
  for (const o of opts) f.button(t(lang, STR.vmBarterOption, itemLabel(o.itemId, lang), o.q.n, o.n));
  f.button(t(lang, STR.coreBtnBack));
  f.show(player).then((r) => {
    if (r.canceled || r.selection === opts.length) return openWants(player, id);
    const take = opts[r.selection];
    const c = loadCore(id); if (!c) return;
    const res = barterExecute(c, { id: player.id, name: player.name }, wantId, qty, take.itemId,
      { remove: (item, n) => removeFromPlayer(player, item, n), add: (item, n) => giveToPlayer(player, item, n) });
    if (!res.ok) { player.sendMessage(t(lang, STR.vmBarterFail)); return openWants(player, id); }
    player.sendMessage(t(lang, STR.vmBarterDone, itemLabel(wantId, lang), qty, itemLabel(take.itemId, lang), res.n));
    openWants(player, id);
  }).catch(warn);
}

// 掲示板のことを聞く: 村の資金・今日の必要数・受注の状況(進行中の表示のみ)
function openBoard(player, id) {
  const core = loadCore(id); if (!core) return;
  const lang = getLang(player);
  const r = requestLines(core, lang, player);
  const acct = getEntityAccount(id);
  new ActionFormData().title(t(lang, STR.vmBoardTitle))
    .body(t(lang, STR.vmBoardBody, fmtN(acct?.cash ?? 0), fmtN(reservedCash(core)), r.today, r.orders))
    .button(t(lang, STR.coreBtnBack)).show(player).then(() => meetingBack(player, id)).catch(warn);
}

// ---------- 蔵の門番 ----------
function openGate(player, id) {
  const core = loadCore(id); if (!core) return;
  const lang = getLang(player);
  const stock = Object.entries(core.stock ?? {}).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).map(([k, n]) => `・${itemLabel(k, lang)} ×${fmtN(n)}`);
  const imp = Object.entries(core.lastShip?.imported ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `・${itemLabel(k, lang)} ×${fmtN(n)}`);
  const made = Object.entries(core.lastShip?.produced ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `・${itemLabel(k, lang)} ×${fmtN(n)}`);
  const today = currentGlobalDay();
  const listed = listingsOf(id).map((l) => t(lang, STR.vmGateListLine, itemLabel(l.itemId, lang), fmtN(l.qty), Math.round(l.price * 10) / 10, Math.max(0, l.exp - Math.floor(today))));
  const mine = carriesFor(id, player);
  const f = new ActionFormData().title(t(lang, STR.vmGateTitle))
    .body(t(lang, STR.vmGateBody, list(stock, lang), fmtN(stockValue(core.stock ?? {})), list(made, lang), list(listed, lang)) + (imp.length ? t(lang, STR.vmGateImported, imp.join("\n")) : ""));
  if (mine.length) f.button(t(lang, STR.vmGateDeliverBtn, mine.length));
  f.button(t(lang, STR.coreBtnBack));
  f.show(player).then((r) => {
    if (r.canceled || r.selection === (mine.length ? 1 : 0)) return back(player, id);
    openDeliverList(player, id);
  }).catch(warn);
}

// 届け物を渡す(この村宛ての、引き受け済みの運んでよ)
function openDeliverList(player, id) {
  const lang = getLang(player);
  const day = currentGlobalDay();
  const mine = carriesFor(id, player);
  if (!mine.length) return openGate(player, id);
  const f = new ActionFormData().title(t(lang, STR.vmGateDeliverTitle)).body(t(lang, STR.vmGateDeliverBody));
  for (const m of mine) { const from = loadCore(m.hostId); f.button(t(lang, STR.vmGateDeliverLine, itemLabel(m.ev.itemId, lang), m.ev.qty, from ? coreName(from, lang) : "?", Math.max(0, m.ev.exp - day))); }
  f.button(t(lang, STR.coreBtnBack));
  f.show(player).then((r) => {
    if (r.canceled || r.selection === mine.length) return openGate(player, id);
    const m = mine[r.selection];
    const res = deliverCarry(id, m.hostId, m.ev.id, player, carryOps(player));
    reportDelivery(player, lang, res, m.ev.itemId);
    openDeliverList(player, id);
  }).catch(warn);
}

const carryOps = (player) => ({ count: (item) => countCarried(player, item), take: (item, n) => takeCarried(player, item, n) });
function reportDelivery(player, lang, res, itemId) {
  if (res.ok) return player.sendMessage(t(lang, STR.vmEvDelivered, itemLabel(res.itemId, lang), res.qty, res.paid, res.short));
  if (res.reason === "full") return player.sendMessage(t(lang, STR.vmEvFull));
  if (res.reason === "not_enough") return player.sendMessage(t(lang, STR.vmEvNotEnough, res.have ?? 0, res.need ?? 0));
  player.sendMessage(t(lang, STR.vmEvGone));
}

// ---------- 村長の部屋 ----------
// カレンダーを見る(村長の部屋): 村に関わる記念日(戦勝記念日・村民の日)の登録の状態と、今日が記念日かどうか
function openVillageCalendar(player, id) {
  const lang = getLang(player);
  const day = mc.world.getDay();
  const today = anniversariesOn(day);
  let note = today.length ? t(lang, STR.calTodayIs, today.map((a) => (lang === "en" ? a.en : a.ja)).join(" / ")) : t(lang, STR.calTodayNone);
  const gifts = today.filter((a) => (a.gift?.length ?? 0) > 0);
  if (gifts.length) note += "\n" + (gifts.some((a) => giftAvailable(player, a)) ? t(lang, STR.calGiftReady) : t(lang, STR.calGiftTaken));
  new ActionFormData().title(t(lang, STR.calTitle)).body(t(lang, STR.calVillageBody, formatDate(day, lang), worldRecordLine("victory", lang), worldRecordLine("villagers", lang), note))
    .button(t(lang, STR.coreBtnBack)).show(player).then(() => openHeadRoom(player, id)).catch(warn);
}
function regionText(core, lang) {
  const d = regionDef(core);
  const aff = JOB_BLOCKS[d.affinity];
  return t(lang, STR.vmRegionLine, lang === "en" ? d.en : d.ja, lang === "en" ? d.type.en : d.type.ja,
    d.specialty.map((x) => itemLabel(x.itemId, lang)).join(lang === "en" ? ", " : "・"), aff ? (lang === "en" ? aff.en : aff.ja) : "-", fmtN(storeCap(core)));
}
function openHeadRoom(player, id) {
  const core = loadCore(id); if (!core) return;
  const lang = getLang(player);
  const pop = Math.max(0, Math.floor(core.pop ?? 0)); // 記録値を正とする(他の画面・経済側と揃える)
  const acct = getEntityAccount(id);
  const cash = acct?.cash ?? 0, reserved = reservedCash(core);
  const f = new ActionFormData().title(t(lang, STR.vmHeadTitle))
    .body(t(lang, STR.vmHeadBody, coreName(core, lang), headName(core, lang), pop, fmtN(cash), fmtN(reserved), fmtN(Math.max(0, cash - reserved))) + regionText(core, lang));
  f.button(t(lang, STR.vmBtnCutTies)).button(t(lang, STR.calBtn)).button(t(lang, STR.coreBtnBack));
  f.show(player).then((r) => {
    if (r.canceled || r.selection === 2) return back(player, id);
    if (r.selection === 1) return openVillageCalendar(player, id);
    if (core.ownerId !== player.id) { player.sendMessage(t(lang, STR.vmCutOnlyOwner)); return openHeadRoom(player, id); }
    openDissolveConfirm(player, id);
  }).catch(warn);
}

// ---------- ★運んでよ / ★緊急調達 / ★記念日 ----------
function openCarryEvent(player, id, evId) {
  const core = loadCore(id); const lang = getLang(player);
  const ev = core?.events?.find((e) => e.id === evId);
  if (!ev || ev.by) { player.sendMessage(t(lang, STR.vmEvGone)); return back(player, id); }
  const day = currentGlobalDay();
  new ActionFormData().title(t(lang, STR.vmEvCarryBtn, itemLabel(ev.itemId, lang), ev.qty, destName(ev, lang), Math.max(0, ev.exp - day)))
    .body(t(lang, STR.vmEvCarryBody, itemLabel(ev.itemId, lang), ev.qty, destName(ev, lang), fmtN(ev.unit * ev.qty), Math.max(0, ev.exp - day)))
    .button(t(lang, STR.vmEvAccept)).button(t(lang, STR.coreBtnBack))
    .show(player).then((r) => {
      if (r.canceled || r.selection === 1) return back(player, id);
      const res = acceptCarry(id, evId, player);
      if (!res.ok) { player.sendMessage(t(lang, res.reason === "no_stock" ? STR.vmEvNoStock : STR.vmEvGone)); return back(player, id); }
      giveCarried(player, res.itemId, res.qty);
      player.sendMessage(t(lang, STR.vmEvAccepted, itemLabel(res.itemId, lang), res.qty, destName(ev, lang)));
      back(player, id);
    }).catch(warn);
}

function openUrgentEvent(player, id, evId) {
  const core = loadCore(id); const lang = getLang(player);
  const ev = core?.events?.find((e) => e.id === evId);
  if (!ev) { player.sendMessage(t(lang, STR.vmEvGone)); return back(player, id); }
  const have = countCarried(player, ev.itemId);
  const day = currentGlobalDay();
  new ActionFormData().title(t(lang, STR.vmEvUrgentBtn, itemLabel(ev.itemId, lang), ev.qty, Math.max(0, ev.exp - day)))
    .body(t(lang, STR.vmEvUrgentBody, itemLabel(ev.itemId, lang), ev.qty, Math.round(ev.unit * 10) / 10, have, Math.max(0, ev.exp - day)))
    .button(t(lang, STR.vmEvDeliver)).button(t(lang, STR.coreBtnBack))
    .show(player).then((r) => {
      if (r.canceled || r.selection === 1) return back(player, id);
      if (have < 1) { player.sendMessage(t(lang, STR.vmEvNone)); return openUrgentEvent(player, id, evId); }
      promptQuantity(player, {
        title: itemLabel(ev.itemId, lang), max: Math.min(ev.qty, have),
        onSubmit: (qty) => { reportDelivery(player, lang, deliverUrgent(id, evId, qty, player, carryOps(player)), ev.itemId); back(player, id); },
        onBack: () => back(player, id)
      });
    }).catch(warn);
}

function openAnniversary(player, id, a) {
  const lang = getLang(player);
  const day = currentGlobalDay();
  const gift = (a.gift ?? []).map((g) => `${itemLabel(g.id, lang)} ×${g.n}`).join(", ");
  let note = "";
  if (a.id === "victory") note = t(lang, STR.vmAnnNoteHero);
  else {
    if (a.id === "villagers") note = t(lang, STR.vmAnnNoteVillagers, toDate(getVillagersDay() ?? day).year) + "\n";
    note += giftAvailable(player, a) ? t(lang, STR.vmAnnNoteGift, gift) : t(lang, STR.vmAnnNoteClaimed);
  }
  const f = new ActionFormData().title(t(lang, STR.vmAnnBtn, lang === "en" ? a.en : a.ja)).body(t(lang, STR.vmAnnBody, formatDate(day, lang), lang === "en" ? a.en : a.ja, note));
  const canClaim = giftAvailable(player, a);
  if (canClaim) f.button(t(lang, STR.vmAnnClaim));
  f.button(t(lang, STR.coreBtnBack));
  f.show(player).then((r) => {
    if (r.canceled || r.selection !== 0 || !canClaim) return back(player, id);
    if (giftAvailable(player, a)) {
      markGiftClaimed(player, a);
      giveRewards(player, a.gift);
      player.sendMessage(t(lang, STR.vmAnnReceived, gift));
    }
    back(player, id);
  }).catch(warn);
}
