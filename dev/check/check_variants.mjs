// 種類つきの品目(エンチャント本・ポーション。data/variant-items-data.js / economy/variant-items.js)の検算スクリプト(Node 20+)。
//   node ../dev/check/check_variants.mjs scripts      (パックのルートで実行)
// 1. 取引リスト: 本125種・ポーション46種×3配送。IDの重複なし。キーの形式
// 2. 変換: スタック → キー → スタック → キー が元に戻る(偽のAPIで)。取引できない品(複数エンチャント・名前つき・エンチャント済みの道具)は null
// 3. 価格: 最大レベルは従来の3段階と同額 / 1つ下のレベルほど安い / ポーションは 土台 < 効果 < スプラッシュ < 残留
// 4. 取引所: 本の常設出品(HRMHRM)・検索・名前・出品して買う
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
      export const EnchantmentTypes = { get(id){ return id === "nope" ? undefined : { id }; } };
      export const Potions = { resolve(eff,del){ const t={Consume:"minecraft:potion",ThrownSplash:"minecraft:splash_potion",ThrownLingering:"minecraft:lingering_potion"}[del]; if(!t) throw new Error("bad delivery"); const s=new ItemStack(t,1); s._potion=eff.replace("minecraft:",""); return s; } };
      export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;
      export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};\`};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export class ActionFormData{}; export class ModalFormData{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const VD = await imp("data/variant-items-data.js");
const VI = await imp("economy/variant-items.js");
const IT = await imp("data/exchange-items-data.js");
const EX = await imp("economy/exchange.js");
const PR = await imp("economy/village-pricing.js");
const MO = await imp("data/mail-order-data.js");
const { ItemStack } = await import("@minecraft/server").catch(() => ({}));

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
const ok = (c, m) => { if (!c) fail(m); };
const near = (a, b, m) => ok(Math.abs(a - b) < 1e-6, `${m}: ${a} vs ${b}`);

// 1. 取引リスト
const tree = IT.EXCHANGE_TREE;
const groups = tree.find((c) => c.key === "rare").groups;
const bookG = groups.filter((g) => g.key.startsWith("book_"));
const potG = groups.filter((g) => g.key.startsWith("potion_"));
eq(bookG.reduce((n, g) => n + g.items.length, 0), 125, "エンチャント本は125種(42種のレベル違いの合計)");
eq(potG.length, 3, "ポーションは3配送");
for (const g of potG) eq(g.items.length, 46, "ポーションは1配送46種: " + g.key);
const all = new Set(); let dup = 0;
for (const c of tree) for (const g of c.groups) for (const [id] of g.items) { if (all.has(id)) dup++; all.add(id); }
eq(dup, 0, "取引リストにIDの重複がない");
eq(all.size, 568, "取引リストは568品");
ok(EX.isTradable("minecraft:enchanted_book#sharpness:5") && EX.isTradable("minecraft:splash_potion#strong_healing"), "キーで取引できる");
ok(!EX.isTradable("minecraft:enchanted_book") && !EX.isTradable("minecraft:potion"), "種類のない裸のIDは取引できない");
const ench = Object.keys(VD.ENCHANT_DEFS).length;
eq(ench, 42, "エンチャントは42種(mojang-enchantments.json)");

// 2. 変換(偽のAPI)
const keys = [...all].filter((id) => id.includes("#")).map((id) => "minecraft:" + id);
let rt = 0;
for (const k of keys) {
  const stacks = VI.makeStacks(k, 2);
  if (stacks.length !== 2 || stacks.some((s) => s.amount !== 1)) { fail("積み重ねられない品は1個ずつ: " + k); continue; }
  if (VI.stackKey(stacks[0]) !== k) { fail(`往復: ${k} -> ${VI.stackKey(stacks[0])}`); continue; }
  rt++;
}
eq(rt, keys.length, "すべてのキーが、スタック → キーで元に戻る(" + keys.length + "種)");
{
  const book = new ItemStack("minecraft:enchanted_book", 1);
  book.getComponent("minecraft:enchantable").addEnchantment({ type: { id: "sharpness" }, level: 5 });
  eq(VI.stackKey(book), "minecraft:enchanted_book#sharpness:5", "エンチャント本のキー");
  const two = new ItemStack("minecraft:enchanted_book", 1);
  two.getComponent("minecraft:enchantable").addEnchantment({ type: { id: "sharpness" }, level: 5 });
  two.getComponent("minecraft:enchantable").addEnchantment({ type: { id: "looting" }, level: 3 });
  eq(VI.stackKey(two), null, "複数エンチャントの本は取引できない");
  const over = new ItemStack("minecraft:enchanted_book", 1);
  over.getComponent("minecraft:enchantable").addEnchantment({ type: { id: "sharpness" }, level: 9 });
  eq(VI.stackKey(over), null, "最大レベルを超える本は取引できない");
  const inf = new ItemStack("minecraft:enchanted_book", 1);
  inf.getComponent("minecraft:enchantable").addEnchantment({ type: { id: "minecraft:bow_infinity" }, level: 1 });
  eq(VI.stackKey(inf), "minecraft:enchanted_book#infinity:1", "bow_infinity は infinity に直す");
  const named = new ItemStack("minecraft:enchanted_book", 1); named.nameTag = "x";
  eq(VI.stackKey(named), null, "名前つきは取引できない");
  const sword = new ItemStack("minecraft:diamond_sword", 1);
  sword.getComponent("minecraft:enchantable").addEnchantment({ type: { id: "sharpness" }, level: 5 });
  eq(VI.stackKey(sword), null, "エンチャント済みの道具は取引できない");
  eq(VI.stackKey(new ItemStack("minecraft:wheat", 5)), "minecraft:wheat", "ふつうの品はそのまま");
  const dmg = new ItemStack("minecraft:iron_pickaxe", 1); dmg.damage = 3;
  eq(VI.stackKey(dmg), null, "傷んだ品は取引できない");
  const unk = new ItemStack("minecraft:potion", 1);
  eq(VI.stackKey(unk), null, "種類が読めないポーションは取引できない");
  const stacks = VI.makeStacks("minecraft:wheat", 130);
  eq(stacks.map((s) => s.amount).join(","), "64,64,2", "ふつうの品は最大スタックごと");
  eq(VI.makeStacks("minecraft:enchanted_book#nope:1", 1).length, 0, "作れないキーは空");
}

// 3. 価格
{
  const P = (k) => PR.getItemBasePriceExact(k);
  near(P("minecraft:enchanted_book#sharpness:5"), P("enchanted_book:common"), "最大レベルは従来の通常段階と同額");
  near(P("minecraft:enchanted_book#silk_touch:1"), P("enchanted_book:silk_touch_efficiency5"), "シルクタッチは従来の段階と同額");
  near(P("minecraft:enchanted_book#efficiency:5"), P("enchanted_book:silk_touch_efficiency5"), "効率強化Vは従来の段階と同額");
  near(P("minecraft:enchanted_book#mending:1"), P("enchanted_book:infinity_mending"), "修繕は従来の段階と同額");
  near(P("minecraft:enchanted_book#infinity:1"), P("enchanted_book:infinity_mending"), "無限は従来の段階と同額");
  for (const e of Object.values(VD.ENCHANT_DEFS)) for (let lv = 1; lv < e.maxLevel; lv++) {
    ok(P(VD.bookKey(e.id, lv)) < P(VD.bookKey(e.id, lv + 1)), `${e.id}: レベル${lv}はレベル${lv + 1}より安い`);
  }
  for (const eid of VD.POTION_EFFECT_IDS) {
    const a = P("minecraft:potion#" + eid), b = P("minecraft:splash_potion#" + eid), c = P("minecraft:lingering_potion#" + eid);
    ok(a < b && b < c, `${eid}: 飲む < スプラッシュ < 残留 (${a.toFixed(1)}, ${b.toFixed(1)}, ${c.toFixed(1)})`);
    ok(a > 0 && Number.isFinite(c), `${eid}: 価格が正`);
  }
  ok(P("minecraft:potion#water") < P("minecraft:potion#awkward") && P("minecraft:potion#awkward") < P("minecraft:potion#healing"), "水入り瓶 < 奇妙 < 効果");
  ok(P("minecraft:potion#healing") < P("minecraft:potion#strong_healing"), "強化は高い");
  ok(P("minecraft:potion#swiftness") < P("minecraft:potion#long_swiftness"), "延長は高い");
}

// 4. 取引所
{
  const maxBooks = MO.MAIL_ORDER_CATALOG.books.filter((b) => b.enchant);
  const standing = EX.standingItems();
  let miss = 0;
  for (const b of maxBooks) if (!standing.has(VD.bookKey(b.enchant.id, b.enchant.level))) miss++;
  eq(miss, 0, "通販のエンチャント本(最大レベル)は、取引所のHRMHRMの常設出品になる");
  ok(!standing.has("minecraft:enchanted_book"), "裸の enchanted_book は常設にならない");
  const o = EX.listOffers("minecraft:enchanted_book#sharpness:5")[0];
  ok(o && o.kind === "hrmhrm", "最大レベルの本はHRMHRMの出品がある");
  const lowest = EX.listOffers("minecraft:enchanted_book#sharpness:2");
  eq(lowest.length, 0, "下のレベルの本は、出品が無ければ空");
  eq(EX.searchItems("ダメージ増加").filter((x) => x.itemId.includes("#")).length, 5, "検索: 日本語名でレベル違い5件");
  eq(EX.searchItems("strong healing").length >= 3, true, "検索: 英語名で3配送が出る");
  eq(EX.searchItems("sharpness V")[0]?.itemId, "minecraft:enchanted_book#sharpness:5", "検索: 英語名+ローマ数字");
  eq(VD.variantName("minecraft:splash_potion#strong_healing", "ja"), "治癒のスプラッシュポーション II", "名前(ja)");
  // 出品して買う(プールに入れて出品)
  const alice = { id: "idA", name: "alice", sendMessage() {}, getDynamicProperty: (k) => store.get("A" + k), setDynamicProperty: (k, v) => store.set("A" + k, v), location: { x: 0, y: 64, z: 0 }, dimension: { id: "minecraft:overworld" } };
  players.push(alice);
  alice.setDynamicProperty("acc_emeralds", 5000);
  const key = "minecraft:splash_potion#healing";
  store.set("bmh_ex_pool_idA", JSON.stringify({ [key]: 5 }));
  const ref = EX.referencePrice(key);
  const l = EX.createListing(alice, key, 5, Math.max(1, ref - 1));
  ok(l.ok, "ポーションを出品できる: " + l.reason);
  const bob = { id: "idB", name: "bob", sendMessage() {}, getDynamicProperty: (k) => store.get("B" + k), setDynamicProperty: (k, v) => store.set("B" + k, v), location: { x: 0, y: 64, z: 0 }, dimension: { id: "minecraft:overworld" } };
  players.push(bob);
  bob.setDynamicProperty("acc_emeralds", 10000);
  const r = EX.buy(bob, key, 3);
  ok(r.ok, "ポーションを買える: " + r.reason);
  eq(JSON.parse(store.get("bmh_ex_inbox_idB") ?? "{}")[key], 3, "入荷一覧にキーで入る");
}
console.log(errors === 0 ? "\nOK  種類つきの品目の検算: すべて通過" : `\nNG  ${errors}件`);
process.exit(errors === 0 ? 0 : 1);
