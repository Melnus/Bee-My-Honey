// エメラルド発行台帳の検算スクリプト(Node 20+)。
//   node dev/check_ledger.mjs scripts      (パックのルートで実行)
// 1. 静的検査: ledger.js 以外に acc_emeralds への直接書き込みが無いか
// 2. 動的検査(スタブのworld/player): 乱数で入出金を繰り返し、
//    「全プレイヤー残高の合計」= 「台帳の in − out」 の恒等式、clamp、週バケットの間引き、集計を確認
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? "scripts");
let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };

// ---- 1. 静的検査 ----
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith(".js") ? [path.join(dir, d.name)] : []);
}
for (const f of walk(root)) {
  if (f.endsWith(path.join("economy", "ledger.js"))) continue;
  const src = fs.readFileSync(f, "utf8");
  if (/setDynamicProperty\(\s*["'`]acc_emeralds["'`]/.test(src)) fail(`直接書き込み: ${path.relative(root, f)}`);
}

// ---- 2. 動的検査 ----
const store = () => { const m = new Map(); return { getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => (v === undefined ? m.delete(k) : m.set(k, v)) }; };
globalThis.__stubWorld = { day: 0, ...store(), getDay() { return this.day; }, getPlayers() { return []; } };
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export const world = globalThis.__stubWorld; export const system = { afterEvents: { scriptEventReceive: { subscribe(){} } } };"}; return n(u,c); }
`));
const L = await import(pathToFileURL(path.join(root, "economy/ledger.js")).href);
const { FLOW, GROUP_OF } = L;

const players = Array.from({ length: 4 }, () => store());
const sum = () => players.reduce((a, p) => a + (p.getDynamicProperty("acc_emeralds") ?? 0), 0);
const cats = Object.values(FLOW);
for (const c of cats) if (!(c in GROUP_OF)) fail(`GROUP_OF に無いカテゴリ: ${c}`);

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
for (let i = 0; i < 5000; i++) {
  globalThis.__stubWorld.day = Math.floor(i / 40) * 7; // 週が進む
  const p = players[Math.floor(rnd() * players.length)];
  const cat = cats[Math.floor(rnd() * cats.length)];
  const amt = Math.floor(rnd() * 500);
  const op = rnd();
  if (op < 0.45) L.creditEmeralds(p, amt, cat);
  else if (op < 0.75) L.debitEmeralds(p, amt, cat);
  else if (op < 0.9) L.debitEmeralds(p, amt, cat, { clamp: true });
  else L.applyEmeraldDelta(p, Math.floor((rnd() - 0.5) * 800), cat);
  if (players.some((q) => (q.getDynamicProperty("acc_emeralds") ?? 0) < 0)) { fail("残高が負になった"); break; }
}
const r = L.getLedgerReport(LEDGER_WEEKS());
function LEDGER_WEEKS() { return L.LEDGER_KEEP_WEEKS; }
if (r.total.net !== sum()) fail(`恒等式が崩れた: 台帳 in−out=${r.total.net} / 残高合計=${sum()}`);

// 週バケットの間引き(直近12週のみ残る。累計は残る)
const raw = JSON.parse(globalThis.__stubWorld.getDynamicProperty("bmh_ledger_v1"));
if (Object.keys(raw.weeks).length > L.LEDGER_KEEP_WEEKS) fail(`週バケットが間引かれていない: ${Object.keys(raw.weeks).length}`);

// 個別の挙動
const q = store();
L.creditEmeralds(q, 100, FLOW.QUEST_WAGE);
if (L.debitEmeralds(q, 150, FLOW.MAIL_ORDER) !== 0 || q.getDynamicProperty("acc_emeralds") !== 100) fail("残高不足のdebit(clamp無し)は何もしないはず");
if (L.debitEmeralds(q, 150, FLOW.LABOR_PENALTY, { clamp: true }) !== 100 || q.getDynamicProperty("acc_emeralds") !== 0) fail("clampは残高ぶんだけ引いて0止まりのはず");
if (L.applyEmeraldDelta(q, -30, FLOW.FUTURES_SETTLE) !== 0) fail("残高0への負のdeltaは0を返すはず");
const sizeBytes = globalThis.__stubWorld.getDynamicProperty("bmh_ledger_v1").length;
if (sizeBytes > 20000) fail(`台帳が大きすぎる(${sizeBytes}B。プロパティ上限32,767B)`);

const g = r.total.byGroup;
console.log(`ledger: total in=${r.total.in} out=${r.total.out} net=${r.total.net} / balances=${sum()} / size=${sizeBytes}B / groups=${Object.keys(g).join(",")}`);
console.log("net issuance (income+credit, 12w):", L.getNetIssuance(12));
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
