import { world } from "@minecraft/server";

// ==========================================================
// コールドウォレット セキュリティモジュール (v4)
// Cold Wallet Security Module (v4)
// ==========================================================

const WALLET_SALT_VERSION = 1;
const WALLET_SALTS = {
  1: "If you cheat, this just stops being fun"
};

function saltForVersion(version) {
  const salt = WALLET_SALTS[version];
  if (salt === undefined) throw new RangeError(`Unknown WALLET_SALT version: ${version}`);
  return salt;
}

function knownSaltVersionsNewestFirst() {
  return Object.keys(WALLET_SALTS).map(Number).sort((a, b) => b - a);
}

// 桁数構成: 公開鍵(6) + Nonce(4) + 金額(6) + 署名(4) = 合計20桁
// 4桁ずつ区切って「5つの文」からなる合言葉の物語を構成する
export const PUBKEY_DIGITS = 6;
export const NONCE_DIGITS = 4;
export const AMOUNT_DIGITS = 6;
export const SIGNATURE_DIGITS = 4;
export const TOTAL_DIGITS = PUBKEY_DIGITS + NONCE_DIGITS + AMOUNT_DIGITS + SIGNATURE_DIGITS; // 20

export const MAX_PUBKEY = 10 ** PUBKEY_DIGITS - 1;
export const MAX_NONCE = 10 ** NONCE_DIGITS - 1;
export const MAX_AMOUNT = 10 ** AMOUNT_DIGITS - 1;

// 10進数(0-9)に対応する単語テーマ
export const WALLET_THEMES = {
  bee: {
    ja: ["ハチ", "巣箱", "ハチミツ", "花", "小麦", "種", "キノコ", "羽根", "毒針", "蜜蝋"],
    en: ["Bee", "Hive", "Honey", "Flower", "Wheat", "Seed", "Mushroom", "Feather", "Stinger", "Wax"]
  },
  ore: {
    ja: ["鉄", "金", "ダイヤ", "エメラルド", "石炭", "赤石", "ラピス", "石英", "銅", "黒曜石"],
    en: ["Iron", "Gold", "Diamond", "Emerald", "Coal", "Redstone", "Lapis", "Quartz", "Copper", "Obsidian"]
  }
};

// 逆引き用辞書（日英・全テーマ混合で自動解読）
const WORD_TO_DIGIT = new Map();
for (const theme of Object.values(WALLET_THEMES)) {
  for (const words of Object.values(theme)) {
    words.forEach((w, i) => {
      WORD_TO_DIGIT.set(w.toLowerCase(), i);
    });
  }
}

// djb2 ハッシュ関数
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function padNum(n, digits) {
  const max = 10 ** digits;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n >= max) {
    throw new RangeError(`padNum: value ${n} is out of range for ${digits} digits.`);
  }
  return String(n).padStart(digits, "0");
}

// 4単語ずつ5文の物語文（文章）に組み立てる
export function digitsToStory(digits, themeKey, lang = "ja") {
  const themeObj = WALLET_THEMES[themeKey] ?? WALLET_THEMES.bee;
  const words = themeObj[lang] ?? themeObj.ja;
  const w = digits.map((d) => words[d]);

  if (lang === "ja") {
    return (
      `【${w[0]}】の【${w[1]}】が【${w[2]}】を【${w[3]}】で導き、\n` +
      `【${w[4]}】と【${w[5]}】が【${w[6]}】の【${w[7]}】を育み、\n` +
      `【${w[8]}】より【${w[9]}】へ【${w[10]}】と【${w[11]}】を託し、\n` +
      `【${w[12]}】の【${w[13]}】に【${w[14]}】の【${w[15]}】が集まり、\n` +
      `【${w[16]}】が【${w[17]}】と【${w[18]}】を【${w[19]}】で誓う。`
    );
  } else {
    return (
      `The [${w[0]}] of [${w[1]}] guides [${w[2]}] with [${w[3]}],\n` +
      `while [${w[4]}] and [${w[5]}] nurture [${w[6]}] of [${w[7]}],\n` +
      `sending from [${w[8]}] to [${w[9]}] both [${w[10]}] and [${w[11]}],\n` +
      `as [${w[12]}] of [${w[13]}] gathers near [${w[14]}] of [${w[15]}],\n` +
      `and [${w[16]}] swears [${w[17]}] with [${w[18]}] by [${w[19]}].`
    );
  }
}

// 助詞や記号を取り除き、名詞だけを抽出して20桁の数字に復元
export function storyToDigits(text) {
  if (!text || typeof text !== "string") return null;

  // 記号・ブラケットをスペースに置換
  const clean = text.replace(/[【】\[\]\n\r,、.。]+/g, " ");
  const tokens = clean.trim().split(/\s+/).filter(Boolean);

  const digits = [];

  // 日本語など空白で区切られていない場合も拾えるようトークンスキャン
  for (const token of tokens) {
    let sub = token.toLowerCase();
    // 登録単語と一致するか最長一致で探す
    let foundMatch = false;
    for (const [dictWord, digit] of WORD_TO_DIGIT.entries()) {
      if (sub === dictWord) {
        digits.push(digit);
        foundMatch = true;
        break;
      }
    }
    // トークンの中に単語が含まれているケース（助詞が連結している場合）
    if (!foundMatch) {
      for (const [dictWord, digit] of WORD_TO_DIGIT.entries()) {
        if (sub.includes(dictWord)) {
          digits.push(digit);
          break;
        }
      }
    }
  }

  return digits.length === TOTAL_DIGITS ? digits : null;
}

// 入力検証
export function validateAmount(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount) || !Number.isFinite(amount)) return { ok: false, reason: "notFinite" };
  if (!Number.isInteger(amount)) return { ok: false, reason: "notInteger" };
  if (amount <= 0) return { ok: false, reason: "notPositive" };
  if (amount > MAX_AMOUNT) return { ok: false, reason: "tooLarge" };
  return { ok: true };
}

export function validateNonce(nonce) {
  if (typeof nonce !== "number" || Number.isNaN(nonce) || !Number.isFinite(nonce)) return { ok: false, reason: "notFinite" };
  if (!Number.isInteger(nonce)) return { ok: false, reason: "notInteger" };
  if (nonce < 0) return { ok: false, reason: "negative" };
  if (nonce > MAX_NONCE) return { ok: false, reason: "tooLarge" };
  return { ok: true };
}

// 鍵導出
function deriveSecretKeyWithVersion(secretWord, version) {
  const salt = saltForVersion(version);
  return simpleHash(`sk:${String(secretWord).trim()}:${salt}`) % (10 ** PUBKEY_DIGITS);
}

function derivePublicKeyWithVersion(secretKeyValue, version) {
  const salt = saltForVersion(version);
  return simpleHash(`pk:${secretKeyValue}:${salt}`) % (10 ** PUBKEY_DIGITS);
}

export function deriveSecretKey(secretWord) {
  return deriveSecretKeyWithVersion(secretWord, WALLET_SALT_VERSION);
}

export function derivePublicKey(secretKeyValue) {
  return derivePublicKeyWithVersion(secretKeyValue, WALLET_SALT_VERSION);
}

export function matchesPublicKeyAnyVersion(secretWord, storedPublicKey) {
  for (const version of knownSaltVersionsNewestFirst()) {
    const secretKey = deriveSecretKeyWithVersion(secretWord, version);
    const publicKey = derivePublicKeyWithVersion(secretKey, version);
    if (publicKey === storedPublicKey) return true;
  }
  return false;
}

export function formatPublicKey(publicKey) {
  return `PK-${padNum(publicKey, PUBKEY_DIGITS)}`;
}

// 公開鍵レジストリ
const REGISTRY_KEY_PREFIX = "wallet_owner_pk_";

export function getPublicKeyOwner(publicKey) {
  return world.getDynamicProperty(`${REGISTRY_KEY_PREFIX}${publicKey}`);
}

export function isPublicKeyTakenByOther(publicKey, ownerId) {
  const owner = getPublicKeyOwner(publicKey);
  return owner !== undefined && owner !== ownerId;
}

export function registerPublicKey(publicKey, ownerId) {
  world.setDynamicProperty(`${REGISTRY_KEY_PREFIX}${publicKey}`, ownerId);
}

export function unregisterPublicKey(publicKey) {
  world.setDynamicProperty(`${REGISTRY_KEY_PREFIX}${publicKey}`, undefined);
}

// 署名計算
function computeSignatureWithVersion(publicKey, nonce, amount, version) {
  const salt = saltForVersion(version);
  return simpleHash(`sig:${publicKey}:${nonce}:${amount}:${salt}`) % (10 ** SIGNATURE_DIGITS);
}

function computeSignature(publicKey, nonce, amount) {
  return computeSignatureWithVersion(publicKey, nonce, amount, WALLET_SALT_VERSION);
}

// コード発行・検証
export function buildWalletCode(publicKey, nonce, amount, theme, lang = "ja") {
  const amountCheck = validateAmount(amount);
  if (!amountCheck.ok) throw new RangeError(`Invalid amount: ${amount}`);
  const nonceCheck = validateNonce(nonce);
  if (!nonceCheck.ok) throw new RangeError(`Invalid nonce: ${nonce}`);

  const signature = computeSignature(publicKey, nonce, amount);
  const digits = [
    ...padNum(publicKey, PUBKEY_DIGITS).split("").map(Number),
    ...padNum(nonce, NONCE_DIGITS).split("").map(Number),
    ...padNum(amount, AMOUNT_DIGITS).split("").map(Number),
    ...padNum(signature, SIGNATURE_DIGITS).split("").map(Number)
  ];
  return digitsToStory(digits, theme, lang);
}

export function verifyAndDecodeWalletCode(codeText) {
  const digits = storyToDigits(codeText);
  if (!digits || digits.length !== TOTAL_DIGITS) return { ok: false, reason: "badPhrase" };

  let i = 0;
  const take = (n) => digits.slice(i, (i += n)).join("");
  const publicKey = parseInt(take(PUBKEY_DIGITS), 10);
  const nonce = parseInt(take(NONCE_DIGITS), 10);
  const amount = parseInt(take(AMOUNT_DIGITS), 10);
  const signature = parseInt(take(SIGNATURE_DIGITS), 10);

  const matches = knownSaltVersionsNewestFirst().some(
    (version) => computeSignatureWithVersion(publicKey, nonce, amount, version) === signature
  );
  if (!matches) return { ok: false, reason: "tampered" };

  return { ok: true, publicKey, nonce, amount };
}

// Nonce 管理
export function isNonceUsed(publicKey, nonce) {
  const key = `wallet_last_nonce_${publicKey}`;
  const lastNonce = world.getDynamicProperty(key) ?? 0;
  return nonce <= lastNonce;
}

export function markNonceUsed(publicKey, nonce) {
  const key = `wallet_last_nonce_${publicKey}`;
  const lastNonce = world.getDynamicProperty(key) ?? 0;
  if (nonce > lastNonce) world.setDynamicProperty(key, nonce);
}