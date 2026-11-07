// すべての検算(check_*.mjs / check_undefined.js)を順に実行して、通らなかったものだけ表示する。
//   パックのルート(manifest.json のある所)で:  node ../dev/check/run-all.mjs
//   別の場所のパックを検査するとき:             node dev/check/run-all.mjs <パックのルート>
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = path.resolve(process.argv[2] ?? ".");
const scripts = path.join(pack, "scripts");
if (!fs.existsSync(path.join(scripts, "main.js"))) { console.error("scripts/main.js が見つかりません: " + pack); process.exit(2); }
const files = fs.readdirSync(here).filter((f) => /^check_.*\.(mjs|js)$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync("node", [path.join(here, f), scripts], { cwd: pack, encoding: "utf8", timeout: 300000 });
  if (r.status !== 0) {
    failed++;
    console.log(`FAIL ${f}`);
    const out = ((r.stdout ?? "") + (r.stderr ?? "")).split("\n").filter((l) => !l.includes("[BeeMyHoney]")).slice(-8).join("\n");
    console.log(out);
  }
}
console.log(failed === 0 ? `OK  ${files.length}本の検算がすべて通過` : `${failed}/${files.length}本が失敗`);
process.exit(failed ? 1 : 0);
