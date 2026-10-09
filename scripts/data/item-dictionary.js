// ==========================================
// アイテム辞書 (集約レイヤー / Item Dictionary)
// ==========================================
// 「このアイテムについて分かっていることを全部知りたい」を1回の呼び出しで済ませるための
// 集約関数群。既存の4ファイル(それぞれ単機能の出典)はそのまま残し、ここでは何も
// 新しく定義しない(データ移行はしない)。理由: 価格・ジャンル・鮮度・表示名は別々の概念で
// 更新頻度も担当箇所も異なるため、1つのオブジェクトに統合するとメンテが逆に大変になる。
//
// 出典一覧:
//   - market-data.js (COMMODITIES)   … 製品単位の価格銘柄(#1鉱物・一般資源、#2材木もここに乗る想定)
//   - tag-dictionary.js (ITEM_GENRE_TAGS) … ジャンルタグ(#3プール取引向け)
//   - food-data.js (RAW/PROCESSED/NEVER_SPOIL) … 鮮度カテゴリ(#3生鮮市場向け)
//   - item-catalog.js                … 表示名(苗木・生肉・生魚等の全バリエーション)
//
// 新しい銘柄・タグ・鮮度区分を追加するときは、必ず元のファイル側に追記すること。
// このファイルにベタ書きで新規データを足さないこと(集約レイヤーの意味が崩れるため)。

import { COMMODITIES } from "./market-data.js";
import { getGenreTag } from "./tag-dictionary.js";
import { getFoodCategory } from "./food-data.js";

// itemId → COMMODITIESのキー の逆引きテーブル(初回呼び出し時に一度だけ構築)。
// COMMODITIES自体は「キー名で価格を引く」設計のため、itemIdからの逆引きが無いと
// 毎回全件ループすることになるのでキャッシュする。
let _commodityKeyByItemId = null;
function commodityKeyByItemId() {
  if (_commodityKeyByItemId) return _commodityKeyByItemId;
  _commodityKeyByItemId = {};
  for (const [key, def] of Object.entries(COMMODITIES)) {
    _commodityKeyByItemId[def.itemId] = key;
  }
  return _commodityKeyByItemId;
}

// itemIdについて分かっていることを全部まとめて返す。
// どのfacetにも該当しない場合はそれぞれnullになる(=どのシステムからも未登録のアイテム)。
export function getItemInfo(itemId) {
  const commodityKey = commodityKeyByItemId()[itemId] ?? null;
  return {
    itemId,
    commodityKey,                          // #1/#2: 製品単位の価格銘柄(market-data.jsのキー)。無ければnull
    commodity: commodityKey ? COMMODITIES[commodityKey] : null,
    genreTag: getGenreTag(itemId),          // #3: ジャンルタグ(tag-dictionary.js)。無ければnull
    foodCategory: getFoodCategory(itemId)   // #3: 鮮度カテゴリ("raw"|"processed"|null)。腐らない/非食品ならnull
  };
}

// 複数のfacetにまたがって登録されているアイテムを洗い出す簡易チェック用。
// (例: 魚をfood-dataには登録したがtag-dictionaryに登録し忘れている、といった整合性事故の検知に使う)
// 呼び出し側で対象itemIdリストを渡し、抜けているfacetを報告する。
export function checkItemFacetCoverage(itemIds, { expectGenre = false, expectFood = false, expectCommodity = false } = {}) {
  const missing = [];
  for (const itemId of itemIds) {
    const info = getItemInfo(itemId);
    const gaps = [];
    if (expectGenre && !info.genreTag) gaps.push("genreTag");
    if (expectFood && !info.foodCategory) gaps.push("foodCategory");
    if (expectCommodity && !info.commodityKey) gaps.push("commodityKey");
    if (gaps.length > 0) missing.push({ itemId, gaps });
  }
  return missing;
}


