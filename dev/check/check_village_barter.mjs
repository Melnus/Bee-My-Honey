// 品目名の一本化・外部アドオンの品目の検算スクリプト(Node 20+)。
//   node ../dev/check/check_village_barter.mjs scripts      (パックのルートで実行)
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
    if (u==="data:text/javascript,server") return {format:"module",shortCircuit:true,source:\`
      export class ItemStack{ constructor(t,a=1){ this.typeId=t; this.amount=a; this._ench=[]; this._potion=null; this.nameTag=undefined; this.lore=[]; this.damage=0; }
        get maxAmount(){ return this.typeId.includes("potion") || this.typeId==="minecraft:enchanted_book" ? 1 : 64; }
        getLore(){ return this.lore; }
        getComponent(id){
          if (id==="minecraft:enchantable") return { getEnchantments:()=>this._ench, addEnchantment:(e)=>{ this._ench.push({type:e.type,level:e.level}); } };
          if (id==="minecraft:potion" && this._potion) return { potionEffectType:{id:"minecraft:"+this._potion} };
          if (id==="minecraft:durability") return { damage:this.damage };
          return undefined; } }
      export const ItemTypes = { getAll: () => (globalThis.__itemTypes ?? []).map((id) => ({ id })) };
      export const EnchantmentTypes = { get(id){ return id === "nope" ? undefined : { id }; } };
      export const Potions = { resolve(eff,del){ const t={Consume:"minecraft:potion",ThrownSplash:"minecraft:splash_potion",ThrownLingering:"minecraft:lingering_potion"}[del]; if(!t) throw new Error("bad delivery"); const s=new ItemStack(t,1); s._potion=eff.replace("minecraft:",""); return s; } };
      export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;
      export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};\`};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export class ActionFormData{}; export class ModalFormData{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);


const VB = await imp("economy/village-barter.js");
const VDm = await imp("economy/village-demand.js");
const PR = await imp("economy/village-pricing.js");
let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(m + ": " + a + " vs " + b); };
const day = 100;
const mk = () => ({ kind: "village", id: "VBART1", pop: 12, stock: { "minecraft:iron_ingot": 50, "minecraft:bread": 0.4 }, orders: [] });
const core = mk();
const slots = VDm.getVillageSlots(core, day, "bob", "b1");
if (!slots.length) fail("枠がある");
const slot = slots.find((s) => s.itemId !== "minecraft:iron_ingot") ?? slots[0];
const bag = { [slot.itemId]: 1000 }; const got = {};
const ops = { remove: (id, n) => { if ((bag[id] ?? 0) < n) return false; bag[id] -= n; return true; }, add: (id, n) => { got[id] = (got[id] ?? 0) + n; } };
const IRON = "minecraft:iron_ingot";
const q = VB.barterQuote(core, slot.itemId, slot.left, IRON);
const expect = Math.min(50, Math.floor(PR.getItemBasePriceExact(slot.itemId) * slot.left * 0.9 / PR.getItemBasePriceExact(IRON)));
if (expect >= 1) eq(q.n, expect, "受け取れる数は、価値×0.9÷基準価格"); else eq(q.ok, false, "少なすぎれば交換できない");
if (expect >= 1) {
  const r = VB.barterExecute(core, { id: "b1", name: "bob" }, slot.itemId, slot.left, IRON, ops, day);
  eq(r.ok, true, "交換できる"); eq(got[IRON], expect, "品が渡る"); eq(bag[slot.itemId], 1000 - slot.left, "手持ちから引く");
  eq(core.stock[IRON], 50 - expect, "蔵から減る"); eq(core.stock[slot.itemId], slot.left, "渡した品は蔵に入る");
  const after = VDm.getVillageSlots(core, day, "bob", "b1").find((s) => s.itemId === slot.itemId);
  eq(after.left, 0, "枠の受注済みに数えられる(二重に受けられない)");
  eq(core.orders.at(-1).reward, 0, "報酬0の納品済みの注文として残る");
  eq(VB.barterExecute(core, { id: "b1", name: "bob" }, slot.itemId, 1, IRON, ops, day).reason, "no_slot", "枠が埋まったら交換できない");
  const other = VDm.getVillageSlots(core, day, "carl", "c1");
  eq(other.find((s) => s.itemId === slot.itemId)?.taken ?? 0, 0, "ほかの人の枠は埋まらない");
}
const core2 = mk(); const bag2 = { [slot.itemId]: 1 };
eq(VB.barterExecute(core2, { id: "b1", name: "bob" }, slot.itemId, slot.left, IRON, { remove: (id, n) => (bag2[id] ?? 0) >= n, add() {} }, day).reason, "not_enough", "手持ちが足りなければ交換しない");
eq(core2.stock[IRON], 50, "失敗したら蔵は動かない"); eq(core2.orders.length, 0, "失敗したら注文も増えない");
eq(VB.barterQuote(core2, slot.itemId, 1, slot.itemId).reason, "same_item", "同じ品とは交換しない");
eq(VB.barterQuote(core2, slot.itemId, 1, "minecraft:diamond").reason, "no_stock", "蔵にない品とは交換しない");
eq(VB.barterStockItems(core2).length, 1, "在庫1個未満の品は出さない");
eq(VB.barterExecute(core2, { id: "b1", name: "bob" }, "minecraft:diamond", 1, IRON, ops, day).reason, "no_slot", "今日の欲しいものにない品は渡せない");
// 注文の上限: ORDERS_KEEP に達していたら交換しない(通常の受注と同じ)。古い完了済みは入口で片付く
{
  const c = mk(); const bag = { [slot.itemId]: 99 }; const o2 = { remove: (id, n) => { if ((bag[id] ?? 0) < n) return false; bag[id] -= n; return true; }, add(id, n) { bag[id] = (bag[id] ?? 0) + n; } };
  c.orders = Array.from({ length: VDm.ORDERS_KEEP }, (_, i) => ({ key: "k" + i, who: "z", whoId: "z", itemId: "minecraft:wheat", qty: 1, reward: 1, day, expiresWeek: Math.floor(day / 7) + 5, done: false }));
  eq(VB.barterExecute(c, { id: "b1", name: "bob" }, slot.itemId, slot.left, IRON, o2, day).reason, "full", "注文が上限なら交換しない");
  eq(bag[slot.itemId], 99, "上限で断ったら手持ちは動かない");
  const c2 = mk(); c2.orders = Array.from({ length: VDm.ORDERS_KEEP }, (_, i) => ({ key: "o" + i, who: "z", whoId: "z", itemId: "minecraft:wheat", qty: 1, reward: 0, day: day - 3, expiresWeek: 0, done: true }));
  eq(VB.barterExecute(c2, { id: "b1", name: "bob" }, slot.itemId, slot.left, IRON, o2, day).ok, true, "古い完了済みは片付いて交換できる");
}
// 保存に失敗したら交換ごと取り消す(品物だけ動かない)
{
  const c = mk(); const bag = { [slot.itemId]: 99 }; const o2 = { remove: (id, n) => { if ((bag[id] ?? 0) < n) return false; bag[id] -= n; return true; }, add(id, n) { bag[id] = (bag[id] ?? 0) + n; } };
  const realSet = globalThis.__stubWorld.setDynamicProperty; let boom = true;
  globalThis.__stubWorld.setDynamicProperty = (k, v) => { if (boom) throw new Error("too large"); return realSet(k, v); };
  const r = VB.barterExecute(c, { id: "b1", name: "bob" }, slot.itemId, slot.left, IRON, o2, day);
  globalThis.__stubWorld.setDynamicProperty = realSet;
  eq(r.reason, "save_failed", "保存に失敗したら交換は失敗"); eq(bag[slot.itemId], 99, "渡した品は返る"); eq(bag[IRON] ?? 0, 0, "受け取りも渡さない");
  eq(c.stock[IRON], 50, "蔵も元に戻る"); eq(c.orders.length, 0, "注文も増えない");
}
console.log(errors === 0 ? "OK  村の物々交換: すべて通過" : errors + " problem(s)");
process.exit(errors ? 1 : 0);
