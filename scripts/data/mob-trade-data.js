import { ItemStack } from "@minecraft/server";

// ==========================================
// 動物交易(モブトレード) 設定データ
// ==========================================
// ブロック+本の右クリックで、対応する外貨の交易窓口を開く。
// ※ hive(巣箱)は既存のメインメニュー起動用として残し、nest(巣)はハチとの交易専用にする。
// bee_nest だけは単体で反応する（誤爆しにくい自然湧きブロックのため）。
// それ以外の4種は、うっかり本を持って右クリックしただけで開いてしまわないよう、
// 「真上に植木鉢を置く」という一手間を条件に加える。
export const MOB_EXCHANGE_BLOCKS = {
  "minecraft:hay_block": "apple",
  "minecraft:spruce_log": "sweet_berry",
  "minecraft:moss_block": "glow_berry",
  "minecraft:end_bricks": "chorus_fruit"
};

export const MOB_NAMES = {
  honeycomb: { ja: "ハチ", en: "The Bees" },
  apple: { ja: "馬と猫", en: "The Horse and Cat" },
  sweet_berry: { ja: "キツネ", en: "The Fox" },
  glow_berry: { ja: "ウーパールーパー", en: "The Axolotl" },
  chorus_fruit: { ja: "ドラゴンやエンダーマイト、シュルカーたち", en: "The Dragon, Endermites, and Shulkers" }
};

export const MOB_TRADE_ITEMS = {
  honeycomb: [
    { id: "minecraft:honey_bottle", key: "item.honey_bottle.name", value: 2 },
    { id: "minecraft:poppy", key: "item.poppy.name", value: 1 },
    { id: "minecraft:dandelion", key: "item.dandelion.name", value: 1 },
    { id: "minecraft:cornflower", key: "item.cornflower.name", value: 1 },
    { id: "minecraft:allium", key: "item.allium.name", value: 1 },
    { id: "minecraft:sunflower", key: "item.sunflower.name", value: 2 },
    { id: "minecraft:oxeye_daisy", key: "item.oxeye_daisy.name", value: 1 }
  ],
  apple: [
    { id: "minecraft:saddle", key: "item.saddle.name", value: 5 },
    { id: "minecraft:lead", key: "item.lead.name", value: 3 },
    { id: "minecraft:name_tag", key: "item.name_tag.name", value: 6 },
    { id: "minecraft:leather_horse_armor", key: "item.horsearmorleather.name", value: 4 },
    { id: "minecraft:iron_horse_armor", key: "item.horsearmoriron.name", value: 6 },
    { id: "minecraft:golden_horse_armor", key: "item.horsearmorgold.name", value: 8 },
    { id: "minecraft:diamond_horse_armor", key: "item.horsearmordiamond.name", value: 14 },
    { id: "minecraft:netherite_horse_armor", key: "item.netherite_horse_armor.name", value: 20 },
    { id: "minecraft:apple", key: "item.apple.name", value: 1 }
  ],
  sweet_berry: [
    { id: "minecraft:sweet_berries", key: "item.sweet_berries.name", value: 1 },
    { id: "minecraft:glow_berries", key: "item.glow_berries.name", value: 2 },
    { id: "minecraft:rabbit_foot", key: "item.rabbit_foot.name", value: 4 },
    { id: "minecraft:rabbit_hide", key: "item.rabbit_hide.name", value: 2 },
    { id: "minecraft:chicken", key: "item.chicken.name", value: 1 },
    { id: "minecraft:feather", key: "item.feather.name", value: 1 }
  ],
  glow_berry: [
    { id: "minecraft:glow_ink_sac", key: "item.glow_ink_sac.name", value: 3 },
    { id: "minecraft:ink_sac", key: "item.ink_sac.name", value: 1 },
    { id: "minecraft:tropical_fish_bucket", key: "item.tropical_fish_bucket.name", value: 5 },
    { id: "minecraft:pufferfish_bucket", key: "item.pufferfish_bucket.name", value: 4 },
    { id: "minecraft:sea_pickle", key: "item.sea_pickle.name", value: 2 },
    { id: "minecraft:nautilus_shell", key: "item.nautilus_shell.name", value: 7 }
  ],
  chorus_fruit: [
    { id: "minecraft:ender_pearl", key: "item.ender_pearl.name", value: 4 },
    { id: "minecraft:shulker_shell", key: "item.shulker_shell.name", value: 8 },
    { id: "minecraft:popped_chorus_fruit", key: "item.chorus_fruit_popped.name", value: 1 },
    { id: "minecraft:dragon_breath", key: "item.dragon_breath.name", value: 6 },
    { id: "minecraft:end_rod", key: "item.end_rod.name", value: 3 },
    { id: "minecraft:chorus_flower", key: "item.chorus_flower.name", value: 2 }
  ]
};

// アイテム名の翻訳キー: ゲーム本体が持つ正しいキーを実行時に取得する。
// （"item.xxx.name" 固定だと、花などBedrockでキー名が違うものが生キーのまま表示されるため）
// ※ ItemStack.localizationKey は早期実行モードでは読めないので、初回利用時に遅延取得してキャッシュする。
export const LOC_KEY_CACHE = new Map();
export function itemLocKey(entry) {
  const id = entry.id ?? entry.itemId;
  if (LOC_KEY_CACHE.has(id)) return LOC_KEY_CACHE.get(id);
  let key = entry.key; // 取得できなければ従来のキーにフォールバック
  try {
    key = new ItemStack(id, 1).localizationKey || entry.key;
  } catch (e) {
    console.warn("[BeeMyHoney] localizationKey lookup failed for " + id + ": " + e);
  }
  LOC_KEY_CACHE.set(id, key);
  return key;
}
