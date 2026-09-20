import {
  deriveSecretKey,
  derivePublicKey,
  matchesPublicKeyAnyVersion,
  verifyAndDecodeWalletCode,
  isNonceUsed,
  markNonceUsed,
  isPublicKeyTakenByOther,
  registerPublicKey,
  unregisterPublicKey
} from "../wallet-security.js";
import { getAccount } from "../economy/bank.js";

// ==========================================
// コールドウォレット（口座・鍵まわりのロジック）
// Cold Wallet — account/key logic
// (画面表示・メッセージ送信を伴う入出金フローは ui/wallet-menu.js を参照)
// ==========================================
export function getWallet(player) {
  const publicKey = player.getDynamicProperty("wallet_pub");
  if (publicKey === undefined) return null;
  return { publicKey, nonce: player.getDynamicProperty("wallet_nonce") ?? 0 };
}

export function createWallet(player, secretWord) {
  const secretKey = deriveSecretKey(secretWord);
  const publicKey = derivePublicKey(secretKey);

  if (isPublicKeyTakenByOther(publicKey, player.id)) {
    return { ok: false, reason: "collision" };
  }

  const existing = getWallet(player);
  const isSameKey = existing && existing.publicKey === publicKey;

  if (existing && !isSameKey) {
    unregisterPublicKey(existing.publicKey);
  }

  registerPublicKey(publicKey, player.id);
  player.setDynamicProperty("wallet_pub", publicKey);
  // 公開鍵が変わらない(=同じ合言葉で再設定した)場合はnonceを維持する。
  // 無条件に0へ戻すと、既に発行済みのコードより古いnonceを再利用してしまい、
  // 新しく出力したコードが「使用済みnonce」判定で永久にインポート不可能になる。
  if (!isSameKey) {
    player.setDynamicProperty("wallet_nonce", 0);
  }
  return { ok: true, publicKey };
}

export function checkSecretWord(wallet, secretWord) {
  return matchesPublicKeyAnyVersion(secretWord, wallet.publicKey);
}

export function importWalletCode(player, codeText) {
  const decoded = verifyAndDecodeWalletCode(codeText);
  if (!decoded.ok) return decoded;

  if (isNonceUsed(decoded.publicKey, decoded.nonce)) {
    return { ok: false, reason: "usedAlready" };
  }
  markNonceUsed(decoded.publicKey, decoded.nonce);

  const acc = getAccount(player);
  player.setDynamicProperty("acc_curr_honeycomb", acc.honeycomb + decoded.amount);
  return { ok: true, credited: decoded.amount, publicKey: decoded.publicKey, nonce: decoded.nonce };
}
