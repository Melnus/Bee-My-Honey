import { ENCHANTMENTS } from "./item-catalog.js";

// ==========================================
// 種類つきの品目 / Variant Items  (エンチャント本・ポーション。2026-11-05 作者の方針。dev/MILESTONES.md M-B)
// ------------------------------------------
// アイテムIDが同じで種類が違う品(エンチャント本・ポーション)を、取引所では「ID#種類」というキーで区別する。
//   エンチャント本: minecraft:enchanted_book#<エンチャント>:<レベル>   例 minecraft:enchanted_book#sharpness:5
//   ポーション:     minecraft:<potion|splash_potion|lingering_potion>#<効果>  例 minecraft:splash_potion#strong_healing
// 種類は、スクリプトAPIで読める(エンチャント本 = ItemEnchantableComponent、ポーション = ItemPotionComponent)。
// 効果のIDは Mojang/bedrock-samples の mojang-potion-effects.json、エンチャントは mojang-enchantments.json に合わせる。
//   ・単独のエンチャントが付いた本だけを扱う(複数付きの本・エンチャント済みの道具は扱わない)。
//   ・freezing・wither は、作り方が確認できないため扱わない。
// ==========================================
const ENCHANT_LEVEL_ROMAN = ["", "I", "II", "III", "IV", "V"];
const roman = (n) => ENCHANT_LEVEL_ROMAN[n] ?? String(n);

// ---- エンチャント本 ----
const BOOK_GROUPS = [
  { key: "book_armor", ja: "エンチャント本: 防具", en: "Enchanted Books: Armor",
    ids: ["protection", "fire_protection", "feather_falling", "blast_protection", "projectile_protection", "thorns", "respiration", "aqua_affinity", "depth_strider", "frost_walker", "soul_speed", "swift_sneak"] },
  { key: "book_melee", ja: "エンチャント本: 近接武器", en: "Enchanted Books: Melee",
    ids: ["sharpness", "smite", "bane_of_arthropods", "knockback", "fire_aspect", "looting", "lunge", "breach", "density", "wind_burst"] },
  { key: "book_tool", ja: "エンチャント本: 道具", en: "Enchanted Books: Tools",
    ids: ["efficiency", "silk_touch", "unbreaking", "fortune", "luck_of_the_sea", "lure", "mending"] },
  { key: "book_ranged", ja: "エンチャント本: 弓・クロスボウ・トライデント", en: "Enchanted Books: Ranged",
    ids: ["power", "punch", "flame", "infinity", "multishot", "quick_charge", "piercing", "loyalty", "riptide", "channeling", "impaling"] },
  { key: "book_curse", ja: "エンチャント本: 呪い", en: "Enchanted Books: Curses", ids: ["binding", "vanishing"] }
];

// 全エンチャントを1つのグループへ割り当てる(上の表に無いものは「その他」)
const _assigned = new Set(BOOK_GROUPS.flatMap((g) => g.ids));
const _others = ENCHANTMENTS.filter((e) => !_assigned.has(e.id)).map((e) => e.id);
if (_others.length) BOOK_GROUPS.push({ key: "book_other", ja: "エンチャント本: その他", en: "Enchanted Books: Other", ids: _others });

export const ENCHANT_DEFS = Object.fromEntries(ENCHANTMENTS.map((e) => [e.id, e]));
export const bookKey = (id, level) => `minecraft:enchanted_book#${id}:${level}`;
// 価格の労働日数(village-pricing-data.js の ENCHANT_BOOK_LABOR_DAYS と同じ3段階)。最大レベルの本の日数。下のレベルは、1段下がるごとに半分。
export const BOOK_TOP_DAYS = (e) => (e.id === "infinity" || e.id === "mending" ? 5 : e.id === "silk_touch" || e.id === "efficiency" ? 3 : 1);

// ---- ポーション ----
const POTION_EFFECTS = [
  // base: 作る土台(awkward か water)。ing: 材料(1回の醸造 = 土台3本 + 材料 → 3本)
  { id: "fire_resistance", ja: "耐火", en: "Fire Resistance", ing: ["magma_cream"], long: true },
  { id: "healing", ja: "治癒", en: "Healing", ing: ["glistering_melon_slice"], strong: true },
  { id: "harming", ja: "負傷", en: "Harming", ing: ["glistering_melon_slice", "fermented_spider_eye"], strong: true },
  { id: "invisibility", ja: "透明化", en: "Invisibility", ing: ["golden_carrot", "fermented_spider_eye"], long: true },
  { id: "leaping", ja: "跳躍", en: "Leaping", ing: ["rabbit_foot"], long: true, strong: true },
  { id: "nightvision", ja: "暗視", en: "Night Vision", ing: ["golden_carrot"], long: true },
  { id: "poison", ja: "毒", en: "Poison", ing: ["spider_eye"], long: true, strong: true },
  { id: "regeneration", ja: "再生", en: "Regeneration", ing: ["ghast_tear"], long: true, strong: true },
  { id: "slow_falling", ja: "低速落下", en: "Slow Falling", ing: ["phantom_membrane"], long: true },
  { id: "slowness", ja: "鈍化", en: "Slowness", ing: ["sugar", "fermented_spider_eye"], long: true, strong: true },
  { id: "strength", ja: "力", en: "Strength", ing: ["blaze_powder"], long: true, strong: true },
  { id: "swiftness", ja: "俊敏", en: "Swiftness", ing: ["sugar"], long: true, strong: true },
  { id: "turtle_master", ja: "タートルマスター", en: "the Turtle Master", ing: ["turtle_helmet"], long: true, strong: true },
  { id: "water_breathing", ja: "水中呼吸", en: "Water Breathing", ing: ["pufferfish"], long: true },
  { id: "weakness", ja: "弱化", en: "Weakness", ing: ["fermented_spider_eye"], base: "water", long: true },
  { id: "infested", ja: "虫食い", en: "Infestation", ing: ["stone"] },
  { id: "oozing", ja: "滲出", en: "Oozing", ing: ["slime"] },
  { id: "weaving", ja: "巣張り", en: "Weaving", ing: ["web"] },
  { id: "wind_charged", ja: "蓄風", en: "Wind Charging", ing: ["breeze_rod"] }
];
// 土台(効果なし)の瓶
const POTION_BASES = [
  { id: "water", ja: "水入り", en: "Water", water: true },
  { id: "awkward", ja: "奇妙な", en: "Awkward" },
  { id: "mundane", ja: "ありふれた", en: "Mundane" },
  { id: "long_mundane", ja: "ありふれすぎた", en: "Mundane (Extended)" },
  { id: "thick", ja: "濃厚な", en: "Thick" }
];

export const POTION_DELIVERIES = [
  { typeId: "minecraft:potion", delivery: "Consume", ja: "ポーション", jaWater: "瓶", en: "Potion", enWater: "Bottle", group: "potion" },
  { typeId: "minecraft:splash_potion", delivery: "ThrownSplash", ja: "スプラッシュポーション", jaWater: "スプラッシュ瓶", en: "Splash Potion", enWater: "Splash Bottle", group: "splash" },
  { typeId: "minecraft:lingering_potion", delivery: "ThrownLingering", ja: "残留ポーション", jaWater: "残留瓶", en: "Lingering Potion", enWater: "Lingering Bottle", group: "lingering" }
];
export const DELIVERY_BY_TYPE = Object.fromEntries(POTION_DELIVERIES.map((d) => [d.typeId, d]));

// 効果ID(minecraft: なし)の一覧。土台 → 効果 → 延長(long_) → 強化(strong_) の順。
export const POTION_EFFECT_IDS = [
  ...POTION_BASES.map((b) => b.id),
  ...POTION_EFFECTS.map((e) => e.id),
  ...POTION_EFFECTS.filter((e) => e.long).map((e) => "long_" + e.id),
  ...POTION_EFFECTS.filter((e) => e.strong).map((e) => "strong_" + e.id)
];
export const POTION_EFFECT_DEFS = Object.fromEntries([
  ...POTION_BASES.map((b) => [b.id, { ...b, kind: "base" }]),
  ...POTION_EFFECTS.map((e) => [e.id, { ...e, kind: "effect" }]),
  ...POTION_EFFECTS.filter((e) => e.long).map((e) => ["long_" + e.id, { ...e, id: "long_" + e.id, kind: "long", of: e.id }]),
  ...POTION_EFFECTS.filter((e) => e.strong).map((e) => ["strong_" + e.id, { ...e, id: "strong_" + e.id, kind: "strong", of: e.id }])
]);
export const potionKey = (typeId, effectId) => `${typeId}#${effectId}`;

// ---- 名前 ----
export function variantParts(key) {
  const i = String(key).indexOf("#");
  return i < 0 ? null : { base: key.slice(0, i), variant: key.slice(i + 1) };
}
export function variantName(key, lang) {
  const p = variantParts(key);
  if (!p) return null;
  if (p.base === "minecraft:enchanted_book") {
    const [id, lv] = p.variant.split(":");
    const e = ENCHANT_DEFS[id];
    const level = Number(lv);
    const nm = e ? e.name[lang === "ja" ? "ja" : "en"] : id;
    const r = e && e.maxLevel > 1 ? " " + roman(level) : "";
    return lang === "ja" ? `エンチャントの本(${nm}${r})` : `Enchanted Book (${nm}${r})`;
  }
  const d = DELIVERY_BY_TYPE[p.base];
  const def = POTION_EFFECT_DEFS[p.variant];
  if (!d || !def) return null;
  if (def.kind === "base") {
    if (def.water) return lang === "ja" ? `${def.ja}${d.jaWater}` : `${d.enWater.replace("Bottle", "Water Bottle")}`;
    return lang === "ja" ? `${def.ja}${d.ja}` : `${d.en.replace("Potion", `${def.en} Potion`)}`;
  }
  if (lang === "ja") return `${def.ja}の${d.ja}${def.kind === "long" ? "(延長)" : def.kind === "strong" ? " II" : ""}`;
  return `${d.en} of ${def.en}${def.kind === "long" ? " (Extended)" : def.kind === "strong" ? " II" : ""}`;
}

// ---- 取引リストの小分類(希少資源の末尾に足す) ----
export function buildVariantGroups() {
  const groups = [];
  for (const g of BOOK_GROUPS) {
    const items = [];
    for (const id of g.ids) {
      const e = ENCHANT_DEFS[id];
      if (!e) continue;
      for (let lv = 1; lv <= e.maxLevel; lv++) {
        const key = bookKey(id, lv);
        items.push([key.replace("minecraft:", ""), variantName(key, "ja")]);
      }
    }
    groups.push({ key: g.key, ja: g.ja, en: g.en, items });
  }
  for (const d of POTION_DELIVERIES) {
    const items = POTION_EFFECT_IDS.map((eid) => {
      const key = potionKey(d.typeId, eid);
      return [key.replace("minecraft:", ""), variantName(key, "ja")];
    });
    groups.push({ key: "potion_" + d.group, ja: "ポーション: " + d.ja.replace("ポーション", ""), en: "Potions: " + d.en.replace(" Potion", ""), items });
  }
  return groups;
}
