// ==========================================
// 金融商品定義データ / Financial Instrument Data
// (外貨・株式・現物資産の基礎パラメータとアイコン)
// ==========================================

export const CURRENCIES = {
  honeycomb: {
    name: { ja: "ハニカム (HNY)", en: "Honeycomb (HNY)" },
    baseRate: 2.0,
    volatility: 0.2,
    desc: { ja: "基軸通貨・手堅い安定性", en: "Base Currency (Stable)" }
  },
  apple: {
    name: { ja: "リンゴ (APL)", en: "Apple (APL)" },
    baseRate: 1.5,
    volatility: 0.4,
    desc: { ja: "平穏な波型", en: "Moderate Waves" }
  },
  sweet_berry: {
    name: { ja: "スイートベリー (SWB)", en: "Sweet Berry (SWB)" },
    baseRate: 0.8,
    volatility: 0.7,
    desc: { ja: "少額・激しい乱高下", en: "Low Cost, High Volatility" }
  },
  glow_berry: {
    name: { ja: "グローベリー (GLB)", en: "Glow Berry (GLB)" },
    baseRate: 3.0,
    volatility: 0.5,
    desc: { ja: "伸びしろのある成長型", en: "Growth Potential" }
  },
  chorus_fruit: {
    name: { ja: "コーラスフルーツ (CHO)", en: "Chorus Fruit (CHO)" },
    baseRate: 5.0,
    volatility: 1.2,
    desc: { ja: "超ハイリスク・急騰急落", en: "Extreme Volatility" }
  }
};

export const STOCKS = {
  pupple: {
    name: { ja: "Pupple (PPL)", en: "Pupple (PPL)" },
    base: 32,
    vol: 0.35,
    desc: { ja: "ハイテク首輪・デバイス", en: "Smart Collars & Gadgets" },
    animal: "dog"
  },
  mcmoonald: {
    name: { ja: "McMoonald (MCD)", en: "McMoonald (MCD)" },
    base: 22,
    vol: 0.15,
    desc: { ja: "ファストフード・ミルク", en: "Fast Food & Dairy Milk" },
    animal: "cow"
  },
  witcha_cola: {
    name: { ja: "Witcha-Cola (WCC)", en: "Witcha-Cola (WCC)" },
    base: 65,
    vol: 0.85,
    desc: { ja: "秘伝ポーション飲料", en: "Secret Formula Potion Drink" },
    animal: "witch"
  },
  clattle: {
    name: { ja: "Clattle (CLT)", en: "Clattle (CLT)" },
    base: 40,
    vol: 0.55,
    desc: { ja: "骨格防衛・遠隔重工", en: "Skeletal Defense & Hardware" },
    animal: "skeleton"
  },
  eekbay: {
    name: { ja: "EekBay (EKB)", en: "EekBay (EKB)" },
    base: 18,
    vol: 0.45,
    desc: { ja: "海洋オークション物流", en: "Maritime Express Auction" },
    animal: "dolphin"
  }
};

// 現物資産（ゴーレムの宝石取引）: 通貨/株式とは別に、実アイテムそのものを
// エメラルドで直接売買する「現物投資」枠。買値=売値で、利益/損失は価格変動そのものから生まれる。
export const COMMODITIES = {
  diamond: {
    name: { ja: "ダイヤモンド (DIA)", en: "Diamond (DIA)" },
    itemId: "minecraft:diamond",
    key: "item.diamond.name",
    baseRate: 12,
    volatility: 0.3,
    desc: { ja: "希少な現物資産・値動き中程度", en: "Rare physical asset, moderate swings" }
  },
  gold_ingot: {
    name: { ja: "金インゴット (AU)", en: "Gold Ingot (AU)" },
    itemId: "minecraft:gold_ingot",
    key: "item.gold_ingot.name",
    baseRate: 5,
    volatility: 0.15,
    desc: { ja: "伝統的な安定資産", en: "Traditional stable asset" }
  },
  lapis_lazuli: {
    name: { ja: "ラピスラズリ (LAP)", en: "Lapis Lazuli (LAP)" },
    itemId: "minecraft:lapis_lazuli",
    key: "item.dye.blue.name",
    baseRate: 1.5,
    volatility: 0.5,
    desc: { ja: "小口で値動きはやや荒め", en: "Small denomination, choppier moves" }
  }
};

// 通貨/銘柄ごとの表示アイコン（絵文字は環境によって「?」化するため色付き●で代用）
export const CURRENCY_ICONS = {
  honeycomb: "§6●",
  apple: "§c●",
  sweet_berry: "§d●",
  glow_berry: "§b●",
  chorus_fruit: "§5●"
};
export const STOCK_ICONS = {
  pupple: "§9●",
  mcmoonald: "§f●",
  witcha_cola: "§d●",
  clattle: "§7●",
  eekbay: "§b●"
};
export const COMMODITY_ICONS = {
  diamond: "§b●",
  gold_ingot: "§6●",
  lapis_lazuli: "§9●"
};
