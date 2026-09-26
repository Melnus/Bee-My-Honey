# Bee My Honey - Bee Exchange

Bee My Honey is an economic simulation add-on for Minecraft Bedrock Edition. Trade foreign currencies, invest in company stocks, open flower futures contracts, take out loans, buy insurance, shop by mail order with a credit card, run a labor staffing agency, and store your savings offline with a cold wallet — all powered by the honey the world's bees collect.

[![Bee My Honey Demo](https://raw.githubusercontent.com/Melnus/Bee-My-Honey/refs/heads/main/BeeMyHoney-Thumbnail.jpg)](https://youtu.be/xkHy5lNS2bY)

→日本語訳は[こちら](/readme_jp.md)

---

## Overview

The add-on is accessed entirely by right-clicking (or tapping) specific blocks while holding a book or paper. Different blocks — a beehive, a lectern, a bone block, an iron block, and more — open different parts of the economy: banking, trading, loans, insurance, mail order, and the labor market.

Physical emeralds in your inventory can be deposited into a digital account balance (E), which is what every financial instrument in the game actually uses.

---

## How to Play

| Hold | Right-click on | Opens |
|---|---|---|
| Book | Beehive | Main Trading Menu (bank, forex, stocks, futures, wallet) |
| Book | Bee Nest (natural) | Honey bartering with the bees |
| Book | Hay Bale / Spruce Log / Moss Block / End Bricks + flower pot on top | Bartering for Apple / Sweet Berry / Glow Berry / Chorus Fruit currency |
| Book | Lectern | HRMHRM Partners HLD labor market |
| Book | Bone Block + flower pot on top | Insurance desk |
| Book | Iron Block + flower pot on top | Golem physical-asset trading (Diamond / Gold / Lapis) |
| Book | White Wool + flower pot on top | Summon a wandering trader |
| Paper | Lectern | Skein mail-order catalog |

---

## Features

### 1. Bank Account (Deposit & Withdraw)
- Deposit physical emeralds into your digital balance (E), or withdraw digital balance back into physical emeralds.
- Every trading system on the exchange runs on this balance.
- Inventory-overflow protection: if your inventory is full when you withdraw or collect a dividend, the items drop safely at your feet instead of being lost.

### 2. Forex Market
Trade five currencies, each with its own baseline rate and volatility, by depositing/withdrawing E at the bank or bartering directly with the animals tied to each currency:

- Honeycomb (HNY): Base currency. Reliable and steady.
- Apple (APL): Moderate, predictable wave patterns.
- Sweet Berry (SWB): Low cost per unit with high, sharp volatility.
- Glow Berry (GLB): Growth-oriented currency with upward potential.
- Chorus Fruit (CHO): Extreme volatility with aggressive spikes and drops.

Trade volumes can be adjusted with +/- stepper buttons, and average entry rates are calculated automatically via weighted averages when you buy into an existing position.

### 3. Stock Market & Dividends
Trade shares in seven fictional companies:

- Pupple (PPL): Smart collars and wearable gadgets (Motif: Dog)
- McMoonald (MCD): Fast food and dairy milk (Motif: Cow)
- Witcha-Cola (WCC): Secret-formula potion beverages (Motif: Witch)
- Clattle (CLT): Skeletal defense and hardware manufacturing (Motif: Skeleton)
- EekBay (EKB): Maritime express auction logistics (Motif: Dolphin)
- Skein (SKN): A jungle-parrot delivery giant (also powers the mail-order system below)
- KelpLife Holdings (KLH): A life insurance company run by sea creatures — pays **cash dividends** straight into your balance
- HRMHRM Partners HLD (HRM): A shadowy consultancy that dispatches villagers as laborers — instead of a normal dividend, holding enough shares grants you company stock every time a labor-market job is completed

Holding at least 100E in total valuation (share price × shares owned) qualifies most stocks for a daily item dividend once per in-game day — cooked meat, pumpkin pies, brewing ingredients, bows and arrows, or rare marine loot, depending on the company.

### 4. Flower Futures
Leveraged margin contracts on five flowers, each tracked independently so you can hold a position in more than one at once:

- Rose (ROS), Allium (ALM), Jade Orchid (JDO), Sunflower (SUN), Sakura (SKR)

- Open a position with a 5E margin deposit; it matures 2 in-game days later.
- Settle on or after maturity: if the price rose, the profit is credited to your balance; if it fell, the loss is deducted.
- **Default Penalty**: if a settlement loss exceeds your account balance, your balance is zeroed out and aggressive security bees spawn to attack you.

### 5. Golem Trading (Physical Commodities)
Trade real physical assets — no digital balance involved, straight item-for-emerald swaps — with a golem: Diamond, Gold Ingot, and Lapis Lazuli, each with its own price movement.

### 6. Loans & Lending
- Borrow from five loan tiers (from small pocket-change loans up to large ones). Approval and your weekly interest rate depend on your credit score; better scores unlock bigger loans at lower rates.
- You can also become the lender: fund villager borrowers who occasionally apply for a loan, and collect interest over their repayment term.

### 7. Credit Score
A single credit score (300–850) shared across loans, mail-order credit cards, and insurance. It rises when you pay on time and pay off loans, and falls on overdue payments, defaults, or restructured debt — your score directly affects what loans and credit limits you qualify for.

### 8. Insurance
Set up at a bone block topped with a flower pot. Three plans, each with a weekly premium and a payout triggered by your character's death:

- **Maritime Accident Insurance** — full payout on drowning, half payout on any other death
- **Catch Insurance** — a flat payout of dried kelp on death
- **Seabed Asset Insurance** — a flat payout of gold ingots on death

### 9. Mail Order (Skein) & Credit Cards
Bring paper to a lectern to browse the Skein catalog — everyday goods, redstone components, gear, and a dedicated enchanted-book section, priced from a few emeralds up to the hundreds of thousands. Rare and boss-drop items don't appear in the regular catalog; instead they rotate through a discounted daily deals corner.

- Apply for a Skein credit card to buy now and pay later, with a revolving balance, a minimum weekly payment, and interest on anything left unpaid. Miss enough payments and your card gets suspended.
- **Prime Standard** membership (paid weekly) gives you free shipping.
- **Prime Premium** unlocks once your Skein (SKN) stock holdings are valuable enough — parrots escort your deliveries and may perform a trick.

### 10. Labor Market: HRMHRM Partners HLD
Access it with a book at any lectern.

- **Staffing Service** — take on daily quests: deliver a set amount of an item to a container for pay.
- **Work Licenses** — earn real Nether, Underwater, and End work licenses by actually placing/breaking the relevant blocks in those biomes (not a paid exam), ranking up from Trainee to Journeyman.
- **Consultant Service** — sign a fixed-term contract to rent out a villager (spawn egg + bed provided); bring the villager back to the lectern when the contract ends to collect your margin.
- **Owner's Club** — register nearby villagers as employees (résumé-style, up to 128) and dispatch them for work. Accident rates rise once you're running more than 100 at once.

### 11. Wandering Trader Summoning
Place white wool with a flower pot on top and interact with a book to summon a wandering trader on demand, instead of waiting for one to spawn naturally.

### 12. Cold Wallet (Offline Story Codes)
An offline asset preservation system that encodes your Honeycomb balance into a story code made of twenty keywords across five sentences. Codes can be shared via message boards, physical notes, or imported into different worlds.

- **Wallet Creation**: set a personal secret word to derive a unique Public Key (PK-XXXXXX).
- **Exporting (Withdrawal)**: withdraw Honeycomb into an export code, choosing between two story themes — "Bees & Nature" or "Ores & Earth."
- **Clipboard Support**: export results appear in a modal text field so players on Android, mobile, and console can press-and-hold to select and copy.
- **View Last Issued Code**: if an export screen closes accidentally, the last generated code can be reviewed again from the wallet menu.
- **Importing (Deposit)**: paste a story code to redeem its Honeycomb balance; the parser automatically extracts key nouns and ignores punctuation, brackets, and filler words.
- **Security**: monotonic nonce tracking prevents replay attacks within the world, alongside public-key-bound checksum signature verification. Taking a wallet code to a different world is an opt-in, operator-only option.

---

## Weekly Economic Cycles & News

The economy runs on a continuous seven-day cycle based on Minecraft world days.
- When the cycle rolls from Day 7 back to Day 1, market seeds refresh and new price trends begin for the week.
- Loan repayments, credit card billing, and insurance premiums are also settled during the weekly rollover.
- At the rollover, the "Weekly Bee News" is broadcast to the chat log with contextual market signals based on that week's currency and stock trends.

---

## Language Settings

Complete bilingual support for English and Japanese.
- The default language is auto-detected from the player's client locale.
- Language preferences can be changed manually at any time via the "Language" menu.

---

## Credits & Specifications

- Add-on Name: Bee My Honey
- Version: 0.3.3
- Author: Melnus
- Target Platform: Minecraft Bedrock Edition (Script API supported environments)
