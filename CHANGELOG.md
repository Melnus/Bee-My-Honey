# Changelog

All notable changes to Bee My Honey are listed here, newest first.

- **Stable release:** 0.3.3
- **Latest release:** 0.4.5

Versions 0.1.1 to 0.3.3 were summarized from the project's development notes. 0.3.2 was an internal snapshot and was never released.

---

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


