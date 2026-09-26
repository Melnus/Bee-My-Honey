# Bee My Honey - Bee Exchange

Bee My Honey is an economic simulation add-on for Minecraft Bedrock Edition. Players can trade foreign currencies, invest in corporate equities, engage in futures contracts, and utilize an offline cold wallet system using assets harvested by the world's hardworking bees.

[![Bee My Honey Demo](https://raw.githubusercontent.com/Melnus/Bee-My-Honey/refs/heads/main/BeeMyHoney-Thumbnail.jpg)](https://youtu.be/xkHy5lNS2bY)

→日本語訳は[こちら](/readme_jp.md)

---

## Overview

Interacting with a Bee Nest or Beehive allows players to access the Bee Exchange. 
Physical emeralds in your inventory can be deposited into a digital account balance (E) to trade across five currency pairs and five corporate stocks.

---

## How to Play

### Accessing the Exchange
1. Hold a regular Book (`minecraft:book`) in your main hand.
2. Interact (right-click or tap) with a placed Bee Nest (`minecraft:bee_nest`) or Beehive (`minecraft:beehive`).
3. The main exchange interface will open.

---

## Features

### 1. Bank Account (Deposit & Withdraw)
- Deposit physical emeralds from your inventory into digital emerald balance (E), or withdraw digital balance back into physical emeralds.
- All trading instruments on the exchange operate using this digital balance (E).
- Inventory overflow protection is enabled: if your inventory is full during withdrawals or dividend collection, excess items automatically drop safely at your feet.

### 2. Forex Market
Trade five distinct currencies, each with unique baseline rates and price volatilities:

- Honeycomb (HNY): Base currency. Reliable and steady.
- Apple (APL): Moderate, predictable wave patterns.
- Sweet Berry (SWB): Low cost per unit with high, sharp volatility.
- Glow Berry (GLB): Growth-oriented currency with upward potential.
- Chorus Fruit (CHO): Extreme volatility with aggressive spikes and drops.

Trade volumes can be adjusted using stepper buttons (+/-). When buying into an existing position, average entry rates are automatically calculated via weighted averages.

### 3. Stock Market & Dividend System
Trade shares in five fictional corporate entities:

- Pupple (PPL): Smart collars and wearable gadgets (Motif: Dog)
- McMoonald (MCD): Fast food and dairy milk (Motif: Cow)
- Witcha-Cola (WCC): Secret-formula potion beverages (Motif: Witch)
- Clattle (CLT): Skeletal defense and hardware manufacturing (Motif: Skeleton)
- EekBay (EKB): Maritime express auction logistics (Motif: Dolphin)

#### Shareholder Dividend System
Holding at least 100E in total valuation (share price multiplied by shares owned) for a given stock qualifies the player for a daily dividend once per in-game day (`world.getDay()`):
- Pupple: Assorted cooked meat bundle
- McMoonald: Pumpkin pies and whole cake
- Witcha-Cola: Valuable brewing materials (Nether Wart, Blaze Powder, Glistering Melon Slices, etc.) and glass bottles
- Clattle: Bow, arrows, and bone meal
- EekBay: Rare marine items (Nautilus Shell, Heart of the Sea, or Prismarine Crystals)

### 4. Flower Futures
A leveraged derivative contract based on the Wither Rose Index with a two-day maturity window.
- Enter a long contract by posting a 5E margin deposit.
- Settle the contract on or after the maturity date (two in-game days after entry).
- If the settlement price is above the strike price, profits are credited to your balance. If it falls below, the net loss is deducted.
- **Default Penalty**: If settlement losses exceed your available account balance, your balance is set to zero and aggressive security bees will spawn immediately to attack the defaulting trader.

### 5. Cold Wallet (Offline Story Codes)
An offline asset preservation system that encodes account Honeycomb into a structured story code consisting of twenty keywords across five sentences. Codes can be shared via message boards, physical notes, or imported into different worlds.

- **Wallet Creation**: Set a personal secret word to derive a unique Public Key (PK-XXXXXX).
- **Exporting (Withdrawal)**: Withdraw Honeycomb from your account into an export code. Choose between two story themes: "Bees & Nature" or "Ores & Earth".
- **Clipboard Support**: Export results are presented inside a modal text field, allowing players on Android, mobile devices, and consoles to press, hold, select all, and copy with ease.
- **View Last Issued Code**: If an export screen is closed accidentally, the last generated code can be reviewed at any time via the wallet menu.
- **Importing (Deposit)**: Paste a story code to redeem its Honeycomb balance. The parser automatically extracts key nouns while ignoring punctuation, brackets, and filler words.
- **Security Logic**: Features monotonic nonce tracking to prevent replay attacks within the world, along with public-key-bound checksum signature verification.

---

## Weekly Economic Cycles & News

The economy operates on a continuous seven-day cycle based on Minecraft world days.
- When transitioning from Day 7 to Day 1, market random seeds refresh, establishing new price trends for the week.
- During the weekly rollover, the "Weekly Bee News" is broadcast to the chat log, providing contextual market signals based on underlying currency and stock seeds.

---

## Language Settings

Complete bilingual support for English and Japanese.
- The default language is auto-detected from the player's client locale.
- Language preferences can be changed manually at any time via the "Language" menu.

---

## Credits & Specifications

- Add-on Name: Bee My Honey
- Version: 0.1.1
- Author: Melnus
- Target Platform: Minecraft Bedrock Edition (Script API supported environments)
