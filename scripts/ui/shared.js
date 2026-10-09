// ==========================================
// UI共通 / Shared UI
// ==========================================
import { ModalFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// 全角数字・カンマ・空白を取り除いて、正の整数だけを受け付ける。無効なら null。
export function parseQuantity(raw) {
  const normalized = String(raw ?? "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isSafeInteger(n) ? n : null;
}

// 数量の入力画面(入力欄 + その下に「全額」のトグル)。
//   max       … 入力できる最大数(1以上)
//   onSubmit  … 確定した数量(1〜max)を受け取る
//   onBack    … キャンセル(×で閉じた)時
// 数値以外・範囲外は、メッセージを出して入力欄を開き直す(入力値は残す)。
export function promptQuantity(player, { title, max, initial = 1, onSubmit, onBack }) {
  const lang = getLang(player);
  const form = new ModalFormData()
    .title(title)
    .textField(t(lang, STR.qtyFieldLabel, max), t(lang, STR.qtyFieldHint), { defaultValue: String(Math.min(initial, max)) })
    .toggle(t(lang, STR.qtyAllToggle, max), { defaultValue: false });

  form.show(player).then((res) => {
    if (res.canceled) return onBack();
    const [raw, useAll] = res.formValues;
    if (useAll) return onSubmit(max);
    const qty = parseQuantity(raw);
    if (qty === null || qty < 1 || qty > max) {
      player.sendMessage(t(lang, STR.qtyInvalid, max));
      return promptQuantity(player, { title, max, initial: qty === null ? 1 : Math.min(Math.max(qty, 1), max), onSubmit, onBack });
    }
    onSubmit(qty);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}


