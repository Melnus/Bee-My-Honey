import { PlayerPermissionLevel } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  formatPublicKey,
  validateAmount,
  validateNonce,
  MAX_NONCE,
  buildWalletCode,
  getNetworkSecret,
  setNetworkSecret,
  clearNetworkSecret
} from "../wallet-security.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getAccount } from "../economy/bank.js";
import { getWallet, createWallet, checkSecretWord, importWalletCode } from "../wallet/game-wallet.js";
import { openTradingMenu } from "./trading-menu.js";

function isOperator(player) {
  return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
}

// ==========================================
// コールドウォレット メニュー UI
// (コピペ画面・直近コード再確認対応)
// ==========================================
export function showCopyableCodeModal(player, codeText) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, STR.walletCopyModalTitle))
    .body(`${codeText}\n\n${t(lang, STR.walletCopyModalLabel)}`)
    .button(t(lang, STR.back));

  form.show(player).then(() => {
    openTradingMenu(player);
  }).catch((e) => {
    console.warn("[BeeMyHoney] Copy modal error: " + e);
  });
}

export function executeWalletExport(player, theme) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const honeycomb = acc.honeycomb;

  if (honeycomb < 1) {
    player.sendMessage(t(lang, STR.walletExportEmpty));
    return openWalletMenu(player);
  }

  const wallet = getWallet(player);
  const nextNonce = wallet.nonce + 1;

  const amountCheck = validateAmount(honeycomb);
  if (!amountCheck.ok) {
    player.sendMessage("§cAmount error. Contact admin.");
    return openWalletMenu(player);
  }

  const nonceCheck = validateNonce(nextNonce);
  if (!nonceCheck.ok || nextNonce > MAX_NONCE) {
    player.sendMessage("§cNonce limit reached. Please reset wallet.");
    return openWalletMenu(player);
  }

  let code;
  try {
    code = buildWalletCode(wallet.publicKey, nextNonce, honeycomb, theme, lang);
  } catch (e) {
    player.sendMessage("§cFailed to generate code.");
    return openWalletMenu(player);
  }

  player.setDynamicProperty("wallet_nonce", nextNonce);
  player.setDynamicProperty("acc_curr_honeycomb", 0);
  player.setDynamicProperty("wallet_last_code", code); // 直近コードとして保存
  player.sendMessage(t(lang, STR.walletExportMsg, honeycomb));

  showCopyableCodeModal(player, code);
}

export function openWalletMenu(player) {
  const wallet = getWallet(player);
  if (!wallet) return openWalletSetupForm(player, { isReset: false });

  const lang = getLang(player);
  const acc = getAccount(player);
  const admin = isOperator(player);
  const form = new ActionFormData()
    .title(t(lang, STR.walletTitle))
    .body(t(lang, STR.walletBody, formatPublicKey(wallet.publicKey), wallet.nonce, acc.honeycomb))
    .button(t(lang, STR.walletExportBtn))
    .button(t(lang, STR.walletImportBtn))
    .button(t(lang, STR.walletViewLastBtn))
    .button(t(lang, STR.walletResetBtn));
  if (admin) {
    form.button(t(lang, STR.walletAdminBtn));
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    const backIndex = admin ? 5 : 4;
    if (res.canceled || res.selection === backIndex) return openTradingMenu(player);
    if (res.selection === 0) openWalletExportTheme(player);
    else if (res.selection === 1) openWalletImportForm(player);
    else if (res.selection === 2) {
      const lastCode = player.getDynamicProperty("wallet_last_code");
      if (!lastCode) {
        player.sendMessage(t(lang, STR.walletNoLastCode));
        return openWalletMenu(player);
      }
      showCopyableCodeModal(player, lastCode);
    } else if (res.selection === 3) {
      openWalletSetupForm(player, { isReset: true });
    } else if (admin && res.selection === 4) {
      openNetworkSecretAdminMenu(player);
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// ==========================================
// 【管理者専用】別ワールドへの持ち出し用ネットワーク共有シークレット設定
// ==========================================
export function openNetworkSecretAdminMenu(player) {
  if (!isOperator(player)) return openWalletMenu(player); // 念のための二重チェック

  const lang = getLang(player);
  const current = getNetworkSecret();
  const statusText = t(lang, current ? STR.walletAdminStatusSet : STR.walletAdminStatusUnset);

  const form = new ActionFormData()
    .title(t(lang, STR.walletAdminTitle))
    .body(t(lang, STR.walletAdminBody, statusText))
    .button(t(lang, STR.walletAdminSetBtn))
    .button(t(lang, STR.walletAdminClearBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (!isOperator(player)) return openWalletMenu(player);
    if (res.canceled || res.selection === 2) return openWalletMenu(player);
    if (res.selection === 1) {
      clearNetworkSecret();
      player.sendMessage(t(lang, STR.walletAdminClearedMsg));
      return openWalletMenu(player);
    }
    openNetworkSecretInputForm(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openNetworkSecretInputForm(player) {
  if (!isOperator(player)) return openWalletMenu(player);
  const lang = getLang(player);
  const form = new ModalFormData()
    .title(t(lang, STR.walletAdminInputTitle))
    .textField(t(lang, STR.walletAdminInputField), "");

  form.show(player).then((res) => {
    if (!isOperator(player)) return openWalletMenu(player);
    if (res.canceled) return openNetworkSecretAdminMenu(player);
    const [value] = res.formValues;
    if (!value || !value.trim()) {
      player.sendMessage(t(lang, STR.walletAdminEmptyError));
      return openNetworkSecretAdminMenu(player);
    }
    setNetworkSecret(value.trim());
    player.sendMessage(t(lang, STR.walletAdminSetMsg));
    openWalletMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openWalletSetupForm(player, { isReset }) {
  const lang = getLang(player);
  const form = new ModalFormData()
    .title(t(lang, isReset ? STR.walletResetTitle : STR.walletSetupTitle))
    .textField(t(lang, STR.walletSetupLabel), "")
    .textField(t(lang, STR.walletSetupConfirmLabel), "");

  form.show(player).then((res) => {
    if (res.canceled) return isReset ? openWalletMenu(player) : openTradingMenu(player);

    const [word, confirmWord] = res.formValues;
    if (!word || !word.trim()) {
      player.sendMessage(t(lang, STR.walletSetupEmpty));
      return openWalletSetupForm(player, { isReset });
    }
    if (word !== confirmWord) {
      player.sendMessage(t(lang, STR.walletSetupMismatch));
      return openWalletSetupForm(player, { isReset });
    }

    const result = createWallet(player, word);
    if (!result.ok) {
      player.sendMessage(t(lang, STR.walletSetupCollision));
      return openWalletSetupForm(player, { isReset });
    }

    const doneForm = new ActionFormData()
      .title(t(lang, isReset ? STR.walletResetTitle : STR.walletSetupTitle))
      .body(t(lang, STR.walletSetupDone, formatPublicKey(result.publicKey)))
      .button(t(lang, STR.back));

    doneForm.show(player).then(() => openWalletMenu(player));
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openWalletExportTheme(player) {
  const lang = getLang(player);
  const acc = getAccount(player);

  if (acc.honeycomb < 1) {
    player.sendMessage(t(lang, STR.walletExportEmpty));
    return openWalletMenu(player);
  }

  const form = new ActionFormData()
    .title(t(lang, STR.walletExportBtn))
    .body(t(lang, STR.walletThemeBody))
    .button(t(lang, STR.walletThemeBee))
    .button(t(lang, STR.walletThemeOre))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openWalletMenu(player);
    const theme = res.selection === 0 ? "bee" : "ore";
    openWalletExportAuthForm(player, theme);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openWalletExportAuthForm(player, theme) {
  const lang = getLang(player);
  const form = new ModalFormData()
    .title(t(lang, STR.walletAuthTitle))
    .textField(t(lang, STR.walletAuthLabel), "");

  form.show(player).then((res) => {
    if (res.canceled) return openWalletMenu(player);
    const [word] = res.formValues;
    const wallet = getWallet(player);
    if (!wallet || !checkSecretWord(wallet, word)) {
      player.sendMessage(t(lang, STR.walletAuthWrong));
      return openWalletMenu(player);
    }
    executeWalletExport(player, theme);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

export function openWalletImportForm(player) {
  const lang = getLang(player);
  const form = new ModalFormData().title(t(lang, STR.walletImportTitle));

  for (let i = 0; i < 5; i++) {
    form.textField(t(lang, STR.walletImportPhraseLabel, i + 1), "");
  }

  form.show(player).then((res) => {
    if (res.canceled) return openWalletMenu(player);
    const codeText = res.formValues.join("\n"); // 5つの入力欄を結合してから解析
    const result = importWalletCode(player, codeText);

    if (!result.ok) {
      const msgKey = {
        badPhrase: STR.walletImportBadPhrase,
        tampered: STR.walletImportTampered,
        usedAlready: STR.walletImportUsed
      }[result.reason] ?? STR.walletImportBadPhrase;
      player.sendMessage(t(lang, msgKey));
      return openWalletMenu(player);
    }

    player.sendMessage(t(lang, STR.walletImportSuccess, result.credited));
    openTradingMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}
