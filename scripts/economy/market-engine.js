import { world, system } from "@minecraft/server";
import { CURRENCIES, STOCKS, COMMODITIES } from "../data/market-data.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { applyBankInterest } from "./bank.js";

// ==========================================
// 経済変動エンジン / Economy Fluctuation Engine
// (相場計算・週間チャート・週替わりニュース配信)
// ==========================================
export function getCurrentCycleDay() {
  const day = world.getDay();
  return (day % 7) + 1;
}

export function getCurrencyRate(key, day = getCurrentCycleDay()) {
  const c = CURRENCIES[key];
  const seed = world.getDynamicProperty(`curr_seed_${key}`) ?? 1;
  const sinVal = Math.sin(day * 0.9 + seed);
  const rate = c.baseRate * (1.0 + sinVal * c.volatility);
  return Math.max(0.2, parseFloat(rate.toFixed(1)));
}

export function getStockPrice(key, day = getCurrentCycleDay()) {
  const s = STOCKS[key];
  const seed = world.getDynamicProperty(`stock_seed_${key}`) ?? 1;
  const sinVal = Math.sin(day * 1.2 + seed);
  const price = s.base * (1.0 + sinVal * s.vol);
  return Math.max(2, Math.round(price));
}

export function getCommodityPrice(key, day = getCurrentCycleDay()) {
  const c = COMMODITIES[key];
  const seed = world.getDynamicProperty(`commodity_seed_${key}`) ?? 1;
  const sinVal = Math.sin(day * 1.05 + seed);
  const price = c.baseRate * (1.0 + sinVal * c.volatility);
  return Math.max(0.5, parseFloat(price.toFixed(1)));
}

export function getWeekCommodityPrices(key) {
  const prices = [];
  for (let d = 1; d <= 7; d++) prices.push(getCommodityPrice(key, d));
  return prices;
}

// 1〜7日目までの相場を配列で取得（週間の浮き沈みチャート用）
export function getWeekCurrencyRates(key) {
  const rates = [];
  for (let d = 1; d <= 7; d++) rates.push(getCurrencyRate(key, d));
  return rates;
}

export function getWeekStockPrices(key) {
  const prices = [];
  for (let d = 1; d <= 7; d++) prices.push(getStockPrice(key, d));
  return prices;
}

// ボタン一覧用：1行の簡易スパークライン（ブロック文字の高さで波を表現）
const SPARK_BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
export function buildSparkline(weekValues) {
  const min = Math.min(...weekValues);
  const max = Math.max(...weekValues);
  const span = max - min;
  let out = "";
  for (let i = 0; i < weekValues.length; i++) {
    const v = weekValues[i];
    const level = span <= 0 ? Math.floor((SPARK_BLOCKS.length - 1) / 2) : Math.round(((v - min) / span) * (SPARK_BLOCKS.length - 1));
    const color = i === 0 ? "§7" : v > weekValues[i - 1] ? "§a" : v < weekValues[i - 1] ? "§c" : "§7";
    out += `${color}${SPARK_BLOCKS[level]}`;
  }
  return out + "§r";
}

// 詳細画面用：日数ごとにアイテムアイコンが上下する「浮き沈みチャート」
// (折れ線の代わりに、価格の高い日ほどアイコンを上段に配置して波を表現する)
export function buildIconWaveChart(icon, weekValues, currentDay, rows = 4) {
  const min = Math.min(...weekValues);
  const max = Math.max(...weekValues);
  const span = max - min;

  const levels = weekValues.map((v) => {
    if (span <= 0) return Math.floor((rows - 1) / 2);
    return Math.round(((v - min) / span) * (rows - 1));
  });

  const lines = [];
  for (let r = rows - 1; r >= 0; r--) {
    let line = "";
    for (let d = 0; d < 7; d++) {
      const isCurrent = d + 1 === currentDay;
      line += levels[d] === r ? (isCurrent ? `§e●§r` : `${icon}§r`) : "§8・§r";
      line += " ";
    }
    lines.push(line.trimEnd());
  }

  let dayRow = "";
  for (let d = 1; d <= 7; d++) {
    dayRow += (d === currentDay ? `§e${d}§r` : `§7${d}§r`) + "  ";
  }
  lines.push(`§7────────────────§r`);
  lines.push(dayRow.trimEnd());

  return lines.join("\n");
}

// 毎週の経済ニュース配信
export function broadcastWeeklyNews() {
  for (const p of world.getPlayers()) {
    const lang = getLang(p);
    p.sendMessage(t(lang, STR.marketNewsHeader));

    const choSeed = world.getDynamicProperty("curr_seed_chorus_fruit") ?? 1;
    if (choSeed > 6.5) {
      p.sendMessage(
        lang === "ja"
          ? "§d【外為速報】エンド界の果実豊作！CHO為替が急激に乱高下する予兆。"
          : "§d[Forex Alert] Chorus harvest boom! High volatility expected for CHO."
      );
    } else if (choSeed < 3.5) {
      p.sendMessage(
        lang === "ja"
          ? "§c【外為警戒】果樹園に気候異変？CHOの供給不安で下落リスクを警戒。"
          : "§c[Forex Alert] Climate shifts in orchards. Downward risk on CHO supply."
      );
    }

    const pplSeed = world.getDynamicProperty("stock_seed_pupple") ?? 1;
    if (pplSeed > 6.0) {
      p.sendMessage(
        lang === "ja"
          ? "§a【株式ニュース】Pupple社が次世代スマート首輪を発表！強気の買い気配。"
          : "§a[Stock News] Pupple unveils next-gen smart collar! Strong buy sentiment."
      );
    }

    const wccSeed = world.getDynamicProperty("stock_seed_witcha_cola") ?? 1;
    if (wccSeed > 7.0) {
      p.sendMessage(
        lang === "ja"
          ? "§e【株式ニュース】Witcha-Colaの秘伝レシピ人気爆発！株価急騰の気配。"
          : "§e[Stock News] Witcha-Cola potion drinks surge in popularity! Bullish trend."
      );
    }

    p.sendMessage(
      lang === "ja"
        ? "§f【今週の指針】新しい週が始まりました！市場の変動にご注意ください。"
        : "§f[Market Overview] A new week has begun! Watch market fluctuations closely."
    );
    p.sendMessage(t(lang, STR.marketNewsFooter));
  }
}

// 週替わりの経済リセット（相場シード再生成・銀行利子付与・ニュース配信）を
// 開始するインターバルループ。main.js の起動時に一度だけ呼び出す。
export function startWeeklyMarketCycle() {
  system.runInterval(() => {
  const day = getCurrentCycleDay();
  const lastDay = world.getDynamicProperty("last_checked_day") ?? 0;
  if (day === 1 && lastDay === 7) {
    for (const k of Object.keys(CURRENCIES)) {
      world.setDynamicProperty(`curr_seed_${k}`, Math.random() * 10);
    }
    for (const k of Object.keys(STOCKS)) {
      world.setDynamicProperty(`stock_seed_${k}`, Math.random() * 10);
    }
    for (const k of Object.keys(COMMODITIES)) {
      world.setDynamicProperty(`commodity_seed_${k}`, Math.random() * 10);
    }
    applyBankInterest();
    broadcastWeeklyNews();
  }
  world.setDynamicProperty("last_checked_day", day);
  }, 1200);
}
