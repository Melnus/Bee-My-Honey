import { system } from "@minecraft/server";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// ==========================================
// 巣箱インタラクト判定 / 行商人召喚
// Wandering Trader Summon & Tethering
// ==========================================

// 対象ブロックの真上が「植木鉢」(何か植わっているものも含む)かどうかを判定する
export function hasFlowerPotAbove(block) {
  try {
    const above = block.above();
    if (!above) return false;
    return above.typeId === "minecraft:flower_pot" || above.typeId.startsWith("minecraft:potted_");
  } catch (e) {
    return false;
  }
}

// 召喚した行商人が畑などを踏み荒らして遠くへ歩いていかないよう、
// 召喚地点から一定距離を超えたら引き戻す「係留」リスト
const TETHERED_TRADERS = [];
const TRADER_LEASH_RADIUS = 1; // 押されたり殴られたりしてこれ以上ずれたら引き戻す
const TRADER_DESPAWN_RADIUS = 24; // この範囲内の既存の行商人は、新規召喚前に一掃する
// 召喚した行商人に付いてくるトレーダーラマは不要なので、湧いた直後（tick）に消す。
// 湧くタイミングが数tickずれる場合に備え、少し間を空けて2回掃除する。
const TRADER_LLAMA_CLEANUP_DELAYS = [5, 40];
const TRADER_SLOWNESS_DURATION = 72000; // 60分（tick）。切れる前に再召喚されることがほとんどのはず
// 鈍足は1レベルごとに移動速度が15%下がるので、7レベル以上で自力では歩けなくなる。最大値にして完全に固定する。
const TRADER_SLOWNESS_AMPLIFIER = 255;

// 行商人に鈍足を付ける。すでに十分な鈍足が付いていれば何もしない。
// 行商人は昼に牛乳を飲んで効果を全部消すことがあるため、係留チェックのたびに呼んで付け直す。
function ensureTraderSlowness(trader) {
  try {
    const cur = trader.getEffect("slowness");
    if (cur && cur.amplifier >= TRADER_SLOWNESS_AMPLIFIER && cur.duration > 200) return;
    trader.addEffect("slowness", TRADER_SLOWNESS_DURATION, {
      amplifier: TRADER_SLOWNESS_AMPLIFIER,
      showParticles: false
    });
  } catch (e) {
    console.warn("[BeeMyHoney] Trader slowness error: " + e);
  }
}

// 周辺の行商人（自然湧き分や、過去に呼んだ分の残り）とトレーダーラマを一掃する。
// 「無限に呼べてしまう」対策として、新規召喚の直前に必ず呼ぶ。
function despawnNearbyTraders(dimension, anchor) {
  try {
    const nearby = dimension.getEntities({
      type: "minecraft:wandering_trader",
      location: anchor,
      maxDistance: TRADER_DESPAWN_RADIUS
    });
    for (const trader of nearby) {
      try {
        trader.remove(); // 死亡演出なしで静かに消す
      } catch (e) {
        // 既に無効な場合は無視
      }
    }
  } catch (e) {
    console.warn("[BeeMyHoney] Trader despawn error: " + e);
  }

  despawnNearbyTraderLlamas(dimension, anchor);
}

// ラマ（や行商人）を消すとリードが地面に落ちるので、消したラマの位置の周りだけ掃除する。
// 落ちるタイミングが数tickずれることがあるため、すぐと少し後の2回行う。
const LEAD_SWEEP_RADIUS = 4;
const LEAD_SWEEP_DELAY = 2; // tick

function removeLeadItemsNear(dimension, location) {
  try {
    const items = dimension.getEntities({
      type: "minecraft:item",
      location,
      maxDistance: LEAD_SWEEP_RADIUS
    });
    for (const entity of items) {
      try {
        const stack = entity.getComponent("minecraft:item")?.itemStack;
        if (stack && stack.typeId === "minecraft:lead") entity.remove();
      } catch (e) {
        // 既に無効な場合は無視
      }
    }
  } catch (e) {
    console.warn("[BeeMyHoney] Lead cleanup error: " + e);
  }
}

// 行商人に付いてくるトレーダーラマ。行商人だけ消すと召喚のたびに残って増え続けるので、同じ範囲で一掃する。
function despawnNearbyTraderLlamas(dimension, anchor) {
  const removedAt = [];
  try {
    const llamas = dimension.getEntities({
      type: "minecraft:trader_llama",
      location: anchor,
      maxDistance: TRADER_DESPAWN_RADIUS
    });
    for (const llama of llamas) {
      try {
        // プレイヤーが手なずけた／名前を付けたラマは巻き込まない
        if (llama.nameTag || llama.getComponent("minecraft:is_tamed")) continue;
        const { x, y, z } = llama.location;
        llama.remove();
        removedAt.push({ x, y, z });
      } catch (e) {
        // 既に無効な場合は無視
      }
    }
  } catch (e) {
    console.warn("[BeeMyHoney] Trader llama despawn error: " + e);
  }

  // 消したラマの位置の周りに落ちたリードを消す（何も消していなければ何もしない）
  if (removedAt.length > 0) {
    const sweep = () => {
      for (const loc of removedAt) removeLeadItemsNear(dimension, loc);
    };
    sweep();
    system.runTimeout(sweep, LEAD_SWEEP_DELAY);
  }
}

export function summonWanderingTrader(player, block) {
  const lang = getLang(player);
  try {
    const loc = block.location;
    const anchor = { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 };

    // 呼び出し直前に周辺の行商人を一掃（無限召喚・湧きすぎ対策）
    despawnNearbyTraders(player.dimension, anchor);

    // ※ Bedrockでは手動召喚でもトレーダーラマが付いてくるので、召喚後に少し待ってから消す（下記）。
    const trader = player.dimension.spawnEntity("minecraft:wandering_trader", anchor);

    // 動き回らないよう鈍足化して固定（表示パーティクルはオフ）
    ensureTraderSlowness(trader);

    TETHERED_TRADERS.push({ entity: trader, anchor });

    // 付いてきたトレーダーラマを、召喚の少し後に消す
    const dimension = player.dimension;
    for (const delay of TRADER_LLAMA_CLEANUP_DELAYS) {
      system.runTimeout(() => despawnNearbyTraderLlamas(dimension, anchor), delay);
    }

    player.sendMessage(t(lang, STR.traderSummonMsg));
  } catch (e) {
    console.warn("[BeeMyHoney] Trader summon error: " + e);
  }
}

// 0.5秒(10tick)ごとに係留中の行商人をチェックし、鈍足を付け直して、離れすぎていたら召喚地点へ引き戻す。
// main.js の起動時に一度だけ呼び出す。
export function startTraderTetherLoop() {
  system.runInterval(() => {
  for (let i = TETHERED_TRADERS.length - 1; i >= 0; i--) {
    const tethered = TETHERED_TRADERS[i];
    if (!tethered.entity || !tethered.entity.isValid) {
      TETHERED_TRADERS.splice(i, 1); // 死亡/デスポーン/チャンクアンロードなどで無効化されたら追跡終了
      continue;
    }
    ensureTraderSlowness(tethered.entity);
    try {
      const loc = tethered.entity.location;
      const dx = loc.x - tethered.anchor.x;
      const dy = loc.y - tethered.anchor.y;
      const dz = loc.z - tethered.anchor.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > TRADER_LEASH_RADIUS * TRADER_LEASH_RADIUS) {
        tethered.entity.teleport(tethered.anchor);
      }
    } catch (e) {
      TETHERED_TRADERS.splice(i, 1);
    }
  }
  }, 10);
}
