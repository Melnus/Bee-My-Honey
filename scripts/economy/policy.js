import { world, system } from "@minecraft/server";

// ==========================================
// 金融政策の仕組み / Monetary Policy Parameters  (dev/sketch/sketch-inflation-economy.md)
// ------------------------------------------
// 金利と開発銀行機構(dev-bank.js)の判断基準を「名前つきの設定値」として1か所で持ち、安全に変更できる入口を用意する。
// 将来のアプデで「プレイヤー同士の議論(投票など)でパラメータを変える」機能を入れる時は、その機能が
// setPolicyParam(key, value, { source: "vote:..." }) を呼ぶだけで済むようにしてある(この仕組みは決める人を知らない)。
// 今の変更手段は管理コマンドだけ: /scriptevent bmh:policy list | get <key> | set <key> <値> [force] | reset <key|all> | history [件数]
//
// 変更のルール(validatePolicyChange):
//   ・範囲(min〜max)  … 常に守る(force でも破れない)
//   ・1回の変更幅(maxStep) と 変更間隔(cooldownWeeks) … 通常は守る。force(管理者の緊急用)だけ破れる
//   ・パラメータ間の制約(constraints) … 常に守る。例: カード金利は、最も高いローン金利以上でなければならない
// 変更は履歴(直近50件)に残り、購読(subscribePolicyChange)で通知される(ニュース告知などに使える)。
// 値はワールドの動的プロパティ(bmh_policy_v1)に保存。インフレ指数の上限など「設計上の安全装置」は対象外。
// ==========================================

const POLICY_KEY = "bmh_policy_v1";
const HISTORY_MAX = 50;

// unit: "rate" = 週あたりの金利(小数。0.0006 = 0.06%) / "weeks" = 週数 / "base" = ベース単位のE(実際の金額は×掛率)
//        "count" = 件数・個数 / "days" = 日数 / "ratio" = 倍率
export const POLICY_PARAMS = {
  policy_rate: {
    unit: "rate",
    default: 0.0006, min: 0, max: 0.01, maxStep: 0.0003, cooldownWeeks: 1,
    label: { ja: "政策金利(週)", en: "Policy rate (weekly)" },
    desc: { ja: "預金金利の基準。ローン・カード・配当の金利もこれに連動する", en: "Base for deposit rate; loans, cards and dividends follow it" }
  },
  card_spread: {
    unit: "rate",
    default: 0.0024, min: 0, max: 0.02, maxStep: 0.0012, cooldownWeeks: 1,
    label: { ja: "カード金利の上乗せ(週)", en: "Card spread (weekly)" },
    desc: { ja: "カード(リボ)の金利 = 政策金利 + この上乗せ", en: "Card revolving rate = policy rate + this spread" }
  },
  loan_base_spread: {
    unit: "rate",
    default: 0.0004, min: 0, max: 0.01, maxStep: 0.0004, cooldownWeeks: 1,
    label: { ja: "ローン金利の基本上乗せ(週)", en: "Loan base spread (weekly)" },
    desc: { ja: "ローン(借入)の金利 = 政策金利 + 基本上乗せ + 難易度ごとの上乗せ − スコア割引", en: "Loan rate = policy + base spread + per-difficulty spread - score discount" }
  },
  loan_spread_per_difficulty: {
    unit: "rate",
    default: 0.0002, min: 0, max: 0.005, maxStep: 0.0002, cooldownWeeks: 1,
    label: { ja: "ローン金利の難易度ごとの上乗せ(週)", en: "Loan spread per difficulty (weekly)" },
    desc: { ja: "難易度1〜5(高額ほど高い)に掛かる上乗せ", en: "Added per difficulty level (1-5)" }
  },
  lender_margin_spread: {
    unit: "rate",
    default: 0.0004, min: 0, max: 0.01, maxStep: 0.0004, cooldownWeeks: 1,
    label: { ja: "融資(貸し手)の利幅(週)", en: "Lender margin (weekly)" },
    desc: { ja: "貸し倒れの見込みを織り込んだ上での貸し手の上乗せ", en: "Lender margin on top of default-risk pricing" }
  },
  dividend_spread: {
    unit: "rate",
    default: 0.0004, min: 0, max: 0.01, maxStep: 0.0004, cooldownWeeks: 1,
    label: { ja: "現金配当の上乗せ(週)", en: "Cash dividend spread (weekly)" },
    desc: { ja: "現金配当の週利 = 政策金利 + この上乗せ(日割りで1日1回受け取れる)", en: "Weekly dividend rate = policy rate + this spread (paid per daily claim)" }
  },
  // ---- 開発銀行機構(dev-bank.js)の判断基準 ----
  devbank_operating_weeks: {
    unit: "weeks", default: 4, min: 1, max: 26, maxStep: 2, cooldownWeeks: 1,
    label: { ja: "開発銀行: 運用に必要な資金の週数", en: "Development bank: operating funds (weeks)" },
    desc: { ja: "支給する「最低限の運用資金」= 直近の週あたり費用 × この週数", en: "Minimum operating funds granted = recent weekly expenses x this many weeks" }
  },
  devbank_grant_cap_base: {
    unit: "base", default: 200000, min: 0, max: 5000000, maxStep: 100000, cooldownWeeks: 1,
    label: { ja: "開発銀行: 1回の支給の上限(ベース単位E)", en: "Development bank: grant cap per decision (base E)" },
    desc: { ja: "支給額の上限。実際の金額は掛率を掛ける", en: "Upper limit of one grant; multiplied by the price level" }
  },
  devbank_min_sellable_base: {
    unit: "base", default: 500, min: 0, max: 100000, maxStep: 500, cooldownWeeks: 1,
    label: { ja: "開発銀行: 売却可能とみなす資産の最低額(ベース単位E)", en: "Development bank: minimum sellable assets (base E)" },
    desc: { ja: "申請元の現物資産の時価がこれ以上なら、申請を却下して資産を売却させる", en: "If the applicant's holdings are worth at least this, the application is rejected and assets are sold" }
  },
  // ---- 労働市場(クエスト・派遣) ----
  quest_max_active: {
    unit: "count", default: 2, min: 1, max: 10, maxStep: 1, cooldownWeeks: 1,
    label: { ja: "クエスト: 同時に受けられる件数", en: "Quests: max active per player" },
    desc: { ja: "1人が同時に受注できるクエストの数", en: "How many quests one player can have claimed at once" }
  },
  dispatch_output_ratio: {
    unit: "ratio", default: 1, min: 0.05, max: 5, maxStep: 0.25, cooldownWeeks: 1,
    label: { ja: "派遣: 産出係数", en: "Dispatch: output ratio" },
    desc: { ja: "施設の産出の価値 = 派遣の賃金 × 日数 × この係数(1で賃金と同額)", en: "Facility output value = dispatch wage x days x this ratio (1 = same as the wage)" }
  },
  resume_tenure_days: {
    unit: "days", default: 1095, min: 365, max: 3650, maxStep: 365, cooldownWeeks: 1,
    label: { ja: "派遣: 除名までの通算派遣日数", en: "Dispatch: tenure limit (days)" },
    desc: { ja: "村人の履歴書の通算派遣日数がこれに達すると除名(3年 = 1095日)", en: "A villager's resume is retired once its total dispatched days reach this (3 years = 1095 days)" }
  },
  pool_keep_per_item: {
    unit: "count", default: 640, min: 0, max: 100000, maxStep: 320, cooldownWeeks: 1,
    label: { ja: "プール: 品目ごとの保持数", en: "Pool: keep per item" },
    desc: { ja: "週の締めで、この数を超えた分だけを換金する", en: "At the weekly close, only the amount above this is converted to cash" }
  },
  pool_sale_ratio: {
    unit: "ratio", default: 1, min: 0.1, max: 1.5, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "プール: 換金の掛け率", en: "Pool: sale ratio" },
    desc: { ja: "換金額 = その時の売値(基準価格 × 掛率) × この掛け率", en: "Cash = current selling price (base price x price level) x this ratio" }
  }
};

// パラメータ間の制約。candidate は「変更後の全パラメータ値」。違反なら理由の文字列を返す。
const CONSTRAINTS = [
  {
    id: "card_covers_loans",
    check: (v) => v.card_spread >= v.loan_base_spread + 5 * v.loan_spread_per_difficulty - 1e-12,
    message: { ja: "カードの上乗せは、最も高いローンの上乗せ(基本+難易度5段階分)以上にしてください。", en: "Card spread must be at least the highest loan spread." }
  }
];

function weekNow() {
  return Math.floor(world.getDay() / 7);
}

function emptyState() {
  return { v: 1, values: {}, lastChangeWeek: {}, history: [] };
}

function loadState() {
  const raw = world.getDynamicProperty(POLICY_KEY);
  if (typeof raw !== "string") return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1) return { ...emptyState(), ...parsed };
  } catch (e) {
    console.warn("[BeeMyHoney] policy: corrupted, using defaults: " + e);
  }
  return emptyState();
}

function saveState(state) {
  world.setDynamicProperty(POLICY_KEY, JSON.stringify(state));
}

export function getPolicyParam(key) {
  const def = POLICY_PARAMS[key];
  if (!def) throw new Error("policy: unknown parameter " + key);
  const v = loadState().values[key];
  // 保存値が壊れていたり範囲外なら、既定値に戻して使う(安全側)
  return typeof v === "number" && v >= def.min && v <= def.max ? v : def.default;
}

export function getPolicySnapshot() {
  const state = loadState();
  const out = {};
  for (const [key, def] of Object.entries(POLICY_PARAMS)) {
    const v = state.values[key];
    out[key] = typeof v === "number" && v >= def.min && v <= def.max ? v : def.default;
  }
  return out;
}

// 変更が通るかを調べる(実際には変更しない)。reason: unknown_key / not_a_number / out_of_range / step_too_large / cooldown / constraint
export function validatePolicyChange(key, value, { force = false } = {}) {
  const def = POLICY_PARAMS[key];
  if (!def) return { ok: false, reason: "unknown_key" };
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, reason: "not_a_number" };
  if (value < def.min || value > def.max) return { ok: false, reason: "out_of_range", min: def.min, max: def.max };

  const state = loadState();
  const snapshot = getPolicySnapshot();
  const current = snapshot[key];
  if (!force) {
    if (Math.abs(value - current) > def.maxStep + 1e-12) return { ok: false, reason: "step_too_large", maxStep: def.maxStep };
    const last = state.lastChangeWeek[key];
    if (typeof last === "number" && weekNow() - last < def.cooldownWeeks) {
      return { ok: false, reason: "cooldown", nextWeek: last + def.cooldownWeeks };
    }
  }
  const candidate = { ...snapshot, [key]: value };
  for (const c of CONSTRAINTS) {
    if (!c.check(candidate)) return { ok: false, reason: "constraint", constraint: c.id, message: c.message };
  }
  return { ok: true };
}

const listeners = [];
// 変更の通知を購読する。fn({ key, old, value, source, week })
export function subscribePolicyChange(fn) {
  listeners.push(fn);
}

// パラメータを変更する。source は変更した主体の名前("admin" / "vote:2026-10" など。履歴に残る)。
export function setPolicyParam(key, value, { source = "unknown", force = false, note = "" } = {}) {
  const check = validatePolicyChange(key, value, { force });
  if (!check.ok) return check;

  const state = loadState();
  const old = getPolicyParam(key);
  state.values[key] = value;
  state.lastChangeWeek[key] = weekNow();
  state.history.push({ week: weekNow(), day: world.getDay(), key, old, value, source, force, note });
  if (state.history.length > HISTORY_MAX) state.history.splice(0, state.history.length - HISTORY_MAX);
  saveState(state);
  for (const fn of listeners) {
    try { fn({ key, old, value, source, week: weekNow() }); } catch (e) { console.warn("[BeeMyHoney] policy listener: " + e); }
  }
  return { ok: true, key, old, value };
}

// 既定値に戻す(管理用。履歴に残り、間隔・幅の制限は受けない)。
export function resetPolicyParam(key, { source = "admin" } = {}) {
  const def = POLICY_PARAMS[key];
  if (!def) return { ok: false, reason: "unknown_key" };
  return setPolicyParam(key, def.default, { source, force: true, note: "reset" });
}

// 全パラメータを既定値に戻す(管理用)。既定値同士は制約を満たすので、1つずつ戻す時の順序問題(制約違反)が起きない。
export function resetAllPolicyParams({ source = "admin" } = {}) {
  const state = loadState();
  const snapshot = getPolicySnapshot();
  const changed = [];
  for (const [key, def] of Object.entries(POLICY_PARAMS)) {
    if (snapshot[key] === def.default) continue;
    state.history.push({ week: weekNow(), day: world.getDay(), key, old: snapshot[key], value: def.default, source, force: true, note: "reset all" });
    state.lastChangeWeek[key] = weekNow();
    changed.push({ key, old: snapshot[key], value: def.default });
  }
  state.values = {};
  if (state.history.length > HISTORY_MAX) state.history.splice(0, state.history.length - HISTORY_MAX);
  saveState(state);
  for (const c of changed) for (const fn of listeners) {
    try { fn({ ...c, source, week: weekNow() }); } catch (e) { console.warn("[BeeMyHoney] policy listener: " + e); }
  }
  return { ok: true, changed: changed.length };
}

export function getPolicyHistory(limit = 10) {
  return loadState().history.slice(-limit);
}

export function listPolicyParams() {
  const snap = getPolicySnapshot();
  return Object.entries(POLICY_PARAMS).map(([key, def]) => ({ key, value: snap[key], ...def }));
}

// ---- 管理用コマンド ----
function pct(v) {
  return (v * 100).toFixed(3) + "%";
}

function fmtParam(def, v) {
  if (def.unit === "weeks") return `${v}週`;
  if (def.unit === "base") return `${v}E(ベース)`;
  if (def.unit === "count") return `${v}件`;
  if (def.unit === "days") return `${v}日`;
  if (def.unit === "ratio") return `x${v}`;
  return pct(v);
}

function handleCommand(message) {
  const [cmd, a, b, c] = message.trim().split(/\s+/);
  switch (cmd) {
    case "list":
    case "":
    case undefined:
      return listPolicyParams().map((p) => `${p.key}: ${fmtParam(p, p.value)} (既定 ${fmtParam(p, p.default)} / 範囲 ${fmtParam(p, p.min)}〜${fmtParam(p, p.max)} / 1回 ±${fmtParam(p, p.maxStep)} / 間隔 ${p.cooldownWeeks}週)`).join("\n");
    case "get":
      return POLICY_PARAMS[a] ? `${a}: ${fmtParam(POLICY_PARAMS[a], getPolicyParam(a))}` : `unknown key: ${a}`;
    case "set": {
      const value = parseFloat(b);
      const r = setPolicyParam(a, value, { source: "admin", force: c === "force" });
      return r.ok ? `${a}: ${fmtParam(POLICY_PARAMS[a], r.old)} -> ${fmtParam(POLICY_PARAMS[a], r.value)}` : `rejected: ${r.reason}${r.message ? " - " + r.message.ja : ""}${r.maxStep ? " (maxStep " + r.maxStep + ")" : ""}${r.nextWeek ? " (next week " + r.nextWeek + ")" : ""}`;
    }
    case "reset": {
      if (a === "all") return `reset all: ${resetAllPolicyParams().changed} parameter(s) restored`;
      const r = resetPolicyParam(a);
      return r.ok ? `${a}: reset to ${fmtParam(POLICY_PARAMS[a], r.value)}` : `rejected: ${r.reason}`;
    }
    case "history":
      return getPolicyHistory(parseInt(a, 10) || 10).map((h) => `w${h.week} ${h.key}: ${fmtParam(POLICY_PARAMS[h.key] ?? {}, h.old)} -> ${fmtParam(POLICY_PARAMS[h.key] ?? {}, h.value)} by ${h.source}${h.force ? " (force)" : ""}`).join("\n") || "(no changes)";
    default:
      return "usage: list | get <key> | set <key> <value> [force] | reset <key|all> | history [n]";
  }
}

export function startPolicyScriptEvent() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:policy") return;
    const text = "[Policy]\n" + handleCommand(ev.message);
    const target = ev.sourceEntity;
    if (target && typeof target.sendMessage === "function") target.sendMessage(text);
    else console.warn("[BeeMyHoney] " + text);
  });
}


