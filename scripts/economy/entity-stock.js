import { getPolicyParam } from "./policy.js";
import { getPriceLevel } from "./price-level.js";
import { getItemBasePriceExact } from "./village-pricing.js";
import { saveCore } from "./core-registry.js";
import { saveEntityAccount } from "./account.js";

// 不足額を、在庫の物資を売って埋める(高い物から。売値 = 基準価格 × 掛率 × pool_sale_ratio)。売って得た額を返す。
export function sellStockFor(core, acct, need) {
  const ratio = getPolicyParam("pool_sale_ratio");
  const level = getPriceLevel();
  const items = Object.entries(core.stock ?? {})
    .filter(([, n]) => n > 0)
    .map(([itemId, n]) => ({ itemId, n, price: getItemBasePriceExact(itemId) * level * ratio }))
    .filter((x) => x.price > 0)
    .sort((a, b) => b.price - a.price);
  let cash = 0;
  for (const it of items) {
    if (cash >= need) break;
    const units = Math.min(it.n, Math.ceil((need - cash) / it.price));
    cash += units * it.price;
    core.stock[it.itemId] = it.n - units;
    if (core.stock[it.itemId] <= 0) delete core.stock[it.itemId];
  }
  if (cash > 0) { acct.cash += cash; saveCore(core); saveEntityAccount(acct); }
  return cash;
}
