# Changelog

All notable changes to Bee My Honey are listed here, newest first.

- **Stable release:** 0.3.3
- **Latest release:** 0.4.2

Versions 0.1.1 to 0.3.3 were summarized from the project's development notes. 0.3.2 was an internal snapshot and was never released.

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
