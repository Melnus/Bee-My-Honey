// 村の地域タイプ(data/village-regions.js)の検算。 node ../dev/check/check_village_regions.mjs scripts
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] ?? "scripts");
const R = await import(pathToFileURL(path.join(root, "data/village-regions.js")).href);
const IT = await import(pathToFileURL(path.join(root, "data/exchange-items-data.js")).href);
let errors = 0;
const eq = (a, b, m) => { if (a !== b) { errors++; console.log(`NG  ${m}: ${a} vs ${b}`); } };
const ok = (c, m) => { if (!c) { errors++; console.log("NG  " + m); } };
const cases = { plains: "plains", "minecraft:sunflower_plains": "plains", forest: "plains", jungle: "plains", desert: "desert", "minecraft:badlands": "desert", eroded_badlands: "desert",
  savanna: "savanna", savanna_plateau: "savanna", taiga: "taiga", old_growth_pine_taiga: "taiga", mega_spruce_taiga: "taiga", ice_plains: "snow", cold_taiga: "snow", snowy_taiga: "snow", frozen_river: "snow", grove: "snow",
  ocean: "sea", deep_ocean: "sea", warm_ocean: "sea", frozen_ocean: "sea", beach: "sea", river: "sea", swamp: "sea", undefined: "plains" };
for (const [b, k] of Object.entries(cases)) eq(R.regionOfBiome(b === "undefined" ? undefined : b), k, "バイオーム " + b);
eq(R.REGION_KEYS.length, 6, "6種");
const tree = new Set();
for (const c of IT.EXCHANGE_TREE) for (const g of c.groups) for (const it of g.items) tree.add("minecraft:" + it[0]);
for (const k of R.REGION_KEYS) {
  const d = R.REGIONS[k];
  ok(d.ja && d.en && d.type && d.specialty.length > 0, k + " 定義");
  for (const s of d.specialty) ok(tree.has(s.itemId), `${k} 特産が取引リストに無い: ${s.itemId}`);
  ok(tree.has(d.affinity) || d.affinity.startsWith("minecraft:"), k + " 適性");
}
eq(R.REGIONS.snow.capMult, 2, "雪原は蔵2倍"); eq(R.regionOf({ region: "zzz" }), "plains", "不明は平原");
eq(R.detectRegion({ x: 0, y: 0, z: 0 }, { getBiome: () => ({ id: "minecraft:desert" }) }), "desert", "detect");
eq(R.detectRegion({ x: 0, y: 0, z: 0 }, { getBiome() { throw new Error("x"); } }), undefined, "読めなければ undefined");
console.log(errors === 0 ? "OK  村の地域タイプ: すべて通過" : errors + " problem(s)");
process.exit(errors ? 1 : 0);
