// 取引所のエンジン(economy/exchange.js)の検算スクリプト(Node 20+)。
//   node dev/check/check_exchange.mjs scripts      (パックのルートで実行)
// 価格の上限 / 取引所プール(専用シュルカーから) / 出品(輸送費・上限・取り下げ・期限) / 購入(安い順・HRMHRMの在庫・代金の流れ) /
// 売り手がオフライン / 入荷(専用シュルカーへ・あふれ) / 台帳(発行にならない) / 口座(専用口座)
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
const blocks = new Map();
const players = [];
const subs = { spawn: [], interval: [], event: [] };
const key = (d, x, y, z) => `${d}|${x}|${y}|${z}`;
globalThis.__stubWorld = {
  day: 100, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k), setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()],
  getDimension: (id) => ({ id, getBlock: ({ x, y, z }) => blocks.get(key(id, x, y, z)) }),
  beforeEvents: {}, afterEvents: { playerSpawn: { subscribe: (f) => subs.spawn.push(f) } }
};
globalThis.__stubSystem = { run(f) { f(); }, runInterval(f) { subs.interval.push(f); return 1; }, afterEvents: { scriptEventReceive: { subscribe: (f) => subs.event.push(f) } } };
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,"+(s.includes("ui")?"ui":"server"),shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){
    if (u==="data:text/javascript,server") return {format:"module",shortCircuit:true,source:
      "export class ItemStack{ constructor(t,a=1){ this.typeId=t; this.amount=a; this.maxAmount=64; } }; export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;" +
      "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};"};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export class ActionFormData{}; export class ModalFormData{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const EX = await imp("economy/exchange.js");
const PS = await imp("economy/private-shulker.js");
const A = await imp("economy/account.js");
const L = await imp("economy/ledger.js");
const PO = await imp("economy/policy.js");
class ItemStack { constructor(t, a = 1) { this.typeId = t; this.amount = a; this.maxAmount = 64; } }
const H = await imp("economy/hrmhrm.js");
const DB = await imp("economy/dev-bank.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
let seq = 0;
const mkPlayer = (name, bal) => {
  const m = new Map([["acc_emeralds", bal]]); const msgs = [];
  const p = { id: "id" + ++seq, name, msgs, sendMessage: (x) => msgs.push(x), getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) };
  players.push(p); return p;
};
const bal = (p) => p.getDynamicProperty("acc_emeralds");
const mkStack = (typeId, amount, extra = {}) => Object.assign(new ItemStack(typeId, amount), { getLore: () => [], getComponent: () => undefined }, extra);
const mkShulker = (x, items = []) => {
  const slots = new Array(27).fill(undefined);
  items.forEach((s, i) => { slots[i] = s; });
  const container = { size: 27, getItem: (i) => slots[i], setItem: (i, s) => { slots[i] = s; },
    addItem: (s) => { const i = slots.indexOf(undefined); if (i === -1) return s; slots[i] = s; return undefined; }, slots };
  const b = { typeId: "minecraft:red_shulker_box", x, y: 64, z: 0, dimension: { id: "overworld" }, getComponent: () => ({ container }) };
  blocks.set(key("overworld", x, 64, 0), b); return { b, container };
};
const bind = (p, b) => PS.bindShulker({ playerId: p.id, name: p.name, dimId: "overworld", x: b.x, y: b.y, z: b.z, typeId: b.typeId, day: W.day });

const WHEAT = "minecraft:wheat";
const alice = mkPlayer("alice", 1e6), bob = mkPlayer("bob", 1e6), carol = mkPlayer("carol", 0);
const ref = EX.referencePrice(WHEAT);
if (!(ref >= 1)) fail("HRMHRMの売値が1以上: " + ref);
eq(EX.standingItems().get(WHEAT), 792, "小麦の常設数は 99束 × 8個");
eq(EX.getHrmhrmStock(WHEAT), 792, "HRMHRMの在庫は、はじめは常設数");
eq(EX.listOffers(WHEAT)[0].kind, "hrmhrm", "HRMHRMの常設出品が見える");
eq(EX.standingItems().has("minecraft:enchanted_book"), false, "エンチャント本は常設出品に入れない");

// 1. 出荷: 専用シュルカーから取引所プールへ(通常の品だけ)
const as = mkShulker(10, [mkStack(WHEAT, 64), mkStack(WHEAT, 36), mkStack(WHEAT, 5, { nameTag: "特別" }), mkStack("minecraft:dirt", 10)]);
eq(EX.pullToPool(alice, WHEAT, 10).reason, "no_binding", "専用シュルカーが無いと取り込めない");
bind(alice, as.b);
const pr = EX.pullToPool(alice, WHEAT, 100);
eq(pr.moved, 100, "通常の小麦だけ取り込む(名前つきは対象外)");
eq(EX.getPool(alice.id)[WHEAT], 100, "取引所プールに入る");
eq(as.container.slots[2]?.amount, 5, "名前つきの品はシュルカーに残る");
eq(as.container.slots[0], undefined, "取り込んだ分はシュルカーから消える");
eq(EX.pullToPool(alice, WHEAT, 5).moved, 0, "取り込めるものが無ければ0");

// 1b. 鮮度のある食品(チケットA): 鮮度の行だけのloreは、ふつうの品として取り込む。80%以上は通り、79%以下は理由つきで断る(シュルカーに残る)
{
  const hex = (n) => n.toString(16).padStart(5, "0").split("").map((c) => "§" + c).join("");
  const fl = (pct, life) => { const age = Math.round((1 - pct / 100) * life); return ["§r§r§7鮮度: " + pct + "%§r" + hex(age) + hex(3)]; };
  const COOKED = "minecraft:cooked_beef", RAWB = "minecraft:beef"; // 加工12日 / 生鮮6日
  const withFresh = (id, n, pct, life, extra = {}) => mkStack(id, n, { lore: fl(pct, life), getLore() { return this.lore; }, ...extra });
  const fi = mkPlayer("fiona", 1e6);
  const fs = mkShulker(40, [withFresh(COOKED, 10, 100, 288000), withFresh(COOKED, 7, 80, 288000), withFresh(COOKED, 5, 79, 288000), withFresh(RAWB, 9, 100, 144000),
    withFresh(RAWB, 4, 50, 144000), withFresh(COOKED, 3, 100, 288000, { nameTag: "名前つき" }), withFresh("minecraft:rotten_flesh", 6, 10, 288000, { lore: ["§7ほかの説明"] })]);
  bind(fi, fs.b);
  const sc2 = EX.shulkerContents(fi);
  eq(sc2.items[COOKED], 17, "加工食品: 100%と80%は受け付ける(10+7)");
  eq(sc2.stale[COOKED], 5, "加工食品: 79%は受け付けない(理由つきで数える)");
  eq(sc2.items[RAWB], 9, "生鮮: 100%は受け付ける"); eq(sc2.stale[RAWB], 4, "生鮮: 50%は受け付けない");
  eq(sc2.items["minecraft:rotten_flesh"], undefined, "鮮度の対象外の品は、ほかの説明文があれば従来どおり弾く");
  const pf = EX.pullToPool(fi, COOKED, 100);
  eq(pf.moved, 17, "取り込めた数は鮮度が足りている分だけ"); eq(pf.staleSkipped, 5, "79%は断る");
  eq(EX.getPool(fi.id)[COOKED], 17, "プールに入る");
  eq(fs.container.slots[2]?.amount, 5, "断った品はシュルカーに残る(消えない)");
  eq(fs.container.slots[0], undefined, "取り込んだ分はシュルカーから消える");
  eq(fs.container.slots[5]?.amount, 3, "名前つきの品はシュルカーに残る");
}

// 2. 出品
eq(EX.createListing(alice, WHEAT, 0, 1).reason, "bad_qty", "数量は1以上");
eq(EX.createListing(alice, WHEAT, 10, 0).reason, "bad_price", "単価は1以上の整数");
eq(EX.createListing(alice, WHEAT, 10, ref + 1).reason, "price_too_high", "HRMHRMの売値を超える出品はできない");
eq(EX.createListing(alice, WHEAT, 101, ref).reason, "not_in_pool", "プールにある数まで");
eq(EX.createListing(carol, WHEAT, 1, ref).reason, "not_in_pool", "プールが空の人は出品できない");
const price = Math.max(1, ref - 1);
const bal0 = bal(alice);
const r1 = EX.createListing(alice, WHEAT, 60, price);
eq(r1.ok, true, "出品できる");
const fee = Math.max(1, Math.round(60 * price * PO.getPolicyParam("exchange_listing_fee_rate")));
eq(r1.fee, fee, "輸送費 = 出品額 × 割合(最低1E)");
eq(bal0 - bal(alice), fee, "輸送費が口座から引かれる");
eq(EX.getPool(alice.id)[WHEAT], 40, "出品した分はプールから減る");
const ex = A.getEntityAccount(EX.EXCHANGE_ACCOUNT_ID);
eq(ex?.type, "exchange", "取引所の専用口座ができる"); eq(ex?.cash, fee, "輸送費は専用口座の収入");
eq(A.decideIntervention({ ...ex, unsettledSince: 0 }, 50).action, "none", "専用口座は介入の対象外");
const offers = EX.listOffers(WHEAT);
eq(offers[0].kind, "player", "安い出品が先頭(出品者が先)"); eq(offers[0].price, price, "単価");
eq(offers.length, 2, "プレイヤーの出品 + HRMHRM");
// 出品数の上限
{
  const lim = PO.getPolicyParam("exchange_max_listings");
  const x = mkPlayer("xavier", 1e6); EX.addToPool(x.id, "minecraft:stick", 1000);
  let n = 0; while (EX.createListing(x, "minecraft:stick", 1, 1).ok) n++;
  eq(n, lim, "1人の出品数の上限");
  eq(EX.createListing(x, "minecraft:stick", 1, 1).reason, "too_many_listings", "上限に達したら断る");
}

// 3. 購入(安い順)
{
  const q = EX.quote(bob.id, WHEAT, 70);
  eq(q.ok, true, "見積りできる"); eq(q.plan[0].kind, "player", "安い出品から選ぶ"); eq(q.plan[0].take, 60, "出品の数まで"); eq(q.plan[1].kind, "hrmhrm", "足りない分はHRMHRM"); eq(q.plan[1].take, 10, "HRMHRMから10");
  eq(q.total, 60 * price + 10 * ref, "合計");
  eq(EX.quote(alice.id, WHEAT, 70).plan[0].kind, "hrmhrm", "自分の出品は、自分では買えない");
  eq(EX.quote(bob.id, WHEAT, 5000).reason, "not_enough_stock", "在庫が足りなければ断る");
  eq(EX.quote(bob.id, WHEAT, 0).reason, "bad_qty", "数量は1以上");
  const week = Math.floor(W.day / 7);
  const before = { alice: bal(alice), bob: bal(bob) };
  const res = EX.buy(bob, WHEAT, 70);
  eq(res.ok, true, "買える"); eq(res.total, q.total, "代金");
  eq(before.bob - bal(bob), q.total, "買い手から代金が引かれる");
  eq(bal(alice) - before.alice, 60 * price, "売り手(オンライン)に代金が入る");
  eq(EX.getHrmhrmStock(WHEAT), 792 - 10, "HRMHRMの在庫が減る");
  eq(EX.getInbox(bob.id)[WHEAT], 70, "買い手の入荷一覧に入る");
  eq(EX.listOffers(WHEAT).filter((o) => o.kind === "player").length, 0, "売り切れた出品は消える");
  eq(L.getWeekSummary(week).netIssuance, 0, "取引はお金の発行にならない(輸送費・取引は market / spend)");
  const poor = mkPlayer("poor", 5);
  eq(EX.buy(poor, WHEAT, 10).reason, "no_card", "残高が足りず、カードも無ければ買えない");
  eq(EX.getInbox(poor.id)[WHEAT], undefined, "買えなかった時は何も起きない");
  // カード(リボ)は、HRMHRMの分の不足にだけ使える
  poor.setDynamicProperty("cr_card_limit", 100000); poor.setDynamicProperty("cr_card_balance", 0);
  const need = 10 * ref;
  const rc = EX.buy(poor, WHEAT, 10);
  eq(rc.ok, true, "HRMHRMの分は、カードで足りない分を払える"); eq(rc.fromCard, need - 5, "不足分がカードに回る");
  eq(poor.getDynamicProperty("cr_card_balance"), need - 5, "カードの残高が増える"); eq(bal(poor), 0, "現金は使い切る");
  eq(EX.getInbox(poor.id)[WHEAT], 10, "入荷一覧に入る");
  poor.setDynamicProperty("cr_card_limit", need); poor.setDynamicProperty("cr_card_balance", need - 5);
  eq(EX.buy(poor, WHEAT, 10).reason, "credit_limit", "カードの限度を超えたら買えない");
  poor.setDynamicProperty("cr_card_suspended", true);
  eq(EX.buy(poor, WHEAT, 10).reason, "card_suspended", "カードが停止中なら買えない");
  poor.setDynamicProperty("cr_card_suspended", false);
  // プレイヤーの出品は、現金でしか買えない(カードでお金が新しく出るのを防ぐ)
  EX.addToPool(alice.id, WHEAT, 5); EX.createListing(alice, WHEAT, 5, price);
  poor.setDynamicProperty("cr_card_limit", 1e9); poor.setDynamicProperty("cr_card_balance", 0);
  eq(EX.buy(poor, WHEAT, 5).reason, "insufficient_funds", "プレイヤーの出品は、現金が足りなければ、カードがあっても買えない");
  EX.cancelListing(alice, WHEAT, EX.listMyListings(alice.id)[0].id);
}

// 3b. 分類と品目一覧 / 専用シュルカーの中身
{
  eq(EX.categoryOf(WHEAT), "fresh", "小麦は生鮮物"); eq(EX.categoryOf("minecraft:diamond"), "rare", "ダイヤは希少資源");
  eq(EX.categoryOf("minecraft:oak_log"), "general", "原木は一般資源");
  eq(EX.categoryOf("minecraft:blaze_rod"), null, "取引リストにない品は分類なし"); eq(EX.isTradable("minecraft:blaze_rod"), false, "取引リストにない品は取引できない");
  eq(EX.categoryOf("minecraft:unknown_thing"), null, "分からない品は分類なし");
  eq(EX.createListing(alice, "minecraft:blaze_rod", 1, 1).reason, "not_in_pool", "リストにない品は、出品の時点で自動で載る(プールに無ければ not_in_pool)"); eq(EX.isTradable("minecraft:blaze_rod"), true, "自動で載った");
  let n = 0, nv = 0; for (const c of EX.exchangeTree()) for (const g of c.groups) for (const [id] of g.items) { if (g.key === "addon") continue; if (id.includes("#")) nv++; else n++; }
  eq(n, 305, "取引リストは305品目(ふつうの品)"); eq(nv, 263, "種類つきの品(エンチャント本125 + ポーション138)は263品目"); eq(EX.exchangeTree().length, 3, "分類は3つ");
  eq(EX.groupItems("fresh", "produce").length, 4, "農作物は4品目"); eq(EX.groupItems("fresh", "produce")[0].itemId, WHEAT, "表の順(小麦が先頭)");
  eq(EX.groupItems("general", "logs").every((x) => x.count === 0), true, "出品がない品も一覧に出る(出品0件)");
  const fresh = EX.listCategoryItems("fresh");
  eq(fresh.some((x) => x.itemId === WHEAT), true, "生鮮物の一覧に小麦がある");
  if (!(fresh.find((x) => x.itemId === WHEAT).price >= 1)) fail("最安の単価が出る");
  eq(EX.listCategoryItems("rare").every((x) => EX.isTradable(x.itemId)), true, "希少資源の常設出品も、取引リストの品だけ");
  const sc = EX.shulkerContents(alice);
  eq(sc.ok, true, "専用シュルカーの中身を読める"); eq(sc.items["minecraft:dirt"], 10, "通常の品を数える"); eq(sc.items[WHEAT], undefined, "名前つきの小麦は数えない");
  eq(EX.shulkerContents(carol).reason, "no_binding", "専用シュルカーが無ければ no_binding");
}

// 4. 売り手がオフライン: 代金は保留 → ログイン時
{
  EX.addToPool(alice.id, WHEAT, 20);
  const r = EX.createListing(alice, WHEAT, 20, price);
  eq(r.ok, true, "出品");
  players.splice(players.indexOf(alice), 1);
  const b0 = bal(alice);
  EX.buy(bob, WHEAT, 20);
  eq(bal(alice), b0, "オフラインの間は入らない(保留)");
  players.push(alice);
  eq(EX.claimProceeds(alice), 20 * price, "ログイン時に、保留の代金が入る");
  eq(bal(alice), b0 + 20 * price, "口座に入った");
  eq(EX.claimProceeds(alice), 0, "二重には入らない");
}

// 5. 入荷: 専用シュルカーへ届ける
{
  const bs = mkShulker(20);
  eq(EX.deliverInbox(bob).reason, "no_binding", "専用シュルカーが無いと届けられない(入荷一覧に残る)");
  eq(EX.getInbox(bob.id)[WHEAT], 90, "入荷一覧に残っている");
  bind(bob, bs.b);
  blocks.set(key("overworld", 20, 64, 0), undefined);
  eq(EX.deliverInbox(bob).reason, "unloaded", "チャンクが読み込まれていない間は届けない");
  blocks.set(key("overworld", 20, 64, 0), bs.b);
  const d = EX.deliverInbox(bob);
  eq(d.ok, true, "届く"); eq(d.delivered[WHEAT], 90, "90個届く");
  eq(Object.keys(EX.getInbox(bob.id)).length, 0, "入荷一覧は空になる");
  eq(bs.container.slots.filter(Boolean).reduce((a, s) => a + s.amount, 0), 90, "シュルカーに入っている");
  // あふれ: 27スロットを超える分は入荷一覧に残る
  EX.addToInbox(bob.id, "minecraft:cobblestone", 64 * 30);
  const d2 = EX.deliverInbox(bob);
  eq(d2.left["minecraft:cobblestone"] > 0, true, "入りきらない分は入荷一覧に残る");
  eq(EX.getInbox(bob.id)["minecraft:cobblestone"], d2.left["minecraft:cobblestone"], "残りが入荷一覧に保存される");
  eq(bs.container.slots.every(Boolean), true, "シュルカーは満杯");
}

// 6. 取り下げ・期限
{
  EX.addToPool(carol.id, WHEAT, 50); carol.setDynamicProperty("acc_emeralds", 1e5);
  const r = EX.createListing(carol, WHEAT, 50, price); eq(r.ok, true, "carol が出品");
  eq(EX.cancelListing(alice, WHEAT, r.id).reason, "not_yours", "他人の出品は取り下げられない");
  eq(EX.cancelListing(carol, WHEAT, 9999).reason, "not_found", "無い出品");
  const c = EX.cancelListing(carol, WHEAT, r.id);
  eq(c.ok && c.returned, 50, "取り下げると、残りがプールへ戻る"); eq(EX.getPool(carol.id)[WHEAT], 50, "プールに戻った");
  const bc = bal(carol);
  const r2 = EX.createListing(carol, WHEAT, 50, price);
  players.splice(players.indexOf(carol), 1);                // オフラインでも、期限切れで戻る
  W.day += PO.getPolicyParam("exchange_listing_days");
  eq(EX.expireListings(W.day), 11, "期限切れの出品が終わる(carol の1件 + xavier の10件)");
  eq(EX.getPool(carol.id)[WHEAT], 50, "残りが、出品者のプールへ戻る(オフラインでも)");
  eq(EX.listOffers(WHEAT).filter((o) => o.kind === "player").length, 0, "出品は消える");
  if (bal(carol) >= bc) fail("輸送費は戻らない");
}

// 7. HRMHRMの在庫の補充(日次)
{
  EX.dailyUpkeep(W.day);                                   // 初回は、基準の日を記録するだけ(補充しない)
  const before = EX.getHrmhrmStock(WHEAT);
  W.day += 1;
  eq(EX.dailyUpkeep(W.day), true, "日が変わると日次の処理が動く");
  eq(EX.dailyUpkeep(W.day), false, "同じ日には二重に動かない");
  eq(EX.getHrmhrmStock(WHEAT), Math.min(792, before + Math.ceil(792 * PO.getPolicyParam("exchange_hrmhrm_refill_ratio"))), "1日ぶん補充される");
  for (let i = 0; i < 10; i++) { W.day += 1; EX.dailyUpkeep(W.day); }
  eq(EX.getHrmhrmStock(WHEAT), 792, "常設数を超えては補充されない");
}

// 8. 週次の締め: 専用口座も HRMHRM の週次処理に入る。足りなければ開発銀行機構が支給する(介入の対象にはならない)
{
  H.ensureHrmhrmAccount();
  const cash0 = A.getEntityAccount(EX.EXCHANGE_ACCOUNT_ID).cash;
  W.day += 14;
  const n = H.runHrmhrmWeekly();
  if (!(n >= 1)) fail("週次の締めが動く");
  const ex2 = A.getEntityAccount(EX.EXCHANGE_ACCOUNT_ID);
  if (!ex2) fail("専用口座が消えていない");
  if (!(ex2.cash >= cash0)) fail("専用口座の現金が減らない(運用はしない)");
  eq(ex2.weekly.length >= 1, true, "週次の記録が残る");
  eq(ex2.unsettledSince, null, "精算不能にならない");
  eq(A.getInterventions().filter((i) => i.entityId === EX.EXCHANGE_ACCOUNT_ID).length, 0, "介入の案件にならない");
}

// 9. 管理コマンド(確認用)
{
  const z = mkPlayer("zed", 1e6); z.typeId = "minecraft:player";
  const run = (msg) => { z.msgs.length = 0; for (const f of subs.event) f({ id: "bmh:exchange", sourceEntity: z, message: msg }); return z.msgs.join("\n"); };
  EX.startExchange();
  const zs = mkShulker(30, [mkStack(WHEAT, 64)]); bind(z, zs.b);
  eq(run("pull wheat 64"), "pulled 64", "pull");
  if (!run("list wheat 10 " + price).startsWith("listed #")) fail("list");
  if (!run("offers wheat").includes("zed")) fail("offers に出品者が出る");
  if (!run("mine").includes("wheat")) fail("mine");
  eq(run("pool"), "pool: wheat x54", "pool");
  if (!run("buy wheat 1").startsWith("bought")) fail("buy (自分の出品は選ばれず HRMHRM から)");
  eq(run("inbox"), "inbox: wheat x1", "inbox");
  if (!run("deliver").startsWith("delivered: wheat x1")) fail("deliver: " + run("deliver"));
  eq(run("nonsense").startsWith("usage"), true, "usage");
  eq(run("buy wheat 5000"), "not_enough_stock", "在庫不足"); eq(run("buy wheat 99999"), "bad_qty", "1回の上限を超える数量は買えない");
}

// 10. 起動
{
  eq(subs.spawn.length >= 1, true, "ログイン時の処理を購読する"); eq(subs.interval.length >= 1, true, "日次の処理を動かす");
  for (const f of subs.interval) f();
}


// 相場の統合(旧・ゴーレムの現物取引): 常設の相場の取引相手 / バルクは1,728個単位 / 相場に売る
{
  const OAK = "minecraft:oak_log", DIA = "minecraft:diamond";
  const mp = EX.marketPrice(DIA); const mo = EX.marketPrice(OAK);
  if (!(mp >= 1 && mo >= 1)) fail("相場の価格が1E以上: " + mp + " / " + mo);
  eq(EX.marketPrice("minecraft:blaze_rod"), null, "相場の無い品は null");
  eq(EX.listOffers(DIA).some((o) => o.kind === "market"), true, "ダイヤに相場の出品がある");
  eq(EX.groupItems("rare", "gems").find((x) => x.itemId === DIA).market, mp, "小分類の一覧に相場の価格が出る");
  eq(EX.groupItems("rare", "gems").find((x) => x.itemId === DIA).count, 0, "相場は出品の件数に数えない");
  // 小口の相場買い(ダイヤ): 相場の代金は残高から。台帳は commodity_buy
  const buyer = mkPlayer("marketbuyer", 1e6);
  const b0 = bal(buyer);
  const r1 = EX.buy(buyer, DIA, 10);
  eq(r1.ok, true, "相場でダイヤを買える"); eq(b0 - bal(buyer), mp * 10, "相場の代金が引かれる");
  eq(EX.getInbox(buyer.id)[DIA], 10, "入荷一覧に入る");
  const p2 = EX.marketPrice(DIA);
  if (!(p2 >= mp)) fail("買うと需要圧力で相場が下がらない: " + mp + " -> " + p2);
  // バルクの品(オークの原木)は、シュルカー1箱単位。小口は相場から買えない
  eq(EX.quote(buyer.id, OAK, 100).reason, "not_enough_stock", "バルクの品は小口で相場から買えない");
  const q = EX.quote(buyer.id, OAK, 1728);
  eq(q.ok, true, "1,728個なら相場から買える"); eq(q.total, mo * 1728, "バルクの代金は単価 × 個数");
  eq(EX.quote(buyer.id, OAK, 2000).reason, "not_enough_stock", "端数(272個)は相場から買えない");
  eq(EX.buy(buyer, OAK, 1728).ok, true, "バルクを買える"); eq(EX.getInbox(buyer.id)[OAK], 1728, "入荷一覧に1,728個");
  eq(EX.quote(buyer.id, OAK, 5185).reason, "bad_qty", "1回の上限(5,184個)を超えると買えない");
  // 相場に売る
  eq(EX.sellToMarket(buyer, DIA, 1).reason, "not_in_pool", "プールに無ければ売れない");
  EX.addToPool(buyer.id, DIA, 5);
  const b1 = bal(buyer); const pr = EX.marketPrice(DIA);
  const s1 = EX.sellToMarket(buyer, DIA, 5);
  eq(s1.ok, true, "プールの品を相場で売れる"); eq(bal(buyer) - b1, pr * 5, "売値 × 個数が入る"); eq(EX.getPool(buyer.id)[DIA], undefined, "プールから引かれる");
  eq(EX.sellToMarket(buyer, "minecraft:blaze_rod", 1).reason, "no_market", "相場の無い品は売れない");
  EX.addToPool(buyer.id, OAK, 1000);
  eq(EX.sellToMarket(buyer, OAK, 1000).reason, "bad_lot", "バルクの品は1,728個の倍数でだけ売れる");
  EX.addToPool(buyer.id, OAK, 728);
  eq(EX.sellToMarket(buyer, OAK, 1728).ok, true, "1,728個なら売れる");
}

// 検索
{
  const names = (q) => EX.searchItems(q).map((x) => x.itemId);
  eq(names("ダイヤ").includes("minecraft:diamond"), true, "「ダイヤ」でダイヤモンドが出る");
  eq(names("だいや").includes("minecraft:diamond"), true, "ひらがなでもカタカナの品が出る");
  eq(names("DIAMOND").includes("minecraft:diamond"), true, "英語(大文字)でも出る");
  eq(names("diamond_sword").includes("minecraft:diamond_sword"), true, "ID(アンダーバー付き)でも出る");
  eq(names("ﾀﾞｲﾔ").includes("minecraft:diamond"), true, "半角カナでも出る");
  eq(EX.searchItems("ボート").length, 10, "ボートは木の種類ごとに10種"); eq(EX.searchItems("いかだ").length, 1, "竹のイカダはひらがなでも出る");
  eq(EX.searchItems("").length, 0, "空の検索語は空");
  eq(EX.searchItems("zzzz").length, 0, "合わない語は空");
  eq(EX.searchItems("の").length <= 40, true, "多い時は40件まで");
  eq(EX.searchItems("オーク")[0].ja.startsWith("オーク"), true, "先頭一致が先に並ぶ");
  eq(EX.searchItems("ダイヤ").some((x) => x.itemId === "minecraft:diamond" && x.cat === "rare" && x.group === "gems"), true, "分類と小分類が付く");
}

console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
