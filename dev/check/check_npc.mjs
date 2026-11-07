// NPC会社(economy/npc-company.js)と、取引所の価格順・口座の買いの検算スクリプト(Node 20+)。
//   node ../dev/check/check_npc.mjs scripts      (パックのルートで実行)
// 1. 価格順: 同じ値段なら プレイヤー → NPC → HRMHRM → システム。システム出品は、HRMHRMがある品ではHRMHRM以上
// 2. NPC会社の開業(口座の種別 npc・開発銀行の支給・仮想コア)
// 3. 原料がない日 → 会社クエストの依頼が出る / 納品 → 在庫 → 加工 → 出品(HRMHRMより安い)
// 4. 取引所に原料の出品があれば、そこから買う(売り手に代金が入る)
// 5. 冬眠(npc_company_enabled=0)では動かない / 全レシピの原価と売値の余裕
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
      "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};"};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export class ActionFormData{}; export class ModalFormData{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const EX = await imp("economy/exchange.js");
const NPC = await imp("economy/npc-company.js");
const ND = await imp("data/npc-company-data.js");
const A = await imp("economy/account.js");
const PO = await imp("economy/policy.js");
const VD = await imp("economy/village-demand.js");
const CR = await imp("economy/core-registry.js");
const PL = await imp("economy/price-level.js");
const H = await imp("economy/hrmhrm.js");
const DB = await imp("economy/dev-bank.js");
const IT = await imp("data/exchange-items-data.js");
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
const bal = (p) => p.getDynamicProperty("acc_emeralds");
const addPool = (p, item, n) => { const k = "bmh_ex_pool_" + p.id; const o = JSON.parse(store.get(k) ?? "{}"); o[item] = (o[item] ?? 0) + n; store.set(k, JSON.stringify(o)); };

// --- 0. 定義の検査: 原料・製品はすべて取引リストにある
const treeIds = new Set();
for (const c of IT.EXCHANGE_TREE) for (const g of c.groups) for (const it of g.items) treeIds.add("minecraft:" + it[0]);
for (const d of ND.NPC_COMPANIES) for (const r of d.recipes) {
  ok(treeIds.has(r.out), `${d.id} 製品が取引リストに無い: ${r.out}`);
  for (const id of Object.keys(r.inputs)) ok(treeIds.has(id), `${d.id} 原料が取引リストに無い: ${id}`);
}
eq(ND.NPC_COMPANIES.length, 5, "NPC会社は5社(MCD・CLT・PPL・EKB・WCC)");

// --- 1. 価格順
{
  const items = [...EX.standingItems().keys()].filter((id) => EX.marketInfo(id));
  ok(items.length > 0, "相場と常設出品の両方がある品がある");
  let bad = 0;
  for (const id of items) {
    const offs = EX.listOffers(id);
    const h = offs.find((o) => o.kind === "hrmhrm"); const m = offs.find((o) => o.kind === "market");
    if (h && m && m.price < h.price) bad++;
    const hi = offs.findIndex((o) => o.kind === "hrmhrm"); const mi = offs.findIndex((o) => o.kind === "market");
    if (h && m && mi < hi) bad++;
  }
  eq(bad, 0, "システム出品は、HRMHRMがある品でHRMHRMより安く・先に並ばない");
  eq(EX.offerTier({ kind: "player", sellerKind: "village" }) < EX.offerTier({ kind: "player", sellerKind: "npc" }), true, "プレイヤー(村・会社) < NPC");
  eq(EX.offerTier({ kind: "player", sellerKind: "npc" }) < EX.offerTier({ kind: "hrmhrm" }), true, "NPC < HRMHRM");
  eq(EX.offerTier({ kind: "hrmhrm" }) < EX.offerTier({ kind: "market" }), true, "HRMHRM < システム");
  // 同額のとき: プレイヤー → NPC → HRMHRM
  const WHEAT = "minecraft:wheat";
  const alice = mkPlayer("alice", 0);
  const ref = EX.referencePrice(WHEAT);
  addPool(alice, WHEAT, 10); alice.setDynamicProperty("acc_emeralds", 1000);
  const r = EX.createListing(alice, WHEAT, 10, ref);
  ok(r.ok, "プレイヤーの出品: " + r.reason);
  const offs = EX.listOffers(WHEAT);
  eq(offs[0].kind + ":" + (offs[0].sellerKind ?? ""), "player:", "同額ならプレイヤーが先頭(HRMHRMより前)");
  eq(offs[1].kind, "hrmhrm", "次がHRMHRM");
  EX.cancelListing(alice, WHEAT, r.id);
}

// --- 2. 開業
for (const d of ND.NPC_COMPANIES) NPC.ensureNpc(d);
const MCD = ND.NPC_COMPANIES[0];
{
  const a = A.getEntityAccount(MCD.id);
  eq(a?.type, "npc", "口座の種別は npc");
  const start = PL.scaleE(PO.getPolicyParam("npc_startup_base"));
  eq(Math.round(a.cash), Math.round(start), "開業の資金が出ている(開発銀行から)");
  ok(DB.getDevBankState().grantedTotal >= start * 5 - 5, "開発銀行の支給の累計に積まれる");
  const core = CR.loadCore(MCD.id);
  ok(core?.npc === true && core.kind === "company", "仮想コアがある");
  eq(CR.listCores("company").length, 0, "仮想コアは、位置の索引(listCores)には入らない");
}

// --- 3. 原料がない日: 依頼が出る → 納品 → 加工 → 出品
const bob = mkPlayer("bob", 0);
const day1 = NPC.runNpcDay(MCD);
eq(Object.keys(day1.produced).length, 0, "原料が無ければ作れない");
ok(Object.keys(day1.want).length > 0, "足りない原料が、会社クエストの依頼になる");
{
  const board = VD.getVillageBoard(bob, W.day, "company");
  const npc = board.find((b) => b.core.id === MCD.id);
  ok(!!npc, "会社の掲示板にNPC会社が載る(位置に関係なく)");
  const slot = npc.slots.find((s) => s.itemId === "minecraft:wheat");
  ok(slot && slot.left > 0 && slot.unit > 0, "小麦の枠がある");
  const cap = VD.maxOrderQty(npc.core, slot);
  ok(cap > 0, "資金があるので受注できる: " + cap);
  const qty = Math.min(cap, 60);
  const r = VD.claimVillageOrder(bob, MCD.id, "minecraft:wheat", qty, W.day);
  ok(r.ok, "受注: " + r.reason);
  const done = VD.completeVillageOrder(MCD.id, r.key, bob.name, bob.id);
  ok(done.ok && done.paid > 0, "納品で、NPC会社の口座から代金が出る");
  eq(CR.loadCore(MCD.id).stock["minecraft:wheat"], qty, "納品された原料は、会社の在庫に入る");
}
W.day += 1;
const day2 = NPC.runNpcDay(MCD);
ok((day2.produced["minecraft:bread"] ?? 0) > 0, "納品された小麦でパンを作る: " + JSON.stringify(day2.produced));
{
  const offs = EX.listOffers("minecraft:bread");
  const mine = offs.find((o) => o.sellerKind === "npc");
  const hrm = offs.find((o) => o.kind === "hrmhrm");
  ok(!!mine, "パンがNPC会社の出品として並ぶ");
  eq(mine.sellerId, MCD.id, "出品者はNPC会社");
  if (mine && hrm) ok(mine.price < hrm.price, `NPCの売値はHRMHRMより安い: ${mine.price} < ${hrm.price}`);
  if (mine && hrm) eq(offs.indexOf(mine) < offs.indexOf(hrm), true, "NPCがHRMHRMより前に並ぶ");
  // 買う → 代金がNPCの口座へ入る
  const carol = mkPlayer("carol", 10000);
  const cashBefore = A.getEntityAccount(MCD.id).cash;
  const rb = EX.buy(carol, "minecraft:bread", 5);
  ok(rb.ok, "パンを買える: " + rb.reason);
  ok(A.getEntityAccount(MCD.id).cash > cashBefore, "売れた代金がNPC会社の口座へ入る");
  ok((A.getEntityAccount(MCD.id).exchangeRevenue ?? 0) > 0, "週の収益に積まれる(exchangeRevenue)");
}

// --- 4. 取引所に原料があれば、そこから買う
{
  const dave = mkPlayer("dave", 1000);
  addPool(dave, "minecraft:beef", 40);
  const refBeef = EX.referencePrice("minecraft:beef");
  const cap = Math.max(1, Math.floor(refBeef / 1.25));
  const l = EX.createListing(dave, "minecraft:beef", 40, cap);
  ok(l.ok, "牛肉を出品: " + l.reason);
  const before = bal(dave);
  W.day += 1;
  const r = NPC.runNpcDay(MCD);
  ok((r.bought["minecraft:beef"] ?? 0) > 0, "出品の牛肉を、NPC会社が買う: " + JSON.stringify(r.bought));
  ok(bal(dave) > before, "売り手(プレイヤー)に代金が入る");
  ok((r.produced["minecraft:cooked_beef"] ?? 0) > 0, "焼いたステーキを作る");
  // 自分の出品は買わない
  const own = EX.buyForEntity({ entityId: MCD.id, itemId: "minecraft:bread", qty: 3, maxUnitPrice: 1e9 });
  eq(own.qty, 0, "自分の出品は買わない");
}

// --- 5. 週次: 買った代金は費用に数える
{
  const acct = A.getEntityAccount(MCD.id);
  ok((acct.exchangeExpense ?? 0) > 0, "取引所で買った代金が積まれている");
  W.day += 7 * 2;
  const nw = H.runHrmhrmWeekly();
  ok(nw > 0, "週次が走る: " + nw);
  const a2 = A.getEntityAccount(MCD.id);
  const last = a2.weekly.find((r) => r.actions.some((x) => x.type === "exchange_purchases"));
  ok(!!last, "週の記録に exchange_purchases が入る");
  ok(last && last.expense > 0 && last.revenue > 0, `週の記録: 収益 ${Math.round(last?.revenue ?? 0)} / 費用 ${Math.round(last?.expense ?? 0)}`);
  eq(A.getEntityAccount(MCD.id).exchangeExpense, 0, "週の締めで0に戻る");
}

// --- 5b. HRMHRMの仕入れ: 常設の在庫が足りない品を、取引所の出品から(上限単価まで)買う
{
  H.ensureHrmhrmAccount();
  const WHEAT = "minecraft:wheat";
  const standing = EX.standingItems().get(WHEAT);
  store.set("bmh_ex_hstock", JSON.stringify({ ...JSON.parse(store.get("bmh_ex_hstock") ?? "{}"), [WHEAT]: standing - 100 }));
  const erin = mkPlayer("erin", 1000);
  addPool(erin, WHEAT, 200);
  const base = Math.floor(EX.referencePrice(WHEAT) / 1.25);
  const cheap = Math.max(1, Math.floor(base * 0.5));
  const l1 = EX.createListing(erin, WHEAT, 60, cheap);
  const l2 = EX.createListing(erin, WHEAT, 60, EX.referencePrice(WHEAT)); // 上限を超える値段
  ok(l1.ok && l2.ok, "出品: " + (l1.reason ?? l2.reason));
  const hcash = A.getEntityAccount("hrmhrm").cash;
  const eb = bal(erin);
  const bought = EX.restockHrmhrm();
  eq(bought[WHEAT], 60, "安い出品60個だけ買う(上限を超える出品は買わない)");
  eq(EX.getHrmhrmStock(WHEAT), standing - 100 + 60, "HRMHRMの常設在庫に入る");
  ok(bal(erin) - eb === 60 * cheap, "売り手に代金が入る");
  eq(A.getEntityAccount("hrmhrm").cash, hcash - 60 * cheap, "HRMHRMの口座から出る");
  ok((A.getEntityAccount("hrmhrm").exchangeExpense ?? 0) >= 60 * cheap, "週の費用に積まれる");
  PO.setPolicyParam("hrmhrm_buy_budget_ratio", 0, { source: "test", force: true });
  eq(Object.keys(EX.restockHrmhrm()).length, 0, "予算の割合が0なら買わない");
  PO.resetPolicyParam("hrmhrm_buy_budget_ratio");
}

// --- 6. 冬眠
{
  PO.setPolicyParam("npc_company_enabled", 0, { source: "test", force: true });
  store.delete("bmh_npc_day");
  const before = JSON.stringify(CR.loadCore(MCD.id).stock);
  W.day += 1;
  NPC.npcDaily(W.day);
  eq(JSON.stringify(CR.loadCore(MCD.id).stock), before, "冬眠中は何も動かない");
  PO.setPolicyParam("npc_company_enabled", 1, { source: "test", force: true });
}

// --- 7. 全レシピの余裕(原価=原料の買い上限で見積もった額 と 売値)
console.log("\n製品                      売値  原価(上限見積)  余裕");
for (const d of ND.NPC_COMPANIES) for (const r of d.recipes) {
  const price = NPC.npcListPrice(r.out); const cost = NPC.recipeUnitCost(r); const hrm = EX.referencePrice(r.out);
  const nm = r.out.replace("minecraft:", "");
  console.log(`${d.id} ${nm.padEnd(18)} ${String(price).padStart(5)} ${cost.toFixed(1).padStart(10)}  ${(price - cost).toFixed(1).padStart(7)}  (HRMHRM ${hrm})`);
  ok(price < hrm || hrm === 1, `${nm}: NPCの売値がHRMHRMより安い`);
}
console.log(errors === 0 ? "\nOK  NPC会社の検算: すべて通過" : `\nNG  ${errors}件`);
process.exit(errors === 0 ? 0 : 1);
