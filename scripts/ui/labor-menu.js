import { getPriceLevel } from "../economy/price-level.js";
import { creditEmeralds, debitEmeralds, FLOW } from "../economy/ledger.js";
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { employeeName, coreName } from "../i18n/names.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import {
  QUALIFIED_JOBS,
  LICENSES,
  CONSULTANT_CONTRACTS,
  MAX_EMPLOYEES,
  ACCIDENT_SOFT_CAP,
  getAccidentChance,
  LABOR_ITEM_NAMES,
  LABOR_BIOME_NAMES,
  HRMHRM_ORG_NAME
} from "../data/labor-data.js";
import {
  hasQualification,
  getEmployees,
  getVillagerEmployees,
  getOrCreatePlayerResume,
  setPlayerSkills,
  registerNearbyVillagerAsEmployee,
  dispatchEmployee,
  collectDispatch,
  getActiveConsultantContract,
  startConsultantContract,
  completeConsultantContract,
  reportConsultantLoss
} from "../economy/labor.js";
import { getBoard, getClaims, getClaim, getClaimedBy, claimQuest, claimVillageQuest, releaseQuest, deliverQuest, getMaxActiveQuests } from "../economy/quest-board.js";
import { getVillageBoard, maxOrderQty, getCoreFunds } from "../economy/village-demand.js";
import { loadCore } from "../economy/core-registry.js";
import { promptQuantity } from "./shared.js";
import { TUTORIAL_STEPS, isTutorialActive, getTutorialProgress, getCurrentTutorialStep, completeTutorialStep } from "../economy/tutorial-chain.js";
import { FACILITY_GENRES, GENRE_NAMES, listFacilities, getFacility } from "../economy/facility.js";
import { getPolicyParam } from "../economy/policy.js";


// ==========================================
// 労働市場 ポータルサイト UI (HRMHRM Partners HLD)
// 書見台 + 本 で開く
// ==========================================

function stockOptionSuffix(lang, granted) {
  if (!granted) return "";
  return t(lang, STR.laborStockOptionSuffix, granted);
}

export function openLaborMenu(player, lecternLocation) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, STR.laborTitle))
    .body(t(lang, STR.laborBody))
    .button(t(lang, STR.laborBtnStaff))
    .button(t(lang, STR.laborBtnConsultant))
    .button(t(lang, STR.laborBtnOwnersClub))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return;
    if (res.selection === 0) return openStaffMenu(player, lecternLocation);
    if (res.selection === 1) return openConsultantMenu(player, lecternLocation);
    if (res.selection === 2) return openOwnersClubMenu(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- スタッフサービス ----------
// 一段目: 導入クエスト(チェーン。終わると消える) / 資格なしの求人 / 資格が必要な求人 / 村からのクエスト / 会社からのクエスト。
// 欄ごとに別の掲示板へ進む。受注中のクエストは、そのカテゴリの掲示板の先頭に固定表示される(掲示が入れ替わっても選べる)。
const BOARD_GROUPS = { unqualified: ["unqualified"], licensed: ["nether", "underwater", "end"] };
const BOARD_TITLES = { unqualified: "laborBoardTitleUnqualified", licensed: "laborBoardTitleLicensed", village: "laborBoardTitleVillage", company: "laborBoardTitleCompany" };
const lastBoard = new Map(); // プレイヤーID → 最後に開いた掲示板(詳細画面から戻る先)

function backToBoard(player, lecternLocation) {
  const g = lastBoard.get(player.id);
  return g ? openQuestBoard(player, lecternLocation, g) : openStaffMenu(player, lecternLocation);
}

export function openStaffMenu(player, lecternLocation) {
  const lang = getLang(player);
  lastBoard.delete(player.id);
  const claimed = getClaims(player).filter((c) => c.state === "claimed");
  const activeIn = (group) => claimed.filter((c) => BOARD_GROUPS[group].includes(c.category)).length;

  const rows = [];
  if (isTutorialActive(player)) rows.push({ key: "tutorial", label: t(lang, STR.laborStaffBtnTutorial, getTutorialProgress(player), TUTORIAL_STEPS.length) });
  rows.push({ key: "unqualified", label: t(lang, STR.laborStaffBtnUnqualified, activeIn("unqualified")) });
  rows.push({ key: "licensed", label: t(lang, STR.laborStaffBtnLicensed, activeIn("licensed")) });
  rows.push({ key: "village", label: t(lang, STR.laborStaffBtnVillage) });
  rows.push({ key: "company", label: t(lang, STR.laborStaffBtnCompany) });

  const form = new ActionFormData().title(t(lang, STR.laborStaffTitle)).body(t(lang, STR.laborStaffMenuBody, getMaxActiveQuests(), claimed.length));
  for (const r of rows) form.button(r.label);
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === rows.length) return openLaborMenu(player, lecternLocation);
    const key = rows[res.selection].key;
    if (key === "tutorial") return openTutorialScreen(player, lecternLocation);
    return openQuestBoard(player, lecternLocation, key);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 導入クエスト: 進み具合の一覧と、いまのステップの説明。「報告する」で次へ。
function openTutorialScreen(player, lecternLocation) {
  const lang = getLang(player);
  const step = getCurrentTutorialStep(player);
  if (!step) return openStaffMenu(player, lecternLocation);
  const done = getTutorialProgress(player);
  const lines = TUTORIAL_STEPS.map((st, i) =>
    t(lang, i < done ? STR.tutorialLineDone : i === done ? STR.tutorialLineNow : STR.tutorialLineLater, t(lang, st.title))).join("\n");
  const bodyRec = STR[step.bodyKey];
  const text = t(lang, bodyRec, getMaxActiveQuests());
  const form = new ActionFormData()
    .title(t(lang, STR.tutorialTitle, done, TUTORIAL_STEPS.length))
    .body(`${lines}\n\n${text}`)
    .button(t(lang, STR.laborBtnReport))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openStaffMenu(player, lecternLocation);
    const r = completeTutorialStep(player);
    if (r.ok) {
      if (step.id === "first_job") player.sendMessage(t(lang, STR.laborFirstJobDoneMsg));
      player.sendMessage(t(lang, r.finished ? STR.tutorialAllDoneMsg : STR.tutorialStepDoneMsg, t(lang, step.title)));
    } else if (r.reason === "giveFailed") player.sendMessage(t(lang, STR.laborFirstJobFailedMsg));
    else if (r.reason === "notYet") player.sendMessage(t(lang, STR.tutorialNotYetMsg));
    return openTutorialScreen(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 掲示板: group = unqualified / licensed(カテゴリ別の日替わり掲示)、village / company(発行者別。依頼は今後のアップデート)
function openQuestBoard(player, lecternLocation, group) {
  if (group === "village" || group === "company") return openVillageBoard(player, lecternLocation, group);
  const lang = getLang(player);
  lastBoard.set(player.id, group);
  const cats = BOARD_GROUPS[group];
  const claims = getClaims(player);
  const claimed = claims.filter((c) => c.state === "claimed" && (!cats || cats.includes(c.category)));

  const entries = [];
  for (const c of claimed) {
    entries.push({ questId: c.questId, category: c.category, tag: t(lang, STR.laborBoardTagClaimed), title: c.title, requirement: c.requirement, reward: c.reward, locked: false });
  }
  if (cats) {
    for (const l of getBoard()) {
      if (!cats.includes(l.category) || claimed.some((c) => c.questId === l.id)) continue;
      const done = claims.find((c) => c.questId === l.id && c.state === "completed");
      const locked = !hasQualification(player, l.category);
      const tag = done ? t(lang, STR.laborBoardTagDone) : locked ? t(lang, STR.laborBoardTagLocked) : "";
      entries.push({ questId: l.id, category: l.category, tag, title: l.title, requirement: l.requirement, reward: l.reward.amount, locked: locked && !done });
    }
  }

  const empty = !cats && entries.length === 0;
  const form = new ActionFormData()
    .title(t(lang, STR[BOARD_TITLES[group]]))
    .body(empty ? t(lang, group === "village" ? STR.laborBoardEmptyVillage : STR.laborBoardEmptyCompany) : t(lang, STR.laborBoardBody, getMaxActiveQuests(), getClaims(player).filter((c) => c.state === "claimed").length));
  for (const e of entries) form.button(t(lang, STR.laborBoardButton, e.tag, t(lang, e.title), itemDisplayName(e.requirement.itemId, lang), e.requirement.count, e.reward));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === entries.length) return openStaffMenu(player, lecternLocation);
    const e = entries[res.selection];
    if (e.locked) return openLicenseProgressScreen(player, e.category, lecternLocation);
    return openQuestDetail(player, e.questId, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- 村・会社からのクエスト(入荷。economy/village-demand.js) ----------
// 掲示板 → 受注中の注文(先頭)+ 近い村(会社)の一覧 → その村の画面(今日の必要数・資金・受注できる数)→ 品目を選んで数量を入れて受注。
// 必要数が残っていても、村の資金で払える数までしか受けられない。画面に「受注できる数」を出して、食い違いが見えるようにする。
const lastVillage = new Map(); // プレイヤーID → 最後に開いた村(注文の詳細から戻る先)

function openVillageBoard(player, lecternLocation, kind = "village") {
  const lang = getLang(player);
  lastBoard.set(player.id, kind);
  lastVillage.delete(player.id);
  const entries = [];
  for (const c of getClaims(player).filter((c) => c.state === "claimed" && c.category === kind)) {
    entries.push({ type: "claim", claim: c, label: t(lang, STR.villageBoardClaimed, t(lang, c.title), itemDisplayName(c.requirement.itemId, lang), c.requirement.count, c.reward) });
  }
  for (const v of getVillageBoard(player, undefined, kind)) {
    const open = v.slots.filter((s) => s.left > 0).length;
    entries.push({ type: "village", coreId: v.core.id, label: t(lang, kind === "company" ? STR.companyBoardEntry : STR.villageBoardEntry, coreName(v.core, lang), v.dist, open, v.slots.length, Math.round(getCoreFunds(v.core).free)) });
  }
  const form = new ActionFormData()
    .title(t(lang, kind === "company" ? STR.laborBoardTitleCompany : STR.laborBoardTitleVillage))
    .body(entries.length === 0 ? t(lang, kind === "company" ? STR.laborBoardEmptyCompany : STR.laborBoardEmptyVillage) : t(lang, kind === "company" ? STR.companyBoardBody : STR.villageBoardBody, getMaxActiveQuests(), getClaims(player).filter((c) => c.state === "claimed").length));
  for (const e of entries) form.button(e.label);
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === entries.length) return openStaffMenu(player, lecternLocation);
    const e = entries[res.selection];
    if (e.type === "claim") return openVillageOrderDetail(player, e.claim.questId, lecternLocation);
    return openVillageScreen(player, e.coreId, lecternLocation, kind);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 1つの村(会社)の画面: 今日の必要数の一覧。品目ごとに「受注済み / 必要数」と「いま受けられる数」を出す。
function openVillageScreen(player, coreId, lecternLocation, kind = "village") {
  const lang = getLang(player);
  lastVillage.set(player.id, coreId);
  const board = getVillageBoard(player, undefined, kind).find((v) => v.core.id === coreId);
  const core = loadCore(coreId);
  if (!board || !core) return openVillageBoard(player, lecternLocation, kind);
  const funds = getCoreFunds(core);
  const rows = board.slots.map((sl) => {
    const can = maxOrderQty(core, sl);
    const state = sl.left <= 0 ? t(lang, kind === "company" ? STR.companyStateFull : STR.villageStateFull) : can <= 0 ? t(lang, STR.villageStateNoFunds) : t(lang, STR.villageStateCan, can);
    return { sl, can, label: t(lang, STR.villageSlotRow, itemDisplayName(sl.itemId, lang), sl.taken, sl.need, Math.round(sl.unit * 10) / 10, state) };
  });
  const form = new ActionFormData()
    .title(coreName(core, lang))
    .body(t(lang, kind === "company" ? STR.companyScreenBody : STR.villageScreenBody, board.dist, Math.round(funds.cash), Math.round(funds.reserved), Math.round(funds.free), getMaxActiveQuests(), getClaims(player).filter((c) => c.state === "claimed").length));
  for (const r of rows) form.button(r.label);
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === rows.length) return openVillageBoard(player, lecternLocation, kind);
    const r = rows[res.selection];
    if (r.sl.left <= 0) { player.sendMessage(t(lang, kind === "company" ? STR.companySlotFullMsg : STR.villageSlotFullMsg)); return openVillageScreen(player, coreId, lecternLocation, kind); }
    if (r.can <= 0) { player.sendMessage(t(lang, kind === "company" ? STR.companyNoFundsMsg : STR.villageNoFundsMsg)); return openVillageScreen(player, coreId, lecternLocation, kind); }
    return openVillageSlot(player, coreId, r.sl.itemId, lecternLocation, kind);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openVillageSlot(player, coreId, itemId, lecternLocation, kind = "village") {
  const lang = getLang(player);
  const board = getVillageBoard(player, undefined, kind).find((v) => v.core.id === coreId);
  const slot = board?.slots.find((s) => s.itemId === itemId);
  const core = loadCore(coreId);
  if (!slot || !core || slot.left <= 0) { player.sendMessage(t(lang, kind === "company" ? STR.companySlotFullMsg : STR.villageSlotFullMsg)); return openVillageScreen(player, coreId, lecternLocation, kind); }
  const max = maxOrderQty(core, slot);
  if (max <= 0) { player.sendMessage(t(lang, kind === "company" ? STR.companyNoFundsMsg : STR.villageNoFundsMsg)); return openVillageScreen(player, coreId, lecternLocation, kind); }
  return promptQuantity(player, {
    title: t(lang, STR.villageOrderTitle, coreName(core, lang), itemDisplayName(itemId, lang)),
    max,
    onSubmit: (qty) => {
      const r = claimVillageQuest(player, coreId, itemId, qty);
      if (r.ok) player.sendMessage(t(lang, STR.villageClaimedMsg, coreName(core, lang), itemDisplayName(itemId, lang), r.claim.requirement.count, r.claim.reward));
      else if (r.reason === "limit") player.sendMessage(t(lang, STR.laborClaimLimitMsg, r.max));
      else if (r.reason === "full" || r.reason === "badQty") player.sendMessage(t(lang, kind === "company" ? STR.companySlotFullMsg : STR.villageSlotFullMsg));
      else if (r.reason === "noFunds") player.sendMessage(t(lang, kind === "company" ? STR.companyNoFundsMsg : STR.villageNoFundsMsg));
      else if (r.reason === "alreadyClaimed" || r.reason === "alreadyCompleted") player.sendMessage(t(lang, STR.villageAlreadyMsg));
      else player.sendMessage(t(lang, STR.laborClaimFailedMsg));
      return openVillageScreen(player, coreId, lecternLocation, kind);
    },
    onBack: () => openVillageScreen(player, coreId, lecternLocation, kind)
  });
}

// 受注中の村の注文: 納品する / 放棄する
function openVillageOrderDetail(player, questId, lecternLocation) {
  const lang = getLang(player);
  const claim = getClaim(player, questId);
  if (!claim || claim.state !== "claimed") return openVillageBoard(player, lecternLocation, lastBoard.get(player.id) === "company" ? "company" : "village");
  const kind = claim.category === "company" ? "company" : "village";
  const form = new ActionFormData()
    .title(t(lang, STR.laborQuestTitle))
    .body(t(lang, STR.villageOrderBody, t(lang, claim.title), itemDisplayName(claim.requirement.itemId, lang), claim.requirement.count, claim.reward, t(lang, STR.laborQuestHintDeliver)))
    .button(t(lang, STR.laborBtnDeliver))
    .button(t(lang, STR.laborBtnAbandon))
    .button(t(lang, STR.back));
  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openVillageBoard(player, lecternLocation, kind);
    if (res.selection === 1) {
      releaseQuest(player, questId);
      player.sendMessage(t(lang, STR.laborAbandonedMsg, t(lang, claim.title)));
      return openVillageBoard(player, lecternLocation, kind);
    }
    const r = deliverQuest(player, questId, lecternLocation);
    if (!r.ok) {
      player.sendMessage(r.reason === "insufficientItems" ? t(lang, STR.laborDeliverInsufficientItem, itemDisplayName(claim.requirement.itemId, lang))
        : r.reason === "villageGone" ? t(lang, STR.villageGoneMsg)
        : r.reason === "noContainer" ? t(lang, STR.laborDeliverNoContainer) : t(lang, STR.laborDeliverFailed));
      return openVillageOrderDetail(player, questId, lecternLocation);
    }
    player.sendMessage(t(lang, r.short > 0 ? STR.villageDeliverShortMsg : STR.villageDeliverSuccess, r.villageNames[lang === "en" ? "en" : "ja"], r.wage, r.short));
    return openVillageBoard(player, lecternLocation, kind);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ライセンス未取得の場合の案内画面(実測進捗のため「受験」ボタンはない)。
function openLicenseProgressScreen(player, category, lecternLocation) {
  const lang = getLang(player);
  const def = LICENSES[category];
  const state = getOrCreatePlayerResume(player, category).licenses?.[category] ?? { level: 0, chunkProgress: {} };
  const bestChunkProgress = Math.max(0, ...Object.values(state.chunkProgress ?? {}), 0);
  const nextStage = def.stages[state.level ?? 0];

  const actionLabel = def.trackAction === "place" ? t(lang, STR.laborLicenseActionPlace) : t(lang, STR.laborLicenseActionBreak);
  const blockKey = def.blockType.replace("minecraft:", "");
  const blockName = LABOR_ITEM_NAMES[blockKey] ? t(lang, LABOR_ITEM_NAMES[blockKey]) : blockKey;
  const biomeKey = def.biome ? def.biome.replace("minecraft:", "") : null;
  const biomeName = biomeKey ? (LABOR_BIOME_NAMES[biomeKey] ? t(lang, LABOR_BIOME_NAMES[biomeKey]) : biomeKey) : null;
  const biomeNote = biomeName ? t(lang, STR.laborLicenseBiomeNote, biomeName) : "";
  const jobTitleName = t(lang, def.name);
  const stageLabel = t(lang, nextStage.label);

  const form = new ActionFormData()
    .title(t(lang, STR.laborLicenseTitle, jobTitleName))
    .body(t(lang, STR.laborLicenseBody, blockName, actionLabel, biomeNote, bestChunkProgress, nextStage.quota, stageLabel))
    .button(t(lang, STR.back));

  form.show(player).then(() => backToBoard(player, lecternLocation)).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function itemDisplayName(itemId, lang) {
  const key = itemId.replace("minecraft:", "");
  const entry = LABOR_ITEM_NAMES[key];
  return entry ? t(lang, entry) : key;
}

// クエストの詳細。受注していなければ「受注する」、受注中なら「納品する / 放棄する」(もう一度同じクエストを選ぶと出る)。
function openQuestDetail(player, questId, lecternLocation) {
  const lang = getLang(player);
  const claim = getClaim(player, questId);
  const listing = getBoard().find((l) => l.id === questId);
  const src = claim ?? listing;
  if (!src) return backToBoard(player, lecternLocation);

  const category = src.category;
  const state = claim ? claim.state : "open";
  const reward = claim ? claim.reward : listing.reward.amount;
  const resume = getOrCreatePlayerResume(player, category);
  const names = getClaimedBy(questId).filter((e) => e.state === "claimed").map((e) => e.name);
  const hint = state === "completed" ? STR.laborQuestHintDone : state === "claimed" ? STR.laborQuestHintDeliver : STR.laborQuestHintClaim;
  const body = t(
    lang, STR.laborQuestDetailBody,
    t(lang, src.title), itemDisplayName(src.requirement.itemId, lang), src.requirement.count, reward, resume.grade,
    names.length > 0 ? names.join(t(lang, STR.listSeparator)) : t(lang, STR.laborQuestNobody),
    t(lang, hint)
  );

  const form = new ActionFormData().title(t(lang, STR.laborQuestTitle)).body(body);
  const actions = [];
  const add = (label, fn) => { form.button(label); actions.push(fn); };
  const again = () => openQuestDetail(player, questId, lecternLocation);

  if (state === "open") {
    add(t(lang, STR.laborBtnClaim), () => {
      const r = claimQuest(player, questId);
      if (r.ok) player.sendMessage(t(lang, STR.laborClaimedMsg, t(lang, src.title)));
      else if (r.reason === "limit") player.sendMessage(t(lang, STR.laborClaimLimitMsg, r.max));
      else if (r.reason === "noLicense") player.sendMessage(t(lang, STR.laborClaimNoLicenseMsg));
      else player.sendMessage(t(lang, STR.laborClaimFailedMsg));
      return backToBoard(player, lecternLocation);
    });
  } else if (state === "claimed") {
    add(t(lang, STR.laborBtnDeliver), () => {
      const result = deliverQuest(player, questId, lecternLocation);
      if (!result.ok) {
        const msg =
          result.reason === "insufficientItems"
            ? t(lang, STR.laborDeliverInsufficientItem, itemDisplayName(src.requirement.itemId, lang))
            : result.reason === "noContainer"
              ? t(lang, STR.laborDeliverNoContainer)
              : t(lang, STR.laborDeliverFailed);
        player.sendMessage(msg);
        return again();
      }
      player.sendMessage(
        t(lang, STR.laborDeliverSuccess, result.wage, result.grossWage, result.laborCost, stockOptionSuffix(lang, result.stockOptionsGranted))
      );
      return backToBoard(player, lecternLocation);
    });
    add(t(lang, STR.laborBtnAbandon), () => {
      releaseQuest(player, questId);
      player.sendMessage(t(lang, STR.laborAbandonedMsg, t(lang, src.title)));
      return backToBoard(player, lecternLocation);
    });
  }
  add(t(lang, STR.laborBtnEditSkills), () => openSkillEditForm(player, category, lecternLocation, again));
  add(t(lang, STR.back), () => backToBoard(player, lecternLocation));

  form.show(player).then((res) => {
    if (res.canceled) return backToBoard(player, lecternLocation);
    actions[res.selection]();
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openSkillEditForm(player, category, lecternLocation, back) {
  const lang = getLang(player);
  const resume = getOrCreatePlayerResume(player, category);
  const form = new ModalFormData()
    .title(t(lang, STR.laborSkillEditTitle))
    .textField(t(lang, STR.laborSkillEditField), "", { defaultValue: resume.skills.join(",") });

  form.show(player).then((res) => {
    if (res.canceled) return back();
    const [raw] = res.formValues;
    const skills = String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    setPlayerSkills(player, category, skills);
    player.sendMessage(t(lang, STR.laborSkillUpdated));
    back();
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- コンサルタントサービス ----------
export function openConsultantMenu(player, lecternLocation) {
  const lang = getLang(player);
  const contract = getActiveConsultantContract(player);

  if (contract) {
    const daysLeft = Math.max(0, contract.endDay - world.getDay());
    const form = new ActionFormData()
      .title(t(lang, STR.laborConsultantTitle))
      .body(t(lang, STR.laborConsultantActiveBody, contract.days, daysLeft, contract.margin))
      .button(t(lang, STR.laborBtnCompleteContract))
      .button(t(lang, STR.laborBtnReportLoss))
      .button(t(lang, STR.back));

    form.show(player).then((res) => {
      if (res.canceled || res.selection === 2) return openLaborMenu(player, lecternLocation);
      if (res.selection === 0) {
        const result = completeConsultantContract(player, lecternLocation);
        if (result.ok) {
          player.sendMessage(
            t(lang, STR.laborContractCompleteMsg, result.margin, result.laborCost, stockOptionSuffix(lang, result.stockOptionsGranted))
          );
        } else if (result.reason === "noVillagerNearby") {
          player.sendMessage(t(lang, STR.laborNoVillagerNearby));
        } else {
          player.sendMessage(t(lang, STR.laborContractStillActive));
        }
        return openConsultantMenu(player, lecternLocation);
      }
      if (res.selection === 1) {
        const result = reportConsultantLoss(player);
        player.sendMessage(t(lang, STR.laborLossPenaltyMsg, result.penalty));
        return openConsultantMenu(player, lecternLocation);
      }
    }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
    return;
  }

  const form = new ActionFormData()
    .title(t(lang, STR.laborConsultantTitle))
    .body(t(lang, STR.laborConsultantChooseBody));
  for (const c of CONSULTANT_CONTRACTS) {
    form.button(t(lang, STR.laborContractOptionBtn, t(lang, c.name), Math.round(c.marginMin * getPriceLevel()), Math.round(c.marginMax * getPriceLevel())));
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === CONSULTANT_CONTRACTS.length) return openLaborMenu(player, lecternLocation);
    const def = CONSULTANT_CONTRACTS[res.selection];
    const result = startConsultantContract(player, def.key);
    if (result.ok) {
      player.sendMessage(t(lang, STR.laborContractSignedMsg));
    }
    openConsultantMenu(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ---------- オーナーズクラブ ----------
export function openOwnersClubMenu(player, lecternLocation) {
  const lang = getLang(player);
  const villagers = getVillagerEmployees(player);
  const count = villagers.length;
  const accidentPercent = Math.round(getAccidentChance(count) * 100);
  const over = count > ACCIDENT_SOFT_CAP;

  const body = t(lang, STR.laborOwnersClubBody, count, MAX_EMPLOYEES, accidentPercent, t(lang, STR.laborOverCapNote, over));

  const form = new ActionFormData()
    .title(t(lang, STR.laborOwnersClubTitle))
    .body(body)
    .button(t(lang, STR.laborBtnRegisterVillager))
    .button(t(lang, STR.laborBtnViewEmployees))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openLaborMenu(player, lecternLocation);
    if (res.selection === 0) {
      const loc = lecternLocation ?? player.location;
      const result = registerNearbyVillagerAsEmployee(player, loc);
      if (!result.ok) {
        player.sendMessage(
          result.reason === "capReached" ? t(lang, STR.laborCapReached) : t(lang, STR.laborNoVillagerFound)
        );
      } else {
        const acc = getAccount(player);
        creditEmeralds(player, result.grantEmeralds, FLOW.HIRE_BONUS, { from: HRMHRM_ORG_NAME });
        player.sendMessage(
          t(
            lang,
            STR.laborRegisterSuccessMsg,
            employeeName(result.employee, lang),
            result.employee.grade,
            result.employee.level,
            result.employee.skills.join(t(lang, STR.listSeparator)),
            result.grantEmeralds
          )
        );
      }
      return openOwnersClubMenu(player, lecternLocation);
    }
    if (res.selection === 1) {
      return openEmployeeListMenu(player, lecternLocation);
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openEmployeeListMenu(player, lecternLocation) {
  const lang = getLang(player);
  const employees = getVillagerEmployees(player);

  if (employees.length === 0) {
    player.sendMessage(t(lang, STR.laborNoEmployeesMsg));
    return openOwnersClubMenu(player, lecternLocation);
  }

  const form = new ActionFormData()
    .title(t(lang, STR.laborEmployeeListTitle));
  for (const e of employees) {
    const statusLabel =
      e.status === "dispatched"
        ? t(lang, STR.laborDispatchedLabel, Math.max(0, (e.dispatchEndDay ?? 0) - world.getDay()))
        : t(lang, STR.laborIdleLabel);
    form.button(t(lang, STR.laborEmployeeButtonLabel, employeeName(e, lang), e.grade, e.level, statusLabel, Math.round(e.wage * getPriceLevel())));
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === employees.length) return openOwnersClubMenu(player, lecternLocation);
    openEmployeeDetail(player, employees[res.selection].id, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openEmployeeDetail(player, employeeId, lecternLocation) {
  const lang = getLang(player);
  const employees = getEmployees(player);
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) return openOwnersClubMenu(player, lecternLocation);

  if (employee.status === "idle") {
    const gate = employee.address.nearestNetherGate;
    const gateText = gate
      ? t(lang, STR.laborGateKnown, gate.x, gate.y, gate.z)
      : t(lang, STR.laborGateUnknown);
    const tenureLine = t(lang, STR.laborEmployeeTenureLine, employee.dispatchedDaysTotal ?? 0, getPolicyParam("resume_tenure_days"));

    const form = new ActionFormData()
      .title(employeeName(employee, lang))
      .body(
        t(
          lang,
          STR.laborEmployeeDetailBody,
          employee.grade,
          employee.level,
          Math.round(employee.wage * getPriceLevel()),
          employee.skills.join(t(lang, STR.listSeparator)) || t(lang, STR.laborNoSkills),
          gateText,
          employee.records.length
        ) + "\n" + tenureLine
      )
      .button(t(lang, STR.laborBtnDispatch))
      .button(t(lang, STR.back));

    form.show(player).then((res) => {
      if (res.canceled || res.selection === 1) return openEmployeeListMenu(player, lecternLocation);
      openDispatchGenreMenu(player, employeeId, lecternLocation);
    }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
    return;
  }

  // 派遣中: 回収を試みる
  const result = collectDispatch(player, employeeId);
  if (!result.ok) {
    player.sendMessage(t(lang, STR.laborStillDispatched));
    return openEmployeeListMenu(player, lecternLocation);
  }
  const acc = getAccount(player);
  if (result.accident) {
    debitEmeralds(player, result.compensation, FLOW.LABOR_COMPENSATION, { clamp: true, to: HRMHRM_ORG_NAME });
    player.sendMessage(
      t(lang, STR.laborAccidentMsg, employeeName(employee, lang), result.compensation, stockOptionSuffix(lang, result.stockOptionsGranted))
    );
  } else {
    creditEmeralds(player, result.margin, FLOW.DISPATCH_MARGIN, { from: HRMHRM_ORG_NAME });
    player.sendMessage(
      t(
        lang,
        STR.laborDispatchCompleteMsg,
        employeeName(employee, lang),
        result.margin,
        result.laborCost,
        stockOptionSuffix(lang, result.stockOptionsGranted)
      )
    );
    if (result.delivered && result.facility) {
      player.sendMessage(t(lang, STR.laborDispatchDeliveredMsg, t(lang, result.facility.name), itemDisplayName(result.delivered.itemId, lang), result.delivered.count));
    }
    if (result.facilityClosed) player.sendMessage(t(lang, STR.laborFacilityClosedMsg));
  }
  if (result.retired) {
    player.sendMessage(t(lang, STR.laborRetiredMsg, employeeName(employee, lang), result.employee.dispatchedDaysTotal));
  }
  openEmployeeListMenu(player, lecternLocation);
}

// ---------- 派遣の流れ: ジャンル → 運営主体(施設) → 日数 ----------
// 運営主体が1つしかないジャンルは、運営主体の選択を飛ばす(法人の施設が増えたら選択肢として並ぶ)。
function openDispatchGenreMenu(player, employeeId, lecternLocation) {
  const lang = getLang(player);
  const genres = FACILITY_GENRES.filter((g) => listFacilities(g).length > 0);
  const form = new ActionFormData().title(t(lang, STR.laborBtnDispatch)).body(t(lang, STR.laborDispatchGenreBody));
  for (const g of genres) form.button(t(lang, GENRE_NAMES[g]));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === genres.length) return openEmployeeDetail(player, employeeId, lecternLocation);
    const genre = genres[res.selection];
    const facilities = listFacilities(genre);
    if (facilities.length === 1) return openDispatchDaysMenu(player, employeeId, facilities[0].id, lecternLocation);
    return openDispatchOperatorMenu(player, employeeId, genre, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openDispatchOperatorMenu(player, employeeId, genre, lecternLocation) {
  const lang = getLang(player);
  const facilities = listFacilities(genre);
  const form = new ActionFormData().title(t(lang, GENRE_NAMES[genre])).body(t(lang, STR.laborDispatchOperatorBody));
  for (const f of facilities) form.button(t(lang, f.name));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === facilities.length) return openDispatchGenreMenu(player, employeeId, lecternLocation);
    return openDispatchDaysMenu(player, employeeId, facilities[res.selection].id, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openDispatchDaysMenu(player, employeeId, facilityId, lecternLocation) {
  const lang = getLang(player);
  const facility = getFacility(facilityId);
  if (!facility) return openEmployeeDetail(player, employeeId, lecternLocation);

  const form = new ActionFormData()
    .title(t(lang, facility.name))
    .body(t(lang, STR.laborDispatchDaysBody))
    .button(t(lang, STR.laborBtnDispatch3))
    .button(t(lang, STR.laborBtnDispatch7))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openDispatchGenreMenu(player, employeeId, lecternLocation);
    const days = res.selection === 0 ? 3 : 7;
    const result = dispatchEmployee(player, employeeId, days, facilityId);
    if (result.ok) {
      const employee = getEmployees(player).find((e) => e.id === employeeId);
      player.sendMessage(
        t(lang, STR.laborDispatchedToMsg, employee ? employeeName(employee, lang) : "", t(lang, facility.name), days, itemDisplayName(result.output.itemId, lang), result.output.count)
      );
    } else if (result.reason === "noInput") {
      player.sendMessage(t(lang, STR.laborFactoryNoInputMsg, t(lang, facility.name)));
    }
    openEmployeeListMenu(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
