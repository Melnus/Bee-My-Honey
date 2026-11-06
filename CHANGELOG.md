# Changelog

All notable changes to Bee My Honey are listed here, newest first.

- **Stable release:** 0.4.5
- **Latest release:** 0.6.10

Versions 0.1.1 to 0.3.3 were summarized from the project's development notes. 0.3.2 was an internal snapshot and was never released.

---

## 0.6.10

### Fixed
- **Victory Day was never registered.** The Hero of the Village effect id on Bedrock is `village_hero`, not Java's `hero_of_the_village`, so winning a raid was never detected and the yearly hero grant could not be applied either. Both ids are now checked and applied. If you still have the effect from a recent raid (about 40 minutes), the next patrol registers the day.

---

## 0.6.9

### Added
- **View the calendar** (ticket: calendar view).
  - Admin command `/scriptevent bmh:calendar`: prints today's date, whether Victory Day and Villagers' Day are registered (with the recorded day, in both Queen's Era and world-day form), and the next anniversary.
  - Exchange menu, new button "View the calendar": today's date, the three fixed festivals with days until each, and whether today is one.
  - Head's Room, new button "View the calendar": Victory Day and Villagers' Day (registered date or "not registered"), whether today is an anniversary, and whether a gift can be claimed. Victory Day sits here because it is a village-defence record; the data is still world-wide, not per village. Villagers' Day is labelled as the day a patrol first saw 20+ villagers.
  - The calendar shows the recorded day itself, even though a world anniversary only becomes a celebration from the year after it was recorded.
- **Village-to-village trade** (provisional). At the weekly close a village buys the goods its region needs most (those with a demand weight of 2 or more, other than its own specialties; e.g. wood and food for a desert village, fuel for a snowy one) from the Exchange, spending up to `village_trade_budget_ratio` (default 0.15) of its free cash after job-input purchases. Bought goods are consumed, not stored, so there is no buy-and-resell loop. This gives other villages' and players' listings a buyer; the Storehouse Keeper shows what was bought last week. A village never buys its own listings.
- New policy parameter `village_trade_budget_ratio` (0 turns it off).

---

## 0.6.8

### Fixed
- The region block in the Head's Room no longer shows a missing-glyph box between "Suited to" and "Storehouse cap" (a full-width space the game font lacks; now a line break).

---

## 0.6.7

### Added
- **Village regions** (ticket B, specialty step). Each village is one of six types, decided once from the biome at its bell (fine biome types are ignored; unknown or unreadable counts as Plains and is retried): Plains (standard), Desert (importer), Savanna (livestock), Taiga (hunting and forestry), Snowy (stockpiler), Coastal (trade-dependent).
  - **Specialty goods**: every week the village makes goods in proportion to its population and lists them on the Exchange (Plains: wheat, bread; Desert: sand, glass, cactus; Savanna: acacia logs, leather, beef; Taiga: spruce logs, sweet berries; Snowy: rabbit, rabbit hide, salmon; Coastal: cod, kelp, sea pickles, ink sacs). Ice, snow, sandstone, prismarine and coral are not on the trade list yet, so they are not included.
  - **Daily needs lean by region**: Desert wants food and wood, Savanna wants grain, Taiga wants fuel and metal, Snowy wants fuel a lot, Coastal wants food, wood, fuel and metal. Plains is unchanged.
  - **Storehouse cap**: Snowy villages hold double.
  - The Head's Room shows the region, specialties, the suited job block (display only) and the cap.
- New policy parameter `village_specialty_per_pop` (default 0.5; 0 turns specialty goods off).

---

## 0.6.6

### Fixed
- **Job-block detection never worked on a real device** (ticket 1). Two bugs stacked: the count used `getCapacity()` (which returns the box volume, not the number of matches), and a box that reached into unloaded chunks threw an error that was swallowed silently, so nothing was ever recorded. Now:
  - The scan is split into chunk-sized boxes. Unloaded boxes are skipped; the rest are counted by iterating the matches. If nothing is loaded the scan reports failure (and logs it).
  - A partial scan never lowers the previous record; a village keeps what it saw before.
  - The scan no longer depends on the population check: until it succeeds for the day it is retried on later patrols (at most every 30 seconds per village, only while a player is nearby). Failures are logged.
- **Job blocks without recipes are listed** (ticket 2). Loom, stonecutter, cartography table, lectern, brewing stand, cauldron, grindstone and smithing table now show in "ask about the work" with "makes nothing for now". The "none yet" text appears only when no job block is detected at all.
- **Barter respects the order cap** (ticket 3). Barter prunes old orders and refuses when the 300-order cap is reached, like normal orders. The village record is saved before the goods change hands; if saving fails, the swap is cancelled and your item is returned.
- **Head's Room shows the recorded population** (ticket 4), the same number the rest of the economy uses. The adults/children split is gone.

### Added
- **Queen's Calendar** (shown in the Exchange and e-trading menus, not the HUD): no leap years, 3 weeks (21 days) = 1 month, 12 months = 1 year. Dates read "Queen's Era year/month/day".
- **Anniversaries**: Relief Festival (3/21), Genesis Festival (5/17), Harvest Festival (10/7), plus world-specific Victory Day (the day a Hero of the Village was first obtained; on that date every player gets Hero of the Village) and Villagers' Day (the day a village first reached 20 villagers). The village menu shows them with a small gift. Gift contents are provisional.
- **Village events** (ticket B, steps 4-6, partly): "carry this" (a village in surplus asks you to take goods to another village; hand-carried or by shulker; 2-week deadline; the destination village pays) and "urgent supply" (x1.5 price). Events appear when the storehouse is 75% full of its total-count cap (`village_storehouse_cap`, default 1024). Freshness lowers the payout (80% or more is full price, 50% or less is half).
- New policy parameters `village_storehouse_cap`, `village_barter_ratio`.

### Not done yet
- Distance bonus, specialty shipments, village-to-village trade, failure penalty. See dev/MILESTONES.md (M-E).

---

## 0.6.5

### Fixed
- **Perishable food can be listed on the Exchange again** (ticket A). Since 0.6.0 any item with a lore line was refused, and the Freshness line the freshness system writes counted, so even 100% fresh food was rejected, and NPC companies had nothing to buy. Now the Freshness line is ignored when judging an item:
  - 80% or more is accepted. The item goes to the pool as a plain item, so it is effectively reset to 100%; the buyer gets a new item that is stamped fresh the first time it is carried.
  - Below 80% is not accepted. The pull screen lists those items with the reason ("not fresh enough, 80% or more is required") and they stay in the shulker. Exactly 80% passes, 79% does not.
  - Named, enchanted, damaged or otherwise lore-carrying items are still refused, as before.
- Village, company and NPC company shipments hold item counts without freshness stamps, so there is nothing to judge there; they are treated as fresh when they are listed.

### Changed
- **Village-specific menu** (ticket B, steps 1-3). Touching a bell now opens a village menu instead of a copy of the company menu (companies are unchanged):
  - Go to the Meeting Hall: ask about the work (job blocks and what they make, runs per day), ask what they need (barter), ask about the board (funds, today's needs, open orders).
  - Ask the Storehouse Keeper: stock and its value, what was made last week, what is listed on the Exchange.
  - Go to the Head's Room: population (size only), funds, and "cut ties" (the old Dissolve button; only the person who registered the village).
- **Barter** at the Meeting Hall: hand over an item the village needs today (up to what is left of your daily need) and take goods from the storehouse worth `village_barter_ratio` (default 0.9, favors the village) of the value, at base prices. What you hand over counts toward the day's need, so it cannot be delivered again as a quest.
- New policy parameter `village_barter_ratio`.

### Not done yet (ticket B, steps 4-6)
- The event rows (carry-this events, anniversaries, financial and growth events), specialty shipments and village-to-village trade. Several rules still need your decisions; see dev/MILESTONES.md (M-E).

---

## 0.6.4

### Added
- **Onboarding now runs up to founding a company.** The introductory quests (Staff Service) grow from 4 to 9 steps in three stages:
  1. Staff Service: first job, how the board works, first delivery, licenses and dispatch (unchanged).
  2. Exchange: register a private shulker, list something, buy and receive something. These are checked against what you actually did.
  3. Companies: how villages and companies work (report), then found a company (checked). Founding a company ends the introduction.
- **Item rewards at every step**, none of them emeralds: lapis lazuli, experience bottles, iron and gold ingots, and 4 diamonds + 32 lapis lazuli for founding a company (the first job still gives a shulker box). The reward is shown on the quest screen and given when you report; a full inventory drops the items at your feet. Amounts are in the `TUTORIAL_STEPS` table (`economy/tutorial-chain.js`).
- Players who already finished the old 4 steps see the new steps next (steps they have already done can be reported right away).

---

## 0.6.3

### Changed
- **Auto-listing now covers vanilla items too.** Any plain item that is not in the trade list (items added by a Minecraft update, fireworks and so on, as well as other add-ons' items) can be pulled from the private shulker and listed. Its Exchange page is created on the spot under Rare resources > Other Items (auto-listed). A similar trade-list item is used for the price if one is found; otherwise there is no price match (the seller sets the price, cap 100,000 E). Command blocks, barriers, structure blocks, spawners, bedrock and similar items are never listed. No more updating the trade list by hand for each Minecraft update.
- Renamed the group "Add-on Items" to "Other Items (auto-listed)". The `bmh:ext` commands work the same.

---

## 0.6.2

### Added
- **Items from other add-ons are recognized when you put them in the pool.** Pulling an item whose namespace is not `minecraft:` from your private shulker, or listing it, creates its Exchange page on the spot (Rare resources > Add-on Items). If a similar trade-list item exists, it is priced like that item; if not, the item is listed with no price match: you set the price (the cap is a flat 100,000 E), and the 3-day re-check switches it to a priced match if a similar item turns up later.
- **7-day price movement.** Every purchase (players, villages, companies, NPC companies, HRMHRM, market rate) is recorded as a per-day average unit price for the last 7 days. An item page shows the same bar graph used in the stock market (green = up, red = down), the average price and the change against the previous trading day (for example `[▲+8%]`). Item lists show a small green or red triangle next to the name.

### Changed
- The pull screen no longer lists plain items that are not in the trade list (they could never be listed). Add-on items are still listed there.

---

## 0.6.1

### Fixed
- **Item names are now unified.** Every screen (Exchange, quests, villages, companies, NPC companies, license blocks) takes item names from one place: the Exchange trade list, plus a small supplement table for display-only items (job blocks, prismarine shard and so on). The old per-screen name table (`LABOR_ITEM_NAMES`) is gone. Items that showed up as raw IDs (kelp, slime_ball, oak_planks, flint, cocoa_beans, milk_bucket, egg, beef, and the village job blocks) now have names. A dev check confirms that every item ID in the quest, village, NPC and job data has a name.
- Some names in quest and village screens changed to the trade list's wording (for example raw cod and salmon, spruce log).

### Added
- **Add-on items (external IDs).** Items from other add-ons (any namespace other than `minecraft:`) are found automatically (`ItemTypes.getAll()`). Each one is matched to the most similar trade-list item by name (same ending, such as `_pickaxe`; an exact name match wins), priced the same as that item, and listed under Rare resources > Add-on Items. Items with no similar item are not listed. Weak matches (only the ending matched and there were many candidates) are flagged.
- **Re-check every 3 days.** The match and its base price are recomputed; a change of 5% or more (or a different match) updates the item and goes into a history.
- Admin command `/scriptevent bmh:ext list | check | hist | alias <ID> <similar item> | name <ID> <Japanese name> | forget <ID>`. `alias` pins a price match by hand so the re-check leaves it alone.

---

## 0.6.0

### Added
- **Potions and enchanted books on the Exchange.** The Exchange now trades by "item + variant" keys (`minecraft:splash_potion#strong_healing`, `minecraft:enchanted_book#sharpness:5`). 125 enchanted-book keys (every enchantment at every level) and 138 potion keys (46 effects x drinkable / splash / lingering) join the trade list (305 -> 568 items, under Rare resources). Names are shown in Japanese and English. They are one per stack, so there is no bulk trading for them.
- Shipping, delivery to the inbox, private-shulker deposit and pull, and HRMHRM standing stock all work with variant keys. Freezing and wither potions are excluded.
- **Prices from recipes.** A book costs a book + 3 lapis + labor days (common 1 day, Silk Touch / Efficiency 3, Infinity / Mending 5, halved per level below the maximum). Potions chain water > awkward > effect > long / strong > splash > lingering. Provisional ingredients: mundane = sugar, long mundane = redstone, thick = glowstone dust.
- **Fifth NPC company: Witcha-Cola (NPCWCC)** brews 12 potions from Exchange ingredients.
- Together with 0.5.12 to 0.5.14 (NPC companies, village job blocks, HRMHRM buying), this makes the Exchange able to run on its own to some degree. This is the first release for real-device testing of the 0.5.x economy.

### Not verified on a real device yet
- `Potions.resolve` for all three deliveries, reading potions with the potion component, the enchantment id format from `getEnchantments`, and shulker deposit / pull with variant stacks. See dev/real-device-checklist.md section 25.

---

## 0.5.14

### Added
- **HRMHRM buys what its standing stock lacks.** Every day, before the usual refill, HRMHRM buys items whose standing stock is below the standing amount from Exchange listings (players, villages, companies, NPC companies), cheapest first, at no more than base price x price level x 0.9 (`hrmhrm_exchange_buy_ratio`), spending at most 0.2% of its cash per day (`hrmhrm_buy_budget_ratio`). Sellers are paid from HRMHRM's account; the purchase counts as the weekly expense. Whatever it could not buy is refilled as before. Set either parameter to 0 to turn it off. This gives players a floor price for common goods: list at or below 90% of base and HRMHRM will take it.

---

## 0.5.13

### Added
- **Villages detect vanilla job blocks.** Once a day (when a player is nearby) a village counts the job blocks inside its core range (the same box as the population count): composter, smoker, blast furnace, barrel, fletching table, plus loom, stonecutter, cartography table, lectern, brewing stand, cauldron, grindstone and smithing table (detected only for now). The number of villagers only shows the village's size; what the village can do depends on the blocks, because villagers come and go.
- **Hand-craft production.** Each job block can process up to 16 runs per day (`village_job_runs`): composter (seeds to wheat), smoker (raw to cooked meat), blast furnace (raw iron/copper to ingots), barrel (raw to cooked fish), fletching table (flint, stick, feather to arrows). At the weekly close the village first buys missing inputs on the Exchange (after player deliveries, at most the item's base price, with up to 30% of its free cash, `village_buy_budget_ratio`), then processes, then lists the products on the Exchange at base price x 1.1 (`village_product_ratio`, never above HRMHRM's price). Unused inputs are carried over for up to two weeks of capacity. The cost of the purchases is booked as an expense (`village_purchases`).
- **Requests follow the job blocks.** A village with job blocks puts its job inputs (for example seeds for a composter, raw meat for a smoker) in its daily requests first, sized by block count rather than population. This is the pre-company player's income: deliver the inputs, the village makes the goods and sells them. A player with a company can instead put bulk goods on the Exchange, and the village buys them itself. Villages without job blocks keep the old fixed list.
- The village stock screen shows the detected job blocks and last week's processing.

### Notes
- `/scriptevent bmh:core info <village id>` shows `jobs` (the last count). Detection needs the chunks loaded; if they are not, the last count is kept.
- HRMHRM buying what it lacks on the Exchange is still open.

---

## 0.5.12

### Added
- **NPC companies.** Four of the stock-market companies now work as small NPC versions of player companies: McMoonald (bread, cooked meat, cookies, cake), Clattle (arrows, bows, crossbows, shields, iron armor), Pupple (compasses, clocks, leads) and EekBay (cooked fish, dried kelp). Every day each one buys the raw materials it needs from the Exchange (player, village and company listings, up to the item's base price), processes them, and lists its products on the Exchange at 90% of HRMHRM's price. They have no physical headquarters; they run automatically.
- **Company quests for raw materials.** When the Exchange does not have enough of a raw material, the NPC company posts a delivery request on the company quest board (shown regardless of distance). The player delivers as with any company request and is paid from the company's account; the delivered goods are used the next day. Together this makes each NPC company a sink for those raw materials.
- **Funding through the Development Bank.** On its first day each NPC company receives startup funds from the Development Bank (`npc_startup_base`); later shortfalls go through the usual weekly funding application. Money spent on the Exchange counts as the weekly expense (`exchange_purchases`).
- **New policy parameters:** `npc_company_enabled` (1 = active, 0 = all hibernate, leaving only the stock; intended for when player companies and villages have grown), `npc_price_ratio` (0.9), `npc_runs_per_day` (16 runs per recipe), `npc_startup_base`.
- **Admin:** `/scriptevent bmh:npc` shows each company's cash, stock and open requests; `/scriptevent bmh:npc run` runs the day now.
- A new account type `npc`; NPC listings show as [NPC] in offers.

### Changed
- **Price order on the Exchange.** Offers are sorted by price, and at the same price the order is player (including villages and companies), then NPC, then HRMHRM, then the system listing (market rate). For items HRMHRM stocks, the system listing is now never cheaper than HRMHRM's price, so HRMHRM's stock is no longer skipped when the market rate is lower (this showed up with some bulk items).

### Notes
- Witcha-Cola (potions) is waiting for custom items; Skein, KelpLife and HRMHRM have no products of their own and stay as they are. Villages and HRMHRM buying what they lack on the Exchange is not in yet.

---

## 0.5.11

### Added
- **Villages and companies ship through the Exchange.** At the weekly close, what a village ships (unconsumed raw materials) and what a company holds above its stock keep are now listed on the Exchange instead of being sold automatically below market. The seller is the village or company account (shown as [Village]/[Company] in offers); when a player buys, the money moves from the buyer's balance to that account and counts as exchange sales in the weekly record. Unsold goods return to the entity's pool when the listing expires and are relisted, merged into one listing per item, the next week. Goods that cannot be listed (not in the trade list) are still sold automatically as before.
- **New policy parameters:** `exchange_entity_shipping` (1 = list on the exchange, 0 = the old automatic sale; set 0 to revert instantly) and `company_ship_ratio` (0.8; the village keeps `village_ship_ratio`). Listing prices are base x price level x ratio, never above HRMHRM's price.
- The village stock screen shows the last week's shipping as "listed on the exchange".

### Notes
- No freight fee is charged to villages and companies yet (pending a recheck of their finances). Their income now depends on players buying; with no buyers it is zero (the Development Bank grants still cover them). In the 12-week simulation the listings total about 20% of what villages pay for deliveries, the same as the old automatic sale would have returned.

---

## 0.5.10

### Fixed
- **Wrong item IDs, found by checking against the game's item list.** Six items in the new trade list and in the old Mail Order catalog used IDs that do not exist in Bedrock, so those goods could not be delivered: Item Frame (`frame`), Glow Item Frame (`glow_frame`), Bed (`bed`), Shelf (`oak_shelf` etc.), Jack o'Lantern (`lit_pumpkin`), Small Dripleaf (`small_dripleaf_block`). The Mail Order catalog's Shulker Box now uses `undyed_shulker_box`. Price recipes were renamed to match.

### Added
- **Shelves per wood** (Oak, Spruce, Birch, Jungle, Acacia, Dark Oak, Mangrove, Cherry, Pale Oak, Poplar, Bamboo), 305 items in the trade list.
- **A "Back" switch on every input form** (quantity, listing, search; the quantity prompt is shared with the bank, stocks, forex and futures screens). Forms cannot hold buttons, so switch it on and submit to go back.
- A new check against the game's item list (`dev/check_item_ids.mjs`).

---

## 0.5.9

### Added
- **Market rates folded into the Exchange.** Items that used to trade with the Golem (iron block) now have a standing "Market (system)" offer on their item pages at the live market rate, with unlimited stock; buying picks the cheapest of HRMHRM, players and the market. "Sell at Market" sells goods from your exchange pool at the market rate. Bulk items (marked [Bulk]) trade with the market only in whole shulker lots of 1,728; smaller amounts come from HRMHRM and players. One purchase is capped at 5,184 items. Card (revolving) still covers only HRMHRM's part. Ledger groups are unchanged (commodity_* / bulk_*).
- **Search.** "Search Items" on the Exchange menu finds items by part of the name: hiragana, katakana, half-width kana, English and item IDs all match (top 40 shown).
- **Boats per wood.** Oak, Spruce, Birch, Jungle, Acacia, Dark Oak, Mangrove, Cherry, Pale Oak and Poplar boats plus the Bamboo Raft (295 items in the trade list).
- **Price recipes for the unpriced items**, following similar items (other woods follow oak, flowers follow dandelion, cooked meats follow cooked porkchop, and so on) and keeping tier steps Copper < Iron < Diamond < Netherite.

### Changed
- The "Trade at Market Rate" button on item pages (which opened the old Golem screen) is replaced by the integrated market offer and "Sell at Market".

---

## 0.5.8

### Changed
- **Exchange categories rebuilt** from the author's 285-item trade list: Fresh (16) / General Resources (190) / Rare Resources (79), each split into subcategories (Seafood, Meat, Produce, Dairy & Eggs; Minerals, Earth/Stone/Glass, Logs, Planks, Saplings, Crops, Seeds, Flowers, Cooked, Dishes, Mob Drops, Household, Functional, Gear; Rare Minerals, Redstone, Tools, Armor, Other Arms). Every sapling, flower, fish and so on is now its own item (the old "daily" variants no longer collapse into one).
- **Fresh Market and Spot Trading moved into the Exchange.** The iron block + flower pot now opens the Exchange, and the moss-block window's Fresh Market button points to it. Item pages show markers ([Spoils: 6d/12d], [No spoil], [Bulk]); items that were in the Golem trade get a "Trade at Market Rate" button, and fresh items get a "Fresh Market (GLB)" button.
- Items with no listings stay visible ("0 listings"); the page says you can be the first seller. Only items on the list can be listed; HRMHRM's standing listings now cover only listed items.

### Notes
- Not in this version: search, merging the old Fresh Market order board and Golem market prices into the exchange's own offers, and copper-gear pricing recipes (items without a recipe use the generic gather value).

---

## 0.5.7

### Added
- **Exchange menu.** The lectern + paper entrance, formerly Mail Order, now opens the Exchange: Browse by Item (Fresh / General / Rare; Intangible Assets shows "coming soon"), item pages listing offers (cheapest first; the cheapest offers are used first when you buy), purchase with a quantity prompt and confirmation, Outgoing (pull goods from your private shulker into the exchange pool, list them at a price up to HRMHRM's price, see and withdraw your listings), and Incoming (goods wait here and are delivered to your private shulker; bought goods are delivered immediately when possible).
- **Card payment.** If your balance falls short on HRMHRM's part of a purchase, the shortfall goes on your card (revolving). Payments to other players always come from your balance, so credit cannot create emeralds for sellers.
- **Carried over from Mail Order:** Today's Picks, Customer Service (Prime membership and card management) and Legal Service (debt relief). Gear and enchanted books are still bought directly from HRMHRM under Rare Resources.

### Changed
- Receiving and shipping need a registered private shulker; the menu says so.

---

## 0.5.6

### Added
- **Exchange engine (groundwork; no menu yet).** The engine that will replace Mail Order: HRMHRM standing listings (real stock, refilled daily, priced at base x 1.25 x level and acting as the price ceiling), player listings from a per-player exchange pool (stocked from the private shulker), cheapest-first purchases, a listing freight fee (default 2% of the listing value, not refunded), listing expiry (default 14 days; the rest returns to the pool), proceeds held for offline sellers until login, arrivals delivered into the private shulker (overflow and unloaded chunks stay in the arrivals list), and a dedicated exchange account (type `exchange`, never intervened on; the development bank tops it up when short). Test it with `/scriptevent bmh:exchange pull|list|offers|buy|mine|cancel|pool|inbox|deliver|refill`. Mail Order itself is unchanged.
- **New policy parameters:** `exchange_listing_fee_rate`, `exchange_listing_days`, `exchange_max_listings`, `exchange_hrmhrm_refill_ratio`. **New ledger categories:** `exchange_buy`, `exchange_sell` (market), `exchange_fee` (spend).

---

## 0.5.5

### Added
- **Private shulker.** Tap a shulker box with a book to register it as your private shulker (one per player; moving or releasing it is in the same menu). A registered shulker is protected the same way core blocks are: it cannot be broken (release it first) and is excluded from explosions, and only its owner can open it. If the shulker disappears from its place (pistons, commands), a ten-second patrol releases the registration and tells the owner at the next login if they are away. A registration is released after the owner has been away for more than `private_shulker_absent_days` (default 60). Admin: `/scriptevent bmh:pshulker list | release <player>`. This is groundwork for the upcoming exchange (arrival and shipping boxes); the module already has `depositToPrivateShulker`, `freeSlots` and `getPrivateShulkerBlock` for that. Hoppers, pistons, dispensers, droppers, observers, rails, TNT, TNT/hopper minecarts, respawn anchors and end crystals cannot be placed within 2-3 blocks of a registered shulker; registering is refused while one is nearby, and ones that slip in later are removed every three seconds (blocks drop as items, TNT minecarts are dropped without exploding). The check is skipped while the shulker's chunk is not loaded. Behavior verified with the author's test pack (PrivateShulkerTest002).
- **New policy parameter:** `private_shulker_absent_days`.

---

## 0.5.4

### Changed
- **Villages and companies now feed inflation, through a separate term.** Payouts from villages and companies to players (village order payments, liquidation payouts) are a new ledger group, `org`, and are no longer part of `market`. The weekly price index rises by the player-side term (cap 0.05%/week, unchanged) plus an organization term with its own cap (`INFLATION_ORG_WEEKLY_CAP`, 0.03%/week), computed the same way (per active player, tanh-shaped, never negative). The maximum total is 0.08%/week. Like the other inflation constants, it is a safety device outside the policy parameters.
- **Villages only ship raw materials, and only ones that are not consumed.** Villages no longer process goods at the weekly close. Saplings, sticks, feathers, wool, raw iron/copper and charcoal are shipped below the going price (`village_ship_ratio`); food, bone meal and rotten flesh are consumed in the village (that is what village quests ask for). Processing is left to company and HRMHRM factories. `convert_loss` now applies to factories only.

---

## 0.5.3

### Added
- **Bilingual names.** A village gets a Japanese and an English name (and head) when it is created; a company registration has your name plus an optional name in the other language (duplicates are checked against both). Everyone sees the name matching their own language. Villagers get English names too. Existing data falls back to the English name looked up from the Japanese one (`i18n/names.js`).
- **Loan request board.** *Borrow -> Request a lender* posts a request (no screening; the rate follows your credit score). Requests appear under *Lend* as player / village / company requests (the desk's NPC borrowers stay below them). When a lender takes one the money arrives at once; repayments reach the lender every week (at the next login if the lender is offline). A request disappears at the first weekly close at least 7 days after it was posted.
- **Villages and companies post loan requests** when their free cash (cash minus reserved order funds) falls below twice their target reserve (one request at a time, at most two loans). They repay every weekly close; four missed weeks write the loan off. If a request expires and cash is still below the operating floor, the case becomes an intervention (`loan_unfilled`) and the village or company is liquidated.
- **Village dissolution refunds HRMHRM.** The remaining cash goes back to HRMHRM instead of the registrant (village funds come from the development bank). Outstanding loans are repaid to lenders first; goods and stock still go to HRMHRM.
- **Transfers.** Bank -> *Send Money* sends emeralds to an online player. Fee 2% (paid on top by the sender, HRMHRM revenue) and a daily cap of 2,000 E (base) per sender.
- **Limits and abuse safeguards.** Borrow limit = half of net assets (account, currencies, stocks minus loans; for villages and companies: equity plus stock); lend limit = half of the lender's assets per loan. Villages and companies sell stockpiled goods first (most valuable first) and only request what is still missing. Repaying a player-to-player loan does not raise the credit score. A player-to-player loan that is not settled within its term plus 4 weeks is written off and frees the lender's slot; completion notices are matched by loan ID.
- **New policy parameters:** `loan_borrow_asset_ratio`, `loan_lend_asset_ratio`, `loan_lend_grace_weeks`, `transfer_fee_rate`, `transfer_daily_cap_base`. **New ledger categories:** `p2p_lend`, `p2p_borrow`, `p2p_repay`, `p2p_return`, `transfer_out`, `transfer_in` (market group: transfers, not issuance) and `transfer_fee` (spend group, HRMHRM revenue).

### Fixed
- Village and company orders are matched by player ID, so changing a gamer tag no longer strands claimed orders (older orders still match by name).
- Expired orders no longer count as reserved funds before they are cleaned up.
- A lender's mailbox that overflows folds the money into the remaining notices instead of dropping it.
- Loan request IDs keep increasing (they used to be reused when the board was empty).

---

## 0.5.2

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
## 0.4.5 (unreleased)

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


