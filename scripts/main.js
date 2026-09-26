import { world, system } from "@minecraft/server";

import { MOB_EXCHANGE_BLOCKS } from "./data/mob-trade-data.js";

import { startWeeklyMarketCycle } from "./economy/market-engine.js";
import { startBankInterestOnSpawn } from "./economy/bank.js";
import { startInsuranceDeathWatch } from "./economy/insurance.js";

import { hasFlowerPotAbove, summonWanderingTrader, startTraderTetherLoop } from "./trader/wandering-trader.js";

import { openTradingMenu } from "./ui/trading-menu.js";
import { openMobTradeMenu } from "./ui/mob-trade-menu.js";
import { openGolemMenu } from "./ui/golem-menu.js";
import { openInsuranceMenu } from "./ui/insurance-menu.js";
import { openMailOrderMenu } from "./ui/mail-order-menu.js";
import { openLaborMenu } from "./ui/labor-menu.js";
import { recordLicenseWork } from "./economy/labor.js";

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

  // 書見台 + 本 → HRMHRM Partners HLD 労働市場ポータル
  if (block.typeId === "minecraft:lectern") {
    event.cancel = true;
    system.run(() => openLaborMenu(player, block.location));
    return;
  }

  // 骨ブロック + 真上に植木鉢 → 保険窓口
  if (block.typeId === "minecraft:bone_block" && hasFlowerPotAbove(block)) {
    event.cancel = true;
    system.run(() => openInsuranceMenu(player));
    return;
  }

  // 巣箱(プレイヤー設置)はこれまで通り、メインメニュー全体への入口として残す
  if (block.typeId === "minecraft:beehive") {
    event.cancel = true;
    system.run(() => openTradingMenu(player));
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

// ==========================================
// 労働市場ライセンス: 実測進捗トラッキング
// ------------------------------------------
// スタッフサービスの資格(ネザー/水中/エンド)は「試験に金を払って運試し」ではなく、
// 実際にその分野の作業(対象ブロックの設置/破壊)を行った実績で進捗する。
// ==========================================
world.afterEvents.playerPlaceBlock.subscribe((event) => {
  try {
    let biomeId;
    try {
      biomeId = event.dimension.getBiome(event.block.location)?.id;
    } catch (e) {
      biomeId = undefined; // 未読み込みチャンク等は判定不能として扱う(バイオーム指定があるライセンスは進捗しない)
    }
    recordLicenseWork(event.player, event.block.typeId, "place", event.block.location, event.dimension.id, biomeId);
  } catch (e) {
    console.warn("[BeeMyHoney] License tracking (place) error: " + e);
  }
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    // 破壊前のブロック情報(brokenBlockPermutation)から typeId を取る
    const typeId = event.brokenBlockPermutation?.type?.id;
    if (!typeId) return;
    let biomeId;
    try {
      biomeId = event.dimension.getBiome(event.block.location)?.id;
    } catch (e) {
      biomeId = undefined;
    }
    recordLicenseWork(event.player, typeId, "break", event.block.location, event.dimension.id, biomeId);
  } catch (e) {
    console.warn("[BeeMyHoney] License tracking (break) error: " + e);
  }
});
