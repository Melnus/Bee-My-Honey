import { world } from "@minecraft/server";
import { getItemBasePriceExact } from "./village-pricing.js";
import { getPriceLevel } from "./price-level.js";
import { getPolicyParam } from "./policy.js";

// ==========================================
// 施設とプール / Facilities & Pool  (dev/dispatch-spec.md)
// ------------------------------------------
// オーナーズクラブの派遣先。派遣は「履歴書を施設に送るだけ」で、完了すると施設の産出表から
// 現物が出力先(sink)に入る。0.4.4 で使うのは HRMHRM の農場・鉱山・工場の3施設(sink: pool)だけ。
// プレイヤー法人の施設(sink: container)は、operator.type: "company" の枠だけ用意してある。
//
// 産出量 = 賃金(ベース単位) × 派遣日数 × 産出係数(dispatch_output_ratio) ÷ 品目の基準価格(切り捨て、最低1個)
//   品目の基準価格は価格エンジン(village-pricing.js)の値。新しい価格表は持たない。
// プール(HRMHRMの現物倉庫)は、取引所とつながるまでは溜まるだけ。週の締めで、品目ごとに保持数
//   (pool_keep_per_item)を超えた分を、その時の売値(基準価格 × 掛率 × pool_sale_ratio)で換金して口座へ入れる。
// ==========================================

export const FACILITY_GENRES = ["farm", "mine", "factory"];

export const GENRE_NAMES = {
  farm: { ja: "農場", en: "Farm" },
  mine: { ja: "鉱山", en: "Mine" },
  factory: { ja: "工場", en: "Factory" }
};

const M = (id) => "minecraft:" + id;
const hrmhrm = { type: "hrmhrm", id: null };
const pool = { type: "pool", poolId: "hrmhrm" };

// 産出表の品目は、価格エンジンに実際のレシピがあるものだけを選ぶ(未登録の品は汎用採集0.188Eで暫定計算されてしまうため)。
export const FACILITIES = {
  hrmhrm_farm: {
    id: "hrmhrm_farm", genre: "farm", operator: hrmhrm, sink: pool,
    name: { ja: "HRMHRM 農場", en: "HRMHRM Farm" },
    output: [
      { itemId: M("wheat"), weight: 4 }, { itemId: M("carrot"), weight: 3 }, { itemId: M("potato"), weight: 3 },
      { itemId: M("beetroot"), weight: 2 }, { itemId: M("sugar_cane"), weight: 2 }, { itemId: M("pumpkin"), weight: 2 },
      { itemId: M("apple"), weight: 1 }
    ]
  },
  hrmhrm_mine: {
    id: "hrmhrm_mine", genre: "mine", operator: hrmhrm, sink: pool,
    name: { ja: "HRMHRM 鉱山", en: "HRMHRM Mine" },
    output: [
      { itemId: M("coal"), weight: 4 }, { itemId: M("raw_copper"), weight: 3 }, { itemId: M("raw_iron"), weight: 3 },
      { itemId: M("redstone"), weight: 2 }, { itemId: M("lapis_lazuli"), weight: 2 }, { itemId: M("raw_gold"), weight: 2 },
      { itemId: M("diamond"), weight: 1 }
    ]
  },
  hrmhrm_factory: {
    id: "hrmhrm_factory", genre: "factory", operator: hrmhrm, sink: pool,
    name: { ja: "HRMHRM 工場", en: "HRMHRM Factory" },
    output: [
      { itemId: M("bucket"), weight: 3 }, { itemId: M("shears"), weight: 3 }, { itemId: M("piston"), weight: 2 },
      { itemId: M("compass"), weight: 2 }, { itemId: M("clock"), weight: 1 }, { itemId: M("hopper"), weight: 1 }
    ]
  }
};

export function getFacility(id) {
  return FACILITIES[id] ?? null;
}

// ジャンル(農場/鉱山/工場)に含まれる施設の一覧。operatorType を渡すとその運営主体だけに絞る。
export function listFacilities(genre, operatorType = null) {
  return Object.values(FACILITIES).filter((f) => f.genre === genre && (!operatorType || f.operator.type === operatorType));
}

function pickWeighted(list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

// 産出を決める。品目は施設の産出表から重み付きで1種類を抽選し、個数は賃金の価値から逆算する。
// wageBase は履歴書の wage(ベース単位。グレード・レベル込み)。
export function rollFacilityOutput(facility, wageBase, days) {
  const entry = pickWeighted(facility.output);
  const price = getItemBasePriceExact(entry.itemId);
  const value = wageBase * days * getPolicyParam("dispatch_output_ratio");
  const count = Math.max(1, Math.floor(value / Math.max(price, 0.001)));
  return { itemId: entry.itemId, count };
}

// ---------- プール(現物倉庫) ----------
const POOL_KEY = "hrmhrm_pool";

export function getPool() {
  const raw = world.getDynamicProperty(POOL_KEY);
  if (typeof raw !== "string") return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function savePool(pool) {
  world.setDynamicProperty(POOL_KEY, JSON.stringify(pool));
}

// 施設の出力先に産出を入れる。sink が pool なら現物倉庫へ。
export function depositToFacility(facility, itemId, count) {
  if (!(count > 0)) return false;
  if (facility.sink.type === "pool") {
    const p = getPool();
    p[itemId] = (p[itemId] ?? 0) + count;
    savePool(p);
    return true;
  }
  return false; // container(プレイヤー法人の施設)は次のアプデ
}

// 週の締め: 品目ごとに保持数を超えた分を換金する。戻り値の cash は口座に入れるE(整数)。
// 売値 = 基準価格 × 現在の掛率(getPriceLevel) × pool_sale_ratio。
export function settlePool() {
  const keep = getPolicyParam("pool_keep_per_item");
  const ratio = getPolicyParam("pool_sale_ratio");
  const level = getPriceLevel();
  const p = getPool();
  let cash = 0;
  const sold = {};
  for (const [itemId, count] of Object.entries(p)) {
    const surplus = count - keep;
    if (!(surplus > 0)) continue;
    cash += getItemBasePriceExact(itemId) * level * ratio * surplus;
    sold[itemId] = surplus;
    p[itemId] = keep;
  }
  cash = Math.floor(cash);
  if (Object.keys(sold).length > 0) savePool(p);
  return { cash, sold };
}

// 管理用の一行レポート(bmh:account の出力に足す)
export function formatPoolReport() {
  const entries = Object.entries(getPool()).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "プール: (空)";
  return "プール: " + entries.map(([id, n]) => `${id.replace("minecraft:", "")} ${n}`).join(", ");
}
