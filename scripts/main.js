import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  deriveSecretKey,
  derivePublicKey,
  matchesPublicKeyAnyVersion,
  formatPublicKey,
  buildWalletCode,
  verifyAndDecodeWalletCode,
  isNonceUsed,
  markNonceUsed,
  validateAmount,
  validateNonce,
  MAX_NONCE,
  isPublicKeyTakenByOther,
  registerPublicKey,
  unregisterPublicKey
} from "./wallet-security.js";

// ==========================================
// 0. 言語判定ユーティリティ / Language Utility
// ==========================================
function detectLocaleLang(player) {
  try {
    const locale = player.clientSystemInfo?.locale;
    if (typeof locale === "string" && locale.toLowerCase().startsWith("ja")) return "ja";
  } catch (e) {}
  return "en";
}

function getLang(player) {
  const pref = player.getDynamicProperty("pref_lang");
  if (pref === "ja" || pref === "en") return pref;
  return detectLocaleLang(player);
}

function setLang(player, lang) {
  player.setDynamicProperty("pref_lang", lang);
}

function t(lang, record, ...args) {
  const v = record[lang] ?? record.en;
  return typeof v === "function" ? v(...args) : v;
}

// ==========================================
// 1. 金融商品定義データ / Financial Instruments
// ==========================================
const CURRENCIES = {
  honeycomb: {
    name: { ja: "ハニカム (HNY)", en: "Honeycomb (HNY)" },
    baseRate: 2.0,
    volatility: 0.2,
    desc: { ja: "基軸通貨・手堅い安定性", en: "Base Currency (Stable)" }
  },
  apple: {
    name: { ja: "リンゴ (APL)", en: "Apple (APL)" },
    baseRate: 1.5,
    volatility: 0.4,
    desc: { ja: "平穏な波型", en: "Moderate Waves" }
  },
  sweet_berry: {
    name: { ja: "スイートベリー (SWB)", en: "Sweet Berry (SWB)" },
    baseRate: 0.8,
    volatility: 0.7,
    desc: { ja: "少額・激しい乱高下", en: "Low Cost, High Volatility" }
  },
  glow_berry: {
    name: { ja: "グローベリー (GLB)", en: "Glow Berry (GLB)" },
    baseRate: 3.0,
    volatility: 0.5,
    desc: { ja: "伸びしろのある成長型", en: "Growth Potential" }
  },
  chorus_fruit: {
    name: { ja: "コーラスフルーツ (CHO)", en: "Chorus Fruit (CHO)" },
    baseRate: 5.0,
    volatility: 1.2,
    desc: { ja: "超ハイリスク・急騰急落", en: "Extreme Volatility" }
  }
};

const STOCKS = {
  pupple: {
    name: { ja: "Pupple (PPL)", en: "Pupple (PPL)" },
    base: 32,
    vol: 0.35,
    desc: { ja: "ハイテク首輪・デバイス", en: "Smart Collars & Gadgets" },
    animal: "dog"
  },
  mcmoonald: {
    name: { ja: "McMoonald (MCD)", en: "McMoonald (MCD)" },
    base: 22,
    vol: 0.15,
    desc: { ja: "ファストフード・ミルク", en: "Fast Food & Dairy Milk" },
    animal: "cow"
  },
  witcha_cola: {
    name: { ja: "Witcha-Cola (WCC)", en: "Witcha-Cola (WCC)" },
    base: 65,
    vol: 0.85,
    desc: { ja: "秘伝ポーション飲料", en: "Secret Formula Potion Drink" },
    animal: "witch"
  },
  clattle: {
    name: { ja: "Clattle (CLT)", en: "Clattle (CLT)" },
    base: 40,
    vol: 0.55,
    desc: { ja: "骨格防衛・遠隔重工", en: "Skeletal Defense & Hardware" },
    animal: "skeleton"
  },
  eekbay: {
    name: { ja: "EekBay (EKB)", en: "EekBay (EKB)" },
    base: 18,
    vol: 0.45,
    desc: { ja: "海洋オークション物流", en: "Maritime Express Auction" },
    animal: "dolphin"
  }
};

// UIテキスト辞書
const STR = {
  marketNewsHeader: { ja: "§e======  週刊・蜂森経済新聞 ======§r", en: "§e======  Weekly Bee News ======§r" },
  marketNewsFooter: { ja: "§e==============================§r", en: "§e==============================§r" },
  mainTitle: { ja: "§6ハニカム電子取引所", en: "§6Bee Exchange" },
  mainBody: {
    ja: (day, bal, net) => `§7【Day ${day}/7 日目】§r\n電子残高: §a${bal} E§r\n推計総資産: §e${net} E§r\n\n操作を選択してください:`,
    en: (day, bal, net) => `§7[Day ${day}/7]§r\nEmerald Balance: §a${bal} E§r\nNet Worth: §e${net} E§r\n\nSelect an action:`
  },
  btnBank: { ja: "§2口座管理\n§7(預入・引出)", en: "§2Bank\n§7(Deposit & Withdraw)" },
  btnForex: { ja: "§b外貨為替\n§7(5種の通貨)", en: "§bForex Market\n§7(5 Currencies)" },
  btnStock: { ja: "§d株式市場\n§7(5銘柄)", en: "§dStock Market\n§7(5 Tickers)" },
  btnFutures: { ja: "§c花の先物\n§7(レバレッジ取引)", en: "§cFlower Futures\n§7(Leverage Trade)" },
  btnWallet: { ja: "§6コールドウォレット\n§7(物語コード発行/読込)", en: "§6Cold Wallet\n§7(Story Code Export/Import)" },
  btnLang: {
    ja: (cur) => `§f 言語設定\n§7(現在: ${cur === "ja" ? "日本語" : "English"})`,
    en: (cur) => `§f Language\n§7(Current: ${cur === "ja" ? "日本語" : "English"})`
  },
  langTitle: { ja: "§f言語設定 / Language", en: "§fLanguage / 言語設定" },
  langBody: { ja: "表示言語を選択してください。", en: "Please select a display language." },
  langBtnJa: { ja: "日本語", en: "日本語" },
  langBtnEn: { ja: "English", en: "English" },
  langSetMsg: { ja: "§a表示言語を日本語に設定しました。", en: "§aDisplay language set to English." },
  bankTitle: { ja: "§2口座管理", en: "§2Bank Account" },
  bankBody: {
    ja: (bal, inv, rate) => `電子残高: §a${bal} E§r\n所持現物: §a${inv} エメラルド§r\n§7週利 ${rate}%（元本保証・低リターン）§r`,
    en: (bal, inv, rate) => `Bank Balance: §a${bal} E§r\nIn Inventory: §a${inv} Emeralds§r\n§7Weekly Interest: ${rate}% (Guaranteed, Low Return)§r`
  },
  bankDeposit10: { ja: "10 E 預け入れる", en: "Deposit 10" },
  bankDepositAll: { ja: "全て預け入れる", en: "Deposit All" },
  bankWithdraw10: { ja: "10 E 引き出す", en: "Withdraw 10" },
  back: { ja: "« 戻る", en: "« Back" },
  bankDepositMsg: { ja: (n) => `§a[Bank] ${n}エメラルドを入金しました。`, en: (n) => `§a[Bank] Deposited ${n} Emeralds.` },
  bankWithdrawMsg: { ja: (n) => `§a[Bank] ${n}エメラルドを引き出しました。`, en: (n) => `§a[Bank] Withdrew ${n} Emeralds.` },
  bankInvShortage: { ja: "§cエメラルドが足りません。", en: "§cInsufficient Emeralds in inventory." },
  bankAccShortage: { ja: "§c口座残高が不足しています。", en: "§cInsufficient account balance." },
  bankInterestMsg: { ja: (n) => `§a[利子] 口座残高に${n}Eの利子がつきました。`, en: (n) => `§a[Interest] Earned ${n}E in bank interest.` },

  forexTitle: { ja: "§b外貨為替", en: "§bForex Market" },
  forexBody: { ja: (bal) => `残高: §a${bal} E§r\n外貨を保有するとレートに応じて資産が増減します。`, en: (bal) => `Balance: §a${bal} E§r\nHolding currencies fluctuates your net worth.` },
  forexButtonLine: { ja: (rate, hold, diff) => `§eレート: ${rate}E §r| 保有:${hold} ${diff}`, en: (rate, hold, diff) => `§eRate: ${rate}E §r| Hold:${hold} ${diff}` },
  waveChartLabel: { ja: "§b▽ 週間推移 (Day1→7・アイコンが浮き沈み)§r", en: "§b▽ Weekly Trend (Day1→7)§r" },
  none: { ja: "§7[未保有]", en: "§7[None]" },
  forexTradeBody: {
    ja: (desc, rate, hold, buyRate, bal) => `${desc}\n\n現在レート: §e1口 = ${rate} E§r\n保有数: §b${hold} 口§r` + (hold > 0 ? ` (取得: ${buyRate}E)` : "") + `\n残高: §a${bal} E§r`,
    en: (desc, rate, hold, buyRate, bal) => `${desc}\n\nCurrent Rate: §e1 unit = ${rate} E§r\nHoldings: §b${hold} units§r` + (hold > 0 ? ` (Buy: ${buyRate}E)` : "") + `\nBalance: §a${bal} E§r`
  },
  forexBuyBtn: { ja: "§a買う（数量を指定）", en: "§aBuy (choose quantity)" },
  forexSellBtn: { ja: "§c売る（数量を指定）", en: "§cSell (choose quantity)" },
  forexBuyModalTitle: { ja: (name) => `${name} を買う`, en: (name) => `Buy ${name}` },
  forexSellModalTitle: { ja: (name) => `${name} を売る`, en: (name) => `Sell ${name}` },
  qtyMinus100: { ja: "§c-100", en: "§c-100" },
  qtyMinus50: { ja: "§c-50", en: "§c-50" },
  qtyMinus10: { ja: "§c-10", en: "§c-10" },
  qtyPlus10: { ja: "§a+10", en: "§a+10" },
  qtyPlus50: { ja: "§a+50", en: "§a+50" },
  qtyPlus100: { ja: "§a+100", en: "§a+100" },
  qtyConfirmBuy: { ja: "§6この数量で購入する", en: "§6Confirm Purchase" },
  qtyConfirmSell: { ja: "§6この数量で売却する", en: "§6Confirm Sale" },
  qtyStepBuyBody: {
    ja: (name, qty, unitCost, cost, max, bal) => `${name} を購入\n\n数量: §e${qty}§r (最大: ${max})\n単価: ${unitCost} E\n合計: §c${cost} E§r\n残高: §a${bal} E§r`,
    en: (name, qty, unitCost, cost, max, bal) => `Buying ${name}\n\nQty: §e${qty}§r (Max: ${max})\nUnit: ${unitCost} E\nTotal: §c${cost} E§r\nBalance: §a${bal} E§r`
  },
  qtyStepSellBody: {
    ja: (name, qty, unitCost, gain, max, hold) => `${name} を売却\n\n数量: §e${qty}§r (最大: ${max})\n単価: ${unitCost} E\n受取: §a${gain} E§r\n保有: §b${hold}§r`,
    en: (name, qty, unitCost, gain, max, hold) => `Selling ${name}\n\nQty: §e${qty}§r (Max: ${max})\nUnit: ${unitCost} E\nProceeds: §a${gain} E§r\nHold: §b${hold}§r`
  },
  forexBuyMsg: { ja: (name, qty, cost) => `§a[Forex] ${name} を${qty}口購入 (-${cost}E)`, en: (name, qty, cost) => `§a[Forex] Bought ${qty} units of ${name}. (-${cost}E)` },
  forexSellMsg: { ja: (name, qty, pnl) => `§a[Forex] ${name} ${qty}口売却 (損益: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)`, en: (name, qty, pnl) => `§a[Forex] Sold ${qty} units of ${name}. (PnL: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)` },
  forexSellShortage: { ja: "§c売却できる外貨が足りません。", en: "§cYou do not hold enough units to sell." },
  forexNoFunds: { ja: "§c1口も購入できるEがありません。", en: "§cYou cannot afford even 1 unit." },

  stockTitle: { ja: "§d株式市場", en: "§dStock Market" },
  stockBody: { ja: (bal) => `残高: §a${bal} E§r\n各企業の株式を売買します。`, en: (bal) => `Balance: §a${bal} E§r\nTrade corporate equities.` },
  stockButtonLine: { ja: (price, hold, pnl) => `§ePrice: ${price} E §r| 保有:${hold} ${pnl}`, en: (price, hold, pnl) => `§ePrice: ${price} E §r| Hold:${hold} ${pnl}` },
  stockTradeBody: {
    ja: (desc, price, holds, bought, bal) => `${desc}\n\n株価: §e${price} E§r\n保有数: §b${holds} 株§r` + (holds > 0 ? ` (買値: ${bought}E)` : "") + `\n口座残高: §a${bal} E§r`,
    en: (desc, price, holds, bought, bal) => `${desc}\n\nPrice: §e${price} E§r\nShares: §b${holds}§r` + (holds > 0 ? ` (Avg: ${bought}E)` : "") + `\nBalance: §a${bal} E§r`
  },
  stockBuyBtn: { ja: "§a買う（数量を指定）", en: "§aBuy (choose quantity)" },
  stockSellBtn: { ja: "§c売る（数量を指定）", en: "§cSell (choose quantity)" },
  stockBuyModalTitle: { ja: (name) => `${name} を買う`, en: (name) => `Buy ${name}` },
  stockSellModalTitle: { ja: (name) => `${name} を売る`, en: (name) => `Sell ${name}` },
  stockBuyMsg: { ja: (name, qty, cost) => `§a[Stock] ${name} を${qty}株購入 (-${cost}E)`, en: (name, qty, cost) => `§a[Stock] Bought ${qty} shares of ${name}. (-${cost}E)` },
  stockSellMsg: { ja: (name, qty, pnl) => `§a[Stock] ${name} ${qty}株売却 (損益: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)`, en: (name, qty, pnl) => `§a[Stock] Sold ${qty} shares of ${name}. (PnL: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)` },
  stockSellShortage: { ja: "§c売却できる株式がありません。", en: "§cYou do not own this stock." },
  stockNoFunds: { ja: "§c1株も購入できるEがありません。", en: "§cYou cannot afford even 1 share." },

  divBtnReady: { ja: "§6配当を受け取る\n§7(本日分・受給可能)", en: "§6Claim Dividend\n§7(Available today)" },
  divBtnDoneToday: { ja: "§7配当 受取済み\n§7(本日分)", en: "§7Dividend Claimed\n§7(Today)" },
  divBtnLocked: { ja: (th) => `§7配当ロック中\n§7(評価額 ${th}E 以上で解禁)`, en: (th) => `§7Dividend Locked\n§7(Unlocks at ${th}E value)` },
  divNotEligible: { ja: (th, val) => `§c配当には評価額 ${th}E 以上の保有が必要です (現在: ${val}E)`, en: (th, val) => `§cRequires at least ${th}E in stock value (Current: ${val}E)` },
  divAlreadyClaimed: { ja: "§e本日の配当は受け取り済みです。", en: "§eYou already claimed today's dividend." },
  divClaimMsg: { ja: (name) => `§a[配当] ${name} の配当物資を受け取りました！`, en: (name) => `§a[Dividend] Claimed dividend rewards from ${name}!` },

  futuresTitle: { ja: "§c花の先物契約", en: "§cFlower Futures" },
  futuresBody: {
    ja: (status) => `【ウィザーローズ指数 約束型先物】\n証拠金5Eで2日後の花相場を予測。\n満期日に上がれば利益、下がれば損失。\n§4※債務不履行はハチの制裁対象！§r\n\n${status}`,
    en: (status) => `[Wither Rose Index Futures]\nMargin: 5E. 2-day maturity prediction.\nProfit if it rises, loss if it falls.\n§4*Defaulting triggers bee swarms!§r\n\n${status}`
  },
  futuresActive: { ja: (strike, due, day) => `§e契約中: 基準 ${strike}E | 満期: Day ${due} (本日: Day ${day})`, en: (strike, due, day) => `§eContract: Strike ${strike}E | Due: Day ${due} (Today: Day ${day})` },
  futuresNone: { ja: "現在契約はありません。", en: "No active contracts." },
  futuresSettle: { ja: "契約を満期精算する", en: "Settle Contract" },
  futuresOpen: { ja: "契約を結ぶ (5E)", en: "Open Long Contract (5E)" },
  futuresOpenMsg: { ja: (strike, day) => `§a[Futures] 先物契約成立 (基準:${strike}E)。Day ${day} に戻ってきてください。`, en: (strike, day) => `§a[Futures] Contract opened! (Strike:${strike}E) Return on Day ${day}.` },
  futuresMarginShortage: { ja: "§c証拠金5Eが足りません。", en: "§cNeed 5 Emeralds in account balance." },
  futuresSettleMsg: {
    ja: (settle, strike, pnl) => `§a[Futures] 満期清算: ${settle}E (基準:${strike}E)\n損益: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E`,
    en: (settle, strike, pnl) => `§a[Futures] Settled at ${settle}E (Strike:${strike}E)\nPnL: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E`
  },
  futuresNotMatured: { ja: (due) => `§eまだ満期ではありません。Day ${due} に戻ってきてください。`, en: (due) => `§eNot matured yet. Return on Day ${due}.` },
  futuresDefault: { ja: "§4§l[債務不履行!]§r\n§c損失を支払えませんでした！警備バチが制裁に現れます！", en: "§4§l[DEFAULT!]§r\n§cFailed to pay the debt! Enraged bees attack!" },

  walletTitle: { ja: "§6コールドウォレット", en: "§6Cold Wallet" },
  walletBody: {
    ja: (pub, nonce, honeycomb) =>
      `§e公開鍵:§r ${pub}\n§enonce:§r ${nonce}\n§e出力可能ハニカム:§r ${honeycomb}\n\nハニカムをオフラインの「物語合言葉コード」として出力し、\n掲示板等で他人に譲渡できます。別ワールドでも読み込めます。`,
    en: (pub, nonce, honeycomb) =>
      `§ePublic Key:§r ${pub}\n§eNonce:§r ${nonce}\n§eAvailable Honeycomb:§r ${honeycomb}\n\nExport your Honeycomb as an offline 'story code' to trade\nwith others. Can also be imported into different worlds.`
  },
  walletExportBtn: { ja: "§a出力する（エクスポート）", en: "§aExport Story Code" },
  walletImportBtn: { ja: "§b読み込む（インポート）", en: "§bImport Story Code" },
  walletViewLastBtn: { ja: "§e 直近のコードを再確認", en: "§e View Last Issued Code" },
  walletResetBtn: { ja: "§7 シークレットワード再設定", en: "§7 Reset Secret Word" },
  walletExportEmpty: { ja: "§c出力できるハニカムがありません。", en: "§cYou have no Honeycomb to export." },
  walletThemeBody: { ja: "物語コードのテーマを選んでください。", en: "Choose a theme for your story code." },
  walletThemeBee: { ja: " ハチと自然の物語", en: " Bees & Nature Story" },
  walletThemeOre: { ja: " 鉱石と大地の物語", en: " Ores & Earth Story" },
  walletSetupTitle: { ja: "§6ウォレット作成", en: "§6Create Wallet" },
  walletSetupLabel: { ja: "シークレットワード（自分だけの合言葉。忘れないように秘密にしてください）", en: "Secret Word (your private phrase — keep it secret and safe)" },
  walletSetupConfirmLabel: { ja: "確認のため、もう一度入力してください", en: "Enter it again to confirm" },
  walletSetupMismatch: { ja: "§c入力が一致しませんでした。", en: "§cThe two entries did not match." },
  walletSetupEmpty: { ja: "§cシークレットワードを入力してください。", en: "§cPlease enter a secret word." },
  walletSetupCollision: { ja: "§cこの合言葉の公開鍵は既に他人が使っています。別の言葉をお試しください。", en: "§cThe public key from that word is already taken. Try another." },
  walletSetupDone: {
    ja: (pub) => `§aウォレットを作成しました！\n§e公開鍵:§r ${pub}\n\n公開鍵は共有しても安全です。合言葉は絶対に教えないでください。`,
    en: (pub) => `§aWallet created!\n§ePublic Key:§r ${pub}\n\nYour public key is safe to share. Never reveal your secret word.`
  },
  walletResetTitle: { ja: "§7シークレットワード再設定", en: "§7Reset Secret Word" },
  walletAuthTitle: { ja: "§a取引の署名", en: "§aSign Transaction" },
  walletAuthLabel: { ja: "シークレットワードを入力してください", en: "Enter your secret word" },
  walletAuthWrong: { ja: "§cシークレットワードが違います。", en: "§cWrong secret word. Please try again." },

  walletCopyModalTitle: { ja: "§6取引コード", en: "§6Transaction Code" },
  walletCopyModalLabel: {
    ja: "§e▼ この画面をスクリーンショットして相手に送ってください§r\n§7※コードを知る人は誰でもハニカムを受け取れます。§r",
    en: "§e▼ Screenshot this screen and send it to the recipient§r\n§7*Anyone with this code can claim the Honeycomb.§r"
  },
  walletNoLastCode: { ja: "§cまだコードを発行していません。", en: "§cNo codes have been issued yet." },

  walletExportMsg: { ja: (n) => `§a[Wallet] ${n} ハニカムを出金し、取引コードを発行しました。`, en: (n) => `§a[Wallet] Withdrew ${n} Honeycomb and generated a story code.` },
  walletImportTitle: { ja: "§b物語コード読み込み", en: "§bImport Story Code" },
  walletImportPhraseLabel: {
    ja: (n) => `${n}文目を貼り付け（単語だけでもOK）`,
    en: (n) => `Sentence ${n} (words only is OK too)`
  },
  walletImportBadPhrase: { ja: "§cコードを正しく認識できませんでした。単語や文章を確認してください。", en: "§cInvalid code. Please check the text." },
  walletImportTampered: { ja: "§cコードが破損しているか、改ざんされています。", en: "§cThis code is corrupted or tampered with." },
  walletImportUsed: { ja: "§eこのコードは既に使用済み（または追い越されたNonce）です。", en: "§eThis code has already been used." },
  walletImportSuccess: { ja: (n) => `§a[Wallet] ${n} ハニカムを受け取りました！`, en: (n) => `§a[Wallet] Received ${n} Honeycomb!` }
};

// ==========================================
// 2. 経済変動エンジン & ニュース配信
// ==========================================
function getCurrentCycleDay() {
  const day = world.getDay();
  return (day % 7) + 1;
}

function getCurrencyRate(key, day = getCurrentCycleDay()) {
  const c = CURRENCIES[key];
  const seed = world.getDynamicProperty(`curr_seed_${key}`) ?? 1;
  const sinVal = Math.sin(day * 0.9 + seed);
  const rate = c.baseRate * (1.0 + sinVal * c.volatility);
  return Math.max(0.2, parseFloat(rate.toFixed(1)));
}

function getStockPrice(key, day = getCurrentCycleDay()) {
  const s = STOCKS[key];
  const seed = world.getDynamicProperty(`stock_seed_${key}`) ?? 1;
  const sinVal = Math.sin(day * 1.2 + seed);
  const price = s.base * (1.0 + sinVal * s.vol);
  return Math.max(2, Math.round(price));
}

// 1〜7日目までの相場を配列で取得（週間の浮き沈みチャート用）
function getWeekCurrencyRates(key) {
  const rates = [];
  for (let d = 1; d <= 7; d++) rates.push(getCurrencyRate(key, d));
  return rates;
}

function getWeekStockPrices(key) {
  const prices = [];
  for (let d = 1; d <= 7; d++) prices.push(getStockPrice(key, d));
  return prices;
}

// ==========================================
// 2.5 相場チャート表示ユーティリティ（アイコン浮き沈み式）
// ==========================================
// 通貨/銘柄ごとの表示アイコン（絵文字は環境によって「?」化するため色付き●で代用）
const CURRENCY_ICONS = {
  honeycomb: "§6●",
  apple: "§c●",
  sweet_berry: "§d●",
  glow_berry: "§b●",
  chorus_fruit: "§5●"
};
const STOCK_ICONS = {
  pupple: "§9●",
  mcmoonald: "§f●",
  witcha_cola: "§d●",
  clattle: "§7●",
  eekbay: "§b●"
};

// ボタン一覧用：1行の簡易スパークライン（ブロック文字の高さで波を表現）
const SPARK_BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
function buildSparkline(weekValues) {
  const min = Math.min(...weekValues);
  const max = Math.max(...weekValues);
  const span = max - min;
  let out = "";
  for (let i = 0; i < weekValues.length; i++) {
    const v = weekValues[i];
    const level = span <= 0 ? Math.floor((SPARK_BLOCKS.length - 1) / 2) : Math.round(((v - min) / span) * (SPARK_BLOCKS.length - 1));
    const color = i === 0 ? "§7" : v > weekValues[i - 1] ? "§a" : v < weekValues[i - 1] ? "§c" : "§7";
    out += `${color}${SPARK_BLOCKS[level]}`;
  }
  return out + "§r";
}

// 詳細画面用：日数ごとにアイテムアイコンが上下する「浮き沈みチャート」
// (折れ線の代わりに、価格の高い日ほどアイコンを上段に配置して波を表現する)
function buildIconWaveChart(icon, weekValues, currentDay, rows = 4) {
  const min = Math.min(...weekValues);
  const max = Math.max(...weekValues);
  const span = max - min;

  const levels = weekValues.map((v) => {
    if (span <= 0) return Math.floor((rows - 1) / 2);
    return Math.round(((v - min) / span) * (rows - 1));
  });

  const lines = [];
  for (let r = rows - 1; r >= 0; r--) {
    let line = "";
    for (let d = 0; d < 7; d++) {
      const isCurrent = d + 1 === currentDay;
      line += levels[d] === r ? (isCurrent ? `§e●§r` : `${icon}§r`) : "§8・§r";
      line += " ";
    }
    lines.push(line.trimEnd());
  }

  let dayRow = "";
  for (let d = 1; d <= 7; d++) {
    dayRow += (d === currentDay ? `§e${d}§r` : `§7${d}§r`) + "  ";
  }
  lines.push(`§7────────────────§r`);
  lines.push(dayRow.trimEnd());

  return lines.join("\n");
}

// 毎週の経済ニュース配信
function broadcastWeeklyNews() {
  for (const p of world.getPlayers()) {
    const lang = getLang(p);
    p.sendMessage(t(lang, STR.marketNewsHeader));

    const choSeed = world.getDynamicProperty("curr_seed_chorus_fruit") ?? 1;
    if (choSeed > 6.5) {
      p.sendMessage(
        lang === "ja"
          ? "§d【外為速報】エンド界の果実豊作！CHO為替が急激に乱高下する予兆。"
          : "§d[Forex Alert] Chorus harvest boom! High volatility expected for CHO."
      );
    } else if (choSeed < 3.5) {
      p.sendMessage(
        lang === "ja"
          ? "§c【外為警戒】果樹園に気候異変？CHOの供給不安で下落リスクを警戒。"
          : "§c[Forex Alert] Climate shifts in orchards. Downward risk on CHO supply."
      );
    }

    const pplSeed = world.getDynamicProperty("stock_seed_pupple") ?? 1;
    if (pplSeed > 6.0) {
      p.sendMessage(
        lang === "ja"
          ? "§a【株式ニュース】Pupple社が次世代スマート首輪を発表！強気の買い気配。"
          : "§a[Stock News] Pupple unveils next-gen smart collar! Strong buy sentiment."
      );
    }

    const wccSeed = world.getDynamicProperty("stock_seed_witcha_cola") ?? 1;
    if (wccSeed > 7.0) {
      p.sendMessage(
        lang === "ja"
          ? "§e【株式ニュース】Witcha-Colaの秘伝レシピ人気爆発！株価急騰の気配。"
          : "§e[Stock News] Witcha-Cola potion drinks surge in popularity! Bullish trend."
      );
    }

    p.sendMessage(
      lang === "ja"
        ? "§f【今週の指針】新しい週が始まりました！市場の変動にご注意ください。"
        : "§f[Market Overview] A new week has begun! Watch market fluctuations closely."
    );
    p.sendMessage(t(lang, STR.marketNewsFooter));
  }
}

system.runInterval(() => {
  const day = getCurrentCycleDay();
  const lastDay = world.getDynamicProperty("last_checked_day") ?? 0;
  if (day === 1 && lastDay === 7) {
    for (const k of Object.keys(CURRENCIES)) {
      world.setDynamicProperty(`curr_seed_${k}`, Math.random() * 10);
    }
    for (const k of Object.keys(STOCKS)) {
      world.setDynamicProperty(`stock_seed_${k}`, Math.random() * 10);
    }
    applyBankInterest();
    broadcastWeeklyNews();
  }
  world.setDynamicProperty("last_checked_day", day);
}, 1200);

// ==========================================
// 3. 口座＆インベントリ管理（ロスト防止対応）
// ==========================================
// 銀行の利率設計: 銀行(安定・低リターン) < 株式 < 外貨/仮想通貨(不安定・高リターン)
// 外貨・株式は変動率(volatility)が大きく元本割れもあり得るのに対し、
// 銀行預金は変動なしの固定利子(元本保証)にすることで、リスク許容度に応じた住み分けを作る。
const BANK_INTEREST_RATE = 0.015; // 週1.5%固定（複利で毎週の経済リセット時に付与）

function getAccount(player) {
  return {
    emeralds: player.getDynamicProperty("acc_emeralds") ?? 0,
    honeycomb: player.getDynamicProperty("acc_curr_honeycomb") ?? 0,
    apple: player.getDynamicProperty("acc_curr_apple") ?? 0,
    sweet_berry: player.getDynamicProperty("acc_curr_sweet_berry") ?? 0,
    glow_berry: player.getDynamicProperty("acc_curr_glow_berry") ?? 0,
    chorus_fruit: player.getDynamicProperty("acc_curr_chorus_fruit") ?? 0
  };
}

// 週次の経済リセット時に、その時点でオンラインのプレイヤーへ利子チェックをかける
function applyBankInterest() {
  for (const p of world.getPlayers()) {
    checkAndGrantBankInterest(p);
  }
}

// その週の中でどこか1回でもログインしていれば利子がもらえるようにする。
// 「最後に利子を受け取った週番号」をプレイヤーごとに記録し、現在の週番号とズレていたら
// (=前回付与から少なくとも1週間経過している、または今週まだ受け取っていない)その場で付与する。
// これにより「週の切り替わりの瞬間にオンラインである必要」がなくなる。
function getWeekNumber() {
  return Math.floor(world.getDay() / 7);
}

function checkAndGrantBankInterest(player) {
  const currentWeek = getWeekNumber();
  const lastWeek = player.getDynamicProperty("bank_interest_week");

  // 初回ログイン時(記録なし)は付与せず、今週分としてマークするだけにする
  if (lastWeek === undefined) {
    player.setDynamicProperty("bank_interest_week", currentWeek);
    return;
  }
  if (lastWeek === currentWeek) return; // 今週分は受け取り済み

  const acc = getAccount(player);
  const interest = Math.floor(acc.emeralds * BANK_INTEREST_RATE);
  if (interest > 0) {
    player.setDynamicProperty("acc_emeralds", acc.emeralds + interest);
    const lang = getLang(player);
    player.sendMessage(t(lang, STR.bankInterestMsg, interest));
  }
  player.setDynamicProperty("bank_interest_week", currentWeek);
}

// ログイン時にも同じチェックをかける（週の途中でログインしても、その週分を取りこぼさないように）
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  checkAndGrantBankInterest(event.player);
});

function getTotalNetWorth(player) {
  const acc = getAccount(player);
  let total = acc.emeralds;
  for (const [key] of Object.entries(CURRENCIES)) {
    total += acc[key] * getCurrencyRate(key);
  }
  for (const [key] of Object.entries(STOCKS)) {
    const holds = player.getDynamicProperty(`acc_stock_${key}`) ?? 0;
    total += holds * getStockPrice(key);
  }
  return Math.round(total);
}

function getItemCount(player, typeId) {
  let count = 0;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return 0;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item && item.typeId === typeId) count += item.amount;
  }
  return count;
}

function removeItem(player, typeId, amount) {
  let left = amount;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item && item.typeId === typeId) {
      if (item.amount <= left) {
        left -= item.amount;
        container.setItem(i, undefined);
      } else {
        item.amount -= left;
        container.setItem(i, item);
        left = 0;
      }
      if (left <= 0) break;
    }
  }
}

// インベントリ満杯時に足元へ安全ドロップする改善版
function giveItem(player, typeId, amount) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  let left = amount;
  while (left > 0) {
    const s = Math.min(left, 64);
    const item = new ItemStack(typeId, s);
    const leftover = container.addItem(item);
    if (leftover && leftover.amount > 0) {
      player.dimension.spawnItem(leftover, player.location);
    }
    left -= s;
  }
}

// ==========================================
// 4. 配当システム（安全な醸造素材セット）
// ==========================================
const DIVIDEND_THRESHOLD = 100;

function getDividendEligibility(player, key) {
  const price = getStockPrice(key);
  const holds = player.getDynamicProperty(`acc_stock_${key}`) ?? 0;
  const value = holds * price;
  const absDay = world.getDay();
  const lastClaim = player.getDynamicProperty(`div_last_claim_${key}`) ?? -1;
  return {
    eligible: value >= DIVIDEND_THRESHOLD,
    value,
    alreadyClaimedToday: lastClaim === absDay
  };
}

function giveDividendReward(player, key) {
  const animal = STOCKS[key].animal;
  switch (animal) {
    case "dog":
      giveItem(player, "minecraft:cooked_beef", 4);
      giveItem(player, "minecraft:cooked_porkchop", 4);
      giveItem(player, "minecraft:cooked_chicken", 4);
      giveItem(player, "minecraft:cooked_mutton", 4);
      break;
    case "cow":
      giveItem(player, "minecraft:pumpkin_pie", 3);
      giveItem(player, "minecraft:cake", 1);
      break;
    case "witch": {
      // 醸造素材セット
      const POOL = [
        { id: "minecraft:nether_wart", count: 3 },
        { id: "minecraft:blaze_powder", count: 2 },
        { id: "minecraft:glistering_melon_slice", count: 2 },
        { id: "minecraft:golden_carrot", count: 2 },
        { id: "minecraft:magma_cream", count: 2 },
        { id: "minecraft:phantom_membrane", count: 1 }
      ];
      const pick = POOL[Math.floor(Math.random() * POOL.length)];
      giveItem(player, pick.id, pick.count);
      giveItem(player, "minecraft:glass_bottle", 3);
      break;
    }
    case "skeleton":
      giveItem(player, "minecraft:bow", 1);
      giveItem(player, "minecraft:arrow", 32);
      giveItem(player, "minecraft:bone_meal", 8);
      break;
    case "dolphin": {
      const pool = ["minecraft:nautilus_shell", "minecraft:heart_of_the_sea", "minecraft:prismarine_crystals"];
      const item = pool[Math.floor(Math.random() * pool.length)];
      giveItem(player, item, 1);
      break;
    }
  }
}

function claimDividend(player, key) {
  const lang = getLang(player);
  const { eligible, value, alreadyClaimedToday } = getDividendEligibility(player, key);

  if (!eligible) {
    player.sendMessage(t(lang, STR.divNotEligible, DIVIDEND_THRESHOLD, value));
    return;
  }
  if (alreadyClaimedToday) {
    player.sendMessage(t(lang, STR.divAlreadyClaimed));
    return;
  }

  player.setDynamicProperty(`div_last_claim_${key}`, world.getDay());
  giveDividendReward(player, key);
  player.sendMessage(t(lang, STR.divClaimMsg, t(lang, STOCKS[key].name)));
}

// ==========================================
// 5. コールドウォレット（コピペ画面・直近コード再確認対応）
// ==========================================
function getWallet(player) {
  const publicKey = player.getDynamicProperty("wallet_pub");
  if (publicKey === undefined) return null;
  return { publicKey, nonce: player.getDynamicProperty("wallet_nonce") ?? 0 };
}

function createWallet(player, secretWord) {
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

function checkSecretWord(wallet, secretWord) {
  return matchesPublicKeyAnyVersion(secretWord, wallet.publicKey);
}

function importWalletCode(player, codeText) {
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

// スクリーンショットで一画面に収まるよう、説明文は最小限にして物語本文を主役にする
function showCopyableCodeModal(player, codeText) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, STR.walletCopyModalTitle))
    .body(`${codeText}\n\n${t(lang, STR.walletCopyModalLabel)}`)
    .button(t(lang, STR.back));

  form.show(player).then(() => {
    openMainMenu(player);
  }).catch((e) => {
    console.warn("[BeeMyHoney] Copy modal error: " + e);
  });
}

function executeWalletExport(player, theme) {
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

// ==========================================
// 6. 巣箱インタラクト判定
// ==========================================
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block, itemStack } = event;
  if (!block || !itemStack) return;

  if ((block.typeId === "minecraft:bee_nest" || block.typeId === "minecraft:beehive") && itemStack.typeId === "minecraft:book") {
    event.cancel = true;
    system.run(() => openMainMenu(player));
  }
});

// ==========================================
// 7. UI メニュー実装
// ==========================================
function openMainMenu(player) {
  const lang = getLang(player);
  const day = getCurrentCycleDay();
  const acc = getAccount(player);
  const netWorth = getTotalNetWorth(player);

  const form = new ActionFormData()
    .title(t(lang, STR.mainTitle))
    .body(t(lang, STR.mainBody, day, acc.emeralds, netWorth))
    .button(t(lang, STR.btnBank), "textures/items/emerald")
    .button(t(lang, STR.btnForex), "textures/items/gold_ingot")
    .button(t(lang, STR.btnStock), "textures/items/iron_ingot")
    .button(t(lang, STR.btnFutures), "textures/blocks/flower_tulip_red")
    .button(t(lang, STR.btnWallet), "textures/items/honeycomb")
    .button(t(lang, STR.btnLang, lang));

  form.show(player).then((res) => {
    if (res.canceled) return;
    switch (res.selection) {
      case 0: openBankingMenu(player); break;
      case 1: openForexMenu(player); break;
      case 2: openStockMarketMenu(player); break;
      case 3: openFuturesMenu(player); break;
      case 4: openWalletMenu(player); break;
      case 5: openLanguageMenu(player); break;
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openLanguageMenu(player) {
  const lang = getLang(player);
  const form = new ActionFormData()
    .title(t(lang, STR.langTitle))
    .body(t(lang, STR.langBody))
    .button(t(lang, STR.langBtnJa))
    .button(t(lang, STR.langBtnEn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openMainMenu(player);
    const newLang = res.selection === 0 ? "ja" : "en";
    setLang(player, newLang);
    player.sendMessage(t(newLang, STR.langSetMsg));
    openMainMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// コールドウォレット メニュー
function openWalletMenu(player) {
  const wallet = getWallet(player);
  if (!wallet) return openWalletSetupForm(player, { isReset: false });

  const lang = getLang(player);
  const acc = getAccount(player);
  const form = new ActionFormData()
    .title(t(lang, STR.walletTitle))
    .body(t(lang, STR.walletBody, formatPublicKey(wallet.publicKey), wallet.nonce, acc.honeycomb))
    .button(t(lang, STR.walletExportBtn))
    .button(t(lang, STR.walletImportBtn))
    .button(t(lang, STR.walletViewLastBtn))
    .button(t(lang, STR.walletResetBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 4) return openMainMenu(player);
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
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openWalletSetupForm(player, { isReset }) {
  const lang = getLang(player);
  const form = new ModalFormData()
    .title(t(lang, isReset ? STR.walletResetTitle : STR.walletSetupTitle))
    .textField(t(lang, STR.walletSetupLabel), "")
    .textField(t(lang, STR.walletSetupConfirmLabel), "");

  form.show(player).then((res) => {
    if (res.canceled) return isReset ? openWalletMenu(player) : openMainMenu(player);

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

function openWalletExportTheme(player) {
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

function openWalletExportAuthForm(player, theme) {
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

function openWalletImportForm(player) {
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
    openMainMenu(player);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

// 銀行・外為・株式・先物のUI
function openBankingMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const invEmeralds = getItemCount(player, "minecraft:emerald");

  const form = new ActionFormData()
    .title(t(lang, STR.bankTitle))
    .body(t(lang, STR.bankBody, acc.emeralds, invEmeralds, (BANK_INTEREST_RATE * 100).toFixed(1)))
    .button(t(lang, STR.bankDeposit10))
    .button(t(lang, STR.bankDepositAll))
    .button(t(lang, STR.bankWithdraw10))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openMainMenu(player);
    if (res.selection === 0) {
      if (invEmeralds >= 10) {
        removeItem(player, "minecraft:emerald", 10);
        player.setDynamicProperty("acc_emeralds", acc.emeralds + 10);
        player.sendMessage(t(lang, STR.bankDepositMsg, 10));
      } else player.sendMessage(t(lang, STR.bankInvShortage));
    } else if (res.selection === 1) {
      if (invEmeralds > 0) {
        removeItem(player, "minecraft:emerald", invEmeralds);
        player.setDynamicProperty("acc_emeralds", acc.emeralds + invEmeralds);
        player.sendMessage(t(lang, STR.bankDepositMsg, invEmeralds));
      } else player.sendMessage(t(lang, STR.bankInvShortage));
    } else if (res.selection === 2) {
      if (acc.emeralds >= 10) {
        player.setDynamicProperty("acc_emeralds", acc.emeralds - 10);
        giveItem(player, "minecraft:emerald", 10);
        player.sendMessage(t(lang, STR.bankWithdrawMsg, 10));
      } else player.sendMessage(t(lang, STR.bankAccShortage));
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openForexMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const form = new ActionFormData()
    .title(t(lang, STR.forexTitle))
    .body(t(lang, STR.forexBody, acc.emeralds));

  for (const [key, val] of Object.entries(CURRENCIES)) {
    const rate = getCurrencyRate(key);
    const hold = acc[key];
    const buyRate = player.getDynamicProperty(`acc_rate_${key}`) ?? rate;

    let diffText = t(lang, STR.none);
    if (hold > 0) {
      const diff = parseFloat((rate - buyRate).toFixed(1));
      diffText = diff > 0 ? `§a[+${diff}▲]` : diff < 0 ? `§c[${diff}▼]` : `§e[±0]`;
    }
    const spark = buildSparkline(getWeekCurrencyRates(key));
    form.button(`${t(lang, val.name)}\n${t(lang, STR.forexButtonLine, rate, hold, diffText)}\n${spark}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection >= Object.keys(CURRENCIES).length) return openMainMenu(player);
    openForexTradeDialog(player, Object.keys(CURRENCIES)[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openForexTradeDialog(player, currKey) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const acc = getAccount(player);
  const hold = acc[currKey];
  const buyRate = player.getDynamicProperty(`acc_rate_${currKey}`) ?? 0;
  const day = getCurrentCycleDay();
  const waveChart = buildIconWaveChart(CURRENCY_ICONS[currKey], getWeekCurrencyRates(currKey), day);

  const form = new ActionFormData()
    .title(t(lang, c.name))
    .body(
      t(lang, STR.forexTradeBody, t(lang, c.desc), rate, hold, buyRate, acc.emeralds) +
      `\n\n${t(lang, STR.waveChartLabel)}\n${waveChart}`
    )
    .button(t(lang, STR.forexBuyBtn))
    .button(t(lang, STR.forexSellBtn))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 2) return openForexMenu(player);
    if (res.selection === 0) openForexBuyModal(player, currKey);
    else if (res.selection === 1) openForexSellModal(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

const QTY_STEP_DELTAS = [-100, -50, -10, 10, 50, 100];

function openForexBuyModal(player, currKey, qty = 1) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const acc = getAccount(player);
  const maxUnits = Math.floor(acc.emeralds / rate);

  if (maxUnits < 1) {
    player.sendMessage(t(lang, STR.forexNoFunds));
    return openForexTradeDialog(player, currKey);
  }

  qty = Math.max(1, Math.min(qty, maxUnits));
  const unitCost = Math.round(rate * 10) / 10;
  const cost = Math.round(rate * qty);

  const form = new ActionFormData()
    .title(t(lang, STR.forexBuyModalTitle, t(lang, c.name)))
    .body(t(lang, STR.qtyStepBuyBody, t(lang, c.name), qty, unitCost, cost, maxUnits, acc.emeralds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmBuy))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openForexTradeDialog(player, currKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], maxUnits));
      return openForexBuyModal(player, currKey, newQty);
    }
    const accNow = getAccount(player);
    const holdNow = accNow[currKey];
    const finalCost = Math.round(rate * qty);

    if (accNow.emeralds >= finalCost) {
      const prevRate = player.getDynamicProperty(`acc_rate_${currKey}`) ?? rate;
      const newAvgRate = holdNow > 0 ? (prevRate * holdNow + rate * qty) / (holdNow + qty) : rate;
      player.setDynamicProperty("acc_emeralds", accNow.emeralds - finalCost);
      player.setDynamicProperty(`acc_curr_${currKey}`, holdNow + qty);
      player.setDynamicProperty(`acc_rate_${currKey}`, parseFloat(newAvgRate.toFixed(2)));
      player.sendMessage(t(lang, STR.forexBuyMsg, t(lang, c.name), qty, finalCost));
    } else {
      player.sendMessage(t(lang, STR.bankAccShortage));
    }
    openForexTradeDialog(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openForexSellModal(player, currKey, qty = 1) {
  const lang = getLang(player);
  const c = CURRENCIES[currKey];
  const rate = getCurrencyRate(currKey);
  const acc = getAccount(player);
  const hold = acc[currKey];
  const buyRate = player.getDynamicProperty(`acc_rate_${currKey}`) ?? rate;

  if (hold < 1) {
    player.sendMessage(t(lang, STR.forexSellShortage));
    return openForexTradeDialog(player, currKey);
  }

  qty = Math.max(1, Math.min(qty, hold));
  const unitCost = Math.round(rate * 10) / 10;
  const gain = Math.round(rate * qty);

  const form = new ActionFormData()
    .title(t(lang, STR.forexSellModalTitle, t(lang, c.name)))
    .body(t(lang, STR.qtyStepSellBody, t(lang, c.name), qty, unitCost, gain, hold, hold))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmSell))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openForexTradeDialog(player, currKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], hold));
      return openForexSellModal(player, currKey, newQty);
    }
    const accNow = getAccount(player);
    const holdNow = accNow[currKey];
    if (holdNow >= qty) {
      const finalGain = Math.round(rate * qty);
      const pnl = Math.round((rate - buyRate) * qty);
      player.setDynamicProperty("acc_emeralds", accNow.emeralds + finalGain);
      player.setDynamicProperty(`acc_curr_${currKey}`, holdNow - qty);
      player.sendMessage(t(lang, STR.forexSellMsg, t(lang, c.name), qty, pnl));
    } else {
      player.sendMessage(t(lang, STR.forexSellShortage));
    }
    openForexTradeDialog(player, currKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openStockMarketMenu(player) {
  const lang = getLang(player);
  const acc = getAccount(player);
  const form = new ActionFormData()
    .title(t(lang, STR.stockTitle))
    .body(t(lang, STR.stockBody, acc.emeralds));

  for (const [key, val] of Object.entries(STOCKS)) {
    const price = getStockPrice(key);
    const holds = player.getDynamicProperty(`acc_stock_${key}`) ?? 0;
    const bought = player.getDynamicProperty(`acc_stock_bought_${key}`) ?? 0;
    let pnlText = t(lang, STR.none);
    if (holds > 0) {
      const diff = price - bought;
      pnlText = diff > 0 ? `§a[+${diff}▲]` : diff < 0 ? `§c[${diff}▼]` : `§e[±0]`;
    }
    const spark = buildSparkline(getWeekStockPrices(key));
    form.button(`${t(lang, val.name)}\n${t(lang, STR.stockButtonLine, price, holds, pnlText)}\n${spark}`);
  }
  form.button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection >= Object.keys(STOCKS).length) return openMainMenu(player);
    openStockTradeDialog(player, Object.keys(STOCKS)[res.selection]);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openStockTradeDialog(player, stockKey) {
  const lang = getLang(player);
  const s = STOCKS[stockKey];
  const price = getStockPrice(stockKey);
  const acc = getAccount(player);
  const holds = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
  const bought = player.getDynamicProperty(`acc_stock_bought_${stockKey}`) ?? 0;
  const day = getCurrentCycleDay();
  const waveChart = buildIconWaveChart(STOCK_ICONS[stockKey], getWeekStockPrices(stockKey), day);

  const divInfo = getDividendEligibility(player, stockKey);
  let divLabel = !divInfo.eligible
    ? t(lang, STR.divBtnLocked, DIVIDEND_THRESHOLD)
    : divInfo.alreadyClaimedToday
    ? t(lang, STR.divBtnDoneToday)
    : t(lang, STR.divBtnReady);

  const form = new ActionFormData()
    .title(t(lang, s.name))
    .body(
      t(lang, STR.stockTradeBody, t(lang, s.desc), price, holds, bought, acc.emeralds) +
      `\n\n${t(lang, STR.waveChartLabel)}\n${waveChart}`
    )
    .button(t(lang, STR.stockBuyBtn))
    .button(t(lang, STR.stockSellBtn))
    .button(divLabel)
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) return openStockMarketMenu(player);
    if (res.selection === 0) openStockBuyModal(player, stockKey);
    else if (res.selection === 1) openStockSellModal(player, stockKey);
    else if (res.selection === 2) {
      claimDividend(player, stockKey);
      openStockTradeDialog(player, stockKey);
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openStockBuyModal(player, stockKey, qty = 1) {
  const lang = getLang(player);
  const s = STOCKS[stockKey];
  const price = getStockPrice(stockKey);
  const acc = getAccount(player);
  const maxShares = Math.floor(acc.emeralds / price);

  if (maxShares < 1) {
    player.sendMessage(t(lang, STR.stockNoFunds));
    return openStockTradeDialog(player, stockKey);
  }

  qty = Math.max(1, Math.min(qty, maxShares));
  const cost = price * qty;

  const form = new ActionFormData()
    .title(t(lang, STR.stockBuyModalTitle, t(lang, s.name)))
    .body(t(lang, STR.qtyStepBuyBody, t(lang, s.name), qty, price, cost, maxShares, acc.emeralds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmBuy))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openStockTradeDialog(player, stockKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], maxShares));
      return openStockBuyModal(player, stockKey, newQty);
    }
    const accNow = getAccount(player);
    const holdsNow = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
    const finalCost = price * qty;

    if (accNow.emeralds >= finalCost) {
      const prevBought = player.getDynamicProperty(`acc_stock_bought_${stockKey}`) ?? price;
      const newAvgBought = holdsNow > 0 ? (prevBought * holdsNow + price * qty) / (holdsNow + qty) : price;
      player.setDynamicProperty("acc_emeralds", accNow.emeralds - finalCost);
      player.setDynamicProperty(`acc_stock_${stockKey}`, holdsNow + qty);
      player.setDynamicProperty(`acc_stock_bought_${stockKey}`, Math.round(newAvgBought));
      player.sendMessage(t(lang, STR.stockBuyMsg, t(lang, s.name), qty, finalCost));
    } else {
      player.sendMessage(t(lang, STR.bankAccShortage));
    }
    openStockTradeDialog(player, stockKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openStockSellModal(player, stockKey, qty = 1) {
  const lang = getLang(player);
  const s = STOCKS[stockKey];
  const price = getStockPrice(stockKey);
  const holds = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
  const bought = player.getDynamicProperty(`acc_stock_bought_${stockKey}`) ?? 0;

  if (holds < 1) {
    player.sendMessage(t(lang, STR.stockSellShortage));
    return openStockTradeDialog(player, stockKey);
  }

  qty = Math.max(1, Math.min(qty, holds));
  const gain = price * qty;

  const form = new ActionFormData()
    .title(t(lang, STR.stockSellModalTitle, t(lang, s.name)))
    .body(t(lang, STR.qtyStepSellBody, t(lang, s.name), qty, price, gain, holds, holds))
    .button(t(lang, STR.qtyMinus100)).button(t(lang, STR.qtyMinus50)).button(t(lang, STR.qtyMinus10))
    .button(t(lang, STR.qtyPlus10)).button(t(lang, STR.qtyPlus50)).button(t(lang, STR.qtyPlus100))
    .button(t(lang, STR.qtyConfirmSell))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 7) return openStockTradeDialog(player, stockKey);
    if (res.selection <= 5) {
      const newQty = Math.max(1, Math.min(qty + QTY_STEP_DELTAS[res.selection], holds));
      return openStockSellModal(player, stockKey, newQty);
    }
    const acc = getAccount(player);
    const holdsNow = player.getDynamicProperty(`acc_stock_${stockKey}`) ?? 0;
    if (holdsNow >= qty) {
      const finalGain = price * qty;
      const pnl = (price - bought) * qty;
      player.setDynamicProperty("acc_emeralds", acc.emeralds + finalGain);
      player.setDynamicProperty(`acc_stock_${stockKey}`, holdsNow - qty);
      player.sendMessage(t(lang, STR.stockSellMsg, t(lang, s.name), qty, pnl));
    } else {
      player.sendMessage(t(lang, STR.stockSellShortage));
    }
    openStockTradeDialog(player, stockKey);
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function openFuturesMenu(player) {
  const lang = getLang(player);
  const day = getCurrentCycleDay();
  const acc = getAccount(player);
  const absDay = world.getDay();
  const dueAbsDay = player.getDynamicProperty("futures_due_abs_day") ?? 0;
  const strikeRate = player.getDynamicProperty("futures_strike_price") ?? 0;
  const hasContract = dueAbsDay > 0;
  const dueDisplayDay = hasContract ? (dueAbsDay % 7) + 1 : 0;

  const statusLine = hasContract
    ? t(lang, STR.futuresActive, strikeRate, dueDisplayDay, day)
    : t(lang, STR.futuresNone);

  const form = new ActionFormData()
    .title(t(lang, STR.futuresTitle))
    .body(t(lang, STR.futuresBody, statusLine))
    .button(hasContract ? t(lang, STR.futuresSettle) : t(lang, STR.futuresOpen))
    .button(t(lang, STR.back));

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) return openMainMenu(player);
    if (!hasContract) {
      if (acc.emeralds >= 5) {
        player.setDynamicProperty("acc_emeralds", acc.emeralds - 5);
        const targetAbsDay = absDay + 2;
        const currentFlowerIndex = 15 + Math.floor(Math.random() * 10);
        player.setDynamicProperty("futures_due_abs_day", targetAbsDay);
        player.setDynamicProperty("futures_strike_price", currentFlowerIndex);
        player.sendMessage(t(lang, STR.futuresOpenMsg, currentFlowerIndex, (targetAbsDay % 7) + 1));
      } else {
        player.sendMessage(t(lang, STR.futuresMarginShortage));
      }
    } else {
      if (absDay >= dueAbsDay) {
        const settlementPrice = 5 + Math.floor(Math.random() * 30);
        const profit = (settlementPrice - strikeRate) * 2;
        player.setDynamicProperty("futures_due_abs_day", 0);
        player.setDynamicProperty("futures_strike_price", 0);

        const newBalance = acc.emeralds + profit;
        if (newBalance >= 0) {
          player.setDynamicProperty("acc_emeralds", newBalance);
          player.sendMessage(t(lang, STR.futuresSettleMsg, settlementPrice, strikeRate, profit));
        } else {
          player.setDynamicProperty("acc_emeralds", 0);
          triggerBeePenalty(player);
        }
      } else {
        player.sendMessage(t(lang, STR.futuresNotMatured, dueDisplayDay));
      }
    }
  }).catch((e) => console.warn("[BeeMyHoney] UI error: " + e));
}

function triggerBeePenalty(player) {
  const lang = getLang(player);
  player.sendMessage(t(lang, STR.futuresDefault));
  const dim = player.dimension;
  const loc = player.location;

  // ハチに雇われた傭兵という設定でクモを2匹召喚
  for (let i = 0; i < 2; i++) {
    dim.spawnEntity("minecraft:spider", {
      x: loc.x + (Math.random() - 0.5) * 3,
      y: loc.y + 1,
      z: loc.z + (Math.random() - 0.5) * 3
    });
  }
}