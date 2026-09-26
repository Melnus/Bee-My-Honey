import { world } from "@minecraft/server";
import {
  UNQUALIFIED_JOBS,
  QUALIFIED_JOBS,
  LICENSES,
  resolveResumeTier,
  gradeWageMultiplier,
  CONSULTANT_CONTRACTS,
  CONSULTANT_LOSS_PENALTY_PER_DAY,
  OWNER_GRADES,
  OWNER_BASE_WAGE_PER_DAY,
  OWNER_NAME_POOL,
  VILLAGER_FLAVOR_SKILLS,
  MAX_EMPLOYEES,
  getAccidentChance,
  OWNERS_CLUB_REGISTRATION_GRANT,
  HRMHRM_ORG_NAME,
  LABOR_COST_PER_DAY
} from "../data/labor-data.js";
import { getAccount, giveItem } from "./bank.js";
import { getStockPrice } from "./market-engine.js";

// ==========================================
// 労働市場 コアロジック / Labor Market Core
// (HRMHRM Partners HLD)
// ------------------------------------------
// 村人は「登録した瞬間に消去し、以降は内部データ(履歴書)だけを扱う」方式。
// ライブの村人エンティティを継続管理するコストは発生させない。
//
// 履歴書テンプレート(workers_resume):
// {
//   id,
//   identity: { name, tag: "player" | "villager" },
//   address: {
//     location: { x, y, z, dimension },
//     nearestNetherGate: { x, y, z, dimension } | null
//   },
//   affiliation: { type: "hrmhrm" | "company", id: null }, // company系は次アプデ用
//   records: [ { job, org, completedAt, grade } ],          // 仕事履歴
//   skills: [],                                              // 自己申告スキルセット(自由記述、ゲームに影響なし)
//   licenses: { nether?: {level,progress}, underwater?: {...}, end?: {...} }, // 実測のライセンス(プレイヤーのみ)
//
//   ---- ここから下は「運用フィールド」。テンプレート仕様の一部ではないが、
//        同じレコードに同居させて労働市場のゲーム状態を管理する ----
//   category: プレイヤー分のみ使用 ("unqualified"|"nether"|"underwater"|"end")。村人分はnull
//   grade / level: records件数から算出したグレード表示のキャッシュ値(賃金計算に使う)
//   wage: 村人分は1日あたり賃金(E)。プレイヤー分は求人ごとに変動するためnull
//   status: "idle" | "dispatched" (村人のみ意味を持つ)
//   dispatchEndDay / dispatchDays: 村人の派遣管理用
// }
// ==========================================

function currentGlobalDay() {
  return world.getDay();
}

// ==========================================
// HRMHRM株 ストックオプション
// ------------------------------------------
// HRMHRM株を一定評価額以上保有していると、労働市場で仕事が発生するたび
// (クエスト納品/コンサル契約満了/村人派遣の回収)に自社株(ストックオプション)が
// 自動付与される。通常の配当システム(毎日クレーム式)とは別の仕組み。
// ==========================================
const HRMHRM_STOCK_KEY = "hrmhrm";
export const HRMHRM_STOCK_OPTION_THRESHOLD = 100; // 既存の配当しきい値(DIVIDEND_THRESHOLD)と同じ基準
const HRMHRM_STOCK_OPTION_AMOUNT = 1; // 1回の労働イベントごとに付与される株数

function grantHrmhrmStockOptionIfEligible(player) {
  const price = getStockPrice(HRMHRM_STOCK_KEY);
  const holds = player.getDynamicProperty(`acc_stock_${HRMHRM_STOCK_KEY}`) ?? 0;
  const value = holds * price;
  if (value < HRMHRM_STOCK_OPTION_THRESHOLD) return 0;
  player.setDynamicProperty(`acc_stock_${HRMHRM_STOCK_KEY}`, holds + HRMHRM_STOCK_OPTION_AMOUNT);
  return HRMHRM_STOCK_OPTION_AMOUNT;
}

const EMPLOYEES_KEY = "labor_employees";

export function getEmployees(player) {
  const raw = player.getDynamicProperty(EMPLOYEES_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveEmployees(player, employees) {
  player.setDynamicProperty(EMPLOYEES_KEY, JSON.stringify(employees));
}

// オーナーズクラブの128件キャップ・事故率は「村人」だけを対象にする
// (プレイヤー自身の履歴書はカテゴリ数分=最大4件しか増えず、容量的にも無視できる)
export function getVillagerEmployees(player) {
  return getEmployees(player).filter((e) => e.identity.tag === "villager");
}

export function getEmployeeCount(player) {
  return getVillagerEmployees(player).length;
}

function pickWeighted(list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

// ---------- 住所(address)まわり ----------
function locationToAddress(loc, dimensionId) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z), dimension: dimensionId };
}

// 起点から半径 radius 以内で最も近いネザーゲート(ポータルブロック)を探す。
// 「スモールスタート」方針のため、狭い範囲の総当たりに留める(見つからなければnull)。
// 見つからない場合や範囲を広げたい場合は、将来的にプレイヤーが手動でゲート位置を
// 登録できる仕組みに拡張できるよう、戻り値の形は { x, y, z, dimension } に統一してある。
function findNearestNetherGate(dimension, origin, radius = 8) {
  let nearest = null;
  let nearestDistSq = Infinity;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > radius * radius || distSq >= nearestDistSq) continue;
        const loc = { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
        let block;
        try {
          block = dimension.getBlock(loc);
        } catch (e) {
          continue;
        }
        if (block && block.typeId === "minecraft:portal") {
          nearest = loc;
          nearestDistSq = distSq;
        }
      }
    }
  }
  return nearest ? locationToAddress(nearest, dimension.id) : null;
}

// ---------- 履歴書(オーナーズクラブの雇用者=村人)登録 ----------
// 書見台の近くにいる本物の村人を1体、履歴書に変換する（実体は即座に消す）。
export function registerNearbyVillagerAsEmployee(player, lecternLocation, radius = 6) {
  if (getVillagerEmployees(player).length >= MAX_EMPLOYEES) {
    return { ok: false, reason: "capReached" };
  }

  const dimension = player.dimension;
  let candidate;
  try {
    const nearby = dimension.getEntities({
      type: "minecraft:villager",
      location: lecternLocation,
      maxDistance: radius
    });
    candidate = nearby[0];
  } catch (e) {
    candidate = undefined;
  }

  if (!candidate) return { ok: false, reason: "noVillager" };

  const grade = pickWeighted(OWNER_GRADES);
  const level = 1 + Math.floor(Math.random() * 3); // Lv1〜3でスタート
  const wage = Math.round(OWNER_BASE_WAGE_PER_DAY * grade.wageMultiplier * (1 + (level - 1) * 0.2));
  const name = OWNER_NAME_POOL[Math.floor(Math.random() * OWNER_NAME_POOL.length)];
  const skillCount = 1 + Math.floor(Math.random() * 2);
  const skills = [];
  const pool = [...VILLAGER_FLAVOR_SKILLS];
  for (let i = 0; i < skillCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    skills.push(pool.splice(idx, 1)[0]);
  }

  const employee = {
    id: `e_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    identity: { name, tag: "villager" },
    address: {
      location: locationToAddress(lecternLocation, dimension.id),
      nearestNetherGate: findNearestNetherGate(dimension, lecternLocation)
    },
    affiliation: { type: "hrmhrm", id: null },
    records: [],
    skills,
    licenses: {},
    category: null,
    grade: grade.key,
    level,
    wage,
    status: "idle",
    dispatchEndDay: null,
    dispatchDays: null
  };

  const employees = getEmployees(player);
  employees.push(employee);
  saveEmployees(player, employees);

  try {
    candidate.remove(); // 履歴書化したので実体は消す
  } catch (e) {
    // 既に無効な場合は無視
  }

  return { ok: true, employee, grantEmeralds: OWNERS_CLUB_REGISTRATION_GRANT };
}

export function dispatchEmployee(player, employeeId, days) {
  const employees = getEmployees(player);
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee || employee.identity.tag !== "villager" || employee.status !== "idle") return { ok: false };

  employee.status = "dispatched";
  employee.dispatchDays = days;
  employee.dispatchEndDay = currentGlobalDay() + days;
  saveEmployees(player, employees);
  return { ok: true };
}

// 派遣完了分を回収する。事故が発生した場合は補填(=支出)が発生する。
export function collectDispatch(player, employeeId) {
  const employees = getEmployees(player);
  const idx = employees.findIndex((e) => e.id === employeeId);
  if (idx === -1) return { ok: false, reason: "notFound" };

  const employee = employees[idx];
  if (employee.identity.tag !== "villager") return { ok: false, reason: "notVillager" };
  if (employee.status !== "dispatched") return { ok: false, reason: "notDispatched" };
  if (currentGlobalDay() < employee.dispatchEndDay) return { ok: false, reason: "stillWorking" };

  // 事故率は「村人」の登録数だけを基準にする(プレイヤー自身の履歴書は数えない)
  const count = getVillagerEmployees(player).length;
  const accidentChance = getAccidentChance(count);
  const isAccident = Math.random() < accidentChance;
  const days = employee.dispatchDays ?? 1;

  employee.status = "idle";
  employee.dispatchDays = null;
  employee.dispatchEndDay = null;
  employee.records.push({
    job: "dispatch",
    org: HRMHRM_ORG_NAME,
    completedAt: currentGlobalDay(),
    grade: isAccident ? "accident" : employee.grade
  });
  saveEmployees(player, employees);

  const laborCost = LABOR_COST_PER_DAY * days;
  const stockOptionsGranted = grantHrmhrmStockOptionIfEligible(player);

  if (isAccident) {
    const compensation = employee.wage * days + laborCost; // 事故があっても働かせていた分の人件費は発生している
    return { ok: true, accident: true, compensation, laborCost, stockOptionsGranted, employee };
  }

  const margin = Math.max(0, employee.wage * days - laborCost);
  return { ok: true, accident: false, margin, laborCost, stockOptionsGranted, employee };
}

export function removeEmployee(player, employeeId) {
  const employees = getEmployees(player).filter((e) => e.id !== employeeId);
  saveEmployees(player, employees);
}

// ---------- スタッフサービス：プレイヤー自身の履歴書 ----------
// 村人(オーナーズクラブ)と同じ履歴書テンプレートに、identity.tag: "player" で登録する。
// カテゴリ(資格なし/ネザー/水中/エンド)ごとに1枚。
export function getOrCreatePlayerResume(player, category) {
  const employees = getEmployees(player);
  const existing = employees.find((e) => e.identity.tag === "player" && e.category === category);
  if (existing) return existing;

  const dimension = player.dimension;
  const resume = {
    id: `p_${category}`,
    identity: { name: player.name, tag: "player" },
    address: {
      location: locationToAddress(player.location, dimension.id),
      nearestNetherGate: findNearestNetherGate(dimension, player.location)
    },
    affiliation: { type: "hrmhrm", id: null },
    records: [],
    skills: [],
    licenses: {},
    category,
    grade: "C",
    level: 1,
    wage: null, // 求人ごとに変動するため固定値を持たず、都度 gradeWageMultiplier で計算する
    status: "idle",
    dispatchEndDay: null,
    dispatchDays: null
  };
  employees.push(resume);
  saveEmployees(player, employees);
  return resume;
}

// クエスト納品完了後に、仕事履歴(records)を1件追加し、グレード/レベルを再計算する。
function advancePlayerResume(player, category, jobKey) {
  const employees = getEmployees(player);
  let idx = employees.findIndex((e) => e.identity.tag === "player" && e.category === category);
  let resume = idx === -1 ? getOrCreatePlayerResume(player, category) : employees[idx];
  if (idx === -1) idx = getEmployees(player).findIndex((e) => e.id === resume.id);

  resume.identity.name = player.name; // 表示名は最新のプレイヤー名に追従させる
  resume.records.push({ job: jobKey, org: HRMHRM_ORG_NAME, completedAt: currentGlobalDay(), grade: resume.grade });
  const tier = resolveResumeTier(resume.records.length);
  resume.grade = tier.grade;
  resume.level = tier.level;

  const employeesNow = getEmployees(player);
  const idxNow = employeesNow.findIndex((e) => e.identity.tag === "player" && e.category === category);
  if (idxNow === -1) employeesNow.push(resume);
  else employeesNow[idxNow] = resume;
  saveEmployees(player, employeesNow);
  return resume;
}

// 自己申告スキルセットの更新(プレイヤーが自由記述で設定する。ゲームには影響しない)
export function setPlayerSkills(player, category, skills) {
  const employees = getEmployees(player);
  const idx = employees.findIndex((e) => e.identity.tag === "player" && e.category === category);
  const resume = idx === -1 ? getOrCreatePlayerResume(player, category) : employees[idx];
  resume.skills = skills.slice(0, 10); // 念のため上限を設ける
  const employeesNow = getEmployees(player);
  const idxNow = employeesNow.findIndex((e) => e.identity.tag === "player" && e.category === category);
  if (idxNow === -1) employeesNow.push(resume);
  else employeesNow[idxNow] = resume;
  saveEmployees(player, employeesNow);
  return resume;
}

// ---------- ライセンス制度(実測進捗方式) ----------
// 「金を払って運試し」ではなく、実際にその分野の作業(設置/破壊)を行った実績で
// ライセンスレベルが上がる。方針: スモールスタート・スケールアウト。
// Lv1(見習い)は1チャンク(16x16)の中で対象ブロックをquota個 設置/破壊すれば取得。
// main.js のブロック設置/破壊イベントから recordLicenseWork() を呼び出して進捗させる。

function chunkKeyOf(loc) {
  const cx = Math.floor(loc.x / 16);
  const cz = Math.floor(loc.z / 16);
  return `${cx},${cz}`;
}

function getLicenseState(player, category, type) {
  const employees = getEmployees(player);
  const resume = employees.find((e) => e.identity.tag === "player" && e.category === category);
  return resume?.licenses?.[type] ?? { level: 0, progress: 0, chunkProgress: {} };
}

export function getLicenseLevel(player, category, type) {
  return getLicenseState(player, category, type).level ?? 0;
}

export function hasQualification(player, category) {
  const def = QUALIFIED_JOBS[category];
  if (!def) return true; // "unqualified" 等、ライセンス不要のカテゴリ
  return getLicenseLevel(player, category, category) >= (def.minLicenseLevel ?? 1);
}

// ブロック設置/破壊イベントから呼ぶ。全プレイヤー・全カテゴリのライセンス定義と突き合わせ、
// 一致するものがあれば当該プレイヤーの該当カテゴリ履歴書の進捗を加算する。
export function recordLicenseWork(player, blockTypeId, action, blockLocation, dimensionId, biomeId) {
  for (const [type, def] of Object.entries(LICENSES)) {
    if (def.trackAction !== action || def.blockType !== blockTypeId) continue;
    if (def.dimension && def.dimension !== dimensionId) continue;
    if (def.biome && def.biome !== biomeId) continue;

    const category = type; // 現状はライセンス種別=カテゴリ名(nether/underwater/end)で1:1対応
    const employees = getEmployees(player);
    let idx = employees.findIndex((e) => e.identity.tag === "player" && e.category === category);
    if (idx === -1) {
      getOrCreatePlayerResume(player, category);
      idx = getEmployees(player).findIndex((e) => e.identity.tag === "player" && e.category === category);
    }
    const employeesNow = getEmployees(player);
    const resume = employeesNow[idx];
    if (!resume.licenses[type]) resume.licenses[type] = { level: 0, progress: 0, chunkProgress: {} };
    const state = resume.licenses[type];

    if (state.level >= def.stages.length) continue; // 最終段階まで到達済み
    const nextStage = def.stages[state.level]; // level=0 → stages[0]がLv1の関門

    const cKey = chunkKeyOf(blockLocation);
    state.chunkProgress[cKey] = (state.chunkProgress[cKey] ?? 0) + 1;

    if (state.chunkProgress[cKey] >= nextStage.quota) {
      state.level = nextStage.level;
      state.progress = 0;
      state.chunkProgress = {}; // 次の段階に向けて仕切り直し
      try {
        player.sendMessage(`§a[HRMHRM] ${def.name.ja} のライセンスがLv${nextStage.level}(${nextStage.label.ja})になりました！`);
      } catch (e) {
        // メッセージ送信失敗は無視
      }
    }

    saveEmployees(player, employeesNow);
  }
}

// ---------- スタッフサービス：クエストボード ----------
// 納品は「プレイヤーの手持ち」ではなく、書見台の近くに置かれたチェスト/シェルカーボックスから
// 必要数を削除する方式(畑仕事の収穫物をいちいち手持ちで運ばず、集荷箱に貯めて納品するイメージ)。
const CONTAINER_BLOCK_TYPES = new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel"
]);

function isShulkerBox(typeId) {
  return typeId.includes("shulker_box");
}

// 起点の周囲(半径 radius)にあるチェスト/樽/シェルカーボックスのインベントリを集める。
// 「スモールスタート」のため範囲は控えめに留める。
export function getNearbyContainers(dimension, origin, radius = 6) {
  const containers = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const loc = { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
        let block;
        try {
          block = dimension.getBlock(loc);
        } catch (e) {
          continue;
        }
        if (!block) continue;
        if (!CONTAINER_BLOCK_TYPES.has(block.typeId) && !isShulkerBox(block.typeId)) continue;
        const inv = block.getComponent("minecraft:inventory")?.container;
        if (inv) containers.push(inv);
      }
    }
  }
  return containers;
}

// カテゴリごとに日替わりのクエストを1つ生成し、日付が変わるまで固定する。
function questStateKey(category) {
  return `labor_quest_${category}`;
}

function pickJobForCategory(category) {
  if (category === "unqualified") {
    return UNQUALIFIED_JOBS[Math.floor(Math.random() * UNQUALIFIED_JOBS.length)];
  }
  const def = QUALIFIED_JOBS[category];
  return def ? def.jobs[Math.floor(Math.random() * def.jobs.length)] : null;
}

// ==========================================
// クエスト・リスティング共通テンプレート (quest_listing)
// ------------------------------------------
// 次アプデの「会社」機能で、プレイヤーがクエストを発注し、他プレイヤー(や村人)が
// 受注する仕組みを作る予定。同じ枠組みは株式の上場や郵便販売の出品にも転用できる
// 想定のため、今回のうちから発注/受注の形をしたデータ構造にしておく。
// 今回はまだ発注UIはなく、HRMHRM(issuer.type: "hrmhrm")がグレードに応じて
// 自動生成し、生成された瞬間にそのプレイヤー専用として割り当てる(claimedBy固定)。
//
// {
//   id,
//   kind: "quest",                          // 将来: "stock_listing" | "mail_order" 等も同じ枠組みに乗る想定
//   issuer: { type: "hrmhrm"|"company"|"player", id: null },
//   title: { ja, en },
//   requirement: { itemId, count },         // 納品条件
//   reward: { amount, currency: "emerald" },
//   category,                                // 対応する求人カテゴリ(HRMHRM生成分のみ意味を持つ)
//   jobKey,                                  // どの求人テンプレートから生成されたか(履歴書records用)
//   status: "open" | "completed",           // 将来的に "claimed" 等が増える想定
//   createdAt,                               // 生成日(world day)
//   claimedBy: { type: "player", id: null }  // 今回は生成と同時にそのプレイヤー専用になる
// }
// ==========================================
export function getTodayQuest(player, category) {
  const day = currentGlobalDay();
  const raw = player.getDynamicProperty(questStateKey(category));
  if (raw) {
    try {
      const listing = JSON.parse(raw);
      if (listing.createdAt === day) return listing;
    } catch (e) {
      // 壊れていた場合は再生成する
    }
  }

  const job = pickJobForCategory(category);
  if (!job) return null;

  const count = job.countMin + Math.floor(Math.random() * (job.countMax - job.countMin + 1));
  const amount = Math.round(job.wageMin + Math.random() * (job.wageMax - job.wageMin));

  const listing = {
    id: `q_${category}_${day}`,
    kind: "quest",
    issuer: { type: "hrmhrm", id: null },
    title: job.name,
    requirement: { itemId: job.itemId, count },
    reward: { amount, currency: "emerald" },
    category,
    jobKey: job.key,
    status: "open",
    createdAt: day,
    claimedBy: { type: "player", id: null }
  };
  player.setDynamicProperty(questStateKey(category), JSON.stringify(listing));
  return listing;
}

// 納品物が「書見台の近くのチェスト/樽/シェルカーボックス」にあるか確認し、消費して報酬を支払う。
// (プレイヤーの手持ちではなく、集荷箱にまとめて置いておく方式。日をまたがない限り1日1回まで。)
export function completeQuest(player, category, lecternLocation) {
  const listing = getTodayQuest(player, category);
  if (!listing) return { ok: false, reason: "noQuest" };
  if (listing.status === "completed") return { ok: false, reason: "alreadyCompleted" };

  const origin = lecternLocation ?? player.location;
  const containers = getNearbyContainers(player.dimension, origin);
  if (containers.length === 0) return { ok: false, reason: "noContainer" };

  const { itemId, count } = listing.requirement;
  let have = 0;
  for (const inv of containers) {
    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (item && item.typeId === itemId) have += item.amount;
    }
  }
  if (have < count) return { ok: false, reason: "insufficientItems", needed: count };

  let left = count;
  for (const inv of containers) {
    for (let i = 0; i < inv.size && left > 0; i++) {
      const item = inv.getItem(i);
      if (item && item.typeId === itemId) {
        if (item.amount <= left) {
          left -= item.amount;
          inv.setItem(i, undefined);
        } else {
          item.amount -= left;
          inv.setItem(i, item);
          left = 0;
        }
      }
    }
  }

  const resumeBefore = getOrCreatePlayerResume(player, category);
  const grossWage = Math.round(listing.reward.amount * gradeWageMultiplier(resumeBefore.grade));
  const laborCost = LABOR_COST_PER_DAY; // クエスト1件=1日分の労働とみなす
  const wage = Math.max(0, grossWage - laborCost);

  const acc = getAccount(player);
  player.setDynamicProperty("acc_emeralds", acc.emeralds + wage);

  listing.status = "completed";
  listing.claimedBy = { type: "player", id: player.name };
  player.setDynamicProperty(questStateKey(category), JSON.stringify(listing));
  const resumeAfter = advancePlayerResume(player, category, listing.jobKey);
  const stockOptionsGranted = grantHrmhrmStockOptionIfEligible(player);

  return { ok: true, wage, grossWage, laborCost, stockOptionsGranted, grade: resumeAfter.grade, level: resumeAfter.level };
}

// ---------- コンサルタントサービス（村人を借りる） ----------
const CONSULTANT_KEY = "labor_consultant_contract";

export function getActiveConsultantContract(player) {
  const raw = player.getDynamicProperty(CONSULTANT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function startConsultantContract(player, contractKey) {
  if (getActiveConsultantContract(player)) return { ok: false, reason: "alreadyActive" };
  const def = CONSULTANT_CONTRACTS.find((c) => c.key === contractKey);
  if (!def) return { ok: false, reason: "unknownContract" };

  const contract = {
    key: def.key,
    startDay: currentGlobalDay(),
    endDay: currentGlobalDay() + def.days,
    days: def.days,
    margin: Math.round(def.marginMin + Math.random() * (def.marginMax - def.marginMin))
  };
  player.setDynamicProperty(CONSULTANT_KEY, JSON.stringify(contract));

  // 契約成立の証として、村人スポーンエッグとベッドを渡す（設置・運用はプレイヤーに委ねる簡易実装）。
  giveItem(player, "minecraft:villager_spawn_egg", 1);
  giveItem(player, "minecraft:red_bed", 1);

  return { ok: true, contract };
}

export function completeConsultantContract(player, lecternLocation, radius = 6) {
  const contract = getActiveConsultantContract(player);
  if (!contract) return { ok: false, reason: "noContract" };
  if (currentGlobalDay() < contract.endDay) return { ok: false, reason: "stillActive" };

  // 元の仕様どおり「書見台に近づいて契約満了を押すと村人がリムーブされる」を実際に検証する。
  // 借りた村人を書見台の近くまで連れて帰っていないと、契約は完了できない。
  const dimension = player.dimension;
  const origin = lecternLocation ?? player.location;
  let candidate;
  try {
    const nearby = dimension.getEntities({ type: "minecraft:villager", location: origin, maxDistance: radius });
    candidate = nearby[0];
  } catch (e) {
    candidate = undefined;
  }
  if (!candidate) return { ok: false, reason: "noVillagerNearby" };

  const laborCost = LABOR_COST_PER_DAY * contract.days;
  const margin = Math.max(0, contract.margin - laborCost);

  const acc = getAccount(player);
  player.setDynamicProperty("acc_emeralds", acc.emeralds + margin);
  player.setDynamicProperty(CONSULTANT_KEY, undefined);

  try {
    candidate.remove(); // 契約満了に伴い、借りていた村人をHRMHRMに返却(=消去)
  } catch (e) {
    // 既に無効な場合は無視
  }

  const stockOptionsGranted = grantHrmhrmStockOptionIfEligible(player);
  return { ok: true, margin, laborCost, stockOptionsGranted };
}

// 期間内に村人を紛失してしまった場合の自己申告。未消化日数分の違約金・保険金を支払う。
export function reportConsultantLoss(player) {
  const contract = getActiveConsultantContract(player);
  if (!contract) return { ok: false, reason: "noContract" };

  const daysLeft = Math.max(0, contract.endDay - currentGlobalDay());
  const penalty = daysLeft * CONSULTANT_LOSS_PENALTY_PER_DAY;
  const acc = getAccount(player);
  player.setDynamicProperty("acc_emeralds", Math.max(0, acc.emeralds - penalty));
  player.setDynamicProperty(CONSULTANT_KEY, undefined);
  return { ok: true, penalty };
}
