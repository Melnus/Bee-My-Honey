// HRMHRMの会計(economy/account.js / hrmhrm.js)の検算スクリプト(Node 20+)。
//   node dev/check_hrmhrm.mjs scripts      (パックのルートで実行)
// 1. 口座テンプレート: 作成/保存/削除・貸借対照表の等式
// 2. 貴金属の時価評価: 掛率に比例して評価額が動く / 掛け目つきの裏打ち
// 3. 週次の締め: 台帳の週次記録から現金・債権・負債が決まる(市場・換金は含めない)/ 会計の恒等式
// 4. 自動運用: 資金不足なら開発銀行機構に申請 → 売れる資産があれば却下して売却(相場が下がる)/ なければ最低限の運用資金を支給 / 余剰なら買う
// 5. 介入のルール: 3週を超えたら介入。村は人口0なら登録解除・人口ありなら介入。法人は介入。HRMHRMは対象外
// 6. 追いつき: 二重に締めない / 日付が飛んでも順に処理
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
const H = await imp("economy/hrmhrm.js");
const D = await imp("economy/dev-bank.js");
const L = await imp("economy/ledger.js");
const P = await imp("economy/price-level.js");
const ME = await imp("economy/market-engine.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) fail(`${m}: ${a} vs ${b}`); };
const mkPlayer = (name) => { const m = new Map(); return { name, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) }; };
const alice = mkPlayer("alice");
const F = L.FLOW;

// ---- 1. 口座テンプレート ----
const v = A.createEntityAccount({ id: "village-1", type: "village", cash: 1000, holdings: {}, population: 5 });
if (A.listAccountIds().join() !== "village-1") fail("ID一覧");
let sheet = A.getBalanceSheet(v);
near(sheet.equity, 1000, 1e-9, "現金だけの純資産");
let threw = false; try { A.createEntityAccount({ id: "village-1", type: "village" }); } catch { threw = true; }
if (!threw) fail("同じIDは作れない");
const del = A.deleteEntityAccount("village-1");
if (!del.ok || del.writtenOff !== 1000 || A.getEntityAccount("village-1") || A.getTotalWriteOff() !== 1000) fail("削除と消えたお金の記録");

// ---- 2. 時価評価 ----
const acct = H.ensureHrmhrmAccount();
const level = P.getPriceLevel();
near(acct.cash, H.HRMHRM_INITIAL.cashBase * level, 1, "初期の現金は掛率込み");
sheet = A.getBalanceSheet(acct);
const gold = sheet.byKey.gold_ingot, dia = sheet.byKey.diamond;
if (!gold || !dia) fail("貴金属が評価されていない");
near(sheet.preciousValue, gold.value + dia.value, 1e-6, "貴金属の合計");
near(sheet.equity, sheet.cash + sheet.receivables + sheet.holdingsValue - sheet.liabilities, 1e-6, "貸借の等式");
const before = sheet.preciousValue;
P.setPriceIndex(2);
const after = A.getBalanceSheet(A.getEntityAccount("hrmhrm")).preciousValue;
near(after / before, 2, 0.03, "インフレで貴金属の評価額が約2倍");
P.setPriceIndex(1);
// 裏打ち: 負債があれば 貴金属×(1−掛け目)÷負債
const probe = { ...A.getEntityAccount("hrmhrm"), liabilities: 1000 };
near(A.getBalanceSheet(probe).coverage, A.getBalanceSheet(probe).preciousValue * 0.9 / 1000, 1e-6, "裏打ちの倍率");
if (A.getBalanceSheet({ ...probe, liabilities: 0 }).coverage !== null) fail("負債0なら裏打ちは null");

// ---- 3. 週次の締め ----
W.day = 7 * 10 + 1;                                  // 第10週
const cash0 = A.getEntityAccount("hrmhrm").cash;
L.creditEmeralds(alice, 100000, F.QUEST_WAGE);       // HRMHRMの費用
L.creditEmeralds(alice, 20000, F.LOAN_DISBURSED);    // 貸出 → 債権
L.creditEmeralds(alice, 50000, F.COMMODITY_SELL);    // 市場 → 含めない
L.creditEmeralds(alice, 7000, F.DEPOSIT);            // 換金 → 含めない
L.debitEmeralds(alice, 30000, F.MAIL_ORDER);         // 収益
L.debitEmeralds(alice, 5000, F.PRIME_FEE);           // 収益
L.debitEmeralds(alice, 8000, F.LOAN_REPAID);         // 債権が減る
L.debitEmeralds(alice, 9000, F.COMMODITY_BUY);       // 市場 → 含めない
W.day = 7 * 11 + 1;                                  // 第11週に入る → 第10週が終わった
H.ensureHrmhrmAccount();
// 第5〜9週(記録なし)も順に締まる。自動運用は発動しない大きさの現金(初期の4万E×掛率)なので、動きは出ない想定
const processed = H.runHrmhrmWeekly();
if (processed < 1) fail("週が締まらない");
let h = A.getEntityAccount("hrmhrm");
const wk = h.weekly.find((r) => r.week === 10);
if (!wk) fail("第10週の記録がない");
else {
  near(wk.revenue, 30000 + 5000, 1e-6, "収益");
  near(wk.expense, 100000, 1e-6, "費用");
  near(wk.cashDelta, 30000 + 5000 + 8000 - 100000 - 20000, 1e-6, "現金の増減(市場・換金は含まない)");
}
near(h.receivables, 20000 - 8000, 1e-6, "債権 = 貸出 − 返済");
// 会計の恒等式(含める流れについて):
//  ・HRMHRMの現金の増減 = −プレイヤー側の純増(in−out)。お金は相手方どうしで保存される
//  ・現金+債権の増減 = その週の損益(収益−費用)。貸し出しは現金が債権に変わるだけで、損益には出ない
const incl = ["quest_wage", "loan_disbursed", "mail_order", "prime_fee", "loan_repaid"];
const fl = L.getWeekFlows(10);
const playerNet = incl.reduce((s, k) => s + (fl.in[k] ?? 0) - (fl.out[k] ?? 0), 0);
near(h.cash - cash0, -playerNet, 1e-6, "HRMHRMの現金の増減 = −プレイヤーの純増");
near(h.cash - cash0 + h.receivables, wk.net, 1e-6, "現金+債権の増減 = その週の損益");

// ---- 6. 追いつき ----
if (H.runHrmhrmWeekly() !== 0) fail("二重に締めてはいけない");
W.day = 7 * 20 + 1;
const n = H.runHrmhrmWeekly();
if (n !== 9) fail(`日付が飛んだ時の処理週数: ${n}`);
if (A.getEntityAccount("hrmhrm").weekly.length < 10) fail("週次の記録が積まれていない");

// ---- 4. 自動運用(資金の申請 → 開発銀行機構の審査) ----
const lastRecord = () => { const x = A.getEntityAccount("hrmhrm"); return x.weekly[x.weekly.length - 1]; };
// 4a. 資金不足で、売れる資産がある → 申請して、却下(売却)される。支給はされない(相場が下がる)
h = A.getEntityAccount("hrmhrm");
h.cash = 5000;                                       // 下限(2万E×掛率)を大きく下回る
const goldBefore = h.holdings.gold_ingot, priceBefore = ME.getCommodityPrice("gold_ingot");
A.saveEntityAccount(h);
const grantedBefore = D.getDevBankState().grantedTotal;
W.day = 7 * 21 + 1;
H.runHrmhrmWeekly();
h = A.getEntityAccount("hrmhrm");
if (!lastRecord().actions.some((a) => a.type === "apply")) fail("資金不足で申請しなかった");
const rejected = A.getFundingRequests().filter((r) => r.entityId === "hrmhrm" && r.status === "rejected_liquidated");
if (rejected.length !== 1) fail(`却下(売却)された申請: ${rejected.length}`);
if (!(h.holdings.gold_ingot < goldBefore)) fail("金の保有が減っていない(却下→売却)");
if (!(h.cash > 5000)) fail("売却代金が入っていない");
if (D.getDevBankState().grantedTotal !== grantedBefore) fail("売れる資産がある時は支給しないはず");
if (!(ME.getDemandPressure("commodity", "gold_ingot") < 0)) fail("売却が需要圧力(値下がり)に反映されていない");
if (!(ME.getCommodityPrice("gold_ingot") < priceBefore)) fail("売却後も金の価格が下がっていない");
// 4b. 売れる資産がない → 最低限の運用資金が支給される(重複して申請しない)
h.holdings = {}; h.cash = 0; A.saveEntityAccount(h);
W.day = 7 * 22 + 1; H.runHrmhrmWeekly();
h = A.getEntityAccount("hrmhrm");
const granted = A.getFundingRequests().filter((r) => r.entityId === "hrmhrm" && r.status === "granted");
if (granted.length < 1) fail("売れる資産がない時に支給されなかった");
if (!(h.cash > 0)) fail("支給が口座に入っていない");
near(h.cash, D.getDevBankState().grantedTotal - grantedBefore, 1e-6, "支給額 = 支給の累計の増分");
if (A.getPendingFundingRequests().length !== 0) fail("審査待ちが残っている");
// 4c. 余剰 → 買う
h = A.getEntityAccount("hrmhrm");
h.cash = P.getPriceLevel() * 200000; h.holdings = { gold_ingot: 1000, diamond: 1000 }; A.saveEntityAccount(h);
W.day = 7 * 23 + 1; H.runHrmhrmWeekly();
h = A.getEntityAccount("hrmhrm");
if (!lastRecord().actions.some((a) => a.type === "buy")) fail("余剰で買わなかった");
if (!(h.holdings.gold_ingot > 1000)) fail("金が増えていない");

// ---- 5. 介入のルール ----
const mk = (type, pop) => ({ ...A.createEntityAccount({ id: `${type}-x${pop}`, type, cash: 100, population: pop }) });
const vil0 = mk("village", 0), vil5 = mk("village", 5), com = mk("company", null);
const at = (acct, weeks) => ({ ...acct, unsettledSince: 10 - weeks });
if (A.decideIntervention(at(vil5, 3), 10).action !== "none") fail("3週ちょうどはまだ介入しない");
if (A.decideIntervention(at(vil5, 4), 10).action !== "intervene") fail("村(人口あり)は3週超で介入");
if (A.decideIntervention(at(vil0, 4), 10).action !== "deregister") fail("村(人口0)は3週超で登録解除");
if (A.decideIntervention(at(com, 4), 10).action !== "intervene") fail("法人は3週超で介入");
if (A.decideIntervention({ ...at(h, 10), type: "hrmhrm" }, 10).action !== "none") fail("HRMHRMは対象外");
if (A.decideIntervention({ ...vil5, unsettledSince: null }, 10).action !== "none") fail("精算不能でなければ介入しない");
// 記録 → 解消
A.recordSettlement(vil5.id, false, 5); A.recordSettlement(vil5.id, false, 8);
if (A.getEntityAccount(vil5.id).unsettledSince !== 5) fail("精算不能の最初の週が保たれる");
A.recordSettlement(vil5.id, true, 9);
if (A.getEntityAccount(vil5.id).unsettledSince !== null) fail("精算できたら解消");
// 実際の処理: 週次で人口0の村が登録解除され、人口ありは介入案件になる
A.recordSettlement(vil0.id, false, 1); A.recordSettlement(vil5.id, false, 1); A.recordSettlement(com.id, false, 1);
W.day = 7 * 25 + 1; H.runHrmhrmWeekly();
if (A.getEntityAccount(vil0.id)) fail("人口0の村が登録解除されていない");
if (!A.getEntityAccount(vil5.id)) fail("人口ありの村は残るはず");
const open = A.getInterventions().filter((r) => r.status === "open").map((r) => r.entityId).sort();
if (open.join() !== [com.id, vil5.id].sort().join()) fail("介入案件: " + open.join());
if (!(A.getTotalWriteOff() > 1000)) fail("登録解除で消えたお金が記録されていない");

console.log(H.formatHrmhrmReport().split("\n").slice(0, 3).join("\n"));
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
