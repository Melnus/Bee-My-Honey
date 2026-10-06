import { scaleE } from "./price-level.js";
import { applyTrade, getCommodityPrice } from "./market-engine.js";
import { COMMODITIES } from "../data/market-data.js";
import { PRECIOUS_METAL_KEYS, getBalanceSheet, applyForFunding, getPendingFundingRequests } from "./account.js";

// ==========================================
// 口座を持つ主体の共通の運用 / Generic Entity Operations  (dev/development-bank.md)
// ------------------------------------------
// HRMHRM・村・法人は、どれも同じ口座テンプレート(account.js)と、ここにある共通の運用の上に立つ。
// HRMHRM専用なのは「台帳から週の収益・費用を作る部分」と初期の資本金だけ(hrmhrm.js)。法人は、この運用を
// そのまま使って派生する(運用の基準は MANAGEMENT_PROFILES に種類ごとに持つ)。
//
// 週ごとの運用(runManagement):
//   現金が下限(minReserve)を下回る → 自分で資産を売らず、開発銀行機構(dev-bank.js)に資金を申請する。
//        審査の結果、売れる資産があれば却下されて売却、なければ最低限の運用資金が支給される
//   現金が上限(investAbove)を超える(invest:true の主体のみ) → 目標を超えた分の一部で貴金属を買う
// 売買は相場に影響する(需要圧力。marketImpactFactor 倍)。数値は全て暫定(ベース単位E。実際の金額は×掛率)。
// ==========================================

export const MANAGEMENT_PROFILES = {
  hrmhrm: {
    minReserveBase: 20000, targetReserveBase: 40000, investAboveBase: 80000, invest: true,
    maxTradeFractionPerWeek: 0.05, tradeSlippage: 0.03, marketImpactFactor: 0.25
  },
  // 村・法人はまだ口座を作る仕組みが無いので、以下は仮の基準(法人テンプレートの実装時に見直す)
  company: {
    minReserveBase: 2000, targetReserveBase: 5000, investAboveBase: 20000, invest: false,
    maxTradeFractionPerWeek: 0.05, tradeSlippage: 0.03, marketImpactFactor: 0.25
  },
  village: {
    minReserveBase: 500, targetReserveBase: 1000, investAboveBase: 5000, invest: false,
    maxTradeFractionPerWeek: 0.05, tradeSlippage: 0.03, marketImpactFactor: 0.25
  }
};

export function getProfile(acct) {
  return MANAGEMENT_PROFILES[acct.type] ?? MANAGEMENT_PROFILES.company;
}

export function emptyWeekRecord(week) {
  return { week, revenue: 0, expense: 0, net: 0, cashDelta: 0, actions: [] };
}

// 売買を相場(需要圧力)に反映する。direction: 買い=+1 / 売り=−1
export function tradeMarket(profile, key, units, direction) {
  applyTrade("commodity", key, direction * units * profile.marketImpactFactor, COMMODITIES[key].volatility);
}

// 保有する現物を units 個売る(時価からスリッページを引いた価格)。売った代金を返す。
export function sellHolding(acct, profile, key, units) {
  const have = acct.holdings[key] ?? 0;
  const n = Math.min(have, Math.floor(units));
  if (n <= 0) return 0;
  const price = getCommodityPrice(key) * (1 - profile.tradeSlippage);
  const proceeds = n * price;
  acct.holdings[key] = have - n;
  acct.cash += proceeds;
  tradeMarket(profile, key, n, -1);
  return proceeds;
}

export function buyHolding(acct, profile, key, units) {
  const n = Math.floor(units);
  if (n <= 0) return 0;
  const price = getCommodityPrice(key) * (1 + profile.tradeSlippage);
  const cost = n * price;
  acct.holdings[key] = (acct.holdings[key] ?? 0) + n;
  acct.cash -= cost;
  tradeMarket(profile, key, n, 1);
  return cost;
}

// 週ごとの運用。acct と record を更新する(保存は呼び出し側)。
export function runManagement(acct, record) {
  const P = getProfile(acct);
  const minReserve = scaleE(P.minReserveBase);
  const target = scaleE(P.targetReserveBase);
  const investAbove = scaleE(P.investAboveBase);

  if (acct.cash < minReserve) {
    if (getPendingFundingRequests().some((r) => r.entityId === acct.id)) return; // 審査待ちの申請がある
    const amount = target - acct.cash;
    if (applyForFunding(acct.id, amount, "reserve_shortfall")) record.actions.push({ type: "apply", amount: Math.round(amount) });
    return;
  }

  if (P.invest && acct.cash > investAbove) {
    // 運用: 目標を超えた分のうち、1週の売買枠の範囲で貴金属を均等に買う
    const surplus = acct.cash - target;
    const budget = Math.min(surplus, Math.max(getBalanceSheet(acct).preciousValue * P.maxTradeFractionPerWeek, minReserve * 0.1));
    const per = budget / PRECIOUS_METAL_KEYS.length;
    for (const key of PRECIOUS_METAL_KEYS) {
      const price = getCommodityPrice(key) * (1 + P.tradeSlippage);
      const units = Math.floor(per / price);
      if (units <= 0) continue;
      const cost = buyHolding(acct, P, key, units);
      record.actions.push({ type: "buy", key, units, cost: Math.round(cost) });
    }
  }
}

// 週の締めの仕上げ。期末の現金・純資産・貴金属の時価を記録に入れて、口座に積む。
export function finalizeWeek(acct, record) {
  const sheet = getBalanceSheet(acct);
  record.cashEnd = Math.round(acct.cash);
  record.equityEnd = Math.round(sheet.equity);
  record.preciousValue = Math.round(sheet.preciousValue);
  acct.weekly.push(record);
  acct.processedWeek = record.week;
}
