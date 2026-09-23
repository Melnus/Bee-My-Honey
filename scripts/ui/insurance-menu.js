import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import { getCreditInfo } from "../economy/credit.js";
import { INSURANCE_TYPES, getActiveInsurance, subscribeInsurance, cancelInsurance } from "../economy/insurance.js";

// ==========================================
// 保険メニュー UI / Insurance Menu
// 骨ブロック＋植木鉢を右クリックして開く
// ==========================================
export function openInsuranceMenu(player) {
  const lang = getLang(player);
  const info = getCreditInfo(player);
  const active = getActiveInsurance(player);
  const acc = getAccount(player);

  const statusLine = active
    ? (lang === "ja"
        ? `契約中: ${active.name.ja}\n保険料支払: ${info.insurancePaymentOk ? "正常" : "未払いあり"}`
        : `Active: ${active.name.en}\nPremium: ${info.insurancePaymentOk ? "OK" : "Overdue"}`)
    : (lang === "ja" ? "現在、加入中の保険はありません。" : "No active insurance.");

  const flavor = lang === "ja"
    ? "§oワンタッチで即お見積もり。ケルプライフ§r"
    : "§oOne-touch instant quotes. KelpLife.§r";

  const form = new ActionFormData()
    .title(lang === "ja" ? "保険窓口" : "Insurance Desk")
    .body(`${flavor}\n\n${statusLine}\n${lang === "ja" ? "所持" : "Balance"}: ${acc.emeralds}E`);

  const keys = Object.keys(INSURANCE_TYPES);
  keys.forEach((key) => {
    const type = INSURANCE_TYPES[key];
    form.button(`${t(lang, type.name)}\n${lang === "ja" ? "保険料" : "Premium"} ${type.premium}E/週`);
  });
  if (active) form.button(lang === "ja" ? "解約する" : "Cancel Insurance");
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const cancelIndex = active ? keys.length : -1;
    const backIndex = active ? keys.length + 1 : keys.length;
    if (res.canceled || res.selection === backIndex) return;
    if (res.selection === cancelIndex) {
      cancelInsurance(player);
      player.sendMessage(lang === "ja" ? "保険を解約しました。" : "Insurance cancelled.");
      return openInsuranceMenu(player);
    }
    const key = keys[res.selection];
    openInsuranceDetail(player, key);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openInsuranceDetail(player, key) {
  const lang = getLang(player);
  const type = INSURANCE_TYPES[key];

  const form = new ActionFormData()
    .title(t(lang, type.name))
    .body(
      lang === "ja"
        ? `${t(lang, type.desc)}\n保険料: ${type.premium}E/週\n死亡時の支給: ${t(lang, type.payout.name)} ×${type.payout.amount}`
        : `${t(lang, type.desc)}\nPremium: ${type.premium}E/week\nPayout: ${t(lang, type.payout.name)} x${type.payout.amount}`
    )
    .button(lang === "ja" ? "加入する" : "Subscribe")
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openInsuranceMenu(player);
    subscribeInsurance(player, key);
    player.sendMessage(lang === "ja" ? `§a${t(lang, type.name)}に加入しました。` : `§aSubscribed to ${t(lang, type.name)}.`);
    openInsuranceMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
