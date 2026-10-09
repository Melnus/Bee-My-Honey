// ==========================================
// 金利 / Interest Rates  (dev/sketch/sketch-inflation-economy.md)
// ------------------------------------------
// 全ての金利を「政策金利」+「上乗せ(スプレッド)」で持つ。インフレの水準(週0.05%上限。inflation.js)に合わせ、
// 政策金利は週0.06%(年約3.2%。インフレ率の上限よりわずかに高い=実質金利がほぼ0)。
//   預金       = 政策金利                              週0.06%(年約3.2%)
//   ローン(借入)= 政策金利 + 0.04% + 難易度×0.02%       週0.12〜0.20%(年約6〜10%)。スコアが高いと最大0.04%引き
//   カード(リボ)= 政策金利 + 0.24%                      週0.30%(年約15.6%。現実のリボ年利15%前後)
//   現金配当   = (政策金利 + 0.04%) ÷ 7                  1日あたり約0.0143%(週0.10%、年約5.2%)
//   融資(貸し手)= 政策金利 + 0.04% + 貸し倒れの見込み分   貸し倒れを織り込んで期待収益がやや正になる水準
// 将来、政策金利を「決める人」(プレイヤー)が変えられるようにする時は、getPolicyRate() だけを差し替える。
// 値は economy/policy.js のパラメータ(既定値 = 下の定数)から取る。管理コマンド /scriptevent bmh:policy や、将来の
// プレイヤーの議論による変更が、ここを通して全ての金利に反映される。
// ==========================================
import { getPolicyParam } from "./policy.js";

export const POLICY_RATE_WEEKLY = 0.0006;
// 既定値(policy.js の POLICY_PARAMS と同じ。変更できるのは policy.js 側)
export const CARD_SPREAD = 0.0024;
export const LOAN_BASE_SPREAD = 0.0004;
export const LOAN_SPREAD_PER_DIFFICULTY = 0.0002;
export const LOAN_SCORE_DISCOUNT_PER_100 = 0.0002; // スコア600を超えた100点ごと
export const LOAN_MIN_SPREAD = 0.0002; // 割引を受けても、政策金利にこの上乗せは残す
export const LENDER_MARGIN_SPREAD = 0.0004;
export const DIVIDEND_SPREAD = 0.0004;
export const LENDING_DEFAULT_RECOVERY = 0.3; // 貸し倒れ時に回収できる元本の割合(loan.js と同じ)

export const getPolicyRate = () => getPolicyParam("policy_rate");
export const getDepositRate = () => getPolicyRate();
export const getCardRate = () => getPolicyRate() + getPolicyParam("card_spread");

// 現金配当の「1日あたり」の率(1日1回受け取れる)。週利(政策金利+上乗せ)を7日で割る。
export const getDividendRateDaily = () => (getPolicyRate() + getPolicyParam("dividend_spread")) / 7;

export function getLoanRate(difficulty, score) {
  const spread = getPolicyParam("loan_base_spread") + difficulty * getPolicyParam("loan_spread_per_difficulty");
  const discount = Math.max(0, (score - 600) / 100) * LOAN_SCORE_DISCOUNT_PER_100;
  return getPolicyRate() + Math.max(LOAN_MIN_SPREAD, spread - discount);
}

// 借り手の返済確率(信用スコア350〜800 → 0.80〜0.99)。貸し手の金利は、この貸し倒れ分を織り込む。
export function getRepayProbability(score) {
  return Math.min(0.99, Math.max(0.8, 0.8 + ((score - 350) / 450) * 0.19));
}

// 貸し手が受け取る週利。期待収益 = P×(1+週利×週数) + (1−P)×回収率 が、政策金利+上乗せ分だけ元本を上回る水準。
export function getLenderRate(repayProbability, weeks) {
  const lossPremiumTotal = ((1 - LENDING_DEFAULT_RECOVERY) * (1 - repayProbability)) / repayProbability;
  return getPolicyRate() + getPolicyParam("lender_margin_spread") + lossPremiumTotal / weeks;
}


