import { FOOD_SHELF_LIFE_TICKS, getFoodCategory } from "../data/food-data.js";

// ==========================================
// 鮮度スタンプの読み取り(純粋な部分) / Freshness Lore Stamp (pure helpers)
// ------------------------------------------
// economy/freshness.js(食品の鮮度システム)がスタックの説明文(lore)に書く「鮮度: ○○%」の行と、末尾に埋め込む見えない
// スタンプ(age / seen)を、読む・取り除く・割合にする、副作用のない部品。取引所(variant-items.js)も使う。
// ==========================================
export const LORE_MARK = "§r§r"; // 自前の行の目印(見た目には影響しない)
export const HEX_LEN = 5; // age / seen をそれぞれ5桁の16進で持つ
export const TAIL_RE = new RegExp("§r((?:§[0-9a-f]){" + HEX_LEN * 2 + "})$");
export const EXCHANGE_MIN_FRESHNESS = 80; // 取引所に出せる鮮度(%)の下限

export const isFreshnessLine = (line) => typeof line === "string" && line.startsWith(LORE_MARK);

// lore から { age, seen } を読む。無ければ null。
export function readLoreStamp(stack) {
  try {
    for (const line of stack.getLore() ?? []) {
      if (!isFreshnessLine(line)) continue;
      const m = TAIL_RE.exec(line);
      if (!m) continue;
      const all = m[1].replace(/§/g, "");
      return { age: parseInt(all.slice(0, HEX_LEN), 16), seen: parseInt(all.slice(HEX_LEN), 16) };
    }
  } catch (e) { /* loreを読めない */ }
  return null;
}

export function freshnessPercent(age, category) {
  const life = FOOD_SHELF_LIFE_TICKS[category];
  return Math.max(0, Math.min(100, Math.round((1 - age / life) * 100)));
}

// スタックの鮮度(%)。食品でない・スタンプがない(=まだインベントリで持たれていない)なら null。
export function stackFreshness(stack) {
  try {
    const category = getFoodCategory(stack.typeId);
    if (!category) return null;
    const st = readLoreStamp(stack);
    return st ? freshnessPercent(st.age, category) : null;
  } catch (e) { return null; }
}

// 鮮度の行(自前の行)を除いた説明文。ほかの説明文が残っているかの判定に使う。
export function loreWithoutFreshness(stack) {
  try { return (stack.getLore?.() ?? []).filter((l) => !isFreshnessLine(l)); } catch (e) { return ["?"]; }
}

// 取引所に出せる鮮度か(スタンプがなければ出せる)。
export const isFreshEnoughForExchange = (stack) => {
  const p = stackFreshness(stack);
  return p === null || p >= EXCHANGE_MIN_FRESHNESS;
};
