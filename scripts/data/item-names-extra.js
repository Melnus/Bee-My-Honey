// ==========================================
// 品目名の追補表 / Item Name Supplement  (2026-11-05 作者の改善案1)
// ------------------------------------------
// 表示名の正典は、取引リスト(data/exchange-items-data.js)。この表は、取引リストにない「表示専用」の品だけ。
//   ・英語名は、IDから整えて出す(prettyName)ので、ここは日本語名だけ。
//   ・外部アドオンのIDは、ここではなく economy/external-items.js が扱う。
// 名前を引くのは、economy/item-names.js の itemLabel だけ(どの画面も同じ)。
// ==========================================
export const EXTRA_ITEM_NAMES = {
  // クエストの納品物・ライセンス対象のブロックのうち、取引リストにないもの
  prismarine_shard: "プリズマリンの欠片",
  prismarine_bricks: "プリズマリンレンガ",
  end_bricks: "エンドストーンレンガ",
  // 村の職業ブロック(data/village-jobs-data.js)
  composter: "コンポスター", smoker: "燻製器", blast_furnace: "溶鉱炉", barrel: "樽", fletching_table: "矢細工台",
  loom: "機織り機", stonecutter: "石切台", cartography_table: "製図台", lectern: "書見台",
  brewing_stand: "醸造台", cauldron: "大釜", grindstone: "砥石", smithing_table: "鍛冶台"
};

// IDを読みやすく整える(英語名・名前のない品の表示)。minecraft: は省く。ほかの名前空間(外部アドオン)も省く。
export function prettyName(itemId) {
  const s = String(itemId ?? "");
  const base = s.split("#")[0];
  const short = base.includes(":") ? base.split(":").slice(1).join(":") : base;
  return short.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
