import * as mc from "@minecraft/server";
import { JOB_BLOCKS, JOB_BLOCK_IDS } from "../data/village-jobs-data.js";
import { getPolicyParam } from "./policy.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { getPriceLevel } from "./price-level.js";
import { saveCore } from "./core-registry.js";
import { buyForEntity } from "./exchange.js";

// ==========================================
// 村の職業ブロックと手工業 / Village Jobs  (dev/sketch/sketch-village-jobs.md)
// ------------------------------------------
// ・検知: 村のコアの範囲(水平±64 / 高さ±32)にある職業ブロックの数を、1日1回(近くにプレイヤーがいる日)数える。core.jobs = { ブロックID: 数 }。
//   村人の数は村の規模(core.pop)を表すだけ。何を作るかは、ブロックの数だけで決まる。
// ・生産(週の締め。economy/village-demand.js の settleVillageStock から呼ぶ):
//     ①原料の不足を、取引所で買う(プレイヤーの納品のあと。予算は現金の village_buy_budget_ratio まで。単価は基準価格まで)
//     ②1ブロックにつき1日 village_job_runs 回(×7日)まで、レシピで加工する
//   作った物は、呼び出し側が取引所へ出品する(単価は 基準 × village_product_ratio。HRMHRMの売値以下)。
// ・クエストの需要: 職業のある村は、職業の原料が先に枠に載る(jobInputNeeds)。職業ブロックのない村は、従来の固定表のまま。
// ==========================================
const DAYS_PER_WEEK = 7;
const KEEP_WEEKS = 2; // 使い切れなかった原料は、この週数ぶんまで持ち越す

// ---- 検知 ----
// 範囲のブロックを数える。getBlocks の戻り(ListBlockVolume)は「条件に合った場所の集まり」で、個数は getBlockLocationIterator() を回して数える
// (getCapacity() は箱の体積を返すもので、個数ではない)。読み込まれていないチャンクがあると、allowUnloadedChunks:false では例外になるので、
// 範囲をチャンク(16×16の柱)ごとの小箱に分け、読み込まれている小箱だけ数える。
// 戻り値: { counts:{ブロックID:数}, loaded:読み込めた小箱の数, total:小箱の数 }。1つも読み込めなければ null(測れなかった)。
export const SCAN_RANGE_XZ = 64, SCAN_RANGE_Y = 32;
const SCAN_HIT_MAX = 4000; // 1回の検知で、場所を調べる数の上限(職業ブロックだらけの村での負荷の頭打ち)
export function scanJobBlocks(core, dim) {
  const y0 = Math.max(dim.heightRange?.min ?? -64, core.y - SCAN_RANGE_Y), y1 = Math.min((dim.heightRange?.max ?? 320) - 1, core.y + SCAN_RANGE_Y);
  const minX = core.x - SCAN_RANGE_XZ, maxX = core.x + SCAN_RANGE_XZ, minZ = core.z - SCAN_RANGE_XZ, maxZ = core.z + SCAN_RANGE_XZ;
  const counts = {};
  let loaded = 0, total = 0, hits = 0;
  for (let cx = Math.floor(minX / 16); cx <= Math.floor(maxX / 16); cx++) {
    for (let cz = Math.floor(minZ / 16); cz <= Math.floor(maxZ / 16); cz++) {
      total++;
      const fx = Math.max(minX, cx * 16), tx = Math.min(maxX, cx * 16 + 15), fz = Math.max(minZ, cz * 16), tz = Math.min(maxZ, cz * 16 + 15);
      try {
        // 小箱の中ほどが読み込まれているか(読み込み外は getBlock が undefined、または例外)
        if (!dim.getBlock({ x: Math.floor((fx + tx) / 2), y: Math.min(Math.max(core.y, y0), y1), z: Math.floor((fz + tz) / 2) })) continue;
        const found = dim.getBlocks(new mc.BlockVolume({ x: fx, y: y0, z: fz }, { x: tx, y: y1, z: tz }), { includeTypes: JOB_BLOCK_IDS }, true);
        loaded++;
        for (const loc of found.getBlockLocationIterator()) {
          if (++hits > SCAN_HIT_MAX) break;
          const id = dim.getBlock(loc)?.typeId;
          if (id && JOB_BLOCKS[id]) counts[id] = (counts[id] ?? 0) + 1;
        }
      } catch (e) {
        console.warn("[BeeMyHoney] job scan box skipped: " + e);
      }
    }
  }
  return loaded > 0 ? { counts, loaded, total } : null;
}

// 検知結果を村に記録する。一部の小箱が読み込めなかったとき(loaded < total)は、数が減らないように、前の記録より小さくしない。
export function recordJobs(core, scan, day) {
  const partial = scan.loaded < scan.total;
  const counts = { ...scan.counts };
  if (partial) for (const [id, n] of Object.entries(core.jobs ?? {})) counts[id] = Math.max(counts[id] ?? 0, n);
  core.jobs = counts;
  core.jobsDay = day;
  core.jobsPartial = partial || undefined;
  saveCore(core);
  if (partial) console.warn(`[BeeMyHoney] job scan partial: ${scan.loaded}/${scan.total} areas loaded (${core.id})`);
}

// 今日の検知が済んでいない村か(popDay とは別に、見回りのたびに再試行するための判定)
export const needsJobScan = (core, day) => core.jobsDay !== day;

// ---- 職業から決まるもの ----
export function jobCounts(core) {
  const out = [];
  for (const [id, n] of Object.entries(core?.jobs ?? {})) if (n > 0 && JOB_BLOCKS[id]) out.push({ blockId: id, n, ...JOB_BLOCKS[id] });
  return out;
}
// 生産できる職業(レシピのあるもの)があるか
export function hasProduction(core) { return jobCounts(core).some((j) => j.recipes.length > 0); }

// 1週に回せる回数(職業ごと。ブロックの数 × 1日の回数 × 7日)
export function weeklyRuns(n) { return Math.max(1, Math.floor(getPolicyParam("village_job_runs"))) * n * DAYS_PER_WEEK; }

// クエストで欲しがる原料と、1日あたりの量: { itemId: { perDay } }
export function jobInputNeeds(core) {
  const out = {};
  const perBlockDay = Math.max(1, Math.floor(getPolicyParam("village_job_runs")));
  for (const j of jobCounts(core)) {
    for (const r of j.recipes) for (const [id, q] of Object.entries(r.inputs)) {
      if (id.includes("#")) continue; // 種類つきの品は、クエストで納品できない(取引所で買うだけ)
      out[id] = out[id] ?? { perDay: 0 };
      out[id].perDay += Math.ceil((perBlockDay * j.n * q) / Math.max(1, j.recipes.length));
    }
  }
  return out;
}

// 持ち越す原料の量(週の締めで消費されずに残す分)
export function jobInputKeep(core) {
  const keep = {};
  for (const j of jobCounts(core)) for (const r of j.recipes) for (const [id, q] of Object.entries(r.inputs)) {
    keep[id] = (keep[id] ?? 0) + Math.ceil((weeklyRuns(j.n) * q * KEEP_WEEKS) / j.recipes.length);
  }
  return keep;
}

export function productPrice(itemId) {
  return getItemBasePriceExact(itemId) * getPriceLevel() * getPolicyParam("village_product_ratio");
}

// 週の締めの生産。core.stock を直接更新する(保存は呼び出し側)。購入の代金は口座から引かず、spent で返す(週次処理が引く)。
// budget: 原料の購入に使える額。戻り値: { bought: {id: n}, produced: {id: n}, spent }
export function runVillageProduction(core, budget) {
  const res = { bought: {}, produced: {}, spent: 0 };
  core.stock ??= {};
  const jobs = jobCounts(core).filter((j) => j.recipes.length > 0);
  if (jobs.length === 0) return res;

  // ① 原料の不足を、取引所で買う
  const need = {};
  for (const j of jobs) for (const r of j.recipes) for (const [id, q] of Object.entries(r.inputs)) {
    need[id] = (need[id] ?? 0) + Math.ceil((weeklyRuns(j.n) * q) / j.recipes.length);
  }
  let left = budget;
  for (const [id, total] of Object.entries(need)) {
    const short = total - (core.stock[id] ?? 0);
    if (short <= 0 || left <= 0) continue;
    const cap = Math.max(1, Math.floor(getItemBasePriceExact(id) * getPriceLevel()));
    const r = buyForEntity({ entityId: core.id, itemId: id, qty: short, maxUnitPrice: cap, budget: left, deferDebit: true });
    if (r.qty > 0) { core.stock[id] = (core.stock[id] ?? 0) + r.qty; res.bought[id] = r.qty; res.spent += r.spent; left -= r.spent; }
  }

  // ② 加工(職業ごとに、回数の上限まで。レシピは順に、原料のあるだけ)
  for (const j of jobs) {
    let runsLeft = weeklyRuns(j.n);
    for (const r of j.recipes) {
      if (runsLeft <= 0) break;
      let n = runsLeft;
      for (const [id, q] of Object.entries(r.inputs)) n = Math.min(n, Math.floor((core.stock[id] ?? 0) / q));
      if (n < 1) continue;
      for (const [id, q] of Object.entries(r.inputs)) core.stock[id] -= q * n;
      core.stock[r.out] = (core.stock[r.out] ?? 0) + n * r.outQty;
      res.produced[r.out] = (res.produced[r.out] ?? 0) + n * r.outQty;
      runsLeft -= n;
    }
  }
  return res;
}
