// 起動の検算スクリプト(Node 20+)。main.js を、実機のBedrockに近い条件で読み込んで動かす。
//   node dev/check_startup.mjs scripts      (パックのルートで実行)
// ・全モジュールのリンク(import した名前が、読み込み先に本当にあるか)を、main.js を丸ごと読み込んで確認する
// ・「早期実行」の再現: 読み込み中(トップレベル)にワールドの動的プロパティ・日付・プレイヤー一覧へ触ると例外にする
//   (実機では、スクリプト読み込み中はこれらに触れない。system.run の中などに遅らせる必要がある)
// ・読み込み後に、system.run / runInterval のコールバックと、プレイヤーのスポーンを動かして、例外が出ないことを確認する
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? "scripts");

// ---- スクリプトが @minecraft/* から import している名前を集める ----
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith(".js") ? [path.join(dir, d.name)] : []);
}
const names = { "@minecraft/server": new Set(), "@minecraft/server-ui": new Set() };
for (const f of walk(root)) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](@minecraft\/[a-z-]+)["']/g)) {
    for (const n of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) names[m[2]]?.add(n);
  }
}

// ---- スタブ ----
const mkProxy = () => new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : p === "then" ? undefined : mkProxy()),
  apply: () => mkProxy(),
  construct: () => mkProxy()
});
const props = new Map();
const state = { early: true, runCallbacks: [], intervalCallbacks: [], spawnHandlers: [], errors: [] };
const guard = (name) => { if (state.early) throw new Error(`early-execution: ${name} was called while the script was loading`); };
const world = new Proxy({
  getDynamicProperty: (k) => { guard("world.getDynamicProperty"); return props.get(k); },
  setDynamicProperty: (k, v) => { guard("world.setDynamicProperty"); v === undefined ? props.delete(k) : props.set(k, v); },
  getDay: () => { guard("world.getDay"); return 12; },
  getPlayers: () => { guard("world.getPlayers"); return []; },
  getAllPlayers: () => { guard("world.getAllPlayers"); return []; },
  afterEvents: new Proxy({}, { get: (t, ev) => ({ subscribe: (fn) => { if (ev === "playerSpawn") state.spawnHandlers.push(fn); } }) }),
  beforeEvents: new Proxy({}, { get: () => ({ subscribe() {} }) })
}, { get: (t, p) => (p in t ? t[p] : mkProxy()) });
const system = new Proxy({
  run: (fn) => { state.runCallbacks.push(fn); return 1; },
  runInterval: (fn) => { state.intervalCallbacks.push(fn); return 1; },
  runTimeout: (fn) => { state.runCallbacks.push(fn); return 1; },
  runJob: () => 1,
  afterEvents: new Proxy({}, { get: () => ({ subscribe() {} }) }),
  beforeEvents: new Proxy({}, { get: () => ({ subscribe() {} }) })
}, { get: (t, p) => (p in t ? t[p] : mkProxy()) });
globalThis.__mc = { "@minecraft/server": { world, system }, "@minecraft/server-ui": {} };

const stubSource = (pkg) => {
  const exp = [...names[pkg]].map((n) => {
    if (pkg === "@minecraft/server" && (n === "world" || n === "system")) return `export const ${n} = globalThis.__mc["${pkg}"].${n};`;
    return `export const ${n} = globalThis.__mc.proxy("${n}");`;
  });
  return exp.join("\n");
};
globalThis.__mc.proxy = (n) => {
  // クラスとして new できる/呼べる/プロパティを引ける万能スタブ。ItemStack などの new にも耐える
  return mkProxy();
};
register("data:text/javascript," + encodeURIComponent(`
  const sources = ${JSON.stringify({ "@minecraft/server": stubSource("@minecraft/server"), "@minecraft/server-ui": stubSource("@minecraft/server-ui") })};
  export async function resolve(s,c,n){ if (s in sources) return {url:"data:text/javascript,stub:"+s,shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u.startsWith("data:text/javascript,stub:")) return {format:"module",shortCircuit:true,source:sources[u.slice("data:text/javascript,stub:".length)]}; return n(u,c); }
`));

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };

// ---- 読み込み(早期実行) ----
try {
  await import(pathToFileURL(path.join(root, "main.js")).href);
} catch (e) {
  fail("main.js の読み込みで例外: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e));
}
state.early = false;

// ---- 読み込み後に動かす ----
for (const fn of state.runCallbacks) {
  try { fn(); } catch (e) { fail("system.run のコールバックで例外: " + e.message); }
}
for (const fn of state.intervalCallbacks) {
  try { fn(); } catch (e) { fail("runInterval のコールバックで例外: " + e.message); }
}
const mkPlayer = () => { const m = new Map(); return { name: "tester", getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v), sendMessage() {}, dimension: mkProxy(), location: { x: 0, y: 0, z: 0 }, getComponent: () => mkProxy() }; };
for (const fn of state.spawnHandlers) {
  try { fn({ player: mkPlayer(), initialSpawn: true }); } catch (e) { fail("playerSpawn のハンドラで例外: " + e.message); }
}
// 2回目の実行(HRMHRMの口座が既にある状態、日付が進んだ状態)
for (const fn of state.intervalCallbacks) {
  try { fn(); } catch (e) { fail("runInterval(2回目)で例外: " + e.message); }
}

console.log(`startup: runCallbacks=${state.runCallbacks.length} intervals=${state.intervalCallbacks.length} spawnHandlers=${state.spawnHandlers.length} dynamicProps=${props.size}`);
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
