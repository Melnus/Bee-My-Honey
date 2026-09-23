import { world, system } from "@minecraft/server";

import { MOB_EXCHANGE_BLOCKS } from "./data/mob-trade-data.js";

import { startWeeklyMarketCycle } from "./economy/market-engine.js";
import { startBankInterestOnSpawn } from "./economy/bank.js";
import { startInsuranceDeathWatch } from "./economy/insurance.js";

import { hasFlowerPotAbove, summonWanderingTrader, startTraderTetherLoop } from "./trader/wandering-trader.js";

import { openMainMenu } from "./ui/main-menu.js";
import { openMobTradeMenu } from "./ui/mob-trade-menu.js";
import { openGolemMenu } from "./ui/golem-menu.js";
import { openInsuranceMenu } from "./ui/insurance-menu.js";
import { openMailOrderMenu } from "./ui/mail-order-menu.js";

// ==========================================
// エントリーポイント / Bootstrap
// ==========================================
// 各機能モジュールが持つ「常時実行が必要な処理」（インターバルループやイベント購読）を
// ここでまとめて起動する。個々のロジックの中身は各モジュール側を参照。

// 経済変動エンジン: 週替わりの相場リセット・銀行利子付与・ニュース配信
startWeeklyMarketCycle();

// 口座＆インベントリ管理: ログイン時の銀行利子チェック
startBankInterestOnSpawn();

// 行商人召喚: 係留中の行商人の鈍足維持・引き戻しループ
startTraderTetherLoop();

// 保険: プレイヤー死亡を検知して契約中の保険を自動精算
startInsuranceDeathWatch();

// ==========================================
// 巣箱インタラクト判定 / 動物交易・行商人召喚の入口判定
// ==========================================
// 「本を持ってブロックを右クリック」を、各機能メニューへ振り分けるルーター。
// ここは各機能への入口の一覧性を保つため、あえて main.js に残している。
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block, itemStack } = event;
  if (!block || !itemStack) return;

  // 書見台 + 紙 → 郵便販売メニュー(Skein)。本ではなく紙が起点、植木鉢は不要。
  if (itemStack.typeId === "minecraft:paper" && block.typeId === "minecraft:lectern") {
    event.cancel = true;
    system.run(() => openMailOrderMenu(player));
    return;
  }

  if (itemStack.typeId !== "minecraft:book") return;

  // 骨ブロック + 真上に植木鉢 → 保険窓口
  if (block.typeId === "minecraft:bone_block" && hasFlowerPotAbove(block)) {
    event.cancel = true;
    system.run(() => openInsuranceMenu(player));
    return;
  }

  // 巣箱(プレイヤー設置)はこれまで通り、メインメニュー全体への入口として残す
  if (block.typeId === "minecraft:beehive") {
    event.cancel = true;
    system.run(() => openMainMenu(player));
    return;
  }

  // 巣(自然湧き)は単体でハチとの交易窓口にする
  if (block.typeId === "minecraft:bee_nest") {
    event.cancel = true;
    system.run(() => openMobTradeMenu(player, "honeycomb"));
    return;
  }

  // 白い羊毛 + 真上に植木鉢 → 行商人を呼び出す
  if (block.typeId === "minecraft:white_wool" && hasFlowerPotAbove(block)) {
    event.cancel = true;
    system.run(() => summonWanderingTrader(player, block));
    return;
  }

  // 鉄ブロック + 真上に植木鉢 → ゴーレムとの現物資産取引（宝石の実物投資）
  if (block.typeId === "minecraft:iron_block" && hasFlowerPotAbove(block)) {
    event.cancel = true;
    system.run(() => openGolemMenu(player));
    return;
  }

  // 通貨交易ブロック: 指定ブロック + 真上に植木鉢 → 対応する通貨の動物交易メニュー
  const currKey = MOB_EXCHANGE_BLOCKS[block.typeId];
  if (currKey && hasFlowerPotAbove(block)) {
    event.cancel = true;
    system.run(() => openMobTradeMenu(player, currKey));
  }
});

// 自然湧きの行商人はオフにして、上記の召喚方法に一本化する
// ※ gamerule doTraderSpawning は Java 版専用。Bedrock 版は mobevent で止める。
//   （スクリプトの spawnEntity による召喚は影響を受けない）
system.run(() => {
  try {
    world.getDimension("overworld").runCommand("mobevent minecraft:wandering_trader_event false");
  } catch (e) {
    console.warn("[BeeMyHoney] Failed to disable natural trader spawning: " + e);
  }
});
