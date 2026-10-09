import { ItemStack } from "@minecraft/server";
import { quoteInCurrency } from "../economy/village-pricing.js";

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

const MOB_TRADE_SPECS = {
  honeycomb: [
    { id: "minecraft:honey_bottle", key: "item.honey_bottle.name" },
    { id: "minecraft:poppy", key: "item.poppy.name" },
    { id: "minecraft:dandelion", key: "item.dandelion.name" },
    { id: "minecraft:cornflower", key: "item.cornflower.name" },
    { id: "minecraft:allium", key: "item.allium.name" },
    { id: "minecraft:sunflower", key: "item.sunflower.name" },
    { id: "minecraft:oxeye_daisy", key: "item.oxeye_daisy.name" }
  ],
  apple: [
    { id: "minecraft:saddle", key: "item.saddle.name" },
    { id: "minecraft:lead", key: "item.lead.name" },
    { id: "minecraft:name_tag", key: "item.name_tag.name" },
    { id: "minecraft:leather_horse_armor", key: "item.horsearmorleather.name" },
    { id: "minecraft:iron_horse_armor", key: "item.horsearmoriron.name" },
    { id: "minecraft:golden_horse_armor", key: "item.horsearmorgold.name" },
    { id: "minecraft:diamond_horse_armor", key: "item.horsearmordiamond.name" },
    { id: "minecraft:netherite_horse_armor", key: "item.netherite_horse_armor.name" },
    { id: "minecraft:apple", key: "item.apple.name" }
  ],
  sweet_berry: [
    { id: "minecraft:sweet_berries", key: "item.sweet_berries.name" },
    { id: "minecraft:glow_berries", key: "item.glow_berries.name" },
    { id: "minecraft:rabbit_foot", key: "item.rabbit_foot.name" },
    { id: "minecraft:rabbit_hide", key: "item.rabbit_hide.name" },
    { id: "minecraft:chicken", key: "item.chicken.name" },
    { id: "minecraft:feather", key: "item.feather.name" }
  ],
  glow_berry: [
    { id: "minecraft:glow_ink_sac", key: "item.glow_ink_sac.name" },
    { id: "minecraft:ink_sac", key: "item.ink_sac.name" },
    { id: "minecraft:tropical_fish_bucket", key: "item.tropical_fish_bucket.name" },
    { id: "minecraft:pufferfish_bucket", key: "item.pufferfish_bucket.name" },
    { id: "minecraft:sea_pickle", key: "item.sea_pickle.name" },
    { id: "minecraft:nautilus_shell", key: "item.nautilus_shell.name" }
  ],
  chorus_fruit: [
    { id: "minecraft:ender_pearl", key: "item.ender_pearl.name" },
    { id: "minecraft:shulker_shell", key: "item.shulker_shell.name" },
    { id: "minecraft:popped_chorus_fruit", key: "item.chorus_fruit_popped.name" },
    { id: "minecraft:dragon_breath", key: "item.dragon_breath.name" },
    { id: "minecraft:end_rod", key: "item.end_rod.name" },
    { id: "minecraft:chorus_flower", key: "item.chorus_flower.name" }
  ]
};


// ==========================================
// 価格の決め方(統一プライシングエンジン / dev/pricing-guide.md・dev/pricing-settings.md)
// ------------------------------------------
// 各品目の基準価格(エメラルド)を、窓口の外貨の基準レート(CURRENCIES[...].baseRate)で割って
// 外貨単位に直す。外貨の最小単位は1通貨(HNY=2E, APL=1.5E, SWB=0.8E, GLB=3E, CHO=5E)なので、
// 1個が数E未満の品は「lot個で1口」(買い=lot個受け取る / 売り=lot個渡す)になる。
//   value … 1口あたりの外貨単位数(買値。買取は従来通り value × 0.6 を切り上げ、最低1)
//   lot   … 1口の個数(スタックできない品は1固定。village-pricing-data.js の MAX_LOT_OVERRIDES)
// 外貨の相場変動(getCurrencyRate)は従来通り、基準レートからの上下としてそのまま効く。
// ==========================================
export const MOB_TRADE_ITEMS = Object.fromEntries(
  Object.entries(MOB_TRADE_SPECS).map(([currKey, list]) => [
    currKey,
    list.map((entry) => {
      const q = quoteInCurrency(entry.id, currKey);
      return { ...entry, value: q.value, lot: q.lot };
    })
  ])
);

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


