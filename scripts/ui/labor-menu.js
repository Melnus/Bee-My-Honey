import { getPriceLevel } from "../economy/price-level.js";
import { creditEmeralds, debitEmeralds, FLOW } from "../economy/ledger.js";
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
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
import { getBoard, isFirstJobAvailable, completeFirstJob, FIRST_JOB_ID, FIRST_JOB_TITLE, getClaims, getClaim, getClaimedBy, claimQuest, releaseQuest, deliverQuest, getMaxActiveQuests } from "../economy/quest-board.js";
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

// ---------- スタッフサービス(求人掲示板) ----------
// 受注中のクエスト(掲示が入れ替わっても残る)と、今日の掲示4件を並べる。選ぶと詳細(受注 / 納品・放棄)へ。
export function openStaffMenu(player, lecternLocation) {
  const lang = getLang(player);
  const claims = getClaims(player);
  const claimed = claims.filter((c) => c.state === "claimed");

  const entries = [];
  if (isFirstJobAvailable(player)) entries.push({ questId: FIRST_JOB_ID, special: "first" });
  for (const c of claimed) {
    entries.push({ questId: c.questId, category: c.category, tag: t(lang, STR.laborBoardTagClaimed), title: c.title, requirement: c.requirement, reward: c.reward, locked: false });
  }
  for (const l of getBoard()) {
    if (claimed.some((c) => c.questId === l.id)) continue;
    const done = claims.find((c) => c.questId === l.id && c.state === "completed");
    const locked = !hasQualification(player, l.category);
    const tag = done ? t(lang, STR.laborBoardTagDone) : locked ? t(lang, STR.laborBoardTagLocked) : "";
    entries.push({ questId: l.id, category: l.category, tag, title: l.title, requirement: l.requirement, reward: l.reward.amount, locked: locked && !done });
  }

  const form = new ActionFormData()
    .title(t(lang, STR.laborStaffTitle))
    .body(t(lang, STR.laborBoardBody, getMaxActiveQuests(), claimed.length));
  for (const e of entries) {
    if (e.special === "first") {
      form.button(t(lang, STR.laborFirstJobButton, t(lang, FIRST_JOB_TITLE)));
      continue;
    }
    form.button(t(lang, STR.laborBoardButton, e.tag, t(lang, e.title), itemDisplayName(e.requirement.itemId, lang), e.requirement.count, e.reward));
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === entries.length) return openLaborMenu(player, lecternLocation);
    const e = entries[res.selection];
    if (e.special === "first") return openFirstJobScreen(player, lecternLocation);
    if (e.locked) return openLicenseProgressScreen(player, e.category, lecternLocation);
    return openQuestDetail(player, e.questId, lecternLocation);
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

  form.show(player).then(() => openStaffMenu(player, lecternLocation)).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function itemDisplayName(itemId, lang) {
  const key = itemId.replace("minecraft:", "");
  const entry = LABOR_ITEM_NAMES[key];
  return entry ? t(lang, entry) : key;
}

// 初めてのアルバイト(初回の仕事)。説明を読んで「報告する」だけ。報酬はシュルカーボックス1個。
function openFirstJobScreen(player, lecternLocation) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, FIRST_JOB_TITLE))
    .body(t(lang, STR.laborFirstJobBody, getMaxActiveQuests()))
    .button(t(lang, STR.laborBtnReport))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openStaffMenu(player, lecternLocation);
    const r = completeFirstJob(player);
    if (r.ok) player.sendMessage(t(lang, STR.laborFirstJobDoneMsg));
    else if (r.reason === "giveFailed") player.sendMessage(t(lang, STR.laborFirstJobFailedMsg));
    return openStaffMenu(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// クエストの詳細。受注していなければ「受注する」、受注中なら「納品する / 放棄する」(もう一度同じクエストを選ぶと出る)。
function openQuestDetail(player, questId, lecternLocation) {
  const lang = getLang(player);
  const claim = getClaim(player, questId);
  const listing = getBoard().find((l) => l.id === questId);
  const src = claim ?? listing;
  if (!src) return openStaffMenu(player, lecternLocation);

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
      return openStaffMenu(player, lecternLocation);
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
      return openStaffMenu(player, lecternLocation);
    });
    add(t(lang, STR.laborBtnAbandon), () => {
      releaseQuest(player, questId);
      player.sendMessage(t(lang, STR.laborAbandonedMsg, t(lang, src.title)));
      return openStaffMenu(player, lecternLocation);
    });
  }
  add(t(lang, STR.laborBtnEditSkills), () => openSkillEditForm(player, category, lecternLocation, again));
  add(t(lang, STR.back), () => openStaffMenu(player, lecternLocation));

  form.show(player).then((res) => {
    if (res.canceled) return openStaffMenu(player, lecternLocation);
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
            result.employee.identity.name,
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
    form.button(t(lang, STR.laborEmployeeButtonLabel, e.identity.name, e.grade, e.level, statusLabel, Math.round(e.wage * getPriceLevel())));
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
      .title(employee.identity.name)
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
      t(lang, STR.laborAccidentMsg, employee.identity.name, result.compensation, stockOptionSuffix(lang, result.stockOptionsGranted))
    );
  } else {
    creditEmeralds(player, result.margin, FLOW.DISPATCH_MARGIN, { from: HRMHRM_ORG_NAME });
    player.sendMessage(
      t(
        lang,
        STR.laborDispatchCompleteMsg,
        employee.identity.name,
        result.margin,
        result.laborCost,
        stockOptionSuffix(lang, result.stockOptionsGranted)
      )
    );
    if (result.delivered && result.facility) {
      player.sendMessage(t(lang, STR.laborDispatchDeliveredMsg, t(lang, result.facility.name), itemDisplayName(result.delivered.itemId, lang), result.delivered.count));
    }
  }
  if (result.retired) {
    player.sendMessage(t(lang, STR.laborRetiredMsg, employee.identity.name, result.employee.dispatchedDaysTotal));
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
        t(lang, STR.laborDispatchedToMsg, employee?.identity.name ?? "", t(lang, facility.name), days, itemDisplayName(result.output.itemId, lang), result.output.count)
      );
    }
    openEmployeeListMenu(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
