// 開発銀行機構(economy/dev-bank.js)の検算スクリプト(Node 20+)。
//   node dev/check_devbank.mjs scripts      (パックのルートで実行)
// 1. 審査: 売れる資産がある → 却下して売却 / ない → 最低限の運用資金を支給 / 必要がなければ支給なし
// 2. 売却の順番(貴金属以外 → 貴金属)と、必要な額までで止まること
// 3. 支給額 = 直近の週あたり費用 × 週数(下限あり)。上限(キャップ)で頭打ち
// 4. 判断基準は policy.js のパラメータで変わる(週数・上限・売却可能の最低額)
// 5. HRMHRM以外の主体(法人)も、同じ仕組みで審査される(HRMHRM専用ではない)
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
const A = await imp("economy/account.js");
const D = await imp("economy/dev-bank.js");
const PO = await imp("economy/policy.js");
const P = await imp("economy/price-level.js");
const ME = await imp("economy/market-engine.js");
const W = globalThis.__stubWorld;
const L = P.getPriceLevel();

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) fail(`${m}: ${a} vs ${b}`); };
const mk = (id, type, o = {}) => A.createEntityAccount({ id, type, cash: 0, holdings: {}, ...o });
const asWeekly = (id, expenses) => { const a = A.getEntityAccount(id); a.weekly = expenses.map((e, i) => ({ week: i, revenue: 0, expense: e, net: -e, cashDelta: -e, actions: [] })); A.saveEntityAccount(a); };
const apply = (id) => A.applyForFunding(id, 1000, "test");

// ---- 1. 売れる資産がある → 却下して売却 ----
mk("co-a", "company", { cash: 100, holdings: { cobblestone: 100000, gold_ingot: 100 } });
let req = apply("co-a");
if (!req) fail("申請が積めない");
if (apply("co-a")) fail("審査待ちがある間は重ねて申請できない");
let res = D.processFundingRequests(5);
if (res.length !== 1 || res[0].decision !== "liquidate") fail("売れる資産がある時は却下→売却のはず: " + JSON.stringify(res));
let a = A.getEntityAccount("co-a");
if (!(a.cash > 100)) fail("売却代金が現金に入っていない");
// 2. 順番: 貴金属以外(丸石)から売り、必要な額までで止まる(金は残る)
if (a.holdings.gold_ingot !== 100) fail("貴金属は最後まで残すはず(金が売られた)");
if (!(a.holdings.cobblestone < 100000)) fail("貴金属以外が売られていない");
const target = P.scaleE(A.getEntityAccount("co-a") && 5000); // company の目標現金(ベース5000E)
if (a.cash > target * 1.05) fail(`必要な額を超えて売った: ${a.cash} > ${target}`);
if (A.getFundingRequests().find((r) => r.id === req.id).status !== "rejected_liquidated") fail("申請の状態が却下(売却)になっていない");
if (D.getDevBankState().grantedTotal !== 0) fail("売却の時に支給してはいけない");

// ---- 1b/3. 売れる資産がない → 最低限の運用資金を支給 ----
mk("co-b", "company", { cash: 0, holdings: {} });
asWeekly("co-b", [100000, 200000, 300000, 400000]);   // 直近の週あたり費用の平均 250,000E(下限の12.8万Eより大きい)
apply("co-b");
res = D.processFundingRequests(6);
if (res[0].decision !== "grant") fail("資産がない時は支給のはず");
near(A.getEntityAccount("co-b").cash, 250000 * 4, 1e-6, "支給額 = 週あたり費用 × 4週");
near(D.getDevBankState().grantedTotal, 250000 * 4, 1e-6, "支給の累計");
// 必要がなければ支給なし(現金が運用資金を超えている)
mk("co-c", "company", { cash: 9e9, holdings: {} });
apply("co-c");
res = D.processFundingRequests(7);
if (res[0].decision !== "none" || A.getEntityAccount("co-c").cash !== 9e9) fail("必要がなければ支給しないはず");
if (A.getFundingRequests().find((r) => r.entityId === "co-c").status !== "closed") fail("必要なしの申請は closed");
// 費用の記録がない主体は、下限(2000E×掛率)で支給
mk("co-d", "company", { cash: 0, holdings: {} });
apply("co-d"); D.processFundingRequests(7);
near(A.getEntityAccount("co-d").cash, 2000 * L, 1e-6, "費用の記録がない主体は下限の運用資金");

// ---- 3b. 上限(キャップ) ----
mk("co-e", "company", { cash: 0, holdings: {} });
asWeekly("co-e", [10e6, 10e6, 10e6, 10e6]);        // 必要額は4千万E。上限(20万E×掛率)で頭打ち
apply("co-e"); D.processFundingRequests(8);
near(A.getEntityAccount("co-e").cash, 200000 * L, 1e-6, "支給は上限で頭打ち");

// ---- 4. パラメータで判断が変わる ----
W.day = 7 * 20;
PO.setPolicyParam("devbank_operating_weeks", 6, { source: "test", force: true });
mk("co-f", "company", { cash: 0, holdings: {} });
asWeekly("co-f", [100000, 100000, 100000, 100000]);
apply("co-f"); D.processFundingRequests(20);
near(A.getEntityAccount("co-f").cash, 100000 * 6, 1e-6, "週数を変えると支給額が変わる");
PO.setPolicyParam("devbank_grant_cap_base", 100, { source: "test", force: true });
mk("co-g", "company", { cash: 0, holdings: {} });
asWeekly("co-g", [1e6, 1e6, 1e6, 1e6]);
apply("co-g"); D.processFundingRequests(20);
near(A.getEntityAccount("co-g").cash, 100 * L, 1e-6, "上限を変えると頭打ちが変わる");
// 売却可能の最低額: 資産がこれより小さければ「売れる資産なし」として支給する
PO.setPolicyParam("devbank_min_sellable_base", 5000, { source: "test", force: true });
mk("co-h", "company", { cash: 0, holdings: { cobblestone: 1000 } });  // 時価 約1000×13E = 13,000E < 5000×64
asWeekly("co-h", [1000, 1000, 1000, 1000]);
apply("co-h"); res = D.processFundingRequests(20);
if (res[0].decision !== "grant") fail("資産が売却可能の最低額に満たなければ支給のはず: " + res[0].decision);
PO.resetAllPolicyParams({ source: "test" });
// 範囲外の変更は拒否される
if (PO.setPolicyParam("devbank_operating_weeks", 100, { source: "test", force: true }).ok) fail("範囲外は拒否のはず");

// ---- 5. HRMHRM以外も同じ機構(上の co-* は全て法人)。申請元が存在しなければ closed ----
const ghost = A.applyForFunding("ghost", 100, "test");
res = D.processFundingRequests(21);
if (res.find((r) => r.entityId === "ghost")?.decision !== "closed") fail("存在しない口座の申請は closed");

console.log(D.formatDevBankReport().split("\n").slice(0, 2).join("\n"));
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
