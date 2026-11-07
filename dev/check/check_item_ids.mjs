// 品目IDが、ゲームの正式なアイテム一覧(dev/check/mojang-item-ids.txt。作者がサンプルから取ったメタデータ mojang-items.json の name 一覧)にあるかを確かめる。
//   node dev/check/check_item_ids.mjs scripts      (パックのルートで実行)
// 対象: 取引リスト(data/exchange-items-data.js)・郵便販売カタログ・生鮮市場・バルク/現物の相場(COMMODITIES)・苗木/レコードなどのカタログ
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] ?? "scripts");
const ids = new Set(fs.readFileSync(new URL("./mojang-item-ids.txt", import.meta.url), "utf8").split("\n").filter(Boolean));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
let bad = 0;
const check = (label, list) => { const miss = [...new Set(list)].filter((i) => !ids.has(i)); if (miss.length) { bad++; console.log("NG  " + label + ": " + miss.join(", ")); } };
const all = (s) => [...s.matchAll(/minecraft:([a-z0-9_]+)/g)].map((m) => "minecraft:" + m[1]);
// 取引リスト: ["id","名前"] の形
const tree = [...read("data/exchange-items-data.js").matchAll(/\[\s*"([a-z0-9_]+)",\s*"[^"]*"\s*\]/g)].map((m) => "minecraft:" + m[1]);
if (tree.length !== 305) { bad++; console.log("NG  取引リストの品目数: " + tree.length); }
check("取引リスト", tree);
for (const f of ["data/mail-order-data.js", "data/fresh-market-data.js", "data/market-data.js", "data/mob-trade-data.js", "data/item-catalog.js", "data/food-data.js"]) check(f, all(read(f)));
// レシピ表: M("id") と "minecraft:id"。レコード(music_disc)は入手ペースの共通キーで、アイテムIDではない。
const rec = read("data/pricing-recipes-data.js");
check("data/pricing-recipes-data.js", [...all(rec), ...[...rec.matchAll(/\bM\("([a-z0-9_]+)"\)/g)].map((m) => "minecraft:" + m[1])].filter((i) => i !== "minecraft:music_disc"));
console.log(bad === 0 ? "OK" : bad + " problem(s)");
process.exit(bad ? 1 : 0);
