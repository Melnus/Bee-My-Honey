// 労働市場(クエスト掲示・派遣・プール)の検算スクリプト(Node 20+)。
//   node dev/check_labor.mjs scripts      (パックのルートで実行)
// 1. 掲示: 日付が種で全員同じ4件 / 日が変われば変わる / ロック(資格)
// 2. 受注: 同時件数の上限(quest_max_active) / 重複受注の拒否 / 受注者の一覧 / 放棄 / 週をまたぐと期限切れ
// 3. 納品: 集荷箱から消費 → 口座へ振込(入出金履歴に振込元) / 二重納品の拒否 / 受注の記録が週後に残らない
// 4. 派遣: 施設を選んで契約 → 産出が確定 / 期日前は回収不可 / 回収でプールに入る / 通算日数 / 3年で除名
// 6. 初めてのアルバイト: 実績がない人だけに出る / 報告でシュルカー1個 / 1回だけ / ID不可なら無染色へフォールバック / 持ち物いっぱいなら足元に落とす
// 5. プール: 保持数を超えた分だけ換金(その時の売値) / 2回目は0 / HRMHRMの週の締めで収益に入る
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
globalThis.__stubWorld = {
  day: 7 * 5 + 2, getDay() { return this.day; }, getPlayers() { return []; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v))
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{ constructor(id,n){ if (globalThis.__badGiftIds?.includes(id)) throw 0; this.typeId=id; this.amount=n; } }; export const world = globalThis.__stubWorld; export const system = { run(f){ f(); }, runInterval(){}, afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const QB = await imp("economy/quest-board.js");
const LB = await imp("economy/labor.js");
const FA = await imp("economy/facility.js");
const H = await imp("economy/hrmhrm.js");
const L = await imp("economy/ledger.js");
const P = await imp("economy/price-level.js");
const PO = await imp("economy/policy.js");
const W = globalThis.__stubWorld;

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: ${a} vs ${b}`); };

// 集荷箱(書見台の近くのチェスト)
const inv = { size: 27, items: new Array(27).fill(undefined), getItem(i) { return this.items[i]; }, setItem(i, v) { this.items[i] = v; } };
const dim = { getBlock(loc) { return loc.x === 1 && loc.y === 0 && loc.z === 0 ? { typeId: "minecraft:chest", getComponent: () => ({ container: inv }) } : { typeId: "minecraft:air" }; } };
H.ensureHrmhrmAccount(); // 口座はこの日付で作る(あとで日付を進めて、週の締めに追いつかせる)
const mkPlayer = (name) => { const m = new Map(); return { name, dimension: dim, location: { x: 0, y: 0, z: 0 }, sendMessage() {}, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => m.set(k, v) }; };
const alice = mkPlayer("alice");
const bob = mkPlayer("bob");

// ---- 1. 掲示 ----
const b1 = QB.getBoard();
const b2 = QB.getBoard();
eq(b1.length, 4, "掲示は4件");
eq(JSON.stringify(b1), JSON.stringify(b2), "同じ日は同じ掲示(全員共通)");
if (JSON.stringify(QB.getBoard(W.day + 1).map((l) => l.requirement)) === JSON.stringify(b1.map((l) => l.requirement)) &&
    JSON.stringify(QB.getBoard(W.day + 2).map((l) => l.requirement)) === JSON.stringify(b1.map((l) => l.requirement))) fail("日が変わっても掲示が変わらない");
const unq = b1.find((l) => l.category === "unqualified");
const nether = b1.find((l) => l.category === "nether");
eq(QB.claimQuest(alice, nether.id).reason, "noLicense", "ライセンスが無いと受注できない");

// ---- 2. 受注 ----
eq(PO.getPolicyParam("quest_max_active"), 2, "同時受注の上限の既定は2");
let r = QB.claimQuest(alice, unq.id);
if (!r.ok) fail("受注できる: " + r.reason);
eq(QB.claimQuest(alice, unq.id).reason, "alreadyClaimed", "同じクエストの二重受注は拒否");
QB.claimQuest(bob, unq.id);
eq(QB.getClaimedBy(unq.id).map((e) => e.name).sort().join(), "alice,bob", "受注者の一覧(HRMHRM発は全員が受けられる)");
r = QB.releaseQuest(bob, unq.id);
if (!r.ok) fail("放棄できる");
eq(QB.getClaimedBy(unq.id).map((e) => e.name).join(), "alice", "放棄すると受注者から外れる");
eq(QB.releaseQuest(bob, unq.id).reason, "notClaimed", "受けていないものは放棄できない");

// 上限: 日をまたいで(同じ週内で)追加 → 2件目は通り、3件目は拒否
W.day += 1; const d2 = QB.getBoard().find((l) => l.category === "unqualified");
if (!QB.claimQuest(alice, d2.id).ok) fail("2件目は受けられる");
W.day += 1; const d3 = QB.getBoard().find((l) => l.category === "unqualified");
r = QB.claimQuest(alice, d3.id);
if (r.ok || r.reason !== "limit" || r.max !== 2) fail("3件目は上限で拒否: " + JSON.stringify(r));
eq(QB.getActiveClaims(alice).length, 2, "受注中は2件(掲示が入れ替わっても残る)");
if (!PO.setPolicyParam("quest_max_active", 3, { source: "test" }).ok) fail("上限は設定で変えられる");
if (!QB.claimQuest(alice, d3.id).ok) fail("上限を上げたら3件目が通る");

// ---- 3. 納品 ----
const claim = QB.getClaim(alice, d3.id);
const itemId = claim.requirement.itemId;
eq(QB.deliverQuest(alice, d3.id, { x: 0, y: 0, z: 0 }).reason, "insufficientItems", "納品物が無ければ拒否");
inv.items[0] = { typeId: itemId, amount: claim.requirement.count + 5 };
const before = L.getBalance ? L.getBalance(alice) : (alice.getDynamicProperty("acc_emeralds") ?? 0);
r = QB.deliverQuest(alice, d3.id, { x: 0, y: 0, z: 0 });
if (!r.ok) fail("納品できる: " + r.reason);
eq(inv.items[0].amount, 5, "集荷箱から必要数だけ消費");
const after = alice.getDynamicProperty("acc_emeralds") ?? 0;
if (!(after - before === r.wage && r.wage >= 0)) fail(`口座への振込額: ${after - before} vs ${r.wage}`);
const hist = L.getAccountHistory(alice)[0];
if (!hist || hist.c !== "quest_wage" || hist.p !== "HRMHRM Partners HLD") fail("入出金履歴に振込元が残る: " + JSON.stringify(hist));
eq(QB.deliverQuest(alice, d3.id, { x: 0, y: 0, z: 0 }).reason, "notClaimed", "二重納品は拒否");
eq(QB.getClaimedBy(d3.id).filter((e) => e.state === "completed").length, 1, "完了者が記録される");

// 週をまたぐと受注は期限切れ(遅延判定)
W.day = 7 * 7;
eq(QB.getActiveClaims(alice).length, 0, "週をまたぐと未達成の受注は期限切れ");
eq(QB.getClaimedBy(unq.id).length, 0, "受注者の一覧からも外れる");

// ---- 4. 派遣 ----
const mkVillager = (id, wage, total = 0) => ({
  id, identity: { name: "太郎", tag: "villager" }, address: { location: {}, nearestNetherGate: null }, affiliation: { type: "hrmhrm", id: null },
  records: [], skills: [], licenses: {}, category: null, grade: "C", level: 1, wage, status: "idle", dispatchEndDay: null, dispatchDays: null, dispatchedDaysTotal: total
});
alice.setDynamicProperty("labor_employees", JSON.stringify([mkVillager("e1", 20), mkVillager("e2", 20, 1093)]));
Math.random = () => 0.999; // 事故なし・重みの最後の品目
eq(LB.dispatchEmployee(alice, "e1", 3, "nowhere").reason, "unknownFacility", "未知の施設は拒否");
r = LB.dispatchEmployee(alice, "e1", 3, "hrmhrm_mine");
if (!r.ok || !(r.output.count >= 1)) fail("派遣できる: " + JSON.stringify(r));
const expected = Math.max(1, Math.floor((20 * 3 * PO.getPolicyParam("dispatch_output_ratio")) / 1.5)); // 最後の品目=ダイヤ(基準1.5E)
eq(r.output.itemId, "minecraft:diamond", "産出の品目(抽選)");
eq(r.output.count, expected, "産出量 = 賃金×日数×係数 ÷ 基準価格(ダイヤ1.5E: 20×3÷1.5=40)");
eq(LB.collectDispatch(alice, "e1").reason, "stillWorking", "期日前は回収できない");
W.day += 3;
r = LB.collectDispatch(alice, "e1");
if (!r.ok || r.accident) fail("回収できる: " + JSON.stringify(r));
eq(FA.getPool()["minecraft:diamond"], expected, "回収で産出がプールに入る");
eq(r.retired, false, "通算3日では除名にならない");
eq(LB.getEmployees(alice).find((e) => e.id === "e1").dispatchedDaysTotal, 3, "通算派遣日数が加算される");

// 3年(1095日)で除名: 1093 + 3 = 1096 >= 1095
LB.dispatchEmployee(alice, "e2", 3, "hrmhrm_farm");
W.day += 3;
r = LB.collectDispatch(alice, "e2");
if (!r.ok || !r.retired) fail("通算1095日で除名: " + JSON.stringify(r));
if (LB.getEmployees(alice).some((e) => e.id === "e2")) fail("除名された履歴書が残っている");


// ---- 6. 初めてのアルバイト ----
const mkNewbie = (name, { full = false } = {}) => {
  const p = mkPlayer(name);
  p.given = []; p.dropped = [];
  p.getComponent = (n) => (n === "inventory" ? { container: { addItem: (st) => { if (full) return st; p.given.push(st); return undefined; } } } : undefined);
  p.dimension = { ...dim, spawnItem: (st) => p.dropped.push(st) };
  return p;
};
eq(QB.isFirstJobAvailable(alice), false, "実績がある人には初回の仕事は出ない");
const carol = mkNewbie("carol");
eq(QB.isFirstJobAvailable(carol), true, "実績がない新しい人には出る");
QB.getBoard(); // 掲示を見ただけでは消えない
LB.getOrCreatePlayerResume(carol, "unqualified"); // 履歴書を開いただけ(実績ゼロ)でも消えない
eq(QB.isFirstJobAvailable(carol), true, "履歴書を作っただけ(記録なし)では消えない");
r = QB.completeFirstJob(carol);
if (!r.ok || carol.given.length !== 1 || carol.given[0].typeId !== "minecraft:shulker_box") fail("報告でシュルカー1個: " + JSON.stringify(r));
eq(QB.isFirstJobAvailable(carol), false, "報告後は出ない");
eq(QB.completeFirstJob(carol).reason, "notAvailable", "二重にはもらえない");
eq(carol.given.length, 1, "二重に渡されていない");
// 通販のIDが使えない環境: 無染色のIDで渡す
globalThis.__badGiftIds = ["minecraft:shulker_box"];
const dave = mkNewbie("dave");
r = QB.completeFirstJob(dave);
if (!r.ok || dave.given[0]?.typeId !== "minecraft:undyed_shulker_box") fail("IDが通らなければ無染色にフォールバック: " + JSON.stringify(r));
// どちらも通らない: 渡さず、印も付けない(もう一度できる)
globalThis.__badGiftIds = ["minecraft:shulker_box", "minecraft:undyed_shulker_box"];
const erin = mkNewbie("erin");
eq(QB.completeFirstJob(erin).reason, "giveFailed", "渡せなければ失敗");
eq(QB.isFirstJobAvailable(erin), true, "失敗なら印が付かず、もう一度できる");
globalThis.__badGiftIds = [];
// 持ち物がいっぱい: 足元に落とす
const fay = mkNewbie("fay", { full: true });
r = QB.completeFirstJob(fay);
if (!r.ok || fay.dropped.length !== 1) fail("持ち物いっぱいなら足元に落とす");
// 受注の件数には数えない
eq(QB.getActiveClaims(carol).length, 0, "初回の仕事は受注の件数に数えない");

// ---- 5. プール ----
store.delete("hrmhrm_pool");
FA.depositToFacility(FA.getFacility("hrmhrm_farm"), "minecraft:wheat", 1000);
FA.depositToFacility(FA.getFacility("hrmhrm_farm"), "minecraft:carrot", 100);
const keep = PO.getPolicyParam("pool_keep_per_item");
const level = P.getPriceLevel();
let s = FA.settlePool();
const expectCash = Math.floor(0.1875 * level * (1000 - keep));
eq(s.cash, expectCash, "換金額 = 保持数を超えた分 × その時の売値(基準価格0.1875E×掛率)");
eq(FA.getPool()["minecraft:wheat"], keep, "換金後は保持数まで減る");
eq(FA.getPool()["minecraft:carrot"], 100, "保持数以下は換金しない");
eq(FA.settlePool().cash, 0, "2回目は換金なし(二重に換金しない)");

// HRMHRMの週の締めで収益に入る
FA.depositToFacility(FA.getFacility("hrmhrm_farm"), "minecraft:wheat", 1000);
W.day = 7 * 20;
const a0 = H.ensureHrmhrmAccount().cash;
const n = H.runHrmhrmWeekly();
const acct = H.ensureHrmhrmAccount();
if (n < 1) fail("週の締めが進む");
const sale = acct.weekly.flatMap((w) => w.actions).find((x) => x.type === "pool_sale");
if (!sale) fail("週の締めでプールの換金が記録される");
else if (sale.cash !== Math.floor(0.1875 * level * 1000)) fail("換金額が週の締めの収益に入る: " + sale.cash);
eq(FA.getPool()["minecraft:wheat"], keep, "週の締めの後、プールは保持数まで減る");

console.log(errors === 0 ? "OK" : `${errors} errors`);
process.exit(errors === 0 ? 0 : 1);
