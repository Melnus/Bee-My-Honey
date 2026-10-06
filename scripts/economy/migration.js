import { world, system } from "@minecraft/server";
import { getPriceLevel } from "./price-level.js";
import { creditEmeralds, FLOW } from "./ledger.js";
import { STOCKS, CURRENCIES, FUTURES } from "../data/market-data.js";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";

// ==========================================
// 既存ワールドの金額換算 / Migration for existing worlds
// ------------------------------------------
// 0.4.2以前のワールドは、口座・借入・カードなどの金額が「旧縮尺」で保存されている。価格は読む時に掛率(64)が掛かるので、
// そのままだと貯金が1/64の価値になり、借金は実質帳消しになる。そこで、プレイヤーが最初にログインした時に1回だけ、
// 保存されている名目額を掛率で換算する。基準は賃金(価格体系の単位)で、「資産が何日分の労働に当たるか」が変わらない。
//   換算する: 口座残高 / 借入残高・週の返済額 / カードの限度額・残高・最低返済 / 融資中の元本 /
//             株の平均取得単価 / 外貨の平均取得レート / 先物の約定価格 / コンサルタント契約のマージン
//   換算しない: 外貨建て残高(通貨の単位数)、株・先物の枚数、物理エメラルド、村人の賃金(ベース単位で保存済み)
// 換算した口座残高の増分は、台帳に conversion(migration)として記録する(発行ではない扱い)。
// 判定:
//   ・ワールド単位で最初に1回だけ「legacy(旧ワールド)」か「current(新版で始まったワールド)」かを決める。
//     台帳(bmh_ledger_v1)か物価指数(bmh_price_index)が既にあれば、新版が動いた形跡なので current(換算しない)。
//   ・プレイヤー単位は bmh_scale_version で1回だけ。
// 注意: その日のクエスト掲示板に旧金額のものが残っていれば、その日だけ報酬が低い(翌日の掲示から新金額)。
// ==========================================

export const SCALE_VERSION = 1;
const WORLD_KEY = "bmh_scale_world"; // "legacy" | "current"
const PLAYER_KEY = "bmh_scale_version";

export function getScaleWorldMode() {
  let mode = world.getDynamicProperty(WORLD_KEY);
  if (mode !== "legacy" && mode !== "current") {
    const ranBefore = typeof world.getDynamicProperty("bmh_ledger_v1") === "string" || typeof world.getDynamicProperty("bmh_price_index") === "number";
    mode = ranBefore ? "current" : "legacy";
    world.setDynamicProperty(WORLD_KEY, mode);
  }
  return mode;
}

function scaleProp(player, key, factor, decimals = 0) {
  const v = player.getDynamicProperty(key);
  if (typeof v !== "number" || v === 0) return false;
  const scaled = v * factor;
  player.setDynamicProperty(key, decimals > 0 ? parseFloat(scaled.toFixed(decimals)) : Math.round(scaled));
  return true;
}

function scaleConsultantMargin(player, factor) {
  const raw = player.getDynamicProperty("labor_consultant_contract");
  if (typeof raw !== "string") return false;
  try {
    const contract = JSON.parse(raw);
    if (typeof contract.margin !== "number") return false;
    contract.margin = Math.round(contract.margin * factor);
    player.setDynamicProperty("labor_consultant_contract", JSON.stringify(contract));
    return true;
  } catch (e) {
    console.warn("[BeeMyHoney] migration: consultant contract unreadable: " + e);
    return false;
  }
}

// 1人ぶんの換算。換算した項目数と掛率を返す。
export function convertPlayerAmounts(player, factor) {
  let converted = 0;
  const count = (ok) => { if (ok) converted++; };

  // 口座残高は台帳経由で増分を足す(増分 = 旧残高 × (掛率−1))
  const bal = player.getDynamicProperty("acc_emeralds");
  if (typeof bal === "number" && bal > 0) {
    const delta = Math.round(bal * (factor - 1));
    if (delta > 0) { creditEmeralds(player, delta, FLOW.MIGRATION); converted++; }
  }
  for (const key of ["cr_loan_balance", "cr_loan_weekly_payment", "loan_lent_amount", "cr_card_limit", "cr_card_balance", "cr_card_min_payment"]) {
    count(scaleProp(player, key, factor));
  }
  for (const key of Object.keys(STOCKS)) count(scaleProp(player, `acc_stock_bought_${key}`, factor));
  for (const key of Object.keys(CURRENCIES)) count(scaleProp(player, `acc_rate_${key}`, factor, 2));
  for (const key of Object.keys(FUTURES)) count(scaleProp(player, `fut_strike_${key}`, factor));
  count(scaleConsultantMargin(player, factor));
  return { converted, factor };
}

// プレイヤーが入った時に呼ぶ。必要なら1回だけ換算して、結果を返す(不要なら null)。
export function migratePlayerIfNeeded(player) {
  const done = player.getDynamicProperty(PLAYER_KEY);
  if (typeof done === "number" && done >= SCALE_VERSION) return null;

  let result = null;
  if (getScaleWorldMode() === "legacy") {
    const factor = getPriceLevel();
    result = convertPlayerAmounts(player, factor);
    if (result.converted > 0) {
      player.sendMessage(t(getLang(player), STR.migrationDone, factor));
    }
  }
  player.setDynamicProperty(PLAYER_KEY, SCALE_VERSION);
  return result;
}

export function startMigrationOnSpawn() {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    migratePlayerIfNeeded(ev.player);
  });
  // スクリプトの再読み込み時など、既に入っているプレイヤーにも1回だけ適用する
  system.run(() => {
    for (const player of world.getPlayers()) migratePlayerIfNeeded(player);
  });
}
