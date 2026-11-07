import { register } from "node:module"; import path from "node:path"; import { pathToFileURL } from "node:url";
globalThis.__w={getDay(){return 1},getDynamicProperty(){},setDynamicProperty(){},getPlayers(){return[]},beforeEvents:{},afterEvents:{}};
register("data:text/javascript,"+encodeURIComponent(`export async function resolve(s,c,n){if(s.startsWith("@minecraft/"))return{url:"data:text/javascript,stub",shortCircuit:true};return n(s,c)} export async function load(u,c,n){if(u==="data:text/javascript,stub")return{format:"module",shortCircuit:true,source:"export class ItemStack{};export const world=globalThis.__w;export const system={runInterval(){},run(f){f()},afterEvents:{scriptEventReceive:{subscribe(){}}}};export const EnchantmentTypes={get(){}};export const EquipmentSlot={};export const PlayerPermissionLevel={};export const BlockPermutation={};"};return n(u,c)}`));
const EX=await import(pathToFileURL(path.resolve("scripts/economy/exchange.js")).href);
const V=await import(pathToFileURL(path.resolve("scripts/economy/village-pricing.js")).href);
const missing=[]; const w=console.warn; console.warn=(m)=>missing.push(String(m).replace(/.*recipe for /,"").split(" ")[0]);
const P=(i)=>V.getItemBasePriceExact("minecraft:"+i);
// 取引所の価格(0.5.9): 取引リストの全品がレシピを持つ / ティアの段差(銅 < 鉄 < ダイヤ < ネザライト) / 似た品にならう
//   node dev/check/check_exchange_prices.mjs scripts      (パックのルートで実行)
let bad=0; const NG=(m)=>{bad++;console.log("NG  "+m)};
for(const k of ["sword","pickaxe","axe","shovel","hoe","helmet","chestplate","leggings","boots"]){
  const v=["copper","iron","diamond","netherite"].map(t=>P(t+"_"+k));
  if(!v.every((x,i)=>i===0||x>v[i-1])) NG("段差: "+k+" "+v.map(x=>x.toFixed(3)).join(" < "));
}
if(!(P("copper_horse_armor")<P("iron_horse_armor")&&P("iron_horse_armor")<P("diamond_horse_armor")&&P("diamond_horse_armor")<P("netherite_horse_armor"))) NG("馬鎧の段差");
if(!(P("copper_spear")<P("diamond_spear")&&P("diamond_spear")<P("netherite_spear"))) NG("槍の段差");
if(!(P("copper_nautilus_armor")<P("diamond_nautilus_armor")&&P("diamond_nautilus_armor")<P("netherite_nautilus_armor"))) NG("オウムガイの鎧の段差");
const near=(a,b,m)=>{ if(Math.abs(P(a)-P(b))>0.002) NG(m+": "+P(a)+" vs "+P(b)); };
near("poplar_planks","oak_planks","ポプラの板材はオークと同じ"); near("pale_oak_planks","oak_planks","ペールオークの板材はオークと同じ");
near("poplar_boat","oak_boat","ポプラのボートはオークと同じ"); near("cherry_boat","oak_boat","サクラのボートはオークと同じ");
near("cooked_beef","cooked_porkchop","ステーキは焼き豚と同じ"); near("red_tulip","dandelion","チューリップはタンポポと同じ"); near("andesite","cobblestone","安山岩は丸石と同じ");
if(!(P("wheat_seeds")<P("wheat"))) NG("種は作物より安い");
const ids=[]; for(const c of EX.exchangeTree())for(const g of c.groups)for(const [i] of g.items)if(!i.includes("#"))ids.push("minecraft:"+i); // 種類つきの品は dev/check/check_variants.mjs
if(ids.length!==305) NG("取引リストは305品: "+ids.length);
console.log(bad===0?"OK":bad+" problem(s)");
process.exit(bad?1:0);
