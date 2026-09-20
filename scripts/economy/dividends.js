import { world } from "@minecraft/server";
import { STOCKS } from "../data/market-data.js";
import { getStockPrice } from "./market-engine.js";
import { giveItem } from "./bank.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// ==========================================
// 配当システム（安全な醸造素材セット）
// Stock Dividend System
// ==========================================
export const DIVIDEND_THRESHOLD = 100;

export function getDividendEligibility(player, key) {
  const price = getStockPrice(key);
  const holds = player.getDynamicProperty(`acc_stock_${key}`) ?? 0;
  const value = holds * price;
  const absDay = world.getDay();
  const lastClaim = player.getDynamicProperty(`div_last_claim_${key}`) ?? -1;
  return {
    eligible: value >= DIVIDEND_THRESHOLD,
    value,
    alreadyClaimedToday: lastClaim === absDay
  };
}

export function giveDividendReward(player, key) {
  const animal = STOCKS[key].animal;
  switch (animal) {
    case "dog":
      giveItem(player, "minecraft:cooked_beef", 4);
      giveItem(player, "minecraft:cooked_porkchop", 4);
      giveItem(player, "minecraft:cooked_chicken", 4);
      giveItem(player, "minecraft:cooked_mutton", 4);
      break;
    case "cow":
      giveItem(player, "minecraft:pumpkin_pie", 3);
      giveItem(player, "minecraft:cake", 1);
      break;
    case "witch": {
      // 醸造素材セット
      const POOL = [
        { id: "minecraft:nether_wart", count: 3 },
        { id: "minecraft:blaze_powder", count: 2 },
        { id: "minecraft:glistering_melon_slice", count: 2 },
        { id: "minecraft:golden_carrot", count: 2 },
        { id: "minecraft:magma_cream", count: 2 },
        { id: "minecraft:phantom_membrane", count: 1 }
      ];
      const pick = POOL[Math.floor(Math.random() * POOL.length)];
      giveItem(player, pick.id, pick.count);
      giveItem(player, "minecraft:glass_bottle", 3);
      break;
    }
    case "skeleton":
      giveItem(player, "minecraft:bow", 1);
      giveItem(player, "minecraft:arrow", 32);
      giveItem(player, "minecraft:bone_meal", 8);
      break;
    case "dolphin": {
      const pool = ["minecraft:nautilus_shell", "minecraft:heart_of_the_sea", "minecraft:prismarine_crystals"];
      const item = pool[Math.floor(Math.random() * pool.length)];
      giveItem(player, item, 1);
      break;
    }
  }
}

export function claimDividend(player, key) {
  const lang = getLang(player);
  const { eligible, value, alreadyClaimedToday } = getDividendEligibility(player, key);

  if (!eligible) {
    player.sendMessage(t(lang, STR.divNotEligible, DIVIDEND_THRESHOLD, value));
    return;
  }
  if (alreadyClaimedToday) {
    player.sendMessage(t(lang, STR.divAlreadyClaimed));
    return;
  }

  player.setDynamicProperty(`div_last_claim_${key}`, world.getDay());
  giveDividendReward(player, key);
  player.sendMessage(t(lang, STR.divClaimMsg, t(lang, STOCKS[key].name)));
}
