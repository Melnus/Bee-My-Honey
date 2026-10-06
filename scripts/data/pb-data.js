// ==========================================
// Paws & Blackpots (PB) — エネルギー取引所(猫の店)データ
// ------------------------------------------
// 干し草の俵+植木鉢(馬と猫の取引窓口=APL)の画面から入る。通貨はエメラルドではなく外貨APL。
// trade-pool.js の shop型(単一itemIdの実在庫カウンタ)を品目ごとに使う。
//
//   restock: true  … 木炭・石炭。日替わりで目標在庫(各品目の targetStock)まで自動補充される
//   restock: false … ブレイズロッド・マグマバケツ。初期在庫が尽きたら以後入荷しない(補充なし)。
//                    購入には既存のネザーライセンス(labor-data.js の LICENSES.nether)が必要
//
// 値付けは「ネコの店主の気まぐれ」: basePrice に日替わりの乱数倍率(PB_PRICE_FACTOR_MIN〜MAX)を
// かけたものがその日の価格。プレイヤーがネコを撫でたり魚をあげたりして機嫌が上がると値引きされる。
// 価格はAPL建て(整数)で、1口(lot個)あたりの値段。basePriceは統一プライシングエンジンから導出する(下記)。
// ==========================================

import { quoteInCurrency } from "../economy/village-pricing.js";

// 価格の決め方(統一プライシングエンジン / dev/pricing-guide.md・dev/pricing-settings.md):
//   basePrice(APL) = 品目の基準価格(E) × lot ÷ APLの基準レート(1.5E)。四捨五入、最低1。
//   lot … 1口の個数。APLの最小単位が1.5Eなので、石炭のように1個0.2E程度の品は「32個で1口」になる
//         (買い=lot個受け取る / 納品=lot個渡す。在庫もlot個ずつ減る)。
//   ネコの気まぐれ(日替わり0.7〜1.6倍)が整数丸めで潰れないよう、PB_MIN_UNITS 以上になるまでlotを増やす。
//   stock系は「個数」(lotの倍数にしておく)。
const PB_SPECS = [
  { key: "coal",      id: "minecraft:coal",      locKey: "item.coal.name",      initialStock: 320, targetStock: 320, restock: true,  license: null },
  { key: "charcoal",  id: "minecraft:charcoal",  locKey: "item.charcoal.name",  initialStock: 320, targetStock: 320, restock: true,  license: null },
  { key: "blaze_rod", id: "minecraft:blaze_rod", locKey: "item.blaze_rod.name", initialStock: 96,  targetStock: 96,  restock: false, license: "nether" },
  { key: "lava_bucket", id: "minecraft:lava_bucket", locKey: "item.bucketLava.name", initialStock: 100, targetStock: 100, restock: false, license: "nether" }
];

export const PB_MIN_UNITS = 4;

export const PB_ITEMS = PB_SPECS.map((spec) => {
  const q = quoteInCurrency(spec.id, "apple", { minUnits: PB_MIN_UNITS });
  return { ...spec, lot: q.lot, basePrice: q.value };
});

// restock:true の品目を毎日 targetStock(品目ごと。PB_ITEMS 参照)まで補充する。

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
