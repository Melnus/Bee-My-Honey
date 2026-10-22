import { world, system, BlockPermutation } from "@minecraft/server";
import { coreName } from "../i18n/names.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import {
  CORE_TYPES, getCoreAtPos, listCores, listTombstones, loadCore, saveCore, readRec, runUpkeep, resumeDissolutions,
  recordPopulation, applyPendingFor, getLostCoreIds, dissolveCore, onlineIdsFor, getBadDebtTotal, IDS_KEY, CORE_PREFIX, resetCoreIndexForTest
} from "./core-registry.js";
import { getEntityAccount, deleteEntityAccount, getBalanceSheet } from "./account.js";
import { sellStockFor } from "./entity-stock.js";
import { postEntityRequestIfShort, entityShortage } from "./loan-market.js";
import { reservedCash } from "./village-demand.js";
import { coreNamePair } from "../i18n/names.js";
import { stockValue } from "./company-facility.js"; // 会社の仮想施設を、施設の提供元として登録する
import { startRegister, openCoreMenu, countNearby, broadcast } from "../ui/core-menu.js";

// ==========================================
// コアブロックの固定とイベント / Core Block Guard  (dev/corporate-template-spec.md 第3章)
// ------------------------------------------
// ・登記済みのコアブロックは、壊す操作を常にキャンセル(解散手続きの完了まで)。爆発は対象ブロックだけ除外。
// ・ロードストーンと鐘はピストンに反応しない(2026-10-16 確認)ので、ピストン対策は無い。
// ・コマンド(setblock/fill)などで消えたら、10秒ごとの見回りで復元する(読み込み済みのチャンクだけ)。
// ・見回りで、会社・村の日次の保守(runUpkeep)と、村の人口の記録も行う。
// 管理用: /scriptevent bmh:core list | info <ID> | dissolve <ID> | purge confirm | fakeapply [名前] | absent | present
// ==========================================
const SAC = "minecraft:glow_ink_sac";
const PATROL_TICKS = 200;

function blockOf(core) {
  try { return world.getDimension(core.dimId).getBlock({ x: core.x, y: core.y, z: core.z }); } catch (e) { return undefined; }
}

function restore(core, blk) {
  try {
    const perm = core.states && Object.keys(core.states).length ? BlockPermutation.resolve(core.blockType, core.states) : BlockPermutation.resolve(core.blockType);
    blk.setPermutation(perm);
  } catch (e) {
    blk.setType(core.blockType);
  }
  broadcast(STR.coreRestored, (l) => coreName(core, l));
}

// 村・会社が資金不足なら、まず溜まっている物資を売って埋める。それでも足りない分だけ、その日のうちに1回だけ借入依頼を出す
// (物資を溜め込んだまま借りない。日付ごとに判定。依頼が残っていれば重ねない)
const loanCheckedDay = new Map();
function checkLoanRequest(core) {
  const day = world.getDay();
  if (core.dissolving || loanCheckedDay.get(core.id) === day) return;
  loanCheckedDay.set(core.id, day);
  let acct = getEntityAccount(core.id);
  if (!acct) return;
  const reserved = reservedCash(core);
  const sh = entityShortage(acct, reserved);
  if (!(sh.shortage > 0)) return;
  sellStockFor(core, acct, sh.shortage);
  acct = getEntityAccount(core.id);
  const assets = Math.max(0, getBalanceSheet(acct).equity) + stockValue(core.stock);
  postEntityRequestIfShort({ id: core.id, kind: core.kind, names: coreNamePair(core) }, acct, reserved, assets);
}

function patrol() {
  resumeDissolutions();
  for (const core of listCores()) {
    const blk = blockOf(core);
    if (!blk) continue; // 読み込まれていないチャンクは次回に回す
    if (blk.typeId !== core.blockType) restore(core, blk);
    try {
      const ownerOnline = onlineIdsFor(core).has(core.ownerId);
      if (core.kind === "village") {
        const day = world.getDay();
        if (core.popDay !== day) {
          const n = countNearby(core);
          if (n.players.length > 0) recordPopulation(core, n, day); // 近くに誰もいない日は測らない(0扱いにしない)
        }
      }
      checkLoanRequest(core);
      const r = runUpkeep(core, { ownerOnline });
      if (r?.ok) {
        if (r.reason === "dissolved") broadcast(STR.coreBroadcastDissolved, (l) => coreName(core, l), core.id);
        else broadcast(STR.coreBroadcastForced, (l) => coreName(core, l), r.reason);
      }
    } catch (e) {
      console.warn("[BeeMyHoney] core patrol: " + e);
    }
  }
}

function adminCommand(ev) {
  const [cmd, a, b] = (ev.message ?? "").trim().split(/\s+/);
  const src = ev.sourceEntity;
  const say = (m) => (src && typeof src.sendMessage === "function" ? src.sendMessage(m) : console.warn("[BeeMyHoney] " + m));
  if (cmd === "list" || !cmd) {
    const act = listCores(), dead = listTombstones();
    say(`[Core] active ${act.length} / dissolved ${dead.length} / bad debt ${Math.round(getBadDebtTotal())}E`);
    for (const c of act) say(`${c.kind} ${c.id} ${c.name} / ${c.headName} @ ${c.x},${c.y},${c.z}${c.dissolving ? " (dissolving)" : ""}`);
    for (const c of dead) say(`§7dissolved ${c.id} ${c.name} (${c.reason}, day ${c.at})`);
  } else if (cmd === "info") {
    const c = loadCore(a);
    say(c ? JSON.stringify({ ...c, popHistory: undefined }) : "not found");
  } else if (cmd === "dissolve") {
    const c = loadCore(a);
    if (!c) return say("not found");
    const r = dissolveCore(c, { mode: b === "forced" ? "forced" : "voluntary", reason: b === "forced" ? "forced" : "dissolved" });
    say(r.ok ? `dissolved ${c.id}: result ${r.est.result}E` : `failed: ${r.reason}`);
  } else if (cmd === "purge" && a === "confirm") {
    for (const c of listCores()) if (getEntityAccount(c.id)) deleteEntityAccount(c.id);
    for (const key of world.getDynamicPropertyIds()) if (key.startsWith(CORE_PREFIX) || key === IDS_KEY) world.setDynamicProperty(key, undefined);
    resetCoreIndexForTest();
    say("all registrations erased (blocks remain)");
  } else if ((cmd === "fakeapply" || cmd === "absent" || cmd === "present") && src?.typeId === "minecraft:player") {
    let n = 0;
    for (const c of listCores("company")) {
      if (c.ownerId !== src.id) continue;
      if (cmd === "fakeapply") { const nm = a || "TestTaro"; c.applicants = [...(c.applicants ?? []), { id: `fake:${nm}`, name: nm, d: world.getDay() }]; }
      else if (cmd === "absent") c.testAbsent = true;
      else delete c.testAbsent;
      saveCore(c); n++;
    }
    say(`${cmd}: applied to ${n} company(ies)`);
  } else say("usage: list | info <ID> | dissolve <ID> [forced] | purge confirm | fakeapply [name] | absent | present");
}

export function startCoreGuard() {
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (!ev.isFirstEvent) return;
    const { block, player, itemStack } = ev;
    if (!CORE_TYPES[block.typeId]) return;
    const core = getCoreAtPos(block.dimension.id, block.x, block.y, block.z);
    if (core) { ev.cancel = true; system.run(() => openCoreMenu(player, core)); return; }
    if (itemStack?.typeId === SAC) { ev.cancel = true; system.run(() => startRegister(player, block)); }
  });

  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (!CORE_TYPES[ev.block.typeId] || !getCoreAtPos(ev.block.dimension.id, ev.block.x, ev.block.y, ev.block.z)) return;
    ev.cancel = true;
    const p = ev.player;
    system.run(() => p.sendMessage(t(getLang(p), STR.coreBreakBlocked)));
  });

  world.beforeEvents.explosion.subscribe((ev) => {
    const all = ev.getImpactedBlocks();
    const kept = all.filter((b) => !CORE_TYPES[b.typeId] || !getCoreAtPos(b.dimension.id, b.x, b.y, b.z));
    if (kept.length !== all.length) ev.setImpactedBlocks(kept);
  });

  // オフラインの間に清算の払い・信用の減点が保留されていたら、ログイン時に適用する
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    const p = ev.player;
    try {
      const r = applyPendingFor(p);
      if (!r) return;
      const lang = getLang(p);
      if (r.paid > 0) p.sendMessage(t(lang, STR.corePendingPaid, Math.round(r.paid).toLocaleString("en-US"), r.from.join(", ")));
      if (r.penalty > 0) p.sendMessage(t(lang, STR.corePendingPenalty, r.penalty));
    } catch (e) {
      console.warn("[BeeMyHoney] core pending: " + e);
    }
  });

  system.runInterval(() => {
    try { patrol(); } catch (e) { console.warn("[BeeMyHoney] core patrol: " + e); }
  }, PATROL_TICKS);

  // 事故(データ欠損)の通知は、読み込みが終わってから
  system.runTimeout(() => {
    try {
      const lost = getLostCoreIds();
      if (lost.length) for (const p of world.getAllPlayers()) p.sendMessage(t(getLang(p), STR.coreLostAccident, lost.join(", ")));
    } catch (e) { console.warn("[BeeMyHoney] core lost check: " + e); }
  }, 100);

  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:core") return;
    try { adminCommand(ev); } catch (e) { console.warn("[BeeMyHoney] bmh:core: " + e); }
  });
}
