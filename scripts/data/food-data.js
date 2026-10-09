// ==========================================
// 生鮮物・腐敗システム 設定データ (food-data.js)
// ==========================================
// 鮮度は「ゲーム内の日付」ではなく「食べ物がプレイヤーのインベントリに入っていた累計tick」で数える。
//   ・拾った(=巡回で初めて見つけた)瞬間からタイマー開始
//   ・チェスト/樽/シュルカーに入っている間は進まない(スタンプは引き継ぐので、取り出すと続きから進む)
//   ・寝ても /time を動かしても進まない(ワールドが実際に進んだtickだけを数える)
// 詳細な仕組みは economy/freshness.js を参照。

export const FOOD_CATEGORY = {
  RAW: "raw",
  PROCESSED: "processed"
};

export const TICKS_PER_DAY = 24000; // ゲーム内1日 = 20分

// インベントリ内での寿命(tick)。生鮮物=6日 / 加工品=12日
export const FOOD_SHELF_LIFE_TICKS = {
  [FOOD_CATEGORY.RAW]: 6 * TICKS_PER_DAY,
  [FOOD_CATEGORY.PROCESSED]: 12 * TICKS_PER_DAY
};

// 市場(生鮮市場の出品)での寿命(tick)。出品からの経過で連続的に鮮度%が落ちる。
// 仮値: raw=7日 / processed=21日(spec-03 A-4)
export const FOOD_MARKET_SHELF_LIFE_TICKS = {
  [FOOD_CATEGORY.RAW]: 7 * TICKS_PER_DAY,
  [FOOD_CATEGORY.PROCESSED]: 21 * TICKS_PER_DAY
};

// 腐敗した食品の変換先
export const ROTTEN_ITEM_ID = "minecraft:rotten_flesh";

// 生鮮物(未加工・食べられる)
// 魚系・肉系・牛乳・卵・未加工の農作物。今後モッド等で追加される未加工食品は
// このテーブルに載っていない限り自動判定できないため、未登録の食品は
// 暫定でRAW扱い(フォールバック)にする運用とする。
export const RAW_FOOD_ITEMS = new Set([
  // 魚系
  "minecraft:cod",
  "minecraft:salmon",
  "minecraft:tropical_fish",
  "minecraft:pufferfish",
  // 肉系
  "minecraft:beef",
  "minecraft:porkchop",
  "minecraft:chicken",
  "minecraft:mutton",
  "minecraft:rabbit",
  // 乳・卵
  "minecraft:milk_bucket",
  "minecraft:egg",
  // 農作物(未加工)
  "minecraft:wheat",
  "minecraft:potato",
  "minecraft:carrot",
  "minecraft:beetroot"
]);

// 加工品(レシピで作られ、かつ食べられるもの)
export const PROCESSED_FOOD_ITEMS = new Set([
  // 焼いた肉全般
  "minecraft:cooked_beef",
  "minecraft:cooked_porkchop",
  "minecraft:cooked_chicken",
  "minecraft:cooked_mutton",
  "minecraft:cooked_rabbit",
  "minecraft:cooked_cod",
  "minecraft:cooked_salmon",
  // 調理品(菓子類は腐らない扱いなので NEVER_SPOIL_ITEMS 側)
  "minecraft:bread",
  "minecraft:baked_potato",
  // スープ・シチュー
  "minecraft:rabbit_stew",
  "minecraft:mushroom_stew",
  "minecraft:beetroot_soup",
  "minecraft:suspicious_stew",
  // 加工農作物
  "minecraft:dried_kelp"
]);

// 例外: 腐らない食品・アイテム。
// - 砂糖・ハチミツ系は保存食としての扱い
// - 菓子類(ケーキ・クッキー・パンプキンパイ)と金の食べ物(金のリンゴ・金のニンジン)も腐らない扱い
// - 通貨系フルーツ(APL/SWB/GLB/CHO)は「通貨」という設定のため"謎の力で"腐敗対象から除外
// - ポーション類はガラス瓶入りのため対象外
export const NEVER_SPOIL_ITEMS = new Set([
  "minecraft:sugar",
  "minecraft:honeycomb",
  "minecraft:honey_bottle",
  // 菓子類
  "minecraft:cake",
  "minecraft:cookie",
  "minecraft:pumpkin_pie",
  // 金の食べ物
  "minecraft:golden_apple",
  "minecraft:golden_carrot",
  "minecraft:potion",
  "minecraft:splash_potion",
  "minecraft:lingering_potion",
  // 通貨系フルーツ
  "minecraft:apple",
  "minecraft:sweet_berries",
  "minecraft:glow_berries",
  "minecraft:popped_chorus_fruit"
]);

// typeIdからカテゴリを判定する。未登録の食品はRAW扱い(フォールバック)。
// isFood判定(vanilla componentの有無)は呼び出し側(スキャン処理)で行う想定。
export function getFoodCategory(typeId) {
  if (NEVER_SPOIL_ITEMS.has(typeId)) return null;
  if (PROCESSED_FOOD_ITEMS.has(typeId)) return FOOD_CATEGORY.PROCESSED;
  if (RAW_FOOD_ITEMS.has(typeId)) return FOOD_CATEGORY.RAW;
  return null; // 未登録の非食品はそもそも対象外
}


