// 暦・記念日・村のイベント(運んでよ・緊急調達)の検算スクリプト(Node 20+)。
//   node ../dev/check/check_village_events.mjs scripts      (パックのルートで実行)
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
const players = [];
globalThis.__stubWorld = {
  day: 100, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k), setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()],
  beforeEvents: {}, afterEvents: { playerSpawn: { subscribe() {} } }
};
globalThis.__stubSystem = { run(f) { f(); }, runInterval() { return 1; }, afterEvents: { scriptEventReceive: { subscribe() {} } } };
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,"+(s.includes("ui")?"ui":"server"),shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){
    if (u==="data:text/javascript,server") return {format:"module",shortCircuit:true,source:
      "export class ItemStack{ constructor(t,a=1){ this.typeId=t; this.amount=a; } }; export const world = globalThis.__stubWorld; export const system = globalThis.__stubSystem;" +
      "export class BlockVolume{ constructor(a,b){ this.from=a; this.to=b; } }; export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {}; export const BlockPermutation = {};"};
    if (u==="data:text/javascript,ui") return {format:"module",shortCircuit:true,source:"export class ActionFormData{}; export class ModalFormData{};"};
    return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const EX = await imp("economy/exchange.js");
const VJ = await imp("economy/village-jobs.js");
const JD = await imp("data/village-jobs-data.js");
const VD = await imp("economy/village-demand.js");
const A = await imp("economy/account.js");
const CR = await imp("economy/core-registry.js");
const PO = await imp("economy/policy.js");
const H = await imp("economy/hrmhrm.js");
const IT = await imp("data/exchange-items-data.js");
const W = globalThis.__stubWorld;

const CAL = await imp("economy/calendar.js");
const VE = await imp("economy/village-events.js");
const CY = await imp("economy/carry.js");
let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
const ok = (c, m) => { if (!c) fail(m); };

// ---- 暦 ----
eq(JSON.stringify(CAL.toDate(0)), JSON.stringify({ year: 1, month: 1, day: 1 }), "日数0は 1年1月1日");
eq(JSON.stringify(CAL.toDate(251)), JSON.stringify({ year: 1, month: 12, day: 21 }), "251日目は 1年12月21日(1年 = 252日)");
eq(JSON.stringify(CAL.toDate(252)), JSON.stringify({ year: 2, month: 1, day: 1 }), "252日目は 2年1月1日(うるう年なし)");
eq(CAL.formatDate(62, "ja"), "女王歴1年3月21日", "日本語の表記"); eq(CAL.formatDate(62, "en"), "Queen's Era 1, Month 3, Day 21", "英語の表記");
eq(CAL.anniversariesOn(62)[0]?.id, "rest", "3/21は慰労祭"); eq(CAL.anniversariesOn(100)[0]?.id, "founding", "5/17は創世記念祭"); eq(CAL.anniversariesOn(195)[0]?.id, "harvest", "10/7は収穫祭");
eq(CAL.anniversariesOn(63).length, 0, "ふつうの日は記念日なし");
eq(CAL.nextAnniversary(0).id, "rest", "次の記念日"); eq(CAL.nextAnniversary(0).inDays, 62, "あと62日");
ok(CAL.calendarLine("ja", 62).includes("慰労祭"), "当日は記念日の名前が出る"); ok(CAL.calendarLine("ja", 0).includes("あと62日"), "ふだんは次の記念日");
// 戦勝記念日: 初めて村の英雄を得た日付を記録 → 翌年から、その日に全員へ付与
const mkP = (hero) => { const m = new Map(); return { getEffect: () => (hero ? {} : undefined), addEffect(id, t, o) { (this.fx ??= []).push(id); }, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) }; };
eq(CAL.getVictoryDay(), null, "はじめは記録なし");
// カレンダー表示: 未登録の表示 / 固定祭のあと何日 / 管理コマンドの出力
ok(CAL.worldRecordLine("victory", "ja").includes("未登録"), "戦勝記念日は未登録と出る"); ok(CAL.worldRecordLine("villagers", "ja").includes("未登録"), "村民の日も未登録と出る");
{ const f = CAL.fixedFestivalStatus(0); eq(f.find((x) => x.id === "rest").inDays, 62, "慰労祭まであと62日"); eq(CAL.fixedFestivalStatus(62).find((x) => x.id === "rest").inDays, 0, "当日は0日");
  eq(CAL.fixedFestivalStatus(63).find((x) => x.id === "rest").inDays, 251, "翌日は次の年(251日後)"); ok(CAL.fixedFestivalLines("ja", 62)[0].includes("今日です"), "当日は「今日です」"); }
ok(CAL.calendarReport(0).length === 5 && CAL.calendarReport(0)[1].includes("未登録"), "管理コマンドの出力(5行)");
const hero = mkP(true), plain = mkP(false);
CAL.patrolHero([plain], 300); eq(CAL.getVictoryDay(), null, "村の英雄がいなければ記録しない");
CAL.patrolHero([hero, plain], 300); eq(CAL.getVictoryDay(), 300, "初めて村の英雄を得た日を記録");
{ const l = CAL.worldRecordLine("victory", "ja"); ok(l.includes("毎年") && l.includes("ワールド300日目") && l.includes("女王歴2年"), "登録日は、記録した当日にも表示される: " + l);
  eq(CAL.anniversariesOn(300).filter((x) => x.id === "victory").length, 0, "記録した当日は祝祭にしない(表示とは別)"); }
CAL.patrolHero([mkP(true)], 400); eq(CAL.getVictoryDay(), 300, "記録は最初の1回だけ");
eq(CAL.anniversariesOn(300).some((a) => a.id === "victory"), false, "記録した当日は記念日にしない");
const vday = 300 + 252; // 翌年の同じ月日
ok(CAL.anniversariesOn(vday).some((a) => a.id === "victory"), "翌年の同じ日は戦勝記念日");
const p1 = mkP(false), p2 = mkP(false);
eq(CAL.patrolHero([p1, p2], vday), 2, "その日いる全員に村の英雄を付ける"); eq(p1.fx[0], "village_hero", "村の英雄");
eq(CAL.patrolHero([p1, p2], vday), 0, "同じ日に二重には付けない");
eq(CAL.patrolHero([p1], vday + 1), 0, "記念日でない日には付けない");
// 村民の日
const mkV = (id, pop, extra = {}) => { CR.saveCore({ id, kind: "village", name: "村" + id, nameEn: "V" + id, dimId: "minecraft:overworld", x: extra.x ?? 0, y: 64, z: extra.z ?? 0, pop, popDay: 1, stock: extra.stock ?? {}, orders: [], jobs: extra.jobs ?? {}, lastShip: extra.lastShip, ownerId: "o", ...extra.core }); A.createEntityAccount({ id, type: "village", name: { ja: id, en: id }, cash: extra.cash ?? 100000, population: pop }); CR.resetCoreIndexForTest(); return id; };
mkV("VPOP1", 19);
eq(CAL.patrolVillagers(400), false, "19人ではまだ"); eq(CAL.getVillagersDay(), null, "記録なし");
mkV("VPOP2", 20);
eq(CAL.patrolVillagers(410), true, "初めて20人に達した日を記録"); eq(CAL.getVillagersDay(), 410, "その日"); eq(CAL.patrolVillagers(420), false, "二度は記録しない");
// 贈り物
const gp = mkP(false); const an = CAL.anniversariesOn(62)[0];
eq(CAL.giftAvailable(gp, an), true, "贈り物を受け取れる"); CAL.markGiftClaimed(gp, an); eq(CAL.giftAvailable(gp, an), false, "その年は1回だけ");
eq(CAL.giftAvailable(gp, CAL.anniversariesOn(62 + 252)[0]), true, "翌年はまた受け取れる");
eq(CAL.giftAvailable(gp, CAL.anniversariesOn(vday).find((a) => a.id === "victory")), false, "戦勝記念日は贈り物でなく村の英雄");

// ---- 鮮度による係数 ----
eq(CY.freshFactor(100), 1, "100%は満額"); eq(CY.freshFactor(80), 1, "80%は満額"); eq(CY.freshFactor(50), 0.5, "50%以下は半額"); eq(CY.freshFactor(10), 0.5, "10%も半額");
ok(Math.abs(CY.freshFactor(65) - 0.75) < 1e-9, "50超〜79%は線形(65% = 0.75)"); eq(CY.freshFactor(null), 1, "スタンプなしは満額");

// ---- 運んでよ ----
let seq = 0;
const mkPlayer = (name, bal) => { const m = new Map([["acc_emeralds", bal]]); return { id: "pid" + ++seq, name, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) }; };
const DAY = 500;
const cap = VE.storeCap();
eq(cap, 1024, "蔵の上限の既定は1024");
const mkWorld = () => { for (const c of CR.listCores("village")) { c.dissolved = true; CR.saveCore(c); } CR.resetCoreIndexForTest(); };
mkWorld();
mkV("VA", 6, { stock: { "minecraft:wheat": 800 }, lastShip: { produced: { "minecraft:wheat": 5 } } });
eq(VE.updateVillageEvents(DAY), 0, "村が1つだけなら、運んでよは出ない"); eq(CR.loadCore("VA").events?.length ?? 0, 0, "イベントなし");
mkV("VB", 6, { x: 100, z: 0, stock: {}, cash: 50000 });
mkV("VC", 6, { x: 5000, z: 0, stock: {} });
VE.updateVillageEvents(DAY);
let a = CR.loadCore("VA"); const evc = a.events?.find((e) => e.type === "carry");
ok(evc, "蔵が75%を超えた村は、運んでよを出す");
eq(evc?.itemId, "minecraft:wheat", "先週つくった品のうち蔵に多いもの"); eq(evc?.qty, 256, "数量は蔵の半分(上限256)"); eq(evc?.toId, "VB", "届け先はいちばん近い村"); eq(evc?.exp, DAY + 14, "期限は2週間");
VE.updateVillageEvents(DAY + 1); eq(CR.loadCore("VA").events.filter((e) => e.type === "carry").length, 1, "同じ村で二重には出さない");
mkV("VQUIET", 6, { x: 9000, stock: { "minecraft:stick": 10 } }); VE.updateVillageEvents(DAY); eq(CR.loadCore("VQUIET").events?.length ?? 0, 0, "蔵に余裕があれば出さない");
const player = (() => { const p = mkPlayer("rider", 0); return p; })();
eq(VE.eventsAt(a, DAY).filter((e) => e.type === "carry").length, 1, "村の画面に出る");
// 引き受ける
const acc = VE.acceptCarry("VA", evc.id, player, DAY);
eq(acc.ok, true, "引き受けられる"); eq(CR.loadCore("VA").stock["minecraft:wheat"], 800 - 256, "蔵から手持ちへ");
eq(VE.eventsAt(CR.loadCore("VA"), DAY).filter((e) => e.type === "carry").length, 0, "引き受けたら1段目から消える");
eq(VE.acceptCarry("VA", evc.id, mkPlayer("other", 0), DAY).reason, "gone", "別の人は引き受けられない");
eq(VE.carriesFor("VB", player, DAY).length, 1, "届け先のこの人の届け物に出る"); eq(VE.carriesFor("VC", player, DAY).length, 0, "ほかの村には出ない");
// 手持ちが足りない
let held = 100, factor = 1;
const ops = { count: () => held, take: (id, n) => { held -= n; return { n, factor }; } };
const nr = VE.deliverCarry("VB", "VA", evc.id, player, ops, DAY);
eq(nr.reason, "not_enough", "数が足りなければ渡せない"); eq(held, 100, "足りないときは何も引かない");
held = 300; factor = 0.5;
const cashB = A.getEntityAccount("VB").cash, balP = player.getDynamicProperty("acc_emeralds") ?? 0;
const dr = VE.deliverCarry("VB", "VA", evc.id, player, ops, DAY);
eq(dr.ok, true, "届け物を渡せる");
eq(dr.paid, Math.floor(evc.unit * 256 * 0.5), "報酬は 単価×数×鮮度の係数");
eq(A.getEntityAccount("VB").cash, cashB - dr.paid, "報酬は届け先の村が払う"); eq(player.getDynamicProperty("acc_emeralds"), balP + dr.paid, "プレイヤーに入る");
eq(CR.loadCore("VB").stock["minecraft:wheat"], 256, "品物は届け先の蔵に入る"); eq(CR.loadCore("VA").events.filter((e) => e.type === "carry").length, 0, "完了したら消える");
// 蔵がいっぱい
mkV("VFULL", 6, { x: 90, stock: { "minecraft:stick": 1000 } });
const evF = { id: "carry:t:1", type: "carry", itemId: "minecraft:wheat", qty: 256, unit: 1, exp: DAY + 5, toId: "VFULL", toNames: { ja: "満", en: "Full" }, by: player.id };
{ const h = CR.loadCore("VA"); h.events = [evF]; CR.saveCore(h); }
held = 300; eq(VE.deliverCarry("VFULL", "VA", evF.id, player, ops, DAY).reason, "full", "届け先の蔵が上限を超えるなら受け取らない"); eq(held, 300, "引かない");
// 期限(2週間)・届け先の解散
{ const h = CR.loadCore("VA"); h.events = [{ ...evF, toId: "VB", exp: DAY + 14 }]; CR.saveCore(h); }
VE.updateVillageEvents(DAY + 15); eq((CR.loadCore("VA").events ?? []).filter((e) => e.type === "carry" && e.id === evF.id).length, 0, "期限(2週間)を過ぎたら消える");
{ const h = CR.loadCore("VA"); h.events = [{ ...evF, toId: "VGONE", exp: DAY + 14 }]; CR.saveCore(h); }
VE.updateVillageEvents(DAY + 2); eq((CR.loadCore("VA").events ?? []).filter((e) => e.id === evF.id).length, 0, "届け先が解散したら取り消し");

// ---- 緊急調達 ----
mkWorld();
mkV("VJOB", 6, { jobs: { "minecraft:composter": 2 }, stock: {} });
VE.updateVillageEvents(DAY);
const ju = CR.loadCore("VJOB"); const evu = ju.events?.find((e) => e.type === "urgent");
ok(evu, "職業の原料が足りない村は、緊急調達を出す");
eq(evu?.itemId, "minecraft:wheat_seeds", "原料は小麦の種"); ok(Math.abs(evu.unit - VD.unitPrice("minecraft:wheat_seeds") * 1.5) < 1e-9, "単価は通常の1.5倍");
const need0 = evu.qty;
held = 1000; factor = 1;
const ur = VE.deliverUrgent("VJOB", evu.id, 10, player, ops, DAY);
eq(ur.ok, true, "納められる"); eq(ur.qty, 10, "10個"); eq(ur.paid, Math.floor(evu.unit * 10), "報酬は単価×数");
eq(CR.loadCore("VJOB").events.find((e) => e.id === evu.id).qty, need0 - 10, "残りが減る");
eq(CR.loadCore("VJOB").stock["minecraft:wheat_seeds"], 10, "蔵に入る");
eq(VE.deliverUrgent("VJOB", evu.id, 5, player, { count: () => 2, take: ops.take }, DAY).reason, "not_enough", "手持ちが足りなければ納められない");
{ const c = CR.loadCore("VJOB"); c.stock["minecraft:wheat_seeds"] = 99999; CR.saveCore(c); }
VE.updateVillageEvents(DAY + 1); eq((CR.loadCore("VJOB").events ?? []).filter((e) => e.type === "urgent").length, 0, "原料が足りれば取り下げる");

console.log(errors === 0 ? "OK  暦・記念日・村のイベント: すべて通過" : errors + " problem(s)");
process.exit(errors ? 1 : 0);
