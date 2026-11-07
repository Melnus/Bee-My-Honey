// インフレ指数の自動更新(economy/inflation.js)の検算スクリプト(Node 20+)。
//   node dev/check/check_inflation.mjs scripts      (パックのルートで実行)
// 1. 純粋関数 weeklyGrowthRate: プレイヤー0人/純増が負 → 0、大きな純増でも上限(週0.05%)を超えない、圧力1で上限×tanh(1)
// 2. 4週のあいだ活動が上限に張り付いても、指数の上昇は約0.2%に収まる
// 3. 二重に呼んでも二重に上がらない / 活動のない週は凍結 / 日付が飛んでも、記録のある週だけが反映される
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
const INF = await imp("economy/inflation.js");
const PL = await imp("economy/price-level.js");
const L = await imp("economy/ledger.js");

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) fail(`${m}: ${a} vs ${b}`); };
const cap = INF.INFLATION_WEEKLY_CAP;

// 1.
if (INF.weeklyGrowthRate(1e9, 0) !== 0) fail("プレイヤー0人は0のはず");
if (INF.weeklyGrowthRate(-500, 3) !== 0) fail("純増が負なら0(下方硬直)のはず");
if (INF.weeklyGrowthRate(1e12, 1) > cap + 1e-12) fail("上限を超えた");
near(INF.weeklyGrowthRate(1e12, 1), cap, 1e-9, "大きな純増は上限に張り付く");
near(INF.weeklyGrowthRate(INF.INFLATION_REFERENCE_WEEKLY_INCOME, 1), cap * Math.tanh(1), 1e-12, "圧力1");
near(cap, 0.0005, 1e-12, "上限は0.05%/週");

// プレイヤーのスタブ
const mkPlayer = (name) => { const m = new Map(); return { name, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) }; };
const alice = mkPlayer("alice"), bob = mkPlayer("bob");
const W = globalThis.__stubWorld;
const lvl = () => PL.getPriceLevel();
const earnHuge = (week) => { W.day = week * 7 + 2; for (const p of [alice, bob]) L.creditEmeralds(p, 1e9, L.FLOW.QUEST_WAGE); };

// 2. 3.
W.day = 3 * 7 + 1;                   // 第3週の途中から始める
if (INF.updatePriceIndex() !== 0) fail("初回は何も反映しないはず");
earnHuge(3);                         // 第3週に大きな活動(2人)
W.day = 4 * 7;                       // 第4週に入る → 第3週が終わった
const i0 = PL.getPriceIndex();
if (INF.updatePriceIndex() !== 1) fail("終わった1週が反映されるはず");
const i1 = PL.getPriceIndex();
near(i1 / i0, 1 + cap, 1e-9, "上限いっぱいの週で指数が1+上限倍になる");
if (INF.updatePriceIndex() !== 0 || PL.getPriceIndex() !== i1) fail("二重に呼んでも二重に上がらないはず");

// 4週連続で上限いっぱい → 約0.2%
for (let w = 4; w <= 6; w++) { earnHuge(w); W.day = (w + 1) * 7; INF.updatePriceIndex(); }
near(PL.getPriceIndex() / i0 - 1, Math.pow(1 + cap, 4) - 1, 1e-9, "4週ぶん");
if (PL.getPriceIndex() / i0 - 1 > 0.0021) fail("4週で0.21%を超えた");

// 活動のない週は凍結
const frozenFrom = PL.getPriceIndex();
W.day = 8 * 7; INF.updatePriceIndex();        // 第7週は記録なし
if (PL.getPriceIndex() !== frozenFrom) fail("活動のない週は凍結のはず");

// 日付が飛ぶ: 第8週に活動 → 第20週まで飛ぶ。反映されるのは第8週ぶんだけ
earnHuge(8); W.day = 20 * 7;
const before = PL.getPriceIndex();
const n = INF.updatePriceIndex();
if (n !== 12) fail(`追いつきで処理する週数: ${n}`);
near(PL.getPriceIndex() / before, 1 + cap, 1e-9, "日付が飛んでも、記録のある週(1週)だけが反映される");

// 台帳の活動プレイヤー数
const sum = L.getWeekSummary(8);
if (sum.activePlayers !== 2) fail(`活動プレイヤー数: ${sum.activePlayers}`);

// 村・会社の払い出し(org)は、別枠で足される。プレイヤー側の income が0でも、org があれば上がる。上限も別
{
  const orgCap = INF.INFLATION_ORG_WEEKLY_CAP;
  near(INF.weeklyGrowthRate(0, 1, 1e9), orgCap, 1e-12, "orgだけが大きい週は、org上限で頭打ち");
  near(INF.weeklyGrowthRate(1e9, 1, 1e9), cap + orgCap, 1e-12, "両方が大きい週の上限は、2つの枠の合計");
  if (INF.weeklyGrowthRate(0, 1, 0) !== 0) fail("どちらも0なら上がらない");
  if (INF.weeklyGrowthRate(0, 1, -1e9) !== 0) fail("orgが負でも下げない(下方硬直)");
  if (INF.weeklyGrowthRate(0, 0, 1e9) !== 0) fail("プレイヤー不在の週は凍結");
  // 台帳: 村の代金(village_buy)と清算の払い(liquidation)は org グループ。活動プレイヤーに数える
  const pl = { name: "orgonly", getDynamicProperty: () => 0, setDynamicProperty() {} };
  W.day = 30 * 7;
  L.creditEmeralds(pl, 1000, L.FLOW.VILLAGE_BUY);
  const s30 = L.getWeekSummary(30);
  if (s30.orgIssuance !== 1000 || s30.netIssuance !== 0 || s30.activePlayers !== 1) fail("village_buy は org に入り、netIssuance(income+credit)には入らない: " + JSON.stringify(s30));
}

console.log(`index ${i0} → ${PL.getPriceIndex().toFixed(6)} (level x${lvl().toFixed(3)}) / cap ${cap * 100}%/週`);
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
