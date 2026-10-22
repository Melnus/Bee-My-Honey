import { registerFacilityProvider, FACILITIES, GENRE_NAMES, FACILITY_GENRES } from "./facility.js";
import { coreName } from "../i18n/names.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { getPriceLevel } from "./price-level.js";
import { getPolicyParam } from "./policy.js";
import { loadCore, saveCore, listCores } from "./core-registry.js";

// ==========================================
// 会社の仮想施設・在庫・契約 / Company Virtual Facilities  (dev/corporate-template-spec.md 第15章)
// ------------------------------------------
// 会社は、登記と同時に3つの仮想施設(農場・鉱山・工場)を持つ。範囲登録による「保有施設」(不動産)が入るまでの
// 仮の姿で、追加料金はかからない。産出表は HRMHRM の同じジャンルの施設と同じ。
//   施設ID: co:<会社ID>:<ジャンル> / 出力先(sink): { type: "stock" } = 会社の在庫(core.stock)
// 産出表から貴金属(金・ダイヤ)は除く。在庫は、週の締めで保持数(pool_keep_per_item)を超えた分を、HRMHRMのプールと同じ規則で換金して会社の口座へ入れる。
// 契約管理: 自社の施設に送られた派遣の、進行中(core.contracts)と最近の結果(core.contractLog)。
// 会社が解散すると施設は消える。契約中だった履歴書は、回収の時に「施設が閉鎖されていた」扱いになる(産出は届かない)。
// ==========================================
// 貴金属(金・ダイヤ・エメラルド)は、会社の仮想施設からは産出しない(消費する側だけ。産出させると皆それだけをやって崩壊するため)。
// 供給源は HRMHRM の鉱山と、プレイヤーが自力で掘って納品する分だけ。(2026-10-18 のメモで決定)
export const PRECIOUS_ITEM_IDS = ["minecraft:raw_gold", "minecraft:gold_ingot", "minecraft:diamond", "minecraft:emerald"];
export const CONTRACTS_KEEP = 50;
export const CONTRACT_LOG_KEEP = 10;
const OPERATOR_LIST_MAX = 30;
const ID_RE = /^co:([A-Z0-9]{6}):(farm|mine|factory)$/;

export const companyFacilityId = (coreId, genre) => `co:${coreId}:${genre}`;

function build(core, genre) {
  const base = FACILITIES["hrmhrm_" + genre];
  const g = GENRE_NAMES[genre];
  return {
    id: companyFacilityId(core.id, genre), genre,
    operator: { type: "company", id: core.id },
    sink: { type: "stock", coreId: core.id },
    name: { ja: `${coreName(core, "ja")} ${g.ja}`, en: `${coreName(core, "en")} ${g.en}` },
    output: base.output.filter((e) => !PRECIOUS_ITEM_IDS.includes(e.itemId))
  };
}

export function stockValueBase(stock) {
  let v = 0;
  for (const [itemId, n] of Object.entries(stock ?? {})) if (n > 0) v += getItemBasePriceExact(itemId) * n;
  return v;
}
export const stockValue = (stock) => stockValueBase(stock) * getPriceLevel();

registerFacilityProvider({
  get(id) {
    const m = ID_RE.exec(id);
    if (!m) return null;
    const core = loadCore(m[1]);
    return core && core.kind === "company" && !core.dissolving ? build(core, m[2]) : null;
  },

  list(genre) {
    if (!FACILITY_GENRES.includes(genre)) return [];
    return listCores("company")
      .filter((c) => !c.dissolving)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, OPERATOR_LIST_MAX)
      .map((c) => build(c, genre));
  },

  stock(facility) {
    if (facility.sink.type !== "stock") return null;
    return loadCore(facility.operator.id)?.stock ?? {};
  },

  withdraw(facility, itemId, count) {
    if (facility.sink.type !== "stock") return false;
    const core = loadCore(facility.operator.id);
    if (!core || core.dissolving || (core.stock?.[itemId] ?? 0) < count) return false;
    core.stock[itemId] -= count;
    return saveCore(core);
  },

  deposit(facility, itemId, count) {
    if (facility.sink.type !== "stock") return false;
    const core = loadCore(facility.operator.id);
    if (!core || core.dissolving) return false;
    core.stock ??= {};
    core.stock[itemId] = (core.stock[itemId] ?? 0) + count;
    return saveCore(core);
  },

  onDispatch(event, facility, info) {
    if (facility.operator.type !== "company") return;
    const core = loadCore(facility.operator.id);
    if (!core) return;
    core.contracts ??= [];
    core.contractLog ??= [];
    if (event === "start") {
      core.contracts = core.contracts.filter((c) => c.key !== info.key);
      core.contracts.push({ key: info.key, who: info.playerName, genre: facility.genre, days: info.days, endDay: info.endDay, itemId: info.output?.itemId, count: info.output?.count });
      if (core.contracts.length > CONTRACTS_KEEP) core.contracts.splice(0, core.contracts.length - CONTRACTS_KEEP);
    } else if (event === "end") {
      core.contracts = core.contracts.filter((c) => c.key !== info.key);
      core.contractLog.unshift({ who: info.playerName, genre: facility.genre, days: info.days, result: info.result, itemId: info.output?.itemId, count: info.output?.count });
      if (core.contractLog.length > CONTRACT_LOG_KEEP) core.contractLog.length = CONTRACT_LOG_KEEP;
    }
    saveCore(core);
  },

  // 週の締め: 保持数を超えた分を、その時の売値で換金する(settlePool と同じ規則)
  settle(accountId) {
    const core = loadCore(accountId);
    if (!core || core.kind !== "company") return null;
    const keep = getPolicyParam("pool_keep_per_item");
    const ratio = getPolicyParam("pool_sale_ratio");
    const level = getPriceLevel();
    const stock = core.stock ?? {};
    let cash = 0;
    const sold = {};
    for (const [itemId, count] of Object.entries(stock)) {
      const surplus = count - keep;
      if (!(surplus > 0)) continue;
      cash += getItemBasePriceExact(itemId) * level * ratio * surplus;
      sold[itemId] = surplus;
      stock[itemId] = keep;
    }
    if (Object.keys(sold).length > 0) { core.stock = stock; saveCore(core); }
    return { cash: Math.floor(cash), sold };
  }
});
