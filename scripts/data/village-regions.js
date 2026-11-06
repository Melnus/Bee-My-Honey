// ==========================================
// 村の地域タイプ / Village Regions  (鐘が置かれた場所のバイオームで決まる6種)
// ------------------------------------------
// 細かいバイオームは無視し、平原・砂漠・サバンナ・タイガ・雪原・海 のどれかにする。判定は村を登記した位置(鐘)のバイオーム。
//   ・specialty: 週の締めに、人口に応じて生まれる特産品(取引所へ出品される)。perPop = 人口1人・1週あたりの個数(village_specialty_per_pop を掛ける)。
//   ・demand: 日々の入荷(枠)の抽選の重み。指定のない品は1。
//   ・affinity: 適性の職業ブロック(表示のみ。検知されれば仕事はどの村でもできる)。
//   ・capMult: 蔵の上限にかける倍率。
//   ※氷・雪・砂岩・プリズマリン・サンゴは、取引リストに価格がないため、特産にはまだ入れていない。
// ==========================================
const M = (s) => "minecraft:" + s;
const FOOD = ["wheat", "potato", "carrot", "beetroot", "pumpkin", "melon_slice", "sweet_berries", "porkchop", "chicken", "rabbit", "cod", "salmon"].map(M);
const WOOD = ["oak_sapling", "spruce_sapling", "birch_sapling", "stick"].map(M);
const FUEL = ["charcoal"].map(M);
const METAL = ["raw_iron", "raw_copper"].map(M);
const grain = ["wheat", "beetroot"].map(M);
const mult = (ids, v, base = {}) => { for (const id of ids) base[id] = v; return base; };

export const REGION_KEYS = ["plains", "desert", "savanna", "taiga", "snow", "sea"];

export const REGIONS = {
  plains: {
    ja: "平原の村", en: "Plains village", type: { ja: "基準型", en: "Standard" },
    specialty: [{ itemId: M("wheat"), perPop: 1 }, { itemId: M("bread"), perPop: 0.5 }],
    demand: {}, affinity: M("composter"), capMult: 1
  },
  desert: {
    ja: "砂漠の村", en: "Desert village", type: { ja: "輸入型", en: "Importer" },
    specialty: [{ itemId: M("sand"), perPop: 2 }, { itemId: M("glass"), perPop: 0.5 }, { itemId: M("cactus"), perPop: 0.5 }],
    demand: mult(FOOD, 2, mult(WOOD, 2.5)), affinity: M("blast_furnace"), capMult: 1
  },
  savanna: {
    ja: "サバンナの村", en: "Savanna village", type: { ja: "畜産型", en: "Livestock" },
    specialty: [{ itemId: M("acacia_log"), perPop: 1 }, { itemId: M("leather"), perPop: 0.5 }, { itemId: M("beef"), perPop: 0.5 }],
    demand: mult(grain, 2.5), affinity: M("smoker"), capMult: 1
  },
  taiga: {
    ja: "タイガの村", en: "Taiga village", type: { ja: "狩猟・林業型", en: "Hunting & forestry" },
    specialty: [{ itemId: M("spruce_log"), perPop: 1 }, { itemId: M("sweet_berries"), perPop: 1 }],
    demand: mult(FUEL, 2, mult(METAL, 2.5, mult(["porkchop", "chicken", "rabbit", "cod", "salmon"].map(M), 1.5))), affinity: M("fletching_table"), capMult: 1
  },
  snow: {
    ja: "雪原の村", en: "Snowy village", type: { ja: "備蓄型", en: "Stockpiler" },
    specialty: [{ itemId: M("rabbit"), perPop: 0.5 }, { itemId: M("rabbit_hide"), perPop: 0.5 }, { itemId: M("salmon"), perPop: 0.5 }],
    demand: mult(FUEL, 4), affinity: M("smoker"), capMult: 2
  },
  sea: {
    ja: "海の村", en: "Coastal village", type: { ja: "貿易依存型", en: "Trade-dependent" },
    specialty: [{ itemId: M("cod"), perPop: 1 }, { itemId: M("kelp"), perPop: 1 }, { itemId: M("sea_pickle"), perPop: 0.5 }, { itemId: M("ink_sac"), perPop: 0.5 }],
    demand: mult(FOOD, 1.5, mult(WOOD, 2, mult(FUEL, 2, mult(METAL, 1.5)))), affinity: M("barrel"), capMult: 1
  }
};

// バイオームID(Bedrock の dimension.getBiome(pos).id)→ 6種。"minecraft:" の有無は問わない。判定の順: 海(大洋) → 雪原 → 海辺・川・湿地 → 砂漠 → サバンナ → タイガ → 平原(既定)。
export function regionOfBiome(biomeId) {
  const b = String(biomeId ?? "").replace(/^minecraft:/, "");
  if (/ocean/.test(b)) return "sea";
  if (/frozen|ice|snow|cold|grove|jagged|peaks/.test(b) && !/stony/.test(b)) return "snow";
  if (/beach|river|swamp|mangrove|mushroom/.test(b)) return "sea";
  if (/desert|badlands|mesa/.test(b)) return "desert";
  if (/savanna/.test(b)) return "savanna";
  if (/taiga|redwood|mega_spruce/.test(b)) return "taiga";
  return "plains";
}

// 村の地域(記録がなければ平原)
export const regionOf = (core) => (REGIONS[core?.region] ? core.region : "plains");
export const regionDef = (core) => REGIONS[regionOf(core)];

// 村を登記した位置のバイオームから地域を決める。読めなければ undefined(平原のまま・あとで再試行)
export function detectRegion(core, dim) {
  let id;
  try { id = dim.getBiome({ x: core.x, y: core.y, z: core.z })?.id; } catch (e) { id = undefined; }
  return id ? regionOfBiome(id) : undefined;
}

// 村同士の取引: 週の締めに、村が取引所で買い入れる品(地域の需要が強い品のうち、自分の特産でないもの)。
// 買った品は村の中で消費される(蔵に入れない = 買って売り直す裁定は起きない)。他の村・プレイヤーの出品が売れる先になる。
// 戻り値: [{ itemId, perPop }]。perPop = 人口1人・1週あたりの買う数(需要の重み × 0.25)
export function regionImports(core) {
  const d = regionDef(core);
  const own = new Set((d.specialty ?? []).map((x) => x.itemId));
  return Object.entries(d.demand ?? {}).filter(([id, m]) => m >= 2 && !own.has(id)).map(([itemId, m]) => ({ itemId, perPop: m * 0.25 }));
}
