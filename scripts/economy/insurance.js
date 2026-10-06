import { scaleEInt } from "./price-level.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { debitEmeralds, FLOW } from "./ledger.js";
import { world } from "@minecraft/server";
import { getAccount, giveItem } from "./bank.js";
import { adjustCredit } from "./credit.js";

// ==========================================
// 保険制度 / Insurance System
// 海難保険/漁獲保険/海底財産保険の3種類。
// 死亡自体は entityDie で確実に検知できるので、それを起点に支給する。
// ただし「死因まで見て種類ごとに出し分ける」のは海難保険(溺死)だけ現実的なので、
// それ以外は契約時に提示した定額を死亡時に一律支給するフォールバック方式にする。
// ==========================================
// 支給額の決め方(2026-10-05): 統一プライシングで支給品(鉄・乾燥コンブ・金)が安くなり、保険料(ベース8/5/10E)に
// 対して支給の価値が2〜6割しかなかった。そこで「1回の支給の価値 = 週の保険料 × INSURANCE_PAYOUT_MULTIPLE」になるよう、
// 支給の個数を基準価格から出す(切りのよい個数に丸める)。倍率4 = 週に4回に1回以上死ぬ人なら元が取れる水準。
// 保険料・支給品の価値はどちらも掛率に比例するので、インフレしても比は変わらない。
export const INSURANCE_PAYOUT_MULTIPLE = 4;
const PAYOUT_ROUND_TO = 4; // 個数の丸め単位(1スタックの端数にならない切りのよい数)

function payoutAmount(itemId, premiumBase) {
  const unit = getItemBasePriceExact(itemId); // 基準価格(ベース単位E/個)
  return Math.max(PAYOUT_ROUND_TO, Math.round((premiumBase * INSURANCE_PAYOUT_MULTIPLE) / unit / PAYOUT_ROUND_TO) * PAYOUT_ROUND_TO);
}

function makeType({ name, premium, itemId, itemName, desc }) {
  return { name, premium, payout: { itemId, amount: payoutAmount(itemId, premium), name: itemName }, desc };
}

export const INSURANCE_TYPES = {
  maritime: makeType({
    name: { ja: "海難保険", en: "Maritime Accident Insurance" },
    premium: 8,
    itemId: "minecraft:iron_ingot",
    itemName: { ja: "鉄インゴット", en: "Iron Ingot" },
    desc: { ja: "溺死など水難事故で満額、それ以外の死因でも半額支給", en: "Full payout on drowning, half on other deaths" }
  }),
  catch: makeType({
    name: { ja: "漁獲保険", en: "Catch Insurance" },
    premium: 5,
    itemId: "minecraft:dried_kelp",
    itemName: { ja: "乾燥コンブ", en: "Dried Kelp" },
    desc: { ja: "死亡時に粗品(乾燥コンブ)を定額支給", en: "Flat payout of dried kelp on death" }
  }),
  seabed_asset: makeType({
    name: { ja: "海底財産保険", en: "Seabed Asset Insurance" },
    premium: 10,
    itemId: "minecraft:gold_ingot",
    itemName: { ja: "金インゴット", en: "Gold Ingot" },
    desc: { ja: "死亡時に定額の金インゴットを支給", en: "Flat payout of gold ingot on death" }
  })
};

export function getActiveInsurance(player) {
  const type = player.getDynamicProperty("cr_insurance_type");
  return type ? INSURANCE_TYPES[type] ?? null : null;
}

export function subscribeInsurance(player, typeKey) {
  if (!INSURANCE_TYPES[typeKey]) return { ok: false, reason: "invalid_type" };
  player.setDynamicProperty("cr_insurance_type", typeKey);
  player.setDynamicProperty("cr_insurance_payment_ok", true);
  return { ok: true };
}

export function cancelInsurance(player) {
  player.setDynamicProperty("cr_insurance_type", null);
}

// 保険料(ベース単位 → 実際の金額)。支給品(アイテム)は個数なのでそのまま。
export const getPremium = (type) => scaleEInt(type.premium);

// 週次の保険料引き落とし
export function applyInsuranceBilling() {
  for (const player of world.getPlayers()) {
    const typeKey = player.getDynamicProperty("cr_insurance_type");
    if (!typeKey) continue;
    const type = INSURANCE_TYPES[typeKey];
    const acc = getAccount(player);

    const premium = getPremium(type);
    if (acc.emeralds >= premium) {
      debitEmeralds(player, premium, FLOW.INSURANCE);
      player.setDynamicProperty("cr_insurance_payment_ok", true);
      adjustCredit(player, "insurancePaidOnTime");
    } else {
      player.setDynamicProperty("cr_insurance_payment_ok", false);
      adjustCredit(player, "overdue");
      player.sendMessage(`§c[保険] 保険料 ${premium}E が支払えず、未払い状態です。`);
    }
  }
}

// world.afterEvents.entityDie から呼ぶ。damageSource.cause を見て、
// 海難保険は溺死なら満額、それ以外の死因でも半額は出す（未加入判定と無関係の死因を弾く必要はない）。
export function handleInsuranceDeath(player, damageSource) {
  const typeKey = player.getDynamicProperty("cr_insurance_type");
  if (!typeKey) return;
  if (player.getDynamicProperty("cr_insurance_payment_ok") === false) return; // 保険料未払い中は支給しない

  const type = INSURANCE_TYPES[typeKey];
  let amount = type.payout.amount;

  if (typeKey === "maritime") {
    const isDrowning = damageSource?.cause === "drowning";
    amount = isDrowning ? type.payout.amount : Math.ceil(type.payout.amount / 2);
  }

  giveItem(player, type.payout.itemId, amount);
  player.sendMessage(`§b[保険] ${type.name.ja}から補償を受け取りました。`);
}

export function startInsuranceDeathWatch() {
  world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;
    if (!entity || entity.typeId !== "minecraft:player") return;
    handleInsuranceDeath(entity, event.damageSource);
  });
}
