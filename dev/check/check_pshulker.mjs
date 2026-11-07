// 専用シュルカー(economy/private-shulker.js と private-shulker-guard.js)の検算スクリプト(Node 20+)。
//   node dev/check/check_pshulker.mjs scripts      (パックのルートで実行)
// 紐付けの規則(1人1つ・取られている・移す・解除)/ 保護(壊す・爆発・他人が開く)/ 本のメニュー / 見回り(消えた・未読み込み)/ 不在の解除 / 入荷用のdeposit
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
const blocks = new Map(); // "dim|x|y|z" → block
const players = [];
const subs = { interact: [], break: [], explosion: [], spawn: [], event: [], interval: [] };
let formSelection = 0;
const entities = [];
const spawned = [];
const commands = [];
let lastForm = null;
const key = (d, x, y, z) => `${d}|${x}|${y}|${z}`;
globalThis.__stubWorld = {
  day: 100, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k), setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDimension: (id) => ({
    id, getBlock: ({ x, y, z }) => blocks.get(key(id, x, y, z)),
    runCommand: (c) => { commands.push(c); const m = c.match(/^setblock (-?\d+) (-?\d+) (-?\d+) air destroy$/); if (m) blocks.delete(key(id, +m[1], +m[2], +m[3])); },
    getEntities: () => entities.filter((e) => !e.removed), spawnItem: (it, l) => spawned.push({ it, l })
  }),
  beforeEvents: {
    playerInteractWithBlock: { subscribe: (f) => subs.interact.push(f) }, playerBreakBlock: { subscribe: (f) => subs.break.push(f) },
    explosion: { subscribe: (f) => subs.explosion.push(f) }
  },
  afterEvents: { playerSpawn: { subscribe: (f) => subs.spawn.push(f) } }
};
globalThis.__stubSystem = {
  run(f) { f(); }, runInterval(f) { subs.interval.push(f); return 1; },
  afterEvents: { scriptEventReceive: { subscribe: (f) => subs.event.push(f) } }
};
globalThis.__stubUI = {
  ActionFormData: class { title() { return this; } body(b) { this.b = b; return this; } button(x) { (this.btns ??= []).push(x); return this; }
    show() { lastForm = this; return Promise.resolve({ canceled: false, selection: formSelection }); } }
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,"+(s.includes("ui")?"ui":"server"),shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){
    if (u==="data:text/javascript,server") return {format:"module",shortCircuit:true,source:"export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;"};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export const ActionFormData = globalThis.__stubUI.ActionFormData; export class ModalFormData{}; "};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const PS = await imp("economy/private-shulker.js");
const G = await imp("economy/private-shulker-guard.js");
const PO = await imp("economy/policy.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
let seq = 0;
const mkPlayer = (name) => {
  const m = new Map(); const msgs = [];
  const p = { id: "id" + ++seq, name, msgs, sendMessage: (x) => msgs.push(x), getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) };
  players.push(p); return p;
};
const mkShulker = (x, y, z, typeId = "minecraft:red_shulker_box", dim = "overworld", slots = 27) => {
  const items = new Array(slots).fill(undefined);
  const container = { size: slots, getItem: (i) => items[i], get emptySlotsCount() { return items.filter((s) => !s).length; },
    addItem: (s) => { const i = items.indexOf(undefined); if (i === -1) return s; items[i] = s; return undefined; } };
  const b = { typeId, x, y, z, dimension: { id: dim }, getComponent: () => ({ container }) };
  blocks.set(key(dim, x, y, z), b); return b;
};
const A = mkPlayer("alice"), B = mkPlayer("bob");
const bindArgs = (p, b, extra = {}) => ({ playerId: p.id, name: p.name, dimId: b.dimension.id, x: b.x, y: b.y, z: b.z, typeId: b.typeId, day: W.day, ...extra });

const mkBlock = (typeId, x, y, z, dim = "overworld") => { const b = { typeId, x, y, z, dimension: { id: dim } }; blocks.set(key(dim, x, y, z), b); return b; };

// 1. 紐付けの規則
const s1 = mkShulker(10, 64, 10), s2 = mkShulker(20, 64, 20), s3 = mkShulker(30, 64, 30, "minecraft:undyed_shulker_box");
const chest = { typeId: "minecraft:chest", x: 1, y: 1, z: 1, dimension: { id: "overworld" } };
eq(PS.bindShulker(bindArgs(A, chest)).reason, "not_shulker", "シュルカー以外は登録できない");
eq(PS.bindShulker(bindArgs(A, s1)).ok, true, "登録できる");
eq(PS.bindShulker(bindArgs(A, s1)).reason, "same", "同じ位置を二重に登録しない");
eq(PS.bindShulker(bindArgs(B, s1)).reason, "taken", "他人の専用は取れない");
eq(PS.bindShulker(bindArgs(A, s2)).reason, "has_other", "1人1つ(別の位置は、移すまで登録できない)");
const mv = PS.bindShulker(bindArgs(A, s2, { replace: true }));
eq(mv.ok && mv.moved, true, "移す(前の登録は解除される)");
eq(PS.getBindingAt("overworld", 10, 64, 10), null, "前の位置の紐付けは消える");
eq(PS.getBinding(A.id).x, 20, "移した先に紐付く");
eq(PS.bindShulker(bindArgs(B, s3)).ok, true, "染色なし(undyed)のシュルカーも登録できる");
eq(PS.bindShulker(bindArgs(B, s1)).reason, "has_other", "bob は 1つ持っている");
eq(PS.releaseBinding(B.id), true, "解除できる");
eq(PS.releaseBinding(B.id), false, "解除済みを重ねて解除しても何も起きない");
eq(PS.listBindings().length, 1, "alice の1件だけが残る");

// 2. 保護(コアブロックと同じ作り)
G.startPrivateShulker();
eq(subs.interact.length, 2, "イベントを購読する(開く・本のメニューと、禁止物の設置)");
const interact = (p, b, item) => { const ev = { isFirstEvent: true, block: b, player: p, itemStack: item, cancel: false }; for (const f of subs.interact) f(ev); return ev; };
const brk = (p, b) => { const ev = { block: b, player: p, cancel: false }; for (const f of subs.break) f(ev); return ev; };
eq(interact(A, s2).cancel, false, "持ち主は普通に開ける");
eq(interact(B, s2).cancel, true, "他人が開く操作は止める");
if (!B.msgs.some((m) => m.includes("alice"))) fail("他人には、だれの専用かを知らせる");
eq(interact(B, s1).cancel, false, "紐付いていないシュルカーは、だれでも開ける");
eq(brk(A, s2).cancel, true, "持ち主も、解除する前は壊せない");
eq(brk(B, s2).cancel, true, "他人も壊せない");
eq(brk(B, s1).cancel, false, "紐付いていないシュルカーは壊せる");
const exp = { blocks: [s1, s2, chest], getImpactedBlocks() { return this.blocks; }, setImpactedBlocks(b) { this.blocks = b; } };
for (const f of subs.explosion) f(exp);
eq(exp.blocks.includes(s2), false, "爆発の対象から外す");
eq(exp.blocks.includes(s1) && exp.blocks.includes(chest), true, "それ以外は対象のまま");

// 3. 本のメニュー
const book = { typeId: "minecraft:book" };
const tapBook = async (p, b, sel) => { formSelection = sel; const ev = interact(p, b, book); await new Promise((r) => setTimeout(r, 0)); return ev; };
{
  const ev = await tapBook(B, s1, 0);                 // bob は紐付き無し → 登録
  eq(ev.cancel, true, "本で触ると、メニューを開く(中身は開かない)");
  eq(PS.getBinding(B.id)?.x, 10, "メニューから登録できる");
  await tapBook(B, s1, 0);                             // 自分の専用 → 解除
  eq(PS.getBinding(B.id), null, "メニューから解除できる");
  await tapBook(A, s1, 0);                             // alice は別の位置に持っている → 移す
  eq(PS.getBinding(A.id)?.x, 10, "メニューから移せる");
  eq(PS.getBindingAt("overworld", 20, 64, 20), null, "移したので前の位置は空く");
  const ev2 = await tapBook(B, s1, 0);                 // 他人の専用に本 → 開かない・登録されない
  eq(ev2.cancel, true, "他人の専用は、本でもメニューが開かない");
  eq(PS.getBinding(B.id), null, "他人の専用は取れない");
  await tapBook(A, s1, 1);                              // 閉じる
  eq(PS.getBinding(A.id)?.x, 10, "閉じるでは何も変わらない");
  await tapBook(A, s1, 0);                              // 解除
  await tapBook(A, s2, 0);                              // 登録し直す(s2 へ)
  eq(PS.getBinding(A.id)?.x, 20, "解除してから別の位置に登録し直せる");
}

// 4. 入荷用 deposit(取引所の入荷一覧の土台)
{
  const items = (n) => Array.from({ length: n }, (_, i) => ({ id: i }));
  const r1 = PS.depositToPrivateShulker(A.id, items(3));
  eq(r1.ok, true, "専用シュルカーへ入れられる"); eq(r1.leftover.length, 0, "全部入る");
  eq(PS.freeSlots(A.id), 24, "空きスロットが減る");
  const r2 = PS.depositToPrivateShulker(A.id, items(30));
  eq(r2.ok, true, "あふれても ok"); eq(r2.leftover.length, 6, "入りきらない分は leftover で返る(入荷一覧に残す)");
  eq(PS.depositToPrivateShulker(B.id, items(1)).reason, "no_binding", "紐付けが無い人は no_binding");
  blocks.set(key("overworld", 20, 64, 20), undefined);   // チャンクが読み込まれていない
  const r3 = PS.depositToPrivateShulker(A.id, items(2));
  eq(r3.reason, "unloaded", "読み込まれていない間は unloaded"); eq(r3.leftover.length, 2, "全部 leftover");
  eq(PS.getBinding(A.id) !== null, true, "読み込まれていないだけでは、解除しない");
  blocks.set(key("overworld", 20, 64, 20), s2);
}

// 5. 見回り: 位置からシュルカーが消えたら解除して、持ち主に知らせる
{
  const lenBefore = A.msgs.length;
  blocks.set(key("overworld", 20, 64, 20), { typeId: "minecraft:air", x: 20, y: 64, z: 20, dimension: { id: "overworld" } });
  for (const f of subs.interval) f();
  eq(PS.getBinding(A.id), null, "シュルカーが消えたら解除される");
  if (A.msgs.length === lenBefore || !A.msgs[A.msgs.length - 1].includes("無くなって") && !A.msgs[A.msgs.length - 1].includes("no longer")) fail("持ち主に知らせる: " + A.msgs.slice(-1));
  eq(PS.takeLostNotice(A.id), null, "オンラインの持ち主に知らせたら、通知は残らない");
  blocks.set(key("overworld", 20, 64, 20), s2);
}
// オフラインの間に消えたら、ログイン時に1回だけ知らせる
{
  PS.bindShulker(bindArgs(A, s2));
  players.splice(players.indexOf(A), 1);
  blocks.set(key("overworld", 20, 64, 20), { typeId: "minecraft:air", x: 20, y: 64, z: 20, dimension: { id: "overworld" } });
  for (const f of subs.interval) f();
  eq(PS.getBinding(A.id), null, "オフラインでも解除される");
  players.push(A);
  const n = A.msgs.length;
  for (const f of subs.spawn) f({ initialSpawn: true, player: A });
  eq(A.msgs.length, n + 1, "ログインした時に知らせる");
  for (const f of subs.spawn) f({ initialSpawn: true, player: A });
  eq(A.msgs.length, n + 1, "知らせるのは1回だけ");
  blocks.set(key("overworld", 20, 64, 20), s2);
}

// 6. 不在の解除
{
  const limit = PO.getPolicyParam("private_shulker_absent_days");
  eq(limit, 60, "既定の不在日数は60日");
  PS.bindShulker(bindArgs(A, s2));
  W.day += limit;                 // ちょうど limit 日: まだ解除しない
  eq(PS.releaseAbsent(W.day).length, 0, "不在が上限ちょうどでは解除しない");
  PS.touchSeen(A.id, A.name, W.day);   // 来た記録(この日)
  W.day += limit;
  eq(PS.releaseAbsent(W.day).length, 0, "来た記録があると、そこから数え直す(上限ちょうどは解除しない)");
  W.day += 1;
  eq(PS.releaseAbsent(W.day)[0], A.id, "上限を1日でも超えると解除される");
  eq(PS.peekLostNotice(A.id), "absent", "理由は absent");
  eq(PS.takeLostNotice(A.id), "absent", "取り出せる"); eq(PS.takeLostNotice(A.id), null, "取り出すと消える");
}

// 7. 改名しても同じ人(IDで持つ)/ 保存の大きさ
{
  PS.bindShulker(bindArgs(A, s2));
  A.name = "alice2";
  interact(A, s2);
  eq(PS.getBinding(A.id).name, "alice2", "触ると名前の表示が更新される");
  eq(interact(A, s2).cancel, false, "改名しても持ち主のまま");
  const raw = store.get("bmh_pshulker");
  if (raw.length > 400) fail("1件の保存が大きすぎる: " + raw.length);
}

// 8. 周りの設置禁止(ホッパー・ピストン・TNTなど。検証パック PrivateShulkerTest002 と同じ)
{
  const sh = mkShulker(200, 64, 200);
  const pos = { dimId: "overworld", x: 200, y: 64, z: 200 };
  eq(PS.findDanger(pos), null, "周りに何も無ければ、禁止物は見つからない");
  mkBlock("minecraft:hopper", 202, 64, 200);
  eq(PS.findDanger(pos)?.id, "minecraft:hopper", "2マス以内のホッパーを見つける");
  mkBlock("minecraft:hopper", 203, 64, 200);          // 3マス先
  eq(PS.scanDanger(pos).length, 1, "ホッパーは2マスまで(3マス先は対象外)");
  mkBlock("minecraft:tnt", 203, 65, 203);
  eq(PS.scanDanger(pos).length, 2, "TNTは3マスまで");

  // 登録の時に近くにあれば断る(メニュー)
  formSelection = 0;
  const C = mkPlayer("carol");
  interact(C, sh, book); await new Promise((r) => setTimeout(r, 0));
  eq(PS.getBinding(C.id), null, "禁止物が近くにあると、登録できない");
  if (!C.msgs.some((m) => m.includes("hopper"))) fail("断る理由(何が、どこにあるか)を知らせる: " + C.msgs.slice(-1));
  for (const k of [[202, 64, 200], [203, 65, 203], [203, 64, 200]]) blocks.delete(key("overworld", ...k));
  interact(C, sh, book); await new Promise((r) => setTimeout(r, 0));
  eq(PS.getBinding(C.id)?.x, 200, "撤去したら登録できる");

  // 置こうとするとキャンセル(右クリックした面の隣が、置く位置)
  const place = (p, item, base, face) => { const ev = { isFirstEvent: true, block: base, player: p, itemStack: { typeId: item }, blockFace: face, cancel: false }; for (const f of subs.interact) f(ev); return ev; };
  const near2 = mkBlock("minecraft:stone", 200, 64, 202), near3 = mkBlock("minecraft:stone", 200, 64, 203), far = mkBlock("minecraft:stone", 300, 64, 300);
  eq(place(B, "minecraft:hopper", near2, "Up").cancel, true, "2マス以内にホッパーは置けない");
  eq(place(B, "minecraft:hopper", near3, "Up").cancel, false, "ホッパーは3マス先なら置ける");
  eq(place(B, "minecraft:tnt", near3, "Up").cancel, true, "TNTは3マスまで置けない");
  eq(place(B, "minecraft:stone", near2, "Up").cancel, false, "禁止物でないものは置ける");
  eq(place(B, "minecraft:hopper", far, "Up").cancel, false, "遠くには置ける");
  eq(place(B, "minecraft:hopper", near2, "Sideways").cancel, false, "面が分からない時は何もしない");
  if (!B.msgs.some((m) => m.includes("2 blocks") || m.includes("2マス"))) fail("置けない理由(距離)を知らせる");

  // 見回り: あとから紛れ込んだ禁止物を撤去する(ブロックはアイテムとして落とす)。エンティティはトロッコ
  mkBlock("minecraft:piston", 201, 65, 200);
  const mkCart = (typeId, x, z) => ({ typeId, location: { x, y: 64, z }, kill() { this.removed = true; }, remove() { this.removed = true; } });
  const cart = mkCart("minecraft:hopper_minecart", 201.5, 200.5), tnt = mkCart("minecraft:tnt_minecart", 202.5, 200.5), farCart = mkCart("minecraft:hopper_minecart", 230.5, 230.5);
  entities.push(cart, tnt, farCart);
  const n = C.msgs.length;
  for (const f of subs.interval) f();
  eq(blocks.has(key("overworld", 201, 65, 200)), false, "紛れ込んだピストンを撤去する");
  if (!commands.some((c) => c === "setblock 201 65 200 air destroy")) fail("destroy で、アイテムとして落とす: " + commands.slice(-1));
  eq(!!cart.removed, true, "ホッパー付きトロッコを撤去する");
  eq(!!tnt.removed && spawned.length === 1, true, "TNTトロッコは爆発させず、アイテムとして落として撤去する");
  eq(!!farCart.removed, false, "遠くのトロッコには触らない");
  eq(C.msgs.length, n + 1, "持ち主に1回知らせる");
  if (!C.msgs[C.msgs.length - 1].includes("1") || !C.msgs[C.msgs.length - 1].includes("2")) fail("撤去した数を知らせる: " + C.msgs.slice(-1));
  for (const f of subs.interval) f();
  eq(C.msgs.length, n + 1, "撤去するものが無ければ、知らせない");

  // 位置のチャンクが読み込まれていない(getBlock が undefined)間は、調べない
  mkBlock("minecraft:hopper", 201, 64, 201);
  blocks.set(key("overworld", 200, 64, 200), undefined);
  const before = commands.length;
  for (const f of subs.interval) f();
  eq(commands.length, before, "読み込まれていない間は、撤去もしない");
}

console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
