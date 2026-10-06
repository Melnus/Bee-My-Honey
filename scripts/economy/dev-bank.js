import { world, system } from "@minecraft/server";
import { scaleE } from "./price-level.js";
import { getPolicyParam } from "./policy.js";
import { COMMODITIES } from "../data/market-data.js";
import { getCommodityPrice } from "./market-engine.js";
import {
  PRECIOUS_METAL_KEYS, getEntityAccount, saveEntityAccount, getFundingRequests, getPendingFundingRequests, resolveFundingRequest
} from "./account.js";
import { getProfile, sellHolding } from "./entity-ops.js";

// ==========================================
// 開発銀行機構 / Development Bank Authority  (dev/development-bank.md)
// ------------------------------------------
// HRMHRMや法人から独立した機関。口座を持つ主体(HRMHRM・村・法人)からの資金の申請を、週ごとに審査する。
//   申請元の現物資産に「売りに出せそうなもの」がある → 申請を却下して、資産を売却させる(代金は申請元の現金へ)
//   ない                                         → 最低限の運用に必要な分を支給する(新しく発行するエメラルド)
// 判断の基準は policy.js のパラメータ(devbank_*)。将来、プレイヤーの議論で変えられるようにしてある。
//   ・売却可能とみなす資産の最低額   devbank_min_sellable_base(ベース単位E)
//   ・運用に必要な資金の週数          devbank_operating_weeks(直近の週あたり費用 × 週数)
//   ・1回の支給の上限                devbank_grant_cap_base(ベース単位E)
// 売却の順番: 貴金属以外 → 貴金属(裏打ちを最後まで残す)。売却は相場に影響する。
// 支給(新規発行)は申請元の口座に入るだけで、プレイヤーに渡るのは申請元がそれを使った時(台帳の income など)。
// そのため、インフレの入力(台帳の純増)には数えない(二重に数えないため)。支給の累計は別に記録する。
// 運用に必要な額の下限 DEVBANK_MIN_OPERATING_BASE は、費用の記録がまだ無い主体のための最低ライン。
// ==========================================

export const DEVBANK_MIN_OPERATING_BASE = 2000;
const STATE_KEY = "bmh_devbank_v1";
const DECISIONS_KEEP = 30;
const EXPENSE_WINDOW_WEEKS = 4;

function loadState() {
  const raw = world.getDynamicProperty(STATE_KEY);
  if (typeof raw === "string") {
    try {
      const s = JSON.parse(raw);
      if (s && s.v === 1) return s;
    } catch (e) {
      console.warn("[BeeMyHoney] devbank: state unreadable: " + e);
    }
  }
  return { v: 1, grantedTotal: 0, liquidatedProceedsTotal: 0, decided: 0, decisions: [] };
}

function saveState(state) {
  if (state.decisions.length > DECISIONS_KEEP) state.decisions.splice(0, state.decisions.length - DECISIONS_KEEP);
  world.setDynamicProperty(STATE_KEY, JSON.stringify(state));
}

export function getDevBankState() {
  return loadState();
}

// 直近の週あたり費用の平均(名目額)。記録が無ければ0。
export function recentWeeklyExpense(acct) {
  const recent = acct.weekly.slice(-EXPENSE_WINDOW_WEEKS);
  if (recent.length === 0) return 0;
  return recent.reduce((s, r) => s + (r.expense ?? 0), 0) / recent.length;
}

// 「最低限の運用資金」(名目額): 直近の週あたり費用 × devbank_operating_weeks。下限あり。
export function operatingTarget(acct) {
  const floor = scaleE(DEVBANK_MIN_OPERATING_BASE);
  return Math.max(floor, recentWeeklyExpense(acct) * getPolicyParam("devbank_operating_weeks"));
}

// 売却できる現物(貴金属以外 → 貴金属の順)。スリッページを引いた価格で評価する。
export function sellableAssets(acct) {
  const profile = getProfile(acct);
  const items = [];
  for (const [key, units] of Object.entries(acct.holdings)) {
    if (!COMMODITIES[key] || !(units > 0)) continue;
    const price = getCommodityPrice(key) * (1 - profile.tradeSlippage);
    items.push({ key, units, price, value: units * price, precious: PRECIOUS_METAL_KEYS.includes(key) });
  }
  items.sort((a, b) => Number(a.precious) - Number(b.precious) || b.value - a.value);
  return { items, total: items.reduce((s, i) => s + i.value, 0) };
}

// 審査(実際には何も変えない)。decision: "liquidate" | "grant" | "none"
export function evaluateApplication(acct) {
  const sellable = sellableAssets(acct);
  const minSellable = scaleE(getPolicyParam("devbank_min_sellable_base"));
  const profile = getProfile(acct);
  if (sellable.total > 0 && sellable.total >= minSellable) {
    const need = Math.max(0, scaleE(profile.targetReserveBase) - acct.cash);
    return { decision: "liquidate", sellable: sellable.total, need };
  }
  const need = Math.max(0, operatingTarget(acct) - acct.cash);
  if (need <= 0) return { decision: "none", sellable: sellable.total, need: 0, grant: 0 };
  const cap = scaleE(getPolicyParam("devbank_grant_cap_base"));
  return { decision: "grant", sellable: sellable.total, need, grant: Math.min(need, cap) };
}

// 1件の申請を処理する(口座を更新して保存し、申請の状態を決める)。
function decide(request, week, state) {
  const acct = getEntityAccount(request.entityId);
  if (!acct) {
    resolveFundingRequest(request.id, "closed", { reason: "no_account" });
    return { id: request.id, entityId: request.entityId, decision: "closed", detail: "no_account" };
  }
  const verdict = evaluateApplication(acct);
  const entry = { week, requestId: request.id, entityId: acct.id, decision: verdict.decision };

  if (verdict.decision === "liquidate") {
    const profile = getProfile(acct);
    let remaining = verdict.need;
    let proceeds = 0;
    const sold = [];
    for (const item of sellableAssets(acct).items) {
      if (remaining <= 0) break;
      const units = Math.min(item.units, Math.ceil(remaining / item.price));
      const got = sellHolding(acct, profile, item.key, units);
      if (got <= 0) continue;
      proceeds += got;
      remaining -= got;
      sold.push({ key: item.key, units, proceeds: Math.round(got) });
    }
    saveEntityAccount(acct);
    state.liquidatedProceedsTotal += proceeds;
    Object.assign(entry, { proceeds: Math.round(proceeds), sold });
    resolveFundingRequest(request.id, "rejected_liquidated", entry);
  } else if (verdict.decision === "grant") {
    acct.cash += verdict.grant;
    saveEntityAccount(acct);
    state.grantedTotal += verdict.grant;
    Object.assign(entry, { granted: Math.round(verdict.grant), need: Math.round(verdict.need) });
    resolveFundingRequest(request.id, "granted", entry);
  } else {
    resolveFundingRequest(request.id, "closed", { ...entry, reason: "no_need" });
  }
  state.decided += 1;
  state.decisions.push(entry);
  return entry;
}

// 未審査の申請を全て審査する。戻り値は決定の一覧。
export function processFundingRequests(week) {
  const pending = getPendingFundingRequests();
  if (pending.length === 0) return [];
  const state = loadState();
  const results = pending.map((r) => decide(r, week, state));
  saveState(state);
  return results;
}

const fmt = (n) => Math.round(n).toLocaleString("en-US");

export function formatDevBankReport() {
  const st = loadState();
  const lines = [
    `[開発銀行機構] 審査 ${st.decided}件 / 支給の累計 ${fmt(st.grantedTotal)}E / 売却させた資産の代金の累計 ${fmt(st.liquidatedProceedsTotal)}E`,
    `基準: 売却可能の最低額 ${getPolicyParam("devbank_min_sellable_base")}E(ベース) / 運用資金 ${getPolicyParam("devbank_operating_weeks")}週ぶん / 支給の上限 ${fmt(getPolicyParam("devbank_grant_cap_base"))}E(ベース)`
  ];
  const pending = getPendingFundingRequests();
  if (pending.length) lines.push(`審査待ち: ${pending.map((r) => r.entityId + " " + fmt(r.amount) + "E").join(", ")}`);
  for (const d of st.decisions.slice(-5)) {
    const detail = d.decision === "grant" ? `支給 ${fmt(d.granted)}E` : d.decision === "liquidate" ? `却下→売却 ${fmt(d.proceeds ?? 0)}E` : `支給なし(${d.reason ?? "no_need"})`;
    lines.push(`w${d.week} 申請#${d.requestId} ${d.entityId}: ${detail}`);
  }
  return lines.join("\n");
}

export function startDevBankScriptEvent() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:devbank") return;
    const text = formatDevBankReport();
    const target = ev.sourceEntity;
    if (target && typeof target.sendMessage === "function") target.sendMessage(text);
    else console.warn("[BeeMyHoney] " + text);
  });
}
