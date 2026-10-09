import { world, ItemStack } from "@minecraft/server";
import { getPriceLevel, scaleEInt } from "./price-level.js";
import { creditEmeralds, FLOW } from "./ledger.js";
import { getPolicyParam } from "./policy.js";
import {
  UNQUALIFIED_JOBS,
  QUALIFIED_JOBS,
  gradeWageMultiplier,
  LABOR_COST_PER_DAY,
  HRMHRM_ORG_NAME
} from "../data/labor-data.js";
import {
  currentGlobalDay,
  hasQualification,
  getOrCreatePlayerResume,
  advancePlayerResume,
  grantHrmhrmStockOptionIfEligible,
  getNearbyContainers,
  getEmployees
} from "./labor.js";

// ==========================================
// クエストの掲示板 / Quest Board  (dev/quest-template-spec.md)
// ------------------------------------------
// 掲示は「ワールド共通の日替わり4件」: 求人カテゴリ(資格なし / ネザー / 水中 / エンド)ごとに1件。
// 日付が種なので、全員が同じ掲示を見る(保存はしない。呼ぶたびに同じものが作られる)。
// 資格が要るカテゴリは、ライセンスを持っていないと受注できない(ロック表示)。
//
// 受注 → 受注中の一覧に固定される(掲示が翌日に入れ替わっても、同じクエストを選んで納品/放棄できる)。
//   ・HRMHRM発は slots: null(無制限)。全員が同じクエストを受けられる。
//   ・受注できる同時件数は政策パラメータ quest_max_active(初期値2)。
//   ・受注は受けた週の終わりで期限切れ(遅延判定: 一覧を開いたときに外す。ログインしていない人の分も残らない)。
//   ・放棄は期限切れと同じ処理(受注を外すだけ。報酬の預託はHRMHRM発には無い)。
// 受注者の一覧(誰が受けているか)はワールド側に持ち、詳細画面に出す。進捗・納品はプレイヤー側の受注記録が正。
//
// quest_listing = {
//   id, kind: "quest", issuer: { type: "hrmhrm"|"company"|"player", id }, questType: "delivery",
//   title: { ja, en }, requirement: { itemId, count }, reward: { amount, base, currency: "emerald" },
//   slots: null | number, category, jobKey, createdAt
// }
// 受注記録(プレイヤー側): { questId, category, jobKey, title, requirement, reward(受注時の名目額で確定), day, expiresWeek, state: "claimed"|"completed" }
// ==========================================

export const QUEST_CATEGORIES = ["unqualified", "nether", "underwater", "end"];

const CLAIMS_KEY = "labor_quest_claims";       // プレイヤー側: 受注記録の配列
const REGISTRY_KEY = "labor_quest_claimedby";  // ワールド側: { [questId]: [{ name, state, expiresWeek }] }
const REGISTRY_MAX_CHARS = 30000;

function weekNow() {
  return Math.floor(currentGlobalDay() / 7);
}

// ---------- 日付が種の乱数(全員が同じ掲示を見るため) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jobsFor(category) {
  if (category === "unqualified") return UNQUALIFIED_JOBS;
  return QUALIFIED_JOBS[category]?.jobs ?? [];
}

function buildListing(day, category, index) {
  const jobs = jobsFor(category);
  if (jobs.length === 0) return null;
  const rng = mulberry32(day * 1009 + index * 7919 + 17);
  const job = jobs[Math.floor(rng() * jobs.length)];
  const count = job.countMin + Math.floor(rng() * (job.countMax - job.countMin + 1));
  const base = job.wageMin + rng() * (job.wageMax - job.wageMin);
  return {
    id: `q_${day}_${category}`,
    kind: "quest",
    issuer: { type: "hrmhrm", id: null },
    questType: "delivery",
    title: job.name,
    requirement: { itemId: job.itemId, count },
    reward: { amount: Math.round(base * getPriceLevel()), base, currency: "emerald" }, // 表示は今の掛率。受注した時点の名目額で確定する
    slots: null,
    category,
    jobKey: job.key,
    createdAt: day
  };
}

// 今日の掲示(4件)。day を渡すと、その日の掲示を作り直せる。
export function getBoard(day = currentGlobalDay()) {
  const out = [];
  QUEST_CATEGORIES.forEach((category, i) => {
    const listing = buildListing(day, category, i);
    if (listing) out.push(listing);
  });
  return out;
}

// ---------- 初めてのアルバイト(初回の仕事) ----------
// スタッフサービスを初めて使う人(仕事の実績がない人)の一覧の先頭に、固定で1件だけ出す。
// 納品物は要らず、説明を読んで「報告する」だけで完了し、シュルカーボックスを1個もらえる。
// 受注の枠(quest_max_active)には数えない(受注せずにその場で完了する)。1人1回だけ。
// 登録の仕組み(スターターキット)ができたら、シュルカーの配布はそちらへ移す。「もらい済み」の印はそのとき共通にする。
export const FIRST_JOB_ID = "q_first";
export const FIRST_JOB_TITLE = { ja: "初めてのアルバイト", en: "Your First Part-time Job" };
const FIRST_JOB_FLAG = "labor_first_job_done";
// 通販(mail-order-data.js の shulker_box)と同じID。渡せなければ無染色のIDを試す。
// 取引・納品の判定は typeId に "shulker_box" を含むかどうかなので、色(ID)は問わない。
const FIRST_JOB_GIFT_IDS = ["minecraft:shulker_box", "minecraft:undyed_shulker_box"];

// 仕事の実績がある人(クエスト・派遣・ライセンスの進捗がある)には出さない。履歴書を開いただけ(実績ゼロ)の人には出す。
function hasWorkHistory(player) {
  const employees = getEmployees(player);
  if (employees.some((e) => e.identity.tag === "villager" || (e.records?.length ?? 0) > 0 || Object.keys(e.licenses ?? {}).length > 0)) return true;
  return loadClaims(player).length > 0;
}

export function isFirstJobAvailable(player) {
  if (player.getDynamicProperty(FIRST_JOB_FLAG)) return false;
  return !hasWorkHistory(player);
}

// 報告 → シュルカーを1個渡して、もらい済みにする。渡せなかった時は印を付けない(もう一度できる)。
// 持ち物がいっぱいなら足元に落とす。reason: notAvailable / giveFailed
export function completeFirstJob(player) {
  if (!isFirstJobAvailable(player)) return { ok: false, reason: "notAvailable" };
  let stack = null;
  for (const id of FIRST_JOB_GIFT_IDS) {
    try {
      stack = new ItemStack(id, 1);
      break;
    } catch (e) {
      stack = null;
    }
  }
  if (!stack) return { ok: false, reason: "giveFailed" };
  try {
    const left = player.getComponent("inventory")?.container?.addItem(stack);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch (e) {
    return { ok: false, reason: "giveFailed" };
  }
  player.setDynamicProperty(FIRST_JOB_FLAG, 1);
  return { ok: true, itemId: stack.typeId };
}

// ---------- 受注者の一覧(ワールド側) ----------
function loadRegistry() {
  const raw = world.getDynamicProperty(REGISTRY_KEY);
  if (typeof raw !== "string") return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveRegistry(reg) {
  const week = weekNow();
  const today = currentGlobalDay();
  // 期限切れ(受注中のもの)と、前の日までに完了したもの(完了は「今日だれが完了したか」だけ残す)を落とす
  for (const [questId, list] of Object.entries(reg)) {
    const questDay = Number(questId.split("_")[1]);
    const kept = list.filter((e) => (e.state === "completed" ? questDay >= today : e.expiresWeek > week));
    if (kept.length === 0) delete reg[questId];
    else reg[questId] = kept;
  }
  let json = JSON.stringify(reg);
  if (json.length > REGISTRY_MAX_CHARS) {
    // 容量の安全装置: 完了の記録から先に捨てる
    for (const [questId, list] of Object.entries(reg)) {
      const kept = list.filter((e) => e.state !== "completed");
      if (kept.length === 0) delete reg[questId];
      else reg[questId] = kept;
    }
    json = JSON.stringify(reg);
  }
  world.setDynamicProperty(REGISTRY_KEY, json);
}

// その掲示を受注している人の名前の一覧(期限切れは除く)
export function getClaimedBy(questId) {
  const week = weekNow();
  const today = currentGlobalDay();
  const questDay = Number(questId.split("_")[1]);
  return (loadRegistry()[questId] ?? [])
    .filter((e) => (e.state === "completed" ? questDay >= today : e.expiresWeek > week))
    .map((e) => ({ name: e.name, state: e.state }));
}

function registrySet(questId, name, entry) {
  const reg = loadRegistry();
  const list = (reg[questId] ?? []).filter((e) => e.name !== name);
  if (entry) list.push({ name, ...entry });
  reg[questId] = list;
  saveRegistry(reg);
}

// ---------- 受注記録(プレイヤー側) ----------
function loadClaims(player) {
  const raw = player.getDynamicProperty(CLAIMS_KEY);
  if (typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveClaims(player, claims) {
  player.setDynamicProperty(CLAIMS_KEY, JSON.stringify(claims));
}

// 受注記録を返す。期限切れの受注と、前の日までの完了記録は、ここで落とす(遅延判定)。
export function getClaims(player) {
  const week = weekNow();
  const today = currentGlobalDay();
  const all = loadClaims(player);
  const kept = all.filter((c) => (c.state === "completed" ? c.day >= today : c.expiresWeek > week));
  if (kept.length !== all.length) saveClaims(player, kept);
  return kept;
}

export function getActiveClaims(player) {
  return getClaims(player).filter((c) => c.state === "claimed");
}

export function getClaim(player, questId) {
  return getClaims(player).find((c) => c.questId === questId) ?? null;
}

export function getMaxActiveQuests() {
  return getPolicyParam("quest_max_active");
}

// ---------- 受注 ----------
// reason: noQuest / noLicense / alreadyClaimed / alreadyCompleted / full / limit
export function claimQuest(player, questId) {
  const listing = getBoard().find((l) => l.id === questId);
  if (!listing) return { ok: false, reason: "noQuest" };
  if (!hasQualification(player, listing.category)) return { ok: false, reason: "noLicense" };

  const claims = getClaims(player);
  const existing = claims.find((c) => c.questId === questId);
  if (existing) return { ok: false, reason: existing.state === "completed" ? "alreadyCompleted" : "alreadyClaimed" };

  if (listing.slots !== null && getClaimedBy(questId).filter((e) => e.state === "claimed").length >= listing.slots) {
    return { ok: false, reason: "full" };
  }
  const max = getMaxActiveQuests();
  if (claims.filter((c) => c.state === "claimed").length >= max) return { ok: false, reason: "limit", max };

  const claim = {
    questId,
    category: listing.category,
    jobKey: listing.jobKey,
    title: listing.title,
    requirement: listing.requirement,
    reward: listing.reward.amount, // 受注した時点の名目額で確定
    day: currentGlobalDay(),
    expiresWeek: weekNow() + 1, // 受けた週の終わりまで
    state: "claimed"
  };
  claims.push(claim);
  saveClaims(player, claims);
  registrySet(questId, player.name, { state: "claimed", expiresWeek: claim.expiresWeek });
  return { ok: true, claim };
}

// ---------- 放棄 ----------
// 受注を外すだけ。納品済み(完了)の記録は外さない。
export function releaseQuest(player, questId) {
  const claims = getClaims(player);
  const idx = claims.findIndex((c) => c.questId === questId && c.state === "claimed");
  if (idx === -1) return { ok: false, reason: "notClaimed" };
  claims.splice(idx, 1);
  saveClaims(player, claims);
  registrySet(questId, player.name, null);
  return { ok: true };
}

// ---------- 納品 ----------
// 納品物が「書見台の近くのチェスト/樽/シェルカーボックス」にあるか確認し、消費して報酬を口座に振り込む。
// reason: notClaimed / noContainer / insufficientItems
export function deliverQuest(player, questId, lecternLocation) {
  const claims = getClaims(player);
  const claim = claims.find((c) => c.questId === questId && c.state === "claimed");
  if (!claim) return { ok: false, reason: "notClaimed" };

  const origin = lecternLocation ?? player.location;
  const containers = getNearbyContainers(player.dimension, origin);
  if (containers.length === 0) return { ok: false, reason: "noContainer" };

  const { itemId, count } = claim.requirement;
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

  const resumeBefore = getOrCreatePlayerResume(player, claim.category);
  const grossWage = Math.round(claim.reward * gradeWageMultiplier(resumeBefore.grade));
  const laborCost = scaleEInt(LABOR_COST_PER_DAY); // クエスト1件=1日分の労働とみなす
  const wage = Math.max(0, grossWage - laborCost);
  creditEmeralds(player, wage, FLOW.QUEST_WAGE, { from: HRMHRM_ORG_NAME });

  claim.state = "completed";
  saveClaims(player, claims);
  registrySet(questId, player.name, { state: "completed", expiresWeek: claim.expiresWeek });
  const resumeAfter = advancePlayerResume(player, claim.category, claim.jobKey);
  const stockOptionsGranted = grantHrmhrmStockOptionIfEligible(player);

  return { ok: true, wage, grossWage, laborCost, stockOptionsGranted, grade: resumeAfter.grade, level: resumeAfter.level };
}
