import * as mc from "@minecraft/server";
import { stackKey } from "./variant-items.js";
import { stackFreshness } from "./freshness-lore.js";
import { getPrivateShulkerBlock } from "./private-shulker.js";

// ==========================================
// 運搬の持ち物 / Carrying  (チケットB: 運んでよ・緊急調達。運搬は手持ちでも専用シュルカーでも可)
// ------------------------------------------
// プレイヤーの持ち物(インベントリ)と、専用シュルカー(登録済みで読み込まれているとき)にある品を、数える・引く。インベントリが先。
// 品の判定は取引所と同じ(stackKey。名前つき・エンチャント付き等は対象外)。鮮度のある食品は、鮮度で受け取り額が変わる:
//   80%以上は満額 / 50%以下は半額 / 50%超〜79%は線形(1.0 → 0.5)。鮮度のスタンプがない品は満額。
//   (シュルカーの中では腐らないので、鮮度はしまった時点のまま。)
// ==========================================
export function freshFactor(percent) {
  if (percent === null || percent === undefined || percent >= 80) return 1;
  if (percent <= 50) return 0.5;
  return 0.5 + (0.5 * (percent - 50)) / 30;
}

function slotsOf(player, getBlock) {
  const out = [];
  const inv = player.getComponent?.("inventory")?.container;
  if (inv) out.push(inv);
  try {
    const b = getPrivateShulkerBlock(player.id, getBlock);
    const c = b ? b.getComponent("minecraft:inventory")?.container : null;
    if (c) out.push(c);
  } catch (e) { /* シュルカーを読めなければ手持ちだけ */ }
  return out;
}

export function countCarried(player, itemId, getBlock) {
  let n = 0;
  for (const c of slotsOf(player, getBlock)) for (let i = 0; i < c.size; i++) { const s = c.getItem(i); if (s && stackKey(s) === itemId) n += s.amount; }
  return n;
}

// 最大 qty 個を引く。戻り値: { n: 引けた数, factor: 鮮度による係数(個数で重みづけした平均) }
export function takeCarried(player, itemId, qty, getBlock) {
  let need = qty, weighted = 0;
  for (const c of slotsOf(player, getBlock)) {
    for (let i = 0; i < c.size && need > 0; i++) {
      const s = c.getItem(i);
      if (!s || stackKey(s) !== itemId) continue;
      const n = Math.min(need, s.amount);
      weighted += n * freshFactor(stackFreshness(s));
      if (n === s.amount) c.setItem(i, undefined); else { s.amount -= n; c.setItem(i, s); }
      need -= n;
    }
  }
  const n = qty - need;
  return { n, factor: n > 0 ? weighted / n : 1 };
}

// 持ち物に品を渡す。入りきらない分は足元に落とす。
export function giveCarried(player, itemId, n) {
  let left = n;
  while (left > 0) {
    const st = new mc.ItemStack(itemId, 1);
    st.amount = Math.min(left, st.maxAmount ?? 64);
    left -= st.amount;
    const rest = player.getComponent("inventory")?.container?.addItem(st);
    if (rest) player.dimension.spawnItem(rest, player.location);
  }
}
