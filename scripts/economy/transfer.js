import { world } from "@minecraft/server";
import { creditEmeralds, debitEmeralds, FLOW } from "./ledger.js";
import { getAccount } from "./bank.js";
import { getPolicyParam } from "./policy.js";
import { scaleEInt } from "./price-level.js";

// ==========================================
// 個人間の送金 / Player-to-Player Transfer
// ------------------------------------------
// 口座から口座へ送る。相手はオンラインのプレイヤーのみ(オフラインの口座には触れないため)。
//   手数料 … 送金額 × transfer_fee_rate(送り主が上乗せで払う。HRMHRMの収益)
//   上限   … 1人が1日に送れる合計は transfer_daily_cap_base(×掛率)まで(手数料は数えない)
// 送金額は受取人にそのまま入る(out: transfer_out / in: transfer_in が同額で釣り合う。手数料は transfer_fee)。
// ==========================================
export function listTransferTargets(from) {
  return world.getAllPlayers().filter((p) => p.id !== from.id);
}

export const transferFee = (amount) => Math.ceil(amount * getPolicyParam("transfer_fee_rate"));
export const dailyCap = () => scaleEInt(getPolicyParam("transfer_daily_cap_base"));

// 今日あと送れる額(上限 − 今日の送金済み)
export function remainingToday(player) {
  const day = world.getDay();
  const sent = player.getDynamicProperty("xfer_day") === day ? (player.getDynamicProperty("xfer_sum") ?? 0) : 0;
  return Math.max(0, dailyCap() - sent);
}

// いま送れる最大額(残高から手数料を引いた額と、今日の残りの小さい方)
export function maxTransfer(player) {
  const bal = getAccount(player).emeralds;
  const rate = getPolicyParam("transfer_fee_rate");
  let q = Math.floor(bal / (1 + rate));
  while (q > 0 && q + transferFee(q) > bal) q--;
  return Math.max(0, Math.min(q, remainingToday(player)));
}

// reason: "bad_amount" | "self" | "offline" | "over_daily_cap" | "insufficient_funds"
export function transferEmeralds(from, to, amount) {
  const n = Math.floor(amount);
  if (!(n > 0)) return { ok: false, reason: "bad_amount" };
  if (!to || to.id === from.id) return { ok: false, reason: "self" };
  if (!world.getAllPlayers().some((p) => p.id === to.id)) return { ok: false, reason: "offline" };
  const left = remainingToday(from);
  if (n > left) return { ok: false, reason: "over_daily_cap", remaining: left };
  const fee = transferFee(n);
  if (getAccount(from).emeralds < n + fee) return { ok: false, reason: "insufficient_funds" };
  debitEmeralds(from, n, FLOW.TRANSFER_OUT, { to: to.name });
  if (fee > 0) debitEmeralds(from, fee, FLOW.TRANSFER_FEE, { to: "HRMHRM" });
  creditEmeralds(to, n, FLOW.TRANSFER_IN, { from: from.name });
  const day = world.getDay();
  from.setDynamicProperty("xfer_sum", (from.getDynamicProperty("xfer_day") === day ? (from.getDynamicProperty("xfer_sum") ?? 0) : 0) + n);
  from.setDynamicProperty("xfer_day", day);
  return { ok: true, amount: n, fee };
}
