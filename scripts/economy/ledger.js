import { world, system } from "@minecraft/server";

// ==========================================
// エメラルド発行台帳 / Emerald Ledger  (dev/sketch/sketch-inflation-economy.md 案1)
// ------------------------------------------
// 口座残高(acc_emeralds)が増減する処理を全てここ経由にして、「どの理由で、どれだけ、システムから
// プレイヤーへ出たか(in)/プレイヤーからシステムへ戻ったか(out)」を週ごとに記録する。
//   in  … システム → プレイヤー(賃金・利息・融資・配当・市場での売却・入金など)
//   out … プレイヤー → システム(返済・保険料・送料・市場での購入・出金など)
// 記録は台帳開始以降の累計と、直近 LEDGER_KEEP_WEEKS 週の週別バケットの2本立て。
// 恒等式: 全プレイヤーの口座残高の合計の増減 = 台帳の in − out の増減(check_ledger.mjs で検証)。
//
// カテゴリは GROUP に束ねる(インフレの入力に使うのは主に income / credit):
//   income     … 労働・利息・配当など、活動の対価として新しくエメラルドが出る流れ
//   credit     … 融資・カードなど信用の流れ(出た分は返済でoutになる)
//   market     … 市場(ゴーレム・バルク・外貨・株・先物)との交換。資産との交換であり発行ではない
//   spend      … 送料・プライム・保険料など、サービスへの支払い(回収)
//   penalty    … 事故補償・違約金など(回収)
//   conversion … 物理エメラルドとの入出金(アドオン外との境界。発行でも回収でもない)
// 現状の対象は「口座のエメラルド」のみ。外貨(HNY等)・株・商品は未対応(将来、同じ形で足せる)。
// ==========================================

const LEDGER_KEY = "bmh_ledger_v1";
export const LEDGER_KEEP_WEEKS = 12;

export const FLOW = {
  // income
  QUEST_WAGE: "quest_wage",
  DISPATCH_MARGIN: "dispatch_margin",
  HIRE_BONUS: "hire_bonus",
  BANK_INTEREST: "bank_interest",
  DIVIDEND: "dividend",
  // credit
  LOAN_DISBURSED: "loan_disbursed",
  LOAN_REPAID: "loan_repaid",
  LEND_OUT: "lend_out",
  LEND_RETURN: "lend_return",
  CARD_PAYMENT: "card_payment",
  // market
  COMMODITY_BUY: "commodity_buy",
  COMMODITY_SELL: "commodity_sell",
  BULK_BUY: "bulk_buy",
  BULK_SELL: "bulk_sell",
  FOREX_BUY: "forex_buy",
  FOREX_SELL: "forex_sell",
  STOCK_BUY: "stock_buy",
  STOCK_SELL: "stock_sell",
  FUTURES_MARGIN: "futures_margin",
  FUTURES_SETTLE: "futures_settle",
  // spend
  MAIL_ORDER: "mail_order",
  PRIME_FEE: "prime_fee",
  INSURANCE: "insurance",
  // penalty
  LABOR_COMPENSATION: "labor_compensation",
  LABOR_PENALTY: "labor_penalty",
  // conversion
  DEPOSIT: "deposit",
  WITHDRAW: "withdraw",
  MIGRATION: "migration" // 旧縮尺の口座残高を掛率で換算した差分(migration.js)。発行ではない
};

export const GROUP_OF = {
  quest_wage: "income", dispatch_margin: "income", hire_bonus: "income", bank_interest: "income", dividend: "income",
  loan_disbursed: "credit", loan_repaid: "credit", lend_out: "credit", lend_return: "credit", card_payment: "credit",
  commodity_buy: "market", commodity_sell: "market", bulk_buy: "market", bulk_sell: "market",
  forex_buy: "market", forex_sell: "market", stock_buy: "market", stock_sell: "market",
  futures_margin: "market", futures_settle: "market",
  mail_order: "spend", prime_fee: "spend", insurance: "spend",
  labor_compensation: "penalty", labor_penalty: "penalty",
  deposit: "conversion", withdraw: "conversion", migration: "conversion"
};

function weekNow() {
  return Math.floor(world.getDay() / 7);
}

function emptyLedger() {
  return { v: 1, total: { in: {}, out: {} }, weeks: {} };
}

function loadLedger() {
  const raw = world.getDynamicProperty(LEDGER_KEY);
  if (typeof raw !== "string") return emptyLedger();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1) return parsed;
  } catch (e) {
    console.warn("[BeeMyHoney] ledger: corrupted, starting fresh: " + e);
  }
  return emptyLedger();
}

function saveLedger(ledger) {
  // 古い週のバケットを間引く(累計は残る)
  const keepFrom = weekNow() - LEDGER_KEEP_WEEKS + 1;
  for (const w of Object.keys(ledger.weeks)) {
    if (Number(w) < keepFrom) delete ledger.weeks[w];
  }
  world.setDynamicProperty(LEDGER_KEY, JSON.stringify(ledger));
}

function bump(map, category, amount) {
  map[category] = (map[category] ?? 0) + amount;
}

// その週に「活動した」と数えるプレイヤー数の上限(動的プロパティの大きさを抑えるため)
const MAX_TRACKED_PLAYERS_PER_WEEK = 200;

function record(direction, category, amount, playerName) {
  if (!(amount > 0)) return;
  if (!(category in GROUP_OF)) console.warn("[BeeMyHoney] ledger: unknown category " + category);
  const ledger = loadLedger();
  bump(ledger.total[direction], category, amount);
  const wk = String(weekNow());
  if (!ledger.weeks[wk]) ledger.weeks[wk] = { in: {}, out: {} };
  bump(ledger.weeks[wk][direction], category, amount);
  // 活動したプレイヤーの数(income / credit の流れがあった人)。インフレの「1人あたり」の計算に使う。
  const group = GROUP_OF[category];
  if (playerName && (group === "income" || group === "credit")) {
    const players = (ledger.weeks[wk].players ??= {});
    if (!players[playerName] && Object.keys(players).length < MAX_TRACKED_PLAYERS_PER_WEEK) players[playerName] = 1;
  }
  saveLedger(ledger);
}

function balanceOf(player) {
  return player.getDynamicProperty("acc_emeralds") ?? 0;
}

// ---- 入出金履歴(銀行メニューの「入出金履歴」に出す。プレイヤーごとに直近 HISTORY_KEEP 件) ----
// 台帳(上の集計)は理由別の合計しか持たない。「いつ・誰から/誰へ・いくら」はこちらで持つ。
// 1件 = { d: 日, w: "in"|"out", a: 額, c: 理由(FLOW), p: 相手(省略可) }
const HISTORY_KEY = "acc_history";
export const HISTORY_KEEP = 30;
// 履歴に載せない理由。旧縮尺の換算は、プレイヤーの入出金ではない。
const HISTORY_SKIP = new Set([FLOW.MIGRATION]);
// 同じ週に何度も入る小さな入金は、1行にまとめる(履歴が利息で埋まらないように)。
const HISTORY_MERGE = new Set([FLOW.BANK_INTEREST]);

export function getAccountHistory(player) {
  const raw = player.getDynamicProperty(HISTORY_KEY);
  if (typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function pushHistory(player, direction, category, amount, party) {
  if (HISTORY_SKIP.has(category)) return;
  const day = world.getDay();
  const list = getAccountHistory(player);
  const last = list[0]; // 新しい順に持つ
  if (HISTORY_MERGE.has(category) && last && last.c === category && last.w === direction && Math.floor(last.d / 7) === Math.floor(day / 7)) {
    last.a += amount;
    last.d = day;
  } else {
    const entry = { d: day, w: direction, a: amount, c: category };
    if (party) entry.p = String(party).slice(0, 24);
    list.unshift(entry);
  }
  if (list.length > HISTORY_KEEP) list.length = HISTORY_KEEP;
  player.setDynamicProperty(HISTORY_KEY, JSON.stringify(list));
}

// システム → プレイヤー。口座に amount を足し、台帳の in に記録する。足した額を返す。
// from を渡すと、入出金履歴に「○○から」と残る(例: "HRMHRM")。
export function creditEmeralds(player, amount, category, { from = null } = {}) {
  if (!(amount > 0)) return 0;
  player.setDynamicProperty("acc_emeralds", balanceOf(player) + amount);
  record("in", category, amount, player.name);
  pushHistory(player, "in", category, amount, from);
  return amount;
}

// プレイヤー → システム。口座から amount を引き、台帳の out に記録する。引いた額を返す。
// clamp:true なら残高を超える分は引かず(口座は0止まり)、実際に引けた額だけ記録する。
// clamp:false(既定)で残高不足なら何もせず0を返す(呼び出し側が事前に残高を確認している前提の保険)。
// to を渡すと、入出金履歴に「○○へ」と残る。
export function debitEmeralds(player, amount, category, { clamp = false, to = null } = {}) {
  if (!(amount > 0)) return 0;
  const bal = balanceOf(player);
  const actual = clamp ? Math.min(bal, amount) : amount;
  if (actual > bal || actual <= 0) return 0;
  player.setDynamicProperty("acc_emeralds", bal - actual);
  record("out", category, actual, player.name);
  pushHistory(player, "out", category, actual, to);
  return actual;
}

// 符号つきの増減(先物の決済損益など)。正なら credit、負なら clamp つきの debit。
export function applyEmeraldDelta(player, delta, category) {
  if (delta > 0) return creditEmeralds(player, delta, category);
  if (delta < 0) return -debitEmeralds(player, -delta, category, { clamp: true });
  return 0;
}

// ---- 集計 ----

function sumMap(map) {
  let s = 0;
  for (const v of Object.values(map)) s += v;
  return s;
}

function groupTotals(bucket) {
  const groups = {};
  for (const dir of ["in", "out"]) {
    for (const [cat, amt] of Object.entries(bucket[dir])) {
      const g = GROUP_OF[cat] ?? "unknown";
      if (!groups[g]) groups[g] = { in: 0, out: 0 };
      groups[g][dir] += amt;
    }
  }
  return groups;
}

function summarize(bucket) {
  return {
    in: sumMap(bucket.in),
    out: sumMap(bucket.out),
    net: sumMap(bucket.in) - sumMap(bucket.out),
    byGroup: groupTotals(bucket),
    byCategory: { in: { ...bucket.in }, out: { ...bucket.out } }
  };
}

// 台帳の集計を返す。weeks で直近N週分(今週を含む)の合算も出す。
export function getLedgerReport(weeks = 1) {
  const ledger = loadLedger();
  const now = weekNow();
  const recent = { in: {}, out: {} };
  for (let w = now - weeks + 1; w <= now; w++) {
    const b = ledger.weeks[String(w)];
    if (!b) continue;
    for (const dir of ["in", "out"]) for (const [cat, amt] of Object.entries(b[dir])) bump(recent[dir], cat, amt);
  }
  return { week: now, recentWeeks: weeks, recent: summarize(recent), total: summarize(ledger.total) };
}

// 指定した週(ワールド日÷7の整数部)の集計。インフレ指数の更新(inflation.js)が使う。
//   netIssuance   … income と credit の in − out(エメラルド)
//   activePlayers … その週に income / credit の流れがあったプレイヤーの数(古い記録など不明なら0)
export function getWeekSummary(week) {
  const ledger = loadLedger();
  const b = ledger.weeks[String(week)];
  if (!b) return { netIssuance: 0, activePlayers: 0 };
  const g = groupTotals(b);
  const pick = (name) => (g[name] ? g[name].in - g[name].out : 0);
  return { netIssuance: pick("income") + pick("credit"), activePlayers: Object.keys(b.players ?? {}).length };
}

// 指定した週のカテゴリ別の in / out をそのまま返す(HRMHRMの会計の週次締め用)。記録が無ければ空。
export function getWeekFlows(week) {
  const b = loadLedger().weeks[String(week)];
  return { in: { ...(b?.in ?? {}) }, out: { ...(b?.out ?? {}) } };
}

export function getCurrentWeek() {
  return weekNow();
}

// 発行(=活動の対価として新しく出た量)の目安: income と credit の in − out。
// インフレ率の入力候補(スケッチ案2)。市場・conversion は含めない。
export function getNetIssuance(weeks = 1) {
  const g = getLedgerReport(weeks).recent.byGroup;
  const pick = (name) => (g[name] ? g[name].in - g[name].out : 0);
  return pick("income") + pick("credit");
}

// ---- 管理用コマンド: /scriptevent bmh:ledger [週数] ----
function formatReport(r) {
  const line = (title, s) => {
    const groups = Object.entries(s.byGroup)
      .map(([g, v]) => `${g}: +${Math.round(v.in)} / -${Math.round(v.out)}`)
      .join(", ");
    return `${title}  in ${Math.round(s.in)} / out ${Math.round(s.out)} / net ${Math.round(s.net)}\n  ${groups || "(no records)"}`;
  };
  return [
    `[Ledger] week ${r.week}`,
    line(`recent ${r.recentWeeks}w`, r.recent),
    line("total", r.total),
    `net issuance (income+credit, recent): ${Math.round(r.recent.byGroup.income ? r.recent.byGroup.income.in - r.recent.byGroup.income.out : 0) + Math.round(r.recent.byGroup.credit ? r.recent.byGroup.credit.in - r.recent.byGroup.credit.out : 0)}`
  ].join("\n");
}

export function startLedgerScriptEvent() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:ledger") return;
    const weeks = Math.max(1, Math.min(LEDGER_KEEP_WEEKS, parseInt(ev.message, 10) || 1));
    const text = formatReport(getLedgerReport(weeks));
    const target = ev.sourceEntity;
    if (target && typeof target.sendMessage === "function") target.sendMessage(text);
    else console.warn("[BeeMyHoney] " + text);
  });
}

