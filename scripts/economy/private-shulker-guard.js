import { world, system, ItemStack } from "@minecraft/server";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { openPrivateShulkerMenu } from "../ui/private-shulker-menu.js";
import {
  isShulkerType, DANGER, ENTITY_DANGER, scanDanger, getBindingAt, listBindings, releaseBinding, touchSeen, takeLostNotice, peekLostNotice, patrolBindings, releaseAbsent
} from "./private-shulker.js";

// ==========================================
// 専用シュルカーの保護とイベント / Private Shulker Guard  (コアブロック core-guard.js と同じ作り)
// ------------------------------------------
// ・紐付いたシュルカー: 壊す操作は常にキャンセル(解除してから壊す)。爆発は対象から外す。持ち主以外が開く操作はキャンセル。
// ・本でシュルカーボックスを触ると、登録・移動・解除のメニューが開く。
// ・周り(2〜3マス)にホッパー・ピストン・TNTなどを置けない(DANGER)。あとから紛れ込んだ物は、3秒ごとの探査で撤去する(ブロックはアイテムとして落とす)。
// ・位置からシュルカーが無くなったら、見回り(10秒ごと)で解除して、持ち主に知らせる。
// ・持ち主が長く不在なら解除(private_shulker_absent_days)。ログインした持ち主には、解除された理由を1回だけ知らせる。
// 管理用: /scriptevent bmh:pshulker list | release <プレイヤー名>
// ==========================================
const PATROL_TICKS = 200;
const SWEEP_TICKS = 60;
const FACE = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] };

const posOf = (block) => ({ dimId: block.dimension.id, x: block.x, y: block.y, z: block.z, typeId: block.typeId });

export function onInteract(ev) {
  if (!ev.isFirstEvent) return;
  const { block, player, itemStack } = ev;
  if (!block || !isShulkerType(block.typeId)) return;
  const pos = posOf(block);
  const bound = getBindingAt(pos.dimId, pos.x, pos.y, pos.z);
  const lang = getLang(player);
  if (bound && bound.playerId !== player.id) {
    ev.cancel = true;
    system.run(() => player.sendMessage(t(lang, STR.pshOthers, bound.name ?? "?")));
    return;
  }
  if (itemStack?.typeId === "minecraft:book") {
    ev.cancel = true;
    system.run(() => openPrivateShulkerMenu(player, pos));
    return;
  }
  if (bound) system.run(() => { try { touchSeen(player.id, player.name, world.getDay()); } catch (e) {} });
}

// 登録済みシュルカーの近くに、禁止物(DANGER)を置こうとしたら止める。
export function onPlaceDanger(ev) {
  if (!ev.isFirstEvent) return;
  const radius = DANGER[ev.itemStack?.typeId];
  if (!radius) return;
  const off = FACE[ev.blockFace];
  if (!off) return;
  const { block, player } = ev;
  const x = block.x + off[0], y = block.y + off[1], z = block.z + off[2];
  const dimId = block.dimension.id;
  const near = listBindings().find((b) => b.dimId === dimId && Math.abs(b.x - x) <= radius && Math.abs(b.y - y) <= radius && Math.abs(b.z - z) <= radius);
  if (!near) return;
  ev.cancel = true;
  system.run(() => player.sendMessage(t(getLang(player), STR.pshDangerPlace, radius)));
}

// 周りの禁止エンティティ(ホッパー付き・TNTのトロッコ)を撤去する。戻り値: 撤去した数
function sweepEntities(dim, b) {
  const R = Math.max(...Object.values(ENTITY_DANGER));
  let n = 0;
  let ents = [];
  try {
    ents = dim.getEntities({ location: { x: b.x - R, y: b.y - R, z: b.z - R }, volume: { x: 2 * R + 1, y: 2 * R + 1, z: 2 * R + 1 } });
  } catch (e) { return 0; }
  for (const en of ents) {
    const r = ENTITY_DANGER[en.typeId];
    if (!r) continue;
    const l = en.location;
    if (Math.max(Math.abs(l.x - (b.x + 0.5)), Math.abs(l.y - (b.y + 0.5)), Math.abs(l.z - (b.z + 0.5))) > r + 0.5) continue;
    try {
      if (en.typeId === "minecraft:tnt_minecart") {
        dim.spawnItem(new ItemStack("minecraft:tnt_minecart", 1), l); // 爆発させず、アイテムとして落とす
        en.remove();
      } else en.kill();
      n++;
    } catch (e) { console.warn("[BeeMyHoney] private shulker sweep entity: " + e); }
  }
  return n;
}

// 登録済みシュルカーの周りの禁止ブロック・エンティティを撤去して、持ち主に知らせる。
export function sweep() {
  for (const b of listBindings()) {
    let dim;
    try { dim = world.getDimension(b.dimId); } catch (e) { continue; }
    const hits = scanDanger(b);
    for (const h of hits) {
      try { dim.runCommand(`setblock ${h.x} ${h.y} ${h.z} air destroy`); } catch (e) { console.warn("[BeeMyHoney] private shulker sweep: " + e); }
    }
    const ents = sweepEntities(dim, b);
    if (!hits.length && !ents) continue;
    const p = world.getPlayers().find((x) => x.id === b.playerId);
    if (p) p.sendMessage(t(getLang(p), STR.pshSwept, hits.length, ents));
  }
}

export function onBreak(ev) {
  const b = ev.block;
  if (!b || !isShulkerType(b.typeId) || !getBindingAt(b.dimension.id, b.x, b.y, b.z)) return;
  ev.cancel = true;
  const p = ev.player;
  system.run(() => p.sendMessage(t(getLang(p), STR.pshBreakBlocked)));
}

// 爆発の破壊対象から、紐付いたシュルカーを外す。戻り値: 残すブロックの配列
export function keepUnbound(blocks) {
  return blocks.filter((b) => !isShulkerType(b.typeId) || !getBindingAt(b.dimension.id, b.x, b.y, b.z));
}

function notify(playerId, reason) {
  const p = world.getPlayers().find((x) => x.id === playerId);
  if (!p) return false;
  p.sendMessage(t(getLang(p), STR.pshLost, reason));
  takeLostNotice(playerId);
  return true;
}

export function patrol() {
  const gone = [...patrolBindings(), ...releaseAbsent(world.getDay())];
  for (const id of gone) {
    const reason = peekLostNotice(id);
    if (reason) notify(id, reason);
  }
}
function adminCommand(ev) {
  const say = (m) => { try { ev.sourceEntity?.sendMessage?.(m); } catch (e) {} console.warn("[BeeMyHoney] bmh:pshulker: " + m); };
  const [cmd, ...rest] = String(ev.message ?? "").trim().split(/\s+/);
  if (cmd === "release") {
    const name = rest.join(" ");
    const b = listBindings().find((x) => x.name === name);
    if (!b) return say("not found: " + name);
    releaseBinding(b.playerId);
    return say("released: " + name);
  }
  const list = listBindings();
  say(`private shulkers: ${list.length}` + list.map((b) => `\n${b.name} ${b.dimId} (${b.x},${b.y},${b.z}) seen day ${b.seen}`).join(""));
}

export function startPrivateShulker() {
  world.beforeEvents.playerInteractWithBlock.subscribe(onInteract);
  world.beforeEvents.playerInteractWithBlock.subscribe(onPlaceDanger);
  world.beforeEvents.playerBreakBlock.subscribe(onBreak);
  world.beforeEvents.explosion.subscribe((ev) => {
    const all = ev.getImpactedBlocks();
    const kept = keepUnbound(all);
    if (kept.length !== all.length) ev.setImpactedBlocks(kept);
  });
  system.runInterval(() => { try { sweep(); } catch (e) { console.warn("[BeeMyHoney] private shulker sweep: " + e); } }, SWEEP_TICKS);
  system.runInterval(() => { try { patrol(); } catch (e) { console.warn("[BeeMyHoney] private shulker patrol: " + e); } }, PATROL_TICKS);

  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    const p = ev.player;
    try {
      touchSeen(p.id, p.name, world.getDay());
      const reason = takeLostNotice(p.id);
      if (reason) p.sendMessage(t(getLang(p), STR.pshLost, reason));
    } catch (e) { console.warn("[BeeMyHoney] private shulker spawn: " + e); }
  });

  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:pshulker") return;
    try { adminCommand(ev); } catch (e) { console.warn("[BeeMyHoney] bmh:pshulker: " + e); }
  });
}
