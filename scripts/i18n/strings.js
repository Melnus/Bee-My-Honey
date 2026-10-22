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
  btnStock: {
    ja: (count) => `株式市場\n(${count}銘柄)`,
    en: (count) => `Stock Market\n(${count} Tickers)`
  },
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
  bankLoanDeskBtn: { ja: "ローン窓口", en: "Loan Desk" },
  // ------------------------------------------
  // 入出金履歴 — strings.js の bankLoanDeskBtn の直後に貼る
  // ------------------------------------------
  bankHistoryBtn: { ja: "入出金履歴", en: "Account History" },
  historyTitle: { ja: "入出金履歴", en: "Account History" },
  historyEmpty: { ja: "まだ履歴がありません。", en: "No history yet." },
  historyLine: {
    ja: (isIn, amount, day, text) => `${isIn ? "§a+" : "§c-"}${amount}E§r ${day}日目 ${text}`,
    en: (isIn, amount, day, text) => `${isIn ? "§a+" : "§c-"}${amount}E§r Day ${day} ${text}`
  },
  historyFrom: { ja: (name) => `(${name}から)`, en: (name) => ` (from ${name})` },
  historyTo: { ja: (name) => `(${name}へ)`, en: (name) => ` (to ${name})` },
  historyFlowUnknown: { ja: "その他", en: "Other" },
  historyFlow: {
    quest_wage: { ja: "クエスト報酬", en: "Quest reward" },
    dispatch_margin: { ja: "派遣マージン", en: "Dispatch margin" },
    hire_bonus: { ja: "雇用ボーナス", en: "Hiring bonus" },
    bank_interest: { ja: "預金利息", en: "Deposit interest" },
    dividend: { ja: "配当", en: "Dividend" },
    loan_disbursed: { ja: "ローン借入", en: "Loan disbursed" },
    loan_repaid: { ja: "ローン返済", en: "Loan repayment" },
    lend_out: { ja: "融資(貸出)", en: "Lending out" },
    lend_return: { ja: "融資の回収", en: "Lending returned" },
    card_payment: { ja: "カード返済", en: "Card payment" },
    commodity_buy: { ja: "現物の購入", en: "Commodity buy" },
    commodity_sell: { ja: "現物の売却", en: "Commodity sell" },
    bulk_buy: { ja: "まとめ買い", en: "Bulk buy" },
    bulk_sell: { ja: "まとめ売り", en: "Bulk sell" },
    forex_buy: { ja: "外貨の購入", en: "Forex buy" },
    forex_sell: { ja: "外貨の売却", en: "Forex sell" },
    stock_buy: { ja: "株の購入", en: "Stock buy" },
    stock_sell: { ja: "株の売却", en: "Stock sell" },
    futures_margin: { ja: "先物の証拠金", en: "Futures margin" },
    futures_settle: { ja: "先物の決済", en: "Futures settlement" },
    mail_order: { ja: "郵便販売", en: "Mail order" },
    prime_fee: { ja: "プライム会費", en: "Prime fee" },
    insurance: { ja: "保険料", en: "Insurance" },
    labor_compensation: { ja: "事故補償", en: "Accident compensation" },
    labor_penalty: { ja: "違約金", en: "Penalty" },
    deposit: { ja: "預け入れ", en: "Deposit" },
    withdraw: { ja: "引き出し", en: "Withdrawal" }
  },
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
  // 数量の入力欄(統一の数量入力。旧: ±10/50/100の段階ボタン)
  // 既存ワールドの金額換算(migration.js)
  migrationDone: {
    ja: (factor) => `§e[経済更新] 価格の基準が変わったため、あなたの口座・借入・カード・先物などの金額を ×${factor} に換算しました(労働日数に換算した資産の大きさは変わりません)。`,
    en: (factor) => `§e[Economy update] Prices were re-based, so your balance, loans, card and futures amounts were converted by x${factor} (your wealth measured in days of labor is unchanged).`
  },
  qtyFieldLabel: { ja: (max) => `数量(半角の数字・最大 ${max})`, en: (max) => `Quantity (digits only, max ${max})` },
  qtyFieldHint: { ja: "例: 250", en: "e.g. 250" },
  qtyAllToggle: { ja: (max) => `全額(最大 ${max} をすべて)`, en: (max) => `All (the maximum, ${max})` },
  qtyInvalid: { ja: (max) => `§c数量は 1〜${max} の整数で入力してください。`, en: (max) => `§cEnter a whole number from 1 to ${max}.` },
  qtyEnter: { ja: "数量を入力し直す", en: "Change quantity" },
  qtyAll: { ja: "全額(最大)にする", en: "Use maximum" },
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
  futuresIntroBody: {
    ja: (margin, days, bal) => `【花の先物契約】\n銘柄ごとに証拠金${margin}Eで${days}日後の相場を予測。銘柄あたり1建玉まで。\n所持: ${bal}E\n§c※決済で口座がマイナスになると債務不履行扱い！§r`,
    en: (margin, days, bal) => `[Flower Futures]\nMargin ${margin}E per contract, ${days}-day maturity. One position per instrument.\nBalance: ${bal}E\n§c*A negative balance on settlement triggers default!§r`
  },
  futuresPosLabelHeld: { ja: (qty) => `建玉 ${qty}枚`, en: (qty) => `Position: ${qty}` },
  futuresPosLabelNone: { ja: "建玉なし", en: "No position" },
  futuresNoPositionLine: { ja: "現在、建玉はありません。", en: "No open position." },
  futuresPositionLine: {
    ja: (qty, strike, dueDay, readyNote) => `建玉 ${qty}枚 / 建値 ${strike}E / 満期 ${dueDay}日目${readyNote}`,
    en: (qty, strike, dueDay, readyNote) => `${qty} contracts @ ${strike}E, due day ${dueDay}${readyNote}`
  },
  futuresReadyNote: { ja: "（決済可）", en: " (ready)" },
  futuresNotReadyNote: { ja: "（未到来）", en: "" },
  futuresCurrentPriceLabel: { ja: "現在値", en: "Current" },
  futuresBtnSettle: { ja: "決済する", en: "Settle" },
  futuresBtnOpenContract: { ja: "契約する", en: "Open Contract" },
  futuresNotMaturedMsg: { ja: "まだ満期日ではありません。", en: "Contract has not matured yet." },
  futuresBuyModalBody: {
    ja: (qty, cost, bal, days, mult) => `契約数量: ${qty}枚\n必要証拠金: ${cost}E (所持 ${bal}E)\n満期まで${days}日、決済倍率×${mult}`,
    en: (qty, cost, bal, days, mult) => `Quantity: ${qty}\nMargin required: ${cost}E (have ${bal}E)\nMatures in ${days} days, x${mult} on settlement`
  },
  futuresBtnConfirm: { ja: "契約を確定", en: "Confirm" },
  futuresOpenMsg: { ja: (strike, day) => `§a[Futures] 先物契約成立 (基準:${strike}E)。Day ${day} に戻ってきてください。`, en: (strike, day) => `§a[Futures] Contract opened! (Strike:${strike}E) Return on Day ${day}.` },
  futuresMarginShortage: { ja: "§c証拠金5Eが足りません。", en: "§cNeed 5 Emeralds in account balance." },
  futuresBody: {
    ja: (status) => `【ウィザーローズ指数 約束型先物】\n証拠金5Eで2日後の花相場を予測。\n満期日に上がれば利益、下がれば損失。\n§c※債務不履行はハチの制裁対象！§r\n\n${status}`,
    en: (status) => `[Wither Rose Index Futures]\nMargin: 5E. 2-day maturity prediction.\nProfit if it rises, loss if it falls.\n§c*Defaulting triggers bee swarms!§r\n\n${status}`
  },
  futuresActive: { ja: (strike, due, day) => `契約中: 基準 ${strike}E | 満期: Day ${due} (本日: Day ${day})`, en: (strike, due, day) => `Contract: Strike ${strike}E | Due: Day ${due} (Today: Day ${day})` },
  futuresNone: { ja: "現在契約はありません。", en: "No active contracts." },
  futuresSettle: { ja: "契約を満期精算する", en: "Settle Contract" },
  futuresOpen: { ja: "契約を結ぶ (5E)", en: "Open Long Contract (5E)" },
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
  // v0.3.4 #3: Paws & Blackpots(APL窓口=干し草の俵から入る猫の店)
  mobTradePbBtn: { ja: "●Paws & Blackpots(猫の店)", en: "Paws & Blackpots (Cat's Shop)" },
  pbTitle: { ja: "Paws & Blackpots", en: "Paws & Blackpots" },
  pbBody: {
    ja: (bal, cur, moodLabel, pct) => `ネコの店主が気まぐれに値札をつけている…\n所持: ${bal} ${cur}\nネコの機嫌: ${moodLabel}(値引き ${pct}%)`,
    en: (bal, cur, moodLabel, pct) => `The cat shopkeeper prices things on a whim…\nYou have: ${bal} ${cur}\nCat's mood: ${moodLabel} (${pct}% off)`
  },
  pbMoodLabels: {
    ja: ["そっぽを向いている", "ふつう", "ちょっとご機嫌", "ご機嫌", "とてもご機嫌", "ごろごろ絶好調"],
    en: ["Looking away", "Neutral", "Slightly pleased", "Pleased", "Very pleased", "Purring loudly"]
  },
  pbItemLine: { ja: (price, cur, stock) => `\n${price} ${cur} ・在庫 ${stock}`, en: (price, cur, stock) => `\n${price} ${cur} · Stock ${stock}` },
  pbItemSoldOutLine: { ja: "\n§c売り切れ", en: "\n§cSold out" },
  pbItemLicenseLine: { ja: (price, cur) => `\n${price} ${cur} ・§e要ネザーライセンス`, en: (price, cur) => `\n${price} ${cur} · §eNether license required` },
  pbSellBtn: { ja: "納品する(買い取ってもらう)", en: "Deliver Goods (Sell to Shop)" },
  pbPetBtn: { ja: "ネコを撫でる", en: "Pet the Cat" },
  pbGiftBtn: { ja: "魚をあげる", en: "Give the Cat a Fish" },
  pbSellTitle: { ja: "納品(買取)", en: "Deliver Goods" },
  pbSellDesc: { ja: "※実物を1個ずつ買い取ってもらえる", en: "*The shop buys items one at a time" },
  pbLicenseRequired: { ja: "§cこれはネザーライセンスがないと売ってもらえないようだ…", en: "§cYou need a Nether license to buy this…" },
  pbSoldOut: { ja: "§c売り切れのようだ…", en: "§cSold out…" },
  pbPetDone: { ja: (label) => `§aネコは目を細めて喉を鳴らした…(機嫌: ${label})`, en: (label) => `§aThe cat purrs with narrowed eyes… (Mood: ${label})` },
  pbPetAlready: { ja: "§7今日はもう撫でさせてもらった。", en: "§7You already petted the cat today." },
  pbGiftDone: { ja: (label) => `§aネコは魚をぺろりと平らげた！(機嫌: ${label})`, en: (label) => `§aThe cat gobbles up the fish! (Mood: ${label})` },
  pbNoFish: { ja: "§cあげられる魚(タラ/サケ)を持っていない。", en: "§cYou have no fish (cod/salmon) to give." },
  pbMoodMax: { ja: "§7ネコはもう十分ご機嫌だ。", en: "§7The cat is already in top spirits." },

  // v0.3.4 #3: 生鮮市場(GLB窓口=苔ブロックから入るオーダーボード)
  mobTradeFmBtn: { ja: "●生鮮市場", en: "Fresh Market" },
  fmTitle: { ja: "生鮮市場", en: "Fresh Market" },
  fmBody: {
    ja: (bal, cur) => `ウーパールーパーが市場の水槽から顔を出している…\n所持: ${bal} ${cur}\n※実在庫制。誰かが納品しないと品物は並ばない。`,
    en: (bal, cur) => `The axolotl peeks out of the market tank…\nYou have: ${bal} ${cur}\n*Real stock only: goods appear only when someone delivers them.`
  },
  fmGenreLine: { ja: (n) => `\n出品 ${n}件`, en: (n) => `\n${n} listing(s)` },
  fmGenreBody: {
    ja: (genre, bal, cur) => `${genre}\n所持: ${bal} ${cur}`,
    en: (genre, bal, cur) => `${genre}\nYou have: ${bal} ${cur}`
  },
  fmItemLine: { ja: (price, cur, n) => `\n最安 ${price} ${cur} ・出品 ${n}件`, en: (price, cur, n) => `\nFrom ${price} ${cur} · ${n} listing(s)` },
  fmItemNoneLine: { ja: "\n§7出品なし", en: "\n§7No listings" },
  fmDeliverBtn: { ja: "納品する(満載のシュルカー)", en: "Deliver (full shulker)" },
  fmChartHeader: { ja: "価格推移(直近の約定)", en: "Price history (recent trades)" },
  fmChartNone: { ja: "§7(まだ約定履歴がありません)", en: "§7(No trades yet)" },
  fmChartLatest: { ja: (p, cur) => `直近 ${p} ${cur}/個`, en: (p, cur) => `Latest ${p} ${cur}/each` },
  fmNoOrders: { ja: "§7出品はまだありません。", en: "§7No listings yet." },
  fmOrderLine: { ja: (no, price, cur, qty) => `#${no}  ${price} ${cur} × ${qty}個`, en: (no, price, cur, qty) => `#${no}  ${price} ${cur} x ${qty}` },
  fmOrderMeta: { ja: (fresh, region) => `\n${fresh} ・産地: ${region}`, en: (fresh, region) => `\n${fresh} · Origin: ${region}` },
  fmFreshLabel: { ja: (pct) => `鮮度 ${pct}%`, en: (pct) => `Freshness ${pct}%` },
  fmFreshNone: { ja: "鮮度なし", en: "No spoilage" },
  fmOwnMark: { ja: " §e(あなたの出品)", en: " §e(yours)" },
  fmBuyQtyBody: {
    ja: (no, price, cur, stock, bal) => `出品 #${no}\n単価: ${price} ${cur} ・残り ${stock}個\n所持: ${bal} ${cur}`,
    en: (no, price, cur, stock, bal) => `Listing #${no}\nPrice: ${price} ${cur} · ${stock} left\nYou have: ${bal} ${cur}`
  },
  fmBuyQtyBtn: { ja: (q, total, cur) => `${q}個(${total} ${cur})`, en: (q, total, cur) => `${q} (${total} ${cur})` },
  fmBuyOwn: { ja: "§7自分の出品は買えません。", en: "§7You can't buy your own listing." },
  fmBuyInsufficient: { ja: "§cGLBが足りません。", en: "§cNot enough GLB." },
  fmBuyGone: { ja: "§c出品が見つかりません(売り切れ・鮮度切れの可能性)。", en: "§cListing not found (sold out or spoiled)." },
  fmBuyLack: { ja: (n) => `§c残りが${n}個しかありません。`, en: (n) => `§cOnly ${n} left.` },
  fmBuyDoneSuffix: { ja: (qty, total, cur) => `を${qty}個購入した(-${total} ${cur})`, en: (qty, total, cur) => ` x${qty} (-${total} ${cur})` },
  fmEarnings: { ja: (n, cur) => `§a出品した商品が売れて${n} ${cur}を受け取った。`, en: (n, cur) => `§aYour listings sold: received ${n} ${cur}.` },
  fmDeliverNone: {
    ja: "§c近くに納品できるシュルカーがありません(全27スロットが最大スタックで埋まり、同じジャンルの品だけ入っていること)。",
    en: "§cNo deliverable shulker nearby (all 27 slots full stacks, one genre only)."
  },
  fmDeliverHeader: {
    ja: (genre, region) => `${genre}の満載シュルカーを納品します。\n産地: ${region}(価格の目安に反映されます)\n最終価格はあなたが決められます。\n\n`,
    en: (genre, region) => `Delivering a full ${genre} shulker.\nOrigin: ${region} (reflected in the price guide)\nYou set the final price.\n\n`
  },
  fmDeliverKindSuffix: { ja: (count, lo, hi, cur) => ` ×${count}\n  目安 ${lo}〜${hi} ${cur}/個\n`, en: (count, lo, hi, cur) => ` x${count}\n  Guide ${lo}-${hi} ${cur}/each\n` },
  fmDeliverInputBtn: { ja: "価格を入力して納品する", en: "Set prices and deliver" },
  fmDeliverPriceLabel: { ja: (lo, hi, cur) => ` (目安 ${lo}〜${hi} ${cur}/個)`, en: (lo, hi, cur) => ` (guide ${lo}-${hi} ${cur}/each)` },
  fmDeliverDone: { ja: (n) => `§a${n}品目を出品しました。売れると自動で口座に入金されます。`, en: (n) => `§aListed ${n} item type(s). Earnings are deposited automatically when sold.` },
  fmDeliverBoardFull: { ja: "§c掲示板が一杯です。出品が捌けてからもう一度どうぞ。", en: "§cThe board is full. Try again after some listings sell." },

  // 食品の鮮度(在庫側巡回)
  futuresPriceLine: { ja: (price) => `${price}E/枚`, en: (price) => `${price}E/share` },
  freshnessRotted: { ja: (n) => `§c食べ物が腐ってしまった…(${n}個)`, en: (n) => `§cSome food rotted (${n})` },
  freshnessLoreLine: { ja: (pct) => `§7鮮度: ${pct}%`, en: (pct) => `§7Freshness: ${pct}%` },
  freshnessLoreWarn: { ja: "§c変な匂いがする…もうしまわないと…", en: "§cIt smells off... better put it away." },
  freshnessDebugAged: { ja: (n) => `§7[鮮度] 手持ちの食品を${n}日分進めました。`, en: (n) => `§7[Freshness] Advanced held food by ${n} day(s).` },
  freshnessDebugLine: { ja: (id, n, age, life) => `§7[鮮度] ${id} ×${n}: ${age} / ${life} 日`, en: (id, n, age, life) => `§7[Freshness] ${id} x${n}: ${age} / ${life} days` },
  freshnessDebugStampFail: { ja: (e) => `§c[鮮度] スタンプを書き込めませんでした: ${e}`, en: (e) => `§c[Freshness] Could not write the stamp: ${e}` },
  freshnessDebugNone: { ja: "§7[鮮度] 手持ちに対象の食品がありません。", en: "§7[Freshness] No perishable food in your inventory." },
  mobTradeLeaveBtn: { ja: "●いや今日はやめとくよ", en: "Not today" },

  mobTradeBuyTitle: { ja: "今日の取引商品", en: "Today's Goods for Sale" },
  mobTradeBuyDesc: { ja: "※外貨をつかって買えるもの", en: "*Spend currency to buy these" },
  mobTradeSellTitle: { ja: "今日の買取商品", en: "Today's Buyback Items" },
  mobTradeSellDesc: { ja: "※物を渡すと外貨に変換してもらえる", en: "*Hand over items to convert them into currency" },
  mobTradeYourBalance: { ja: (n, cur) => `現在の所持: ${n} ${cur}`, en: (n, cur) => `Current balance: ${n} ${cur}` },
  mobTradeItemLine: { ja: (price, cur) => `\n${price} ${cur}`, en: (price, cur) => `\n${price} ${cur}` },
  mobTradeSellItemLine: { ja: (price, cur) => `\n+${price} ${cur}`, en: (price, cur) => `\n+${price} ${cur}` },
  // 1口が複数個の品(統一プライシングのロット)の個数表示。品名の直後に付ける。lot=1の時は呼び出し側で空にする
  mobTradeLotSuffix: { ja: (n) => ` ×${n}`, en: (n) => ` x${n}` },

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
  golemBuyRawtextPrefix: { ja: () => "§a", en: (qty) => `§aBought ${qty}x ` },
  golemBuyRawtextSuffix: { ja: (qty, cost) => `を${qty}個購入した(-${cost} E)`, en: (qty, cost) => ` (-${cost} E)` },
  golemSellRawtextPrefix: { ja: () => "§b", en: (qty) => `§bSold ${qty}x ` },
  golemSellRawtextSuffix: { ja: (qty, gain) => `を${qty}個売却した(+${gain} E)`, en: (qty, gain) => ` (+${gain} E)` },
  // v0.3.4 #1: 現物取引のカテゴリ分岐(希少資源/一般資源)・一般資源のシュルカー単位バルク取引
  golemCategoryBody: { ja: "取り扱う資産の種類を選んでください。", en: "Choose an asset category." },
  golemCategoryRare: { ja: "希少資源", en: "Rare Resources" },
  golemCategoryGeneral: { ja: "一般資源", en: "General Resources" },
  golemBulkPriceLabel: { ja: (n) => `シュルカー1箱(1,728個)あたり: ${n} E`, en: (n) => `Per shulker (1,728): ${n} E` },
  golemBulkBuyButton: { ja: "空のシュルカーに買う", en: "Buy into an empty shulker" },
  golemBulkSellButton: { ja: "満載のシュルカーを売る", en: "Sell a full shulker" },
  golemBulkNoEmptyShulker: { ja: "§c近くに空のシュルカーボックスがありません。", en: "§cNo empty shulker box nearby." },
  golemBulkNoMatchingFullShulker: { ja: "§c近くにこの資源で満載のシュルカーボックスがありません。", en: "§cNo matching full shulker box nearby." },
  golemBulkInsufficientFunds: { ja: "§cエメラルドが足りません。", en: "§cNot enough Emeralds." },
  golemBulkBuySuccess: { ja: (item, cost) => `§a${item}を1シュルカー分(1,728個)購入した(-${cost} E)`, en: (item, cost) => `§aBought 1 shulker (1,728x) of ${item} (-${cost} E)` },
  golemBulkSellSuccess: { ja: (item, gain) => `§b${item}を1シュルカー分(1,728個)売却した(+${gain} E)`, en: (item, gain) => `§bSold 1 shulker (1,728x) of ${item} (+${gain} E)` },

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
  primeParrotTrick: { ja: "§a配達のオウムが舞い降り、ちょっとした芸を披露してくれた！", en: "§aThe delivery parrot swoops down and performs a little trick for you!" },

  // ------------------------------------------
  // 郵便販売 (Skein) 追加分
  // ------------------------------------------
  mailMenuTitle: { ja: "郵便販売 (Skein)", en: "Mail Order (Skein)" },
  mailMenuBody: {
    ja: (bal, creditText, overdue) => `地平線の彼方から、あなたのチェストまで。§o- Skein -§r\n所持: ${bal}E\nカード利用可能額: ${creditText}\nカード延滞: ${overdue ? "あり" : "なし"}`,
    en: (bal, creditText, overdue) => `From beyond the horizon, to your chest. §o- Skein -§r\nBalance: ${bal}E\nAvailable credit: ${creditText}\nCard overdue: ${overdue ? "Yes" : "No"}`
  },
  mailCreditAvailable: { ja: (amount) => `${amount}E`, en: (amount) => `${amount}E` },
  mailCreditNone: { ja: "未発行", en: "No card" },
  mailBtnManageCard: { ja: "カード管理", en: "Manage Card" },
  mailCatalogTitle: { ja: "カタログ", en: "Catalog" },
  mailCardSuspendedMsg: { ja: "§cカードが利用停止中です。", en: "§cYour card is suspended." },
  mailNoCardMsg: { ja: "§c現金が足りず、カードも未発行です。", en: "§cNot enough cash, and no card on file." },
  mailCreditLimitMsg: { ja: "§c利用限度額を超えています。", en: "§cExceeds your credit limit." },
  mailPurchaseFailedMsg: { ja: "§c購入できませんでした。", en: "§cCould not purchase." },
  mailCardApplyTitle: { ja: "カード発行", en: "Card Application" },
  mailCardApplyBody: {
    ja: "後払いクレジットカードに申し込みますか？限度額は信用スコアで決まります。",
    en: "Apply for a credit card? Limit is based on your credit score."
  },
  mailCardApplyBtn: { ja: "申し込む", en: "Apply" },
  mailCardDeniedMsg: {
    ja: (score) => `§c審査に通りませんでした(信用スコア${score})。`,
    en: (score) => `§cApplication denied (score ${score}).`
  },
  mailCardIssuedMsg: {
    ja: (limit, minPayment) => `§aカードが発行されました。限度額${limit}E / 最低返済額${minPayment}E(固定)`,
    en: (limit, minPayment) => `§aCard issued. Limit ${limit}E / Fixed min payment ${minPayment}E`
  },
  mailCardManagementTitle: { ja: "カード管理", en: "Card Management" },
  mailCardManagementBody: {
    ja: (limit, balance, minPayment, overdue) => `利用限度額: ${limit}E\n利用残高: ${balance}E\n最低返済額(固定): ${minPayment}E\n延滞: ${overdue ? "あり" : "なし"}`,
    en: (limit, balance, minPayment, overdue) => `Limit: ${limit}E\nBalance: ${balance}E\nFixed min payment: ${minPayment}E\nOverdue: ${overdue ? "Yes" : "No"}`
  },
  mailBtnPayFull: { ja: "一括返済する", en: "Pay Full Balance" },
  mailBtnTalkToTurtle: { ja: "カメさんに相談する(債務整理)", en: "Talk to the Turtle (Debt Relief)" },
  mailPaidFullMsg: { ja: (paid) => `§a${paid}Eを一括返済しました。`, en: (paid) => `§aPaid off ${paid}E.` },
  mailNoBalanceOrCashMsg: {
    ja: "§c返済する残高がないか、現金が不足しています。",
    en: "§cNo balance to pay, or insufficient cash."
  },
  mailNoDebtMsg: { ja: "現在、整理すべき債務はありません。", en: "You have no debt to relieve." },
  mailTurtleDeskTitle: { ja: "カメさんの相談窓口", en: "The Turtle's Advisory Desk" },
  mailTurtleDeskBody: {
    ja: (balance) => `現在の残高: ${balance}E\n\n【組み直し】最低返済額を下げ、延滞を解消。利息は継続。信用情報が軽く悪化。\n\n【債務整理】残債を半額に。カードは一定期間停止し、信用情報が大きく悪化。`,
    en: (balance) => `Current balance: ${balance}E\n\n[Restructure] Lower min payment, clear overdue. Interest continues. Minor credit hit.\n\n[Settle] Reduce balance by half. Card suspended. Major credit hit.`
  },
  mailBtnRestructure: { ja: "返済計画を組み直す", en: "Restructure Plan" },
  mailBtnSettleDebt: { ja: "債務整理する", en: "Settle Debt" },
  mailRestructuredMsg: {
    ja: (newMin) => `§a最低返済額を${newMin}Eに変更しました。`,
    en: (newMin) => `§aMin payment lowered to ${newMin}E.`
  },
  mailSettledMsg: {
    ja: (reduced) => `§e残債を${reduced}Eに減額しました。カードは利用停止になります。`,
    en: (reduced) => `§eBalance reduced to ${reduced}E. Card is now suspended.`
  },

  // ------------------------------------------
  // ローン窓口(借入・融資)
  // ------------------------------------------
  loanDeskTitle: { ja: "ローン窓口", en: "Loan Desk" },
  loanDeskBody: {
    ja: (statusLabel, balance, count, overdue) => `信用状態: ${statusLabel}\n借入残高: ${balance}E / 契約件数: ${count}件\n延滞: ${overdue ? "あり" : "なし"}`,
    en: (statusLabel, balance, count, overdue) => `Credit: ${statusLabel}\nLoan Balance: ${balance}E / Contracts: ${count}\nOverdue: ${overdue ? "Yes" : "No"}`
  },
  loanBtnBorrow: { ja: "借りる", en: "Borrow" },
  loanBtnLend: { ja: "貸す", en: "Lend" },
  loanBorrowPlanTitle: { ja: "借入プラン選択", en: "Choose a Loan Plan" },
  loanAlreadyBorrowing: { ja: "§c既に返済中のローンがあります。", en: "§cYou already have an active loan." },
  loanBorrowPlanBody: {
    ja: "難易度が高いほど必要な信用スコアと金利が上がります。\n",
    en: "Higher difficulty needs higher credit score and interest.\n"
  },
  loanTierBtn: {
    ja: (amount, difficulty) => `${amount}E (難易度${difficulty})`,
    en: (amount, difficulty) => `${amount}E (Difficulty ${difficulty})`
  },
  loanDeniedScoreLow: {
    ja: (score, need) => `§c審査に落ちました(信用スコア${score} / 必要${need})`,
    en: (score, need) => `§cApplication denied (score ${score} / needs ${need})`
  },
  loanDeniedAlreadyActive: { ja: "§c既にローンを利用中です。", en: "§cYou already have an active loan." },
  loanApprovedMsg: {
    ja: (amount, weeklyPayment, weeks) => `§a審査通過！${amount}Eを借り入れました。週${weeklyPayment}E×${weeks}週で返済してください。`,
    en: (amount, weeklyPayment, weeks) => `§aApproved! Borrowed ${amount}E. Repay ${weeklyPayment}E/week for ${weeks} weeks.`
  },
  loanAlreadyLending: {
    ja: "§c既に貸し付け中です。完済または回収されるまでお待ちください。",
    en: "§cYou already have an active loan out."
  },
  loanBorrowerListTitle: { ja: "融資希望者一覧", en: "Borrower Candidates" },
  loanBalanceBody: { ja: (bal) => `所持: ${bal}E`, en: (bal) => `Balance: ${bal}E` },
  loanCandidateLine: {
    ja: (name, amount, weeks, ratePct, repayPct) => `${name} - 希望額${amount}E / ${weeks}週 / 金利${ratePct}% / 返済見込${repayPct}%`,
    en: (name, amount, weeks, ratePct, repayPct) => `${name} - ${amount}E / ${weeks}w / ${ratePct}% / ${repayPct}% likely`
  },
  loanInsufficientFunds: { ja: "§c資金が足りません。", en: "§cInsufficient funds." },
  // ------------------------------------------
  // 融資管理(繰上返済) — strings.js の loanLentMsg の直後に貼る
  // ------------------------------------------
  // ---- 個人間の送金 ----
  bankSendBtn: { ja: "送金する", en: "Send Money" },
  transferPickTitle: { ja: "送金先を選ぶ", en: "Choose a Recipient" },
  transferPickBody: {
    ja: (bal, feePct, remaining) => `所持: ${bal}E\nいまオンラインのプレイヤーに送れます。手数料 ${feePct}%(送り主が上乗せで払う)\n今日あと送れる額: ${remaining}E`,
    en: (bal, feePct, remaining) => `Balance: ${bal}E\nSend to players who are online now. Fee ${feePct}% (paid by the sender on top)\nLeft to send today: ${remaining}E`
  },
  transferNoPlayers: { ja: "§c送れる相手がいません(オンラインのほかのプレイヤーがいません)。", en: "§cNo one to send to (no other players online)." },
  transferModalTitle: { ja: (name) => `${name}へ送金`, en: (name) => `Send to ${name}` },
  transferConfirmBody: {
    ja: (name, qty, fee, bal) => `${name}に${qty}Eを送ります。手数料 ${fee}E\n所持: ${bal}E → ${bal - qty - fee}E`,
    en: (name, qty, fee, bal) => `Send ${qty}E to ${name}. Fee ${fee}E\nBalance: ${bal}E → ${bal - qty - fee}E`
  },
  transferOverCapMsg: { ja: (remaining) => `§c今日の送金上限を超えます(あと${remaining}E)。`, en: (remaining) => `§cThat exceeds today's transfer limit (${remaining}E left).` },
  transferConfirmBtn: { ja: "送金する", en: "Send" },
  transferDoneMsg: { ja: (name, qty) => `§a${name}に${qty}Eを送金しました。`, en: (name, qty) => `§aSent ${qty}E to ${name}.` },
  transferReceivedMsg: { ja: (name, qty) => `§a${name}から${qty}Eが届きました。`, en: (name, qty) => `§aReceived ${qty}E from ${name}.` },
  transferFailMsg: { ja: "§c送金できませんでした(残高不足、または相手がオフラインです)。", en: "§cTransfer failed (insufficient funds or the recipient went offline)." },
  loanBtnManage: { ja: "融資管理", en: "Loan Management" },
  loanManageTitle: { ja: "融資管理", en: "Loan Management" },
  loanManageBorrowLine: {
    ja: (balance, principal, interest, weekly, weeks) => `【借入】残高${balance}E(元本${principal}E + 利息${interest}E)\n週${weekly}E / 残り${weeks}週`,
    en: (balance, principal, interest, weekly, weeks) => `[Borrowing] Balance ${balance}E (principal ${principal}E + interest ${interest}E)\n${weekly}E/week, ${weeks} weeks left`
  },
  loanManageNoBorrow: { ja: "【借入】なし", en: "[Borrowing] None" },
  loanManageLendLine: {
    ja: (name, amount, weeks) => `【貸付】${name}に${amount}E / 満期まで残り${weeks}週`,
    en: (name, amount, weeks) => `[Lending] ${amount}E to ${name} / ${weeks} weeks to maturity`
  },
  loanManageNoLend: { ja: "【貸付】なし", en: "[Lending] None" },
  loanBtnRepay: { ja: "返済する", en: "Repay" },
  loanRepayTitle: { ja: "繰上返済", en: "Early Repayment" },
  loanRepayToggle: {
    ja: (principal, balance, cash) => `利息もまとめて全額返す\nOFF: 借りた分${principal}Eだけ返す(残りの利息は週次で支払い)\nON: 残高${balance}Eを全額返して完済\n所持: ${cash}E`,
    en: (principal, balance, cash) => `Pay everything including interest\nOFF: repay the principal (${principal}E) only; the rest follows the weekly schedule\nON: pay the full balance (${balance}E) and close the loan\nBalance: ${cash}E`
  },
  loanRepayShort: {
    ja: (need, shortage) => `§c現金が足りません。必要${need}E(あと${shortage}E)`,
    en: (need, shortage) => `§cNot enough funds. Need ${need}E (${shortage}E short)`
  },
  loanRepayClosedMsg: {
    ja: (paid) => `§a${paid}Eを返済して完済しました。`,
    en: (paid) => `§aRepaid ${paid}E and closed the loan.`
  },
  loanRepayPartialMsg: {
    ja: (paid, balance) => `§a借りた分${paid}Eを返済しました。残りの利息は${balance}Eで、週次で支払います。`,
    en: (paid, balance) => `§aRepaid ${paid}E principal. Remaining interest ${balance}E follows the weekly schedule.`
  },
  loanLentMsg: {
    ja: (name, amount, weeks) => `§a${name}に${amount}Eを貸し付けました。${weeks}週後に結果がわかります。`,
    en: (name, amount, weeks) => `§aLent ${amount}E to ${name}. Result in ${weeks} weeks.`
  },
  // ---- 借入依頼の掲示板(借りる→募集 / 貸す→依頼の一覧)----
  loanBorrowTopTitle: { ja: "借りる", en: "Borrow" },
  loanBorrowTopBody: {
    ja: (own) => `銀行から借りる(審査あり・すぐ受け取れる)か、貸し手を募集します(7日ほど掲示。条件は信用スコアで決まり、審査なし)。${own}`,
    en: (own) => `Borrow from the bank (screened, instant), or post a request for a lender (listed about 7 days; terms follow your credit score, no screening).${own}`
  },
  loanBorrowTopOwn: {
    ja: (amount, weeks, ratePct, daysLeft) => `\n\n§e募集中: ${amount}E / ${weeks}週 / 週利${ratePct}%(あと約${daysLeft}日)§r`,
    en: (amount, weeks, ratePct, daysLeft) => `\n\n§ePosted: ${amount}E / ${weeks}w / ${ratePct}%/wk (about ${daysLeft}d left)§r`
  },
  loanBtnBank: { ja: "銀行から借りる", en: "Borrow from the bank" },
  loanBtnPost: { ja: "貸し手を募集する", en: "Post a request for lenders" },
  loanBtnCancelPost: { ja: "募集を取り下げる", en: "Withdraw my request" },
  loanPostTitle: { ja: "貸し手を募集", en: "Request a Lender" },
  loanPostBody: {
    ja: (limit) => `金額を選ぶと依頼が掲示され、貸し手が現れた時点でお金が入ります(借りられるのはあなたがオンラインの間)。\n金利は信用スコアが低いほど高くなります。\n借りられる上限: ${limit}E(純資産の半分まで。純資産 = 口座・外貨・株 − 借入)`,
    en: (limit) => `Pick an amount to post a request. Funds arrive when a lender takes it (while you are online).\nLower credit scores mean higher rates.\nBorrow limit: ${limit}E (up to half your net assets: account, currencies and stocks minus loans)`
  },
  loanPostNoAssets: {
    ja: (limit, min) => `§c資産が少なく、依頼できる最小の金額(${min}E)に届きません。いま借りられる上限は${limit}Eです。`,
    en: (limit, min) => `§cYour assets are too low for the smallest request (${min}E). Current borrow limit: ${limit}E.`
  },
  loanPostOverLimit: { ja: (limit) => `§c資産に対して借りられる額を超えています(上限${limit}E)。`, en: (limit) => `§cThat is above what your assets allow (limit ${limit}E).` },
  loanLendOverLimit: { ja: (limit) => `§c貸せる額を超えています。1件に貸せるのは資産の半分までです(いまの上限${limit}E)。`, en: (limit) => `§cThat is above your lending limit: one loan may be at most half your assets (now ${limit}E).` },
  loanPostTierBtn: {
    ja: (amount, weeks, ratePct, weekly) => `${amount}E / ${weeks}週 / 週利${ratePct}% / 週${weekly}E`,
    en: (amount, weeks, ratePct, weekly) => `${amount}E / ${weeks}w / ${ratePct}%/wk / ${weekly}E per week`
  },
  loanPostedMsg: {
    ja: (amount) => `§a${amount}Eの借入依頼を掲示しました。貸し手が現れるのを待ちます(約7日)。`,
    en: (amount) => `§aPosted a ${amount}E loan request. It stays up for about 7 days.`
  },
  loanPostAlready: { ja: "§c既に募集中です。取り下げてからやり直してください。", en: "§cYou already have a request posted. Withdraw it first." },
  loanPostCancelledMsg: { ja: "§a借入依頼を取り下げました。", en: "§aRequest withdrawn." },
  loanKindPlayer: { ja: "個人", en: "Player" },
  loanKindVillage: { ja: "村", en: "Village" },
  loanKindCompany: { ja: "会社", en: "Company" },
  loanKindNpc: { ja: "窓口", en: "Desk" },
  loanRequestLine: {
    ja: (kind, name, amount, weeks, ratePct, repayPct, assets, daysLeft) => `[${kind}] ${name} - ${amount}E / ${weeks}週 / 週利${ratePct}% / 返済見込${repayPct}%${assets === null ? "" : ` / 資産${assets}E`}${daysLeft === null ? "" : ` / あと約${daysLeft}日`}`,
    en: (kind, name, amount, weeks, ratePct, repayPct, assets, daysLeft) => `[${kind}] ${name} - ${amount}E / ${weeks}w / ${ratePct}%/wk / ${repayPct}% likely${assets === null ? "" : ` / assets ${assets}E`}${daysLeft === null ? "" : ` / ~${daysLeft}d left`}`
  },
  loanLendListBody: {
    ja: (bal, n) => `所持: ${bal}E\n掲示中の依頼: ${n}件(個人・村・会社)。下に窓口の融資希望者も並びます。`,
    en: (bal, n) => `Balance: ${bal}E\nOpen requests: ${n} (players, villages, companies). Desk borrowers are listed below.`
  },
  loanLentMarketMsg: {
    ja: (name, amount, weeks, weekly) => `§a${name}に${amount}Eを貸しました。週${weekly}E×${weeks}週で返済が届きます(オフライン中は次のログインで届きます)。`,
    en: (name, amount, weeks, weekly) => `§aLent ${amount}E to ${name}. Expect ${weekly}E/week for ${weeks} weeks (delivered at next login if you are offline).`
  },
  loanLendGone: { ja: "§cその依頼はもうありません。", en: "§cThat request is no longer available." },
  loanLendBorrowerOffline: { ja: "§c借り手が今オンラインではありません。", en: "§cThe borrower is offline right now." },
  loanLendBorrowerBusy: { ja: "§c借り手は既に別のローンを利用中です。", en: "§cThe borrower already has a loan." },
  loanMarketFilledBorrower: {
    ja: (lender, amount, weekly, weeks) => `§a${lender}が${amount}Eを貸してくれました。週${weekly}E×${weeks}週で返済します。`,
    en: (lender, amount, weekly, weeks) => `§a${lender} lent you ${amount}E. Repay ${weekly}E/week for ${weeks} weeks.`
  },
  loanMarketExpired: { ja: (amount) => `§e${amount}Eの借入依頼は、貸し手が現れないまま掲示期間が終わりました。`, en: (amount) => `§eYour ${amount}E loan request expired without a lender.` },
  loanMailPay: { ja: (name, amount) => `§a[融資] ${name}から返済 ${amount}E を受け取りました。`, en: (name, amount) => `§a[Lending] Received ${amount}E repayment from ${name}.` },
  loanMailClosedOk: { ja: (name) => `§a[融資] ${name}への貸付が完済になりました。`, en: (name) => `§a[Lending] The loan to ${name} is fully repaid.` },
  loanMailClosedLost: { ja: (name) => `§c[融資] ${name}への貸付が回収不能で終了しました(受け取れた分のみ)。`, en: (name) => `§c[Lending] The loan to ${name} ended unpaid (only what was already received).` },
  loanManageOwnRequest: {
    ja: (amount, weeks, daysLeft) => `【募集中】${amount}E / ${weeks}週(あと約${daysLeft}日)`,
    en: (amount, weeks, daysLeft) => `[Request posted] ${amount}E / ${weeks}w (about ${daysLeft}d left)`
  },
  loanManageLender: { ja: (name) => `貸し手: ${name}`, en: (name) => `Lender: ${name}` },

  // ------------------------------------------
  // 保険窓口
  // ------------------------------------------
  insuranceTitle: { ja: "保険窓口", en: "Insurance Desk" },
  insuranceFlavor: { ja: "§oワンタッチで即お見積もり。ケルプライフ§r", en: "§oOne-touch instant quotes. KelpLife.§r" },
  insuranceStatusActive: {
    ja: (name, paymentOk) => `契約中: ${name}\n保険料支払: ${paymentOk ? "正常" : "未払いあり"}`,
    en: (name, paymentOk) => `Active: ${name}\nPremium: ${paymentOk ? "OK" : "Overdue"}`
  },
  insuranceStatusNone: { ja: "現在、加入中の保険はありません。", en: "No active insurance." },
  insuranceBalanceLabel: { ja: "所持", en: "Balance" },
  insurancePremiumLabel: { ja: "保険料", en: "Premium" },
  insurancePremiumPerWeek: { ja: (premium) => `保険料 ${premium}E/週`, en: (premium) => `Premium ${premium}E/week` },
  insuranceBtnCancel: { ja: "解約する", en: "Cancel Insurance" },
  insuranceCanceledMsg: { ja: "保険を解約しました。", en: "Insurance cancelled." },
  insuranceDetailBody: {
    ja: (desc, premium, payoutName, payoutAmount) => `${desc}\n保険料: ${premium}E/週\n死亡時の支給: ${payoutName} ×${payoutAmount}`,
    en: (desc, premium, payoutName, payoutAmount) => `${desc}\nPremium: ${premium}E/week\nPayout: ${payoutName} x${payoutAmount}`
  },
  insuranceBtnSubscribe: { ja: "加入する", en: "Subscribe" },
  insuranceSubscribedMsg: {
    ja: (name) => `§a${name}に加入しました。`,
    en: (name) => `§aSubscribed to ${name}.`
  },

  // ------------------------------------------
  // 労働市場 (HRMHRM Partners HLD)
  // ------------------------------------------
  laborTitle: { ja: "HRMHRM Partners HLD", en: "HRMHRM Partners HLD" },
  laborBody: {
    ja: "村人が労働者として働くグローバルコンサルタントサービス。ご用件をお選びください。",
    en: "A global consultancy where villagers work as laborers. How can we help you today?"
  },
  laborBtnStaff: { ja: "スタッフサービス", en: "Staff Service" },
  laborBtnConsultant: { ja: "コンサルタントサービス", en: "Consultant Service" },
  laborBtnOwnersClub: { ja: "オーナーズクラブ", en: "Owner's Club" },

  laborStaffTitle: { ja: "スタッフサービス", en: "Staff Service" },
  laborStaffBody: { ja: "求人カテゴリを選んでください。", en: "Choose a job category." },
  laborCatUnqualified: { ja: "資格なし（オーバーワールド全般）", en: "No Qualification (Overworld)" },
  laborCatQualifiedLabel: {
    ja: (jobName) => `資格あり: ${jobName}`,
    en: (jobName) => `Qualified: ${jobName}`
  },

  laborLicenseTitle: { ja: (jobName) => `${jobName} 取得状況`, en: (jobName) => `${jobName} Progress` },
  laborLicenseActionPlace: { ja: "設置", en: "place" },
  laborLicenseActionBreak: { ja: "破壊", en: "break" },
  laborLicenseBiomeNote: {
    ja: (biomeName) => `(「${biomeName}」バイオーム内で行う必要があります)`,
    en: (biomeName) => `(must be done in the "${biomeName}" biome)`
  },
  laborLicenseBody: {
    ja: (blockName, actionLabel, biomeNote, progress, quota, stageLabel) =>
      `このカテゴリの求人にはライセンスが必要です。\n\n${blockName} を1つのチャンク内で ${actionLabel} し続けると進捗します${biomeNote}。\n現在の進捗: ${progress} / ${quota}\n(${stageLabel}に必要な数)`,
    en: (blockName, actionLabel, biomeNote, progress, quota, stageLabel) =>
      `This category requires a license.\n\n${actionLabel} ${blockName} within a single chunk to make progress ${biomeNote}.\nCurrent progress: ${progress} / ${quota}\n(needed for ${stageLabel})`
  },

  // ------------------------------------------
  // 求人掲示板(受注・納品・放棄) / 派遣(施設・産出) — dev/quest-template-spec.md, dev/dispatch-spec.md
  // ------------------------------------------
  laborFirstJobButton: {
    ja: (title) => `[初回] ${title}\n報告するだけ / シュルカーボックス1個`,
    en: (title) => `[First time] ${title}\nJust report in / 1 shulker box`
  },
  laborFirstJobBody: {
    ja: (max) =>
      `スタッフサービスへようこそ。\n\n・求人は毎日4件、掲示されます。資格が必要な求人はロックされていて、ライセンスを取ると受けられます。\n・求人を選んで「受注する」を押し、書見台の近くのチェスト・樽・シェルカーボックスに必要な数を入れて「納品する」を押すと、報酬が口座に入ります。\n・同時に受けられるのは${max}件までです。\n\nまずは、この説明を読んだことを報告してください。報酬はシュルカーボックス1個です。`,
    en: (max) =>
      `Welcome to Staff Services.\n\n- Four jobs are posted every day. Jobs that need a license are locked until you get it.\n- Pick a job, press Claim, put the required items in a chest, barrel or shulker box near the lectern, then press Deliver to get paid.\n- You can hold up to ${max} jobs at once.\n\nFirst, report that you have read this. Your reward is one shulker box.`
  },
  laborBtnReport: { ja: "報告する", en: "Report" },
  laborFirstJobDoneMsg: {
    ja: "§aシュルカーボックスを1個受け取りました。求人の掲示から、仕事を選んでみましょう。",
    en: "§aYou received a shulker box. Pick a job from the board."
  },
  laborFirstJobFailedMsg: { ja: "§cシュルカーボックスを渡せませんでした。もう一度お試しください。", en: "§cCould not give the shulker box. Please try again." },
  laborBoardBody: {
    ja: (max, active) => `今日の掲示と、受注中のクエストです。\n同時に受けられるのは${max}件まで(いま${active}件)。受注は受けた週の終わりまで有効です。`,
    en: (max, active) => `Today's board and your active quests.\nYou can hold up to ${max} at once (now ${active}). A claim lasts until the end of the week.`
  },
  laborBoardTagClaimed: { ja: "[受注中] ", en: "[Active] " },
  laborBoardTagDone: { ja: "[完了] ", en: "[Done] " },
  laborBoardTagLocked: { ja: "[資格が必要] ", en: "[License needed] " },
  laborBoardButton: {
    ja: (tag, title, itemName, count, reward) => `${tag}${title}\n${itemName} x${count} / ${reward}E`,
    en: (tag, title, itemName, count, reward) => `${tag}${title}\n${itemName} x${count} / ${reward}E`
  },
  laborQuestDetailBody: {
    ja: (title, itemName, count, reward, grade, claimedBy, hint) =>
      `${title}\n${itemName} を ${count} 個納品\n報酬目安: ${reward} E(${grade}級ボーナス適用後に確定)\n受注中の人: ${claimedBy}\n\n${hint}`,
    en: (title, itemName, count, reward, grade, claimedBy, hint) =>
      `${title}\nDeliver ${count} x ${itemName}\nReward estimate: ${reward} E (final after the ${grade}-rank bonus)\nClaimed by: ${claimedBy}\n\n${hint}`
  },
  laborQuestNobody: { ja: "まだいません", en: "nobody yet" },
  laborQuestHintClaim: { ja: "受注すると、今週の終わりまで納品できます。", en: "Claim it to deliver until the end of this week." },
  laborQuestHintDeliver: {
    ja: "書見台の近くのチェスト・樽・シェルカーボックスに必要な数を入れてから「納品する」を押してください。",
    en: "Put the required items in a chest, barrel or shulker box near the lectern, then press Deliver."
  },
  laborQuestHintDone: { ja: "このクエストは完了済みです。", en: "This quest is already complete." },
  laborBtnClaim: { ja: "受注する", en: "Claim" },
  laborBtnAbandon: { ja: "放棄する", en: "Abandon" },
  laborClaimedMsg: { ja: (title) => `§a「${title}」を受注しました。`, en: (title) => `§aClaimed "${title}".` },
  laborClaimLimitMsg: {
    ja: (max) => `§c同時に受けられるクエストは${max}件までです。`,
    en: (max) => `§cYou can hold at most ${max} quests at once.`
  },
  laborClaimNoLicenseMsg: { ja: "§cこのクエストにはライセンスが必要です。", en: "§cThis quest needs a license." },
  laborClaimFailedMsg: { ja: "§c受注できませんでした。", en: "§cCould not claim the quest." },
  laborAbandonedMsg: { ja: (title) => `「${title}」を放棄しました。`, en: (title) => `Abandoned "${title}".` },

  laborBtnDispatch: { ja: "派遣する", en: "Dispatch" },
  laborDispatchGenreBody: { ja: "派遣先のジャンルを選んでください。", en: "Choose a facility type." },
  laborDispatchOperatorBody: { ja: "運営主体(施設)を選んでください。", en: "Choose the operator (facility)." },
  laborDispatchDaysBody: {
    ja: "派遣する日数を選んでください。\n日数と賃金に応じた現物が、完了して回収した時に施設へ届きます。",
    en: "Choose the number of days.\nGoods worth the wage x days are delivered to the facility when you collect."
  },
  laborDispatchedToMsg: {
    ja: (name, facilityName, days, itemName, count) => `§a${name}を${facilityName}へ${days}日間派遣しました。産出予定: ${itemName} x${count}`,
    en: (name, facilityName, days, itemName, count) => `§aDispatched ${name} to ${facilityName} for ${days} days. Expected output: ${itemName} x${count}`
  },
  laborFactoryNoInputMsg: {
    ja: (name) => `§e${name} には加工できる原料の在庫がありません。農場・鉱山からの産出や、納品された原料が入ると動きます。`,
    en: (name) => `§e${name} has no raw materials to process. It runs once farms, mines or deliveries stock it.`
  },
  laborDispatchDeliveredMsg: {
    ja: (facilityName, itemName, count) => `${facilityName}に ${itemName} x${count} が届きました。`,
    en: (facilityName, itemName, count) => `${itemName} x${count} was delivered to ${facilityName}.`
  },
  laborRetiredMsg: {
    ja: (name, days) => `§e${name}は通算${days}日の派遣に達したため、任期満了で除名になりました。`,
    en: (name, days) => `§e${name} has reached ${days} total dispatched days and has been retired.`
  },
  laborEmployeeTenureLine: {
    ja: (total, limit) => `通算派遣日数: ${total}/${limit}日`,
    en: (total, limit) => `Total dispatched days: ${total}/${limit}`
  },
  laborQuestTitle: { ja: "求人掲示板", en: "Quest Board" },
  laborQuestCompletedBody: {
    ja: "本日の依頼は完了済みです。また明日お越しください。",
    en: "Today's task is already complete. Please come back tomorrow."
  },
  laborQuestBody: {
    ja: (itemName, count, reward, grade) =>
      `本日の依頼:\n${itemName} を ${count} 個納品\n報酬目安: ${reward} E（${grade}級ボーナス適用後に確定）\n\n書見台の近くのチェスト・樽・シェルカーボックスに必要な数を入れてから「納品する」を押してください。`,
    en: (itemName, count, reward, grade) =>
      `Today's task:\nDeliver ${count}x ${itemName}\nBase reward: ${reward} E (Grade ${grade} bonus applied on delivery)\n\nPlace the required items in a chest, barrel, or shulker box near the lectern, then press Deliver.`
  },
  laborBtnDeliver: { ja: "納品する", en: "Deliver" },
  laborBtnEditSkills: { ja: "履歴書(スキルセット)を編集する", en: "Edit Resume (Skills)" },
  laborDeliverInsufficientItem: {
    ja: (itemName) => `§c${itemName}が足りません。`,
    en: (itemName) => `§cNot enough ${itemName}.`
  },
  laborDeliverNoContainer: {
    ja: "§c書見台の近くにチェスト・樽・シェルカーボックスが見つかりません。",
    en: "§cNo chest, barrel, or shulker box found near the lectern."
  },
  laborDeliverFailed: { ja: "§c納品できませんでした。", en: "§cCould not deliver." },
  laborDeliverSuccess: {
    ja: (wage, grossWage, laborCost, stockSuffix) => `§a納品完了！ +${wage} E（基本報酬${grossWage} E − 人件費${laborCost} E）${stockSuffix}`,
    en: (wage, grossWage, laborCost, stockSuffix) => `§aDelivered! +${wage} E (base ${grossWage} E − labor cost ${laborCost} E)${stockSuffix}`
  },

  laborSkillEditTitle: { ja: "自己申告スキルセット", en: "Self-declared Skills" },
  laborSkillEditField: {
    ja: "カンマ区切りで入力（例: 力持ち,夜目が利く）",
    en: "Comma-separated (e.g. Strong, Night Vision)"
  },
  laborSkillUpdated: { ja: "§aスキルセットを更新しました。", en: "§aSkills updated." },

  laborConsultantTitle: { ja: "コンサルタントサービス", en: "Consultant Service" },
  laborConsultantActiveBody: {
    ja: (days, daysLeft, margin) =>
      `現在契約中: ${days}日契約\n残り日数: ${daysLeft}日\n満期時マージン目安: ${margin} E(人件費差引前)\n\n満了するには、借りた村人を書見台の近く(半径6ブロック)まで連れて戻ってきてください。`,
    en: (days, daysLeft, margin) =>
      `Active contract: ${days}-day\nDays left: ${daysLeft}\nMargin at maturity (before labor cost): ${margin} E\n\nTo complete, bring the villager back within 6 blocks of the lectern.`
  },
  laborBtnCompleteContract: { ja: "契約満了を確定する", en: "Complete Contract" },
  laborBtnReportLoss: { ja: "村人を紛失した（違約金を払う）", en: "Report Loss (pay penalty)" },
  laborContractCompleteMsg: {
    ja: (margin, laborCost, stockSuffix) =>
      `§a契約満了。村人をHRMHRMに返却しました。マージン +${margin} E(人件費 -${laborCost} E差引済み)${stockSuffix}`,
    en: (margin, laborCost, stockSuffix) =>
      `§aContract complete. Villager returned to HRMHRM. Margin +${margin} E (labor cost -${laborCost} E already deducted)${stockSuffix}`
  },
  laborNoVillagerNearby: {
    ja: "§c書見台の近くに村人が見つかりません。借りた村人を連れて戻ってきてください。",
    en: "§cNo villager found near the lectern. Please bring the rented villager back here."
  },
  laborContractStillActive: { ja: "§cまだ契約期間中です。", en: "§cContract period is not over yet." },
  laborLossPenaltyMsg: {
    ja: (penalty) => `§c違約金を支払いました: -${penalty} E`,
    en: (penalty) => `§cPaid penalty: -${penalty} E`
  },
  laborConsultantChooseBody: {
    ja: "村人を借り受ける契約を選んでください。",
    en: "Choose a villager rental contract."
  },
  laborContractOptionBtn: {
    ja: (name, marginMin, marginMax) => `${name}\nマージン目安: ${marginMin}〜${marginMax} E`,
    en: (name, marginMin, marginMax) => `${name}\nMargin: ${marginMin}-${marginMax} E`
  },
  laborContractSignedMsg: {
    ja: "§a契約成立！村人スポーンエッグとベッドを受け取りました。",
    en: "§aContract signed! Received a villager spawn egg and bed."
  },

  laborOwnersClubTitle: { ja: "オーナーズクラブ", en: "Owner's Club" },
  laborOwnersClubBody: {
    ja: (count, max, accidentPercent, overNote) => `雇用者数: ${count} / ${max}\n現在の事故率: ${accidentPercent}%${overNote}`,
    en: (count, max, accidentPercent, overNote) => `Employees: ${count} / ${max}\nCurrent accident rate: ${accidentPercent}%${overNote}`
  },
  laborOverCapNote: {
    ja: (over) => (over ? "（100人超過中）" : ""),
    en: (over) => (over ? " (over 100)" : "")
  },
  laborBtnRegisterVillager: { ja: "近くの村人を登録する", en: "Register Nearby Villager" },
  laborBtnViewEmployees: { ja: "雇用者一覧を見る", en: "View Employees" },
  laborCapReached: { ja: "§cこれ以上登録できません（上限128人）。", en: "§cCannot register any more (128 max)." },
  laborNoVillagerFound: { ja: "§c近くに村人が見つかりません。", en: "§cNo villager found nearby." },
  laborRegisterSuccessMsg: {
    ja: (name, grade, level, skills, grant) =>
      `§a${name}（${grade}級 Lv${level}）を登録しました。自己申告スキル: ${skills}\nOW協会補助金 +${grant} E`,
    en: (name, grade, level, skills, grant) =>
      `§aRegistered ${name} (Grade ${grade}, Lv${level}). Self-declared skills: ${skills}\nOW Association grant +${grant} E`
  },

  laborEmployeeListTitle: { ja: "雇用者一覧", en: "Employee List" },
  laborNoEmployeesMsg: { ja: "§7雇用者がいません。", en: "§7No employees yet." },
  laborDispatchedLabel: {
    ja: (daysLeft) => `派遣中（残${daysLeft}日）`,
    en: (daysLeft) => `Dispatched (${daysLeft}d left)`
  },
  laborIdleLabel: { ja: "待機中", en: "Idle" },
  laborEmployeeButtonLabel: {
    ja: (name, grade, level, statusLabel, wage) => `${name} ${grade}級 Lv${level}\n${statusLabel} / ${wage}E/日`,
    en: (name, grade, level, statusLabel, wage) => `${name} Grade ${grade} Lv${level}\n${statusLabel} / ${wage}E/day`
  },
  laborGateKnown: {
    ja: (x, y, z) => `最寄りゲート: (${x}, ${y}, ${z})`,
    en: (x, y, z) => `Nearest gate: (${x}, ${y}, ${z})`
  },
  laborGateUnknown: { ja: "最寄りゲート: 不明", en: "Nearest gate: unknown" },
  laborEmployeeDetailBody: {
    ja: (grade, level, wage, skills, gateText, recordCount) =>
      `${grade}級 Lv${level}\n賃金: ${wage} E/日\n自己申告スキル: ${skills}\n${gateText}\n完了実績: ${recordCount}件`,
    en: (grade, level, wage, skills, gateText, recordCount) =>
      `Grade ${grade}, Lv${level}\nWage: ${wage} E/day\nSelf-declared skills: ${skills}\n${gateText}\nCompleted records: ${recordCount}`
  },
  laborBtnDispatch3: { ja: "3日間 派遣する", en: "Dispatch (3 days)" },
  laborBtnDispatch7: { ja: "7日間 派遣する", en: "Dispatch (7 days)" },
  laborDispatchedMsg: {
    ja: (name, days) => `§a${name}を${days}日間派遣しました。`,
    en: (name, days) => `§aDispatched ${name} for ${days} days.`
  },
  laborStillDispatched: { ja: "§7まだ派遣期間中です。", en: "§7Still on dispatch." },
  laborAccidentMsg: {
    ja: (name, compensation, stockSuffix) => `§c${name}の派遣先で事故がありました。補填金として -${compensation} E を支払いました。${stockSuffix}`,
    en: (name, compensation, stockSuffix) => `§cAn accident occurred while ${name} was dispatched. Paid -${compensation} E in compensation.${stockSuffix}`
  },
  laborDispatchCompleteMsg: {
    ja: (name, margin, laborCost, stockSuffix) =>
      `§a${name}の派遣が完了。マージン +${margin} E（人件費 -${laborCost} E差引済み）${stockSuffix}`,
    en: (name, margin, laborCost, stockSuffix) =>
      `§a${name}'s dispatch complete. Margin +${margin} E (labor cost -${laborCost} E already deducted)${stockSuffix}`
  },
  laborStockOptionSuffix: {
    ja: (granted) => `\n§6+${granted}株 HRMHRM ストックオプション付与！`,
    en: (granted) => `\n§6+${granted} HRMHRM stock option(s) granted!`
  },
  listSeparator: { ja: "、", en: ", " },
  laborNoSkills: { ja: "なし", en: "none" },

  // ------------------------------------------
  // コールドウォレット管理者設定 (ネットワーク共有シークレット)
  // ------------------------------------------
  walletAdminBtn: { ja: "【管理者】持ち出し用ネットワーク設定", en: "[Admin] Network Export Settings" },
  walletAdminTitle: { ja: "ネットワーク共有シークレット", en: "Network Shared Secret" },
  walletAdminStatusSet: {
    ja: "現在: 設定済み（別ワールドへの持ち出しが有効）",
    en: "Current: Configured (cross-world export enabled)"
  },
  walletAdminStatusUnset: {
    ja: "現在: 未設定（このワールド内でのみ利用可能）",
    en: "Current: Not set (this world only)"
  },
  walletAdminBody: {
    ja: (statusText) =>
      `信頼できる他サーバーの運営者と、ゲーム外(Discord等)で事前に同じ文字列を共有し、双方のワールドに同じ値を設定すると、コールドウォレットのコードを両ワールド間でやり取りできます。\n未設定の場合、持ち出し機能は無効になります(このワールド内でのみ安全に利用できます)。\n\n${statusText}`,
    en: (statusText) =>
      `Share the same secret string out-of-game (e.g. via Discord) with a trusted server admin, and set it on both worlds to enable cold wallet code exchange between them.\nLeave unset to disable cross-world export (safest, this-world-only mode).\n\n${statusText}`
  },
  walletAdminSetBtn: { ja: "設定する", en: "Set secret" },
  walletAdminClearBtn: { ja: "解除する（持ち出しを無効化）", en: "Clear (disable cross-world export)" },
  walletAdminClearedMsg: { ja: "§aネットワーク共有シークレットを解除しました。", en: "§aNetwork shared secret cleared." },
  walletAdminInputTitle: { ja: "ネットワーク共有シークレット", en: "Network Shared Secret" },
  walletAdminInputField: {
    ja: "共有する文字列（他サーバーと完全一致させること）",
    en: "Shared string (must exactly match the other server)"
  },
  walletAdminEmptyError: { ja: "§c空文字は設定できません。", en: "§cCannot set an empty value." },
  walletAdminSetMsg: { ja: "§aネットワーク共有シークレットを設定しました。", en: "§aNetwork shared secret set." },

  // ------------------------------------------
  // 株式市場: ストックオプション型配当の説明
  // ------------------------------------------
  stockOptionDivLabel: { ja: "配当: 労働のたびに自動付与", en: "Dividend: auto-granted per job" },
  stockOptionDivInfo: {
    ja: (threshold) =>
      `§7HRMHRM株を${threshold}E分以上保有していると、クエストの納品・コンサル契約満了・村人派遣の回収のたびに自動でストックオプション(自社株)が付与されます。`,
    en: (threshold) =>
      `§7Hold at least ${threshold}E worth of HRMHRM stock, and you'll automatically receive stock options (company shares) every time you deliver a quest, complete a consultant contract, or collect a villager dispatch.`
  },

  // ------------------------------------------
  // 法人テンプレート(鐘=村 / ロードストーン=会社)。ロジックは economy/core-registry.js
  // ------------------------------------------
  coreBtnClose: { ja: "閉じる", en: "Close" },
  coreBtnBack: { ja: "戻る", en: "Back" },
  coreBtnCancel: { ja: "やめる", en: "Cancel" },
  coreRegVillageTitle: { ja: "村の登記", en: "Register a Village" },
  coreRegVillageBody: {
    ja: "この鐘を村として登記します。\n村名と村長の名前はランダムに決まります。登録料は無料です。\n(輝くイカスミを1個消費)",
    en: "Register this bell as a village.\nThe village name and head are chosen at random. Registration is free.\n(Consumes 1 Glow Ink Sac)"
  },
  coreRegBtn: { ja: "登記する", en: "Register" },
  coreRegCompanyTitle: { ja: "会社の登記", en: "Register a Company" },
  coreRegCompanyField: {
    ja: (fee, max) => `登録料: ${fee} E(HRMHRMへ払います。返金なし)\n会社名(${max}文字まで)`,
    en: (fee, max) => `Fee: ${fee} E (paid to HRMHRM, non-refundable)\nCompany name (up to ${max} characters)`
  },
  coreRegCompanyPlaceholder: { ja: "例: メナス採掘工業", en: "e.g. Menace Mining Co." },
  coreRegCompanyFieldEn: {
    ja: (max) => `英語名(任意。${max}文字まで)\n§7あなたの言語と違う言語で遊ぶ人には、こちらの名前が表示されます。空欄なら、同じ名前がそのまま表示されます。`,
    en: (max) => `Japanese name (optional, up to ${max} characters)\n§7Players using another language will see this name. If left empty, the same name is shown to everyone.`
  },
  coreRegCompanyPlaceholderEn: { ja: "例: Menace Mining Co.", en: "e.g. メナス採掘工業" },
  coreErrBlockChanged: { ja: "§cブロックが変わっています。もう一度やり直してください。", en: "§cThe block has changed. Please try again." },
  coreErrAlready: { ja: "§cすでに登記済みです。", en: "§cThis block is already registered." },
  coreErrVillageOverlap: {
    ja: (name) => `§cこの範囲にはすでに村「${name}」が登記されています。`,
    en: (name) => `§cA village "${name}" is already registered in this area.`
  },
  coreErrOneCompany: {
    ja: (name) => `§c会社は1人1社までです(登記済み: 「${name}」)。`,
    en: (name) => `§cOne company per person (already registered: "${name}").`
  },
  coreErrCooldown: {
    ja: (days) => `§c前の会社を解散したばかりのため、あと ${days} 日は新しい会社を登記できません。`,
    en: (days) => `§cYou recently dissolved a company. You can register a new one in ${days} day(s).`
  },
  coreErrNameEmpty: { ja: "§c会社名を入力してください。", en: "§cPlease enter a company name." },
  coreErrNameTooLong: { ja: (max) => `§c会社名は${max}文字までです。`, en: (max) => `§cCompany names are limited to ${max} characters.` },
  coreErrNameReserved: { ja: "§cその名前は使えません。", en: "§cThat name cannot be used." },
  coreErrNameDuplicate: { ja: "§cその会社名はすでに使われています。", en: "§cThat company name is already taken." },
  coreErrFunds: {
    ja: (fee, bal) => `§c登録料が足りません(登録料 ${fee} E / 口座残高 ${bal} E)。口座管理から預け入れてください。`,
    en: (fee, bal) => `§cNot enough funds (fee ${fee} E / balance ${bal} E). Deposit emeralds at the bank first.`
  },
  coreErrNoCatalyst: { ja: "§c輝くイカスミを手に持ってください。", en: "§cHold a Glow Ink Sac in your hand." },
  coreErrAccount: { ja: "§c口座を作れませんでした。登録料は戻しました。", en: "§cCould not open the account. The fee was refunded." },
  coreBroadcastRegistered: {
    ja: (kind, name, id) => `§a[登記] ${kind === "village" ? "村" : "会社"}「${name}」(ID: ${id}) が誕生しました。`,
    en: (kind, name, id) => `§a[Registry] ${kind === "village" ? "Village" : "Company"} "${name}" (ID: ${id}) was founded.`
  },
  coreBroadcastDissolved: {
    ja: (name, id) => `§e[登記] 「${name}」(ID: ${id}) は解散しました。`,
    en: (name, id) => `§e[Registry] "${name}" (ID: ${id}) was dissolved.`
  },
  coreBroadcastForced: {
    ja: (name, reason) => `§e[登記] 「${name}」は${reason === "abandoned" ? "社長の不在が続いたため" : reason === "empty" ? "人口0が続いたため" : reason === "deregistered" ? "口座が閉じられたため" : "債務超過が続いたため"}強制的に解散しました。`,
    en: (name, reason) => `§e[Registry] "${name}" was dissolved ${reason === "abandoned" ? "because its president stayed away" : reason === "empty" ? "because it had no population" : reason === "deregistered" ? "because its account was closed" : "because it stayed insolvent"}.`
  },
  coreBreakBlocked: {
    ja: "§c登記済みのブロックは壊せません。触って「経営管理」から解散してください。",
    en: "§cA registered block cannot be broken. Interact with it and dissolve it from Management."
  },
  coreRestored: {
    ja: (name) => `§e[登記] 「${name}」のコアブロックが消えていたため復元しました。`,
    en: (name) => `§e[Registry] The core block of "${name}" was missing and has been restored.`
  },
  coreLostAccident: {
    ja: (ids) => `§c[登記] 解散の記録がないのにデータが見つからない登記があります(事故): ${ids}`,
    en: (ids) => `§c[Registry] Registrations with no data and no dissolution record (accident): ${ids}`
  },
  corePendingPaid: {
    ja: (amount, from) => `§a[清算] 「${from}」の清算金 ${amount} E が口座に振り込まれました。`,
    en: (amount, from) => `§a[Liquidation] ${amount} E from the liquidation of "${from}" was deposited into your account.`
  },
  corePendingPenalty: {
    ja: (delta) => `§c[清算] 解散のペナルティで、信用スコアが ${delta} 下がりました。`,
    en: (delta) => `§c[Liquidation] Your credit score dropped by ${delta} because of the dissolution penalty.`
  },
  coreMenuTitleVillage: { ja: "村の管理", en: "Village Management" },
  coreMenuTitleCompany: { ja: "会社の管理", en: "Company Management" },
  coreMenuBody: {
    ja: (isVillage, name, head, id) => `${isVillage ? "村名" : "会社名"}: ${name}\n${isVillage ? "村長" : "社長"}: ${head}\nID: ${id}`,
    en: (isVillage, name, head, id) => `${isVillage ? "Village" : "Company"}: ${name}\n${isVillage ? "Head" : "President"}: ${head}\nID: ${id}`
  },
  coreBtnPeople: { ja: "人員管理", en: "Personnel" },
  coreBtnAccounting: { ja: "会計管理", en: "Accounting" },
  coreBtnAssets: { ja: "保有施設", en: "Facilities" },
  coreBtnStock: { ja: "在庫管理", en: "Inventory" },
  coreBtnContracts: { ja: "契約管理", en: "Contracts" },
  coreBtnManage: { ja: "経営管理", en: "Management" },
  coreComingSoon: { ja: "§7準備中です。", en: "§7Coming soon." },
  corePeopleTitle: { ja: "人員管理", en: "Personnel" },
  corePeopleVillageBody: {
    ja: (xz, y, total, adults, babies) => `範囲: コアブロックから 水平±${xz} / 高さ±${y} ブロック\n村人: ${total}人(大人 ${adults} / 子供 ${babies})`,
    en: (xz, y, total, adults, babies) => `Range: ±${xz} horizontal / ±${y} vertical from the core block\nVillagers: ${total} (adults ${adults} / children ${babies})`
  },
  corePeopleHistory: {
    ja: (pop, day, hist) => `\n\n記録人口: ${pop}人 (日${day}時点)\n履歴: ${hist}`,
    en: (pop, day, hist) => `\n\nRecorded population: ${pop} (day ${day})\nHistory: ${hist}`
  },
  corePeopleNote: {
    ja: "\n\n§7※読み込まれている範囲の村人だけ数えます。毎日1回、近くにプレイヤーがいる時に記録します。",
    en: "\n\n§7Only loaded villagers are counted. Recorded once a day while a player is nearby."
  },
  corePeopleCompanyBody: {
    ja: (head, count, names) => `社長: ${head}\nメンバー: ${count}人${names ? "\n" + names : ""}`,
    en: (head, count, names) => `President: ${head}\nMembers: ${count}${names ? "\n" + names : ""}`
  },
  coreProxyNote: { ja: "\n\n§e社長が不在のため、採用・見送りを代行しています。", en: "\n\n§eThe president is away; you can hire and decline on their behalf." },
  coreApplicantCount: { ja: (n) => `\n応募者: ${n}人`, en: (n) => `\nApplicants: ${n}` },
  coreReviewBtn: { ja: (n) => `応募者を確認 (${n})`, en: (n) => `Review applicants (${n})` },
  coreLeaveBtn: { ja: "退職する", en: "Leave the company" },
  coreApplyBtn: { ja: "応募する", en: "Apply" },
  coreAppliedBody: { ja: "\n\n§7応募済みです。社長の返答をお待ちください。", en: "\n\n§7You have applied. Please wait for the president's reply." },
  coreApplyPrompt: { ja: "\n\nこの会社に応募しますか?", en: "\n\nApply to this company?" },
  coreApplyDone: { ja: (name) => `§a「${name}」に応募しました。`, en: (name) => `§aYou applied to "${name}".` },
  coreApplyFull: { ja: "§c応募者がいっぱいです。", en: "§cThe applicant list is full." },
  coreApplyAlready: { ja: "§7すでに応募しています。", en: "§7You have already applied." },
  coreLeft: { ja: (name) => `§e「${name}」を退職しました。`, en: (name) => `§eYou left "${name}".` },
  coreReviewTitle: { ja: "応募者の確認", en: "Applicants" },
  coreReviewBody: {
    ja: (name, day, remain) => `「${name}」をメンバーに入れますか?\n(応募日: 日${day} / 残り ${remain}人)`,
    en: (name, day, remain) => `Add "${name}" as a member?\n(Applied: day ${day} / ${remain} remaining)`
  },
  coreHireBtn: { ja: "採用", en: "Hire" },
  coreSkipBtn: { ja: "見送り", en: "Decline" },
  coreHired: { ja: (name) => `§a「${name}」を採用しました。`, en: (name) => `§aHired "${name}".` },
  coreSkipped: { ja: (name) => `§7「${name}」を見送りました。`, en: (name) => `§7Declined "${name}".` },
  coreForbidden: { ja: "§c権限がありません。", en: "§cYou do not have permission." },
  coreManageTitle: { ja: "経営管理", en: "Management" },
  coreDissolveBtn: { ja: "§4解散手続き", en: "§4Dissolve" },
  coreManageOnlyOwner: { ja: "§c経営管理は登記した本人だけが使えます。", en: "§cOnly the person who registered it can use Management." },
  coreDissolveTitle: { ja: "解散の確認(清算の見積もり)", en: "Confirm Dissolution (Liquidation Estimate)" },
  coreDissolveBody: {
    ja: (name, est, pctRatio, penaltyPct, cooldown, isCompany) => {
      const f = (n) => Math.round(n).toLocaleString("en-US");
      const lines = [
        `「${name}」を解散します。`,
        `現金 ${f(est.cash)} E + 債権 ${f(est.receivables)} E`,
        `現物の時価 ${f(est.holdingsValue)} E → 銀行の買取 ${f(est.bankBuy)} E(時価の${pctRatio}%)`,
        `負債 ${f(est.liabilities)} E`,
        `§l清算結果: ${est.result >= 0 ? "+" : "-"}${f(Math.abs(est.result))} E§r`,
        est.payout > 0 ? `残りの ${f(est.payout)} E は口座へ払われます。` : est.shortfall > 0 ? `§c${f(est.shortfall)} E が足りません。不足分は銀行の損失になります。` : "払われる金額はありません。"
      ];
      if (penaltyPct > 0) lines.push(`§cペナルティ: 信用スコアが現在の ${penaltyPct}% 下がります。` + (cooldown > 0 ? `新しい会社は ${cooldown} 日後まで登記できません。` : ""));
      if (isCompany) lines.push("登録料は戻りません。");
      lines.push("§7登記が抹消され、ブロックは壊せるようになります。元に戻せません。");
      return lines.join("\n");
    },
    en: (name, est, pctRatio, penaltyPct, cooldown, isCompany) => {
      const f = (n) => Math.round(n).toLocaleString("en-US");
      const lines = [
        `Dissolve "${name}".`,
        `Cash ${f(est.cash)} E + receivables ${f(est.receivables)} E`,
        `Holdings at market ${f(est.holdingsValue)} E -> bank buys for ${f(est.bankBuy)} E (${pctRatio}% of market)`,
        `Liabilities ${f(est.liabilities)} E`,
        `§lResult: ${est.result >= 0 ? "+" : "-"}${f(Math.abs(est.result))} E§r`,
        est.payout > 0 ? `${f(est.payout)} E will be paid into your account.` : est.shortfall > 0 ? `§cShort by ${f(est.shortfall)} E. The shortfall becomes a loss for the bank.` : "Nothing will be paid out."
      ];
      if (penaltyPct > 0) lines.push(`§cPenalty: your credit score drops by ${penaltyPct}%.` + (cooldown > 0 ? ` You cannot register a new company for ${cooldown} day(s).` : ""));
      if (isCompany) lines.push("The registration fee is not refunded.");
      lines.push("§7The registration is erased and the block becomes breakable. This cannot be undone.");
      return lines.join("\n");
    }
  },
  coreDissolveConfirmBtn: { ja: "§4解散する", en: "§4Dissolve" },
  coreDissolveDone: { ja: (name) => `§e「${name}」を解散しました。`, en: (name) => `§eDissolved "${name}".` },
  coreDissolveFail: { ja: "§c解散できませんでした。もう一度試してください。", en: "§cCould not dissolve. Please try again." },

  laborFacilityClosedMsg: { ja: "§7派遣先の施設は閉鎖されていたため、産出は届きませんでした。", en: "§7The facility had been closed, so no output was delivered." },
  coreCompanyOnly: { ja: "§7この機能は会社だけが使えます。", en: "§7Only companies can use this." },
  coreStockTitle: { ja: "在庫管理", en: "Inventory" },
  coreStockBody: {
    ja: (lines, keep, valueE) => `${lines}\n\n在庫の時価: 約 ${valueE} E\n§7自社の施設(農場・鉱山・工場)に派遣された村人の産出が、ここに溜まります。週の締めに、1品目あたり ${keep} 個を超えた分が、その時の売値で換金されて会社の口座へ入ります。`,
    en: (lines, keep, valueE) => `${lines}\n\nStock value: about ${valueE} E\n§7Output from villagers dispatched to your facilities (farm, mine, factory) accumulates here. At each weekly close, whatever exceeds ${keep} per item is sold at the current price into the company account.`
  },
  coreStockEmpty: { ja: "在庫はありません。", en: "No stock." },
  coreContractsTitle: { ja: "契約管理", en: "Contracts" },
  coreContractsBody: {
    ja: (ongoing, log) => `§l進行中の派遣§r\n${ongoing}\n\n§l最近の結果§r\n${log}\n\n§7会社は、農場・鉱山・工場の3つの仮想施設を持っています。オーナーズクラブの派遣先に、会社の施設が並びます。`,
    en: (ongoing, log) => `§lDispatches in progress§r\n${ongoing}\n\n§lRecent results§r\n${log}\n\n§7A company has three virtual facilities: a farm, a mine and a factory. They appear as dispatch destinations in the Owners Club.`
  },
  coreContractsNone: { ja: "なし", en: "None" },
  coreStockBodyVillage: {
    ja: (lines, valueE, ship) => `§l村の在庫§r\n${lines}\n\n在庫の時価: 約 ${valueE} E\n§7スタッフサービスの「村からのクエスト」で納品された物資が、ここに溜まります。週の締めに、パン・焼き肉・インゴット・原木などに加工して、相場より安く市場へ出荷し、代金が村の口座に入ります。加工できない品(作物・腐った肉など)は村の中で消費されます。§r\n\n§l先週の加工・出荷§r\n${ship}`,
    en: (lines, valueE, ship) => `§lVillage stock§r\n${lines}\n\nStock value: about ${valueE} E\n§7Goods delivered through Staff Service -> Village Quests accumulate here. At the weekly close they are processed (bread, cooked meat, ingots, logs...) and shipped to the market below the going price; the proceeds go to the village account. Goods that cannot be processed (crops, rotten flesh) are consumed in the village.§r\n\n§lLast weekly processing and shipping§r\n${ship}`
  },
  coreShipNone: { ja: "まだ週の締めを迎えていません。", en: "No weekly close yet." },
  coreShipLine: {
    ja: (week, made, cash, used) => `第${week}週: 加工品 ${made} → 出荷収入 ${cash} E\n消費した物資: ${used}`,
    en: (week, made, cash, used) => `Week ${week}: made ${made} -> shipping income ${cash} E\nConsumed: ${used}`
  },
  coreSlotLine: {
    ja: (item, taken, need, unit) => `・${item} 受注済み ${taken}/${need} 個(1個 ${unit}E)`,
    en: (item, taken, need, unit) => `- ${item} ordered ${taken}/${need} (${unit}E each)`
  },
  coreSlotsNoneVillage: { ja: "村の依頼は、プレイヤーごと・日ごとに違う品目・量で出ます(スタッフサービスの「村からのクエスト」で確認できます)。", en: "Requests differ per player and per day (see Staff Service -> Village Quests)." },
  coreSlotsNoneCompany: { ja: "きょうの依頼はありません(在庫が目標に達しています)。", en: "No requests today (stock has reached the targets)." },
  coreOrderLine: {
    ja: (who, item, qty, reward, done) => `・${who}: ${item} x${qty}(${reward}E) ${done ? "§a納品済み§r" : "§e受注中§r"}`,
    en: (who, item, qty, reward, done) => `- ${who}: ${item} x${qty} (${reward}E) ${done ? "§adelivered§r" : "§eclaimed§r"}`
  },
  coreOrdersTitle: { ja: "依頼・受注の状況", en: "Requests and Orders" },
  coreOrdersBodyVillage: {
    ja: (today, orders, cash, reserved) => `§lきょうの必要数§r\n${today}\n\n§l受注の一覧§r\n${orders}\n\n村の資金: ${cash} E(受注で予約済み ${reserved} E)\n§7住民の人数に応じて、プレイヤーごとに毎日3品目の依頼が決まります。`,
    en: (today, orders, cash, reserved) => `§lToday's needs§r\n${today}\n\n§lOrders§r\n${orders}\n\nVillage funds: ${cash} E (${reserved} E reserved for claimed orders)\n§7Each day the village asks every player for 3 items, in proportion to its residents.`
  },
  coreRequestsBodyCompany: {
    ja: (today, orders) => `§lきょうの自動依頼(足りない原料)§r\n${today}\n\n§l受注の一覧§r\n${orders}`,
    en: (today, orders) => `§lToday's automatic requests (missing materials)§r\n${today}\n\n§lOrders§r\n${orders}`
  },
  coreContractLine: {
    ja: (who, genre, daysLeft, item, count) => `・${who}: ${genre}(${daysLeft > 0 ? `あと${daysLeft}日` : "完了待ち"}) ${item} x${count}`,
    en: (who, genre, daysLeft, item, count) => `- ${who}: ${genre} (${daysLeft > 0 ? `${daysLeft} day(s) left` : "ready"}) ${item} x${count}`
  },
  coreContractLogLine: {
    ja: (who, genre, days, result, item, count) => `・${who}: ${genre} ${days}日 → ${result === "delivered" ? `${item} x${count} 入荷` : result === "accident" ? "事故(産出なし)" : "産出なし"}`,
    en: (who, genre, days, result, item, count) => `- ${who}: ${genre} ${days}d -> ${result === "delivered" ? `${item} x${count} received` : result === "accident" ? "accident, no output" : "no output"}`
  },
  coreAcctTitle: { ja: "会計管理", en: "Accounting" },
  coreAcctBody: {
    ja: (cash, recv, holdings, liab, equity, weeks) => `現金 ${cash} E / 債権 ${recv} E / 現物 ${holdings} E\n負債 ${liab} E\n§l純資産 ${equity} E§r\n\n§l直近の週§r\n${weeks}`,
    en: (cash, recv, holdings, liab, equity, weeks) => `Cash ${cash} E / Receivables ${recv} E / Holdings ${holdings} E\nLiabilities ${liab} E\n§lNet worth ${equity} E§r\n\n§lRecent weeks§r\n${weeks}`
  },
  coreAcctWeekLine: {
    ja: (week, revenue, expense, net) => `・第${week}週: 収益 ${revenue} / 費用 ${expense} / 損益 ${net}`,
    en: (week, revenue, expense, net) => `- Week ${week}: revenue ${revenue} / expense ${expense} / net ${net}`
  },
  coreAcctNoWeeks: { ja: "まだ締めた週はありません。", en: "No weekly close yet." },
  coreAcctNoAccount: { ja: "口座が見つかりません。", en: "No account found." },

  // ------------------------------------------
  // スタッフサービスの欄(導入クエスト / 資格なし / 資格あり / 村 / 会社) — economy/tutorial-chain.js
  // ------------------------------------------
  laborStaffMenuBody: {
    ja: (max, active) => `掲示板を選んでください。\n同時に受けられるのは${max}件まで(いま${active}件)。`,
    en: (max, active) => `Choose a board.\nYou can hold up to ${max} quests at once (now ${active}).`
  },
  laborStaffBtnTutorial: {
    ja: (done, total) => `導入クエスト (${done}/${total})\nまずはここから`,
    en: (done, total) => `Introductory Quests (${done}/${total})\nStart here`
  },
  laborStaffBtnUnqualified: {
    ja: (active) => `資格なしの求人${active > 0 ? `  [受注中 ${active}]` : ""}\n誰でも受けられます`,
    en: (active) => `Open Jobs (no license)${active > 0 ? `  [Active ${active}]` : ""}\nAnyone can take these`
  },
  laborStaffBtnLicensed: {
    ja: (active) => `資格が必要な求人${active > 0 ? `  [受注中 ${active}]` : ""}\nネザー・水中・エンド`,
    en: (active) => `Licensed Jobs${active > 0 ? `  [Active ${active}]` : ""}\nNether, Underwater, End`
  },
  laborStaffBtnVillage: { ja: "村からのクエスト\n村の依頼の掲示板", en: "Village Quests\nRequests from villages" },
  laborStaffBtnCompany: { ja: "会社からのクエスト\n会社の依頼の掲示板", en: "Company Quests\nRequests from companies" },
  laborBoardTitleUnqualified: { ja: "資格なしの求人", en: "Open Jobs (no license)" },
  laborBoardTitleLicensed: { ja: "資格が必要な求人", en: "Licensed Jobs" },
  laborBoardTitleVillage: { ja: "村からのクエスト", en: "Village Quests" },
  laborBoardTitleCompany: { ja: "会社からのクエスト", en: "Company Quests" },
  laborBoardEmptyVillage: {
    ja: "いまのところ、村からの依頼はありません。\n§7村の依頼は、登録された村に住民がいると、毎日掲示されます。",
    en: "There are no requests from villages right now.\n§7Registered villages with residents post requests every day."
  },
  villageBoardBody: {
    ja: (max, active) => `村への納品の依頼です。依頼は人ごと・日ごとに変わります。同時に受けられるのは ${max} 件まで(いま ${active} 件)。\n数量を決めて受注し、書見台の近くのチェストに入れて納品します。代金は村の資金から払われます。`,
    en: (max, active) => `Deliveries to villages. Requests differ per player and per day. You can hold up to ${max} quests at once (now ${active}).\nPick a quantity, then put the goods in a chest near the lectern to deliver. Villages pay from their own funds.`
  },
  villageBoardClaimed: {
    ja: (title, itemName, count, reward) => `§a[受注中]§r ${title}\n${itemName} x${count} / ${reward}E`,
    en: (title, itemName, count, reward) => `§a[Claimed]§r ${title}\n${itemName} x${count} / ${reward}E`
  },
  villageBoardSlot: {
    ja: (village, dist, itemName, taken, need, unit) => `${village}(${dist}m)\n${itemName} 受注済み ${taken}/${need} 個 ・ 1個 ${unit}E`,
    en: (village, dist, itemName, taken, need, unit) => `${village} (${dist}m)\n${itemName} ordered ${taken}/${need} - ${unit}E each`
  },
  villageBoardSlotFull: {
    ja: (village, dist, itemName, taken, need) => `§7${village}(${dist}m)\n${itemName} 受注済み ${taken}/${need} 個 ・ 村の倉庫はいっぱい§r`,
    en: (village, dist, itemName, taken, need) => `§7${village} (${dist}m)\n${itemName} ordered ${taken}/${need} - the village storehouse is full§r`
  },
  villageBoardEntry: {
    ja: (name, dist, open, total, free) => `${name}(${dist}m)\n受けられる依頼 ${open}/${total} 品目 ・ 村の空き資金 ${free}E`,
    en: (name, dist, open, total, free) => `${name} (${dist}m)\nOpen requests ${open}/${total} - free funds ${free}E`
  },
  companyBoardEntry: {
    ja: (name, dist, open, total, free) => `${name}(${dist}m)\n受けられる依頼 ${open}/${total} 品目 ・ 会社の空き資金 ${free}E`,
    en: (name, dist, open, total, free) => `${name} (${dist}m)\nOpen requests ${open}/${total} - free funds ${free}E`
  },
  villageScreenBody: {
    ja: (dist, cash, reserved, free, max, active) => `この村が、きょうあなたに出している依頼です(距離 ${dist}m)。品目も量も、人ごと・日ごとに変わります。\n村の資金: ${cash}E(受注で予約済み ${reserved}E → 新しく約束できるのは ${free}E)\n§7村の資金で払える数までしか受けられません。資金は週の締めに開発銀行機構から補充されます。\n同時に受けられるのは ${max} 件まで(いま ${active} 件)。`,
    en: (dist, cash, reserved, free, max, active) => `Requests this village has for you today (${dist}m away). Items and amounts differ per player and per day.\nVillage funds: ${cash}E (${reserved}E reserved by claimed orders -> ${free}E can still be promised)\n§7You can only take what the village can pay for. Funds are topped up by the development bank at the weekly close.\nYou can hold up to ${max} quests at once (now ${active}).`
  },
  companyScreenBody: {
    ja: (dist, cash, reserved, free, max, active) => `この会社の、きょうの依頼です(距離 ${dist}m)。\n会社の資金: ${cash}E(受注で予約済み ${reserved}E → 新しく約束できるのは ${free}E)\n§7依頼が残っていても、会社の資金で払える数までしか受けられません。\n同時に受けられるのは ${max} 件まで(いま ${active} 件)。`,
    en: (dist, cash, reserved, free, max, active) => `Today's requests of this company (${dist}m away).\nCompany funds: ${cash}E (${reserved}E reserved by claimed orders -> ${free}E can still be promised)\n§7Even if a request remains, you can only take what the company can pay for.\nYou can hold up to ${max} quests at once (now ${active}).`
  },
  villageSlotRow: {
    ja: (item, taken, need, unit, state) => `${item} 受注済み ${taken}/${need} 個 ・ 1個 ${unit}E\n${state}`,
    en: (item, taken, need, unit, state) => `${item} ordered ${taken}/${need} - ${unit}E each\n${state}`
  },
  villageGoneMsg: { ja: "§eこの依頼は、発注元が無くなった(解散など)ため納品できません。放棄して構いません。品物は取られていません。", en: "§eThis order can no longer be delivered because the issuer is gone. You may abandon it; no items were taken." },
  villageStateCan: { ja: (n) => `§a今 ${n} 個まで受けられます§r`, en: (n) => `§aYou can take up to ${n} now§r` },
  villageStateFull: { ja: "§7きょうの分は受注済み§r", en: "§7Today's share taken§r" },
  companyStateFull: { ja: "§7会社の倉庫はいっぱい§r", en: "§7Storehouse full§r" },
  villageStateNoFunds: { ja: "§e資金が足りず受けられません§r", en: "§eNot enough funds§r" },
  villageSlotFullMsg: { ja: "§eこの品は、きょうのあなたの分は受注済みです。明日また新しい依頼が出ます。", en: "§eYou have already taken today's share of this item. New requests appear tomorrow." },
  villageNoFundsMsg: { ja: "§e村の資金が足りず、これ以上は受けられません。", en: "§eThe village cannot afford more orders right now." },
  villageAlreadyMsg: { ja: "§eこの村のこの品は、きょう既に受けています。", en: "§eYou have already taken this order from this village today." },
  villageOrderTitle: { ja: (village, itemName) => `${village}: ${itemName}`, en: (village, itemName) => `${village}: ${itemName}` },
  villageClaimedMsg: {
    ja: (village, itemName, count, reward) => `§a受注しました: ${village} へ ${itemName} x${count}(報酬 ${reward} E)。今週中に納品してください。`,
    en: (village, itemName, count, reward) => `§aOrder taken: ${itemName} x${count} for ${village} (${reward} E). Deliver within this week.`
  },
  villageOrderBody: {
    ja: (title, itemName, count, reward, hint) => `${title}\n${itemName} を ${count} 個納品\n報酬: ${reward} E(村の資金から)\n\n${hint}`,
    en: (title, itemName, count, reward, hint) => `${title}\nDeliver ${count} x ${itemName}\nReward: ${reward} E (from the village's funds)\n\n${hint}`
  },
  villageDeliverSuccess: { ja: (village, wage) => `§a納品完了！ ${village} から +${wage} E`, en: (village, wage) => `§aDelivered! +${wage} E from ${village}` },
  villageDeliverShortMsg: {
    ja: (village, wage, short) => `§e納品しました。${village} の資金が足りず、+${wage} E のみ(不足 ${short} E)`,
    en: (village, wage, short) => `§eDelivered, but ${village} could only pay +${wage} E (short by ${short} E)`
  },
  laborBoardEmptyCompany: {
    ja: "いまのところ、会社からの依頼はありません。\n§7会社は、工場や在庫で足りない原料(金の原石・ダイヤ・糸)を、自動で依頼に出します。",
    en: "There are no requests from companies right now.\n§7Companies automatically request raw materials they are short of (raw gold, diamonds, string)."
  },
  companyBoardBody: {
    ja: (max, active) => `会社の工場・在庫で足りない原料の依頼です。同時に受けられるのは ${max} 件まで(いま ${active} 件)。\n数量を決めて受注し、書見台の近くのチェストに入れて納品します。代金は会社の資金から払われます。`,
    en: (max, active) => `Raw materials companies are short of. You can hold up to ${max} quests at once (now ${active}).\nPick a quantity, then put the goods in a chest near the lectern to deliver. Companies pay from their own funds.`
  },
  companyBoardSlotFull: {
    ja: (name, dist, itemName, taken, need) => `§7${name}(${dist}m)\n${itemName} 受注済み ${taken}/${need} 個 ・ 会社の倉庫はいっぱい§r`,
    en: (name, dist, itemName, taken, need) => `§7${name} (${dist}m)\n${itemName} ordered ${taken}/${need} - the company's storehouse is full§r`
  },
  companySlotFullMsg: { ja: "§e会社の倉庫はいっぱいです。別の会社を探してください。", en: "§eThat company's storehouse is full. Try another company." },
  companyNoFundsMsg: { ja: "§e会社の資金が足りず、これ以上は受けられません。", en: "§eThe company cannot afford more orders right now." },
  tutorialTitle: { ja: (done, total) => `導入クエスト (${done}/${total})`, en: (done, total) => `Introductory Quests (${done}/${total})` },
  tutorialLineDone: { ja: (title) => `§a✔ ${title}§r`, en: (title) => `§a✔ ${title}§r` },
  tutorialLineNow: { ja: (title) => `§e▶ ${title}§r`, en: (title) => `§e▶ ${title}§r` },
  tutorialLineLater: { ja: (title) => `§7・ ${title}§r`, en: (title) => `§7- ${title}§r` },
  tutorialBoardBody: {
    ja: (max) =>
      `掲示板には、求人(クエスト)が日替わりで並びます。\n\n・「資格なしの求人」「資格が必要な求人」には、毎日それぞれ決まった仕事が掲示されます。全員が同じ掲示を見ます。\n・仕事を選んで「受注する」を押すと受注中になります。同時に受けられるのは${max}件までで、受注は受けた週の終わりまで有効です。\n・受注中の仕事をもう一度選ぶと、「納品する」か「放棄する」を選べます。\n・報酬は口座に振り込まれます。銀行の「入出金履歴」で、どこから振り込まれたか確認できます。\n\n読んだら報告してください。`,
    en: (max) =>
      `The board lists new jobs (quests) every day.\n\n- "Open Jobs" and "Licensed Jobs" each post a set job per day. Everyone sees the same board.\n- Pick a job and press Claim to take it. You can hold up to ${max} at once, and a claim lasts until the end of the week.\n- Select a claimed job again to Deliver or Abandon it.\n- Pay goes into your account. The bank's Account History shows who paid you.\n\nReport in once you have read this.`
  },
  tutorialDeliveryBody: {
    ja: "実際に仕事を1件、納品してみましょう。\n\n1. 「資格なしの求人」から仕事を1つ受注します。\n2. 必要な品物を、書見台の近くのチェスト・樽・シュルカーボックスに入れます。\n3. その仕事をもう一度選んで「納品する」を押します。\n\n納品できたら、ここに戻って報告してください。",
    en: "Let's deliver a real job.\n\n1. Claim a job from \"Open Jobs\".\n2. Put the required items in a chest, barrel or shulker box near the lectern.\n3. Select the job again and press Deliver.\n\nOnce it is delivered, come back here and report."
  },
  tutorialLicenseBody: {
    ja: "最後に、資格と派遣のしくみです。\n\n・ネザー・水中・エンドの仕事は、その場所で実際に作業してライセンスを取ると受けられます。進み具合は、ロックされた求人を選ぶと見られます。\n・「オーナーズクラブ」では、近くの村人を履歴書に登録して、施設に派遣できます。派遣先には HRMHRM の施設のほか、会社の施設も並びます。\n・「村からのクエスト」「会社からのクエスト」は、今後のアップデートで依頼が掲示されます。\n\n読んだら報告してください。これで導入クエストは完了です。",
    en: "Finally, licenses and dispatch.\n\n- Nether, Underwater and End jobs unlock once you earn the license by actually working there. Select a locked job to see your progress.\n- At the Owner's Club you can register nearby villagers as resumes and dispatch them to facilities: HRMHRM's, and companies' too.\n- \"Village Quests\" and \"Company Quests\" will be posted in a future update.\n\nReport in once you have read this. That completes the introductory quests."
  },
  tutorialStepDoneMsg: { ja: (title) => `§a導入クエスト「${title}」を完了しました。`, en: (title) => `§aCompleted the introductory quest "${title}".` },
  tutorialAllDoneMsg: { ja: "§a導入クエストをすべて完了しました。掲示板から仕事を選んでみましょう。", en: "§aYou finished all the introductory quests. Pick a job from the boards." },
  tutorialNotYetMsg: { ja: "§cまだ納品が確認できません。仕事を1件、納品してから報告してください。", en: "§cNo delivery found yet. Deliver one job, then report." }
};
