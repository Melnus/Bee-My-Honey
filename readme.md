# Bee My Honey - Bee Exchange

Bee My Honey is an economic simulation add-on for Minecraft Bedrock Edition. Using assets harvested by the world's hardworking bees, players can trade foreign currencies, invest in corporate equities, trade futures and physical commodities, take out loans, buy insurance, shop by mail order, work through a labor market, and keep an offline cold wallet.

[![Bee My Honey Demo](https://raw.githubusercontent.com/Melnus/Bee-My-Honey/refs/heads/main/BeeMyHoney-Thumbnail.jpg)](https://youtu.be/xkHy5lNS2bY)

→日本語訳は[こちら](/readme_jp.md)

---

## Versions

| Channel | Version | Notes |
|---|---|---|
| Stable | **0.3.3** | Recommended for regular worlds. |
| Latest | **0.4.5** | Adds bulk commodity trading, the Paws & Blackpots energy shop, the Fresh Market and the food freshness system (0.4.0-0.4.2), plus loan management, account history, the daily quest board and dispatch to facilities (0.4.5). Features that only exist in 0.4.x are marked **[0.4]** below. |

See [CHANGELOG.md](/CHANGELOG.md) for the full history.

> **Note for 0.4.x:** the food freshness system (food rots in your inventory) is on by default in 0.4.x and cannot be switched off from in-game settings. 

---

## Overview

Interacting with a Bee Nest or Beehive while holding a book opens the Bee Exchange. Physical emeralds in your inventory are deposited into a digital account balance (E), which is used to trade currencies, stocks, futures and physical assets. Other services (insurance, mail order, labor market, animal trading and so on) are opened from specific blocks, listed below.

---

## How to Play

### Where to open each service

Hold a regular Book (`minecraft:book`) in your main hand unless noted otherwise, and interact (right-click or tap) with the block. "+ Flower Pot" means a flower pot (empty or planted) placed directly on top of the block; it keeps you from opening menus by accident.

| Service | Block | Notes |
|---|---|---|
| Bee Exchange (main menu) | Beehive | Bank, Forex, Stocks, Futures, Cold Wallet, Language |
| Bee trading (Honeycomb window) | Bee Nest | Trade with the bees |
| Physical assets (Golem) | Iron Block + Flower Pot | Diamond, gold, lapis, and more (see below) |
| Animal trading: Apple (APL) | Hay Bale + Flower Pot | Horse and Cat window. **[0.4]** also opens Paws & Blackpots |
| Animal trading: Sweet Berry (SWB) | Spruce Log + Flower Pot | Fox window |
| Animal trading: Glow Berry (GLB) | Moss Block + Flower Pot | Axolotl window. **[0.4]** also opens the Fresh Market |
| Animal trading: Chorus Fruit (CHO) | End Stone Bricks + Flower Pot | Dragon / Endermite / Shulker window |
| Insurance | Bone Block + Flower Pot | |
| Mail order (Skein) | Lectern, holding **Paper** | No flower pot needed |
| Labor market (HRMHRM Partners HLD) | Lectern, holding a **Book** | |
| Wandering Trader summon | White Wool + Flower Pot | Natural trader spawning is turned off; this is the only way to call one |

---

## Features

### 1. Bank Account (Deposit & Withdraw)
- Deposit physical emeralds into a digital balance (E), or withdraw the balance back into emeralds.
- All exchange instruments operate on this balance.
- Inventory overflow protection: if your inventory is full when withdrawing or collecting a dividend, the excess drops safely at your feet.
- The bank also links to the loan desk (see Loans & Credit Score).
- **[0.4] Account History:** the bank lists your last 30 deposits and withdrawals with the reason and, where known, the counterparty (for example "from HRMHRM Partners HLD").

### 2. Forex Market
Five currencies with different base rates and volatility:

- Honeycomb (HNY): Base currency. Reliable and steady.
- Apple (APL): Moderate, predictable wave patterns.
- Sweet Berry (SWB): Low cost per unit with high, sharp volatility.
- Glow Berry (GLB): Growth-oriented currency with upward potential.
- Chorus Fruit (CHO): Extreme volatility with aggressive spikes and drops.

Trade volumes can be adjusted with stepper buttons (+/-). When you add to an existing position, the average entry rate is calculated as a weighted average.

### 3. Stock Market & Dividends
Eight fictional companies:

- Pupple (PPL): Smart collars and gadgets (Motif: Dog)
- McMoonald (MCD): Fast food and dairy milk (Motif: Cow)
- Witcha-Cola (WCC): Secret-formula potion drinks (Motif: Witch)
- Clattle (CLT): Skeletal defense and hardware (Motif: Skeleton)
- EekBay (EKB): Maritime express auctions (Motif: Dolphin)
- Skein (SKN): Jungle-parrot delivery giant (Motif: Parrot)
- KelpLife Holdings (KLH): Life insurer run by sea creatures (cash dividend)
- HRMHRM Partners HLD (HRM): Global consultancy that dispatches villagers (stock-option dividend)

#### Dividends
Holding at least 100E in total valuation (share price × shares) of a stock qualifies you for one dividend per in-game day (`world.getDay()`):

- Pupple: Assorted cooked meat
- McMoonald: Pumpkin pies and a cake
- Witcha-Cola: Brewing materials (Nether Wart, Blaze Powder, Glistering Melon Slices, and more) and glass bottles
- Clattle: Bow, arrows and bone meal
- EekBay: A rare marine item (Nautilus Shell, Heart of the Sea or Prismarine Crystals)
- Skein: Sugar cane, redstone and nether quartz
- KelpLife Holdings: A cash dividend paid straight into your balance
- HRMHRM: Not claimed from the menu. Shares are granted as stock options each time the labor market generates work.

### 4. Flower Futures
Five flower contracts (Rose, Allium, Jade Orchid, Sunflower, Sakura) with a two-day maturity window.
- Enter a long contract by posting a 5E margin deposit; you can hold multiple lots.
- Settle on or after the maturity date (two in-game days after entry).
- If the settlement price is above the strike, profit is credited. If it is below, the net loss is deducted.
- **Default penalty:** if a loss exceeds your balance, the balance is set to zero and security bees spawn to attack you.

### 5. Physical Assets (Golem) and Bulk Trading
The golem sells and buys physical goods, split into two categories:

- **Rare resources** (small-lot trading): Diamond, Gold, Lapis Lazuli, and **[0.4]** Nether Quartz and Redstone. Diamond/gold/lapis blocks count as 9 units each.
- **General resources [0.4]** (bulk trading, one **Shulker Box** per trade): Cobblestone, Iron, Copper, Glass, the eight log types, and Dirt, Sand, Gravel and Clay.

Bulk trades use shulker boxes **placed as blocks** within 6 blocks of you. To **buy**, have an **empty** shulker box placed nearby; the goods are delivered into it. To **sell**, have a shulker box placed nearby that is **completely full** of that one item. Each trade is limited to one shulker box (1,728 items).

Prices follow weekly patterns and are affected by demand pressure (see below). Bulk trades use a separate demand-pressure pool from small-lot trades.

### 6. Animal Trading (Currency Windows)
Each foreign currency has its own animal window (see the table above). Sell items the animals like for that currency, and buy their goods with it. Currency-window purchases drop at your feet.

### 7. Paws & Blackpots (Energy Shop) **[0.4]**
Open it from the Apple (APL) window: Hay Bale + Flower Pot, then the "Paws & Blackpots" button.
- Buys and sells **Coal, Charcoal, Blaze Rods and Lava Buckets** for **APL**, one item at a time.
- Real stock: the shop only has what is in its pool. Coal and charcoal restock daily (up to 100). Blaze rods and lava buckets do not restock once the starting stock is gone, and buying them requires the Nether license from the labor market.
- Prices follow "the shopkeeper cat's mood": a daily random multiplier. Pet the cat (once a day) or give it Cod/Salmon to improve its mood and get up to 25% off. Selling to the shop pays 60% of that day's asking price.

### 8. Fresh Market **[0.4]**
Open it from the Glow Berry (GLB) window: Moss Block + Flower Pot, then the "Fresh Market" button.
- A player-supplied order board for food, traded in **GLB**. It starts empty; goods appear only when players deliver them.
- Four genres: Seafood, Meat, Produce, Dairy & Eggs. Each item has its own page with a price chart and a list of anonymous listings (cheapest first).
- When you deliver, the game suggests a price range based on the region where you are (coastal, inland or remote), but you set the final price.
- Listed food loses freshness over time: the remaining quantity of a listing shrinks as it ages, and it disappears once it has fully spoiled.

### 9. Food Freshness **[0.4]**
Perishable food in your **inventory** (including the off-hand) slowly spoils and finally turns into Rotten Flesh.
- Raw food (fish, meat, milk, eggs, raw crops) lasts about **6 in-game days**; cooked/processed food (cooked meat, bread, stews, baked potato, dried kelp) lasts about **12 in-game days**.
- The timer starts when you pick the food up. Food stored in chests, barrels or shulker boxes does **not** age, and sleeping or changing the time does not speed it up.
- The item description shows "Freshness: XX%" and warns you before it is about to rot. Food obtained on the same day still stacks normally.
- **Never spoil:** sugar, honey items, potions, cake, cookies, pumpkin pie, golden apples, golden carrots, and the currency fruits (apple, sweet berries, glow berries, popped chorus fruit).
- Debug commands (need command permission): `/scriptevent bmh:food_info` shows held food and its age; `/scriptevent bmh:food_age [days]` fast-forwards held food.

### 10. Loans & Credit Score
- Five loan tiers. Higher tiers need a higher credit score and carry higher interest. You can borrow one loan at a time, and you can also lend one.
- The credit score (300-850) is shared by loans, the credit card, insurance and bankruptcy handling.
- Repayment, card billing and insurance premiums are handled at the weekly rollover.
- **[0.4] Loan Management** (Bank -> Loan Window): shows your borrowing and lending, and lets you repay early. With the toggle off you repay only the principal (the remaining interest follows the weekly schedule); with it on you repay everything and close the loan.

### 11. Insurance
Marine (drowning), fishing-catch and undersea-asset policies, opened from Bone Block + Flower Pot. Marine insurance pays out on drowning deaths; the others pay a fixed amount on death.

### 12. Mail Order (Skein) & Credit Card
Use a Lectern with Paper. Shop the catalog by category (fresh goods, household, redstone, gear, enchanted books, rare drops), with daily specials. Apply for a credit card with a limit based on your credit score, and pay with revolving installments (fixed minimum payment). A Prime-style subscription is available.

### 13. Labor Market (HRMHRM Partners HLD)
Use a Lectern with a Book.
- **Staff Service:** four quests are posted each day, the same for everyone (one per category; licensed categories are locked until you hold the license). Claim a quest, then select it again to deliver it by container or abandon it. A claim lasts until the end of the week, and you can hold 2 at a time by default. New players get a one-off "first part-time job" that gives a shulker box. **[0.4]**
- **Licenses:** Nether / Underwater / End licenses are earned by actually placing or breaking the relevant blocks in those places.
- **Consultant Service:** lease villagers.
- **Owners' Club:** register villagers as resumes and dispatch them to a facility (Farm / Mine / Factory; HRMHRM operates all three for now). The output is fixed when you sign the contract and is delivered to the facility's stock when you collect. A villager retires automatically after 3 years (1095 days) of total dispatch. 128 registered villagers maximum; accident risk rises above 100. **[0.4]**
- HRMHRM converts the stock above a set level into cash every week.

### 14. Cold Wallet (Offline Story Codes)
Encodes account Honeycomb into a story code of twenty keywords across five sentences. Codes can be shared on message boards, on notes, or imported into other worlds.

- **Wallet creation:** set a personal secret word to derive a public key (PK-XXXXXX).
- **Export:** withdraw Honeycomb into a code, in one of two themes ("Bees & Nature" or "Ores & Earth").
- **Clipboard support:** the result appears in a text field you can select and copy on any platform.
- **Last code:** review the last issued code any time from the wallet menu.
- **Import:** paste a code to redeem it. The parser ignores punctuation and filler words.
- **Security:** monotonic nonce tracking prevents replays, and a public-key-bound checksum signature is verified. The secret used for signing is generated per world; carrying a wallet into another world is an operator-only option.

### 15. Wandering Trader
White Wool + Flower Pot summons a Wandering Trader that is tethered to the spot (slowness applied and pulled back if it wanders off).

---

## Weekly Economic Cycles & News

The economy runs on a seven-day cycle based on Minecraft world days.
- At the Day 7 → Day 1 rollover, market seeds refresh and new price trends begin.
- At rollover the "Weekly Bee News" is broadcast to chat with hints derived from currency and stock seeds.
- **Demand pressure:** the amount you buy or sell moves the price (up to ±60%), and the effect decays daily. It applies to forex, stocks and physical assets.

---

## Language Settings

Full bilingual support for English and Japanese.
- The default language is detected from the player's client locale.
- Change it any time from the "Language" menu of the Bee Exchange.

---

## Credits & Specifications

- Add-on Name: Bee My Honey
- Version: 0.4.5 (stable: 0.3.3)
- Author: Melnus
- Target Platform: Minecraft Bedrock Edition (Script API supported environments)


