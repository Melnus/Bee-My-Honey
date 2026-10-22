import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { coreName, headName } from "../i18n/names.js";
import { LABOR_ITEM_NAMES } from "../data/labor-data.js";
import { GENRE_NAMES } from "../economy/facility.js";
import { getEntityAccount, getBalanceSheet } from "../economy/account.js";
import { getPolicyParam } from "../economy/policy.js";
import { stockValue } from "../economy/company-facility.js";
import { getVillageSlots, reservedCash } from "../economy/village-demand.js";
import {
  NAME_MAX, RANGE_XZ, RANGE_Y, loadCore, registerCore, getRegistrationFee, companyOf, villageNear, validateCompanyName,
  cooldownDaysLeft, canManagePeople, isMember, onlineIdsFor, applyToCompany, reviewApplicant, leaveCompany,
  estimateLiquidation, dissolveCore
} from "../economy/core-registry.js";

// ==========================================
// 法人テンプレートの画面 / Corporate Template UI  (dev/corporate-template-spec.md)
// ------------------------------------------
// 鐘(村)・ロードストーン(会社)を触った時の画面。ロジックは economy/core-registry.js。
// ==========================================
const SAC = "minecraft:glow_ink_sac";
const fmtE = (n) => Math.round(n).toLocaleString("en-US");
const warn = (e) => console.warn("[BeeMyHoney] core UI error: " + e);

// args に関数を渡すと、受け取る人の言語で呼ばれる(名前を言語ごとに出し分ける)。
export function broadcast(record, ...args) {
  for (const p of world.getAllPlayers()) {
    const lang = getLang(p);
    p.sendMessage(t(lang, record, ...args.map((a) => (typeof a === "function" ? a(lang) : a))));
  }
}

// ---------- 登記 ----------
const REG_ERRORS = {
  already_registered: (lang) => t(lang, STR.coreErrAlready),
  village_overlap: (lang, r) => t(lang, STR.coreErrVillageOverlap, coreName(r.near, lang)),
  one_company: (lang, r) => t(lang, STR.coreErrOneCompany, coreName(r.mine, lang)),
  cooldown: (lang, r) => t(lang, STR.coreErrCooldown, r.daysLeft),
  name_empty: (lang) => t(lang, STR.coreErrNameEmpty),
  name_too_long: (lang) => t(lang, STR.coreErrNameTooLong, NAME_MAX),
  name_reserved: (lang) => t(lang, STR.coreErrNameReserved),
  name_duplicate: (lang) => t(lang, STR.coreErrNameDuplicate),
  insufficient_funds: (lang, r) => t(lang, STR.coreErrFunds, fmtE(r.fee ?? 0), fmtE(r.balance ?? 0)),
  no_catalyst: (lang) => t(lang, STR.coreErrNoCatalyst),
  account_failed: (lang) => t(lang, STR.coreErrAccount)
};

function consumeSac(player) {
  const inv = player.getComponent("inventory")?.container;
  if (!inv) return false;
  const slot = player.selectedSlotIndex;
  const it = inv.getItem(slot);
  if (!it || it.typeId !== SAC) return false;
  if (it.amount > 1) { it.amount -= 1; inv.setItem(slot, it); } else inv.setItem(slot, undefined);
  return true;
}

function hasSac(player) {
  const it = player.getComponent("inventory")?.container?.getItem(player.selectedSlotIndex);
  return it?.typeId === SAC;
}

function doRegister(player, kind, info, name, nameEn = null) {
  const lang = getLang(player);
  const block = world.getDimension(info.dimId).getBlock({ x: info.x, y: info.y, z: info.z });
  if (!block || block.typeId !== info.typeId) { player.sendMessage(t(lang, STR.coreErrBlockChanged)); return; }
  let states = {};
  try { states = block.permutation.getAllStates(); } catch (e) { /* 状態を読めなくても登記は進める */ }
  const r = registerCore(player, { kind, ...info, states, name, nameEn }, { hasCatalyst: () => hasSac(player), consumeCatalyst: () => consumeSac(player) });
  if (!r.ok) { player.sendMessage((REG_ERRORS[r.reason] ?? (() => `§c${r.reason}`))(lang, r)); return; }
  broadcast(STR.coreBroadcastRegistered, kind, (l) => coreName(r.core, l), r.core.id);
}

// 未登録のコアブロックを、輝くイカスミを持って触った時
export function startRegister(player, block) {
  const lang = getLang(player);
  const kind = block.typeId === "minecraft:bell" ? "village" : "company";
  const info = { dimId: block.dimension.id, x: block.x, y: block.y, z: block.z, typeId: block.typeId };
  if (kind === "village") {
    const near = villageNear(info.dimId, info.x, info.y, info.z);
    if (near) { player.sendMessage(t(lang, STR.coreErrVillageOverlap, coreName(near, lang))); return; }
    new ActionFormData().title(t(lang, STR.coreRegVillageTitle)).body(t(lang, STR.coreRegVillageBody))
      .button(t(lang, STR.coreRegBtn)).button(t(lang, STR.coreBtnCancel))
      .show(player).then((r) => { if (!r.canceled && r.selection === 0) doRegister(player, kind, info, null); }).catch(warn);
    return;
  }
  const mine = companyOf(player.id);
  if (mine) { player.sendMessage(t(lang, STR.coreErrOneCompany, coreName(mine, lang))); return; }
  const left = cooldownDaysLeft(player.id);
  if (left > 0) { player.sendMessage(t(lang, STR.coreErrCooldown, left)); return; }
  new ModalFormData().title(t(lang, STR.coreRegCompanyTitle))
    .textField(t(lang, STR.coreRegCompanyField, fmtE(getRegistrationFee()), NAME_MAX), t(lang, STR.coreRegCompanyPlaceholder))
    .textField(t(lang, STR.coreRegCompanyFieldEn, NAME_MAX), t(lang, STR.coreRegCompanyPlaceholderEn))
    .show(player).then((r) => {
      if (r.canceled) return;
      // 1つ目は自分の言語の名前、2つ目はもう一方の言語の名前(任意)
      const first = String(r.formValues?.[0] ?? "").trim();
      const second = String(r.formValues?.[1] ?? "").trim();
      const ja = lang === "en" ? second : first;
      const en = lang === "en" ? first : second;
      // どちらか片方だけでもよい。日本語名が空なら英語名で、英語名が空なら日本語名だけで登録する(その場合、どちらの言語でも同じ名前を見せる)
      const name = ja || en;
      const v = validateCompanyName(name);
      if (!v.ok) { player.sendMessage((REG_ERRORS["name_" + v.reason])(lang)); return; }
      if (en && en !== name) {
        const ve = validateCompanyName(en);
        if (!ve.ok) { player.sendMessage((REG_ERRORS["name_" + ve.reason])(lang)); return; }
      }
      doRegister(player, kind, info, name, en || null);
    }).catch(warn);
}

// ---------- 管理メニュー(6ボタン) ----------
export function openCoreMenu(player, core) {
  const lang = getLang(player);
  const v = core.kind === "village";
  new ActionFormData()
    .title(t(lang, v ? STR.coreMenuTitleVillage : STR.coreMenuTitleCompany))
    .body(t(lang, STR.coreMenuBody, v, coreName(core, lang), headName(core, lang), core.id))
    .button(t(lang, STR.coreBtnPeople)).button(t(lang, STR.coreBtnAccounting)).button(t(lang, STR.coreBtnAssets))
    .button(t(lang, STR.coreBtnStock)).button(t(lang, STR.coreBtnContracts)).button(t(lang, STR.coreBtnManage))
    .show(player).then((r) => {
      if (r.canceled) return;
      if (r.selection === 0) return openPeopleMenu(player, core.id);
      if (r.selection === 1) return openAccountingMenu(player, core.id);
      if (r.selection === 3) return openStockMenu(player, core.id);
      if (r.selection === 4) return openContractsMenu(player, core.id);
      if (r.selection === 5) return openManageMenu(player, core.id);
      player.sendMessage(t(lang, STR.coreComingSoon)); // 保有施設(範囲登録)は準備中
    }).catch(warn);
}

// ---------- 人員管理 ----------
function countNearby(core) {
  const dim = world.getDimension(core.dimId);
  const box = {
    location: { x: core.x - RANGE_XZ, y: core.y - RANGE_Y, z: core.z - RANGE_XZ },
    volume: { x: RANGE_XZ * 2 + 1, y: RANGE_Y * 2 + 1, z: RANGE_XZ * 2 + 1 }
  };
  const seen = new Set();
  let adults = 0, babies = 0;
  for (const type of ["minecraft:villager_v2", "minecraft:villager"]) {
    for (const e of dim.getEntities({ type, ...box })) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.getComponent("minecraft:is_baby")) babies++; else adults++;
    }
  }
  return { adults, babies, players: dim.getPlayers(box).map((p) => p.name) };
}
export { countNearby };

export function openPeopleMenu(player, id) {
  const core = loadCore(id);
  if (!core) return;
  const lang = getLang(player);
  const f = new ActionFormData().title(t(lang, STR.corePeopleTitle));
  if (core.kind === "village") {
    const n = countNearby(core);
    let body = t(lang, STR.corePeopleVillageBody, RANGE_XZ, RANGE_Y, n.adults + n.babies, n.adults, n.babies);
    if (core.popHistory) body += t(lang, STR.corePeopleHistory, core.pop, core.popDay, core.popHistory.slice(-7).map((h) => `${h.d}:${h.n}`).join(" / "));
    body += t(lang, STR.corePeopleNote);
    f.body(body).button(t(lang, STR.coreBtnClose)).show(player).catch(warn);
    return;
  }
  const members = core.members ?? [], apps = core.applicants ?? [];
  const names = members.map((m) => `・${m.name}`).join("\n");
  let body = t(lang, STR.corePeopleCompanyBody, headName(core, lang), members.length, names);
  const online = onlineIdsFor(core);
  if (canManagePeople(core, player.id, online)) {
    if (core.ownerId !== player.id) body += t(lang, STR.coreProxyNote);
    body += t(lang, STR.coreApplicantCount, apps.length);
    f.body(body);
    if (apps.length) f.button(t(lang, STR.coreReviewBtn, apps.length));
    f.button(t(lang, STR.coreBtnClose));
    f.show(player).then((r) => { if (!r.canceled && apps.length && r.selection === 0) openReview(player, id); }).catch(warn);
  } else if (isMember(core, player.id)) {
    f.body(body).button(t(lang, STR.coreLeaveBtn)).button(t(lang, STR.coreBtnClose));
    f.show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return;
      const res = leaveCompany(id, player.id);
      if (res.ok) player.sendMessage(t(lang, STR.coreLeft, res.name));
    }).catch(warn);
  } else if (core.ownerId === player.id) {
    f.body(body).button(t(lang, STR.coreBtnClose)).show(player).catch(warn);
  } else if (apps.some((a) => a.id === player.id)) {
    f.body(body + t(lang, STR.coreAppliedBody)).button(t(lang, STR.coreBtnClose)).show(player).catch(warn);
  } else {
    f.body(body + t(lang, STR.coreApplyPrompt)).button(t(lang, STR.coreApplyBtn)).button(t(lang, STR.coreBtnCancel));
    f.show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return;
      const res = applyToCompany(id, player);
      if (res.ok) player.sendMessage(t(lang, STR.coreApplyDone, coreName(core, lang)));
      else if (res.reason === "full") player.sendMessage(t(lang, STR.coreApplyFull));
      else if (res.reason === "already_applied") player.sendMessage(t(lang, STR.coreApplyAlready));
    }).catch(warn);
  }
}

function openReview(player, id) {
  const core = loadCore(id);
  const lang = getLang(player);
  if (!core || !canManagePeople(core, player.id, onlineIdsFor(core))) return;
  const a = (core.applicants ?? [])[0];
  if (!a) return;
  new ActionFormData().title(t(lang, STR.coreReviewTitle))
    .body(t(lang, STR.coreReviewBody, a.name, a.d, core.applicants.length))
    .button(t(lang, STR.coreHireBtn)).button(t(lang, STR.coreSkipBtn)).button(t(lang, STR.coreBtnClose))
    .show(player).then((r) => {
      if (r.canceled || r.selection === 2) return;
      const c = loadCore(id);
      if (!c) return;
      const res = reviewApplicant(id, player.id, a.id, r.selection === 0, onlineIdsFor(c));
      if (!res.ok) { player.sendMessage(t(lang, STR.coreForbidden)); return; }
      player.sendMessage(t(lang, res.hired ? STR.coreHired : STR.coreSkipped, res.name));
      openReview(player, id);
    }).catch(warn);
}

// ---------- 経営管理(解散) ----------
export function openManageMenu(player, id) {
  const core = loadCore(id);
  const lang = getLang(player);
  if (!core) return;
  if (core.ownerId !== player.id) { player.sendMessage(t(lang, STR.coreManageOnlyOwner)); return; }
  new ActionFormData().title(t(lang, STR.coreManageTitle))
    .button(t(lang, STR.coreDissolveBtn)).button(t(lang, STR.coreBtnBack))
    .show(player).then((r) => {
      if (r.canceled) return;
      if (r.selection === 1) return openCoreMenu(player, core);
      openDissolveConfirm(player, id);
    }).catch(warn);
}

function openDissolveConfirm(player, id) {
  const core = loadCore(id);
  const lang = getLang(player);
  if (!core || core.ownerId !== player.id) return;
  const est = estimateLiquidation(core, "voluntary");
  new ActionFormData().title(t(lang, STR.coreDissolveTitle))
    .body(t(lang, STR.coreDissolveBody, coreName(core, lang), est, Math.round(est.ratio * 100), Math.round(est.creditRatio * 100), est.cooldownDays, core.kind === "company"))
    .button(t(lang, STR.coreDissolveConfirmBtn)).button(t(lang, STR.coreBtnCancel))
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return;
      const c = loadCore(id);
      if (!c || c.ownerId !== player.id) return;
      const res = dissolveCore(c, { mode: "voluntary", reason: "dissolved" });
      if (!res.ok) { player.sendMessage(t(lang, STR.coreDissolveFail)); return; }
      broadcast(STR.coreBroadcastDissolved, (l) => coreName(c, l), c.id);
    }).catch(warn);
}

// ---------- 会計管理 / 在庫管理 / 契約管理 ----------
const fmtN = (n) => Math.round(n).toLocaleString("en-US");
function itemName(itemId, lang) {
  const key = String(itemId ?? "").replace("minecraft:", "");
  const entry = LABOR_ITEM_NAMES[key];
  return entry ? t(lang, entry) : key;
}
function backTo(player, id) {
  const c = loadCore(id);
  if (c) openCoreMenu(player, c);
}

export function openAccountingMenu(player, id) {
  const core = loadCore(id);
  const lang = getLang(player);
  if (!core) return;
  const acct = getEntityAccount(id);
  if (!acct) { player.sendMessage(t(lang, STR.coreAcctNoAccount)); return; }
  const s = getBalanceSheet(acct);
  const weeks = acct.weekly.slice(-4).reverse()
    .map((w) => t(lang, STR.coreAcctWeekLine, w.week, fmtN(w.revenue), fmtN(w.expense), fmtN(w.net))).join("\n") || t(lang, STR.coreAcctNoWeeks);
  new ActionFormData().title(t(lang, STR.coreAcctTitle))
    .body(t(lang, STR.coreAcctBody, fmtN(s.cash), fmtN(s.receivables), fmtN(s.holdingsValue), fmtN(s.liabilities), fmtN(s.equity), weeks))
    .button(t(lang, STR.coreBtnBack)).show(player).then(() => backTo(player, id)).catch(warn);
}

export function openStockMenu(player, id) {
  const core = loadCore(id);
  const lang = getLang(player);
  if (!core) return;
  const entries = Object.entries(core.stock ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const lines = entries.length ? entries.map(([itemId, n]) => `・${itemName(itemId, lang)} x${fmtN(n)}`).join("\n") : t(lang, STR.coreStockEmpty);
  const body = core.kind === "village"
    ? t(lang, STR.coreStockBodyVillage, lines, fmtN(stockValue(core.stock)), shipLines(core, lang))
    : t(lang, STR.coreStockBody, lines, getPolicyParam("pool_keep_per_item"), fmtN(stockValue(core.stock)));
  new ActionFormData().title(t(lang, STR.coreStockTitle))
    .body(body)
    .button(t(lang, STR.coreBtnBack)).show(player).then(() => backTo(player, id)).catch(warn);
}

// 先週の加工・出荷(村の週次の締め)
function shipLines(core, lang) {
  const s = core.lastShip;
  if (!s) return t(lang, STR.coreShipNone);
  const made = Object.entries(s.made ?? {}).map(([id, n]) => `${itemName(id, lang)} x${fmtN(n)}`).join("、") || t(lang, STR.coreContractsNone);
  const used = Object.entries(s.consumed ?? {}).filter(([, n]) => n > 0).map(([id, n]) => `${itemName(id, lang)} x${fmtN(n)}`).join("、") || t(lang, STR.coreContractsNone);
  return t(lang, STR.coreShipLine, s.week, made, fmtN(s.cash), used);
}

// 今日の必要数(枠)と、受注中・納品済みの注文
function requestLines(core, lang) {
  const slots = getVillageSlots(core);
  const today = slots.length
    ? slots.map((s) => t(lang, STR.coreSlotLine, itemName(s.itemId, lang), s.taken, s.need, Math.round(s.unit * 10) / 10)).join("\n")
    : t(lang, core.kind === "village" ? STR.coreSlotsNoneVillage : STR.coreSlotsNoneCompany);
  const orders = (core.orders ?? []).map((o) => t(lang, STR.coreOrderLine, o.who, itemName(o.itemId, lang), o.qty, o.reward, o.done)).join("\n") || t(lang, STR.coreContractsNone);
  return { today, orders };
}

export function openContractsMenu(player, id) {
  const core = loadCore(id);
  const lang = getLang(player);
  if (!core) return;
  if (core.kind === "village") {
    const r = requestLines(core, lang);
    const acct = getEntityAccount(id);
    new ActionFormData().title(t(lang, STR.coreOrdersTitle))
      .body(t(lang, STR.coreOrdersBodyVillage, r.today, r.orders, fmtN(acct?.cash ?? 0), fmtN(reservedCash(core))))
      .button(t(lang, STR.coreBtnBack)).show(player).then(() => backTo(player, id)).catch(warn);
    return;
  }
  const day = world.getDay();
  const ongoing = (core.contracts ?? []).map((c) =>
    t(lang, STR.coreContractLine, c.who, t(lang, GENRE_NAMES[c.genre]), Math.max(0, c.endDay - day), itemName(c.itemId, lang), fmtN(c.count ?? 0))).join("\n") || t(lang, STR.coreContractsNone);
  const log = (core.contractLog ?? []).map((c) =>
    t(lang, STR.coreContractLogLine, c.who, t(lang, GENRE_NAMES[c.genre]), c.days, c.result, itemName(c.itemId, lang), fmtN(c.count ?? 0))).join("\n") || t(lang, STR.coreContractsNone);
  new ActionFormData().title(t(lang, STR.coreContractsTitle))
    .body(t(lang, STR.coreContractsBody, ongoing, log) + "\n\n" + t(lang, STR.coreRequestsBodyCompany, requestLines(core, lang).today, requestLines(core, lang).orders))
    .button(t(lang, STR.coreBtnBack)).show(player).then(() => backTo(player, id)).catch(warn);
}
