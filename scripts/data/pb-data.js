// ==========================================
// Paws & Blackpots (PB) — エネルギー取引所(猫の店)データ
// ------------------------------------------
// 干し草の俵+植木鉢(馬と猫の取引窓口=APL)の画面から入る。通貨はエメラルドではなく外貨APL。
// trade-pool.js の shop型(単一itemIdの実在庫カウンタ)を品目ごとに使う。
//
//   restock: true  … 木炭・石炭。日替わりで目標在庫(PB_TARGET_STOCK)まで自動補充される
//   restock: false … ブレイズロッド・マグマバケツ。初期在庫が尽きたら以後入荷しない(補充なし)。
//                    購入には既存のネザーライセンス(labor-data.js の LICENSES.nether)が必要
//
// 値付けは「ネコの店主の気まぐれ」: basePrice に日替わりの乱数倍率(PB_PRICE_FACTOR_MIN〜MAX)を
// かけたものがその日の価格。プレイヤーがネコを撫でたり魚をあげたりして機嫌が上がると値引きされる。
// 価格はAPL建て(整数)。basePriceは暫定値なので、実際の運用を見て調整すること。
// ==========================================

export const PB_ITEMS = [
  { key: "coal",      id: "minecraft:coal",      locKey: "item.coal.name",      basePrice: 3,  initialStock: 100, restock: true,  license: null },
  { key: "charcoal",  id: "minecraft:charcoal",  locKey: "item.charcoal.name",  basePrice: 3,  initialStock: 100, restock: true,  license: null },
  { key: "blaze_rod", id: "minecraft:blaze_rod", locKey: "item.blaze_rod.name", basePrice: 12, initialStock: 100, restock: false, license: "nether" },
  { key: "lava_bucket", id: "minecraft:lava_bucket", locKey: "item.bucketLava.name", basePrice: 16, initialStock: 100, restock: false, license: "nether" }
];

// restock:true の品目を毎日この数まで補充する
export const PB_TARGET_STOCK = 100;

// 納品(買取)価格は、その日の価格に対するこの比率(切り上げ、最低1)。既存の動物交易(mob-trade-menu.js)の買取率と同じ。
export const PB_SELL_RATIO = 0.6;

// 日替わりの価格倍率の幅(ネコの気まぐれ)
export const PB_PRICE_FACTOR_MIN = 0.7;
export const PB_PRICE_FACTOR_MAX = 1.6;

// ネコの機嫌。0〜PB_MOOD_MAX。1ポイントごとに購入価格が PB_MOOD_DISCOUNT_PER_POINT ずつ下がる。
// 機嫌はその日限り(翌日には0に戻る)。プレイヤーごとに別々。
export const PB_MOOD_MAX = 5;
export const PB_MOOD_DISCOUNT_PER_POINT = 0.05;
export const PB_PET_MOOD_GAIN = 1;   // 撫でる(1日1回)
export const PB_GIFT_MOOD_GAIN = 2;  // 魚をあげる(1匹ごと)

// ネコが喜ぶ魚(バニラで猫が食べるもの)
export const PB_GIFT_FISH = ["minecraft:cod", "minecraft:salmon"];
