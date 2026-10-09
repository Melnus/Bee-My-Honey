// 価格の検算スクリプト(Node 20+)。ゲーム外で価格データだけを読み込んで整合を確認する。
//   node dev/check_pricing.mjs scripts          (パックのルートで実行。引数は scripts フォルダ)
// @minecraft/server は実機専用なので、モジュールフックで空のスタブに差し替える。
// 検査項目:
//   1. COMMODITIES.baseRate が、エンジンの導出値(deriveCommodityBaseRate)と一致しているか(焼き込み忘れ検出)
//   2. 郵便販売・レア枠・エンチャント本の価格が1E以上の整数か / 在庫設定があるか
//   3. 動物交易・PBの価格・ロットが妥当か(ロット1以上、価格1以上)
//   4. クエストの賃金が「労働相当額(手間賃10E × 納品数 ÷ 1日の採集数)」を下回っていないか
//   5. レシピ未登録の品目(汎用採集デフォルトで暫定計算された品)が無いか
//   6. 基準価格が「村人の床値」(village-baseline.md / VILLAGE_FLOOR_RATES)を下回っていないか
//      (村人に直接売る方が得になる価格は、誰も使わない。pricing-guide.md の検算用途)
//   7. (情報のみ)買取側(動物交易・PB)の最悪日の買取単価が村人の床値を下回る品の一覧
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? "scripts");

register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (spec === "@minecraft/server" || spec === "@minecraft/server-ui") return { url: "data:text/javascript,stub:" + spec, shortCircuit: true };
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url.startsWith("data:text/javascript,stub:")) {
      return { format: "module", shortCircuit: true, source:
        "export class ItemStack { constructor(id,n){this.typeId=id;this.amount=n;} }" +
        "export const world={getDay(){return 1},getDynamicProperty(){},setDynamicProperty(){},getPlayers(){return[]}};" +
        "export const system={run(){},runJob(){},runTimeout(){}};" +
        "export class ActionFormData{}; export class ModalFormData{}; export class MessageFormData{};" };
    }
    return next(url, ctx);
  }
`));

const warns = [];
const origWarn = console.warn;
console.warn = (...a) => warns.push(a.join(" "));

const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const [engine, market, mail, mob, pb, labor, pdata] = await Promise.all([
  imp("economy/village-pricing.js"), imp("data/market-data.js"), imp("data/mail-order-data.js"),
  imp("data/mob-trade-data.js"), imp("data/pb-data.js"), imp("data/labor-data.js"), imp("data/village-pricing-data.js")
]);

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };

// 1. バルク baseRate
for (const [key, def] of Object.entries(market.COMMODITIES)) {
  const derived = engine.deriveCommodityBaseRate(key);
  if (Math.abs(derived - def.baseRate) > 0.0005) fail(`COMMODITIES.${key}.baseRate=${def.baseRate} だが導出値は ${derived}(market-data.js へ焼き込み直す)`);
}

// 2. 郵便販売
const lists = [...Object.entries(mail.MAIL_ORDER_CATALOG), ["rare", mail.MAIL_ORDER_RARE_POOL]];
let mailCount = 0;
for (const [cat, list] of lists) for (const e of list) {
  mailCount++;
  if (!Number.isInteger(e.price) || e.price < 1) fail(`mail ${cat}/${e.key}: price=${e.price}`);
  if (!e.standingStock) fail(`mail ${cat}/${e.key}: standingStock 未設定`);
}

// 3. 動物交易・PB
let mobCount = 0;
for (const [curr, list] of Object.entries(mob.MOB_TRADE_ITEMS)) for (const e of list) {
  mobCount++;
  if (!(e.value >= 1) || !(e.lot >= 1)) fail(`mob ${curr}/${e.id}: value=${e.value} lot=${e.lot}`);
}
for (const p of pb.PB_ITEMS) {
  if (!(p.basePrice >= 1) || !(p.lot >= 1)) fail(`pb ${p.key}: basePrice=${p.basePrice} lot=${p.lot}`);
  if (p.initialStock % p.lot !== 0 || p.targetStock % p.lot !== 0) fail(`pb ${p.key}: 在庫(${p.initialStock}/${p.targetStock})が lot=${p.lot} の倍数でない`);
}

// 4. クエスト賃金 >= 労働相当額
const jobs = [...labor.UNQUALIFIED_JOBS, ...Object.values(labor.QUALIFIED_JOBS).flatMap((q) => q.jobs)];
const PER_DAY_QUEST = { "minecraft:cobblestone": 48, "minecraft:wheat": 12 }; // UNQUALIFIED_JOBS の実データ(納品の無理のない数)
for (const j of jobs) {
  const perDay = pdata.GATHER_RATE_OVERRIDES[j.itemId] ?? PER_DAY_QUEST[j.itemId] ?? pdata.GATHER_DEFAULT_PER_DAY;
  const laborEquivalent = (pdata.GENERIC_HANDWORK_WAGE * j.countMax) / Math.max(perDay, pdata.GATHER_DEFAULT_PER_DAY);
  if (j.wageMin < laborEquivalent - 0.001) fail(`quest ${j.key}: wageMin=${j.wageMin} < 労働相当額 ${laborEquivalent.toFixed(1)}(countMax=${j.countMax})`);
}

// 6. 村人の床値(プレイヤーは村人に直接売れるので、HRMHRMの基準価格がこれを下回ると誰も使わない)
const FLOOR_ALIAS = { "minecraft:wool": "minecraft:white_wool" }; // 床値表の汎用ID → レシピ表のID
for (const [id, floor] of Object.entries(pdata.VILLAGE_FLOOR_RATES)) {
  const base = engine.getItemBasePriceExact(FLOOR_ALIAS[id] ?? id);
  if (base < floor) fail(`village floor ${id}: 基準価格 ${base.toFixed(3)}E < 村人の床値 ${floor.toFixed(3)}E`);
}

// 7. 買取側(情報のみ。失敗にはしない): 動物交易・PBの買取単価が村人の床値を下回る品
const sellInfo = [];
const currRates = Object.fromEntries(Object.entries(market.CURRENCIES).map(([k, c]) => [k, c.baseRate]));
for (const [curr, list] of Object.entries(mob.MOB_TRADE_ITEMS)) for (const e of list) {
  const floor = pdata.VILLAGE_FLOOR_RATES[e.id];
  if (floor === undefined) continue;
  const perItemE = (Math.max(1, Math.ceil(e.value * 0.6)) * currRates[curr]) / e.lot;
  if (perItemE < floor) sellInfo.push(`mob ${curr}/${e.id}: 買取 ${perItemE.toFixed(3)}E/個 < 床値 ${floor.toFixed(3)}E`);
}
for (const p of pb.PB_ITEMS) {
  const floor = pdata.VILLAGE_FLOOR_RATES[p.id];
  if (floor === undefined) continue;
  const worstDay = Math.max(1, Math.round(p.basePrice * pb.PB_PRICE_FACTOR_MIN));
  const perItemE = (Math.max(1, Math.ceil(worstDay * pb.PB_SELL_RATIO)) * currRates.apple) / p.lot;
  if (perItemE < floor) sellInfo.push(`pb ${p.key}: 最悪日の買取 ${perItemE.toFixed(3)}E/個 < 床値 ${floor.toFixed(3)}E`);
}

// 5. レシピ未登録(6の計算で出た警告も含めるため、最後に判定する)
for (const w of warns) if (w.includes("no recipe")) fail(w);

console.warn = origWarn;
console.log(`checked: commodities=${Object.keys(market.COMMODITIES).length} mail=${mailCount} mob=${mobCount} pb=${pb.PB_ITEMS.length} quests=${jobs.length}`);
for (const m of sellInfo) console.log("INFO " + m);
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
