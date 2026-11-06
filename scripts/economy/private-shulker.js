import { world } from "@minecraft/server";
import { getPolicyParam } from "./policy.js";

// ==========================================
// 専用シュルカー / Private Shulker  (dev/sketch/sketch-exchange.md「専用シュルカー」)
// ------------------------------------------
// シュルカーボックスとプレイヤーを1対1で結ぶ(プライベート化)。取引所の入荷・出荷の受け口にするための土台。
//   ・1人につき1つ。紐付けは「位置(ディメンション・座標) + 持ち主のプレイヤーID」の記録で持つ(ブロックには印を付けられない)。
//   ・紐付けた間は、システムで保護する(壊す操作・爆発。持ち主以外が開く操作は止める。ui は private-shulker-guard.js)。
//   ・位置にシュルカーが無くなった(ピストンやコマンドで動いた/消えた)ら、見回りで解除して、持ち主に知らせる。
//   ・持ち主が private_shulker_absent_days 日を超えて不在なら解除する。
//   ・周り(チェビシェフ距離2〜3マス)に、中身を抜く・動かす・壊す物(ホッパー・ピストン・TNTなど)を置けない。登録の時に近くにあれば登録できず、あとから紛れ込んだ物は見回りで撤去する(作者の検証パック PrivateShulkerTest002 で動作確認済み)。
// このファイルはデータと API だけ(UI・イベントは持たない。循環importを避けるため)。
// 保存: 動的プロパティ bmh_pshulker = { v:1, by:{ [playerId]: {name, dimId, x, y, z, type, day, seen} }, lost:{ [playerId]: reason } }
// ==========================================
const KEY = "bmh_pshulker";

// 位置にあるブロックを返す関数。ディメンションが無い/チャンクが読み込まれていない時は undefined を返す。
function defaultGetBlock(dimId, x, y, z) {
  try { return world.getDimension(dimId).getBlock({ x, y, z }) ?? undefined; } catch (e) { return undefined; }
}

// 設置禁止のブロック/アイテムと、登録済みシュルカーからの距離(チェビシェフ距離)。
export const DANGER = {
  "minecraft:hopper": 2, "minecraft:piston": 2, "minecraft:sticky_piston": 2, "minecraft:dispenser": 2, "minecraft:dropper": 2,
  "minecraft:observer": 2, "minecraft:rail": 2, "minecraft:golden_rail": 2, "minecraft:detector_rail": 2, "minecraft:activator_rail": 2,
  "minecraft:hopper_minecart": 2, "minecraft:tnt_minecart": 3, "minecraft:tnt": 3, "minecraft:respawn_anchor": 3, "minecraft:end_crystal": 3
};
// エンティティ版(見回りで撤去する)。
export const ENTITY_DANGER = { "minecraft:hopper_minecart": 2, "minecraft:tnt_minecart": 3 };

export function isShulkerType(typeId) {
  return typeof typeId === "string" && typeId.startsWith("minecraft:") && typeId.endsWith("shulker_box");
}

function load() {
  const raw = world.getDynamicProperty(KEY);
  if (typeof raw === "string") {
    try {
      const d = JSON.parse(raw);
      if (d && d.v === 1 && d.by && typeof d.by === "object") { d.lost ??= {}; return d; }
    } catch (e) { console.warn("[BeeMyHoney] private shulker data unreadable: " + e); }
  }
  return { v: 1, by: {}, lost: {} };
}

function save(d) {
  world.setDynamicProperty(KEY, JSON.stringify(d));
}

export function getBinding(playerId) {
  const rec = load().by[playerId];
  return rec ? { playerId, ...rec } : null;
}

export function getBindingAt(dimId, x, y, z) {
  const d = load();
  for (const [playerId, rec] of Object.entries(d.by)) {
    if (rec.dimId === dimId && rec.x === x && rec.y === y && rec.z === z) return { playerId, ...rec };
  }
  return null;
}

export function listBindings() {
  return Object.entries(load().by).map(([playerId, rec]) => ({ playerId, ...rec }));
}

// 紐付ける。replace:true なら、その人の今の紐付けを解除して、ここへ移す。
// 戻り値: { ok:true, moved } | { ok:false, reason: "not_shulker" | "taken" | "same" | "has_other" }
export function bindShulker({ playerId, name, dimId, x, y, z, typeId, day, replace = false }) {
  if (!isShulkerType(typeId)) return { ok: false, reason: "not_shulker" };
  const d = load();
  const holder = Object.entries(d.by).find(([, r]) => r.dimId === dimId && r.x === x && r.y === y && r.z === z);
  if (holder && holder[0] !== playerId) return { ok: false, reason: "taken" };
  if (holder) return { ok: false, reason: "same" };
  const mine = d.by[playerId];
  if (mine && !replace) return { ok: false, reason: "has_other" };
  d.by[playerId] = { name, dimId, x, y, z, type: typeId, day, seen: day };
  delete d.lost[playerId];
  save(d);
  return { ok: true, moved: !!mine };
}

export function releaseBinding(playerId, lostReason = null) {
  const d = load();
  if (!d.by[playerId]) return false;
  delete d.by[playerId];
  if (lostReason) d.lost[playerId] = lostReason;
  save(d);
  return true;
}

// 持ち主が来た(ログイン・触った)ことを記録する。不在日数の起点。名前が変わっていたら更新する。
export function touchSeen(playerId, name, day) {
  const d = load();
  const rec = d.by[playerId];
  if (!rec) return false;
  if (rec.seen === day && rec.name === name) return true;
  rec.seen = day;
  rec.name = name;
  save(d);
  return true;
}

// 解除されて、まだ知らせていない理由を読む(消さない)。戻り値: reason | null
export function peekLostNotice(playerId) {
  return load().lost[playerId] ?? null;
}

// 解除されて知らせていない件を取り出す(1回きり)。戻り値: reason | null
export function takeLostNotice(playerId) {
  const d = load();
  const reason = d.lost[playerId] ?? null;
  if (reason) { delete d.lost[playerId]; save(d); }
  return reason;
}

// 見回り: 位置のブロックがシュルカーでなくなった紐付けを解除する(チャンクが読み込まれていない=getBlockが undefined の間は何もしない)。
// 戻り値: 解除した playerId の配列
export function patrolBindings(getBlock = defaultGetBlock) {
  const released = [];
  for (const b of listBindings()) {
    const block = getBlock(b.dimId, b.x, b.y, b.z);
    if (!block) continue;
    if (!isShulkerType(block.typeId)) { releaseBinding(b.playerId, "missing"); released.push(b.playerId); }
  }
  return released;
}

// 不在が長い持ち主の紐付けを解除する。戻り値: 解除した playerId の配列
export function releaseAbsent(day) {
  const limit = getPolicyParam("private_shulker_absent_days");
  const released = [];
  for (const b of listBindings()) {
    if (day - (b.seen ?? b.day ?? day) > limit) { releaseBinding(b.playerId, "absent"); released.push(b.playerId); }
  }
  return released;
}

// ---- 取引所などから使う API ----
// その人の専用シュルカーのブロックを返す。紐付けが無い=null、読み込まれていない=undefined、無くなっていた=解除して null
export function getPrivateShulkerBlock(playerId, getBlock = defaultGetBlock) {
  const b = getBinding(playerId);
  if (!b) return null;
  const block = getBlock(b.dimId, b.x, b.y, b.z);
  if (!block) return undefined;
  if (!isShulkerType(block.typeId)) { releaseBinding(playerId, "missing"); return null; }
  return block;
}

function containerOf(block) {
  try { return block.getComponent("minecraft:inventory")?.container ?? null; } catch (e) { return null; }
}

export function freeSlots(playerId, getBlock = defaultGetBlock) {
  const block = getPrivateShulkerBlock(playerId, getBlock);
  const c = block ? containerOf(block) : null;
  if (!c) return null;
  return c.emptySlotsCount ?? Array.from({ length: c.size }, (_, i) => c.getItem(i)).filter((s) => !s).length;
}

// アイテムを専用シュルカーへ入れる。入りきらなかった分は leftover で返す(呼び出し側が入荷一覧などに残す)。
//   戻り値: { ok:true, leftover:[ItemStack...] } | { ok:false, reason: "no_binding" | "unloaded", leftover:[...全部] }
export function depositToPrivateShulker(playerId, stacks, getBlock = defaultGetBlock) {
  const block = getPrivateShulkerBlock(playerId, getBlock);
  if (block === null) return { ok: false, reason: "no_binding", leftover: [...stacks] };
  if (block === undefined) return { ok: false, reason: "unloaded", leftover: [...stacks] };
  const c = containerOf(block);
  if (!c) return { ok: false, reason: "unloaded", leftover: [...stacks] };
  const leftover = [];
  for (const s of stacks) {
    const rest = c.addItem(s);
    if (rest) leftover.push(rest);
  }
  return { ok: true, leftover };
}

// 位置の周りにある設置禁止ブロックを全部探す。戻り値: [{ id, x, y, z }]。位置のチャンクが読み込まれていなければ空(調べない)。
export function scanDanger(pos, getBlock = defaultGetBlock) {
  const found = [];
  if (!getBlock(pos.dimId, pos.x, pos.y, pos.z)) return found;
  const R = Math.max(...Object.values(DANGER));
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
    if (!dx && !dy && !dz) continue;
    const b = getBlock(pos.dimId, pos.x + dx, pos.y + dy, pos.z + dz);
    const r = b && DANGER[b.typeId];
    if (r && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) <= r) found.push({ id: b.typeId, x: b.x ?? pos.x + dx, y: b.y ?? pos.y + dy, z: b.z ?? pos.z + dz });
  }
  return found;
}

// 登録しようとしている位置の周りに、禁止ブロックが既にあるか。最初の1つを返す(無ければ null)。
export function findDanger(pos, getBlock = defaultGetBlock) {
  return scanDanger(pos, getBlock)[0] ?? null;
}
