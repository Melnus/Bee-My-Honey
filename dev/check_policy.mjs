// 金融政策の仕組み(economy/policy.js)と、それが金利・配当に効くことの検算スクリプト(Node 20+)。
//   node dev/check_policy.mjs scripts      (パックのルートで実行)
// 1. 既定値が従来どおり(政策金利0.06% / カード0.30% / ローン0.12〜0.20% / 配当 週0.10%)
// 2. 変更ルール: 範囲(forceでも破れない) / 1回の幅 / 間隔 / パラメータ間の制約 / force の扱い
// 3. 履歴(最大50件)・購読(変更の通知)・リセット
// 4. 変更が rates.js / 配当に反映される
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
globalThis.__stubWorld = {
  day: 0, getDay() { return this.day; }, getPlayers() { return []; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v))
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const PO = await imp("economy/policy.js");
const R = await imp("economy/rates.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) fail(`${m}: ${a} vs ${b}`); };

// 1.
near(R.getPolicyRate(), 0.0006, 1e-12, "政策金利の既定");
near(R.getDepositRate(), 0.0006, 1e-12, "預金金利の既定");
near(R.getCardRate(), 0.003, 1e-12, "カード金利の既定");
near(R.getLoanRate(1, 500), 0.0006 + 0.0004 + 0.0002, 1e-12, "ローン難易度1の既定");
near(R.getLoanRate(5, 500), 0.0006 + 0.0004 + 0.001, 1e-12, "ローン難易度5の既定");
near(R.getDividendRateDaily() * 7, 0.001, 1e-12, "配当の週利の既定");

// 2.
const set = (k, v, o = {}) => PO.setPolicyParam(k, v, { source: "test", ...o });
let r = set("nope", 1);
if (r.ok || r.reason !== "unknown_key") fail("未知のキーは拒否");
r = set("policy_rate", "x");
if (r.ok || r.reason !== "not_a_number") fail("数値以外は拒否");
r = set("policy_rate", 0.5);
if (r.ok || r.reason !== "out_of_range") fail("範囲外は拒否");
r = set("policy_rate", 0.5, { force: true });
if (r.ok || r.reason !== "out_of_range") fail("範囲外は force でも拒否");
r = set("policy_rate", 0.0020);
if (r.ok || r.reason !== "step_too_large") fail("1回の変更幅の超過は拒否");
r = set("policy_rate", 0.0009);
if (!r.ok) fail("幅内の変更は通る: " + r.reason);
near(R.getDepositRate(), 0.0009, 1e-12, "変更が預金金利に反映");
near(R.getCardRate(), 0.0009 + 0.0024, 1e-12, "変更がカード金利に反映");
r = set("policy_rate", 0.0012);
if (r.ok || r.reason !== "cooldown") fail("同じ週の再変更は拒否(間隔)");
r = set("policy_rate", 0.0012, { force: true });
if (!r.ok) fail("force は間隔・幅を破れる");
r = set("policy_rate", 0.0030, { force: true });
if (!r.ok) fail("force は幅を破れる");
W.day = 7 * 2;
r = set("policy_rate", 0.0033);
if (!r.ok) fail("間隔が過ぎれば通る");

// 制約: カードの上乗せ >= ローンの最大上乗せ(基本 + 5×難易度)
r = set("card_spread", 0.0012, { force: true });
if (r.ok || r.reason !== "constraint") fail("カードの上乗せがローンの最大を下回る変更は拒否(force でも)");
r = set("loan_base_spread", 0.0030, { force: true });
if (r.ok || r.reason !== "constraint") fail("ローンの上乗せがカードを上回る変更は拒否");
// 制約を満たす形に同時には変えられないので、先にカードを上げてからローンを上げる
r = set("card_spread", 0.0036, { force: true });
if (!r.ok) fail("カードを上げるのは通る");
r = set("loan_base_spread", 0.0020, { force: true });
if (!r.ok) fail("カードが十分高ければローンの上乗せを上げられる: " + r.reason);
for (let d = 1; d <= 5; d++) if (R.getLoanRate(d, 400) > R.getCardRate() + 1e-12) fail(`ローン金利(d=${d})がカード金利を超えた`);

// 3. 履歴・購読・リセット
const events = [];
PO.subscribePolicyChange((e) => events.push(e));
W.day = 7 * 10;
set("dividend_spread", 0.0008);
if (events.length !== 1 || events[0].key !== "dividend_spread" || events[0].value !== 0.0008) fail("購読の通知");
const hist = PO.getPolicyHistory(100);
if (hist[hist.length - 1].source !== "test") fail("履歴に変更主体が残る");
for (let i = 0; i < 60; i++) { W.day += 7; PO.setPolicyParam("lender_margin_spread", i % 2 ? 0.0004 : 0.0008, { source: "loop" }); }
if (PO.getPolicyHistory(1000).length > 50) fail("履歴は50件まで");
// 1つずつ戻すと、順序によっては制約(カード≧ローン)に阻まれる。全部まとめて戻す入口を使う
const rbad = PO.resetPolicyParam("card_spread");
if (rbad.ok || rbad.reason !== "constraint") fail("ローンの上乗せが高いままカードだけ戻すのは、制約で拒否されるはず");
const ra = PO.resetAllPolicyParams({ source: "test" });
if (!ra.ok || ra.changed < 3) fail("resetAll で戻った数: " + ra.changed);
near(R.getPolicyRate(), 0.0006, 1e-12, "リセットで政策金利が既定に戻る");
near(R.getCardRate(), 0.003, 1e-12, "リセットでカード金利が既定に戻る");

// 壊れた保存値は既定値に戻して使う
W.setDynamicProperty("bmh_policy_v1", "{not json");
near(R.getPolicyRate(), 0.0006, 1e-12, "壊れたデータは既定値");
W.setDynamicProperty("bmh_policy_v1", JSON.stringify({ v: 1, values: { policy_rate: 99 }, lastChangeWeek: {}, history: [] }));
near(R.getPolicyRate(), 0.0006, 1e-12, "範囲外の保存値は既定値");

console.log(`policy params: ${Object.keys(PO.POLICY_PARAMS).join(", ")}`);
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
