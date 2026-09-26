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
  LABOR_BIOME_NAMES
} from "../data/labor-data.js";
import {
  hasQualification,
  getTodayQuest,
  completeQuest,
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
export function openStaffMenu(player, lecternLocation) {
  const lang = getLang(player);
  const categories = [
    { key: "unqualified", name: t(lang, STR.laborCatUnqualified) },
    { key: "nether", name: t(lang, STR.laborCatQualifiedLabel, t(lang, QUALIFIED_JOBS.nether.name)) },
    { key: "underwater", name: t(lang, STR.laborCatQualifiedLabel, t(lang, QUALIFIED_JOBS.underwater.name)) },
    { key: "end", name: t(lang, STR.laborCatQualifiedLabel, t(lang, QUALIFIED_JOBS.end.name)) }
  ];

  const form = new ActionFormData()
    .title(t(lang, STR.laborStaffTitle))
    .body(t(lang, STR.laborStaffBody));
  for (const c of categories) form.button(c.name);
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === categories.length) return openLaborMenu(player, lecternLocation);
    const category = categories[res.selection].key;
    if (hasQualification(player, category)) {
      return openQuestBoard(player, category, lecternLocation);
    }
    return openLicenseProgressScreen(player, category, lecternLocation);
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

function openQuestBoard(player, category, lecternLocation) {
  const lang = getLang(player);
  const listing = getTodayQuest(player, category);
  if (!listing) return openStaffMenu(player, lecternLocation);

  const isCompleted = listing.status === "completed";
  const resume = getOrCreatePlayerResume(player, category);
  const body = isCompleted
    ? t(lang, STR.laborQuestCompletedBody)
    : t(
        lang,
        STR.laborQuestBody,
        itemDisplayName(listing.requirement.itemId, lang),
        listing.requirement.count,
        listing.reward.amount,
        resume.grade
      );

  const form = new ActionFormData()
    .title(t(lang, STR.laborQuestTitle))
    .body(body);
  if (!isCompleted) form.button(t(lang, STR.laborBtnDeliver));
  form.button(t(lang, STR.laborBtnEditSkills));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled) return openStaffMenu(player, lecternLocation);
    const skillBtnIndex = isCompleted ? 0 : 1;
    const backBtnIndex = isCompleted ? 1 : 2;
    if (!isCompleted && res.selection === 0) {
      const result = completeQuest(player, category, lecternLocation);
      if (!result.ok) {
        const msg =
          result.reason === "insufficientItems"
            ? t(lang, STR.laborDeliverInsufficientItem, itemDisplayName(listing.requirement.itemId, lang))
            : result.reason === "noContainer"
              ? t(lang, STR.laborDeliverNoContainer)
              : t(lang, STR.laborDeliverFailed);
        player.sendMessage(msg);
        return openQuestBoard(player, category, lecternLocation);
      }
      player.sendMessage(
        t(
          lang,
          STR.laborDeliverSuccess,
          result.wage,
          result.grossWage,
          result.laborCost,
          stockOptionSuffix(lang, result.stockOptionsGranted)
        )
      );
      return openQuestBoard(player, category, lecternLocation);
    }
    if (res.selection === skillBtnIndex) return openSkillEditForm(player, category, lecternLocation);
    if (res.selection === backBtnIndex) return openStaffMenu(player, lecternLocation);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openSkillEditForm(player, category, lecternLocation) {
  const lang = getLang(player);
  const resume = getOrCreatePlayerResume(player, category);
  const form = new ModalFormData()
    .title(t(lang, STR.laborSkillEditTitle))
    .textField(t(lang, STR.laborSkillEditField), "", resume.skills.join(","));

  form.show(player).then((res) => {
    if (res.canceled) return openQuestBoard(player, category, lecternLocation);
    const [raw] = res.formValues;
    const skills = String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    setPlayerSkills(player, category, skills);
    player.sendMessage(t(lang, STR.laborSkillUpdated));
    openQuestBoard(player, category, lecternLocation);
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
    form.button(t(lang, STR.laborContractOptionBtn, t(lang, c.name), c.marginMin, c.marginMax));
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
        player.setDynamicProperty("acc_emeralds", acc.emeralds + result.grantEmeralds);
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
    form.button(t(lang, STR.laborEmployeeButtonLabel, e.identity.name, e.grade, e.level, statusLabel, e.wage));
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

    const form = new ActionFormData()
      .title(employee.identity.name)
      .body(
        t(
          lang,
          STR.laborEmployeeDetailBody,
          employee.grade,
          employee.level,
          employee.wage,
          employee.skills.join(t(lang, STR.listSeparator)) || t(lang, STR.laborNoSkills),
          gateText,
          employee.records.length
        )
      )
      .button(t(lang, STR.laborBtnDispatch3))
      .button(t(lang, STR.laborBtnDispatch7))
      .button(t(lang, STR.back));

    form.show(player).then((res) => {
      if (res.canceled || res.selection === 2) return openEmployeeListMenu(player, lecternLocation);
      const days = res.selection === 0 ? 3 : 7;
      dispatchEmployee(player, employeeId, days);
      player.sendMessage(t(lang, STR.laborDispatchedMsg, employee.identity.name, days));
      openEmployeeListMenu(player, lecternLocation);
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
    player.setDynamicProperty("acc_emeralds", Math.max(0, acc.emeralds - result.compensation));
    player.sendMessage(
      t(lang, STR.laborAccidentMsg, employee.identity.name, result.compensation, stockOptionSuffix(lang, result.stockOptionsGranted))
    );
  } else {
    player.setDynamicProperty("acc_emeralds", acc.emeralds + result.margin);
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
  }
  openEmployeeListMenu(player, lecternLocation);
}
