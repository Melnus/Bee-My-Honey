// ==========================================
// NPC会社の定義 / NPC Companies  (dev/sketch/sketch-npc-companies.md。2026-11-05 作者の方針)
// ------------------------------------------
// 株式市場の各社(data/market-data.js の STOCKS)のうち、製品を持つ4社。プレイヤーの会社の小規模版で、
// 原料を取引所で買い(なければ会社クエストで依頼し)、加工して、製品を取引所へ自動で出品する。物理的な本社はない。
//   ・id: 口座ID兼・仮想コアID(6文字の英大文字・数字)。stock: market-data.js の STOCKS のキー(名前を借りる)。
//   ・recipes: { out, outQty, inputs: { 原料: 個数 } } = 1回の加工。原料・製品は、すべて取引リスト(data/exchange-items-data.js)にある品。
//   ・Witcha-Cola(ポーション)は、種類つきの品目(data/variant-items-data.js のキー「ID#種類」)で醸造する。recipes の runs は、1日にそのレシピを回す回数(省略すると政策 npc_runs_per_day)。
//     土台や中間のポーションは自社の別のレシピが作る(取引所からは買わない)。材料の買いと、クエストの依頼は、ふつうの品だけ(種類つきの品は、クエストで納品できない)。
//     Skein(配送EC)・KelpLife(保険)・HRMHRMは、製品を持たない/別の仕組みなので対象外。
// ==========================================
const M = (id) => "minecraft:" + id;
const P = (effect) => "minecraft:potion#" + effect;
const SP = (effect) => "minecraft:splash_potion#" + effect;

export const NPC_COMPANIES = [
  {
    id: "NPCMCD", stock: "mcmoonald", // ファストフード・ミルク
    recipes: [
      { out: M("bread"), outQty: 1, inputs: { [M("wheat")]: 3 } },
      { out: M("cooked_beef"), outQty: 1, inputs: { [M("beef")]: 1 } },
      { out: M("cooked_porkchop"), outQty: 1, inputs: { [M("porkchop")]: 1 } },
      { out: M("cooked_chicken"), outQty: 1, inputs: { [M("chicken")]: 1 } },
      { out: M("cookie"), outQty: 8, inputs: { [M("wheat")]: 2, [M("cocoa_beans")]: 1 } },
      { out: M("cake"), outQty: 1, inputs: { [M("milk_bucket")]: 3, [M("sugar")]: 2, [M("egg")]: 1, [M("wheat")]: 3 } }
    ]
  },
  {
    id: "NPCCLT", stock: "clattle", // 骨格防衛・遠隔重工
    recipes: [
      { out: M("arrow"), outQty: 4, inputs: { [M("flint")]: 1, [M("stick")]: 1, [M("feather")]: 1 } },
      { out: M("bow"), outQty: 1, inputs: { [M("stick")]: 3, [M("string")]: 3 } },
      { out: M("crossbow"), outQty: 1, inputs: { [M("stick")]: 3, [M("iron_ingot")]: 1, [M("string")]: 2 } },
      { out: M("shield"), outQty: 1, inputs: { [M("oak_planks")]: 6, [M("iron_ingot")]: 1 } },
      { out: M("iron_helmet"), outQty: 1, inputs: { [M("iron_ingot")]: 5 } },
      { out: M("iron_chestplate"), outQty: 1, inputs: { [M("iron_ingot")]: 8 } },
      { out: M("iron_leggings"), outQty: 1, inputs: { [M("iron_ingot")]: 7 } },
      { out: M("iron_boots"), outQty: 1, inputs: { [M("iron_ingot")]: 4 } }
    ]
  },
  {
    id: "NPCPPL", stock: "pupple", // ハイテク首輪・デバイス
    recipes: [
      { out: M("compass"), outQty: 1, inputs: { [M("iron_ingot")]: 4, [M("redstone")]: 1 } },
      { out: M("clock"), outQty: 1, inputs: { [M("gold_ingot")]: 4, [M("redstone")]: 1 } },
      { out: M("lead"), outQty: 2, inputs: { [M("string")]: 4, [M("slime_ball")]: 1 } }
    ]
  },
  {
    id: "NPCEKB", stock: "eekbay", // 海洋オークション物流
    recipes: [
      { out: M("cooked_cod"), outQty: 1, inputs: { [M("cod")]: 1 } },
      { out: M("cooked_salmon"), outQty: 1, inputs: { [M("salmon")]: 1 } },
      { out: M("dried_kelp"), outQty: 1, inputs: { [M("kelp")]: 1 } }
    ]
  },
  {
    id: "NPCWCC", stock: "witcha_cola", // 秘伝ポーション飲料
    // 水入り瓶 → 奇妙なポーション → 効果 → 延長・スプラッシュ の順に作る(前のレシピの産出が、後のレシピの材料になる)
    recipes: [
      { out: P("water"), outQty: 1, inputs: { [M("glass_bottle")]: 1 }, runs: 36 },
      { out: P("awkward"), outQty: 3, inputs: { [P("water")]: 3, [M("nether_wart")]: 1 }, runs: 12 },
      { out: P("swiftness"), outQty: 3, inputs: { [P("awkward")]: 3, [M("sugar")]: 1 }, runs: 3 },
      { out: P("poison"), outQty: 3, inputs: { [P("awkward")]: 3, [M("spider_eye")]: 1 }, runs: 2 },
      { out: P("leaping"), outQty: 3, inputs: { [P("awkward")]: 3, [M("rabbit_foot")]: 1 }, runs: 2 },
      { out: P("water_breathing"), outQty: 3, inputs: { [P("awkward")]: 3, [M("pufferfish")]: 1 }, runs: 2 },
      { out: P("slow_falling"), outQty: 3, inputs: { [P("awkward")]: 3, [M("phantom_membrane")]: 1 }, runs: 1 },
      { out: P("nightvision"), outQty: 3, inputs: { [P("awkward")]: 3, [M("golden_carrot")]: 1 }, runs: 2 },
      { out: P("long_swiftness"), outQty: 3, inputs: { [P("swiftness")]: 3, [M("redstone")]: 1 }, runs: 1 },
      { out: P("long_poison"), outQty: 3, inputs: { [P("poison")]: 3, [M("redstone")]: 1 }, runs: 1 },
      { out: SP("swiftness"), outQty: 1, inputs: { [P("swiftness")]: 1, [M("gunpowder")]: 1 }, runs: 3 },
      { out: SP("poison"), outQty: 1, inputs: { [P("poison")]: 1, [M("gunpowder")]: 1 }, runs: 3 }
    ]
  }
];
