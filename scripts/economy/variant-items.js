import * as mc from "@minecraft/server";
import { loreWithoutFreshness, isFreshEnoughForExchange, stackFreshness } from "./freshness-lore.js";
import { DELIVERY_BY_TYPE, ENCHANT_DEFS, POTION_EFFECT_DEFS, bookKey, potionKey, variantParts } from "../data/variant-items-data.js";

// ==========================================
// 種類つきの品目の変換 / Variant Item Conversion  (data/variant-items-data.js)
// ------------------------------------------
// アイテムスタック ↔ 取引所の品目キー。
//   stackKey(stack)  … 取引できる品なら品目キー(通常の品は typeId、エンチャント本・ポーションは「ID#種類」)。取引できない品は null
//                       (名前・説明・傷み・複数エンチャントの本・エンチャント済みの道具など)。
//   makeStacks(key, n) … キーの品を n 個ぶんのスタック(最大スタック数ごと)にして返す。作れないキーは空の配列。
// 実機で未確認: Potions.resolve が3種の配送を作れること / getComponent("minecraft:potion") が3種の配送を読めること。
// ==========================================
const strip = (id) => String(id ?? "").replace(/^minecraft:/, "");
const normEnchant = (id) => { const s = strip(id); return s === "bow_infinity" ? "infinity" : s; };

// 通常の品: 名前・説明・エンチャント・傷みのない品
export function isPlainStack(stack) {
  try {
    if (stack.nameTag) return false;
    if (loreWithoutFreshness(stack).length) return false; // 鮮度の行(食品の鮮度システムが書く)は、説明文に数えない
    if ((stack.getComponent?.("minecraft:enchantable")?.getEnchantments?.() ?? []).length) return false;
    if ((stack.getComponent?.("minecraft:durability")?.damage ?? 0) > 0) return false;
  } catch (e) { return false; }
  return true;
}

// 取引所に出せないほど鮮度が低い(80%未満)品か。取り込みを断る理由の判定に使う。品物としては取引できる品(typeId)のまま。
export function isStaleStack(stack) { return !isFreshEnoughForExchange(stack); }
export { stackFreshness };

// 取引所へ取り込んだ(並べた)品は、鮮度を100%にリセットする。鮮度の行とスタンプを取り除いた、まっさらな品として扱う
// (プールの品は個数だけを持つ。買った人に渡る品は、インベントリで初めて持たれた時点から、新しくスタンプが付く)。
export function stackKey(stack) {
  try {
    const typeId = stack.typeId;
    if (DELIVERY_BY_TYPE[typeId]) {
      if (stack.nameTag || (stack.getLore?.() ?? []).length) return null;
      const comp = stack.getComponent?.("minecraft:potion");
      const eid = strip(comp?.potionEffectType?.id);
      return POTION_EFFECT_DEFS[eid] ? potionKey(typeId, eid) : null;
    }
    if (typeId === "minecraft:enchanted_book") {
      if (stack.nameTag || (stack.getLore?.() ?? []).length) return null;
      const list = stack.getComponent?.("minecraft:enchantable")?.getEnchantments?.() ?? [];
      if (list.length !== 1) return null;
      const id = normEnchant(list[0].type?.id);
      const level = list[0].level;
      const def = ENCHANT_DEFS[id];
      return def && level >= 1 && level <= def.maxLevel ? bookKey(id, level) : null;
    }
    return isPlainStack(stack) ? typeId : null;
  } catch (e) { return null; }
}

function oneStack(key) {
  const p = variantParts(key);
  if (!p) return new mc.ItemStack(key, 1);
  if (p.base === "minecraft:enchanted_book") {
    const [id, lv] = p.variant.split(":");
    const s = new mc.ItemStack("minecraft:enchanted_book", 1);
    const type = mc.EnchantmentTypes.get(id);
    if (!type) throw new Error("unknown enchantment " + id);
    s.getComponent("minecraft:enchantable").addEnchantment({ type, level: Number(lv) });
    return s;
  }
  const d = DELIVERY_BY_TYPE[p.base];
  if (!d) throw new Error("unknown variant " + key);
  const s = mc.Potions.resolve("minecraft:" + p.variant, d.delivery);
  if (!s) throw new Error("cannot resolve potion " + key);
  return s;
}

export function makeStacks(key, n) {
  const out = [];
  try {
    let left = n;
    while (left > 0) {
      const s = oneStack(key);
      const max = s.maxAmount ?? 64;
      s.amount = Math.min(left, max);
      out.push(s);
      left -= s.amount;
    }
  } catch (e) {
    console.warn("[BeeMyHoney] makeStacks " + key + ": " + e);
    return [];
  }
  return out;
}
