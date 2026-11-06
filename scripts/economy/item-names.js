import { variantName } from "../data/variant-items-data.js";
import { EXTRA_ITEM_NAMES, prettyName } from "../data/item-names-extra.js";
import { itemInfo } from "./exchange.js";

// ==========================================
// 品目の表示名 / Item Label  (2026-11-05 作者の改善案1)
// ------------------------------------------
// どの画面(取引所・クエスト・村・会社・NPC)も、品目の名前はここから引く。引き方の順:
//   1. 種類つきの品(エンチャント本・ポーション)  2. 取引リスト(日本語名)  3. 追補表(data/item-names-extra.js)
//   4. 外部アドオンの品(economy/external-items.js に登録された名前。取引リストに入っている)  5. IDを整えた英語名
// 英語は、取引リストも追補表も、IDから整えた名前(Oak Planks など)。
// ==========================================
export function itemLabel(itemId, lang) {
  const id = String(itemId ?? "");
  if (!id) return "";
  const v = variantName(id, lang === "ja" ? "ja" : "en");
  if (v) return v;
  const full = id.split("#")[0].includes(":") ? id : "minecraft:" + id;
  if (lang === "ja") {
    const info = itemInfo(full);
    if (info?.ja) return info.ja;
    const x = EXTRA_ITEM_NAMES[full.replace("minecraft:", "")];
    if (x) return x;
  }
  return prettyName(full);
}

// 名前を持っているか(検算用。IDの生表示になっていないか)。
export function hasLabel(itemId) {
  const sid = String(itemId); const full = sid.split("#")[0].includes(":") ? sid : "minecraft:" + sid;
  return !!(variantName(full, "ja") || itemInfo(full)?.ja || EXTRA_ITEM_NAMES[full.replace("minecraft:", "")]);
}
