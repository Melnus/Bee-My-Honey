// ==========================================
// 村の職業ブロックと手工業 / Village Job Blocks  (dev/sketch/sketch-village-jobs.md。2026-11-05 作者の方針)
// ------------------------------------------
// 村のコアの範囲(水平±64 / 高さ±32)にある、バニラの職業ブロックを数える。村人の数は村の規模を表すだけで、
// 村の機能(何を作るか)は、範囲にある職業ブロックの数で決まる(村人は増減するため)。
//   ・ブロックごとに、1日に jobRunsPerBlockDay 回(政策 village_job_runs)まで加工できる(手工業の量。工場ではない)。
//   ・recipes: { out, outQty, inputs } = 1回の加工。原料は、プレイヤーの納品(クエスト)か、村が取引所から買った分から。
//   ・recipes が空の職業は、いまは検知するだけ(何も作らない)。
// ==========================================
const M = (id) => "minecraft:" + id;

export const JOB_BLOCKS = {
  [M("composter")]: { job: "farmer", ja: "農民(堆肥箱)", en: "Farmer (composter)",
    recipes: [{ out: M("wheat"), outQty: 1, inputs: { [M("wheat_seeds")]: 1 } }] },
  [M("smoker")]: { job: "butcher", ja: "肉屋(燻製器)", en: "Butcher (smoker)",
    recipes: [
      { out: M("cooked_beef"), outQty: 1, inputs: { [M("beef")]: 1 } },
      { out: M("cooked_porkchop"), outQty: 1, inputs: { [M("porkchop")]: 1 } },
      { out: M("cooked_chicken"), outQty: 1, inputs: { [M("chicken")]: 1 } }
    ] },
  [M("blast_furnace")]: { job: "armorer", ja: "鎧鍛冶(溶鉱炉)", en: "Armorer (blast furnace)",
    recipes: [
      { out: M("iron_ingot"), outQty: 1, inputs: { [M("raw_iron")]: 1 } },
      { out: M("copper_ingot"), outQty: 1, inputs: { [M("raw_copper")]: 1 } }
    ] },
  [M("barrel")]: { job: "fisherman", ja: "漁師(樽)", en: "Fisherman (barrel)",
    recipes: [
      { out: M("cooked_cod"), outQty: 1, inputs: { [M("cod")]: 1 } },
      { out: M("cooked_salmon"), outQty: 1, inputs: { [M("salmon")]: 1 } }
    ] },
  [M("fletching_table")]: { job: "fletcher", ja: "矢師(矢細工台)", en: "Fletcher (fletching table)",
    recipes: [{ out: M("arrow"), outQty: 4, inputs: { [M("flint")]: 1, [M("stick")]: 1, [M("feather")]: 1 } }] },
  // ---- 検知だけ(いまは何も作らない) ----
  [M("loom")]: { job: "shepherd", ja: "羊飼い(機織り機)", en: "Shepherd (loom)", recipes: [] },
  [M("stonecutter")]: { job: "mason", ja: "石工(石切台)", en: "Mason (stonecutter)", recipes: [] },
  [M("cartography_table")]: { job: "cartographer", ja: "製図家(製図台)", en: "Cartographer (cartography table)", recipes: [] },
  [M("lectern")]: { job: "librarian", ja: "司書(書見台)", en: "Librarian (lectern)", recipes: [] },
  [M("brewing_stand")]: { job: "cleric", ja: "聖職者(醸造台)", en: "Cleric (brewing stand)", recipes: [] },
  [M("cauldron")]: { job: "leatherworker", ja: "皮なめし(大釜)", en: "Leatherworker (cauldron)", recipes: [] },
  [M("grindstone")]: { job: "weaponsmith", ja: "武器鍛冶(砥石)", en: "Weaponsmith (grindstone)", recipes: [] },
  [M("smithing_table")]: { job: "toolsmith", ja: "道具鍛冶(鍛冶台)", en: "Toolsmith (smithing table)", recipes: [] }
};
export const JOB_BLOCK_IDS = Object.keys(JOB_BLOCKS);
