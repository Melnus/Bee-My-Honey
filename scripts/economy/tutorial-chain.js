import * as mc from "@minecraft/server";
import { getBinding } from "./private-shulker.js";
import { companyOf } from "./core-registry.js";
import { completeFirstJob, hasWorkHistory, hasDeliveredQuest, FIRST_JOB_TITLE } from "./quest-board.js";

// ==========================================
// 導入クエスト(クエストチェーン) / Tutorial Quest Chain
// ------------------------------------------
// スタッフサービスの一段目。順番に1つずつ進める導入・チュートリアルで、終わると欄ごと消える。
//   1. 初めてのアルバイト … 説明を読んで報告 → シュルカーボックス1個(quest-board.js の completeFirstJob)
//   2. 掲示板のしくみ     … 説明を読んで報告
//   3. 初めての納品       … 実際に1件納品すると報告できる(履歴書の実績で判定)
//   4. 資格と派遣のしくみ … 説明を読んで報告
// 進み具合は、プレイヤーの動的プロパティ labor_tutorial_done(完了したステップ数)。
// 以前の版で「初めてのアルバイト」だけ終えている人は、1つ済みとして数える。
// 仕事の実績がある人(クエスト・派遣・ライセンス)は、まだ1つも進めていなければ導入クエストを出さない。
// ステップの追加・並べ替えは、この表を編集するだけ(文言は strings.js の tutorial* と laborFirstJobBody)。
// ==========================================
// 取引所の操作の印(economy/exchange.js が付ける)。出品に成功した / 入荷を受け取った。
export const FLAG_LISTED = "tut_ex_listed";
export const FLAG_RECEIVED = "tut_ex_received";

// rewards: ステップを完了(報告)したときに渡すアイテム。エメラルド以外の、使えるもの(ラピスラズリ=エンチャント、経験値の瓶、鉄・金・ダイヤ)。
//   全体の金額への影響が小さいように、少なめにしている。変えるときは、この表の数字だけを編集する。
// 段階: ①スタッフサービス(導入の4つ) ②取引所(専用シュルカー → 出品 → 受け取り) ③会社へ(説明 → 会社を建てる)。会社を建てると導入は終わり。
export const TUTORIAL_STEPS = [
  // ① スタッフサービス
  { id: "first_job", kind: "first_job", title: FIRST_JOB_TITLE, bodyKey: "laborFirstJobBody", reward: "shulker" },
  { id: "board", kind: "report", title: { ja: "掲示板のしくみ", en: "How the Board Works" }, bodyKey: "tutorialBoardBody",
    rewards: [{ id: "minecraft:lapis_lazuli", n: 8 }] },
  { id: "first_delivery", kind: "check", title: { ja: "初めての納品", en: "Your First Delivery" }, bodyKey: "tutorialDeliveryBody", check: hasDeliveredQuest,
    rewards: [{ id: "minecraft:lapis_lazuli", n: 16 }] },
  { id: "license_dispatch", kind: "report", title: { ja: "資格と派遣のしくみ", en: "Licenses and Dispatch" }, bodyKey: "tutorialLicenseBody",
    rewards: [{ id: "minecraft:experience_bottle", n: 8 }] },
  // ② 取引所
  { id: "ex_shulker", kind: "check", title: { ja: "専用シュルカーを登録する", en: "Register a Private Shulker" }, bodyKey: "tutorialExShulkerBody",
    check: (p) => !!getBinding(p.id), rewards: [{ id: "minecraft:lapis_lazuli", n: 8 }] },
  { id: "ex_list", kind: "check", title: { ja: "取引所に出品する", en: "List on the Exchange" }, bodyKey: "tutorialExListBody",
    check: (p) => !!p.getDynamicProperty(FLAG_LISTED), rewards: [{ id: "minecraft:iron_ingot", n: 16 }] },
  { id: "ex_receive", kind: "check", title: { ja: "取引所で買って受け取る", en: "Buy and Receive" }, bodyKey: "tutorialExReceiveBody",
    check: (p) => !!p.getDynamicProperty(FLAG_RECEIVED), rewards: [{ id: "minecraft:experience_bottle", n: 8 }] },
  // ③ 会社へ
  { id: "company_guide", kind: "report", title: { ja: "村と会社のしくみ", en: "Villages and Companies" }, bodyKey: "tutorialCompanyGuideBody",
    rewards: [{ id: "minecraft:gold_ingot", n: 8 }] },
  { id: "company_found", kind: "check", title: { ja: "会社を建てる", en: "Found a Company" }, bodyKey: "tutorialCompanyFoundBody",
    check: (p) => !!companyOf(p.id), rewards: [{ id: "minecraft:diamond", n: 4 }, { id: "minecraft:lapis_lazuli", n: 32 }] }
];

const PROGRESS_KEY = "labor_tutorial_done";
const FIRST_JOB_FLAG = "labor_first_job_done";

export function getTutorialProgress(player) {
  const stored = player.getDynamicProperty(PROGRESS_KEY) ?? 0;
  const legacy = player.getDynamicProperty(FIRST_JOB_FLAG) ? 1 : 0;
  return Math.min(TUTORIAL_STEPS.length, Math.max(stored, legacy));
}

export function isTutorialActive(player) {
  const done = getTutorialProgress(player);
  if (done >= TUTORIAL_STEPS.length) return false;
  if (done === 0 && hasWorkHistory(player)) return false; // 実績のある人には出さない
  return true;
}

export function getCurrentTutorialStep(player) {
  return isTutorialActive(player) ? TUTORIAL_STEPS[getTutorialProgress(player)] : null;
}

// 現在のステップを報告する。reason: notActive / giveFailed / notYet
// 戻り値: { ok, step, finished }
export function completeTutorialStep(player) {
  const step = getCurrentTutorialStep(player);
  if (!step) return { ok: false, reason: "notActive" };
  const before = getTutorialProgress(player); // 初回の仕事の印が付く前の値(印だけでも1つ済みに数えるため、先に取る)
  if (step.kind === "first_job") {
    const r = completeFirstJob(player);
    if (!r.ok) return { ok: false, reason: r.reason === "giveFailed" ? "giveFailed" : "notActive" };
  } else if (step.kind === "check" && !step.check(player)) {
    return { ok: false, reason: "notYet", step };
  }
  const given = giveRewards(player, step.rewards);
  const next = before + 1;
  player.setDynamicProperty(PROGRESS_KEY, next);
  return { ok: true, step, finished: next >= TUTORIAL_STEPS.length, given };
}

// 報酬を渡す。持ち物がいっぱいなら足元に落とす。作れないアイテムは飛ばす(ステップは進める)。戻り値: 渡した [{id,n}]
export function giveRewards(player, rewards) {
  const given = [];
  for (const r of rewards ?? []) {
    try {
      let left = r.n;
      while (left > 0) {
        const stack = new mc.ItemStack(r.id, Math.min(left, 64));
        left -= stack.amount;
        const rest = player.getComponent("inventory")?.container?.addItem(stack);
        if (rest) player.dimension.spawnItem(rest, player.location);
      }
      given.push({ id: r.id, n: r.n });
    } catch (e) { console.warn("[BeeMyHoney] tutorial reward: " + e); }
  }
  return given;
}
