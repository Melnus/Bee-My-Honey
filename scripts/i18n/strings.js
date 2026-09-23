// ==========================================
// UIテキスト辞書 / UI String Dictionary
// ==========================================
export const STR = {
  marketNewsHeader: { ja: "§e======  週刊・蜂森経済新聞 ======§r", en: "§e======  Weekly Bee News ======§r" },
  marketNewsFooter: { ja: "§e==============================§r", en: "§e==============================§r" },
  mainTitle: { ja: "ハニカム電子取引所", en: "Bee Exchange" },
  mainBody: {
    ja: (day, bal, net) => `【Day ${day}/7 日目】\n電子残高: ${bal} E\n推計総資産: ${net} E\n\n操作を選択してください:`,
    en: (day, bal, net) => `[Day ${day}/7]\nEmerald Balance: ${bal} E\nNet Worth: ${net} E\n\nSelect an action:`
  },
  btnBank: { ja: "口座管理\n(預入・引出)", en: "Bank\n(Deposit & Withdraw)" },
  btnForex: { ja: "外貨為替\n(5種の通貨)", en: "Forex Market\n(5 Currencies)" },
  btnStock: { ja: "株式市場\n(7銘柄)", en: "Stock Market\n(7 Tickers)" },
  btnFutures: { ja: "花の先物\n(レバレッジ取引)", en: "Flower Futures\n(Leverage Trade)" },
  btnWallet: { ja: "コールドウォレット\n(物語コード発行/読込)", en: "Cold Wallet\n(Story Code Export/Import)" },
  btnLang: {
    ja: (cur) => ` 言語設定\n(現在: ${cur === "ja" ? "日本語" : "English"})`,
    en: (cur) => ` Language\n(Current: ${cur === "ja" ? "日本語" : "English"})`
  },
  langTitle: { ja: "言語設定 / Language", en: "Language / 言語設定" },
  langBody: { ja: "表示言語を選択してください。", en: "Please select a display language." },
  langBtnJa: { ja: "日本語", en: "日本語" },
  langBtnEn: { ja: "English", en: "English" },
  langSetMsg: { ja: "§a表示言語を日本語に設定しました。", en: "§aDisplay language set to English." },
  bankTitle: { ja: "口座管理", en: "Bank Account" },
  bankBody: {
    ja: (bal, inv, rate) => `電子残高: ${bal} E\n所持現物: ${inv} エメラルド\n週利 ${rate}%（元本保証・低リターン）`,
    en: (bal, inv, rate) => `Bank Balance: ${bal} E\nIn Inventory: ${inv} Emeralds\nWeekly Interest: ${rate}% (Guaranteed, Low Return)`
  },
  bankDepositBtn: { ja: "預け入れる", en: "Deposit" },
  bankDepositModalTitle: { ja: "エメラルドを預け入れる", en: "Deposit Emeralds" },
  bankDepositStepBody: {
    ja: (qty, inv) => `口座へ預け入れる\n\n数量: ${qty} E\n所持数: ${inv} E`,
    en: (qty, inv) => `Deposit to Balance\n\nQty: ${qty} E\nIn Inventory: ${inv} E`
  },
  bankConfirmDeposit: { ja: "この数量で預け入れる", en: "Confirm Deposit" },
  bankWithdrawBtn: { ja: "引き出す", en: "Withdraw" },
  bankWithdrawModalTitle: { ja: "エメラルドを引き出す", en: "Withdraw Emeralds" },
  bankWithdrawStepBody: {
    ja: (qty, bal) => `口座から引き出す\n\n数量: ${qty} E\n口座残高: ${bal} E`,
    en: (qty, bal) => `Withdraw from Balance\n\nQty: ${qty} E\nBalance: ${bal} E`
  },
  bankConfirmWithdraw: { ja: "この数量で引き出す", en: "Confirm Withdrawal" },
  back: { ja: "« 戻る", en: "« Back" },
  bankDepositMsg: { ja: (n) => `§a[Bank] ${n}エメラルドを入金しました。`, en: (n) => `§a[Bank] Deposited ${n} Emeralds.` },
  bankWithdrawMsg: { ja: (n) => `§a[Bank] ${n}エメラルドを引き出しました。`, en: (n) => `§a[Bank] Withdrew ${n} Emeralds.` },
  bankInvShortage: { ja: "§cエメラルドが足りません。", en: "§cInsufficient Emeralds in inventory." },
  bankAccShortage: { ja: "§c口座残高が不足しています。", en: "§cInsufficient account balance." },
  bankInterestMsg: { ja: (n) => `§a[利子] 口座残高に${n}Eの利子がつきました。`, en: (n) => `§a[Interest] Earned ${n}E in bank interest.` },

  forexTitle: { ja: "外貨為替", en: "Forex Market" },
  forexBody: { ja: (bal) => `残高: ${bal} E\n外貨を保有するとレートに応じて資産が増減します。`, en: (bal) => `Balance: ${bal} E\nHolding currencies fluctuates your net worth.` },
  forexButtonLine: { ja: (rate, hold, diff) => `レート: ${rate}E | 保有:${hold} ${diff}`, en: (rate, hold, diff) => `Rate: ${rate}E | Hold:${hold} ${diff}` },
  waveChartLabel: { ja: "§b▽ 週間推移 (Day1→7・アイコンが浮き沈み)§r", en: "§b▽ Weekly Trend (Day1→7)§r" },
  none: { ja: "[未保有]", en: "[None]" },
  forexTradeBody: {
    ja: (desc, rate, hold, buyRate, bal) => `${desc}\n\n現在レート: 1口 = ${rate} E\n保有数: ${hold} 口` + (hold > 0 ? ` (取得: ${buyRate}E)` : "") + `\n残高: ${bal} E`,
    en: (desc, rate, hold, buyRate, bal) => `${desc}\n\nCurrent Rate: 1 unit = ${rate} E\nHoldings: ${hold} units` + (hold > 0 ? ` (Buy: ${buyRate}E)` : "") + `\nBalance: ${bal} E`
  },
  forexBuyBtn: { ja: "買う（数量を指定）", en: "Buy (choose quantity)" },
  forexSellBtn: { ja: "売る（数量を指定）", en: "Sell (choose quantity)" },
  forexBuyModalTitle: { ja: (name) => `${name} を買う`, en: (name) => `Buy ${name}` },
  forexSellModalTitle: { ja: (name) => `${name} を売る`, en: (name) => `Sell ${name}` },
  qtyMinus100: { ja: "§c-100", en: "§c-100" },
  qtyMinus50: { ja: "§c-50", en: "§c-50" },
  qtyMinus10: { ja: "§c-10", en: "§c-10" },
  qtyPlus10: { ja: "§a+10", en: "§a+10" },
  qtyPlus50: { ja: "§a+50", en: "§a+50" },
  qtyPlus100: { ja: "§a+100", en: "§a+100" },
  qtyConfirmBuy: { ja: "この数量で購入する", en: "Confirm Purchase" },
  qtyConfirmSell: { ja: "この数量で売却する", en: "Confirm Sale" },
  qtyStepBuyBody: {
    ja: (name, qty, unitCost, cost, max, bal) => `${name} を購入\n\n数量: ${qty} (最大: ${max})\n単価: ${unitCost} E\n合計: §c${cost} E§r\n残高: ${bal} E`,
    en: (name, qty, unitCost, cost, max, bal) => `Buying ${name}\n\nQty: ${qty} (Max: ${max})\nUnit: ${unitCost} E\nTotal: §c${cost} E§r\nBalance: ${bal} E`
  },
  qtyStepSellBody: {
    ja: (name, qty, unitCost, gain, max, hold) => `${name} を売却\n\n数量: ${qty} (最大: ${max})\n単価: ${unitCost} E\n受取: §a${gain} E§r\n保有: ${hold}`,
    en: (name, qty, unitCost, gain, max, hold) => `Selling ${name}\n\nQty: ${qty} (Max: ${max})\nUnit: ${unitCost} E\nProceeds: §a${gain} E§r\nHold: ${hold}`
  },
  forexBuyMsg: { ja: (name, qty, cost) => `§a[Forex] ${name} を${qty}口購入 (-${cost}E)`, en: (name, qty, cost) => `§a[Forex] Bought ${qty} units of ${name}. (-${cost}E)` },
  forexSellMsg: { ja: (name, qty, pnl) => `§a[Forex] ${name} ${qty}口売却 (損益: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)`, en: (name, qty, pnl) => `§a[Forex] Sold ${qty} units of ${name}. (PnL: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)` },
  forexSellShortage: { ja: "§c売却できる外貨が足りません。", en: "§cYou do not hold enough units to sell." },
  forexNoFunds: { ja: "§c1口も購入できるEがありません。", en: "§cYou cannot afford even 1 unit." },

  stockTitle: { ja: "株式市場", en: "Stock Market" },
  stockBody: { ja: (bal) => `残高: ${bal} E\n各企業の株式を売買します。`, en: (bal) => `Balance: ${bal} E\nTrade corporate equities.` },
  stockButtonLine: { ja: (price, hold, pnl) => `Price: ${price} E | 保有:${hold} ${pnl}`, en: (price, hold, pnl) => `Price: ${price} E | Hold:${hold} ${pnl}` },
  stockTradeBody: {
    ja: (desc, price, holds, bought, bal) => `${desc}\n\n株価: ${price} E\n保有数: ${holds} 株` + (holds > 0 ? ` (買値: ${bought}E)` : "") + `\n口座残高: ${bal} E`,
    en: (desc, price, holds, bought, bal) => `${desc}\n\nPrice: ${price} E\nShares: ${holds}` + (holds > 0 ? ` (Avg: ${bought}E)` : "") + `\nBalance: ${bal} E`
  },
  stockBuyBtn: { ja: "買う（数量を指定）", en: "Buy (choose quantity)" },
  stockSellBtn: { ja: "売る（数量を指定）", en: "Sell (choose quantity)" },
  stockBuyModalTitle: { ja: (name) => `${name} を買う`, en: (name) => `Buy ${name}` },
  stockSellModalTitle: { ja: (name) => `${name} を売る`, en: (name) => `Sell ${name}` },
  stockBuyMsg: { ja: (name, qty, cost) => `§a[Stock] ${name} を${qty}株購入 (-${cost}E)`, en: (name, qty, cost) => `§a[Stock] Bought ${qty} shares of ${name}. (-${cost}E)` },
  stockSellMsg: { ja: (name, qty, pnl) => `§a[Stock] ${name} ${qty}株売却 (損益: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)`, en: (name, qty, pnl) => `§a[Stock] Sold ${qty} shares of ${name}. (PnL: ${pnl >= 0 ? "§a+" : "§c"}${pnl}§a E)` },
  stockSellShortage: { ja: "§c売却できる株式がありません。", en: "§cYou do not own this stock." },
  stockNoFunds: { ja: "§c1株も購入できるEがありません。", en: "§cYou cannot afford even 1 share." },

  divBtnReady: { ja: "配当を受け取る\n(本日分・受給可能)", en: "Claim Dividend\n(Available today)" },
  divBtnDoneToday: { ja: "配当 受取済み\n(本日分)", en: "Dividend Claimed\n(Today)" },
  divBtnLocked: { ja: (th) => `配当ロック中\n(評価額 ${th}E 以上で解禁)`, en: (th) => `Dividend Locked\n(Unlocks at ${th}E value)` },
  divNotEligible: { ja: (th, val) => `§c配当には評価額 ${th}E 以上の保有が必要です (現在: ${val}E)`, en: (th, val) => `§cRequires at least ${th}E in stock value (Current: ${val}E)` },
  divAlreadyClaimed: { ja: "§e本日の配当は受け取り済みです。", en: "§eYou already claimed today's dividend." },
  divClaimMsg: { ja: (name) => `§a[配当] ${name} の配当物資を受け取りました！`, en: (name) => `§a[Dividend] Claimed dividend rewards from ${name}!` },
  divClaimCashMsg: { ja: (name, n) => `§a[配当] ${name} から配当金 ${n}E を受け取りました！`, en: (name, n) => `§a[Dividend] Received a ${n}E cash dividend from ${name}!` },

  futuresTitle: { ja: "花の先物契約", en: "Flower Futures" },
  futuresBody: {
    ja: (status) => `【ウィザーローズ指数 約束型先物】\n証拠金5Eで2日後の花相場を予測。\n満期日に上がれば利益、下がれば損失。\n§c※債務不履行はハチの制裁対象！§r\n\n${status}`,
    en: (status) => `[Wither Rose Index Futures]\nMargin: 5E. 2-day maturity prediction.\nProfit if it rises, loss if it falls.\n§c*Defaulting triggers bee swarms!§r\n\n${status}`
  },
  futuresActive: { ja: (strike, due, day) => `契約中: 基準 ${strike}E | 満期: Day ${due} (本日: Day ${day})`, en: (strike, due, day) => `Contract: Strike ${strike}E | Due: Day ${due} (Today: Day ${day})` },
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

  walletTitle: { ja: "コールドウォレット", en: "Cold Wallet" },
  walletBody: {
    ja: (pub, nonce, honeycomb) =>
      `公開鍵: ${pub}\nnonce: ${nonce}\n出力可能ハニカム: ${honeycomb}\n\nハニカムをオフラインの「物語合言葉コード」として出力し、\n掲示板等で他人に譲渡できます。別ワールドでも読み込めます。`,
    en: (pub, nonce, honeycomb) =>
      `Public Key: ${pub}\nNonce: ${nonce}\nAvailable Honeycomb: ${honeycomb}\n\nExport your Honeycomb as an offline 'story code' to trade\nwith others. Can also be imported into different worlds.`
  },
  walletExportBtn: { ja: "出力する（エクスポート）", en: "Export Story Code" },
  walletImportBtn: { ja: "読み込む（インポート）", en: "Import Story Code" },
  walletViewLastBtn: { ja: " 直近のコードを再確認", en: " View Last Issued Code" },
  walletResetBtn: { ja: " シークレットワード再設定", en: " Reset Secret Word" },
  walletExportEmpty: { ja: "§c出力できるハニカムがありません。", en: "§cYou have no Honeycomb to export." },
  walletThemeBody: { ja: "物語コードのテーマを選んでください。", en: "Choose a theme for your story code." },
  walletThemeBee: { ja: " ハチと自然の物語", en: " Bees & Nature Story" },
  walletThemeOre: { ja: " 鉱石と大地の物語", en: " Ores & Earth Story" },
  walletSetupTitle: { ja: "ウォレット作成", en: "Create Wallet" },
  walletSetupLabel: { ja: "シークレットワード（自分だけの合言葉。忘れないように秘密にしてください）", en: "Secret Word (your private phrase — keep it secret and safe)" },
  walletSetupConfirmLabel: { ja: "確認のため、もう一度入力してください", en: "Enter it again to confirm" },
  walletSetupMismatch: { ja: "§c入力が一致しませんでした。", en: "§cThe two entries did not match." },
  walletSetupEmpty: { ja: "§cシークレットワードを入力してください。", en: "§cPlease enter a secret word." },
  walletSetupCollision: { ja: "§cこの合言葉の公開鍵は既に他人が使っています。別の言葉をお試しください。", en: "§cThe public key from that word is already taken. Try another." },
  walletSetupDone: {
    ja: (pub) => `ウォレットを作成しました！\n公開鍵: ${pub}\n\n公開鍵は共有しても安全です。合言葉は絶対に教えないでください。`,
    en: (pub) => `Wallet created!\nPublic Key: ${pub}\n\nYour public key is safe to share. Never reveal your secret word.`
  },
  walletResetTitle: { ja: "シークレットワード再設定", en: "Reset Secret Word" },
  walletAuthTitle: { ja: "取引の署名", en: "Sign Transaction" },
  walletAuthLabel: { ja: "シークレットワードを入力してください", en: "Enter your secret word" },
  walletAuthWrong: { ja: "§cシークレットワードが違います。", en: "§cWrong secret word. Please try again." },

  walletCopyModalTitle: { ja: "取引コード", en: "Transaction Code" },
  walletCopyModalLabel: {
    ja: "▼ この画面をスクリーンショットして相手に送ってください\n※コードを知る人は誰でもハニカムを受け取れます。",
    en: "▼ Screenshot this screen and send it to the recipient\n*Anyone with this code can claim the Honeycomb."
  },
  walletNoLastCode: { ja: "§cまだコードを発行していません。", en: "§cNo codes have been issued yet." },

  walletExportMsg: { ja: (n) => `§a[Wallet] ${n} ハニカムを出金し、取引コードを発行しました。`, en: (n) => `§a[Wallet] Withdrew ${n} Honeycomb and generated a story code.` },
  walletImportTitle: { ja: "物語コード読み込み", en: "Import Story Code" },
  walletImportPhraseLabel: {
    ja: (n) => `${n}文目を貼り付け（単語だけでもOK）`,
    en: (n) => `Sentence ${n} (words only is OK too)`
  },
  walletImportBadPhrase: { ja: "§cコードを正しく認識できませんでした。単語や文章を確認してください。", en: "§cInvalid code. Please check the text." },
  walletImportTampered: { ja: "§cコードが破損しているか、改ざんされています。", en: "§cThis code is corrupted or tampered with." },
  walletImportUsed: { ja: "§eこのコードは既に使用済み（または追い越されたNonce）です。", en: "§eThis code has already been used." },
  walletImportSuccess: { ja: (n) => `§a[Wallet] ${n} ハニカムを受け取りました！`, en: (n) => `§a[Wallet] Received ${n} Honeycomb!` },

  // --- 動物交易(モブトレード) ---
  mobTradeShowoff: {
    ja: (mob, cur) => `${mob}はブロックに${cur}を置いて見せびらかしている…`,
    en: (mob, cur) => `${mob} shows off some ${cur} placed on the block…`
  },
  mobTradeHoldLabel: { ja: (n, cur) => `所持: ${n} ${cur}`, en: (n, cur) => `You have: ${n} ${cur}` },
  mobTradeBuyBtn: { ja: "●今日の取引商品", en: "Today's Goods for Sale" },
  mobTradeSellBtn: { ja: "●今日の買取商品", en: "Today's Buyback Items" },
  mobTradeRateBtn: { ja: "●換金レート", en: "Exchange Rate" },
  mobTradeLeaveBtn: { ja: "●いや今日はやめとくよ", en: "Not today" },

  mobTradeBuyTitle: { ja: "今日の取引商品", en: "Today's Goods for Sale" },
  mobTradeBuyDesc: { ja: "※外貨をつかって買えるもの", en: "*Spend currency to buy these" },
  mobTradeSellTitle: { ja: "今日の買取商品", en: "Today's Buyback Items" },
  mobTradeSellDesc: { ja: "※物を渡すと外貨に変換してもらえる", en: "*Hand over items to convert them into currency" },
  mobTradeYourBalance: { ja: (n, cur) => `現在の所持: ${n} ${cur}`, en: (n, cur) => `Current balance: ${n} ${cur}` },
  mobTradeItemLine: { ja: (price, cur) => `\n${price} ${cur}`, en: (price, cur) => `\n${price} ${cur}` },
  mobTradeSellItemLine: { ja: (price, cur) => `\n+${price} ${cur}`, en: (price, cur) => `\n+${price} ${cur}` },

  mobTradeInsufficientCurrency: { ja: "§c外貨が足りないようだ…", en: "§cNot enough currency…" },
  mobTradeBuySuccessPrefix: { ja: "§a", en: "§aYou received " },
  mobTradeBuySuccessSuffix: { ja: "を受け取った！", en: "!" },
  mobTradeNoItemPrefix: { ja: "§c", en: "§cYou don't seem to have " },
  mobTradeNoItemSuffix: { ja: "を持っていないようだ…", en: "…" },
  mobTradeSellSuccessPrefix: { ja: "§b", en: "§bYou handed over " },
  mobTradeSellSuccessSuffix: { ja: (n, cur) => `を渡して${n} ${cur}を受け取った。`, en: (n, cur) => ` for ${n} ${cur}.` },

  mobTradeRateTitle: { ja: "換金レート", en: "Exchange Rate" },
  mobTradeRateLine: { ja: (cur, rate) => `${cur} = ${rate} エメラルド(E)`, en: (cur, rate) => `${cur} = ${rate} Emerald(s) (E)` },
  mobTradeRefOthers: { ja: "参考用の他の外貨:", en: "For reference, other currencies:" },

  mobTradeLeaveTitle: { ja: "今日はやめとくよ", en: "Not Today" },
  mobTradeLeaveBody: { ja: "立ち去りますか？", en: "Will you leave?" },
  mobTradePetBtn: { ja: "なでる / 手を振る", en: "Pet / Wave" },
  mobTradeShooBtn: { ja: "追い払う動作をする / しっしっ！", en: "Shoo it away / \"Shoo!\"" },
  mobTradePetResult: { ja: (mob) => `${mob}はニコニコしながら帰っていった。`, en: (mob) => `${mob} happily wanders off.` },
  mobTradeShooResult: { ja: (mob) => `${mob}が驚いて少し暴れた…`, en: (mob) => `${mob} panics and lashes out a bit…` },

  traderSummonMsg: { ja: "§a遠くから鈴の音が聞こえ、行商人がやってきた…", en: "§aA bell rings in the distance — a Wandering Trader has arrived…" },

  // --- ゴーレムの宝石取引(現物資産) ---
  golemShowoff: { ja: "ゴーレムがずっしりとした佇まいで、鉱物の輝きを見せている…", en: "The Golem stands heavily, showing off the glint of raw minerals…" },
  golemBalanceLabel: { ja: (n) => `所持エメラルド: ${n} E`, en: (n) => `Emeralds on hand: ${n} E` },
  golemTitle: { ja: "現物資産取引", en: "Physical Asset Exchange" },
  golemHoldLabel: { ja: (n) => `保有量: ${n}`, en: (n) => `Held: ${n}` },
  golemPriceLabel: { ja: (n) => `現在価格: ${n} E / 個`, en: (n) => `Current Price: ${n} E / each` },
  golemBuy1: { ja: "1個 買う", en: "Buy 1" },
  golemBuy5: { ja: "5個 買う", en: "Buy 5" },
  golemBuyMax: { ja: "買えるだけ買う", en: "Buy Max" },
  golemSell1: { ja: "1個 売る", en: "Sell 1" },
  golemSell5: { ja: "5個 売る", en: "Sell 5" },
  golemSellAll: { ja: "全て売る", en: "Sell All" },
  golemBuySuccess: { ja: (n, item, cost) => `§a${item}を${n}個購入した(-${cost} E)`, en: (n, item, cost) => `§aBought ${n}x ${item} (-${cost} E)` },
  golemSellSuccess: { ja: (n, item, gain) => `§b${item}を${n}個売却した(+${gain} E)`, en: (n, item, gain) => `§bSold ${n}x ${item} (+${gain} E)` },
  golemNothingToTrade: { ja: "§c取引できる数がありません。", en: "§cNothing to trade." },
  golemInsufficientFunds: { ja: "§cエメラルドが足りません。", en: "§cNot enough Emeralds." },
  golemInsufficientItems: { ja: "§c保有数が足りません。", en: "§cYou don't hold enough." },

  // --- 郵便販売カタログ(カテゴリ制) / Mail Order Catalog (categorized) ---
  mailBrowseCategoriesBtn: { ja: "カタログを見る（カテゴリ別）", en: "Browse Catalog (by Category)" },
  mailBargainBtn: { ja: " 本日のお買い得コーナー（レア5点・20%引）", en: " Today's Bargain Corner (5 Rare Items, 20% Off)" },
  mailPrimeBtn: {
    ja: (active) => active ? " プライムスタンダード管理（加入中）" : " プライムスタンダードに加入（送料無料）",
    en: (active) => active ? " Manage Prime Standard (Active)" : " Join Prime Standard (Free Shipping)"
  },
  mailCategoryListTitle: { ja: "カタログ・カテゴリ", en: "Catalog Categories" },
  mailCategoryListBody: { ja: (bal) => `所持: ${bal}E\nカテゴリを選んでください。`, en: (bal) => `Balance: ${bal}E\nChoose a category.` },
  mailShippingLabel: { ja: (fee) => (fee > 0 ? `\n送料: ${fee}E` : `\n送料: §a無料(プライム)§r`), en: (fee) => (fee > 0 ? `\nShipping: ${fee}E` : `\nShipping: §aFree (Prime)§r`) },
  mailCatalogBody: { ja: (bal, fee) => `所持: ${bal}E${fee > 0 ? `\n注文ごとに送料${fee}Eがかかります。` : `\n§aプライムスタンダード加入中: 送料無料§r`}`, en: (bal, fee) => `Balance: ${bal}E${fee > 0 ? `\nEach order has a ${fee}E shipping fee.` : `\n§aPrime Standard active: free shipping§r`}` },
  mailBargainTitle: { ja: "本日のお買い得コーナー", en: "Today's Bargain Corner" },
  mailBargainBody: {
    ja: (bal) => `所持: ${bal}E\n地平線の彼方からの特選レア品。20%引き・毎日入れ替わります。`,
    en: (bal) => `Balance: ${bal}E\nSpecially selected rare goods, 20% off. Rotates daily.`
  },
  mailBargainButtonLine: { ja: (price, orig) => `${price}E §0(通常 ${orig}E)§r`, en: (price, orig) => `${price}E §0(Regular ${orig}E)§r` },
  mailPurchaseMsg: { ja: (name, cash, card, ship) => `§a${name}を購入しました。(現金${cash}E + カード${card}E${ship > 0 ? ` / 送料${ship}E込み` : " / 送料無料"})`, en: (name, cash, card, ship) => `§aPurchased ${name}. (Cash ${cash}E + Card ${card}E${ship > 0 ? `, incl. ${ship}E shipping` : ", free shipping"})` },

  mailPrimeTitle: { ja: "プライム会員管理", en: "Prime Membership" },
  mailPrimeBody: {
    ja: (fee, sknValue, threshold, premiumActive, premiumEligible) =>
      `【プライムスタンダード】(郵便販売)\n週額${fee}E自動引き落とし・送料無料。\n\n【スケインプライムプレミアム】(株式連動)\nSKN評価額 ${sknValue}E / 必要額 ${threshold}E\n加入中: ${premiumActive ? "はい" : "いいえ"}${premiumEligible ? "" : "\n§c※評価額が不足しています§r"}\n加入すると配達時にオウムが同伴し、たまに芸を披露します。`,
    en: (fee, sknValue, threshold, premiumActive, premiumEligible) =>
      `[Prime Standard] (Mail Order)\nAuto-billed ${fee}E/week. Free shipping.\n\n[Skein Prime Premium] (Stock-linked)\nSKN value: ${sknValue}E / Required: ${threshold}E\nActive: ${premiumActive ? "Yes" : "No"}${premiumEligible ? "" : "\n§cInsufficient stock value§r"}\nParrots escort your deliveries and may perform a trick.`
  },
  mailPrimeStandardSubBtn: { ja: "プライムスタンダードに加入する", en: "Subscribe to Prime Standard" },
  mailPrimeStandardUnsubBtn: { ja: "プライムスタンダードを解約する", en: "Cancel Prime Standard" },
  mailPrimePremiumSubBtn: { ja: "プライムプレミアムに加入する", en: "Activate Prime Premium" },
  mailPrimePremiumUnsubBtn: { ja: "プライムプレミアムを解約する", en: "Deactivate Prime Premium" },
  mailPrimeStandardSubMsg: { ja: "§aプライムスタンダードに加入しました。次回から送料無料です。", en: "§aSubscribed to Prime Standard. Shipping is now free." },
  mailPrimeStandardUnsubMsg: { ja: "§eプライムスタンダードを解約しました。", en: "§eCanceled Prime Standard." },
  mailPrimePremiumSubMsg: { ja: "§aプライムプレミアムに加入しました！配達にオウムが同伴します。", en: "§aActivated Prime Premium! Parrots will now escort your deliveries." },
  mailPrimePremiumUnsubMsg: { ja: "§eプライムプレミアムを解約しました。", en: "§eDeactivated Prime Premium." },
  mailPrimePremiumNotEligible: { ja: "§cSKN株の評価額が必要額に届いていません。", en: "§cYour SKN stock value doesn't meet the requirement." },
  primeStandardBilled: { ja: (n) => `§b[Skein] プライムスタンダード会費 ${n}E を引き落としました。`, en: (n) => `§b[Skein] Billed ${n}E for Prime Standard.` },
  primeStandardCanceled: { ja: "§e[Skein] 残高不足のためプライムスタンダードを自動解約しました。", en: "§e[Skein] Insufficient balance — Prime Standard was auto-canceled." },
  primeParrotArrive: { ja: "§a遠くから羽ばたきの音…配達のオウムが荷物と一緒に舞い降りた！", en: "§aA flutter of wings — a delivery parrot swoops down with your package!" },
  primeParrotTrick: { ja: "§a配達のオウムが舞い降り、ちょっとした芸を披露してくれた！", en: "§aThe delivery parrot swoops down and performs a little trick for you!" }
};
