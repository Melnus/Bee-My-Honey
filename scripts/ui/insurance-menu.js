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
    ? t(lang, STR.insuranceStatusActive, t(lang, active.name), info.insurancePaymentOk)
    : t(lang, STR.insuranceStatusNone);

  const flavor = t(lang, STR.insuranceFlavor);

  const form = new ActionFormData()
    .title(t(lang, STR.insuranceTitle))
    .body(`${flavor}\n\n${statusLine}\n${t(lang, STR.insuranceBalanceLabel)}: ${acc.emeralds}E`);

  const keys = Object.keys(INSURANCE_TYPES);
  keys.forEach((key) => {
    const type = INSURANCE_TYPES[key];
    form.button(`${t(lang, type.name)}\n${t(lang, STR.insurancePremiumPerWeek, type.premium)}`);
  });
  if (active) form.button(t(lang, STR.insuranceBtnCancel));
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const cancelIndex = active ? keys.length : -1;
    const backIndex = active ? keys.length + 1 : keys.length;
    if (res.canceled || res.selection === backIndex) return;
    if (res.selection === cancelIndex) {
      cancelInsurance(player);
      player.sendMessage(t(lang, STR.insuranceCanceledMsg));
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
      t(lang, STR.insuranceDetailBody, t(lang, type.desc), type.premium, t(lang, type.payout.name), type.payout.amount)
    )
    .button(t(lang, STR.insuranceBtnSubscribe))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openInsuranceMenu(player);
    subscribeInsurance(player, key);
    player.sendMessage(t(lang, STR.insuranceSubscribedMsg, t(lang, type.name)));
    openInsuranceMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
