import { world, system } from "@minecraft/server";

// ==========================================
// 物価水準 / Price Level  (dev/sketch/sketch-inflation-economy.md)
// ------------------------------------------
// 実際の価格 = ベース × 初期掛率 × インフレ指数
//   ベース        … village-pricing.js が出す価格(手間賃10E/日から積み上げた原価×1.20)。名目額も「ベース単位」で持つ。
//   初期掛率      … 設定値。64(1スタック。数百〜数千Eの手触り。プレイヤーの自動化を見込んで安すぎないようにする)。
//                   バニラの村の密度(約64〜70倍)とも矛盾しない概算。値は1行で調整できる。
//   インフレ指数  … 1.0 から始まり、将来は発行台帳(ledger.js の getNetIssuance)で動かす。今は管理コマンドで手動のみ。
// 価格は「読む時」に掛ける(保存しない)。ただし、クエスト受注・融資・カード発行のように「その時点で金額が確定して
// 保存される」ものは、確定時の名目額で保存される(後からインフレしても、借金や契約額は変わらない)。
// ==========================================

export const INITIAL_PRICE_MULTIPLIER = 64;
const INDEX_KEY = "bmh_price_index";

export function getPriceIndex() {
  const v = world.getDynamicProperty(INDEX_KEY);
  return typeof v === "number" && v > 0 ? v : 1;
}

export function setPriceIndex(value) {
  if (!(value > 0)) return false;
  world.setDynamicProperty(INDEX_KEY, value);
  return true;
}

export function getPriceLevel() {
  return INITIAL_PRICE_MULTIPLIER * getPriceIndex();
}

// ベースの金額 → 実際の金額(小数のまま)。市場価格など、後で丸めるもの用。
export function scaleE(base) {
  return base * getPriceLevel();
}

// ベースの名目額 → 実際の金額(整数・最低1)。送料・保険料・賃金など、エメラルドの整数で扱うもの用。
export function scaleEInt(base) {
  return Math.max(1, Math.round(base * getPriceLevel()));
}

// ---- 管理用コマンド: /scriptevent bmh:pricelevel [インフレ指数] ----
export function startPriceLevelScriptEvent() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:pricelevel") return;
    const arg = parseFloat(ev.message);
    let note = "";
    if (ev.message.trim() !== "") {
      note = setPriceIndex(arg) ? " (updated)" : " (ignored: index must be > 0)";
    }
    const text = `[PriceLevel] initial x${INITIAL_PRICE_MULTIPLIER} * index ${getPriceIndex()} = x${getPriceLevel()}${note}`;
    const target = ev.sourceEntity;
    if (target && typeof target.sendMessage === "function") target.sendMessage(text);
    else console.warn("[BeeMyHoney] " + text);
  });
}


