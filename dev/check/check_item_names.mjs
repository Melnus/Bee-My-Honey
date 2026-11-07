// 品目名の一本化・外部アドオンの品目の検算スクリプト(Node 20+)。
//   node ../dev/check/check_item_names.mjs scripts      (パックのルートで実行)
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


globalThis.__itemTypes = [];
const IN = await imp("economy/item-names.js");
const EX = await imp("economy/exchange.js");
const XI = await imp("economy/external-items.js");
const PR = await imp("economy/village-pricing.js");
const Rcp = (await imp("data/pricing-recipes-data.js")).PRICING_RECIPES;
const NC = await imp("data/npc-company-data.js");
const VJ = await imp("data/village-jobs-data.js");
const LD = await imp("data/labor-data.js");
const VDm = await imp("economy/village-demand.js");
const CD = await imp("data/convert-data.js");
let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const ok = (c, m) => { if (!c) fail(m); };

// 1. 名前: データに出てくる全IDに、正典で名前がある
const ids = new Set();
for (const c of NC.NPC_COMPANIES) for (const r of c.recipes) { ids.add(r.out); for (const k of Object.keys(r.inputs)) ids.add(k); }
for (const [b, d] of Object.entries(VJ.JOB_BLOCKS)) { ids.add(b); for (const r of d.recipes) { ids.add(r.out); for (const k of Object.keys(r.inputs)) ids.add(k); } }
const qj = Object.values(LD.QUALIFIED_JOBS).flatMap((v) => v.jobs);
for (const j of [...LD.UNQUALIFIED_JOBS, ...qj]) { if (j?.itemId) ids.add(j.itemId); }
for (const l of Object.values(LD.LICENSES ?? {})) if (l.blockType) ids.add(l.blockType);
for (const e of [...VDm.VILLAGE_BUY_TABLE, ...VDm.COMPANY_BUY_TABLE]) ids.add(e.itemId);
for (const e of CD.FACTORY_CONVERT_TABLE) { ids.add(e.in); ids.add(e.out); }
ok(ids.size > 60, "確かめるIDが集まっている: " + ids.size);
for (const id of ids) if (id && !IN.hasLabel(id)) fail("名前がない: " + id);
ok(IN.itemLabel("minecraft:kelp", "ja") === "コンブ", "取引リストの名前が出る");
ok(IN.itemLabel("minecraft:slime_ball", "en") === "Slime Ball", "英語はIDから整える");
ok(IN.itemLabel("minecraft:composter", "ja") === "コンポスター", "追補表(職業ブロック)");

// 2. 外部アドオンの品: 見つける → 似た品と同じ値付け → 取引リストに載る
globalThis.__itemTypes = ["minecraft:stone", "ruby:ruby_pickaxe", "ruby:ruby", "ruby:cobweb_sword", "gems:ruby_block", "mobs:wheat"];
const r = XI.scanExternal(10);
ok(r.found === 5, "minecraft: 以外の5つを見つける: " + r.found);
const ents = XI.externalEntries();
const pick = ents.find((e) => e.itemId === "ruby:ruby_pickaxe");
ok(pick && /_pickaxe$/.test(pick.like), "つるはしは、つるはしの値付けを借りる: " + JSON.stringify(pick));
ok(!ents.some((e) => e.itemId === "ruby:ruby"), "似た品が見つからない品は載せない");
const sword = ents.find((e) => e.itemId === "ruby:cobweb_sword");
ok(sword && /_sword$/.test(sword.like), "剣は剣: " + JSON.stringify(sword));
ok(ents.find((e) => e.itemId === "mobs:wheat")?.like === "minecraft:wheat", "名前が丸ごと同じ品は、その品");
ok(EX.isTradable("ruby:ruby_pickaxe"), "取引できる品になる");
ok(EX.itemInfo("ruby:ruby_pickaxe")?.cat === "rare", "分類は希少資源");
ok(Math.abs(PR.getItemBasePriceExact("ruby:ruby_pickaxe") - PR.getItemBasePriceExact(pick.like)) < 1e-6, "値付けは似た品と同額");
ok(EX.referencePrice("ruby:ruby_pickaxe") === EX.referencePrice(pick.like), "取引所の上限価格も同額");
ok(EX.searchItems("ruby pick").some((h) => h.itemId === "ruby:ruby_pickaxe"), "検索で出る");
ok(IN.itemLabel("ruby:ruby_pickaxe", "en") === "Ruby Pickaxe", "名前空間は表示しない: " + IN.itemLabel("ruby:ruby_pickaxe", "en"));
const g = EX.exchangeTree().find((c) => c.key === "rare").groups.find((x) => x.key === "addon");
ok(g && g.items.length === 4, "アドオンの品の小分類: " + g?.items.length);
const pl = { sendMessage: () => {} };
XI.externalCommand(pl, "alias ruby:ruby minecraft:diamond");
ok(EX.isTradable("ruby:ruby") && EX.referencePrice("ruby:ruby") === EX.referencePrice("minecraft:diamond"), "手動の値付けの相手(alias)");
XI.externalCommand(pl, "name ruby:ruby ルビー");
ok(IN.itemLabel("ruby:ruby", "ja") === "ルビー", "日本語名を付けられる");

// 2b. シュルカーから取り込む/出品するときに、外部アドオンの品がその場で載る(似た品がなければ値付けなし)
ok(!EX.isTradable("zzmod:gizmo"), "取り込む前は載っていない");
ok(XI.registerExternalNow("zzmod:gizmo", 12) === true && EX.isTradable("zzmod:gizmo"), "取り込みで品目のページができる");
ok(XI.isUnpriced("zzmod:gizmo") && EX.referencePrice("zzmod:gizmo") === 100000, "似た品がなければ値付けなし(上限は一律)");
ok(XI.registerExternalNow("zzmod:ruby_axe", 12) && !XI.isUnpriced("zzmod:ruby_axe") && /_axe$/.test(XI.externalEntries().find((e) => e.itemId === "zzmod:ruby_axe").like), "似た品があればその値付けで載る");
ok(XI.registerExternalNow("minecraft:stone") === false, "取引リストにある品は対象外(すでに載っている)");
ok(XI.registerExternalNow("minecraft:firework_rocket", 12) === true && EX.isTradable("minecraft:firework_rocket"), "取引リストにないバニラの品(花火)も自動で載る");
ok(XI.registerExternalNow("minecraft:command_block") === false && !EX.isTradable("minecraft:command_block"), "コマンドブロックなどは載せない");
ok(EX.itemInfo("minecraft:firework_rocket")?.ja === "Firework Rocket", "名前はIDから整える");
ok(XI.registerExternalNow("minecraft:enchanted_book#sharpness:5") === false, "種類つきのキーは対象外");
ok(EX.exchangeTree().find((c) => c.key === "rare").groups.find((x) => x.key === "addon").items.some(([i]) => i === "zzmod:gizmo"), "自動掲載の小分類に出る");

// 2c. 値動き: 7日分の平均単価を覚えて、上か下かが分かる
EX.recordTrade("minecraft:wheat", 10, 10, 100); EX.recordTrade("minecraft:wheat", 10, 14, 100);
EX.recordTrade("minecraft:wheat", 5, 12, 102);
let tr = EX.itemTrend("minecraft:wheat", 103);
ok(tr && tr.values.length === 7, "7日分");
ok(Math.abs(tr.last - 12) < 1e-9 && tr.dir === 0, "最後の日が前の日(平均12)と同じなら±0: dir=" + tr.dir);
EX.recordTrade("minecraft:wheat", 5, 18, 103);
tr = EX.itemTrend("minecraft:wheat", 103);
ok(tr.dir === 1 && Math.abs(tr.pct - 50) < 1e-6, "上がった(12→18で+50%): " + JSON.stringify(tr));
EX.recordTrade("minecraft:wheat", 5, 9, 104);
tr = EX.itemTrend("minecraft:wheat", 104);
ok(tr.dir === -1, "下がった");
ok(EX.itemTrend("minecraft:wheat", 120) === null, "8日以上前の記録は使わない");
ok(EX.itemTrend("minecraft:sand", 104) === null, "取引がなければ null");

// 3. 検算(3日ごと): 同じなら動かない / 基準価格が動いたら更新して履歴に残す
const v1 = XI.verifyExternal(20, true);
ok(v1.changed === 0, "変化がなければ更新なし: " + v1.changed);
const likeId = pick.like; const old = Rcp[likeId];
Rcp[likeId] = { kind: "fixed", cost: 9999 };
const v2 = XI.verifyExternal(30, true);
ok(v2.changed >= 1, "似た品の価格が5%以上動くと検算で拾う: " + v2.changed);
if (old) Rcp[likeId] = old; else delete Rcp[likeId];
ok(XI.verifyExternal(31).ran === false, "3日未満は検算しない");
console.log(errors === 0 ? "OK  品目名・外部アドオンの検算: すべて通過" : errors + " problem(s)");
process.exit(errors ? 1 : 0);
