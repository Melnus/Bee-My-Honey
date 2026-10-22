// ローンの繰上返済(economy/loan.js)の検算スクリプト(Node 20+)。
//   node dev/check_loan.mjs scripts      (パックのルートで実行)
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
const store = new Map();
globalThis.__stubWorld = {
  day: 7 * 5 + 2, getDay() { return this.day; }, getPlayers() { return []; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v))
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { run(f){ f(); }, runInterval(){}, afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const LO = await imp("economy/loan.js");
const L = await imp("economy/ledger.js");

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
const mkPlayer = (name) => { const m = new Map(); return { name, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) }; };

// 元本1000・利息200 の借入(残高1200、残り4週、週300)
const setLoan = (p, { balance, principal, weeks }) => {
  p.setDynamicProperty("cr_loan_balance", balance);
  p.setDynamicProperty("cr_loan_weeks_left", weeks);
  p.setDynamicProperty("cr_loan_weekly_payment", Math.ceil(balance / weeks));
  if (principal !== undefined) p.setDynamicProperty("cr_loan_principal_left", principal);
};

// 現金が足りなければ何も動かさない
let p = mkPlayer("a"); setLoan(p, { balance: 1200, principal: 1000, weeks: 4 }); p.setDynamicProperty("acc_emeralds", 500);
let r = LO.repayLoanEarly(p, false);
if (r.ok || r.reason !== "insufficient_funds" || r.shortage !== 500) fail("現金不足は不足額つきで拒否: " + JSON.stringify(r));
eq(p.getDynamicProperty("cr_loan_balance"), 1200, "拒否したら残高は動かない");

// 元本だけ返す: 利息分が残り、週額は残り週数で割り直す
p.setDynamicProperty("acc_emeralds", 5000);
r = LO.repayLoanEarly(p, false);
if (!r.ok || r.paid !== 1000 || r.closed || r.balance !== 200) fail("元本のみ: " + JSON.stringify(r));
eq(p.getDynamicProperty("acc_emeralds"), 4000, "口座から元本分が引かれる");
eq(p.getDynamicProperty("cr_loan_weekly_payment"), 50, "週額 = 残りの利息 ÷ 残り週数");
const split = LO.getLoanSplit(p);
eq(split.principal + "/" + split.interest, "0/200", "元本のみ返したあとは、残りは利息だけ");

// 利息込みで全額: 完済
r = LO.repayLoanEarly(p, true);
if (!r.ok || !r.closed || r.paid !== 200) fail("全額返済: " + JSON.stringify(r));
eq(LO.hasActiveLoan(p), false, "完済したらローンなし");
eq(p.getDynamicProperty("acc_emeralds"), 3800, "利息分も引かれる");

// 利息込みで最初から全額
p = mkPlayer("b"); setLoan(p, { balance: 1200, principal: 1000, weeks: 4 }); p.setDynamicProperty("acc_emeralds", 5000);
r = LO.repayLoanEarly(p, true);
if (!r.ok || !r.closed || r.paid !== 1200) fail("利息込み全額: " + JSON.stringify(r));

// 元本の記録がない旧ローン: 残高の全額を元本として扱う(元本のみ=全額返済)
p = mkPlayer("c"); setLoan(p, { balance: 777, weeks: 3 }); p.setDynamicProperty("acc_emeralds", 5000);
eq(LO.getLoanSplit(p).principal, 777, "旧ローンは残高が全て元本");
r = LO.repayLoanEarly(p, false);
if (!r.ok || !r.closed || r.paid !== 777) fail("旧ローンの元本のみ=全額: " + JSON.stringify(r));

// ローンが無い
eq(LO.repayLoanEarly(mkPlayer("d"), false).reason, "no_loan", "ローンなしは拒否");

console.log(errors === 0 ? "OK" : `${errors} errors`);
process.exit(errors === 0 ? 0 : 1);
