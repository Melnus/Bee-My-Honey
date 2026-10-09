// ==========================================
// 生鮮市場 (Fresh Market) データ
// ------------------------------------------
// 苔ブロック+植木鉢(ウーパールーパー=GLB窓口)の画面から入る。通貨は外貨GLB(グローベリー)。
// 対象は「生鮮物=食べ物」のみ(2026-09-27確定)。ジャンルはtag-dictionary.jsの genre:* を使う。
//
// 仕組み(dev/spec-03-templates-agreed.md 9/28版):
//   - 初期在庫ゼロ。プレイヤーがシュルカーで納品して初めて出品(trade_order)になる
//   - 出品は匿名(UIには出品番号だけ表示、issuerは代金の入金先解決のため内部で保持)
//   - 商品(品目)ごとに1ページ: 価格推移グラフ+出品リスト(安い順)
//   - 納品時の価格は目安(basePrice × 産地のregionTag補正)を提示するが、最終価格はプレイヤーが入力
//
// basePriceはGLB建て・1個あたりの暫定値。運用を見て調整すること。
// ==========================================

export const FM_GENRES = [
  {
    tag: "genre:seafood",
    items: [
      { id: "minecraft:cod",           locKey: "item.fish.name",           basePrice: 4 },
      { id: "minecraft:salmon",        locKey: "item.salmon.name",         basePrice: 5 },
      { id: "minecraft:tropical_fish", locKey: "item.clownfish.name",      basePrice: 8 },
      { id: "minecraft:pufferfish",    locKey: "item.pufferfish.name",     basePrice: 8 },
      { id: "minecraft:kelp",          locKey: "item.kelp.name",           basePrice: 2 }
    ]
  },
  {
    tag: "genre:meat",
    items: [
      { id: "minecraft:beef",     locKey: "item.beef.name",     basePrice: 6 },
      { id: "minecraft:porkchop", locKey: "item.porkchop.name", basePrice: 6 },
      { id: "minecraft:chicken",  locKey: "item.chicken.name",  basePrice: 4 },
      { id: "minecraft:mutton",   locKey: "item.mutton.name",   basePrice: 5 },
      { id: "minecraft:rabbit",   locKey: "item.rabbit.name",   basePrice: 5 }
    ]
  },
  {
    tag: "genre:produce",
    items: [
      { id: "minecraft:wheat",    locKey: "item.wheat.name",    basePrice: 2 },
      { id: "minecraft:potato",   locKey: "item.potato.name",   basePrice: 2 },
      { id: "minecraft:carrot",   locKey: "item.carrot.name",   basePrice: 2 },
      { id: "minecraft:beetroot", locKey: "item.beetroot.name", basePrice: 3 }
    ]
  },
  {
    tag: "genre:dairy",
    items: [
      { id: "minecraft:milk_bucket", locKey: "item.bucketMilk.name", basePrice: 6 },
      { id: "minecraft:egg",         locKey: "item.egg.name",        basePrice: 2 }
    ]
  }
];

export function getFmGenre(tag) {
  return FM_GENRES.find((g) => g.tag === tag) ?? null;
}

export function getFmItem(itemId) {
  for (const g of FM_GENRES) {
    const item = g.items.find((i) => i.id === itemId);
    if (item) return { ...item, genreTag: g.tag };
  }
  return null;
}

// 1ジャンルの掲示板に載せられる出品数の上限。出品は世界共有の動的プロパティ(文字列1本、
// 上限約32KB)にJSONで保存するため、溢れて保存失敗しないよう余裕を持たせて制限する。
export const FM_MAX_ORDERS_PER_GENRE = 80;

// 納品時の価格入力の許容範囲(GLB/個)。極端な値による桁あふれ・悪ふざけ防止。
export const FM_PRICE_MIN = 1;
export const FM_PRICE_MAX = 500;

// 価格目安の幅(目安価格の±この割合を「予想価格帯」として提示する)
export const FM_SUGGEST_BAND = 0.25;

// 購入時に選べる数量(1回のドロップが1スタック以内に収まる範囲)
export const FM_BUY_QUANTITIES = [1, 16, 64];

// 掲示板に表示する出品の最大件数(安い順の上位)。ボタン数の上限対策。
export const FM_LIST_MAX_ORDERS = 10;

// 鮮度の概念が無い品目(生コンブ等)の出品を、放置されたものとして取り下げるまでの日数
export const FM_NONPERISHABLE_MAX_AGE_DAYS = 28;

// 価格推移グラフに使う直近の約定件数
export const FM_CHART_POINTS = 14;


