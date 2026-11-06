import { world, system } from "@minecraft/server";

// ==========================================
// 金融政策の仕組み / Monetary Policy Parameters  (dev/sketch/sketch-inflation-economy.md)
// ------------------------------------------
// 金利と開発銀行機構(dev-bank.js)の判断基準を「名前つきの設定値」として1か所で持ち、安全に変更できる入口を用意する。
// 将来のアプデで「プレイヤー同士の議論(投票など)でパラメータを変える」機能を入れる時は、その機能が
// setPolicyParam(key, value, { source: "vote:..." }) を呼ぶだけで済むようにしてある(この仕組みは決める人を知らない)。
// 今の変更手段は管理コマンドだけ: /scriptevent bmh:policy list | get <key> | set <key> <値> [force] | reset <key|all> | history [件数]
//
// 変更のルール(validatePolicyChange):
//   ・範囲(min〜max)  … 常に守る(force でも破れない)
//   ・1回の変更幅(maxStep) と 変更間隔(cooldownWeeks) … 通常は守る。force(管理者の緊急用)だけ破れる
//   ・パラメータ間の制約(constraints) … 常に守る。例: カード金利は、最も高いローン金利以上でなければならない
// 変更は履歴(直近50件)に残り、購読(subscribePolicyChange)で通知される(ニュース告知などに使える)。
// 値はワールドの動的プロパティ(bmh_policy_v1)に保存。インフレ指数の上限など「設計上の安全装置」は対象外。
// ==========================================

const POLICY_KEY = "bmh_policy_v1";
const HISTORY_MAX = 50;

// unit: "rate" = 週あたりの金利(小数。0.0006 = 0.06%) / "weeks" = 週数 / "base" = ベース単位のE(実際の金額は×掛率)
//        "count" = 件数・個数 / "days" = 日数 / "ratio" = 倍率
export const POLICY_PARAMS = {
  policy_rate: {
    unit: "rate",
    default: 0.0006, min: 0, max: 0.01, maxStep: 0.0003, cooldownWeeks: 1,
    label: { ja: "政策金利(週)", en: "Policy rate (weekly)" },
    desc: { ja: "預金金利の基準。ローン・カード・配当の金利もこれに連動する", en: "Base for deposit rate; loans, cards and dividends follow it" }
  },
  card_spread: {
    unit: "rate",
    default: 0.0024, min: 0, max: 0.02, maxStep: 0.0012, cooldownWeeks: 1,
    label: { ja: "カード金利の上乗せ(週)", en: "Card spread (weekly)" },
    desc: { ja: "カード(リボ)の金利 = 政策金利 + この上乗せ", en: "Card revolving rate = policy rate + this spread" }
  },
  loan_base_spread: {
    unit: "rate",
    default: 0.0004, min: 0, max: 0.01, maxStep: 0.0004, cooldownWeeks: 1,
    label: { ja: "ローン金利の基本上乗せ(週)", en: "Loan base spread (weekly)" },
    desc: { ja: "ローン(借入)の金利 = 政策金利 + 基本上乗せ + 難易度ごとの上乗せ − スコア割引", en: "Loan rate = policy + base spread + per-difficulty spread - score discount" }
  },
  loan_spread_per_difficulty: {
    unit: "rate",
    default: 0.0002, min: 0, max: 0.005, maxStep: 0.0002, cooldownWeeks: 1,
    label: { ja: "ローン金利の難易度ごとの上乗せ(週)", en: "Loan spread per difficulty (weekly)" },
    desc: { ja: "難易度1〜5(高額ほど高い)に掛かる上乗せ", en: "Added per difficulty level (1-5)" }
  },
  lender_margin_spread: {
    unit: "rate",
    default: 0.0004, min: 0, max: 0.01, maxStep: 0.0004, cooldownWeeks: 1,
    label: { ja: "融資(貸し手)の利幅(週)", en: "Lender margin (weekly)" },
    desc: { ja: "貸し倒れの見込みを織り込んだ上での貸し手の上乗せ", en: "Lender margin on top of default-risk pricing" }
  },
  dividend_spread: {
    unit: "rate",
    default: 0.0004, min: 0, max: 0.01, maxStep: 0.0004, cooldownWeeks: 1,
    label: { ja: "現金配当の上乗せ(週)", en: "Cash dividend spread (weekly)" },
    desc: { ja: "現金配当の週利 = 政策金利 + この上乗せ(日割りで1日1回受け取れる)", en: "Weekly dividend rate = policy rate + this spread (paid per daily claim)" }
  },
  // ---- 開発銀行機構(dev-bank.js)の判断基準 ----
  devbank_operating_weeks: {
    unit: "weeks", default: 4, min: 1, max: 26, maxStep: 2, cooldownWeeks: 1,
    label: { ja: "開発銀行: 運用に必要な資金の週数", en: "Development bank: operating funds (weeks)" },
    desc: { ja: "支給する「最低限の運用資金」= 直近の週あたり費用 × この週数", en: "Minimum operating funds granted = recent weekly expenses x this many weeks" }
  },
  devbank_grant_cap_base: {
    unit: "base", default: 200000, min: 0, max: 5000000, maxStep: 100000, cooldownWeeks: 1,
    label: { ja: "開発銀行: 1回の支給の上限(ベース単位E)", en: "Development bank: grant cap per decision (base E)" },
    desc: { ja: "支給額の上限。実際の金額は掛率を掛ける", en: "Upper limit of one grant; multiplied by the price level" }
  },
  devbank_min_sellable_base: {
    unit: "base", default: 500, min: 0, max: 100000, maxStep: 500, cooldownWeeks: 1,
    label: { ja: "開発銀行: 売却可能とみなす資産の最低額(ベース単位E)", en: "Development bank: minimum sellable assets (base E)" },
    desc: { ja: "申請元の現物資産の時価がこれ以上なら、申請を却下して資産を売却させる", en: "If the applicant's holdings are worth at least this, the application is rejected and assets are sold" }
  },
  // ---- 労働市場(クエスト・派遣) ----
  quest_max_active: {
    unit: "count", default: 2, min: 1, max: 10, maxStep: 1, cooldownWeeks: 1,
    label: { ja: "クエスト: 同時に受けられる件数", en: "Quests: max active per player" },
    desc: { ja: "1人が同時に受注できるクエストの数", en: "How many quests one player can have claimed at once" }
  },
  dispatch_output_ratio: {
    unit: "ratio", default: 1, min: 0.05, max: 5, maxStep: 0.25, cooldownWeeks: 1,
    label: { ja: "派遣: 産出係数", en: "Dispatch: output ratio" },
    desc: { ja: "施設の産出の価値 = 派遣の賃金 × 日数 × この係数(1で賃金と同額)", en: "Facility output value = dispatch wage x days x this ratio (1 = same as the wage)" }
  },
  resume_tenure_days: {
    unit: "days", default: 1095, min: 365, max: 3650, maxStep: 365, cooldownWeeks: 1,
    label: { ja: "派遣: 除名までの通算派遣日数", en: "Dispatch: tenure limit (days)" },
    desc: { ja: "村人の履歴書の通算派遣日数がこれに達すると除名(3年 = 1095日)", en: "A villager's resume is retired once its total dispatched days reach this (3 years = 1095 days)" }
  },
  pool_keep_per_item: {
    unit: "count", default: 640, min: 0, max: 100000, maxStep: 320, cooldownWeeks: 1,
    label: { ja: "プール: 品目ごとの保持数", en: "Pool: keep per item" },
    desc: { ja: "週の締めで、この数を超えた分だけを換金する", en: "At the weekly close, only the amount above this is converted to cash" }
  },
  pool_sale_ratio: {
    unit: "ratio", default: 1, min: 0.1, max: 1.5, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "プール: 換金の掛け率", en: "Pool: sale ratio" },
    desc: { ja: "換金額 = その時の売値(基準価格 × 掛率) × この掛け率", en: "Cash = current selling price (base price x price level) x this ratio" }
  },
  // ---- 村の入荷・出荷(village-demand.js) ----
  village_buy_ratio: {
    unit: "ratio", default: 1, min: 0.5, max: 1.5, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "村: 入荷の単価の掛け率", en: "Village: purchase price ratio" },
    desc: { ja: "村が納品物を買う1個の単価 = 基準価格 × 掛率 × この掛け率", en: "Unit price villages pay = base price x price level x this ratio" }
  },
  village_ship_ratio: {
    unit: "ratio", default: 0.8, min: 0.3, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "村: 出荷(市場売却)の掛け率", en: "Village: shipping (market sale) ratio" },
    desc: { ja: "村が加工品を売る単価 = 基準価格 × 掛率 × この掛け率。取引所の相場以下にすること", en: "Villages sell processed goods at base price x price level x this ratio" }
  },
  village_need_per_pop: {
    unit: "count", default: 2, min: 0.5, max: 32, maxStep: 1, cooldownWeeks: 1,
    label: { ja: "村: 人口1人あたりの1日の必要数(プレイヤー1人あたり)", en: "Village: daily need per resident (per player)" },
    desc: { ja: "プレイヤーごとの日ごとの必要数(枠) = 人口 × この値 × 品目の係数 × ばらつき。品目も量も、人ごと・日ごとに変わる", en: "Per-player daily need = population x this value x item weight x variation. Items and amounts differ per player and per day" }
  },
  village_items_per_day: {
    unit: "count", default: 3, min: 1, max: 6, maxStep: 1, cooldownWeeks: 1,
    label: { ja: "村: 1日に出す品目数", en: "Village: items requested per day" },
    desc: { ja: "村ごとに、毎日この数の品目の必要数を出す", en: "Number of items each village requests per day" }
  },
  company_buy_ratio: {
    unit: "ratio", default: 1, min: 0.5, max: 1.5, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "会社: 入荷(自動依頼)の単価の掛け率", en: "Company: purchase price ratio" },
    desc: { ja: "会社の自動依頼の単価 = 基準価格 × 掛率 × この掛け率", en: "Unit price of automatic company requests = base price x price level x this ratio" }
  },
  company_need_scale: {
    unit: "ratio", default: 1, min: 0.1, max: 4, maxStep: 0.5, cooldownWeeks: 1,
    label: { ja: "会社: 自動依頼の量の倍率", en: "Company: request volume scale" },
    desc: { ja: "会社の在庫の目標数(金の原石32・ダイヤ8・糸128)にかける倍率。足りない分だけ依頼になる", en: "Multiplier on each company's stock targets; only the shortfall is requested" }
  },
  convert_loss: {
    unit: "ratio", default: 0.8, min: 0.3, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "工場: 加工の変換比(損失込み)", en: "Factory: processing yield" },
    desc: { ja: "加工の出来高 = 変換表の数 × この値(切り捨て)。1にすると損失なし", en: "Output = recipe output x this value (rounded down)" }
  },
  // ---- 個人間ローン・送金(loan-market.js / transfer.js) ----
  loan_borrow_asset_ratio: {
    unit: "ratio", default: 0.5, min: 0.1, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "個人間ローン: 借りられる額の資産比", en: "P2P loans: borrow limit (share of assets)" },
    desc: { ja: "借入依頼の金額は、借り手の純資産(口座・外貨・株 − 借入。村・会社は純資産+在庫)のこの割合まで", en: "A request may be at most this share of the borrower's net assets (entities: equity + stock)" }
  },
  loan_lend_asset_ratio: {
    unit: "ratio", default: 0.5, min: 0.1, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "個人間ローン: 貸せる額の資産比", en: "P2P loans: lend limit (share of assets)" },
    desc: { ja: "貸す額は、貸し手の資産(口座・外貨・株)のこの割合まで。全財産を貸し込めない", en: "A lender may lend at most this share of their assets in one loan" }
  },
  loan_lend_grace_weeks: {
    unit: "weeks", default: 4, min: 0, max: 12, maxStep: 2, cooldownWeeks: 1,
    label: { ja: "個人間ローン: 貸付の猶予(週)", en: "P2P loans: lending grace (weeks)" },
    desc: { ja: "貸付の期間+この週数を過ぎても完了の知らせが無ければ、貸し倒れとして貸し手のスロットを空ける", en: "If a loan is not settled this many weeks after its term, it is written off and the lender's slot is freed" }
  },
  transfer_fee_rate: {
    unit: "ratio", default: 0.02, min: 0, max: 0.1, maxStep: 0.01, cooldownWeeks: 1,
    label: { ja: "送金: 手数料の割合", en: "Transfer: fee rate" },
    desc: { ja: "送金額に対する手数料。送り主が上乗せで払い、HRMHRMの収益になる", en: "Fee on top of the amount sent, paid by the sender to HRMHRM" }
  },
  transfer_daily_cap_base: {
    unit: "base", default: 2000, min: 100, max: 100000, maxStep: 1000, cooldownWeeks: 1,
    label: { ja: "送金: 1日の上限(ベース単位E)", en: "Transfer: daily cap (base E)" },
    desc: { ja: "1人が1日に送れる合計。実際の金額は掛率を掛ける", en: "Total one player can send per day; multiplied by the price level" }
  },
  // ---- 法人・村(法人テンプレート。core-registry.js) ----
  company_reg_fee: {
    unit: "base", default: 15625, min: 0, max: 100000, maxStep: 5000, cooldownWeeks: 1,
    label: { ja: "法人: 会社の登録料(ベース単位E)", en: "Corporate: company registration fee (base E)" },
    desc: { ja: "会社を登記する料金。払い先はHRMHRM。返金なし。実際の金額は掛率を掛ける(15625 × 64 = 100万E)", en: "Fee to register a company, paid to HRMHRM, non-refundable. Multiplied by the price level" }
  },
  company_absent_days: {
    unit: "days", default: 30, min: 7, max: 120, maxStep: 7, cooldownWeeks: 1,
    label: { ja: "法人: 1人会社が消えるまでの不在日数", en: "Corporate: absent days before a one-person company is dissolved" },
    desc: { ja: "メンバーがいない会社の社長が、この日数を超えて不在だと強制解散になる", en: "A company with no members is force-dissolved once its president has been absent this long" }
  },
  exchange_listing_fee_rate: {
    unit: "ratio", default: 0.02, min: 0, max: 0.2, maxStep: 0.01, cooldownWeeks: 1,
    label: { ja: "取引所: 出品時の輸送費の割合", en: "Exchange: listing freight rate" },
    desc: { ja: "出品する時に、出品額(数量×単価)に対して出品者が払う輸送費。取引所の専用口座の収入になる(返金なし)", en: "Freight the seller pays when listing, as a share of the listing value. It goes to the exchange account (not refunded)" }
  },
  exchange_listing_days: {
    unit: "days", default: 14, min: 3, max: 60, maxStep: 7, cooldownWeeks: 1,
    label: { ja: "取引所: 出品の期限(日)", en: "Exchange: listing lifetime (days)" },
    desc: { ja: "売れ残った出品はこの日数で終わり、残りの品は出品者の取引所プールへ戻る", en: "Unsold listings end after this many days and the rest returns to the seller's exchange pool" }
  },
  exchange_max_listings: {
    unit: "count", default: 10, min: 1, max: 50, maxStep: 5, cooldownWeeks: 1,
    label: { ja: "取引所: 1人あたりの出品数の上限", en: "Exchange: max listings per seller" },
    desc: { ja: "1人が同時に出せる出品の数(値下げ競争や保存容量への対策)", en: "How many listings one player can have at once" }
  },
  exchange_entity_shipping: {
    unit: "count", default: 1, min: 0, max: 1, maxStep: 1, cooldownWeeks: 1,
    label: { ja: "取引所: 村・会社の出荷を出品にする(1=出品 / 0=従来の自動売却)", en: "Exchange: villages and companies ship by listing (1 = list, 0 = old auto-sale)" },
    desc: { ja: "1なら、村・会社が週の締めに出荷する品は、取引所に出品される(売れた代金がその口座に入る)。0なら、従来どおり相場以下で自動売却する", en: "1: goods that villages and companies ship at week close are listed on the exchange and the proceeds go to their account. 0: the old automatic sale below market" }
  },
  npc_company_enabled: {
    unit: "count", default: 1, min: 0, max: 1, maxStep: 1, cooldownWeeks: 1,
    label: { ja: "NPC会社: 稼働(1=稼働 / 0=冬眠)", en: "NPC companies: active (1 = active, 0 = hibernating)" },
    desc: { ja: "1なら、株式市場の各社(NPC会社)が毎日、原料を買って加工し、製品を取引所に出品する。0なら全社が冬眠する(株式だけが残る)。プレイヤーの会社が育ったら冬眠させる想定", en: "1: the stock-market NPC companies buy raw materials, process them and list products every day. 0: all hibernate (only the stock remains)" }
  },
  npc_price_ratio: {
    unit: "ratio", default: 0.9, min: 0.5, max: 1, maxStep: 0.05, cooldownWeeks: 1,
    label: { ja: "NPC会社: 製品の売値(HRMHRMの売値に対する掛け率)", en: "NPC companies: product price (ratio of HRMHRM's price)" },
    desc: { ja: "NPC会社の出品単価 = HRMHRMの売値 × この掛け率。原価を割る場合は出品しない", en: "NPC listing price = HRMHRM's price x this ratio. Not listed if below cost" }
  },
  npc_runs_per_day: {
    unit: "count", default: 16, min: 1, max: 128, maxStep: 8, cooldownWeeks: 1,
    label: { ja: "NPC会社: 1日の加工の回数(レシピごと)", en: "NPC companies: processing runs per day (per recipe)" },
    desc: { ja: "レシピごとに1日にこの回数まで加工する(原料が足りなければ、買えた分だけ)", en: "Each recipe runs up to this many times per day (as far as materials allow)" }
  },
  npc_startup_base: {
    unit: "base", default: 4000, min: 500, max: 50000, maxStep: 2000, cooldownWeeks: 1,
    label: { ja: "NPC会社: 開業の資金(ベース単位E)", en: "NPC companies: startup funds (base E)" },
    desc: { ja: "NPC会社の口座を作った最初の日に、開発銀行が支給する資金(×掛率)。以降の不足は、会社と同じ週次の申請になる", en: "Funds granted by the development bank on day one (x price level). After that, shortfalls follow the usual weekly application" }
  },
  hrmhrm_exchange_buy_ratio: {
    unit: "ratio", default: 0.9, min: 0, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "HRMHRM: 取引所での仕入れの単価(基準価格に対する掛け率)", en: "HRMHRM: exchange purchase price (ratio of base price)" },
    desc: { ja: "HRMHRMは、常設出品の在庫が足りない品を、取引所の出品からこの単価(基準価格 × 掛率 × この掛け率)まで買う。0で買わない", en: "HRMHRM buys items its standing stock lacks from exchange listings up to base price x price level x this ratio. 0 disables" }
  },
  hrmhrm_buy_budget_ratio: {
    unit: "ratio", default: 0.002, min: 0, max: 0.05, maxStep: 0.002, cooldownWeeks: 1,
    label: { ja: "HRMHRM: 取引所での仕入れの1日の予算(現金に対する割合)", en: "HRMHRM: daily exchange purchase budget (share of cash)" },
    desc: { ja: "HRMHRMが1日に取引所の仕入れに使える額 = HRMHRMの現金 × この割合。0で買わない", en: "Amount HRMHRM can spend on exchange purchases per day = its cash x this ratio. 0 disables" }
  },
  village_job_runs: {
    unit: "count", default: 16, min: 1, max: 128, maxStep: 8, cooldownWeeks: 1,
    label: { ja: "村: 職業ブロック1つの1日の加工回数", en: "Village: processing runs per job block per day" },
    desc: { ja: "村の範囲にある職業ブロック(堆肥箱・燻製器など)1つにつき、1日にこの回数まで加工できる(手工業の量)", en: "Each job block in the village range (composter, smoker, ...) can process this many times per day (hand-craft scale)" }
  },
  village_product_ratio: {
    unit: "ratio", default: 1.1, min: 0.8, max: 1.25, maxStep: 0.05, cooldownWeeks: 1,
    label: { ja: "村: 加工品の出品の掛け率", en: "Village: product listing ratio" },
    desc: { ja: "村が職業ブロックで作った品の出品単価 = 基準価格 × 掛率 × この掛け率。HRMHRMの売値(1.25倍)を超えない", en: "Listing price of goods a village makes with its job blocks = base x price level x this ratio. Never above HRMHRM's price" }
  },
  village_storehouse_cap: {
    unit: "count", default: 1024, min: 128, max: 16384, maxStep: 256, cooldownWeeks: 1,
    label: { ja: "村: 蔵の上限(総数)", en: "Village: storehouse cap (total items)" },
    desc: { ja: "村の蔵に入れられる品の総数。届け物を受け取るとき、これを超える分は受け取れない。蔵が上限の75%を超えると、村は「運んでよ」を出す", en: "Total items a village storehouse can hold. Deliveries that would exceed it are refused. Above 75% full, the village posts a carry request." }
  },
  village_specialty_per_pop: {
    unit: "ratio", default: 0.5, min: 0, max: 5, maxStep: 0.25, cooldownWeeks: 1,
    label: { ja: "村: 特産品の量(人口1人あたり)", en: "Village: specialty output per person" },
    desc: { ja: "村の地域タイプの特産品が、週の締めに生まれる量 = 人口 × この値 ×(品ごとの係数)。生まれた特産品は取引所へ出品される。0で止まる", en: "Weekly specialty goods of the village's region = population x this x per-item factor. They are listed on the Exchange. 0 turns it off." }
  },
  village_trade_budget_ratio: {
    unit: "ratio", default: 0.15, min: 0, max: 1, maxStep: 0.05, cooldownWeeks: 1,
    label: { ja: "村: 取引所での仕入れ(村同士の取引)の予算", en: "Village: exchange imports (village-to-village trade) budget" },
    desc: { ja: "週の締めに、村が地域の需要の品(例: 砂漠の村なら木と食料)を取引所で買う予算の、空き現金に対する割合。買った品は村の中で消費される。0で止まる", en: "Share of free cash a village spends at the weekly close buying goods its region needs (e.g. wood and food for a desert village) on the Exchange. Bought goods are consumed. 0 turns it off." }
  },
  village_barter_ratio: {
    unit: "ratio", default: 0.9, min: 0.5, max: 1, maxStep: 0.05, cooldownWeeks: 1,
    label: { ja: "村: 物々交換で村が渡す価値の割合", en: "Village: barter value ratio" },
    desc: { ja: "村の寄り合い所の物々交換で、村が渡す品の価値 = 受け取る品の価値(取引所の基準価格)× この割合。1より小さいほど村に有利", en: "In village barter, the value the village hands over = value received (exchange base price) x this ratio. Below 1 favors the village." }
  },
  village_buy_budget_ratio: {
    unit: "ratio", default: 0.3, min: 0, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "村: 取引所での原料の買いの予算(空き現金に対する割合)", en: "Village: exchange purchase budget (share of free cash)" },
    desc: { ja: "週の締めに、職業の原料の不足を取引所で買うときの上限。受注中のクエストの予約額を引いた現金のこの割合まで", en: "At the weekly close the village buys missing job inputs on the exchange up to this share of its free cash (after quest reservations)" }
  },
  company_ship_ratio: {
    unit: "ratio", default: 0.8, min: 0.3, max: 1, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "会社: 出荷(取引所への出品)の掛け率", en: "Company: shipping (exchange listing) ratio" },
    desc: { ja: "会社が在庫の余りを出品する単価 = 基準価格 × 掛率 × この掛け率。HRMHRMの売値(基準 × 1.25 × 掛率)以下にすること", en: "Companies list surplus stock at base price x price level x this ratio. Keep it below HRMHRM's price" }
  },
  exchange_hrmhrm_refill_ratio: {
    unit: "ratio", default: 0.25, min: 0.05, max: 1, maxStep: 0.25, cooldownWeeks: 1,
    label: { ja: "取引所: HRMHRMの常設出品の補充(1日あたり)", en: "Exchange: HRMHRM standing stock refill per day" },
    desc: { ja: "HRMHRMの常設出品は実在庫制。1日にこの割合(常設数に対して)ずつ補充される", en: "HRMHRM standing listings are real stock, refilled by this share of the standing amount per day" }
  },
  private_shulker_absent_days: {
    unit: "days", default: 60, min: 14, max: 365, maxStep: 14, cooldownWeeks: 1,
    label: { ja: "専用シュルカー: 登録が解除されるまでの不在日数", en: "Private shulker: absent days before the registration is released" },
    desc: { ja: "持ち主がこの日数を超えて不在だと、専用シュルカーの登録(保護)が解除される", en: "The registration (and its protection) is released once the owner has been away for longer than this" }
  },
  village_empty_weeks: {
    unit: "weeks", default: 4, min: 1, max: 26, maxStep: 2, cooldownWeeks: 1,
    label: { ja: "法人: 村の人口0が続く週数", en: "Corporate: weeks of zero population before a village is deregistered" },
    desc: { ja: "測れた日が全て人口0のまま、この週数が続くと村の登記を抹消する", en: "A village is deregistered once every measured day shows zero population for this many weeks" }
  },
  liquidation_ratio: {
    unit: "ratio", default: 0.65, min: 0.5, max: 0.8, maxStep: 0.05, cooldownWeeks: 1,
    label: { ja: "法人: 任意解散の資産買取率", en: "Corporate: bank buy rate on voluntary dissolution" },
    desc: { ja: "解散の清算で、銀行が現物資産を時価のこの割合で買い取る", en: "In a liquidation the bank buys physical assets at this fraction of market value" }
  },
  forced_liquidation_ratio: {
    unit: "ratio", default: 0.6, min: 0.5, max: 0.8, maxStep: 0.05, cooldownWeeks: 1,
    label: { ja: "法人: 強制解散の資産買取率", en: "Corporate: bank buy rate on forced dissolution" },
    desc: { ja: "強制解散の清算での買取率。任意解散の買取率以下にすること", en: "Buy rate in a forced dissolution; keep at or below the voluntary rate" }
  },
  dissolve_credit_penalty: {
    unit: "ratio", default: 0.2, min: 0, max: 0.5, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "法人: 任意解散の信用スコア減点(割合)", en: "Corporate: credit penalty on voluntary dissolution (fraction)" },
    desc: { ja: "社長の信用スコアを、現在値のこの割合だけ下げる", en: "Lowers the president's credit score by this fraction of the current value" }
  },
  forced_credit_penalty: {
    unit: "ratio", default: 0.4, min: 0, max: 0.8, maxStep: 0.1, cooldownWeeks: 1,
    label: { ja: "法人: 強制解散の信用スコア減点(割合)", en: "Corporate: credit penalty on forced dissolution (fraction)" },
    desc: { ja: "強制解散での減点。任意解散の減点以上にすること", en: "Credit penalty on forced dissolution; keep at or above the voluntary one" }
  },
  dissolve_cooldown_days: {
    unit: "days", default: 14, min: 0, max: 60, maxStep: 7, cooldownWeeks: 1,
    label: { ja: "法人: 任意解散後の再登録の待ち日数", en: "Corporate: re-registration wait after voluntary dissolution (days)" },
    desc: { ja: "任意解散した社長が、新しい会社を登記できるまでの日数", en: "Days before a president can register a new company after a voluntary dissolution" }
  },
  forced_cooldown_days: {
    unit: "days", default: 28, min: 0, max: 120, maxStep: 7, cooldownWeeks: 1,
    label: { ja: "法人: 強制解散後の再登録の待ち日数", en: "Corporate: re-registration wait after forced dissolution (days)" },
    desc: { ja: "強制解散された社長が、新しい会社を登記できるまでの日数", en: "Days before a president can register a new company after a forced dissolution" }
  }
};

// パラメータ間の制約。candidate は「変更後の全パラメータ値」。違反なら理由の文字列を返す。
const CONSTRAINTS = [
  {
    id: "card_covers_loans",
    check: (v) => v.card_spread >= v.loan_base_spread + 5 * v.loan_spread_per_difficulty - 1e-12,
    message: { ja: "カードの上乗せは、最も高いローンの上乗せ(基本+難易度5段階分)以上にしてください。", en: "Card spread must be at least the highest loan spread." }
  },
  // 原則: 任意解散のペナルティ < 強制解散のペナルティ(自分から畳んだほうが得になるように)
  {
    id: "forced_not_milder",
    check: (v) => v.forced_liquidation_ratio <= v.liquidation_ratio + 1e-12 && v.forced_credit_penalty >= v.dissolve_credit_penalty - 1e-12 && v.forced_cooldown_days >= v.dissolve_cooldown_days,
    message: { ja: "強制解散は、任意解散より軽くしないでください(買取率は同じか低く、信用の減点と待ち日数は同じか大きく)。", en: "Forced dissolution must not be milder than voluntary (buy rate equal or lower; credit penalty and wait equal or higher)." }
  }
];

function weekNow() {
  return Math.floor(world.getDay() / 7);
}

function emptyState() {
  return { v: 1, values: {}, lastChangeWeek: {}, history: [] };
}

function loadState() {
  const raw = world.getDynamicProperty(POLICY_KEY);
  if (typeof raw !== "string") return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1) return { ...emptyState(), ...parsed };
  } catch (e) {
    console.warn("[BeeMyHoney] policy: corrupted, using defaults: " + e);
  }
  return emptyState();
}

function saveState(state) {
  world.setDynamicProperty(POLICY_KEY, JSON.stringify(state));
}

export function getPolicyParam(key) {
  const def = POLICY_PARAMS[key];
  if (!def) throw new Error("policy: unknown parameter " + key);
  const v = loadState().values[key];
  // 保存値が壊れていたり範囲外なら、既定値に戻して使う(安全側)
  return typeof v === "number" && v >= def.min && v <= def.max ? v : def.default;
}

export function getPolicySnapshot() {
  const state = loadState();
  const out = {};
  for (const [key, def] of Object.entries(POLICY_PARAMS)) {
    const v = state.values[key];
    out[key] = typeof v === "number" && v >= def.min && v <= def.max ? v : def.default;
  }
  return out;
}

// 変更が通るかを調べる(実際には変更しない)。reason: unknown_key / not_a_number / out_of_range / step_too_large / cooldown / constraint
export function validatePolicyChange(key, value, { force = false } = {}) {
  const def = POLICY_PARAMS[key];
  if (!def) return { ok: false, reason: "unknown_key" };
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, reason: "not_a_number" };
  if (value < def.min || value > def.max) return { ok: false, reason: "out_of_range", min: def.min, max: def.max };

  const state = loadState();
  const snapshot = getPolicySnapshot();
  const current = snapshot[key];
  if (!force) {
    if (Math.abs(value - current) > def.maxStep + 1e-12) return { ok: false, reason: "step_too_large", maxStep: def.maxStep };
    const last = state.lastChangeWeek[key];
    if (typeof last === "number" && weekNow() - last < def.cooldownWeeks) {
      return { ok: false, reason: "cooldown", nextWeek: last + def.cooldownWeeks };
    }
  }
  const candidate = { ...snapshot, [key]: value };
  for (const c of CONSTRAINTS) {
    if (!c.check(candidate)) return { ok: false, reason: "constraint", constraint: c.id, message: c.message };
  }
  return { ok: true };
}

const listeners = [];
// 変更の通知を購読する。fn({ key, old, value, source, week })
export function subscribePolicyChange(fn) {
  listeners.push(fn);
}

// パラメータを変更する。source は変更した主体の名前("admin" / "vote:2026-10" など。履歴に残る)。
export function setPolicyParam(key, value, { source = "unknown", force = false, note = "" } = {}) {
  const check = validatePolicyChange(key, value, { force });
  if (!check.ok) return check;

  const state = loadState();
  const old = getPolicyParam(key);
  state.values[key] = value;
  state.lastChangeWeek[key] = weekNow();
  state.history.push({ week: weekNow(), day: world.getDay(), key, old, value, source, force, note });
  if (state.history.length > HISTORY_MAX) state.history.splice(0, state.history.length - HISTORY_MAX);
  saveState(state);
  for (const fn of listeners) {
    try { fn({ key, old, value, source, week: weekNow() }); } catch (e) { console.warn("[BeeMyHoney] policy listener: " + e); }
  }
  return { ok: true, key, old, value };
}

// 既定値に戻す(管理用。履歴に残り、間隔・幅の制限は受けない)。
export function resetPolicyParam(key, { source = "admin" } = {}) {
  const def = POLICY_PARAMS[key];
  if (!def) return { ok: false, reason: "unknown_key" };
  return setPolicyParam(key, def.default, { source, force: true, note: "reset" });
}

// 全パラメータを既定値に戻す(管理用)。既定値同士は制約を満たすので、1つずつ戻す時の順序問題(制約違反)が起きない。
export function resetAllPolicyParams({ source = "admin" } = {}) {
  const state = loadState();
  const snapshot = getPolicySnapshot();
  const changed = [];
  for (const [key, def] of Object.entries(POLICY_PARAMS)) {
    if (snapshot[key] === def.default) continue;
    state.history.push({ week: weekNow(), day: world.getDay(), key, old: snapshot[key], value: def.default, source, force: true, note: "reset all" });
    state.lastChangeWeek[key] = weekNow();
    changed.push({ key, old: snapshot[key], value: def.default });
  }
  state.values = {};
  if (state.history.length > HISTORY_MAX) state.history.splice(0, state.history.length - HISTORY_MAX);
  saveState(state);
  for (const c of changed) for (const fn of listeners) {
    try { fn({ ...c, source, week: weekNow() }); } catch (e) { console.warn("[BeeMyHoney] policy listener: " + e); }
  }
  return { ok: true, changed: changed.length };
}

export function getPolicyHistory(limit = 10) {
  return loadState().history.slice(-limit);
}

export function listPolicyParams() {
  const snap = getPolicySnapshot();
  return Object.entries(POLICY_PARAMS).map(([key, def]) => ({ key, value: snap[key], ...def }));
}

// ---- 管理用コマンド ----
function pct(v) {
  return (v * 100).toFixed(3) + "%";
}

function fmtParam(def, v) {
  if (def.unit === "weeks") return `${v}週`;
  if (def.unit === "base") return `${v}E(ベース)`;
  if (def.unit === "count") return `${v}件`;
  if (def.unit === "days") return `${v}日`;
  if (def.unit === "ratio") return `x${v}`;
  return pct(v);
}

function handleCommand(message) {
  const [cmd, a, b, c] = message.trim().split(/\s+/);
  switch (cmd) {
    case "list":
    case "":
    case undefined:
      return listPolicyParams().map((p) => `${p.key}: ${fmtParam(p, p.value)} (既定 ${fmtParam(p, p.default)} / 範囲 ${fmtParam(p, p.min)}〜${fmtParam(p, p.max)} / 1回 ±${fmtParam(p, p.maxStep)} / 間隔 ${p.cooldownWeeks}週)`).join("\n");
    case "get":
      return POLICY_PARAMS[a] ? `${a}: ${fmtParam(POLICY_PARAMS[a], getPolicyParam(a))}` : `unknown key: ${a}`;
    case "set": {
      const value = parseFloat(b);
      const r = setPolicyParam(a, value, { source: "admin", force: c === "force" });
      return r.ok ? `${a}: ${fmtParam(POLICY_PARAMS[a], r.old)} -> ${fmtParam(POLICY_PARAMS[a], r.value)}` : `rejected: ${r.reason}${r.message ? " - " + r.message.ja : ""}${r.maxStep ? " (maxStep " + r.maxStep + ")" : ""}${r.nextWeek ? " (next week " + r.nextWeek + ")" : ""}`;
    }
    case "reset": {
      if (a === "all") return `reset all: ${resetAllPolicyParams().changed} parameter(s) restored`;
      const r = resetPolicyParam(a);
      return r.ok ? `${a}: reset to ${fmtParam(POLICY_PARAMS[a], r.value)}` : `rejected: ${r.reason}`;
    }
    case "history":
      return getPolicyHistory(parseInt(a, 10) || 10).map((h) => `w${h.week} ${h.key}: ${fmtParam(POLICY_PARAMS[h.key] ?? {}, h.old)} -> ${fmtParam(POLICY_PARAMS[h.key] ?? {}, h.value)} by ${h.source}${h.force ? " (force)" : ""}`).join("\n") || "(no changes)";
    default:
      return "usage: list | get <key> | set <key> <value> [force] | reset <key|all> | history [n]";
  }
}

export function startPolicyScriptEvent() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:policy") return;
    const text = "[Policy]\n" + handleCommand(ev.message);
    const target = ev.sourceEntity;
    if (target && typeof target.sendMessage === "function") target.sendMessage(text);
    else console.warn("[BeeMyHoney] " + text);
  });
}


