// 既存ワールドの金額換算(economy/migration.js)と、金利・保険(rates.js / insurance.js)の検算スクリプト(Node 20+)。
//   node dev/check_migration.mjs scripts      (パックのルートで実行)
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
globalThis.__stubWorld = {
  day: 10, getDay() { return this.day; }, getPlayers() { return []; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  afterEvents: { playerSpawn: { subscribe() {} } }
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { run(f){ f(); }, afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const M = await imp("economy/migration.js");
const R = await imp("economy/rates.js");
const I = await imp("economy/insurance.js");
const L = await imp("economy/ledger.js");
const P = await imp("economy/price-level.js");
const VP = await imp("economy/village-pricing.js");
const INF = await imp("economy/inflation.js");
const MO = await imp("economy/mail-order.js");

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) fail(`${m}: ${a} vs ${b}`); };
const mkPlayer = (name, props = {}) => {
  const m = new Map(Object.entries(props)); const msgs = [];
  return { name, msgs, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => (v === undefined ? m.delete(k) : m.set(k, v)), sendMessage: (x) => msgs.push(x) };
};

// ---- 換算(旧ワールド) ----
const old = mkPlayer("old", {
  acc_emeralds: 1000, cr_loan_balance: 500, cr_loan_weekly_payment: 50, cr_card_limit: 250, cr_card_balance: 40, cr_card_min_payment: 20,
  loan_lent_amount: 100, acc_stock_bought_skein: 48, acc_rate_honeycomb: 2.1, fut_strike_rose: 3, acc_curr_honeycomb: 77, acc_stock_skein: 5,
  labor_consultant_contract: JSON.stringify({ key: "short", margin: 60, days: 3 })
});
const factor = P.getPriceLevel();
const r = M.migratePlayerIfNeeded(old);
if (!r || r.converted < 8) fail(`換算された項目数が少ない: ${r && r.converted}`);
const g = (p, k) => p.getDynamicProperty(k);
if (g(old, "acc_emeralds") !== 1000 * factor) fail(`口座: ${g(old, "acc_emeralds")}`);
if (g(old, "cr_loan_balance") !== 500 * factor) fail("借入残高");
if (g(old, "cr_card_limit") !== 250 * factor) fail("カード限度額");
if (g(old, "cr_card_min_payment") !== 20 * factor) fail("カード最低返済");
if (g(old, "loan_lent_amount") !== 100 * factor) fail("融資中の元本");
if (g(old, "acc_stock_bought_skein") !== 48 * factor) fail("株の取得単価");
near(g(old, "acc_rate_honeycomb"), 2.1 * factor, 0.01, "外貨の取得レート");
if (g(old, "fut_strike_rose") !== 3 * factor) fail("先物の約定価格");
if (JSON.parse(g(old, "labor_consultant_contract")).margin !== 60 * factor) fail("派遣マージン");
if (g(old, "acc_curr_honeycomb") !== 77 || g(old, "acc_stock_skein") !== 5) fail("通貨の単位数・株数は換算しないはず");
if (old.msgs.length !== 1) fail("案内メッセージが1回出るはず");
// 台帳: 増分が conversion として記録される
const rep = L.getLedgerReport(12);
if (rep.total.byGroup.conversion?.in !== 1000 * (factor - 1)) fail(`台帳の換算記録: ${JSON.stringify(rep.total.byGroup)}`);
if (L.getNetIssuance(12) !== 0) fail("換算は発行に数えないはず");
// 2回目は何もしない
const again = M.migratePlayerIfNeeded(old);
if (again !== null || g(old, "acc_emeralds") !== 1000 * factor) fail("2回目は何もしないはず");

// ---- 新規プレイヤー(旧ワールドでも、何も持たない) ----
const fresh = mkPlayer("fresh");
M.migratePlayerIfNeeded(fresh);
if (fresh.msgs.length !== 0 || g(fresh, "bmh_scale_version") !== 1) fail("新規プレイヤーは何も出さずにフラグだけ立つはず");
// 旧ワールドのまま2人目も換算される(台帳ができても、ワールドの判定は固定)
const old2 = mkPlayer("old2", { acc_emeralds: 10 });
M.migratePlayerIfNeeded(old2);
if (g(old2, "acc_emeralds") !== 10 * factor) fail("ワールド判定が台帳の出現で変わってしまった");

// ---- 新版で始まったワールド: 換算しない ----
store.clear();
store.set("bmh_price_index", 1.001);
const cur = mkPlayer("cur", { acc_emeralds: 777 });
M.migratePlayerIfNeeded(cur);
if (g(cur, "acc_emeralds") !== 777) fail("新版のワールドでは換算しないはず");
store.clear();

// ---- 金利 ----
near(R.getDepositRate(), 0.0006, 1e-12, "預金金利");
near(R.getCardRate(), 0.003, 1e-12, "カード金利");
const infCap = INF.INFLATION_WEEKLY_CAP;
if (R.getDepositRate() < infCap) fail("預金金利がインフレ上限を下回っている(実質マイナス)");
for (let d = 1; d <= 5; d++) for (const s of [400, 600, 800]) {
  const lr = R.getLoanRate(d, s);
  if (lr < R.getDepositRate()) fail(`ローン金利が預金金利より低い(d=${d}, s=${s})`);
  if (lr > R.getCardRate()) fail(`ローン金利がカード金利より高い(d=${d}, s=${s}): ${lr}`);
}
if (R.getLoanRate(5, 400) <= R.getLoanRate(1, 400)) fail("難易度が高いほど金利が上がるはず");
if (R.getLoanRate(3, 800) >= R.getLoanRate(3, 500)) fail("スコアが高いほど優遇されるはず");
// 貸し手: 期待収益が元本を上回る(貸し倒れを織り込む)
for (const score of [350, 500, 650, 800]) for (const weeks of [6, 10, 14]) {
  const p = R.getRepayProbability(score);
  const rate = R.getLenderRate(p, weeks);
  const ev = p * (1 + rate * weeks) + (1 - p) * R.LENDING_DEFAULT_RECOVERY;
  if (ev <= 1) fail(`貸し手の期待収益が元本以下(score=${score}, weeks=${weeks}): ${ev}`);
  if (ev > 1.1) fail(`貸し手の期待収益が高すぎる(score=${score}, weeks=${weeks}): ${ev}`);
}

// ---- 保険 ----
for (const [k, t] of Object.entries(I.INSURANCE_TYPES)) {
  const value = t.payout.amount * VP.getItemBasePriceExact(t.payout.itemId);
  near(value / t.premium, I.INSURANCE_PAYOUT_MULTIPLE, 0.3, `保険${k}の支給/保険料の比`);
  if (t.payout.amount % 4 !== 0) fail(`保険${k}の支給個数が切りのよい数でない: ${t.payout.amount}`);
}
// ---- プライム週額(ベース6E)と配当 ----
if (MO.PRIME_STANDARD_WEEKLY_FEE !== 6) fail("プライム週額のベースが6でない");
if (MO.getPrimeStandardWeeklyFee() !== 6 * factor) fail("プライム週額(掛率込み)");
near(R.getDividendRateDaily() * 7, R.getPolicyRate() + 0.0004, 1e-12, "配当の週利 = 政策金利 + 上乗せ");
if (R.getDividendRateDaily() * 7 < R.getDepositRate()) fail("配当が預金金利を下回る");
console.log(`factor x${factor} / deposit ${R.getDepositRate() * 100}% card ${R.getCardRate() * 100}% / loan d1 ${(R.getLoanRate(1, 500) * 100).toFixed(2)}% d5 ${(R.getLoanRate(5, 500) * 100).toFixed(2)}%`);
console.log(Object.entries(I.INSURANCE_TYPES).map(([k, t]) => `${k}:${t.payout.amount}`).join(" "));
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
