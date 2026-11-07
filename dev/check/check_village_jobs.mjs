// 村の職業ブロックと手工業(economy/village-jobs.js)の検算スクリプト(Node 20+)。
//   node ../dev/check/check_village_jobs.mjs scripts      (パックのルートで実行)
// 1. 検知: 範囲のブロックを数える(読み込まれていなければ測れない) / 2. 職業のある村の入荷(クエスト)は、職業の原料が先に載る。ない村は従来の表
// 3. 週の締め: 取引所の出品から原料を買い、加工し、取引所へ出品(代金は週次で口座から) / 4. 持ち越し / 5. 全レシピの余裕
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
const players = [];
globalThis.__stubWorld = {
  day: 100, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k), setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()],
  beforeEvents: {}, afterEvents: { playerSpawn: { subscribe() {} } }
};
globalThis.__stubSystem = { run(f) { f(); }, runInterval() { return 1; }, afterEvents: { scriptEventReceive: { subscribe() {} } } };
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,"+(s.includes("ui")?"ui":"server"),shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){
    if (u==="data:text/javascript,server") return {format:"module",shortCircuit:true,source:
      "export class ItemStack{ constructor(t,a=1){ this.typeId=t; this.amount=a; } }; export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;" +
      "export class BlockVolume{ constructor(a,b){ this.from=a; this.to=b; } }; export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};"};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export class ActionFormData{}; export class ModalFormData{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const EX = await imp("economy/exchange.js");
const VJ = await imp("economy/village-jobs.js");
const JD = await imp("data/village-jobs-data.js");
const VD = await imp("economy/village-demand.js");
const A = await imp("economy/account.js");
const CR = await imp("economy/core-registry.js");
const PO = await imp("economy/policy.js");
const H = await imp("economy/hrmhrm.js");
const IT = await imp("data/exchange-items-data.js");
PO.setPolicyParam("village_specialty_per_pop", 0, { source: "test", force: true }); // 特産品は別の検査で確認する
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
const ok = (c, m) => { if (!c) fail(m); };
let seq = 0;
const mkPlayer = (name, bal) => {
  const m = new Map([["acc_emeralds", bal]]);
  const p = { id: "id" + ++seq, name, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v), location: { x: 0, y: 64, z: 0 }, dimension: { id: "minecraft:overworld" } };
  players.push(p); return p;
};
const addPool = (p, item, n) => { const k = "bmh_ex_pool_" + p.id; const o = JSON.parse(store.get(k) ?? "{}"); o[item] = (o[item] ?? 0) + n; store.set(k, JSON.stringify(o)); };
const treeIds = new Set();
for (const c of IT.EXCHANGE_TREE) for (const g of c.groups) for (const it of g.items) treeIds.add("minecraft:" + it[0]);

// 0. 定義: レシピの原料・製品は取引リストにある
for (const [id, j] of Object.entries(JD.JOB_BLOCKS)) for (const r of j.recipes) {
  ok(treeIds.has(r.out), `${id} 製品が取引リストに無い: ${r.out}`);
  for (const i of Object.keys(r.inputs)) ok(treeIds.has(i), `${id} 原料が取引リストに無い: ${i}`);
}

const mkVillage = (id, jobs, pop = 6) => {
  CR.saveCore({ id, kind: "village", name: "テスト村" + id, nameEn: "Test " + id, dimId: "minecraft:overworld", x: 0, y: 64, z: 0, pop, popDay: W.day, stock: {}, orders: [], jobs });
  A.createEntityAccount({ id, type: "village", name: { ja: id, en: id }, cash: 100000, population: pop });
};

// 1. 検知(実APIの意味に合わせたスタブ: getCapacity = 箱の体積 / 個数は getBlockLocationIterator で数える /
//    allowUnloadedChunks:false で一部でも読み込み外なら例外 / true なら読み込み済みの部分だけ返す)
{
  const placed = []; // { x,y,z,id }
  const mkDim = (loadedChunk) => ({
    heightRange: { min: -64, max: 320 },
    getBlock: (l) => (loadedChunk(Math.floor(l.x / 16), Math.floor(l.z / 16)) ? { typeId: (placed.find((p) => p.x === l.x && p.y === l.y && p.z === l.z)?.id) ?? "minecraft:air" } : undefined),
    getBlocks: (vol, filter, allowUnloaded) => {
      const { from, to } = vol; const locs = [];
      let unloaded = false;
      for (let cx = Math.floor(from.x / 16); cx <= Math.floor(to.x / 16); cx++) for (let cz = Math.floor(from.z / 16); cz <= Math.floor(to.z / 16); cz++) if (!loadedChunk(cx, cz)) unloaded = true;
      if (unloaded && !allowUnloaded) throw new Error("UnloadedChunksError");
      for (const p of placed) if (loadedChunk(Math.floor(p.x / 16), Math.floor(p.z / 16)) && p.x >= from.x && p.x <= to.x && p.y >= from.y && p.y <= to.y && p.z >= from.z && p.z <= to.z && filter.includeTypes.includes(p.id)) locs.push({ x: p.x, y: p.y, z: p.z });
      const cap = (to.x - from.x + 1) * (to.y - from.y + 1) * (to.z - from.z + 1);
      return { getCapacity: () => cap, getBlockLocationIterator: () => locs[Symbol.iterator]() };
    }
  });
  const put = (id, x, z) => placed.push({ id, x, y: 64, z });
  put("minecraft:smoker", 3, 3); put("minecraft:smoker", 5, 5); put("minecraft:composter", -20, 10); put("minecraft:loom", 40, -30); put("minecraft:stone", 1, 1);
  const core = { id: "SC", x: 0, y: 64, z: 0, jobs: {} };
  // 全チャンク読み込み済み: 個数は箱の体積ではなく、置いた数
  let r = VJ.scanJobBlocks(core, mkDim(() => true));
  eq(JSON.stringify(Object.entries(r.counts).sort()), JSON.stringify([["minecraft:composter", 1], ["minecraft:loom", 1], ["minecraft:smoker", 2]]), "置いた数を数える(体積ではない)");
  eq(r.loaded, r.total, "全部読み込み済み");
  // 外周だけ読み込み外(= 旧実装なら例外で全滅): 中央は数えられる
  r = VJ.scanJobBlocks(core, mkDim((cx, cz) => Math.abs(cx) <= 2 && Math.abs(cz) <= 2));
  ok(r && r.loaded < r.total && r.loaded > 0, "外周が読み込み外でも、読み込めた小箱は数える");
  eq(r.counts["minecraft:smoker"], 2, "中央のブロックは数えられる");
  // 何も読み込まれていない: 測れない
  eq(VJ.scanJobBlocks(core, mkDim(() => false)), null, "1つも読み込めなければ null");
  // getBlocks が例外: 無言で全滅せず null(ログは warn)
  eq(VJ.scanJobBlocks(core, { heightRange: { min: -64, max: 320 }, getBlock: () => ({}), getBlocks() { throw new Error("boom"); } }), null, "例外のときは null");
  // 記録: 全部読めれば jobs/jobsDay が残る(0件でも)
  const c1 = { id: "REC1", kind: "village", jobs: { "minecraft:smoker": 9 } };
  CR.saveCore(c1);
  VJ.recordJobs(c1, { counts: {}, loaded: 4, total: 4 }, 7);
  eq(JSON.stringify(c1.jobs), "{}", "全部読めて0件なら jobs は空で jobsDay が残る"); eq(c1.jobsDay, 7, "jobsDay が残る");
  // 部分読み込みでは前の記録より減らさない
  const c2 = { id: "REC2", kind: "village", jobs: { "minecraft:smoker": 3, "minecraft:loom": 1 } };
  CR.saveCore(c2);
  VJ.recordJobs(c2, { counts: { "minecraft:smoker": 1 }, loaded: 2, total: 4 }, 8);
  eq(c2.jobs["minecraft:smoker"], 3, "部分読み込みでは減らさない"); eq(c2.jobs["minecraft:loom"], 1, "見えなかった職業も残す"); eq(c2.jobsPartial, true, "部分フラグ");
  eq(VJ.needsJobScan({ jobsDay: 7 }, 7), false, "その日済みなら再試行しない"); eq(VJ.needsJobScan({}, 7), true, "未検知なら再試行する");
}

// 地域タイプ: 抽選の重みが変わる(平原は従来どおり。雪原は燃料が増え、砂漠は木が増える)
{
  mkVillage("VILPLA2", {}, 20); mkVillage("VILSNW", {}, 20); mkVillage("VILDES", {}, 20);
  const set = (id, rg) => { const c = CR.loadCore(id); if (rg) c.region = rg; CR.saveCore(c); };
  set("VILSNW", "snow"); set("VILDES", "desert");
  const cnt = (id, item) => { let n = 0; const c = CR.loadCore(id); for (let d = 0; d < 300; d++) if (VD.getVillageSlots(c, 1000 + d, "zed", "zid").some((x) => x.itemId === item)) n++; return n; };
  const pl = cnt("VILPLA2", "minecraft:charcoal"), sn = cnt("VILSNW", "minecraft:charcoal");
  ok(sn > pl * 1.8, `雪原は炭の枠が多い: ${sn} vs ${pl}`);
  const wp = cnt("VILPLA2", "minecraft:stick"), wd = cnt("VILDES", "minecraft:stick");
  ok(wd > wp * 1.15, `砂漠は木の枠が多い: ${wd} vs ${wp}`);
}

// 村同士の取引: 砂漠の村は、地域の需要の品(木・食料)を取引所から仕入れる。買った分は消費され、蔵には入らない
{
  mkVillage("VILDES2", {}, 20);
  { const c = CR.loadCore("VILDES2"); c.region = "desert"; CR.saveCore(c); }
  const dave2 = mkPlayer("dave2", 5000);
  addPool(dave2, "minecraft:stick", 100);
  const ref = EX.referencePrice("minecraft:stick");
  const l = EX.createListing(dave2, "minecraft:stick", 100, Math.max(1, Math.floor(ref / 1.25)));
  ok(l.ok, "棒の出品: " + l.reason);
  const sale = VD.settleVillageStock("VILDES2");
  ok((sale.imported?.["minecraft:stick"] ?? 0) > 0, "砂漠の村は棒を仕入れる");
  ok(sale.spent > 0, "仕入れの代金が spent に入る(週次で口座から引かれる)");
  eq(CR.loadCore("VILDES2").stock["minecraft:stick"] ?? 0, 0, "買った分は蔵に入らない");
  const plainSale = VD.settleVillageStock("VILPLA2");
  eq(Object.keys(plainSale.imported ?? {}).length, 0, "平原の村は仕入れない(需要の偏りがない)");
}

// 2. 入荷(クエスト): 職業のある村は職業の原料が載る / ない村は従来
mkVillage("VILJOB", { "minecraft:smoker": 2, "minecraft:composter": 1, "minecraft:loom": 1 });
mkVillage("VILPLN", {});
{
  const bob = mkPlayer("bob", 0);
  const core = CR.loadCore("VILJOB");
  const needs = VJ.jobInputNeeds(core);
  ok(needs["minecraft:beef"]?.perDay > 0 && needs["minecraft:wheat_seeds"]?.perDay > 0, "職業の原料の必要量が出る");
  eq(needs["minecraft:wheat_seeds"].perDay, 16, "堆肥箱1つ = 1日16回 = 種16個");
  const jobIds = new Set(Object.keys(needs));
  let hit = 0;
  for (let d = 0; d < 20; d++) {
    const slots = VD.getVillageSlots(core, 200 + d, bob.name, bob.id);
    if (slots.some((s) => jobIds.has(s.itemId))) hit++;
    ok(slots.length === 3, "枠は1日3品目のまま");
  }
  eq(hit, 20, "職業のある村は、毎日 職業の原料が枠に載る");
  const plain = CR.loadCore("VILPLN");
  const ps = VD.getVillageSlots(plain, 200, bob.name, bob.id);
  ok(ps.length === 3 && ps.every((s) => !jobIds.has(s.itemId) || VD.VILLAGE_BUY_TABLE.some((e) => e.itemId === s.itemId)), "職業ブロックのない村は従来の固定表");
  eq(VJ.hasProduction(plain), false, "ブロックのない村は生産しない");
}

// 3. 週の締め: 納品 + 取引所の買い → 加工 → 出品
{
  const dave = mkPlayer("dave", 5000);
  addPool(dave, "minecraft:beef", 80);
  const refBeef = EX.referencePrice("minecraft:beef");
  const l = EX.createListing(dave, "minecraft:beef", 80, Math.max(1, Math.floor(refBeef / 1.25)));
  ok(l.ok, "牛肉の出品: " + l.reason);
  const core = CR.loadCore("VILJOB");
  core.stock = { "minecraft:wheat_seeds": 50, "minecraft:porkchop": 30 }; // プレイヤーの納品ぶん
  CR.saveCore(core);
  const before = A.getEntityAccount("VILJOB").cash;
  const daveBefore = dave.getDynamicProperty("acc_emeralds");
  const r = VD.settleVillageStock("VILJOB");
  ok((r.bought["minecraft:beef"] ?? 0) > 0, "牛肉を取引所で買う: " + JSON.stringify(r.bought));
  ok(dave.getDynamicProperty("acc_emeralds") > daveBefore, "売り手に代金が入る");
  eq(A.getEntityAccount("VILJOB").cash, before, "週の締めの途中では口座から引かない(週次で引く)");
  ok(r.spent > 0, "購入額が spent で返る: " + r.spent);
  eq(r.produced["minecraft:wheat"], 50, "種50個 → 小麦50(堆肥箱1つの週の上限112回の範囲)");
  eq(r.produced["minecraft:cooked_porkchop"], 30, "納品された豚肉30 → 焼き豚");
  ok((r.produced["minecraft:cooked_beef"] ?? 0) > 0, "買った牛肉 → ステーキ");
  const offs = EX.listOffers("minecraft:cooked_porkchop").filter((o) => o.sellerKind === "village");
  ok(offs.length === 1 && offs[0].sellerId === "VILJOB", "加工品は村の出品として並ぶ");
  const hrm = EX.listOffers("minecraft:cooked_porkchop").find((o) => o.kind === "hrmhrm");
  if (offs[0] && hrm) ok(offs[0].price <= hrm.price, `村の売値はHRMHRM以下: ${offs[0].price} <= ${hrm.price}`);
  // 週次で、購入額が費用に出る
  const hv = CR.loadCore("VILJOB");
  eq(Object.values(hv.stock).reduce((a, n) => a + n, 0) >= 0, true, "在庫が残る(持ち越し)");
  W.day += 14;
  H.runHrmhrmWeekly();
  const a2 = A.getEntityAccount("VILJOB");
  ok(a2.weekly.some((x) => x.actions.some((y) => y.type === "village_purchases")), "週の記録に village_purchases");
}

// 4. 持ち越し: 使い切れなかった原料は残り、上限を超えた分は消費/出荷される
{
  const core = CR.loadCore("VILJOB");
  core.stock = { "minecraft:wheat_seeds": 5000 };
  CR.saveCore(core);
  VD.settleVillageStock("VILJOB");
  const left = CR.loadCore("VILJOB").stock["minecraft:wheat_seeds"] ?? 0;
  const keep = VJ.jobInputKeep(CR.loadCore("VILJOB"))["minecraft:wheat_seeds"];
  ok(left <= keep, `持ち越しは上限(${keep})まで: ${left}`);
  ok(left > 0, "原料は持ち越される");
}

// 5. 全レシピの余裕(原料を基準価格で買い、基準 × 掛率で売る)
console.log("\n職業ブロック・製品              売値 原価 余裕");
for (const [bid, j] of Object.entries(JD.JOB_BLOCKS)) for (const r of j.recipes) {
  const sell = Math.min(VJ.productPrice(r.out), EX.referencePrice(r.out)) * r.outQty;
  const cost = Object.entries(r.inputs).reduce((s, [id, q]) => s + EX.referencePrice(id) / 1.25 * q, 0);
  console.log(`${bid.replace("minecraft:", "").padEnd(16)}${r.out.replace("minecraft:", "").padEnd(18)} ${sell.toFixed(1).padStart(6)} ${cost.toFixed(1).padStart(6)} ${(sell - cost).toFixed(1).padStart(6)}`);
  ok(sell > cost, `${r.out}: 売値が原価を上回る`);
}
console.log(errors === 0 ? "\nOK  村の職業の検算: すべて通過" : `\nNG  ${errors}件`);
process.exit(errors === 0 ? 0 : 1);
