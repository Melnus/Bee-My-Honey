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
export const TUTORIAL_STEPS = [
  { id: "first_job", kind: "first_job", title: FIRST_JOB_TITLE, bodyKey: "laborFirstJobBody", reward: "shulker" },
  { id: "board", kind: "report", title: { ja: "掲示板のしくみ", en: "How the Board Works" }, bodyKey: "tutorialBoardBody" },
  { id: "first_delivery", kind: "check", title: { ja: "初めての納品", en: "Your First Delivery" }, bodyKey: "tutorialDeliveryBody", check: hasDeliveredQuest },
  { id: "license_dispatch", kind: "report", title: { ja: "資格と派遣のしくみ", en: "Licenses and Dispatch" }, bodyKey: "tutorialLicenseBody" }
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
  const next = before + 1;
  player.setDynamicProperty(PROGRESS_KEY, next);
  return { ok: true, step, finished: next >= TUTORIAL_STEPS.length };
}
