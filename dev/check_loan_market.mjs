// 借入依頼の掲示板・送金・村解散の返金の検算スクリプト(Node 20+)。
//   node dev/check_loan_market.mjs scripts      (パックのルートで実行)
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
const store = new Map();
const players = [];
globalThis.__stubWorld = {
  day: 7 * 10 + 2, getDay() { return this.day; }, getPlayers() { return players; }, getAllPlayers() { return players; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v)),
  getDynamicPropertyIds: () => [...store.keys()],
  afterEvents: { playerSpawn: { subscribe() {} } }
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { run(f){ f(); }, runInterval(){}, afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const LO = await imp("economy/loan.js");
const M = await imp("economy/loan-market.js");
const T = await imp("economy/transfer.js");
const ES = await imp("economy/entity-stock.js");
const CR = await imp("economy/credit.js");
const L = await imp("economy/ledger.js");
const A = await imp("economy/account.js");
const C = await imp("economy/core-registry.js");
const H = await imp("economy/hrmhrm.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };
let seq = 0;
const mkPlayer = (name, bal = 0, online = true) => {
  const m = new Map([["acc_emeralds", bal]]);
  const p = { id: "id" + ++seq, name, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => (v === undefined ? m.delete(k) : m.set(k, v)) };
  if (online) players.push(p);
  return p;
};
const goOffline = (p) => { players.splice(players.indexOf(p), 1); };
const bal = (p) => p.getDynamicProperty("acc_emeralds");
H.ensureHrmhrmAccount();

// ---- 個人の借入依頼 → 貸し手が引き受ける → 週次の返済が貸し手へ ----
{
  const borrower = mkPlayer("ben", 0), lender = mkPlayer("lia", 5_000_000);
  // 資産に応じた上限: 資産がほぼ無いと依頼できない
  const poor = mkPlayer("poor", 100);
  eq(M.postPlayerRequest(poor, 0).reason, "over_limit", "資産が少ないと依頼できない");
  eq(M.availableTiers(poor).length, 0, "出せる段がない");
  borrower.setDynamicProperty("acc_emeralds", 100_000); // 上限 = 資産の半分 = 5万E(100E段=6400E、250E段=16000E、500E段=32000E は可、1000E段=64000E は不可)
  eq(M.availableTiers(borrower).length, 4, "資産の半分までの段だけ出せる");
  eq(M.postPlayerRequest(borrower, 4).reason, "over_limit", "上限を超える段は拒否");
  borrower.setDynamicProperty("acc_emeralds", 0);
  const post = (borrower.setDynamicProperty("acc_emeralds", 100_000), M.postPlayerRequest(borrower, 1));
  borrower.setDynamicProperty("acc_emeralds", 0);
  if (!post.ok) fail("依頼を出せる: " + JSON.stringify(post));
  eq(M.postPlayerRequest(borrower, 1).reason, "already_posted", "依頼は同時に1件");
  eq(M.listOpenRequests(borrower).length, 0, "自分の依頼は自分の候補に出ない");
  const open = M.listOpenRequests(lender);
  eq(open.length, 1, "貸し手の候補に出る");
  const amount = open[0].amount;
  const rich = mkPlayer("rich", 9_000_000), tiny = mkPlayer("tiny", 5000);
  eq(M.fillRequest(tiny, open[0].id).reason, "insufficient_funds", "残高が足りない貸し手は拒否");
  tiny.setDynamicProperty("acc_emeralds", 10_000); // 残高は足りるが、資産の半分(5000)を超える
  eq(M.fillRequest(tiny, open[0].id).reason, "over_lend_limit", "貸せる額は資産の半分まで");
  const f = M.fillRequest(lender, open[0].id);
  if (!f.ok) fail("引き受け: " + JSON.stringify(f));
  eq(bal(lender), 5_000_000 - amount, "貸し手から引かれる"); eq(bal(borrower), amount, "借り手に入る");
  eq(LO.hasActiveLoan(borrower), true, "借り手はローン中"); eq(LO.hasActiveLending(lender), true, "貸し手は貸付中");
  eq(M.getRequests().length, 0, "引き受けた依頼は消える");
  eq(M.postPlayerRequest(borrower, 0).reason, "already_active", "ローン中は依頼を出せない");
  // 週次: 借り手の返済が貸し手に届く(銀行のカテゴリではなくp2p)
  const weekly = borrower.getDynamicProperty("cr_loan_weekly_payment");
  borrower.setDynamicProperty("acc_emeralds", weekly * 20);
  const hrRecBefore = A.getEntityAccount("hrmhrm").receivables;
  LO.applyLoanBilling();
  eq(bal(borrower), weekly * 19, "借り手から1週ぶん引かれる");
  eq(bal(lender), 5_000_000 - amount + weekly, "貸し手に届く");
  const week = Math.floor(W.getDay() / 7);
  const fl = L.getWeekFlows(week);
  eq(fl.out.p2p_repay, weekly, "返済はp2p_repayに記録"); eq(fl.in.p2p_return, weekly, "受取はp2p_returnに記録");
  eq(fl.out.loan_repaid ?? 0, 0, "銀行の返済には混ざらない");
  // 貸し手がオフラインの間の返済は、郵便受けに入って次のログインで届く
  goOffline(lender);
  const lb = bal(lender);
  LO.applyLoanBilling();
  eq(bal(lender), lb, "オフラインの貸し手の口座は動かない");
  players.push(lender); M.deliverMail(lender);
  eq(bal(lender), lb + weekly, "ログインで届く");
  // 繰上返済で完済 → 貸し手のスロットが空く
  borrower.setDynamicProperty("acc_emeralds", 99_999_999);
  const rr = LO.repayLoanEarly(borrower, true);
  const score0 = CR.getCreditScore(borrower);
  eq(rr.closed, true, "完済");
  eq(CR.getCreditScore(borrower), score0, "個人間ローンの完済では信用スコアは上がらない");
  eq(LO.hasActiveLending(lender), false, "完済で貸し手のスロットが空く");
  eq(borrower.getDynamicProperty("cr_loan_lender"), undefined, "貸し手の記録が消える");
}

// ---- 依頼の取り下げ・期限切れ(7日以上で、週の締めに消える) ----
{
  const b = mkPlayer("cat", 100_000);
  M.postPlayerRequest(b, 0);
  eq(M.cancelRequest(b), true, "取り下げ"); eq(M.getRequests().length, 0, "取り下げで消える");
  M.postPlayerRequest(b, 0);
  const w = Math.floor(W.getDay() / 7);
  eq(M.expireRequests(w), 0, "掲示から7日たつ前の週の締めでは消えない(day 72, 週末 77)");
  eq(M.expireRequests(w + 1), 1, "7日以上たった最初の週の締めで消える");
  eq(M.getRequests().length, 0, "消えた");
}

// ---- 村・会社の依頼 ----
const FEE = 1_000_000;
const cat = { hasCatalyst: () => true, consumeCatalyst: () => true };
let X = 5000;
const spec = (kind, name) => ({ kind, dimId: "overworld", x: (X += 200), y: 64, z: 0, typeId: kind === "village" ? "minecraft:bell" : "minecraft:lodestone", states: {}, name });
{
  const owner = mkPlayer("olga", 3_000_000), lender = mkPlayer("leo", 9_000_000);
  const co = C.registerCore(owner, spec("company", "資金不足商会"), cat).core;
  const acct = A.getEntityAccount(co.id);
  acct.cash = 0; A.saveEntityAccount(acct);
  const names = { ja: co.name, en: co.name };
  const req = M.postEntityRequestIfShort({ id: co.id, kind: "company", names }, A.getEntityAccount(co.id), 0, 1e9);
  if (!req) fail("資金不足の会社は依頼を出す");
  eq(M.postEntityRequestIfShort({ id: co.id, kind: "company", names }, A.getEntityAccount(co.id), 0, 1e9), null, "依頼は重ねない");
  const rich = A.getEntityAccount(co.id); rich.cash = 1e12; A.saveEntityAccount(rich);
  eq(M.postEntityRequestIfShort({ id: "x", kind: "company", names }, A.getEntityAccount(co.id), 0, 1e9), null, "資金に余裕があれば出さない");
  const f = M.fillRequest(lender, req.id);
  if (!f.ok) fail("会社の依頼を引き受け: " + JSON.stringify(f));
  const after = A.getEntityAccount(co.id);
  eq(after.loans.length, 1, "会社に借入が記録される");
  eq(after.liabilities, after.loans[0].balance, "負債に返済総額が入る");
  // 週次の返済: 貸し手へ届き、負債が減る
  const rec = { week: 1, revenue: 0, expense: 0, net: 0, cashDelta: 0, actions: [] };
  const lb = bal(lender), weekly = after.loans[0].weekly;
  M.settleEntityLoans(after, rec);
  A.saveEntityAccount(after);
  eq(bal(lender), lb + weekly, "会社の返済が貸し手に届く");
  if (!(rec.expense > 0)) fail("利息ぶんが費用に入る");
  // 現金が足りない週は延滞。4週続くと貸倒れ(貸し手のスロットが空く)
  const poor = A.getEntityAccount(co.id); poor.cash = 0; A.saveEntityAccount(poor);
  for (let i = 0; i < 4; i++) { const ac = A.getEntityAccount(co.id); M.settleEntityLoans(ac, { week: 2 + i, revenue: 0, expense: 0, net: 0, cashDelta: 0, actions: [] }); A.saveEntityAccount(ac); }
  eq(A.getEntityAccount(co.id).loans.length, 0, "4週の延滞で貸倒れになる");
  eq(A.getEntityAccount(co.id).unsettledSince !== null, true, "精算不能が記録される");
  eq(LO.hasActiveLending(lender), false, "貸倒れで貸し手のスロットが空く");

  // 依頼が消えた時、現金が下限割れなら介入案件(清算手続き)へ
  const co2 = C.registerCore(mkPlayer("pete", 3_000_000), spec("company", "清算行き"), cat).core;
  const a2 = A.getEntityAccount(co2.id); a2.cash = 0; A.saveEntityAccount(a2);
  M.postEntityRequestIfShort({ id: co2.id, kind: "company", names: { ja: co2.name, en: co2.name } }, A.getEntityAccount(co2.id), 0, 1e9);
  const w = Math.floor(W.getDay() / 7) + 1;
  M.expireRequests(w);
  eq(A.getInterventions().some((r) => r.entityId === co2.id && r.reason === "loan_unfilled"), true, "貸し手が現れず下限割れなら介入案件");
  const fr = C.runUpkeep(C.loadCore(co2.id), { ownerOnline: true });
  eq(fr?.action, "forced", "会社は強制解散(清算)へ");
}

// ---- 村の解散: 残りの現金はHRMHRMへ戻る。代表者へは払わない。貸し手へは先に返す ----
{
  const owner = mkPlayer("vera", 3_000_000), lender = mkPlayer("lou", 9_000_000);
  const v = C.registerCore(owner, spec("village"), cat).core;
  const ac = A.getEntityAccount(v.id); ac.cash = 100_000; A.saveEntityAccount(ac);
  const req = M.postEntityRequestIfShort({ id: v.id, kind: "village", names: { ja: v.name, en: v.nameEn } }, (() => { const a = A.getEntityAccount(v.id); a.cash = 0; return a; })(), 0, 1e9);
  if (!req) fail("資金不足の村は依頼を出す");
  const a1 = A.getEntityAccount(v.id); a1.cash = 100_000; A.saveEntityAccount(a1);
  const f = M.fillRequest(lender, req.id);
  if (!f.ok) fail("村の依頼を引き受け: " + JSON.stringify(f));
  const loan = A.getEntityAccount(v.id).loans[0];
  const cashBefore = A.getEntityAccount(v.id).cash;
  const hrBefore = A.getEntityAccount("hrmhrm").cash, ob = bal(owner), lb = bal(lender);
  const res = C.dissolveCore(C.loadCore(v.id), { mode: "voluntary", reason: "dissolved" });
  if (!res.ok) fail("村の解散: " + JSON.stringify(res));
  eq(bal(owner), ob, "村の清算は代表者へ払われない");
  const repaid = Math.min(loan.balance, cashBefore);
  eq(bal(lender), lb + repaid, "貸し手へ先に返される");
  eq(Math.round(A.getEntityAccount("hrmhrm").cash - hrBefore), Math.round(cashBefore - repaid), "残りの現金はHRMHRMへ戻る");
  eq(A.getEntityAccount(v.id), null, "口座は閉じる");
}

// ---- 村・会社: 資産に対して借りられる額が無ければ依頼を出さない / 物資を先に売る ----
{
  const owner = mkPlayer("quinn", 3_000_000);
  const co = C.registerCore(owner, spec("company", "物資商会"), cat).core;
  const names = { ja: co.name, en: co.name };
  const a = A.getEntityAccount(co.id); a.cash = 0; A.saveEntityAccount(a);
  eq(M.postEntityRequestIfShort({ id: co.id, kind: "company", names }, A.getEntityAccount(co.id), 0, 100), null, "資産が小さすぎる主体は依頼を出せない");
  // 在庫を売って不足を埋める(高い物から)。足りなければ全部売る
  const c = C.loadCore(co.id); c.stock = { "minecraft:diamond": 3, "minecraft:coal": 10 }; C.saveCore(c);
  const sh = M.entityShortage(A.getEntityAccount(co.id), 0);
  const got = ES.sellStockFor(C.loadCore(co.id), A.getEntityAccount(co.id), 1);
  if (!(got > 0)) fail("在庫を売って現金になる");
  eq(Math.round(A.getEntityAccount(co.id).cash), Math.round(got), "売った代金が口座に入る");
  const after = C.loadCore(co.id).stock;
  eq(after["minecraft:diamond"], 2, "不足額が小さければ、高い物から必要な分だけ売る"); eq(after["minecraft:coal"], 10, "安い物は残る");
  const all = ES.sellStockFor(C.loadCore(co.id), A.getEntityAccount(co.id), 1e15);
  eq(Object.keys(C.loadCore(co.id).stock).length, 0, "足りなければ在庫を全部売る");
  if (!(all > got)) fail("全部売るとさらに増える");
  if (!(sh.shortage > 0)) fail("不足額が計算される");
}

// ---- 貸付の期限切れ(借り手が来なくなっても貸し手のスロットが固まらない) ----
{
  const b = mkPlayer("zed", 200_000), l = mkPlayer("lena", 5_000_000);
  M.postPlayerRequest(b, 0);
  const rq = M.listOpenRequests(l)[0];
  M.fillRequest(l, rq.id);
  eq(LO.hasActiveLending(l), true, "貸付中");
  M.deliverMail(l);
  eq(LO.hasActiveLending(l), true, "期限前は閉じない");
  W.day += 7 * (rq.weeks + 4 + 1);
  M.deliverMail(l);
  eq(LO.hasActiveLending(l), false, "期間+猶予を過ぎたら貸し倒れで閉じる");
  eq(l.getDynamicProperty("loan_lent_lid"), undefined, "貸付の識別も消える");
  // 閉じたあとに別の貸付をした場合、古い貸付の完了通知で新しいスロットを消さない
  b.setDynamicProperty("cr_loan_balance", 0); b.setDynamicProperty("cr_loan_lender", undefined); b.setDynamicProperty("cr_loan_lid", undefined);
  const b2 = mkPlayer("yan", 200_000); M.postPlayerRequest(b2, 0);
  const rq2 = M.listOpenRequests(l).find((x) => x.bid === b2.id);
  M.fillRequest(l, rq2.id);
  M.mailTo(l.id, { k: "close", ok: true, name: "zed", lid: rq.id });
  eq(LO.hasActiveLending(l), true, "別の貸付の完了通知では閉じない");
}

// ---- 長期不在の貸し手: 郵便受けが溢れても、受け取るお金は失われない ----
{
  const away = mkPlayer("away", 0, false);
  let total = 0;
  for (let i = 0; i < 30; i++) { M.mailTo(away.id, { k: "pay", a: 100 + i, name: "n" + i, weeksLeft: 1, lid: 9000 + i }); total += 100 + i; }
  players.push(away);
  M.deliverMail(away);
  eq(bal(away), total, "溢れた通知のお金も合算されて、ログインで全額届く");
}

// ---- 送金 ----
{
  const s = mkPlayer("sue", 1000), r = mkPlayer("rob", 0), off = mkPlayer("off", 0, false);
  const hrRev = (L.getWeekFlows(Math.floor(W.getDay() / 7)).out.transfer_fee ?? 0);
  const t1 = T.transferEmeralds(s, r, 300);
  eq(t1.ok, true, "送金できる"); eq(t1.fee, 6, "手数料は送金額の2%(切り上げ)");
  eq(bal(s), 694, "送り主は送金額+手数料を払う"); eq(bal(r), 300, "受取人には送金額がそのまま入る");
  eq((L.getWeekFlows(Math.floor(W.getDay() / 7)).out.transfer_fee ?? 0) - hrRev, 6, "手数料は台帳のtransfer_feeに記録");
  eq(T.transferEmeralds(s, r, 5000).reason, "insufficient_funds", "残高不足は拒否"); eq(bal(s), 694, "拒否したら動かない");
  eq(T.maxTransfer(s), 680, "最大額 = 手数料を引いた残高(694 / 1.02)");
  // 1日の上限
  const big = mkPlayer("big", 1e9);
  const cap = T.dailyCap();
  eq(T.transferEmeralds(big, r, cap).ok, true, "上限ちょうどまでは送れる");
  eq(T.transferEmeralds(big, r, 1).reason, "over_daily_cap", "上限を超えると拒否");
  eq(T.remainingToday(big), 0, "今日の残りは0");
  W.day += 1;
  eq(T.remainingToday(big), cap, "日が変わると上限が戻る");
  eq(T.transferEmeralds(s, s, 10).reason, "self", "自分には送れない");
  eq(T.transferEmeralds(s, off, 10).reason, "offline", "オフラインの相手には送れない");
  eq(T.transferEmeralds(s, r, 0).reason, "bad_amount", "0以下は拒否");
  eq(T.listTransferTargets(s).some((p) => p.id === s.id), false, "候補に自分は出ない");
  const fl = L.getWeekFlows(Math.floor(W.getDay() / 7));
  if (!(fl.out.transfer_out >= 300) || fl.out.transfer_out !== fl.in.transfer_in) fail("台帳: transfer_out と transfer_in は同額で釣り合う " + fl.out.transfer_out + " / " + fl.in.transfer_in);
}

console.log(errors ? errors + " failure(s)" : "OK");
process.exit(errors ? 1 : 0);
