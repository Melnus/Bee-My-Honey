// ==========================================
// 郵便販売カタログ / Mail Order Catalog
// ショップ商品リスト（安い順）に基づき、5段階のカテゴリ+レア枠で構成。
//
// 【価格の決め方(統一プライシングエンジン / dev/pricing-guide.md・dev/pricing-settings.md)】
//   価格(E) = 品目の基準価格(原価×1.20) × giveAmount × MAIL_ORDER_MARKUP(1.25) × 掛率(price-level.js)、四捨五入・最低1E
//   以前の「現実の金銭感覚の桁」方針(数十円〜数十万円)は撤回し、村の最低賃金(1日10E)を土台にした
//   原価から再計算した。カテゴリの段階(tier)は価格帯ではなく品物の格を表す名前として残している。
//   ※ HRMHRMだけが多少割高に出品している想定。将来の取引所では、プレイヤーの出品が
//      基準価格(=お買い得コーナーの割引後の値段)とこの価格の間に入る。
//   ※ エンチャント本は品目IDが共通(enchanted_book)なので、keyから3段階(通常/シルクタッチ・効率V/無限・修繕)に
//      振り分けて価格を出す。
//
// 「ネザーやエンドのものは基本ナシ、レア物だけは別枠」の方針に合わせ、
// レア・ボスドロップ品(rare)は通常カタログには出さず、
// 日替わりの「お買い得コーナー」(5点・割引価格)からのみ購入できる。
// エンチャント本は例外的に、抽選任せだと不便なため専用カテゴリで常時購入可能にしてある。
//
// 通常アイテム: { key, itemId, giveAmount, name }  (price は下の priced() が付ける)
// 日替わりアイテム: { key, variants: [{ itemId, name }], giveAmount, name }
//   → variants は当日の乱数(日付シード)で1つだけ選ばれる。name はカタログ表示用の総称名。
//   → 価格は variants の基準価格の平均で付ける(日によって値段が変わらないように)。
// ==========================================

import { SAPLINGS, MUSIC_DISCS, SMITHING_TEMPLATES, ENCHANTED_BOOK_COMMON_ITEMS } from "./item-catalog.js";
import { getItemBasePriceExact } from "../economy/village-pricing.js";
import { MAIL_ORDER_MARKUP } from "./village-pricing-data.js";
import { getPriceLevel } from "../economy/price-level.js";

export const MAIL_ORDER_CATEGORIES = [
  { key: "fresh", name: { ja: "生鮮物・自然物", en: "Fresh & Natural Goods" }, tier: { ja: "とても安い", en: "Very Cheap" } },
  { key: "household", name: { ja: "日常雑貨", en: "Everyday Goods" }, tier: { ja: "安い", en: "Cheap" } },
  { key: "redstone", name: { ja: "機能ブロック・レッドストーン製品", en: "Functional & Redstone Blocks" }, tier: { ja: "そこそこ", en: "Moderate" } },
  { key: "gear", name: { ja: "防具・アイテム", en: "Armor & Gear" }, tier: { ja: "高い", en: "Expensive" } },
  { key: "books", name: { ja: "本(エンチャント)", en: "Books (Enchanted)" }, tier: { ja: "超高い", en: "Ultra Expensive" } }
];

// レア・ボスドロップ品は通常カタログの4段階の上、5段階目「超高い」に相当
export const MAIL_ORDER_RARE_TIER = { key: "rare", name: { ja: "レア・ボスドロップ品", en: "Rare & Boss Drops" }, tier: { ja: "超高い", en: "Ultra Expensive" } };

const MAIL_ORDER_CATALOG_SPECS = {
  fresh: [
    { key: "sapling", giveAmount: 4, name: { ja: "苗木(日替わり)", en: "Sapling (Daily)" }, variants: SAPLINGS },
    { key: "wheat", itemId: "minecraft:wheat", giveAmount: 8, name: { ja: "小麦 ×8", en: "Wheat x8" } },
    { key: "dandelion", itemId: "minecraft:dandelion", giveAmount: 4, name: { ja: "たんぽぽ ×4", en: "Dandelion x4" } },
    { key: "ink_sac", itemId: "minecraft:ink_sac", giveAmount: 4, name: { ja: "イカスミ ×4", en: "Ink Sac x4" } },
    { key: "glow_ink_sac", itemId: "minecraft:glow_ink_sac", giveAmount: 2, name: { ja: "輝くインク袋 ×2", en: "Glow Ink Sac x2" } },
    { key: "kelp", itemId: "minecraft:kelp", giveAmount: 8, name: { ja: "コンブ ×8", en: "Kelp x8" } },
    { key: "bamboo", itemId: "minecraft:bamboo", giveAmount: 8, name: { ja: "竹 ×8", en: "Bamboo x8" } },
    { key: "raw_fish", giveAmount: 4, name: { ja: "生魚(日替わり)", en: "Raw Fish (Daily)" }, variants: [
      { itemId: "minecraft:cod", name: { ja: "生タラ", en: "Raw Cod" } },
      { itemId: "minecraft:salmon", name: { ja: "生サケ", en: "Raw Salmon" } },
      { itemId: "minecraft:tropical_fish", name: { ja: "熱帯魚", en: "Tropical Fish" } },
      { itemId: "minecraft:pufferfish", name: { ja: "フグ", en: "Pufferfish" } }
    ]},
    { key: "raw_meat", giveAmount: 4, name: { ja: "生肉(日替わり)", en: "Raw Meat (Daily)" }, variants: [
      { itemId: "minecraft:beef", name: { ja: "生の牛肉", en: "Raw Beef" } },
      { itemId: "minecraft:porkchop", name: { ja: "生の豚肉", en: "Raw Porkchop" } },
      { itemId: "minecraft:chicken", name: { ja: "生の鶏肉", en: "Raw Chicken" } },
      { itemId: "minecraft:mutton", name: { ja: "生の羊肉", en: "Raw Mutton" } },
      { itemId: "minecraft:rabbit", name: { ja: "生の兎肉", en: "Raw Rabbit" } }
    ]},
    { key: "egg", itemId: "minecraft:egg", giveAmount: 6, name: { ja: "タマゴ ×6", en: "Egg x6" } },
    { key: "sugar_cane", itemId: "minecraft:sugar_cane", giveAmount: 6, name: { ja: "サトウキビ ×6", en: "Sugar Cane x6" } },
    { key: "bone", itemId: "minecraft:bone", giveAmount: 4, name: { ja: "骨 ×4", en: "Bone x4" } },
    { key: "rotten_flesh", itemId: "minecraft:rotten_flesh", giveAmount: 6, name: { ja: "腐った肉 ×6", en: "Rotten Flesh x6" } },
    { key: "spider_eye", itemId: "minecraft:spider_eye", giveAmount: 3, name: { ja: "クモの目 ×3", en: "Spider Eye x3" } },
    { key: "big_dripleaf", itemId: "minecraft:big_dripleaf", giveAmount: 2, name: { ja: "ドロップリーフ大 ×2", en: "Big Dripleaf x2" } },
    { key: "small_dripleaf", itemId: "minecraft:small_dripleaf", giveAmount: 3, name: { ja: "ドロップリーフ小 ×3", en: "Small Dripleaf x3" } },
    { key: "spore_blossom", itemId: "minecraft:spore_blossom", giveAmount: 1, name: { ja: "胞子の花", en: "Spore Blossom" } },
    { key: "string", itemId: "minecraft:string", giveAmount: 6, name: { ja: "糸 ×6", en: "String x6" } },
    { key: "nether_wart", itemId: "minecraft:nether_wart", giveAmount: 4, name: { ja: "ネザーウォート ×4", en: "Nether Wart x4" } },
    { key: "slime_ball", itemId: "minecraft:slime_ball", giveAmount: 3, name: { ja: "スライムボール ×3", en: "Slime Ball x3" } },
    { key: "cactus", itemId: "minecraft:cactus", giveAmount: 4, name: { ja: "サボテン ×4", en: "Cactus x4" } },
    { key: "sulfur_spike", itemId: "minecraft:sulfur_spike", giveAmount: 2, name: { ja: "硫黄の結晶柱 ×2", en: "Sulfur Spike x2" } },
    { key: "pointed_dripstone", itemId: "minecraft:pointed_dripstone", giveAmount: 1, name: { ja: "鍾乳石", en: "Pointed Dripstone" } },
    { key: "cocoa_beans", itemId: "minecraft:cocoa_beans", giveAmount: 4, name: { ja: "カカオ ×4", en: "Cocoa Beans x4" } },
    { key: "copper_ingot", itemId: "minecraft:copper_ingot", giveAmount: 3, name: { ja: "銅インゴット ×3", en: "Copper Ingot x3" } },
    { key: "iron_ingot", itemId: "minecraft:iron_ingot", giveAmount: 3, name: { ja: "鉄インゴット ×3", en: "Iron Ingot x3" } },
    { key: "brick", itemId: "minecraft:brick", giveAmount: 4, name: { ja: "レンガ ×4", en: "Brick x4" } },
    { key: "resin_bricks", itemId: "minecraft:resin_bricks", giveAmount: 3, name: { ja: "樹脂レンガ ×3", en: "Resin Bricks x3" } }
  ],

  household: [
    { key: "music_disc", giveAmount: 1, name: { ja: "レコード(日替わり)", en: "Music Disc (Daily)" }, variants: MUSIC_DISCS },
    { key: "item_frame", itemId: "minecraft:item_frame", giveAmount: 1, name: { ja: "額縁", en: "Item Frame" } },
    { key: "glow_item_frame", itemId: "minecraft:glow_item_frame", giveAmount: 1, name: { ja: "輝く額縁", en: "Glow Item Frame" } },
    { key: "candle", itemId: "minecraft:candle", giveAmount: 2, name: { ja: "ろうそく ×2", en: "Candle x2" } },
    { key: "bed", itemId: "minecraft:white_bed", giveAmount: 1, name: { ja: "ベッド", en: "Bed" } },
    { key: "lantern", itemId: "minecraft:lantern", giveAmount: 2, name: { ja: "ランタン ×2", en: "Lantern x2" } },
    { key: "lectern", itemId: "minecraft:lectern", giveAmount: 1, name: { ja: "書見台", en: "Lectern" } },
    { key: "flower_pot", itemId: "minecraft:flower_pot", giveAmount: 2, name: { ja: "植木鉢 ×2", en: "Flower Pot x2" } },
    { key: "cauldron", itemId: "minecraft:cauldron", giveAmount: 1, name: { ja: "大釜", en: "Cauldron" } },
    { key: "bell", itemId: "minecraft:bell", giveAmount: 1, name: { ja: "ベル", en: "Bell" } },
    { key: "brewing_stand", itemId: "minecraft:brewing_stand", giveAmount: 1, name: { ja: "醸造台", en: "Brewing Stand" } },
    { key: "spyglass", itemId: "minecraft:spyglass", giveAmount: 1, name: { ja: "望遠鏡", en: "Spyglass" } },
    { key: "minecart", itemId: "minecraft:minecart", giveAmount: 1, name: { ja: "トロッコ", en: "Minecart" } },
    { key: "boat", itemId: "minecraft:oak_boat", giveAmount: 1, name: { ja: "ボート", en: "Boat" } },
    { key: "glass_bottle", itemId: "minecraft:glass_bottle", giveAmount: 3, name: { ja: "ガラス瓶 ×3", en: "Glass Bottle x3" } },
    { key: "coal", itemId: "minecraft:coal", giveAmount: 4, name: { ja: "石炭 ×4", en: "Coal x4" } },
    { key: "charcoal", itemId: "minecraft:charcoal", giveAmount: 4, name: { ja: "木炭 ×4", en: "Charcoal x4" } },
    { key: "shelf", itemId: "minecraft:shelf", giveAmount: 2, name: { ja: "棚 ×2", en: "Shelf x2" } },
    { key: "flint", itemId: "minecraft:flint", giveAmount: 4, name: { ja: "火打石 ×4", en: "Flint x4" } },
    { key: "brush", itemId: "minecraft:brush", giveAmount: 1, name: { ja: "ブラシ", en: "Brush" } },
    { key: "sand", itemId: "minecraft:sand", giveAmount: 8, name: { ja: "砂 ×8", en: "Sand x8" } },
    { key: "farmland", itemId: "minecraft:farmland", giveAmount: 4, name: { ja: "耕地 ×4", en: "Farmland x4" } },
    { key: "jack_o_lantern", itemId: "minecraft:jack_o_lantern", giveAmount: 1, name: { ja: "ジャック・オ・ランタン", en: "Jack o'Lantern" } },
    { key: "clay_ball", itemId: "minecraft:clay_ball", giveAmount: 4, name: { ja: "粘土 ×4", en: "Clay Ball x4" } },
    { key: "mud", itemId: "minecraft:mud", giveAmount: 4, name: { ja: "泥 ×4", en: "Mud x4" } }
  ],

  redstone: [
    { key: "observer", itemId: "minecraft:observer", giveAmount: 1, name: { ja: "オブザーバー", en: "Observer" } },
    { key: "blast_furnace", itemId: "minecraft:blast_furnace", giveAmount: 1, name: { ja: "溶鉱炉", en: "Blast Furnace" } },
    { key: "barrel", itemId: "minecraft:barrel", giveAmount: 1, name: { ja: "樽", en: "Barrel" } },
    { key: "composter", itemId: "minecraft:composter", giveAmount: 1, name: { ja: "コンポスター", en: "Composter" } },
    { key: "grindstone", itemId: "minecraft:grindstone", giveAmount: 1, name: { ja: "砥石", en: "Grindstone" } },
    { key: "anvil", itemId: "minecraft:anvil", giveAmount: 1, name: { ja: "金床", en: "Anvil" } },
    { key: "chest", itemId: "minecraft:chest", giveAmount: 1, name: { ja: "チェスト", en: "Chest" } },
    { key: "redstone_repeater", itemId: "minecraft:repeater", giveAmount: 1, name: { ja: "レッドストーンリピーター", en: "Redstone Repeater" } },
    { key: "redstone_comparator", itemId: "minecraft:comparator", giveAmount: 1, name: { ja: "レッドストーンコンパレーター", en: "Redstone Comparator" } },
    { key: "dropper", itemId: "minecraft:dropper", giveAmount: 1, name: { ja: "ドロッパー", en: "Dropper" } },
    { key: "dispenser", itemId: "minecraft:dispenser", giveAmount: 1, name: { ja: "ディスペンサー", en: "Dispenser" } },
    { key: "sticky_piston", itemId: "minecraft:sticky_piston", giveAmount: 1, name: { ja: "粘着ピストン", en: "Sticky Piston" } },
    { key: "hopper", itemId: "minecraft:hopper", giveAmount: 1, name: { ja: "ホッパー", en: "Hopper" } },
    { key: "ender_chest", itemId: "minecraft:ender_chest", giveAmount: 1, name: { ja: "エンダーチェスト", en: "Ender Chest" } },
    { key: "daylight_detector", itemId: "minecraft:daylight_detector", giveAmount: 1, name: { ja: "日照センサー", en: "Daylight Sensor" } },
    { key: "noteblock", itemId: "minecraft:noteblock", giveAmount: 1, name: { ja: "音符ブロック", en: "Note Block" } },
    { key: "shulker_box", itemId: "minecraft:shulker_box", giveAmount: 1, name: { ja: "シュルカーボックス", en: "Shulker Box" } },
    { key: "bookshelf", itemId: "minecraft:bookshelf", giveAmount: 1, name: { ja: "本棚", en: "Bookshelf" } },
    { key: "smoker", itemId: "minecraft:smoker", giveAmount: 1, name: { ja: "燻製器", en: "Smoker" } }
  ],

  gear: [
    { key: "netherite_sword", itemId: "minecraft:netherite_sword", giveAmount: 1, name: { ja: "ネザライトの剣", en: "Netherite Sword" } },
    { key: "netherite_spear", itemId: "minecraft:netherite_spear", giveAmount: 1, name: { ja: "ネザライトの槍", en: "Netherite Spear" } },
    { key: "netherite_pickaxe", itemId: "minecraft:netherite_pickaxe", giveAmount: 1, name: { ja: "ネザライトのつるはし", en: "Netherite Pickaxe" } },
    { key: "netherite_axe", itemId: "minecraft:netherite_axe", giveAmount: 1, name: { ja: "ネザライトの斧", en: "Netherite Axe" } },
    { key: "netherite_shovel", itemId: "minecraft:netherite_shovel", giveAmount: 1, name: { ja: "ネザライトのシャベル", en: "Netherite Shovel" } },
    { key: "netherite_hoe", itemId: "minecraft:netherite_hoe", giveAmount: 1, name: { ja: "ネザライトのクワ", en: "Netherite Hoe" } },
    { key: "mace", itemId: "minecraft:mace", giveAmount: 1, name: { ja: "メイス", en: "Mace" } },
    { key: "bow", itemId: "minecraft:bow", giveAmount: 1, name: { ja: "弓", en: "Bow" } },
    { key: "crossbow", itemId: "minecraft:crossbow", giveAmount: 1, name: { ja: "クロスボウ", en: "Crossbow" } },
    { key: "netherite_helmet", itemId: "minecraft:netherite_helmet", giveAmount: 1, name: { ja: "ネザライトのヘルメット", en: "Netherite Helmet" } },
    { key: "netherite_chestplate", itemId: "minecraft:netherite_chestplate", giveAmount: 1, name: { ja: "ネザライトのチェストプレート", en: "Netherite Chestplate" } },
    { key: "netherite_leggings", itemId: "minecraft:netherite_leggings", giveAmount: 1, name: { ja: "ネザライトのレギンス", en: "Netherite Leggings" } },
    { key: "netherite_boots", itemId: "minecraft:netherite_boots", giveAmount: 1, name: { ja: "ネザライトのブーツ", en: "Netherite Boots" } },
    { key: "arrow", itemId: "minecraft:arrow", giveAmount: 16, name: { ja: "矢 ×16", en: "Arrow x16" } },
    { key: "shears", itemId: "minecraft:shears", giveAmount: 1, name: { ja: "ハサミ", en: "Shears" } },
    { key: "fishing_rod", itemId: "minecraft:fishing_rod", giveAmount: 1, name: { ja: "釣り竿", en: "Fishing Rod" } },
    { key: "turtle_helmet", itemId: "minecraft:turtle_helmet", giveAmount: 1, name: { ja: "甲羅の帽子", en: "Turtle Shell Helmet" } },
    { key: "shield", itemId: "minecraft:shield", giveAmount: 1, name: { ja: "盾", en: "Shield" } },
    { key: "netherite_nautilus_armor", itemId: "minecraft:netherite_nautilus_armor", giveAmount: 1, name: { ja: "ネザライトのオウムガイの鎧", en: "Netherite Nautilus Armor" } },
    { key: "netherite_horse_armor", itemId: "minecraft:netherite_horse_armor", giveAmount: 1, name: { ja: "ネザライトの馬鎧", en: "Netherite Horse Armor" } },
    { key: "bundle", itemId: "minecraft:bundle", giveAmount: 1, name: { ja: "バンドル", en: "Bundle" } },
    { key: "saddle", itemId: "minecraft:saddle", giveAmount: 1, name: { ja: "鞍（サドル）", en: "Saddle" } },
    { key: "compass", itemId: "minecraft:compass", giveAmount: 1, name: { ja: "コンパス", en: "Compass" } },
    { key: "clock", itemId: "minecraft:clock", giveAmount: 1, name: { ja: "時計", en: "Clock" } },
    { key: "wolf_armor", itemId: "minecraft:wolf_armor", giveAmount: 1, name: { ja: "狼の鎧", en: "Wolf Armor" } }
  ],

  // 本(エンチャント)専門コーナー。以前は防具・アイテムに雑多に混ざっていたのと、
  // 「無限・修繕・シルクタッチ・効率強化V以外」を1本にまとめてランダム抽選にしていたが、
  // 欲しいエンチャントを選んで確実に買えるよう、38種すべてを個別の商品に分けた。
  books: [
    ...ENCHANTED_BOOK_COMMON_ITEMS,
    { key: "book_silk_touch", itemId: "minecraft:enchanted_book", giveAmount: 1, name: { ja: "エンチャント本（シルクタッチ）", en: "Enchanted Book (Silk Touch)" }, enchant: { id: "silk_touch", level: 1 } },
    { key: "book_efficiency5", itemId: "minecraft:enchanted_book", giveAmount: 1, name: { ja: "エンチャント本（効率強化V）", en: "Enchanted Book (Efficiency V)" }, enchant: { id: "efficiency", level: 5 } },
    { key: "book_infinity", itemId: "minecraft:enchanted_book", giveAmount: 1, name: { ja: "エンチャント本（無限）", en: "Enchanted Book (Infinity)" }, enchant: { id: "infinity", level: 1 } },
    { key: "book_mending", itemId: "minecraft:enchanted_book", giveAmount: 1, name: { ja: "エンチャント本（修繕）", en: "Enchanted Book (Mending)" }, enchant: { id: "mending", level: 1 } }
  ]
};

// レア・ボスドロップ品（「超高い」グレード。通常カタログには出さず、
// 日替わりの「お買い得コーナー」枠のみで購入可能）
const MAIL_ORDER_RARE_SPECS = [
  { key: "prismarine_shard", itemId: "minecraft:prismarine_shard", giveAmount: 4, name: { ja: "プリズマリンの破片 ×4", en: "Prismarine Shard x4" } },
  { key: "prismarine_crystals", itemId: "minecraft:prismarine_crystals", giveAmount: 4, name: { ja: "プリズマリンの結晶 ×4", en: "Prismarine Crystals x4" } },
  { key: "blaze_rod", itemId: "minecraft:blaze_rod", giveAmount: 2, name: { ja: "ブレイズロッド ×2", en: "Blaze Rod x2" } },
  { key: "breeze_rod", itemId: "minecraft:breeze_rod", giveAmount: 2, name: { ja: "ブリーズロッド ×2", en: "Breeze Rod x2" } },
  { key: "ghast_tear", itemId: "minecraft:ghast_tear", giveAmount: 2, name: { ja: "ガストの涙 ×2", en: "Ghast Tear x2" } },
  { key: "recovery_compass", itemId: "minecraft:recovery_compass", giveAmount: 1, name: { ja: "リカバリーコンパス", en: "Recovery Compass" } },
  { key: "smithing_template", giveAmount: 1, name: { ja: "鍛冶型(日替わり)", en: "Smithing Template (Daily)" }, variants: SMITHING_TEMPLATES },
  { key: "nether_star", itemId: "minecraft:nether_star", giveAmount: 1, name: { ja: "ネザースター", en: "Nether Star" } },
  { key: "blaze_powder", itemId: "minecraft:blaze_powder", giveAmount: 4, name: { ja: "ブレイズパウダー ×4", en: "Blaze Powder x4" } },
  { key: "dragon_breath", itemId: "minecraft:dragon_breath", giveAmount: 1, name: { ja: "ドラゴンブレス", en: "Dragon's Breath" } },
  { key: "shulker_shell", itemId: "minecraft:shulker_shell", giveAmount: 1, name: { ja: "シュルカーの殻", en: "Shulker Shell" } },
  { key: "magma_cream", itemId: "minecraft:magma_cream", giveAmount: 3, name: { ja: "マグマクリーム ×3", en: "Magma Cream x3" } },
  { key: "end_crystal", itemId: "minecraft:end_crystal", giveAmount: 1, name: { ja: "エンドクリスタル", en: "End Crystal" } },
  { key: "elytra", itemId: "minecraft:elytra", giveAmount: 1, name: { ja: "エリトラ", en: "Elytra" } },
  { key: "totem_of_undying", itemId: "minecraft:totem_of_undying", giveAmount: 1, name: { ja: "不死のトーテム", en: "Totem of Undying" } },
  { key: "amethyst_shard", itemId: "minecraft:amethyst_shard", giveAmount: 3, name: { ja: "アメジストの欠片 ×3", en: "Amethyst Shard x3" } },
  { key: "budding_amethyst", itemId: "minecraft:budding_amethyst", giveAmount: 1, name: { ja: "芽生えたアメジスト", en: "Budding Amethyst" } },
  { key: "ender_pearl", itemId: "minecraft:ender_pearl", giveAmount: 2, name: { ja: "エンダーパール ×2", en: "Ender Pearl x2" } },
  { key: "ender_eye", itemId: "minecraft:ender_eye", giveAmount: 2, name: { ja: "エンダーアイ ×2", en: "Eye of Ender x2" } },
  { key: "crying_obsidian", itemId: "minecraft:crying_obsidian", giveAmount: 2, name: { ja: "泣く黒曜石 ×2", en: "Crying Obsidian x2" } },
  { key: "beacon", itemId: "minecraft:beacon", giveAmount: 1, name: { ja: "ビーコン", en: "Beacon" } },
  { key: "enchanting_table", itemId: "minecraft:enchanting_table", giveAmount: 1, name: { ja: "エンチャントテーブル", en: "Enchanting Table" } }
];

// ---- 価格付け ----

// エンチャント本のキー → 価格段階(village-pricing-data.js の ENCHANT_BOOK_LABOR_DAYS のキー)
const BOOK_TIER_BY_KEY = {
  book_silk_touch: "silk_touch_efficiency5",
  book_efficiency5: "silk_touch_efficiency5",
  book_infinity: "infinity_mending",
  book_mending: "infinity_mending"
};

function baseItemIds(entry) {
  if (entry.variants && entry.variants.length > 0) return entry.variants.map((v) => v.itemId);
  if (entry.itemId === "minecraft:enchanted_book") {
    return ["enchanted_book:" + (BOOK_TIER_BY_KEY[entry.key] ?? "common")];
  }
  return [entry.itemId];
}

// HRMHRMが各品目を常に出品している数(giveAmount単位の口数)。将来の取引所化で、プレイヤーの出品が
// 売れ残っても買い手が困らないよう、この数を下限として自動補充する想定の設定値。
// 現状のカタログは在庫無制限扱いで、購入数をこの数で制限していない(データとして持つだけ)。
// 値は暫定。安価な生鮮ほど多く、高価・希少ほど少なくした。
export const MAIL_ORDER_STANDING_STOCK = {
  fresh: 99,
  household: 50,
  redstone: 30,
  gear: 10,
  books: 5,
  rare: 3
};

// ベースの価格(丸め前)。= 基準価格 × giveAmount × MAIL_ORDER_MARKUP
export function getMailOrderBasePrice(entry) {
  const ids = baseItemIds(entry);
  const avg = ids.reduce((sum, id) => sum + getItemBasePriceExact(id), 0) / ids.length;
  return avg * (entry.giveAmount ?? 1) * MAIL_ORDER_MARKUP;
}

// 実際の価格(E)。ベース × 掛率(price-level.js)を四捨五入、最低1E。読む時に計算するので、インフレ指数が動けば追従する。
export function getMailOrderPrice(entry) {
  return Math.max(1, Math.round(getMailOrderBasePrice(entry) * getPriceLevel()));
}

// price は「読む時に計算する」プロパティにする(スプレッドで複製された時点の値が使われる)。
// 以前の「安い品は個数を増やして4E以上にする」まとめ売りは、掛率64で丸めの問題がなくなったため廃止し、
// 元のカタログの個数に戻した。
function priced(list, categoryKey) {
  return list.map((entry) => {
    const out = { ...entry, standingStock: MAIL_ORDER_STANDING_STOCK[categoryKey] };
    Object.defineProperty(out, "price", { get: () => getMailOrderPrice(out), enumerable: true, configurable: true });
    return out;
  });
}

export const MAIL_ORDER_CATALOG = Object.fromEntries(
  Object.entries(MAIL_ORDER_CATALOG_SPECS).map(([catKey, list]) => [catKey, priced(list, catKey)])
);

// レア・ボスドロップ品(「お買い得コーナー」枠のみで購入可能)
export const MAIL_ORDER_RARE_POOL = priced(MAIL_ORDER_RARE_SPECS, "rare");


// お買い得コーナーの割引率（20%引き）と、1日に並ぶ点数
export const BARGAIN_DISCOUNT = 0.8;
export const BARGAIN_ITEM_COUNT = 5;


