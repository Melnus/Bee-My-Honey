// 取引所のメニュー(ui/exchange-menu.js)の検算スクリプト(Node 20+)。フォームはスタブで、決めた順に答えを返す。
//   node dev/check/check_exchange_menu.mjs scripts      (パックのルートで実行)
// 一覧→品目→購入(HRMHRM・カード払い)→入荷 / 出荷(取り込み→出品→取り下げ) / 無形資産(準備中) / 入荷一覧
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map(); const blocks = new Map(); const players = [];
const key = (d, x, y, z) => `${d}|${x}|${y}|${z}`;
globalThis.__stubWorld = {
  day: 100, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k), setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()],
  getDimension: (id) => ({ id, getBlock: ({ x, y, z }) => blocks.get(key(id, x, y, z)) }),
  beforeEvents: {}, afterEvents: {}
};
globalThis.__stubSystem = { run(f) { f(); }, runInterval() { return 1; }, afterEvents: { scriptEventReceive: { subscribe() {} } } };
globalThis.__script = []; globalThis.__shown = [];
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,"+(s.includes("ui")?"ui":"server"),shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){
    if (u==="data:text/javascript,server") return {format:"module",shortCircuit:true,source:
      "export class ItemStack{ constructor(t,a=1){ this.typeId=t; this.amount=a; this.maxAmount=64; } }; export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;" +
      "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};"};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:
      "class F{ constructor(){ this.buttons=[]; this.body_=''; this.fields=[]; } title(t){this.t=t;return this} body(b){this.body_=b;return this} button(b){this.buttons.push(b);return this} textField(l,p,o){this.fields.push(o);return this} toggle(){return this}" +
      " show(){ globalThis.__shown.push(this); const next=globalThis.__script.shift(); if(next===undefined) return new Promise(()=>{}); return Promise.resolve(typeof next==='function'?next(this):next); } }" +
      "export class ActionFormData extends F{}; export class ModalFormData extends F{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const M = await imp("ui/exchange-menu.js");
const EX = await imp("economy/exchange.js");
const PS = await imp("economy/private-shulker.js");
const W = globalThis.__stubWorld;
class IS { constructor(t, a = 1) { this.typeId = t; this.amount = a; this.maxAmount = 64; this.getLore = () => []; this.getComponent = () => undefined; } }

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const ok = (c, m) => { if (!c) fail(m); };
const tick = () => new Promise((r) => setTimeout(r, 0));
const pick = (n) => ({ canceled: false, selection: n });
const modal = (...v) => ({ canceled: false, formValues: v });
const run = async (fn) => { globalThis.__shown.length = 0; fn(); for (let i = 0; i < 30; i++) await tick(); };

const mkPlayer = (name, bal, id) => {
  const m = new Map([["acc_emeralds", bal], ["pref_lang", "ja"]]); const msgs = [];
  const p = { id, name, msgs, sendMessage: (x) => msgs.push(x), getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) };
  players.push(p); return p;
};
const bal = (p) => p.getDynamicProperty("acc_emeralds");
const slots = new Array(27).fill(undefined);
slots[0] = new IS("minecraft:wheat", 64); slots[1] = new IS("minecraft:wheat", 20);
const container = { size: 27, getItem: (i) => slots[i], setItem: (i, s) => { slots[i] = s; },
  addItem: (s) => { const i = slots.indexOf(undefined); if (i === -1) return s; slots[i] = s; return undefined; } };
const shulker = { typeId: "minecraft:red_shulker_box", x: 5, y: 64, z: 5, getComponent: () => ({ container }) };
blocks.set(key("overworld", 5, 64, 5), shulker);

const WHEAT = "minecraft:wheat";
const alice = mkPlayer("alice", 1e6, "a1");
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };

// 名前: カタログにある品は日本語名、ない品は整形したID
eq(M.exItemName("ja", WHEAT), "小麦", "小麦の日本語名(取引リストから)");
eq(M.exItemName("en", "minecraft:some_odd_item"), "Some Odd Item", "未知の品はIDを整形");

// 1. トップ → 物品別リスト → 無形資産(準備中)で戻る
await run(() => { globalThis.__script.push(pick(0), pick(3), { canceled: true }, { canceled: true }); M.openExchangeMenu(alice); });
ok(globalThis.__shown[0].buttons.length === 9, "トップのボタンは9つ(物品別/検索/出荷/入荷/オススメ/カスタマー/リーガル/カレンダー/閉じる)");
ok(alice.msgs.some((m) => m.includes("準備中") || m.includes("coming soon")), "無形資産は準備中と出る");

// 2. 購入: 生鮮 → 農作物 → 小麦 → 購入画面 → 数量 → 確認 → 専用シュルカー未登録で入荷一覧に残る
alice.msgs.length = 0;
const before = bal(alice);
const toWheat = [pick(0), pick(0), pick(2), pick(0)]; // 物品別リスト → 生鮮 → 農作物 → 小麦
await run(() => {
  globalThis.__script.push(...toWheat, pick(0), modal("10", false), pick(0), { canceled: true });
  M.openExchangeMenu(alice);
});
{
  const cats = globalThis.__shown.find((f) => f.buttons.length === 5);
  ok(!!cats, "分類の画面は、生鮮・一般資源・希少資源・無形資産・戻る の5つ");
  const groups = globalThis.__shown.find((f) => f.buttons.length === 5 && f.t === "生鮮" || f.t === "Fresh");
  ok(!!groups, "生鮮の小分類は4つ+戻る");
  const items = globalThis.__shown.find((f) => f.buttons.length === 5 && f.buttons[0].includes("小麦"));
  ok(!!items, "農作物の一覧に小麦が先頭で出る");
  ok(items && /\[腐る:6日\]|腐る:6/.test(items.buttons[0]), "小麦には腐る目印が付く");
}
if (process.env.DBG) for (const f of globalThis.__shown) console.log(JSON.stringify([f.t, f.buttons.slice(0,3), String(f.body_).slice(0,40)]));
const bought = before - bal(alice);
ok(bought > 0, "購入で残高が減る: " + bought);
eq(EX.getInbox("a1")[WHEAT], 10, "未登録なら入荷一覧に残る");
ok(alice.msgs.some((m) => m.includes("未登録") || m.includes("No private shulker")), "未登録の案内が出る");

// 2b. 出品のない品(ペールオークの原木): ページに「最初の出品者」と出る。相場のある品(オークの原木)は相場の行が出る
await run(() => {
  globalThis.__script.push(pick(0), pick(1), pick(2), pick(8), { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
{
  const page = globalThis.__shown.find((f) => String(f.body_).includes("最初の出品者"));
  ok(!!page, "出品なしの品目ページに案内が出る");
  ok(page && page.buttons.length === 2, "出品なし・相場なし: 出品する / 戻る");
  const list = globalThis.__shown.find((f) => f.buttons.length === 11 && f.buttons.some((b) => b.includes("出品 0件")));
  ok(!!list, "出品なしの品は「出品 0件」と出る");
  ok(list && list.buttons[0].includes("相場"), "相場のある品(オークの原木)は相場の価格が出る");
}
await run(() => {
  globalThis.__script.push(pick(0), pick(1), pick(2), pick(0), { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
{
  const page = globalThis.__shown.find((f) => String(f.body_).includes("相場(システム)"));
  ok(!!page, "相場のある品のページに相場の行が出る");
  ok(page && page.buttons.length === 4, "買う / 出品する / 相場で売る / 戻る");
}

// 2c. 検索: カタカナ検索(「ダイヤ」)でダイヤ系が出る / ひらがなでも同じ / 該当なしは入力に戻る / 結果から品目ページへ
await run(() => {
  globalThis.__script.push(pick(1), modal("だいや"), pick(0), { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
{
  const res = globalThis.__shown.find((f) => String(f.t).startsWith("検索:"));
  ok(!!res, "検索結果の画面が出る");
  ok(res && res.buttons[0].includes("ダイヤ"), "ひらがなの検索でカタカナの品が出る");
  const page = globalThis.__shown.find((f) => String(f.t) === "ダイヤモンド");
  ok(!!page, "検索結果から品目ページへ進める");
}
await run(() => {
  globalThis.__script.push(pick(1), modal("zzzz"), { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
ok(alice.msgs.some((m) => m.includes("合う品目がありません")), "該当なしの案内");

// 2d. 入力フォームの「戻る」スイッチ: 検索から取引所のトップへ戻る
await run(() => {
  globalThis.__script.push(pick(1), (f) => ({ canceled: false, formValues: ["だいや", true] }), { canceled: true });
  M.openExchangeMenu(alice);
});
ok(globalThis.__shown.filter((f) => f.t === "取引所").length === 2, "検索の戻るスイッチで取引所のトップに戻る");
ok(globalThis.__shown.every((f) => !f.t || !String(f.t).startsWith("検索:")), "戻るスイッチでは検索しない");

// 3. 専用シュルカーを登録して、入荷一覧から届ける
PS.bindShulker({ playerId: "a1", name: "alice", dimId: "overworld", x: 5, y: 64, z: 5, typeId: shulker.typeId, day: W.day });
alice.msgs.length = 0;
await run(() => { globalThis.__script.push(pick(3), pick(0), { canceled: true }, { canceled: true }); M.openExchangeMenu(alice); });
eq(EX.getInbox("a1")[WHEAT], undefined, "届けると入荷一覧が空になる");
ok(slots.some((s) => s && s.typeId === WHEAT && s.amount === 10), "専用シュルカーに10個入る");
ok(alice.msgs.some((m) => m.includes("10")), "届いた個数が出る");

// 4. 出荷: 取り込み(84個のうち50) → 出品 → 自分の出品 → 取り下げ
alice.msgs.length = 0;
await run(() => {
  // 取り込む品の並び順は ID順。小麦だけのはず(届けた10個+最初の84個は同じ品目にまとまる)
  globalThis.__script.push(pick(2), pick(0), pick(0), modal("50", false), { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
eq(EX.getPool("a1")[WHEAT], 50, "取り込んだ50個がプールにある");
const cap = EX.referencePrice(WHEAT);
const b2 = bal(alice);
await run(() => {
  globalThis.__script.push(pick(2), pick(1), pick(0), modal("30", String(Math.max(1, cap - 0))), pick(0), { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
const mine = EX.listMyListings("a1");
eq(mine.length, 1, "出品が1件できる");
eq(mine[0]?.qty, 30, "出品数量30");
ok(bal(alice) < b2, "輸送費が引かれる");
eq(EX.getPool("a1")[WHEAT], 20, "プールは20個に減る");
// 上限超えの値段は出品されない
await run(() => {
  globalThis.__script.push(pick(2), pick(1), pick(0), modal("5", String(cap + 1)), { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
eq(EX.listMyListings("a1").length, 1, "上限超えは出品されない");
// 取り下げ
await run(() => {
  globalThis.__script.push(pick(2), pick(2), pick(0), pick(0), { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
eq(EX.listMyListings("a1").length, 0, "取り下げで出品が消える");
eq(EX.getPool("a1")[WHEAT], 50, "取り下げでプールへ戻る");

// 5. カード払い: 残高が足りない人はカード未発行の案内
const poor = mkPlayer("poor", 0, "p1");
await run(() => {
  globalThis.__script.push(...toWheat, pick(0), modal("2", false), pick(0), { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(poor);
});
ok(poor.msgs.some((m) => m.includes("カード") || m.includes("card")), "残高なし・カード無しの案内");
eq(EX.getInbox("p1")[WHEAT], undefined, "買えていない");

// 6. 村・会社の出品は、出品者に [村] / [会社] が付く(言語に合った名前)
EX.shipToExchange({ entityId: "VIL001", kind: "village", names: { ja: "テスト村", en: "Test Village" }, items: { "minecraft:stick": 20 }, ratio: 0.8 });
await run(() => {
  globalThis.__script.push(pick(0), pick(1), pick(3), pick(11), { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true }, { canceled: true });
  M.openExchangeMenu(alice);
});
{
  const page = globalThis.__shown.find((f) => String(f.body_).includes("[村]テスト村"));
  ok(!!page, "村の出品には [村] と村の名前が出る");
}

console.log(errors === 0 ? "OK" : errors + " problem(s)");
process.exit(errors ? 1 : 0);
