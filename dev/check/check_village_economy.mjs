// 村の収支検算(無人ワールドで、仮想プレイヤーが毎日、村の枠を埋め続けた場合の数十週)。Node 20+
//   node dev/check/check_village_economy.mjs scripts      (パックのルートで実行)
// 見るもの: 村の資金が尽きる週 / 開発銀行機構の支給の総量 / 出荷の戻り(納品の代金に対する出荷の売上) / 品目の偏り。
// 取引所のあとは、出荷を相場で売る前提に切り替えて同じ検算を回し、赤字が残るかを確かめる(sketch-org-needs.md 案3)。
// 環境変数 VERBOSE=1 で週ごとの表を出す。
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
const store = new Map();
const players = [];
globalThis.__stubWorld = {
  day: 7 * 20, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()],
  afterEvents: { playerSpawn: { subscribe() {} } }
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { run(f){ f(); }, runInterval(){}, afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
// ID生成などが乱数に依存するので、固定の乱数列にする(再現できるように)
let _seed = 20261102; Math.random = () => ((_seed = (_seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const C = await imp("economy/core-registry.js");
const EXS = await imp("economy/exchange.js");
const A = await imp("economy/account.js");
const H = await imp("economy/hrmhrm.js");
const DB = await imp("economy/dev-bank.js");
const VD = await imp("economy/village-demand.js");
const CV = await imp("data/convert-data.js");
const PL = await imp("economy/price-level.js");
const W = globalThis.__stubWorld;
const VERBOSE = process.env.VERBOSE === "1";

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
let seq = 0;
const mkPlayer = (name) => { const m = new Map([["acc_emeralds", 0]]); return { id: "sim" + ++seq, name, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => (v === undefined ? m.delete(k) : m.set(k, v)) }; };
const cat = { hasCatalyst: () => true, consumeCatalyst: () => true };
let X = 100000;
const mkVillage = (pop) => {
  const owner = mkPlayer("owner" + seq);
  const v = C.registerCore(owner, { kind: "village", dimId: "overworld", x: (X += 300), y: 64, z: 0, typeId: "minecraft:bell", states: {} }, cat).core;
  C.recordPopulation(C.loadCore(v.id), { adults: pop, babies: 0 });
  return v;
};
const processable = CV.VILLAGE_SHIP_ITEMS; // 出荷される品(それ以外は村の中で消費される)
const fmt = (n) => Math.round(n).toLocaleString("en-US");

H.ensureHrmhrmAccount();
H.runHrmhrmWeekly(); // 追いつく(初期の口座の処理済みの週を揃える)

// 1つの村を weeks 週回す。deliverShare = 受けられる枠のうち、毎日実際に埋める割合(1 = 全部)
function simulate({ pop, nPlayers, weeks, deliverShare = 1 }) {
  W.day = Math.ceil(W.day / 7) * 7; // 週の頭から
  const v = mkVillage(pop);
  const ps = Array.from({ length: nPlayers }, (_, i) => mkPlayer("p" + i + "_" + v.id));
  const rows = [];
  const byItem = {};
  const g0 = DB.getDevBankState().grantedTotal;
  let paidTotal = 0, shipTotal = 0, listedValue = 0, boughtUnits = 0, consumedUnits = 0, cashOutWeeks = 0, minCash = Infinity, firstOut = null;
  for (let w = 0; w < weeks; w++) {
    let paid = 0, units = 0;
    for (let d = 0; d < 7; d++) {
      for (const p of ps) {
        const core = C.loadCore(v.id);
        for (const s of VD.getVillageSlots(core, W.day, p.name, p.id)) {
          const want = Math.floor(s.left * deliverShare);
          const q = Math.min(want, VD.maxOrderQty(C.loadCore(v.id), s));
          if (q < 1) continue;
          const cl = VD.claimVillageOrder(p, v.id, s.itemId, q, W.day);
          if (!cl.ok) continue;
          const done = VD.completeVillageOrder(v.id, cl.key, p.name, p.id);
          if (!done.ok) { fail("納品の確定に失敗: " + JSON.stringify(done)); continue; }
          paid += done.paid; units += done.qty;
          byItem[s.itemId] = (byItem[s.itemId] ?? 0) + done.qty;
        }
      }
      W.day += 1;
    }
    const g = DB.getDevBankState().grantedTotal;
    H.runHrmhrmWeekly();
    const acct = A.getEntityAccount(v.id);
    const core = C.loadCore(v.id);
    const ship = core.lastShip?.cash ?? 0;
    const consumed = Object.entries(core.lastShip?.consumed ?? {}).reduce((s, [, n]) => s + n, 0);
    const grantedNow = DB.getDevBankState().grantedTotal - g;
    listedValue += Object.entries(core.lastShip?.shipped ?? {}).reduce((a, [id, n]) => a + n * EXS.entityListingPrice(id, 0.8), 0); // 出品に回した今週の出荷を、出品の単価で数えた額(全部売れた場合の売上)
    paidTotal += paid; shipTotal += ship; boughtUnits += units; consumedUnits += consumed;
    if (acct.cash < 0) fail(`現金がマイナスになった(week ${w}): ${acct.cash}`);
    minCash = Math.min(minCash, acct.cash);
    if (acct.cash < 1) { cashOutWeeks++; firstOut ??= w; }
    rows.push({ w, paid, ship, grant: grantedNow, cash: acct.cash, units, consumed });
  }
  const grants = DB.getDevBankState().grantedTotal - g0;
  return { v, rows, byItem, paidTotal, shipTotal, listedValue, grants, boughtUnits, consumedUnits, cashOutWeeks, firstOut, minCash };
}

const scenarios = [
  { name: "小さな村(人口5)× 1人", pop: 5, nPlayers: 1 },
  { name: "ふつうの村(人口20)× 1人", pop: 20, nPlayers: 1 },
  { name: "ふつうの村(人口20)× 3人", pop: 20, nPlayers: 3 },
  { name: "大きな村(人口60)× 3人", pop: 60, nPlayers: 3 },
  { name: "ふつうの村(人口20)× 3人(枠の半分だけ)", pop: 20, nPlayers: 3, deliverShare: 0.5 }
];
const WEEKS = 12;
const level = PL.getPriceLevel();
console.log(`# 村の収支検算(${WEEKS}週。掛率 x${level.toFixed(2)}。金額は名目のE。village_buy_ratio 1.0 / village_ship_ratio 0.8 / convert_loss 0.8)`);
const results = [];
for (const sc of scenarios) {
  const r = simulate({ ...sc, weeks: WEEKS });
  results.push({ sc, r });
  const ratio = r.paidTotal > 0 ? r.shipTotal / r.paidTotal : 0;
  function ratio2(x) { return x.paidTotal > 0 ? x.listedValue / x.paidTotal : 0; }
  const procUnits = Object.entries(r.byItem).filter(([id]) => processable.has(id)).reduce((s, [, n]) => s + n, 0);
  console.log(`\n## ${sc.name}`);
  console.log(`納品の代金 ${fmt(r.paidTotal)}E / 出荷の売上 ${fmt(r.shipTotal)}E(戻り ${(ratio * 100).toFixed(1)}%) / 取引所への出品額 ${fmt(r.listedValue)}E(戻り ${(ratio2(r) * 100).toFixed(1)}%。全部売れた場合) / 開発銀行の支給 ${fmt(r.grants)}E / 最低の現金 ${fmt(r.minCash)}E`);
  console.log(`納品した数 ${r.boughtUnits}個(出荷する品 ${procUnits}個 = ${(r.boughtUnits ? (procUnits / r.boughtUnits) * 100 : 0).toFixed(0)}%)/ 現金が尽きた週 ${r.cashOutWeeks}/${WEEKS}` + (r.firstOut !== null ? `(最初は ${r.firstOut} 週目)` : ""));
  const top = Object.entries(r.byItem).sort((a, b) => b[1] - a[1]);
  console.log("品目の偏り(上位3): " + top.slice(0, 3).map(([id, n]) => `${id.replace("minecraft:", "")} ${((n / r.boughtUnits) * 100).toFixed(0)}%`).join(", ") + ` / 品目数 ${top.length}`);
  if (VERBOSE) for (const row of r.rows) console.log(`  w${String(row.w).padStart(2)} 代金 ${fmt(row.paid).padStart(9)} 出荷 ${fmt(row.ship).padStart(8)} 支給 ${fmt(row.grant).padStart(9)} 現金 ${fmt(row.cash).padStart(10)} 納品 ${row.units}個 消費 ${row.consumed}個`);
}

// ---- 検査(固定の不変条件。収支の良し悪しは出力を見て判断する) ----
for (const { sc, r } of results) {
  if (r.shipTotal > r.paidTotal * 0.8 + 1) fail(`${sc.name}: 出荷の売上が代金×出荷率(0.8)を超えている(0.8×0.8以下のはず)`);
  if (r.grants < 0) fail(`${sc.name}: 支給が負`);
  if (r.boughtUnits < 1) fail(`${sc.name}: 1つも納品されない(資金が最初から0のまま動かないか、枠が出ない)`);
}
console.log(errors ? "\n" + errors + " failure(s)" : "\nOK");
process.exit(errors ? 1 : 0);
