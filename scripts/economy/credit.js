// ==========================================
// 信用情報スコア制度 / Credit Score System
// ローン・クレジットカード(郵便販売)・保険・破産整理が共通で参照する
// 単一の信用情報モジュール。動的プロパティで各プレイヤーごとに保持する。
// ==========================================

// 内部スコアは300〜850の実在の信用スコアに近いレンジで管理し、
// 画面表示の「信用状態」ラベルはこのスコアから毎回自動算出する
// （生データの真偽値だけで判定を分岐させると粗くなるため）。
export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;
export const CREDIT_SCORE_DEFAULT = 600; // 新規プレイヤーの初期値（「普通」帯）

// スコア→表示ラベルの閾値。降順で先にマッチしたものを採用する。
const STATUS_THRESHOLDS = [
  { min: 750, label: { ja: "優良", en: "Excellent" } },
  { min: 650, label: { ja: "良好", en: "Good" } },
  { min: 550, label: { ja: "普通", en: "Fair" } },
  { min: 450, label: { ja: "要注意", en: "Caution" } },
  { min: CREDIT_SCORE_MIN, label: { ja: "不良", en: "Poor" } }
];

// スコア増減の理由ごとの重み。将来イベントを増やす場合はここに追記するだけでよい。
// 正の値=加点、負の値=減点。
export const CREDIT_EVENTS = {
  loanPaidOff: 15,       // ローン完済1件
  cardPaymentOnTime: 5,  // カード正常支払1回
  insurancePaidOnTime: 3,// 保険料正常支払1回
  overdue: -20,          // 延滞1回発生
  longOverdue: -50,      // 延滞が一定期間継続し長期延滞に移行
  default: -100,         // 債務不履行（デフォルト）
  debtRestructured: -60, // 返済計画の組み直し
  debtSettled: -120,     // 債務整理（残債減額）
  cardSuspended: -60     // カード利用停止
};

function clampScore(score) {
  return Math.max(CREDIT_SCORE_MIN, Math.min(CREDIT_SCORE_MAX, score));
}

export function getCreditScore(player) {
  return player.getDynamicProperty("cr_score") ?? CREDIT_SCORE_DEFAULT;
}

// reason は CREDIT_EVENTS のキー、または任意の増減幅を直接渡すことも可能。
export function adjustCredit(player, reasonOrDelta) {
  const delta = typeof reasonOrDelta === "string" ? (CREDIT_EVENTS[reasonOrDelta] ?? 0) : reasonOrDelta;
  const next = clampScore(getCreditScore(player) + delta);
  player.setDynamicProperty("cr_score", next);
  return next;
}

export function getCreditStatusLabel(player, lang = "ja") {
  const score = getCreditScore(player);
  const tier = STATUS_THRESHOLDS.find((t) => score >= t.min);
  return tier.label[lang] ?? tier.label.ja;
}

// ==========================================
// テンプレートの表示4区分＋信用状態にそのまま対応する生データ
// 【借入】【クレジットカード】【支払状況】【保険】【過去の記録】
// ==========================================
export function getCreditInfo(player) {
  return {
    score: getCreditScore(player),

    // 【借入】
    loanBalance: player.getDynamicProperty("cr_loan_balance") ?? 0,
    loanCount: player.getDynamicProperty("cr_loan_count") ?? 0,
    loanOverdue: player.getDynamicProperty("cr_loan_overdue") ?? false,

    // 【クレジットカード】
    cardLimit: player.getDynamicProperty("cr_card_limit") ?? 0,
    cardBalance: player.getDynamicProperty("cr_card_balance") ?? 0,
    // リボ払いの固定最低返済額。契約時（限度額付与時）に決め、残高が増えても据え置く。
    // これにより「最低額だけ払うと元金が減らない」という実際のリボ地獄を再現する。
    cardMinPayment: player.getDynamicProperty("cr_card_min_payment") ?? 0,
    cardOverdue: player.getDynamicProperty("cr_card_overdue") ?? false,

    // 【支払状況】
    loanPaidCount: player.getDynamicProperty("cr_loan_paid_count") ?? 0,
    cardPaymentCount: player.getDynamicProperty("cr_card_payment_count") ?? 0,
    overdueCount: player.getDynamicProperty("cr_overdue_count") ?? 0,
    longOverdue: player.getDynamicProperty("cr_long_overdue") ?? false,
    isDefault: player.getDynamicProperty("cr_default") ?? false,

    // 【保険】
    insuranceType: player.getDynamicProperty("cr_insurance_type") ?? null, // null=未加入
    insurancePaymentOk: player.getDynamicProperty("cr_insurance_payment_ok") ?? true,

    // 【過去の記録】
    // debtRestructured=返済計画の組み直し経験、debtSettled=債務整理(残債減額)経験。テンプレートの「債務整理」欄はこちら。
    debtRestructured: player.getDynamicProperty("cr_debt_restructured") ?? false,
    debtSettled: player.getDynamicProperty("cr_debt_settled") ?? false,
    cardSuspended: player.getDynamicProperty("cr_card_suspended") ?? false
  };
}

// 延滞発生時にまとめて呼ぶヘルパー。延滞回数を積み上げつつ、
// 一定回数(既定3回)連続で解消されないと自動的に長期延滞へ昇格させる。
export function recordOverdue(player, longOverdueThreshold = 3) {
  const count = (player.getDynamicProperty("cr_overdue_count") ?? 0) + 1;
  player.setDynamicProperty("cr_overdue_count", count);
  player.setDynamicProperty("cr_loan_overdue", true);
  adjustCredit(player, "overdue");

  if (count >= longOverdueThreshold && !player.getDynamicProperty("cr_long_overdue")) {
    player.setDynamicProperty("cr_long_overdue", true);
    adjustCredit(player, "longOverdue");
  }
}

// 延滞が解消された（完済 or 正常返済に復帰した）ときに呼ぶ。スコアは戻さないが、
// 「延滞中」フラグのみクリアする（履歴としての延滞回数は残す設計）。
export function clearOverdue(player) {
  player.setDynamicProperty("cr_loan_overdue", false);
}
