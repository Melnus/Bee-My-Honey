# Changelog

All notable changes to Bee My Honey are listed here, newest first.

- **Stable release:** 0.4.5
- **Latest release:** 0.5.3

Versions 0.1.1 to 0.3.3 were summarized from the project's development notes. 0.3.2 was an internal snapshot and was never released.

---

## 0.5.3(0.4.6-0.5.3)

### Added
- **Corporate template: villages and companies.** Hold a Glow Ink Sac and interact with a **bell** to register a village (free; name and head are random) or a **lodestone** to register a company (you choose the name, up to 10 characters). The registration creates an identity (6-character ID) with its own account. A company costs 15,625 x price level (about 1,000,000 E at the start), paid to HRMHRM and not refunded; one company per person. A village cannot overlap another village's area (+-64 blocks horizontally, +-32 vertically).
- **Management menu** (interact with the registered block): Personnel / Accounting / Facilities / Inventory / Contracts / Management. Personnel works now: a village shows its population (counted daily while a player is nearby); a company has a roster, applications, hire / decline, and leaving. While the president is offline, members can hire and decline on their behalf (nothing else). The other four buttons are placeholders.
- **Core blocks are locked.** A registered bell or lodestone cannot be broken and survives explosions; if something removes it (commands), it is restored within about 10 seconds. It becomes breakable again once the registration is dissolved.
- **Dissolution = liquidation.** Management -> Dissolve shows an estimate first: cash plus the bank's purchase of physical assets (65% of market value; 60% when forced), minus liabilities. Assets go to the bank (HRMHRM), not the market; a positive result is paid to the president; a shortfall becomes a loss for the bank. Dissolving a company costs the president 20% of their credit score and a 14-day wait before registering another (forced: 40% and 28 days). If the president is offline the payout and penalty are applied when they next log in.
- **Automatic dissolution.** A company with no members whose president has been away for 30 days, or a company with an open intervention case, is force-dissolved through the same liquidation. A village whose measured population stays at 0 for 4 weeks is deregistered (days with nobody nearby are not measured).
- **Virtual facilities, inventory and contracts.** Every company owns three virtual facilities (Farm, Mine, Factory) at no extra cost; they appear next to HRMHRM's as dispatch destinations in the Owners Club. Output from villagers dispatched to a company facility goes into that company's inventory. At each weekly close, whatever exceeds `pool_keep_per_item` of an item is sold at the current price into the company account. Management -> Inventory shows the stock; Contracts shows dispatches in progress and recent results (received / accident); Accounting shows cash, liabilities, net worth and the last four weeks. If a company dissolves, its stock is bought by the bank and a villager still dispatched there returns with no output ("facility closed"). Price engine: rotten flesh base set to 1/32E (matches the villager rate); registered potato, carrot, melon slice, sugar, bone meal (priced from the most efficient composter input), bread, pumpkin pie and cooked pork/chicken/cod/salmon. Company facilities never produce gold or diamond (only HRMHRM's mine does). Real-area facilities (the Facilities button) come in a later update.
- **Staff Service reorganized into boards.** Staff Service now opens a menu: **Introductory Quests** (a short chain that disappears when finished), **Open Jobs** (no license), **Licensed Jobs** (Nether / Underwater / End), **Village Quests** and **Company Quests** (separate boards; empty for now, requests arrive in a later update). Claimed quests stay pinned at the top of their own board, and the detail screens return to the board you came from.
- **Introductory quest chain.** 1) Your First Part-time Job (report in, receive one shulker box, as before), 2) How the Board Works, 3) Your First Delivery (finish one real delivery to report), 4) Licenses and Dispatch. Players who already have work history and have not started the chain never see it; players who only finished the first job in an earlier version continue from step 2. Steps live in a data table (`economy/tutorial-chain.js`).
- **Village requests (goods wanted by villages).** *Staff Service -> Village Quests* now lists today's needs for the nearest villages: each village requests 3 items a day (wheat, potatoes, carrots, melon, berries, raw meat/fish, saplings, sticks, feathers, wool, raw iron/copper, charcoal, bone meal, rotten flesh), in proportion to its population. Pick a quantity, deliver to a chest near the lectern, and the village pays from its own funds. When the day's quota is taken the board says the village storehouse is full. Prices do not move (no demand pressure); unit price = base price x price level x `village_buy_ratio`. A village can only accept orders it can afford (reserved funds are tracked).
- **Company requests.** *Staff Service -> Company Quests* lists what nearby companies are short of: raw gold (target 32), diamonds (8) and string (128) per company; only the shortfall is requested (stock above the target means no request). Same rules as village requests (quantity, reserved funds, storehouse-full). Raw gold feeds the company factory (raw gold -> gold ingots); diamonds and string go to company stock and are sold above the keep amount at the weekly close. New parameters `company_buy_ratio`, `company_need_scale`.
- **Village requests are now per player and per day.** Each player gets their own 3 items and amounts from each village (seeded by village, day and player), sized so one player can fill them; nobody can use up a village's whole list. The default `village_need_per_pop` is now 2 (per player). Company requests stay shared (they are based on the company's stock shortage).
- **Village and Company Quests are now two levels:** the board lists nearby villages (companies) with open requests and free funds; opening one shows today's needs with *ordered / needed* and how many you can take right now (limited by the village's funds), so a need that cannot be paid for is visible instead of looking like a bug.
- **Village management menu now works for villages.** Inventory shows the village stock and last week's processing and shipping; Contracts becomes today's needs and the list of orders with the village's funds. Company Contracts also lists today's automatic requests and orders. All items on the boards now have Japanese names.
- **Villages process and ship weekly.** At the weekly close, delivered goods are processed (wheat -> bread, raw meat/fish -> cooked, raw iron/copper -> ingots, saplings -> logs) with a loss (`convert_loss`) and sold below market (`village_ship_ratio`). Goods without a recipe (crops, rotten flesh) are consumed in the village. Nothing is produced without input.
- **Factories now process stock.** A dispatch to a factory (HRMHRM or company) is processing capacity: it uses raw materials from the facility's stock (HRMHRM pool / company stock) and does nothing when there are none. Raw gold becomes gold ingots only when raw gold was delivered. Farms and mines are unchanged.
- **New policy parameters:** `village_buy_ratio`, `village_ship_ratio`, `village_need_per_pop`, `village_items_per_day`, `convert_loss`. New ledger category `village_buy`.
- **Safety:** delivering to a village or company that has been dissolved is refused before any items are taken; a village or company keeps at most 300 order records.
- **Admin command** `/scriptevent bmh:core list | info <ID> | dissolve <ID> [forced] | purge confirm | fakeapply [name] | absent | present`.
- **New ledger categories:** `core_fee` (registration fee, counted as HRMHRM revenue) and `liquidation` (payout to the president).
- **New policy parameters:** `company_reg_fee`, `company_absent_days`, `village_empty_weeks`, `liquidation_ratio`, `forced_liquidation_ratio`, `dissolve_credit_penalty`, `forced_credit_penalty`, `dissolve_cooldown_days`, `forced_cooldown_days`. Forced dissolution can never be set milder than voluntary.

---
- 村・会社・村人の名前を日英対応: 村は作成時に日本語名と英語名(村長も)を同時に生成し、表示は閲覧者の言語に合わせる。会社の登録フォームは「自分の言語の名前」+「もう一方の言語の名前(任意)」で、重複は両方の名前で検査。村人も英語名を持つ。古いデータは日本語名から英語名を引く。(`i18n/names.js`)
- 借入依頼の掲示板: 「借りる」から「貸し手を募集する」を出せる(審査なし・条件は信用スコアで決まる)。依頼は「貸す」の候補に、個人・村・会社の依頼として並ぶ(下に窓口の融資希望者も残る)。引き受けられると、借り手に即入金。返済は週ごとに貸し手へ届く(貸し手がオフラインなら次のログインで届く)。依頼は掲示から7日以上たった最初の週の締めで消える。
- 村・会社の借入依頼: 自由に使える現金が目標準備金の2倍を下回ると、その日のうちに依頼を1件出す(最大2件まで借入)。毎週の締めで返済し、4週続けて払えないと貸倒れ(貸し手のスロットは空く)。依頼が消えても現金が運用の下限を割ったままなら、介入案件(loan_unfilled)として清算手続き(強制解散)へ進む。
- 村の解散: 残った現金はHRMHRMへ戻る(代表者へは払わない)。先に、借りているローンを残りの現金から貸し手へ返す。現物・在庫は従来どおりHRMHRMへ。
- 個人間の送金: 銀行→「送金する」。オンラインのプレイヤーへ送れる(手数料・1日の上限あり)。
- 台帳に p2p_lend / p2p_borrow / p2p_repay / p2p_return / transfer_out / transfer_in を追加(どれも市場グループ。発行でも回収でもない。HRMHRMの債権・負債には入らない)。
- 借入依頼・送金の制限と悪用対策: ①借りられる額は借り手の純資産(口座・外貨・株 − 借入)の半分まで、貸せる額は貸し手の資産の半分まで(`loan_borrow_asset_ratio` / `loan_lend_asset_ratio`)。依頼の一覧に借り手の資産が出る。②村・会社は、不足額をまず溜まっている在庫の物資を売って埋め(高い物から)、それでも足りない分だけを、資産の半分以内で依頼にする。③個人間ローンは、完済しても信用スコアが上がらない(サブ垢との貸し借りでの水増し対策)。④個人間の貸付は、期間+4週(`loan_lend_grace_weeks`)を過ぎても完了の知らせが無ければ貸し倒れで閉じ、貸し手のスロットが固まらない。完了通知は貸付ごとのID(lid)で照合し、別の貸付を閉じない。⑤送金は手数料2%(送り主が上乗せ。HRMHRMの収益 = 台帳 transfer_fee)と、1人1日2000E(ベース)の上限(`transfer_fee_rate` / `transfer_daily_cap_base`)。
- 依頼IDを増え続ける番号に変更(掲示が空になっても再利用しない)。
- 長期不在・改名への備え: 村・会社の注文の照合をプレイヤーIDで行う(ゲーマータグを変えても、受けた注文を納品できる。古い注文は名前で照合)。期限切れの注文は、まだ片付いていなくても予約額に数えない(誰も来ない村・会社で資金が固まらず、不足の判定も狂わない)。貸し手の郵便受けが溢れても、受け取るお金は残る通知へ合算して失わない。

## 0.4.5

### Added
- **Loan management.** Bank -> Loan Window -> "Loan Management" shows your borrowing (balance, principal, interest, weekly payment, weeks left) and lending. While you owe money you can repay early: with the toggle off you repay only the principal (the remaining interest follows the weekly schedule and the weekly payment drops); with it on you repay everything including interest and close the loan. Loans taken before this version have no principal record, so "principal only" repays the whole balance.
- **Account history.** Bank -> "Account History" lists your last 30 deposits and withdrawals (date, amount, reason, and the counterparty where known, e.g. "from HRMHRM Partners HLD"). Weekly deposit interest is merged into one line per week.
- **Quest board.** The Staff Services board now shows the same 4 quests for everyone each day (one per category: unlicensed, Nether, Underwater, End; licensed categories are locked until you hold the license). Select a quest to claim it; select it again to deliver or abandon. Claimed quests stay in your list after the board rotates and expire at the end of the week you claimed them. Quest details show who has claimed it (HRMHRM quests can be claimed by everyone). You can hold `quest_max_active` quests at once (default 2). Rewards are paid to your account and appear in the history as coming from HRMHRM.
- **First part-time job.** The first time you open Staff Services with no work history, the board shows a one-off "Your First Part-time Job" at the top. It explains how the board works; press Report and you receive one shulker box (no items to deliver, and it does not count toward `quest_max_active`). Players who already have quests, villagers or license progress never see it.
- **Dispatch to facilities.** Owners Club dispatch now sends the resume to a facility: choose a type (Farm / Mine / Factory) -> operator -> days. The output (item and amount) is fixed at contract time: wage x days x `dispatch_output_ratio` (default 1) divided by the item's base price. When you collect, the goods go to the facility's output (HRMHRM's three facilities feed HRMHRM's pool). Player-company facilities are planned.
- **Pool settlement.** At the end of each week HRMHRM converts the part of each pooled item above `pool_keep_per_item` (default 640) into cash at the current selling price (`pool_sale_ratio`, default 1) and counts it as revenue. `/scriptevent bmh:account` now also lists the pool.
- **Resume retirement.** A villager's resume is retired automatically once its total dispatched days reach `resume_tenure_days` (default 1095 = 3 years). There is no manual dismissal.
- **New policy parameters** (`/scriptevent bmh:policy`): `quest_max_active`, `dispatch_output_ratio`, `resume_tenure_days`, `pool_keep_per_item`, `pool_sale_ratio`.

### Changed
- Daily quests are no longer generated per player with random numbers; the board is derived from the date, so everyone sees the same quests. Progress on the previous per-player daily quests is not carried over (at most one day).

---

## 0.4.3 (unreleased)

### Changed
- **Development Bank Authority.** An independent institution now reviews funding applications from any account-holding entity (HRMHRM today; villages and companies later, using the same account template and operations). If the applicant holds sellable assets the application is rejected and the assets are sold (non-precious first, precious metals last); otherwise the bank grants the minimum operating funds (recent weekly expenses x 4 weeks, capped). Entities no longer sell their own assets when short of cash; they apply. The bank's criteria are policy parameters (`devbank_*`) so players can adjust them in a future update. `/scriptevent bmh:devbank` shows its decisions.
- **HRMHRM accounting and autopilot.** HRMHRM now has an entity account (cash, receivables, liabilities, holdings) with mark-to-market valuation of precious metals (gold and diamond), closed at the end of every week from the emerald ledger. When cash runs low it applies to the Development Bank Authority (below) instead of selling assets itself; with surplus cash it buys precious metals. The account template also supports villages and companies, with the intervention rule: unsettled for more than 3 weeks -> a village with no population is deregistered, otherwise HRMHRM intervenes. Operators can view it with `/scriptevent bmh:account`.
- **Monetary policy parameters (groundwork).** Interest-related settings (policy rate, card/loan/lender/dividend spreads) are now named parameters with limits (range, maximum step, one change per week, cross-parameter constraints), a change history and change notifications, so a future player-discussion feature can adjust them. Operators can use `/scriptevent bmh:policy list|get|set|reset|history`. Nothing changes by default.
- **Card, Prime and dividend rebalanced.** Card minimum payments are 2% of the limit per week (was 6-12%), Skein Prime Standard is 6 (base units) per week (was 15), and KelpLife's cash dividend follows the policy rate (about 0.10% per week, was 5% per day).
- **Interest rates now follow a policy rate.** Deposit 0.06%/week, loans 0.12-0.20%/week (by difficulty, with a credit-score discount), card revolving 0.30%/week (about 15.6%/year). The previous 1.5% / 2-8% / 3% weekly rates were 30-60x the new inflation level. Lending to NPC borrowers now prices in default risk (repay probability 0.80-0.99) and pays simple interest for the contract term.
- **Insurance payouts raised.** Each payout is now worth 4x the weekly premium at base prices (Maritime: 80 iron ingots, Catch: 92 dried kelp, Seabed Asset: 76 gold ingots).
- **Existing worlds are converted automatically.** On a player's first login after updating, stored amounts (bank balance, loans, card, lent principal, stock/forex/futures cost basis, consultant margin) are multiplied once by the price level so wealth measured in days of labor is unchanged. Worlds that already ran this version are left alone.
- **Automatic inflation index.** At the end of each in-game week the price index (see "Price level") rises by up to 0.05% (about 0.2% per 4 weeks), driven by net emeralds issued per active player (wages, interest, credit) from the ledger. It never decreases and stays frozen in weeks with no activity. Missed weeks are caught up from the ledger when the world resumes.
- **Price level (x64).** All market prices, shop prices and nominal amounts (wages, fees, premiums, loan/card limits, margins, thresholds) are now `base x 64 x inflation index`, applied when read (`economy/price-level.js`). The inflation index starts at 1.0 and can be set by operators with `/scriptevent bmh:pricelevel [index]`; it is not yet driven automatically. Amounts fixed at contract time (quest rewards, loans, card limits) keep their nominal value. The "bundle small items up to 4E" rule in mail order was removed (no longer needed at x64).
- **Quantity input is now a text field.** The +/-10/50/100 step buttons in forex, stock, futures and bank deposit/withdraw are replaced by a number field with an "all (maximum)" toggle, followed by the usual confirmation screen (which also has "change quantity" and "use maximum" buttons). Invalid or out-of-range input shows a message and reopens the field.
- **Emerald ledger.** Every change to a player's bank-account emeralds (wages, interest, loans, dividends, market trades, fees, deposits/withdrawals) now goes through `economy/ledger.js`, which records weekly in/out totals per category. Operators can view it with `/scriptevent bmh:ledger [weeks]`. This is the groundwork for activity-driven inflation (see `dev/sketch/sketch-inflation-economy.md`); it does not change any gameplay or prices by itself.
- **Unified pricing engine applied to every shop.** Prices are now derived from a single cost model (village minimum wage 10E/day -> per-item labor cost -> recursive recipe cost, x1.20 base price) instead of hand-picked numbers (see `dev/pricing-guide.md`, `dev/pricing-settings.md`).
  - Bulk/commodity base rates recomputed (e.g. Diamond 12E -> 1.5E, Cobblestone 0.05E -> 0.19E). Small-lot prices keep 3 decimals.
  - Mob trading and Paws & Blackpots now sell in lots (e.g. 32 Coal per purchase) because foreign currency units are coarser than most items' prices.
  - Mail order: all 161 catalog prices recalculated at base price x1.25 (the daily bargain's 20% off returns to base price). HRMHRM standing stock per category is defined for the future exchange.
- **Staff Services wages recalculated from a documented baseline.** Previously the wage ranges were picked without a stated rationale, and the three qualified-license jobs (Nether/Underwater/End) all shared the same 150-400E range regardless of environment. Wages are now derived from vanilla villager trade rates (see `dev/sketch/village-baseline.md`): unqualified jobs pay villager-equivalent profit plus a flat 10E labor fee (and a 4E hazard allowance for Escort Duty's gear wear), landing around 10-17E instead of 4-14E. Qualified jobs now scale by environment severity instead of a flat range: Underwater 14-17E, Nether 18-22E, End 22-26E (down from a flat 150-400E for all three).

---

## 0.4.2 - 2026-09-29 (latest)

### Fixed
- **Food never rotted in the inventory.** Bedrock does not allow dynamic properties on stackable items (`Cannot set dynamic properties on stackable items`), and the 0.4.0 freshness system stored each stack's age that way. The write failed every time, so the age was reset on every scan and stackable food (fish, meat, crops, cooked food) never spoiled. Only non-stackable items could age.
  - The freshness stamp (accumulated age and last-seen day) is now stored inside the item's lore, appended as invisible color codes to the "Freshness: XX%" line. Stackable food now ages correctly and food picked up on the same day still stacks.
  - The `bmh:food_age` and `bmh:food_info` debug commands work again on stackable food.
  - Stamps written by the 0.4.0 method (on non-stackable items only) are still read, so nothing is lost.
- Corrected a stale comment in `main.js` that described the inventory scan as running "every 3 days". It runs every 5 seconds.

### Changed
- Cake, cookies, pumpkin pie, golden apples and golden carrots no longer spoil. They join sugar, honey items, potions and the currency fruits (apple, sweet berries, glow berries, popped chorus fruit) on the never-spoil list.
- Manifest version raised to 0.4.2.

---

## 0.4.0

### Added
- **Bulk commodity trading (General resources).** The golem's menu is now split into "Rare resources" (small-lot, as before) and "General resources" (traded one shulker box at a time). Buying delivers a full shulker box (1,728 items) into an empty placed shulker box nearby; selling takes a full one.
  - New commodities: Cobblestone, Iron Ingot, Copper Ingot, Glass, the eight log types (oak, spruce, birch, jungle, acacia, dark oak, cherry, mangrove), Dirt, Sand, Gravel and Clay (bulk), plus Nether Quartz and Redstone (small-lot).
  - Bulk trades have their own demand-pressure pool, separate from small-lot trades, so one shulker box no longer moves small-lot prices.
  - Until company/corporate status exists, a single trade is capped at one shulker box.
- **Paws & Blackpots (energy shop).** Reached from the Apple (APL) window. Buy and sell Coal, Charcoal, Blaze Rods and Lava Buckets for APL. Stock is real: coal and charcoal restock daily up to 100, blaze rods and lava buckets never restock, and buying the Nether items needs the Nether license. Daily random prices ("the cat's mood") with discounts for petting the cat and gifting cod or salmon. Selling pays 60% of the day's price. Stock is tracked with the new `trade-pool` module (shop type).
- **Fresh Market.** Reached from the Glow Berry (GLB) window. An anonymous, player-supplied order board for food in four genres (Seafood, Meat, Produce, Dairy & Eggs), priced in GLB. Each item has a price-history chart and a cheapest-first listing. Delivery suggests a price range from the region tag of where you deliver (coastal, inland, remote), and you set the final price. Listings decay with freshness and expire. Runs on the `trade-pool` module (exchange type).
- **Food freshness (inventory).** Perishable food in the inventory and off-hand spoils into Rotten Flesh: about 6 in-game days for raw food and 12 for processed food. The timer starts when the food is picked up, does not run inside containers, and is not affected by sleeping or time changes (it counts real world ticks). The item description shows a freshness percentage and a warning shortly before it rots. Food from the same day stacks as usual, and stacks of different ages are merged only when that frees a slot. Debug commands: `/scriptevent bmh:food_info` and `/scriptevent bmh:food_age [days]`.
- **Tag dictionary** (`genre:*`, `region:*`) and **item dictionary** modules for classifying trade goods across price, genre, freshness and display name.
- **Trade pool** module for stock-based trading.

### Changed
- The window buttons in the animal-trading menu are now driven by a button list, so each currency window can add its own extra entrance.

### Fixed
- A hard-coded label in the futures menu was moved to the string table.
- The skill-edit text field in the labor menu now passes its default value through the options object, as the newer UI API expects.

---

## 0.3.3 - stable

### Changed
- All remaining hard-coded Japanese/English strings (labor market, insurance, futures, mail order, wallet admin settings, golem trade messages) were moved into the central string table. The local translation helper in the labor menu was removed.
- Labor-market quest items and license biome names are now defined in one place.
- The stock button shows the stock count dynamically instead of a fixed number.
- The main menu module was renamed to `trading-menu`.
- Stock icon colors for HRMHRM and sunflower futures changed from yellow to gold.

### Fixed
- Undefined-reference warnings in the stock menu were removed.
- The unused `script_eval` permission was removed from the manifest.

### Removed
- An unused stub module for the future peer-to-peer market.

---

## 0.3.1

### Security
- Fixed a signature-forging weakness in the cold wallet. The hard-coded salt was replaced by a random per-world secret. Carrying a wallet into another world is now an operator-only option.
- Fixed a server-load problem when handing out large numbers of items: items are now given in batches spread over several ticks, with a per-trade cap.
- Fixed a loan-interest bug: the contract's length in weeks was not stored, so maturity interest was always calculated for one week.

### Added
- **Labor market** (HRMHRM Partners HLD, opened from a lectern with a book): staff-service daily quests (delivered by container), a license system that measures real progress (placing/breaking blocks in the Nether, underwater and the End), consultant service (villager leasing), and the Owners' Club (register and dispatch villagers as resumes, 128 maximum).
- HRMHRM Partners HLD stock (HRM), which pays a new stock-option type of dividend whenever the labor market generates work.
- Demand-pressure pricing: buying and selling through the exchange moves prices by up to ±60%, decaying daily. Applies to forex, stocks and physical assets.

### Changed
- Golem physical-asset trades now use the same shared item-giving routine as everything else.

---

## 0.3.0

### Added
- **Loans:** five tiers with credit-score-based screening and interest.
- **Credit score** (300-850) shared by loans, credit cards, insurance and bankruptcy handling.
- **Insurance:** marine, fishing-catch and undersea-asset policies (Bone Block + Flower Pot).
- **Mail order (Skein)** and **credit card:** a catalog shop opened from a lectern with paper, revolving installments, daily specials, and a Prime-style subscription.
- Flower futures expanded from one contract to five (Rose, Allium, Jade Orchid, Sunflower, Sakura), with multiple lots and prices tied to the weekly patterns.
- Redesigned bank screen (+/- quantity dialog, link to the loan desk).
- Two new stocks: Skein (SKN) and KelpLife Holdings (KLH, cash dividend).
- Cash dividends (paid straight into the balance as emeralds).
- An item-catalog module for variant items (saplings, colors and so on).

### Changed
- Diamond, gold and lapis blocks now count as nine units when trading.
- Golem and animal-trade purchases now drop at your feet.
- Price movement changed from a sine curve to four shuffled weekly pattern tables shared by stocks, forex and futures.
- Enchanted items can now be granted (used by the mail-order book category).
- The weekly reset now handles loan repayment, card billing and insurance premiums.
- About 60 localized strings added or updated.

---

## 0.2.2

### Changed
- Expanded the foreign-currency forex system.

### Added
- Wandering Trader summoning (`trader/wandering-trader.js`): the trader is tethered near where it was called.

---

## 0.1.1 - initial release

- Five forex currencies, five stocks, flower futures (single contract) and the cold wallet (story-code method).
- Japanese translation of the readme added.


