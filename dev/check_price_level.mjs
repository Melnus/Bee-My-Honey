// 物価水準(掛率)の検算スクリプト(Node 20+)。
//   node dev/check_price_level.mjs scripts      (パックのルートで実行)
// 1. 既定の掛率 = 初期掛率64 × インフレ指数1.0
// 2. インフレ指数を2倍にすると、市場価格(バルク・小口・株・外貨・先物)と郵便販売の価格が約2倍になる
// 3. 名目額のヘルパー(scaleEInt)が整数・最低1で掛率を掛ける
// 4. 外貨建ての価格(動物交易・PB)は掛率に依存しない(外貨レートも掛率で動くので比が保たれる)
// 5. 郵便販売は掛率64で、まとめ売り廃止後の元の個数・名前に戻っている
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const store = new Map();
globalThis.__stubWorld = {
  getDay() { return 3; }, getPlayers() { return []; },
  getDynamicProperty: (k) => store.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? store.delete(k) : store.set(k, v))
};
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s,c,n){ if (s.startsWith("@minecraft/")) return {url:"data:text/javascript,stub",shortCircuit:true}; return n(s,c); }
  export async function load(u,c,n){ if (u==="data:text/javascript,stub") return {format:"module",shortCircuit:true,source:
    "export class ItemStack{}; export const world = globalThis.__stubWorld; export const system = { afterEvents: { scriptEventReceive: { subscribe(){} } } };" +
    "export const EnchantmentTypes = { get(){ return undefined; } }; export const EquipmentSlot = {}; export const PlayerPermissionLevel = {};"}; return n(u,c); }
`));
const root = path.resolve(process.argv[2] ?? "scripts");
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const PL = await imp("economy/price-level.js");
const ME = await imp("economy/market-engine.js");
const MO = await imp("data/mail-order-data.js");
const MT = await imp("data/mob-trade-data.js");
const MD = await imp("data/market-data.js");

let errors = 0;
const fail = (m) => { errors++; console.log("NG  " + m); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) fail(`${m}: ${a} vs ${b}`); };

// 1.
if (PL.INITIAL_PRICE_MULTIPLIER !== 64) fail("初期掛率が64でない");
near(PL.getPriceLevel(), 64, 1e-9, "既定の掛率");

// 3.
if (PL.scaleEInt(2) !== 128) fail("scaleEInt(2) が 128 でない");
if (PL.scaleEInt(0.001) !== 1) fail("scaleEInt は最低1のはず");
if (!Number.isInteger(PL.scaleEInt(1.37))) fail("scaleEInt は整数のはず");

const snapshot = () => ({
  cobble: ME.getCommodityPrice("cobblestone"),
  bulkDiamond: ME.getBulkCommodityPrice("diamond"),
  stock: ME.getStockPrice("skein"),
  rate: ME.getCurrencyRate("honeycomb"),
  mail: Object.values(MO.MAIL_ORDER_CATALOG).flat().map((e) => e.price),
  mob: Object.values(MT.MOB_TRADE_ITEMS).flat().map((e) => e.value)
});
const a = snapshot();

// 2.
PL.setPriceIndex(2);
near(PL.getPriceLevel(), 128, 1e-9, "指数2での掛率");
const b = snapshot();
near(b.cobble / a.cobble, 2, 0.02, "小口(丸石)の比");
near(b.bulkDiamond / a.bulkDiamond, 2, 0.02, "バルク(ダイヤ)の比");
near(b.stock / a.stock, 2, 0.02, "株(SKN)の比");
near(b.rate / a.rate, 2, 0.05, "外貨(HNY)の比");
// 郵便販売は整数に丸めるので、2倍になった値との差は±1まで許す
a.mail.forEach((p, i) => { if (Math.abs(b.mail[i] - 2 * p) > 1) fail(`郵便販売[${i}]: ${p} → ${b.mail[i]}`); });
// 4.
a.mob.forEach((v, i) => { if (v !== b.mob[i]) fail(`動物交易の値が掛率で変わった[${i}]: ${v} → ${b.mob[i]}`); });
PL.setPriceIndex(1);

// 5.
const flat = Object.values(MO.MAIL_ORDER_CATALOG).flat();
const wheat = flat.find((e) => e.itemId === "minecraft:wheat");
if (wheat && !/×8\b/.test(wheat.name.ja)) fail(`小麦の名前が元の個数に戻っていない: ${wheat.name.ja}`);
const minP = Math.min(...a.mail), maxP = Math.max(...a.mail);
console.log(`level x${PL.getPriceLevel()}: mail price ${minP}〜${maxP}E / cobble ${a.cobble}E / bulk diamond ${a.bulkDiamond}E / SKN ${a.stock}E / HNY ${a.rate}E`);
if (minP < 1) fail(`郵便販売に1E未満の品がある(${minP}E)`);
console.log(errors === 0 ? "OK" : `${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
