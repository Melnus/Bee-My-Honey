import { world } from "@minecraft/server";
import { getWeekSummary, getCurrentWeek } from "./ledger.js";
import { getPriceIndex, setPriceIndex, getPriceLevel } from "./price-level.js";

// ==========================================
// インフレ指数の自動更新 (dev/sketch/sketch-inflation-economy.md)
// ------------------------------------------
// 週が終わるたびに、その週の「発行量ベースの活動量」から価格のインフレ指数(price-level.js)を少し上げる。
//   活動量  … 台帳の income + credit の純増(エメラルド)を、アクティブなプレイヤー1人あたり・ベース単位に直したもの
//   圧力    = 1人あたり純増(ベース) ÷ INFLATION_REFERENCE_WEEKLY_INCOME (週の標準的な収入の目安)
//   週の上昇率 = INFLATION_WEEKLY_CAP × tanh(圧力)   … 上限で頭打ち。圧力が大きくても上限を超えない
//   下方硬直: 純増が負でも指数は下げない(0止まり)。プレイヤー不在の週は凍結(上昇率0)。
// 上限は「4週で約0.2%」(= 1週0.05%)。ワールドの1週間は7日なので、現実の時間で約2時間20分。
// 欠けた週(誰もログインしていない・日付が飛んだ)は、台帳に記録が無ければ上昇率0として順に処理する(追いつき方式)。
// 処理済みの週は INFLATION_WEEK_KEY に覚えるので、何度呼んでも二重に上がらない。
// ==========================================

export const INFLATION_WEEKLY_CAP = 0.0005; // 0.05% / 週
export const INFLATION_REFERENCE_WEEKLY_INCOME = 70; // 1人あたり週の標準的な収入(ベース単位E)。手間賃10E × 約7日
const INFLATION_WEEK_KEY = "bmh_inflation_week"; // 最後に処理した「終わった週」
const INFLATION_LAST_RATE_KEY = "bmh_inflation_last_rate";
const MAX_CATCH_UP_WEEKS = 520; // 異常な日付ジャンプで長いループにならないように(約10年分)

// 純粋関数: 1週ぶんの上昇率。
export function weeklyGrowthRate(netIssuanceBase, activePlayers) {
  if (!(activePlayers > 0)) return 0;
  const pressure = netIssuanceBase / activePlayers / INFLATION_REFERENCE_WEEKLY_INCOME;
  return Math.max(0, INFLATION_WEEKLY_CAP * Math.tanh(pressure));
}

// 終わった週(今週より前)を、未処理のぶんだけ順に反映する。戻り値は反映した週数。
export function updatePriceIndex() {
  const current = getCurrentWeek();
  const lastDone = world.getDynamicProperty(INFLATION_WEEK_KEY);
  if (typeof lastDone !== "number") {
    // 初回は今週の手前を処理済みにして、ここから数え始める(過去の分は遡らない)
    world.setDynamicProperty(INFLATION_WEEK_KEY, current - 1);
    return 0;
  }
  let from = lastDone + 1;
  const to = current - 1;
  if (to < from) return 0;
  if (to - from + 1 > MAX_CATCH_UP_WEEKS) from = to - MAX_CATCH_UP_WEEKS + 1;

  let index = getPriceIndex();
  let lastRate = 0;
  for (let w = from; w <= to; w++) {
    const { netIssuance, activePlayers } = getWeekSummary(w);
    // 台帳はエメラルドの実額で持っているので、その時点の水準でベース単位に戻す
    const netBase = netIssuance / getPriceLevel();
    lastRate = weeklyGrowthRate(netBase, activePlayers);
    index *= 1 + lastRate;
  }
  setPriceIndex(index);
  world.setDynamicProperty(INFLATION_WEEK_KEY, to);
  world.setDynamicProperty(INFLATION_LAST_RATE_KEY, lastRate);
  return to - from + 1;
}

export function getLastInflationRate() {
  const v = world.getDynamicProperty(INFLATION_LAST_RATE_KEY);
  return typeof v === "number" ? v : 0;
}


