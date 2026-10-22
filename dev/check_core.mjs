// 法人テンプレート(economy/core-registry.js)の検算スクリプト(Node 20+)。
//   node dev/check_core.mjs scripts      (パックのルートで実行)
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
const store = new Map();
const players = [];
globalThis.__stubWorld = {
  day: 7 * 10 + 2, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()]
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { run(f){ f(); }, runInterval(){}, afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const C = await imp("economy/core-registry.js");
const L = await imp("economy/ledger.js");
const A = await imp("economy/account.js");
const P = await imp("economy/policy.js");
const H = await imp("economy/hrmhrm.js");
const LB = await imp("economy/labor.js");
const FA = await imp("economy/facility.js");
const CF = await imp("economy/company-facility.js");
const CR = await imp("economy/credit.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
let seq = 0;
const mkPlayer = (name, bal = 0, online = true) => {
  const m = new Map([["acc_emeralds", bal]]);
  const p = { id: "id" + ++seq, name, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) };
  if (online) players.push(p);
  return p;
};
const goOffline = (p) => { players.splice(players.indexOf(p), 1); };
const bal = (p) => p.getDynamicProperty("acc_emeralds");
let X = 0;
const spec = (kind, name) => ({ kind, dimId: "overworld", x: (X += 200), y: 64, z: 0, typeId: kind === "village" ? "minecraft:bell" : "minecraft:lodestone", states: {}, name });
const FEE = 1_000_000;

H.ensureHrmhrmAccount();

// ---- 登記: 料金 ----
let a = mkPlayer("alice", 500_000);
let consumed = 0;
const cat = { hasCatalyst: () => true, consumeCatalyst: () => { consumed++; return true; } };
let r = C.registerCore(a, spec("company", "メナス採掘"), cat);
if (r.ok || r.reason !== "insufficient_funds" || r.fee !== FEE) fail("残高不足は拒否(料金つき): " + JSON.stringify(r));
eq(bal(a), 500_000, "拒否したら残高は動かない"); eq(consumed, 0, "拒否したら触媒は消えない");
eq(C.getRegistrationFee(), FEE, "登録料 = 15625 × 64 = 100万E");
a.setDynamicProperty("acc_emeralds", 2_000_000);
r = C.registerCore(a, spec("company", "HRMHRM商事"), cat);
eq(r.reason, "name_reserved", "予約語(HRMHRMを含む)は拒否");
r = C.registerCore(a, spec("company", ""), cat); eq(r.reason, "name_empty", "空の名前");
r = C.registerCore(a, spec("company", "あいうえおかきくけこさ"), cat); eq(r.reason, "name_too_long", "11文字は長すぎる");
r = C.registerCore(a, spec("company", "メナス採掘"), { ...cat, hasCatalyst: () => false }); eq(r.reason, "no_catalyst", "触媒がなければ拒否");
eq(bal(a), 2_000_000, "触媒なしの拒否では料金も引かれない");

r = C.registerCore(a, spec("company", "メナス採掘"), cat);
if (!r.ok) fail("登記: " + JSON.stringify(r));
const co = r.core;
eq(bal(a), 1_000_000, "登録料が引かれる"); eq(consumed, 1, "触媒は1個消える");
eq(L.getWeekFlows(L.getCurrentWeek()).out.core_fee, FEE, "台帳に core_fee が載る");
const acct = A.getEntityAccount(co.id);
if (!acct || acct.type !== "company" || co.id.length !== 6) fail("口座が作られる(ID=口座ID)");
eq(C.getCoreAtPos(co.dimId, co.x, co.y, co.z)?.id, co.id, "位置から引ける");
eq(C.registerCore(a, spec("company", "別会社"), cat).reason, "one_company", "1人1社");
eq(C.registerCore(mkPlayer("bob", 5_000_000), spec("company", " メナス 採掘 "), cat).reason, "name_duplicate", "重複(空白無視)は拒否");
// 週次の締め: 登録料は HRMHRM の収益になる
{ const acc = A.getEntityAccount("hrmhrm"); const rec = H.closeWeekFromLedger(acc, L.getCurrentWeek());
  if (rec.revenue < FEE) fail("登録料は HRMHRM の収益に入る: " + rec.revenue); }

// ---- 村 ----
const vOwner = mkPlayer("vera");
const vs = spec("village");
r = C.registerCore(vOwner, vs, cat);
if (!r.ok || r.fee !== 0) fail("村は無料: " + JSON.stringify(r));
const vil = r.core;
eq(A.getEntityAccount(vil.id)?.type, "village", "村の口座");
r = C.registerCore(mkPlayer("w"), { ...vs, x: vs.x + 60 }, cat); eq(r.reason, "village_overlap", "範囲内の重ね登記は拒否");
r = C.registerCore(mkPlayer("w2"), { ...vs, x: vs.x + 65 }, cat); eq(r.ok, true, "範囲外なら登記できる");
eq(C.registerCore(mkPlayer("z"), vs, cat).reason, "already_registered", "同じ位置は拒否");

// ---- 人員・代行 ----
const m1 = mkPlayer("carol");
eq(C.applyToCompany(co.id, m1).ok, true, "応募");
eq(C.applyToCompany(co.id, m1).reason, "already_applied", "二重応募は拒否");
eq(C.applyToCompany(co.id, a).reason, "is_owner", "社長は応募できない");
const stranger = mkPlayer("dan");
eq(C.reviewApplicant(co.id, stranger.id, m1.id, true, C.onlineIdSet()).reason, "forbidden", "他人は採用できない");
eq(C.reviewApplicant(co.id, a.id, m1.id, true, C.onlineIdSet()).hired, true, "社長が採用");
eq(C.isMember(C.loadCore(co.id), m1.id), true, "メンバーに入る");
const m2 = mkPlayer("erin"); C.applyToCompany(co.id, m2);
eq(C.reviewApplicant(co.id, m1.id, m2.id, true, C.onlineIdSet()).reason, "forbidden", "社長がオンラインの間、メンバーは採用できない");
goOffline(a);
eq(C.reviewApplicant(co.id, m1.id, m2.id, true, C.onlineIdSet()).hired, true, "社長が不在ならメンバーが代行できる");
players.push(a);
eq(C.leaveCompany(co.id, m2.id).ok, true, "退職");

// ---- 清算の見積もり・任意解散 ----
{
  const ac = A.getEntityAccount(co.id); ac.cash = 400_000; ac.holdings = { gold_ingot: 100 }; A.saveEntityAccount(ac);
  const est = C.estimateLiquidation(C.loadCore(co.id), "voluntary");
  eq(est.ratio, 0.65, "任意は65%");
  eq(est.bankBuy, Math.round(est.holdingsValue * 0.65), "買取 = 時価 × 65%");
  eq(est.result, 400_000 + est.bankBuy, "結果 = 現金 + 買取 − 負債");
  eq(est.creditRatio, 0.2, "信用 20%減"); eq(est.cooldownDays, 14, "待ち 14日");
  const hrGold = A.getEntityAccount("hrmhrm").holdings.gold_ingot;
  const before = bal(a), score = CR.getCreditScore(a);
  const res = C.dissolveCore(C.loadCore(co.id), { mode: "voluntary", reason: "dissolved" });
  if (!res.ok) fail("解散: " + JSON.stringify(res));
  eq(bal(a), before + est.payout, "残りが社長へ払われる");
  eq(A.getEntityAccount(co.id), null, "口座は閉じる");
  eq(A.getEntityAccount("hrmhrm").holdings.gold_ingot, hrGold + 100, "現物は銀行(HRMHRM)へ");
  eq(CR.getCreditScore(a), score - Math.round(score * 0.2), "信用スコアが20%下がる");
  eq(C.readRec(co.id).dissolved, true, "墓標が残る");
  eq(C.getCoreAtPos(co.dimId, co.x, co.y, co.z), undefined, "索引から外れる");
  eq(C.saveCore({ ...co, name: "復活" }), false, "墓標のIDには保存を通さない(復活の防止)");
  eq(C.cooldownDaysLeft(a.id), 14, "再登記の待ち 14日");
  eq(C.registerCore(a, spec("company", "新会社"), cat).reason, "cooldown", "待ち中は再登記できない");
  W.day += 14;
  eq(C.registerCore(a, spec("company", "新会社"), cat).ok, true, "14日後は再登記できる");
}

// ---- 債務超過の任意解散(許される。ペナルティと貸倒れ) ----
{
  const b = mkPlayer("frank", 3_000_000);
  const c = C.registerCore(b, spec("company", "赤字商会"), cat).core;
  const ac = A.getEntityAccount(c.id); ac.cash = 1000; ac.liabilities = 51_000; A.saveEntityAccount(ac);
  const before = bal(b), bad = C.getBadDebtTotal();
  const res = C.dissolveCore(C.loadCore(c.id), { mode: "voluntary", reason: "dissolved" });
  eq(res.est.shortfall, 50_000, "不足額"); eq(res.est.payout, 0, "払いはなし");
  eq(bal(b), before, "社長の口座は動かない(個人に請求しない)");
  eq(C.getBadDebtTotal(), bad + 50_000, "貸倒れに記録");
  eq(CR.getCreditScore(b), 600 - 120, "信用は減点される");
}

// ---- 社長がオフラインでの強制解散: 払いと減点は保留してログインで適用 ----
{
  const g = mkPlayer("gina", 3_000_000);
  const c = C.registerCore(g, spec("company", "留守商会"), cat).core;
  const ac = A.getEntityAccount(c.id); ac.cash = 100_000; A.saveEntityAccount(ac);
  goOffline(g);
  const res = C.dissolveCore(C.loadCore(c.id), { mode: "forced", reason: "forced" });
  eq(res.est.ratio, 0.6, "強制は60%"); eq(res.est.creditRatio, 0.4, "強制の信用は40%減"); eq(res.est.cooldownDays, 28, "強制の待ちは28日");
  eq(res.offline, true, "オフラインは保留"); eq(bal(g), 2_000_000, "保留中は口座が動かない");
  eq(C.cooldownDaysLeft(g.id), 28, "待ちは直ちに付く");
  players.push(g);
  const ap = C.applyPendingFor(g);
  eq(ap.paid, 100_000, "ログインで清算金を受け取る"); eq(bal(g), 2_100_000, "口座に入る");
  eq(CR.getCreditScore(g), 600 - 240, "ログインで減点"); eq(C.applyPendingFor(g), null, "二重適用しない");
}

// ---- 日次の保守 ----
{
  const h = mkPlayer("hank", 3_000_000);
  const c = C.registerCore(h, spec("company", "一人会社"), cat).core;
  goOffline(h);
  eq(C.runUpkeep(C.loadCore(c.id), { ownerOnline: false }), null, "不在の初日は何もしない");
  W.day += 29;
  eq(C.runUpkeep(C.loadCore(c.id), { ownerOnline: false }), null, "29日目はまだ");
  W.day += 1;
  const u = C.runUpkeep(C.loadCore(c.id), { ownerOnline: false });
  eq(u?.action, "abandoned", "30日で強制解散(清算を通る)"); eq(C.readRec(c.id).reason, "abandoned", "墓標の理由");
  eq(C.cooldownDaysLeft(h.id), 28, "強制のペナルティが付く");

  const i = mkPlayer("ivy", 3_000_000);
  const c2 = C.registerCore(i, spec("company", "二人会社"), cat).core;
  const j = mkPlayer("jack"); C.applyToCompany(c2.id, j); C.reviewApplicant(c2.id, i.id, j.id, true, C.onlineIdSet());
  goOffline(i); W.day += 100;
  eq(C.runUpkeep(C.loadCore(c2.id), { ownerOnline: false }), null, "メンバーがいる会社は不在でも消えない");

  // 介入案件のある会社は強制解散
  const k = mkPlayer("kate", 3_000_000);
  const c3 = C.registerCore(k, spec("company", "危機商会"), cat).core;
  A.queueIntervention(c3.id, "company", "company_unsettled", L.getCurrentWeek());
  eq(C.runUpkeep(C.loadCore(c3.id), { ownerOnline: true })?.action, "forced", "介入案件 → 強制解散");
  eq(A.getInterventions().filter((x) => x.entityId === c3.id && x.status === "open").length, 0, "介入案件は閉じる");
}

// ---- 村の人口0・口座の消滅 ----
{
  const o = mkPlayer("olga");
  const v = C.registerCore(o, spec("village"), cat).core;
  const day0 = W.day;
  C.recordPopulation(C.loadCore(v.id), { adults: 0, babies: 0 }, day0);
  W.day = day0 + 20; C.recordPopulation(C.loadCore(v.id), { adults: 0, babies: 0 }, W.day);
  eq(C.runUpkeep(C.loadCore(v.id), { ownerOnline: true }), null, "人口0が20日ではまだ");
  C.recordPopulation(C.loadCore(v.id), { adults: 3, babies: 1 }, W.day + 1);
  eq(C.loadCore(v.id).emptySince, undefined, "人口が戻ればカウントはリセット");
  eq(A.getEntityAccount(v.id).population, 4, "口座の人口も更新される");
  W.day += 2; C.recordPopulation(C.loadCore(v.id), { adults: 0, babies: 0 }, W.day);
  W.day += 28; C.recordPopulation(C.loadCore(v.id), { adults: 0, babies: 0 }, W.day);
  const u = C.runUpkeep(C.loadCore(v.id), { ownerOnline: true });
  eq(u?.action, "empty", "測れた日が全て0のまま4週 → 登記抹消");
  eq(C.cooldownDaysLeft(o.id), 0, "村の抹消に待ちはない");

  const o2 = mkPlayer("pia");
  const v2 = C.registerCore(o2, spec("village"), cat).core;
  A.deleteEntityAccount(v2.id); // HRMHRMの介入(人口0・精算不能)で口座が登録解除された状態
  eq(C.runUpkeep(C.loadCore(v2.id), { ownerOnline: true })?.action, "deregistered", "口座が消えた村は墓標になる");
  eq(C.readRec(v2.id).reason, "deregistered", "理由 deregistered");
}

// ---- 途中で止まった解散の再開(二重に払わない) ----
{
  const q = mkPlayer("quinn", 3_000_000);
  const c = C.registerCore(q, spec("company", "中断商会"), cat).core;
  const ac = A.getEntityAccount(c.id); ac.cash = 50_000; A.saveEntityAccount(ac);
  const core = C.loadCore(c.id);
  const est = C.estimateLiquidation(core, "voluntary");
  // 口座を閉じ・払いまで済んだところで止まった状態を作る
  A.deleteEntityAccount(c.id); q.setDynamicProperty("acc_emeralds", bal(q) + est.payout);
  core.dissolving = true; core.liq = { mode: "voluntary", reason: "dissolved", est, steps: { acct: true, pay: true, pen: false } }; C.saveCore(core);
  const before = bal(q);
  eq(C.resumeDissolutions(), 1, "再開される");
  eq(bal(q), before, "払いは二重にならない");
  eq(C.readRec(c.id).dissolved, true, "最後まで進んで墓標になる");
  eq(CR.getCreditScore(q), 600 - 120, "未完了だったペナルティだけが適用される");
}

// ---- 政策パラメータ: 強制が任意より軽くならない ----
{
  const rr = P.setPolicyParam("forced_credit_penalty", 0.1, { source: "test", force: true });
  if (rr.ok) fail("強制の減点を任意より小さくできてしまう");
  const r2 = P.setPolicyParam("liquidation_ratio", 0.55, { source: "test", force: true });
  if (r2.ok) fail("任意の買取率を強制より低くできてしまう");
}

// ---- 仮想施設・在庫・契約 ----
{
  const mkVillager = (id, wage) => ({
    id, identity: { name: "太郎", tag: "villager" }, address: { location: {}, nearestNetherGate: null }, affiliation: { type: "hrmhrm", id: null },
    records: [], skills: [], licenses: {}, category: null, grade: "C", level: 1, wage, status: "idle", dispatchEndDay: null, dispatchDays: null, dispatchedDaysTotal: 0
  });
  const boss = mkPlayer("rita", 3_000_000);
  const co2 = C.registerCore(boss, spec("company", "仮想商事"), cat).core;
  const fid = CF.companyFacilityId(co2.id, "mine");
  const f = FA.getFacility(fid);
  if (!f || f.operator.type !== "company" || f.operator.id !== co2.id || f.sink.type !== "stock") fail("会社の施設が引ける: " + JSON.stringify(f));
  eq(FA.listFacilities("mine", "company").some((x) => x.id === fid), true, "鉱山の一覧に会社の施設が並ぶ");
  eq(FA.listFacilities("mine", "hrmhrm").length, 1, "HRMHRMの施設は別に残る");
  eq(FA.getFacility("co:ZZZZZZ:farm"), null, "存在しない会社の施設は null");

  const worker = mkPlayer("sam");
  worker.setDynamicProperty("labor_employees", JSON.stringify([mkVillager("v1", 20), mkVillager("v2", 20), mkVillager("v3", 20)]));
  eq(f.output.some((e) => ["minecraft:raw_gold", "minecraft:diamond"].includes(e.itemId)), false, "会社の施設の産出表に金・ダイヤはない");
  eq(FA.getFacility("hrmhrm_mine").output.some((e) => e.itemId === "minecraft:diamond"), true, "HRMHRMの鉱山は金・ダイヤを産出する");
  Math.random = () => 0.999; // 事故なし・産出表の最後の品目(ラピスラズリ)
  let d = LB.dispatchEmployee(worker, "v1", 3, fid);
  if (!d.ok) fail("会社の施設へ派遣できる: " + JSON.stringify(d));
  const ct = C.loadCore(co2.id).contracts;
  eq(ct.length, 1, "契約が自社の記録に載る"); eq(ct[0].who, "sam", "契約の相手"); eq(ct[0].itemId, d.output.itemId, "産出予定が載る");
  W.day += 3;
  let cr = LB.collectDispatch(worker, "v1");
  if (!cr.ok || cr.accident || !cr.delivered) fail("回収で在庫に入る: " + JSON.stringify(cr));
  eq(d.output.itemId, "minecraft:lapis_lazuli", "産出の品目(会社の鉱山の最後)");
  eq(C.loadCore(co2.id).stock["minecraft:lapis_lazuli"], d.output.count, "産出が会社の在庫に入る");
  eq(C.loadCore(co2.id).contracts.length, 0, "進行中の契約から外れる");
  eq(C.loadCore(co2.id).contractLog[0].result, "delivered", "結果が記録される");

  // 事故のとき: 産出は届かず、結果に事故が残る
  LB.dispatchEmployee(worker, "v2", 3, fid); W.day += 3;
  Math.random = () => 0; // 事故あり
  cr = LB.collectDispatch(worker, "v2");
  eq(cr.accident, true, "事故になる"); eq(C.loadCore(co2.id).contractLog[0].result, "accident", "事故が契約の記録に残る");
  Math.random = () => 0.999;

  // 週の締め: 保持数を超えた分だけ換金して会社の口座へ
  const co2core = C.loadCore(co2.id);
  co2core.stock = { "minecraft:diamond": 700, "minecraft:coal": 100 }; C.saveCore(co2core);
  const sale = FA.settleStockFor(co2.id);
  const level = (await imp("economy/price-level.js")).getPriceLevel();
  const price = (await imp("economy/village-pricing.js")).getItemBasePriceExact("minecraft:diamond");
  eq(sale.cash, Math.floor(price * level * 60), "保持数(640)を超えた60個だけ換金する");
  eq(C.loadCore(co2.id).stock["minecraft:diamond"], 640, "在庫は保持数まで減る"); eq(C.loadCore(co2.id).stock["minecraft:coal"], 100, "保持数以下は動かない");
  eq(FA.settleStockFor("hrmhrm").cash, 0, "HRMHRM は別の経路(settlePool)");

  // 派遣中に会社が解散: 在庫は銀行(HRMHRMのプール)が買い取り、回収は「閉鎖」扱いで産出なし
  LB.dispatchEmployee(worker, "v3", 3, fid); W.day += 3;
  const poolBefore = FA.getPool()["minecraft:coal"] ?? 0;
  const est = C.estimateLiquidation(C.loadCore(co2.id), "voluntary");
  eq(est.stockValue > 0, true, "見積もりに在庫の時価が入る"); eq(est.bankBuy, Math.round((est.holdingsValue + est.stockValue) * 0.65), "買取に在庫も含む");
  const dr = C.dissolveCore(C.loadCore(co2.id), { mode: "voluntary", reason: "dissolved" });
  eq(dr.ok, true, "在庫つきの会社も解散できる");
  eq(FA.getPool()["minecraft:coal"], poolBefore + 100, "在庫は HRMHRM のプールへ");
  eq(FA.getFacility(fid), null, "解散すると施設は消える");
  cr = LB.collectDispatch(worker, "v3");
  eq(cr.ok && cr.facilityClosed && !cr.delivered, true, "閉鎖された施設の回収: 産出なし・閉鎖の印");
  eq(LB.dispatchEmployee(worker, "v1", 3, fid).reason, "unknownFacility", "解散した会社へは派遣できない");
}

// ---- 週の締め(runHrmhrmWeekly)で会社の在庫が換金される ----
{
  const t1 = mkPlayer("tom", 3_000_000);
  const c = C.registerCore(t1, spec("company", "週次商会"), cat).core;
  const core = C.loadCore(c.id); core.stock = { "minecraft:coal": 740 }; C.saveCore(core);
  const cashBefore = A.getEntityAccount(c.id).cash;
  W.day += 14;
  H.runHrmhrmWeekly();
  const after = A.getEntityAccount(c.id);
  const price = (await imp("economy/village-pricing.js")).getItemBasePriceExact("minecraft:coal");
  const level = (await imp("economy/price-level.js")).getPriceLevel();
  if (!(after.cash > cashBefore)) fail("週の締めで会社の口座に換金が入る: " + cashBefore + " -> " + after.cash);
  eq(C.loadCore(c.id).stock["minecraft:coal"], 640, "在庫は保持数まで");
  const rec = after.weekly.find((w) => w.actions.some((a) => a.type === "pool_sale"));
  eq(!!rec, true, "週次の記録に換金が残る");
  eq(rec.actions.find((a) => a.type === "pool_sale").cash, Math.floor(price * level * 100), "換金額 = 売値 × 超過分(100個)");
}


// ---- 村の入荷(village-demand.js): 人ごとの枠・受注・資金・納品・週次の加工 ----
{
  let _seed = 12345; Math.random = () => ((_seed = (_seed * 1103515245 + 12345) % 2147483648) / 2147483648); // 前の節で固定した乱数を、ID生成が回るものに戻す
  const VD = await imp("economy/village-demand.js");
  const QB = await imp("economy/quest-board.js");
  const pr = await imp("economy/village-pricing.js");
  const lv = (await imp("economy/price-level.js")).getPriceLevel();
  const mayor = mkPlayer("mayor");
  const v = C.registerCore(mayor, spec("village"), cat).core;
  const worker = mkPlayer("worker", 0);
  // 人口0なら枠なし。人が分からなければ枠なし(枠は人ごと)
  eq(VD.getVillageSlots(C.loadCore(v.id), undefined, "worker").length, 0, "人口0の村は枠なし");
  C.recordPopulation(C.loadCore(v.id), { adults: 10, babies: 0 });
  const core0 = C.loadCore(v.id);
  eq(VD.getVillageSlots(core0).length, 0, "人を指定しなければ枠なし");
  const slots = VD.getVillageSlots(core0, undefined, "worker");
  eq(slots.length, 3, "1日3品目");
  eq(new Set(slots.map((x) => x.itemId)).size, 3, "品目は重複しない");
  eq(JSON.stringify(VD.getVillageSlots(core0, undefined, "worker")), JSON.stringify(slots), "同じ日・同じ村・同じ人なら同じ枠");
  { const d1 = JSON.stringify(VD.getVillageSlots(core0, W.day + 1, "worker").map((x) => x.itemId));
    const d2 = JSON.stringify(VD.getVillageSlots(core0, W.day + 2, "worker").map((x) => x.itemId));
    if (d1 === JSON.stringify(slots.map((x) => x.itemId)) && d2 === d1) fail("日が変われば品目が変わる"); }
  { // 人が違えば、品目か量が違う(何人かで試して、全員同じにはならない)
    const sigs = new Set(["worker", "alice", "bob", "carol", "dave", "erin"].map((n) => JSON.stringify(VD.getVillageSlots(core0, undefined, n).map((x) => [x.itemId, x.need]))));
    if (sigs.size < 3) fail("人ごとに枠が違う: " + sigs.size); }
  for (const s of slots) if (!(s.need >= 1) || s.taken !== 0 || s.left !== s.need) fail("枠の初期値: " + JSON.stringify(s));
  // 資金がなければ受けられない(口座の現金 = 0)
  const acctV = () => A.getEntityAccount(v.id);
  { const a0 = acctV(); a0.cash = 0; A.saveEntityAccount(a0); }
  const s0 = slots[0];
  eq(QB.claimVillageQuest(worker, v.id, s0.itemId, 1).reason, "noFunds", "村の資金が0なら受注できない");
  // 資金を入れる: 受けられる数は 資金 ÷ 単価 まで
  const unit = s0.unit;
  { const a1 = acctV(); a1.cash = Math.floor(unit * 5) + 1; A.saveEntityAccount(a1); }
  eq(QB.claimVillageQuest(worker, v.id, s0.itemId, 6).reason, "badQty", "資金を超える数量は拒否");
  const cl = QB.claimVillageQuest(worker, v.id, s0.itemId, 5);
  if (!cl.ok) fail("受注: " + JSON.stringify(cl));
  else {
    eq(cl.claim.category, "village", "受注記録のカテゴリ"); eq(cl.claim.requirement.count, 5, "数量");
    eq(cl.claim.reward, Math.floor(unit * 5), "報酬は受注時の単価 × 数量");
    eq(VD.getVillageSlots(C.loadCore(v.id), undefined, "worker")[0].taken, 5, "受注済みが増える");
    eq(QB.claimVillageQuest(worker, v.id, s0.itemId, 1).reason, "alreadyClaimed", "同じ日・同じ品は二重に受けられない");
    // 他の人の枠は減らない。資金は予約分を引いた残りで判断する
    const other = mkPlayer("other", 0);
    const oSlots = VD.getVillageSlots(C.loadCore(v.id), undefined, "other");
    for (const s of oSlots) if (s.taken !== 0) fail("他の人の受注は自分の枠に影響しない");
    eq(QB.claimVillageQuest(other, v.id, oSlots[0].itemId, 1).reason, "noFunds", "予約分を引いた残りで判断する");
    // 放棄で枠と予約が戻る
    eq(QB.releaseQuest(worker, cl.claim.questId).ok, true, "放棄");
    eq(VD.getVillageSlots(C.loadCore(v.id), undefined, "worker")[0].taken, 0, "放棄で受注済みが戻る");
    const cl2 = QB.claimVillageQuest(worker, v.id, s0.itemId, 5);
    eq(cl2.ok, true, "放棄後にもう一度受けられる");
    // 納品の確定(品物の消費は UI/コンテナ側): 村の口座から払い、在庫に入る
    const cashBefore = acctV().cash;
    const done = VD.completeVillageOrder(v.id, cl2.claim.questId, worker.name);
    eq(done.ok, true, "納品の確定"); eq(done.paid, cl2.claim.reward, "代金は村の口座から");
    eq(acctV().cash, cashBefore - cl2.claim.reward, "村の口座が減る");
    eq(C.loadCore(v.id).stock[s0.itemId], 5, "村の在庫に入る");
    eq(VD.completeVillageOrder(v.id, cl2.claim.questId, worker.name).ok, false, "二重納品はできない");
  }
  // 自分の分(枠)を受けきると、その品は「きょうの分は受注済み」で止まる。他の人は同じ村で別の枠を受けられる
  { const a2 = acctV(); a2.cash = 1e9; A.saveEntityAccount(a2); }
  const w2 = mkPlayer("w2", 0);
  const w2s = VD.getVillageSlots(C.loadCore(v.id), undefined, "w2");
  const s1 = w2s[1];
  eq(VD.claimVillageOrder(w2, v.id, s1.itemId, s1.need + 1).reason, "badQty", "枠を超える数量は拒否");
  eq(VD.claimVillageOrder(w2, v.id, s1.itemId, s1.need).ok, true, "自分の枠いっぱいまで受けられる");
  eq(VD.claimVillageOrder(w2, v.id, s1.itemId, 1).reason, "full", "自分の分を受けきったら full");
  eq(VD.getVillageSlots(C.loadCore(v.id), undefined, "w3")[0].left > 0, true, "他の人の枠は残っている");
  // ゲーマータグの変更: 受けた注文は、名前が変わってもIDで辿り着ける。他人の注文には触れない
  { const rn = mkPlayer("renamer", 0);
    const rs = VD.getVillageSlots(C.loadCore(v.id), undefined, "renamer", rn.id)[0];
    const cl = VD.claimVillageOrder(rn, v.id, rs.itemId, 1);
    eq(cl.ok, true, "改名前に受注");
    rn.name = "renamed_after";
    eq(VD.canCompleteVillageOrder(v.id, cl.key, rn.name, rn.id).ok, true, "改名しても注文に辿り着ける(ID照合)");
    eq(VD.canCompleteVillageOrder(v.id, cl.key, rn.name).ok, false, "IDが無ければ名前で照合(改名後は一致しない)");
    eq(VD.canCompleteVillageOrder(v.id, cl.key, "renamer", "id-other").ok, false, "別のIDの人は納品できない");
    eq(VD.getVillageSlots(C.loadCore(v.id), undefined, rn.name, rn.id).find((x) => x.itemId === rs.itemId)?.taken >= 1 || VD.getVillageSlots(C.loadCore(v.id), undefined, rn.name, rn.id).every((x) => x.itemId !== rs.itemId), true, "改名後も受注済みの数が引き継がれる(別の品の枠に入れ替わる場合は除く)");
    eq(VD.completeVillageOrder(v.id, cl.key, rn.name, rn.id).ok, true, "改名後に納品できる");
    // 期限切れの注文は予約額に数えない(誰も来ない村で資金が固まらない)
    const c3 = C.loadCore(v.id); c3.orders.push({ key: "x", who: "gone", whoId: "gone", itemId: rs.itemId, qty: 1, reward: 12345, day: 1, expiresWeek: 1, done: false }); 
    const live = VD.reservedCash({ orders: c3.orders.filter((o) => o.key !== "x") });
    eq(VD.reservedCash(c3), live, "期限切れの注文は予約額に入らない");
  }
  // 週次: 変換表(入力がなければ出力ゼロ・損失・相場以下の売値)
  { const c2 = C.loadCore(v.id);
    c2.stock = { "minecraft:wheat": 10, "minecraft:rotten_flesh": 99, "minecraft:porkchop": 5 };
    C.saveCore(c2);
    const sale = VD.settleVillageStock(v.id);
    eq(sale.made["minecraft:bread"], 2, "小麦10 → パン3バッチ × 0.8 = 2(切り捨て)");
    eq(sale.made["minecraft:cooked_porkchop"], 4, "生豚5 × 0.8 = 4");
    eq(sale.made["minecraft:cooked_chicken"], undefined, "入力がなければ出力ゼロ");
    const expect = Math.floor((pr.getItemBasePriceExact("minecraft:bread") * 2 + pr.getItemBasePriceExact("minecraft:cooked_porkchop") * 4) * lv * 0.8);
    eq(sale.cash, expect, "売値 = 基準価格 × 掛率 × 0.8");
    eq(Object.keys(C.loadCore(v.id).stock).length, 0, "在庫は加工・消費でゼロになる(廃棄物は消える)");
    eq(VD.settleVillageStock(v.id).cash, 0, "空の在庫では何も起きない");
  }
}

// ---- 工場: 原料(在庫)がなければ産出ゼロ。あれば変換表で加工(損失つき)し、原料は契約の時点で確保される ----
{
  const fo = mkPlayer("factory-owner", 3_000_000);
  const c = C.registerCore(fo, spec("company", "加工商会"), cat).core;
  const fac = FA.getFacility(`co:${c.id}:factory`);
  eq(!!fac, true, "会社の工場がある");
  let out = FA.rollFacilityOutput(fac, 100, 7);
  eq(out.count, 0, "原料の在庫がなければ産出ゼロ");
  const co2 = C.loadCore(c.id); co2.stock = { "minecraft:raw_gold": 10 }; C.saveCore(co2);
  out = FA.rollFacilityOutput(fac, 100, 7);
  eq(out.itemId, "minecraft:gold_ingot", "金の原石 → 金インゴット(原石を納品した分だけ)");
  const used = out.used?.count ?? 0;
  eq(out.count, Math.floor(used * 0.8), "出来高 = 原料 × 変換比0.8(切り捨て)");
  eq(C.loadCore(c.id).stock["minecraft:raw_gold"], 10 - used, "原料は契約の時点で在庫から引かれる");
  // 会社の鉱山は金を産出しない(原石を出す表に無い)
  const mine = FA.getFacility(`co:${c.id}:mine`);
  if (mine.output.some((e) => e.itemId === "minecraft:raw_gold" || e.itemId === "minecraft:diamond")) fail("会社の鉱山は貴金属を出さない");
}


// ---- 会社の自動依頼(足りない原料 → 枠): 在庫が目標に達していれば依頼なし。納品で在庫が増える ----
{
  const VD = await imp("economy/village-demand.js");
  const QB = await imp("economy/quest-board.js");
  const boss = mkPlayer("boss", 3_000_000);
  const c = C.registerCore(boss, spec("company", "依頼商会"), cat).core;
  let slots = VD.getVillageSlots(C.loadCore(c.id));
  eq(slots.map((x) => x.itemId.replace("minecraft:", "")).join(","), "raw_gold,diamond,string", "在庫が空なら金の原石・ダイヤ・糸を依頼する");
  eq(slots[0].need, 32, "金の原石の目標32");
  { const k = C.loadCore(c.id); k.stock = { "minecraft:raw_gold": 40, "minecraft:diamond": 3 }; C.saveCore(k); }
  slots = VD.getVillageSlots(C.loadCore(c.id));
  eq(slots.some((x) => x.itemId === "minecraft:raw_gold"), false, "在庫が目標以上なら依頼しない");
  eq(slots.find((x) => x.itemId === "minecraft:diamond").need, 5, "不足分だけ依頼(8 - 3)");
  { const a = A.getEntityAccount(c.id); a.cash = 1e9; A.saveEntityAccount(a); }
  const sup = mkPlayer("supplier", 0);
  const cl = QB.claimVillageQuest(sup, c.id, "minecraft:diamond", 5);
  eq(cl.ok, true, "会社の依頼を受注");
  eq(cl.claim?.category, "company", "カテゴリは company"); eq(cl.claim?.issuer.type, "company", "発注元は company");
  const done = VD.completeVillageOrder(c.id, cl.claim.questId, sup.name);
  eq(done.ok, true, "納品の確定");
  eq(C.loadCore(c.id).stock["minecraft:diamond"], 8, "在庫が増える");
  slots = VD.getVillageSlots(C.loadCore(c.id));
  eq(slots.find((x) => x.itemId === "minecraft:diamond").need, 5, "納品後も、その日の枠は変わらない(二重に数えない)");
  eq(slots.find((x) => x.itemId === "minecraft:diamond").left, 0, "受注済みが必要数に達したら満杯");
}


// ---- 表示名: 村・会社の入荷/出荷に出てくる品は、すべて日本語名がある ----
{
  const VD = await imp("economy/village-demand.js");
  const CD = await imp("data/convert-data.js");
  const LD = await imp("data/labor-data.js");
  const ids = new Set([...VD.VILLAGE_BUY_TABLE.map((e) => e.itemId), ...VD.COMPANY_BUY_TABLE.map((e) => e.itemId),
    ...CD.FACTORY_CONVERT_TABLE.flatMap((e) => [e.in, e.out])]);
  for (const id of ids) { const e = LD.LABOR_ITEM_NAMES[id.replace("minecraft:", "")]; if (!e?.ja || !e?.en) fail("表示名がない: " + id); }
}


// ---- 納品の安全装置: 発注元が解散していたら、品物を消費する前に断る / 注文の上限 ----
{
  const VD = await imp("economy/village-demand.js");
  const QB = await imp("economy/quest-board.js");
  const boss = mkPlayer("gone-boss", 3_000_000);
  const c = C.registerCore(boss, spec("company", "消える商会"), cat).core;
  { const a = A.getEntityAccount(c.id); a.cash = 1e9; A.saveEntityAccount(a); }
  const sup = mkPlayer("gone-sup", 0);
  const cl = QB.claimVillageQuest(sup, c.id, "minecraft:string", 10);
  eq(cl.ok, true, "受注");
  eq(VD.canCompleteVillageOrder(c.id, cl.claim.questId, sup.name).ok, true, "生きている注文は納品できる");
  C.dissolveCore(C.loadCore(c.id), { mode: "voluntary", reason: "test" });
  eq(VD.canCompleteVillageOrder(c.id, cl.claim.questId, sup.name).reason, "villageGone", "解散後は villageGone");
  eq(QB.deliverQuest(sup, cl.claim.questId, { x: 0, y: 0, z: 0 }).reason, "villageGone", "品物を消費する前に断る");
}


// ---- 名前の日英対応 ----
{
  const N = await imp("i18n/names.js");
  const o = mkPlayer("namer", 3_000_000);
  const vil = C.registerCore(o, spec("village"), cat).core;
  if (!vil.nameEn || !vil.headNameEn) fail("村は日英の名前を同時に生成する");
  eq(N.coreName(vil, "ja"), vil.name, "日本語表示は name"); eq(N.coreName(vil, "en"), vil.nameEn, "英語表示は nameEn");
  eq(N.headName(vil, "en"), vil.headNameEn, "村長の英語名");
  if (/[^\x00-\x7f]/.test(vil.nameEn)) fail("村の英語名は英字: " + vil.nameEn);
  // 古い村(英語名なし)は、日本語名から引ける
  const old = { kind: "village", name: "ひだまりの森", headName: "ガルド" };
  eq(N.coreName(old, "en"), "Sunny Woods", "古い村の英語名を引く"); eq(N.headName(old, "en"), "Gard", "古い村長の英語名");
  // 会社: 英語名は任意。無ければ同じ名前を見せる。重複は日英どちらとも比べる
  const c1 = C.registerCore(o, { ...spec("company", "日英商会"), nameEn: "NichieiCo" }, cat);
  eq(c1.ok, true, "日英の名前つきで登記");
  eq(N.coreName(c1.core, "en"), "NichieiCo", "会社の英語表示"); eq(N.coreName(c1.core, "ja"), "日英商会", "会社の日本語表示");
  eq(C.validateCompanyName("nichieico").reason, "duplicate", "英語名とも重複を検査する");
  const c2 = C.registerCore(mkPlayer("single", 3_000_000), spec("company", "単言語社"), cat).core;
  eq(N.coreName(c2, "en"), "単言語社", "英語名がなければ同じ名前を見せる");
  // 村人
  eq(N.employeeName({ identity: { tag: "villager", name: "次郎", nameEn: "Jack" } }, "en"), "Jack", "村人の英語名");
  eq(N.employeeName({ identity: { tag: "villager", name: "次郎" } }, "en"), "Jack", "古い村人(英語名なし)は日本語名から引く");
  eq(N.employeeName({ identity: { tag: "villager", name: "次郎", nameEn: "Jack" } }, "ja"), "次郎", "日本語表示");
  eq(N.employeeName({ identity: { tag: "player", name: "Steve" } }, "en"), "Steve", "プレイヤー本人はそのまま");
}

if (errors) { console.log(`\n${errors} failure(s)`); process.exit(1); }
console.log("OK");
