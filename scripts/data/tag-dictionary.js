// ==========================================
// タグ辞書 (namespace:key 形式)
// ==========================================
// 今後の全取引品を横断的に分類するための基盤。namespaceごとに「1アイテム=1タグ」か
// 「複数タグ許容」かのルールが異なる:
//
//   genre  — 取引ジャンル。シュルカー納品判定で「同じgenreタグを持つアイテムなら
//            混在していてもOK」という単位(spec-03-fresh-market.md セクションD)。
//            1アイテム=1genreタグ(二重計上防止のため)。
//   region — 交易拠点の立地区分(バイオーム等)。trade_post(未実装、v0.3.4 #3)向け。
//            1拠点が複数の区分に該当し得るため、こちらは複数タグ許容。
//
// #1(鉱物・一般資源, economy/trade.js の COMMODITIES)は「1アイテム=1銘柄=1シュルカー」の
// 製品単位取引のままで良いため、ここには乗せない。genreタグを持たない=製品単位判定、
// という扱いになる(trade.js 側で分岐)。

export const TAG_NAMESPACES = {
  GENRE: "genre",
  REGION: "region"
};

// ジャンルタグの定義本体。一覧表示用のname/iconを持つ。
// v0.3.4時点ではspec-03-fresh-market.mdの生鮮市場(水産物)向けの分だけ用意し、
// 肉類全般など他ジャンルは#3(生鮮市場)着手時に追記する。
export const GENRE_TAGS = {
  "genre:seafood": {
    name: { ja: "水産物", en: "Seafood" },
    icon: "§b●"
  },
  "genre:meat": {
    name: { ja: "肉類", en: "Meat" },
    icon: "§c●"
  },
  "genre:produce": {
    name: { ja: "農作物", en: "Produce" },
    icon: "§a●"
  },
  "genre:dairy": {
    name: { ja: "乳・卵", en: "Dairy & Eggs" },
    icon: "§e●"
  }
  // 装飾/非食品の水産由来品(サンゴ・プリズマリン系・シーピクルス・オウムガイ・海の心)は
  // 「生鮮市場=食べ物」の線引きにより対象外とすることを決定(2026-09-27)。
  // これらは将来の高級/装飾品市場(未着手・別概念)向けに取り置き、ジャンルには含めない。
};

// 地域タグの定義本体。3段階(近い/普通/遠い)。バイオームの生態的な分類として固定タグにする
// 方式(座標からの幾何学的な距離計算はしない)。priceModifierは生鮮市場の価格目安計算で使う
// 想定の倍率(基準=内陸を0とした相対値)。
export const REGION_TAGS = {
  "region:coastal": {
    name: { ja: "沿岸部(近い)", en: "Coastal (near)" },
    priceModifier: -0.2
  },
  "region:inland": {
    name: { ja: "内陸部(普通)", en: "Inland (normal)" },
    priceModifier: 0
  },
  "region:remote": {
    name: { ja: "僻地(遠い)", en: "Remote (far)" },
    priceModifier: 0.3
  }
};

// バイオームID → regionタグ の静的マッピング。LICENSESのbiomeフィールドと同じ発想。
// 注意: ここに挙げたバイオームIDは統合版(Bedrock)の dimension.getBiome(location).id が
// 返す値を想定して書いているが、実機での突き合わせはまだ行っていない。ズレがあれば
// 実際に確認したIDに直すこと。未登録のバイオームは getRegionTagForBiome が
// "region:inland"(基準値)にフォールバックする。
const BIOME_REGION_MAP = {
  // 沿岸部(coastal) — 水辺に近い。水産物の主要産地として安くなる想定
  ocean: "region:coastal",
  deep_ocean: "region:coastal",
  warm_ocean: "region:coastal",
  lukewarm_ocean: "region:coastal",
  cold_ocean: "region:coastal",
  frozen_ocean: "region:coastal",
  deep_lukewarm_ocean: "region:coastal",
  deep_cold_ocean: "region:coastal",
  deep_frozen_ocean: "region:coastal",
  beach: "region:coastal",
  stone_beach: "region:coastal",
  river: "region:coastal",
  frozen_river: "region:coastal",
  swamp: "region:coastal",
  mangrove_swamp: "region:coastal",
  mushroom_island: "region:coastal", // 海に浮かぶ島という扱いで沿岸寄り

  // 僻地(remote) — 到達しづらい/希少な地形。高くなる想定
  desert: "region:remote",
  badlands: "region:remote",
  eroded_badlands: "region:remote",
  wooded_badlands: "region:remote",
  extreme_hills: "region:remote",
  extreme_hills_plus_trees: "region:remote",
  jagged_peaks: "region:remote",
  frozen_peaks: "region:remote",
  stony_peaks: "region:remote",
  grove: "region:remote",
  snowy_slopes: "region:remote",
  ice_spikes: "region:remote",
  the_end: "region:remote",
  small_end_islands: "region:remote",
  end_barrens: "region:remote",
  end_highlands: "region:remote",
  end_midlands: "region:remote",
  nether_wastes: "region:remote",
  soul_sand_valley: "region:remote",
  crimson_forest: "region:remote",
  warped_forest: "region:remote",
  basalt_deltas: "region:remote",
  deep_dark: "region:remote",
  dripstone_caves: "region:remote",
  lush_caves: "region:remote"

  // 内陸部(inland) — 上記に無い典型的な陸上バイオーム(平原・森林・タイガ・ジャングル・
  // サバンナ等)は BIOME_REGION_MAP に個別登録せず、getRegionTagForBiome のフォールバックで
  // 全て "region:inland"(基準値)扱いにする。バイオーム名の網羅漏れより、
  // 「登録し忘れたら基準値になる」安全側のデフォルトを優先している。
};

// バイオームIDからregionタグを引く。未登録のバイオームは基準値(内陸)にフォールバックする。
export function getRegionTagForBiome(biomeId) {
  return BIOME_REGION_MAP[biomeId] ?? "region:inland";
}

// v0.3.4 #3: trade_post は事前登録不要と判明(交易ブロックは既に物理設置済みのため)。
// 代わりに、取引の都度その場の座標のバイオームを照会してregionタグを引くだけでよい。
// dimension.getBiome(location) が未読み込みチャンク等でundefinedを返すことがあるので、
// その場合も安全に基準値へフォールバックする。
export function getRegionTagAt(dimension, location) {
  let biomeId;
  try {
    biomeId = dimension.getBiome(location)?.id;
  } catch (e) {
    biomeId = undefined;
  }
  return getRegionTagForBiome(biomeId);
}

// itemId → genreタグ の対応表。1アイテム=1genreタグ(重複登録しないこと)。
// spec-03-fresh-market.md セクションC「対象商品」のうち、itemIdの対応が明確なものだけを収録。
// コンブ以外の魚系はfood-data.js の RAW_FOOD_ITEMS と一致する(生鮮市場=鮮度システムの対象でもあるため)。
export const ITEM_GENRE_TAGS = {
  // 水産物(生コンブは食べられないので鮮度対象外=腐らないが、水産物ジャンルには含める)
  "minecraft:cod": "genre:seafood",
  "minecraft:salmon": "genre:seafood",
  "minecraft:tropical_fish": "genre:seafood",
  "minecraft:pufferfish": "genre:seafood",
  "minecraft:kelp": "genre:seafood",
  // 肉類(food-data.jsのRAW_FOOD_ITEMSの肉系と一致)
  "minecraft:beef": "genre:meat",
  "minecraft:porkchop": "genre:meat",
  "minecraft:chicken": "genre:meat",
  "minecraft:mutton": "genre:meat",
  "minecraft:rabbit": "genre:meat",
  // 農作物(未加工)
  "minecraft:wheat": "genre:produce",
  "minecraft:potato": "genre:produce",
  "minecraft:carrot": "genre:produce",
  "minecraft:beetroot": "genre:produce",
  // 乳・卵
  "minecraft:milk_bucket": "genre:dairy",
  "minecraft:egg": "genre:dairy"
  // サンゴ・プリズマリン系・シーピクルス・オウムガイ・海の心は非食品のため対象外
  // (GENRE_TAGSの注記を参照)。ここには追加しないこと。
};

// itemIdの属するgenreタグを引く。未登録なら null(=製品単位判定の対象、というシグナル)。
export function getGenreTag(itemId) {
  return ITEM_GENRE_TAGS[itemId] ?? null;
}

// itemIdが指定genreタグに属するかどうか。
export function itemMatchesGenre(itemId, genreTag) {
  return getGenreTag(itemId) === genreTag;
}


