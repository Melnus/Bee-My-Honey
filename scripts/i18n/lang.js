// ==========================================
// 言語判定ユーティリティ / Language Utility
// ==========================================
export function detectLocaleLang(player) {
  try {
    const locale = player.clientSystemInfo?.locale;
    if (typeof locale === "string" && locale.toLowerCase().startsWith("ja")) return "ja";
  } catch (e) {}
  return "en";
}

export function getLang(player) {
  const pref = player.getDynamicProperty("pref_lang");
  if (pref === "ja" || pref === "en") return pref;
  return detectLocaleLang(player);
}

export function setLang(player, lang) {
  player.setDynamicProperty("pref_lang", lang);
}

export function t(lang, record, ...args) {
  const v = record[lang] ?? record.en;
  return typeof v === "function" ? v(...args) : v;
}
