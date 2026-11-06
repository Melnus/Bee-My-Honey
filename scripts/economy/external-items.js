import { world, system } from "@minecraft/server";
import * as mc from "@minecraft/server";
import { EXCHANGE_TREE } from "../data/exchange-items-data.js";
import { PRICING_RECIPES } from "../data/pricing-recipes-data.js";
import { getItemBasePriceExact, MARGIN } from "./village-pricing.js";
import { prettyName } from "../data/item-names-extra.js";

// ==========================================
// 外部アドオンの品目 / External Add-on Items  (2026-11-05 作者の方針)
// ------------------------------------------
// ゲームは、アドオンを入れれば、そのアドオンの品を理解している(ItemTypes.getAll())。取引所もそれに追いつく。
//   1. 名前空間が minecraft: 以外の品目IDを見つけると、名前の似ている(末尾の語が同じ)取引リストの品を探し、
//      その品と同じ値付けにして(PRICING_RECIPES に、似た品の基準価格と同額の原価を足す)、「アドオンの品」の小分類に載せる。
//   2. 似た品が見つからない品は、載せない(値付けできないため)。`/scriptevent bmh:ext list` で一覧が見られ、
//      `bmh:ext alias <ID> <似た品>` で手動で値付けの相手を決められる(決めた品は、自動の見直しで動かさない)。
//   3. 3日ごとに検算する: 似た品を探し直し、基準価格が前回から5%以上ずれていたら更新して、履歴に残す。
// 英語・日本語の名前は、いまは IDから整えた名前(`bmh:ext name <ID> <名前>` で日本語名を付けられる)。
// 保存: world の dynamic property bmh_ext_items = { ID: { l: 似た品, b: 基準価格, w: 弱い一致(1), p: 手動で固定(1), j: 日本語名, d: 登録日 } }
// ==========================================
const KEY = "bmh_ext_items";
const HIST_KEY = "bmh_ext_hist";
const CHK_KEY = "bmh_ext_chk";
const CHECK_EVERY_DAYS = 3;
const MAX_ITEMS = 400;
const DRIFT = 0.05;
const GROUP_KEY = "addon";

let version = 0;
export const externalVersion = () => version;

let state = null; // { ID: {l,b,w,p,j,d} }。l=null は「似た品なし」(載せない)
function load() {
  if (state) return state;
  state = {};
  try { const raw = world.getDynamicProperty(KEY); if (typeof raw === "string") state = JSON.parse(raw) ?? {}; } catch (e) {}
  return state;
}
function save() {
  try { world.setDynamicProperty(KEY, JSON.stringify(state)); } catch (e) { console.warn("[BeeMyHoney] ext save: " + e); }
}
function pushHist(msg, day) {
  try {
    let h = []; const raw = world.getDynamicProperty(HIST_KEY); if (typeof raw === "string") h = JSON.parse(raw) ?? [];
    h.push(`d${day}: ${msg}`); while (h.length > 30) h.shift();
    world.setDynamicProperty(HIST_KEY, JSON.stringify(h));
  } catch (e) {}
}

// ---- 似た品を探す ----
let pool = null;
function candidates() {
  if (pool) return pool;
  pool = [];
  for (const c of EXCHANGE_TREE) for (const g of c.groups) for (const [short] of g.items) {
    if (short.includes("#") || short.includes(":")) continue;
    pool.push({ id: "minecraft:" + short, short, toks: short.split("_") });
  }
  return pool;
}
const shortOf = (id) => String(id).split(":").slice(1).join(":");

// 戻り値: { like, weak } | null。
//   名前が丸ごと同じ品 → それ。 末尾の語が同じ品の中から、共通の語が多いものを選ぶ(同点は基準価格の中央値)。
//   末尾の語しか合わず候補が多い(=素材を示す語が合っていない)ものは weak。
export function findLike(itemId) {
  const toks = shortOf(itemId).split("_").filter(Boolean);
  if (!toks.length) return null;
  const name = toks.join("_");
  let best = [], bestScore = 0;
  for (const c of candidates()) {
    if (c.short === name) return { like: c.id, weak: false };
    let tail = 0;
    while (tail < toks.length && tail < c.toks.length && toks[toks.length - 1 - tail] === c.toks[c.toks.length - 1 - tail]) tail++;
    if (tail === 0) continue;
    const shared = toks.filter((x) => c.toks.includes(x)).length;
    const score = tail * 10 + shared;
    if (score > bestScore) { bestScore = score; best = [c]; } else if (score === bestScore) best.push(c);
  }
  if (!best.length) return null;
  const priced = best.map((c) => ({ c, p: safePrice(c.id) })).filter((x) => x.p > 0).sort((a, b) => a.p - b.p);
  if (!priced.length) return null;
  const mid = priced[Math.floor((priced.length - 1) / 2)].c;
  const tail = Math.floor(bestScore / 10), shared = bestScore % 10;
  return { like: mid.id, weak: priced.length > 3 && shared <= tail };
}
function safePrice(id) { try { return getItemBasePriceExact(id); } catch (e) { return 0; } }

// ---- 取引リストへの反映 ----
function applyOne(id, rec) {
  if (!rec.l || !(rec.b > 0)) return false; // 値付けの相手がない品(u)は、基準価格なし。出品の上限だけ別に決める(exchange.js)
  PRICING_RECIPES[id] = { kind: "fixed", cost: rec.b / MARGIN }; // 基準価格 = 原価×MARGIN なので、似た品の基準価格と同額になる(検算で追う)
  return true;
}
function rebuildGroup() {
  const rare = EXCHANGE_TREE.find((c) => c.key === "rare");
  if (!rare) return;
  const items = Object.entries(state).filter(([, r]) => r.l || r.u).map(([id, r]) => [id, r.j ?? prettyName(id)]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let g = rare.groups.find((x) => x.key === GROUP_KEY);
  if (!items.length) { if (g) rare.groups.splice(rare.groups.indexOf(g), 1); version++; return; }
  if (!g) { g = { key: GROUP_KEY, ja: "アドオンの品", en: "Add-on Items", items: [] }; rare.groups.push(g); }
  g.items.length = 0; g.items.push(...items);
  version++;
}
export function externalEntries() {
  return Object.entries(load()).filter(([, r]) => r.l || r.u).map(([id, r]) => ({ itemId: id, ja: r.j ?? prettyName(id), like: r.l ?? null }));
}

// 外部アドオンの品(名前空間が minecraft: 以外)か。種類つきのキーの「#」より前で見る。
export function isExternalId(itemId) {
  const base = String(itemId ?? "").split("#")[0];
  return base.includes(":") && !base.startsWith("minecraft:");
}
// 取引リストにない品を、自動で載せてよいか。外部アドオンの品に加え、取引リストにないバニラの品(マイクラの更新で増えた品など)も対象。
//   種類つきのキー(#)・取引リストにある品・取引してはいけない品(コマンドブロックなど)は対象外。
const NEVER_LIST = new Set(["command_block", "chain_command_block", "repeating_command_block", "command_block_minecart", "barrier", "structure_block", "structure_void", "jigsaw",
  "light_block", "allow", "deny", "border_block", "debug_stick", "bedrock", "reinforced_deepslate", "end_portal_frame", "spawner", "monster_spawner", "knowledge_book", "player_head_placeholder"]);
let treeSet = null;
function inTree(id) {
  if (!treeSet) treeSet = new Set(candidates().map((c) => c.id));
  return treeSet.has(id);
}
export function isAutoListable(itemId) {
  const id = String(itemId ?? "");
  if (!id || id.includes("#")) return false;
  const full = id.includes(":") ? id : "minecraft:" + id;
  if (inTree(full)) return false;
  return !NEVER_LIST.has(full.split(":").slice(1).join(":"));
}
// 値付けの相手がない(基準価格がない)登録済みの品。出品の上限は決まっておらず、売り手が値段を決める。
export function isUnpriced(itemId) { const r = load()[itemId]; return !!r && !r.l && !!r.u; }
// 専用シュルカーから取り込んだ品・出品する品が、まだ取引リストにない外部アドオンの品なら、その場で載せる(品目のページができる)。
//   似た品があればその値付け、なければ値付けなし(売り手が決める)。戻り値: 載っている(載せた)なら true
export function registerExternalNow(itemId, day = world.getDay()) {
  if (!isAutoListable(itemId)) return false;
  load();
  const cur = state[itemId];
  if (cur && (cur.l || cur.u)) return true;
  if (!cur && Object.keys(state).length >= MAX_ITEMS) return false;
  const f = findLike(itemId);
  state[itemId] = f ? { l: f.like, b: round(safePrice(f.like)), w: f.weak ? 1 : undefined, d: day } : { l: null, u: 1, d: day };
  applyOne(itemId, state[itemId]); save(); rebuildGroup();
  return true;
}

// ---- 見つける(ItemTypes.getAll() の minecraft: 以外) ----
export function scanExternal(day = world.getDay()) {
  load();
  let ids = [];
  try { ids = (mc.ItemTypes?.getAll?.() ?? []).map((t) => t.id).filter((id) => typeof id === "string" && id.includes(":") && !id.startsWith("minecraft:")); } catch (e) { ids = []; }
  let added = 0;
  for (const id of ids) {
    if (state[id] || Object.keys(state).length >= MAX_ITEMS) continue;
    const f = findLike(id);
    state[id] = f ? { l: f.like, b: round(safePrice(f.like)), w: f.weak ? 1 : undefined, d: day } : { l: null, d: day };
    if (f) added++;
  }
  for (const [id, r] of Object.entries(state)) applyOne(id, r);
  if (added || ids.length) save();
  rebuildGroup();
  return { found: ids.length, added };
}
const round = (x) => Math.round(x * 1e6) / 1e6;

// ---- 検算(3日ごと) ----
export function verifyExternal(day = world.getDay(), force = false) {
  load();
  const last = world.getDynamicProperty(CHK_KEY);
  if (!force && typeof last === "number" && day - last < CHECK_EVERY_DAYS) return { ran: false, changed: 0 };
  world.setDynamicProperty(CHK_KEY, day);
  let changed = 0;
  for (const [id, r] of Object.entries(state)) {
    if (r.p) { if (r.l) { const nb = round(safePrice(r.l)); if (nb > 0) r.b = nb; } continue; }
    const f = findLike(id);
    if (!f) continue;
    const nb = round(safePrice(f.like));
    const drift = r.b > 0 ? Math.abs(nb - r.b) / r.b : 1;
    if (f.like !== r.l || drift >= DRIFT) {
      pushHist(`${id}: ${r.l ?? "-"} (${r.b ?? "-"}) -> ${f.like} (${nb})`, day);
      r.l = f.like; r.b = nb; r.w = f.weak ? 1 : undefined; r.u = undefined; changed++;
    }
  }
  for (const [id, r] of Object.entries(state)) applyOne(id, r);
  if (changed) { save(); rebuildGroup(); }
  return { ran: true, changed };
}

// ---- 管理コマンド ----
//   /scriptevent bmh:ext list | check | alias <ID> <似た品> | name <ID> <日本語名> | forget <ID>
export function externalCommand(player, message) {
  load();
  const say = (m) => { try { player.sendMessage(m); } catch (e) {} };
  const [cmd, a, ...rest] = String(message ?? "").trim().split(/\s+/);
  const withNs = (x) => (x && !x.includes(":") ? "minecraft:" + x : x);
  if (cmd === "list") {
    const rows = Object.entries(state).map(([id, r]) => r.l ? `${id} ~ ${r.l.replace("minecraft:", "")} (${r.b}E${r.w ? ", weak" : ""}${r.p ? ", pinned" : ""})` : r.u ? `${id} (listed, no price match)` : `${id} (no match)`);
    say(rows.length ? rows.slice(0, 40).join("\n") + (rows.length > 40 ? `\n... +${rows.length - 40}` : "") : "(no add-on items)");
  } else if (cmd === "check") { const r = verifyExternal(world.getDay(), true); say(`checked, ${r.changed} changed`); }
  else if (cmd === "alias" && a && rest[0]) {
    const like = withNs(rest[0]);
    if (!candidates().some((c) => c.id === like)) { say("unknown like item: " + like); return; }
    state[a] = { ...(state[a] ?? {}), l: like, b: round(safePrice(like)), w: undefined, p: 1, d: state[a]?.d ?? world.getDay() };
    applyOne(a, state[a]); save(); rebuildGroup(); say(`${a} ~ ${like}`);
  } else if (cmd === "name" && a && rest.length) { if (state[a]) { state[a].j = rest.join(" "); save(); rebuildGroup(); say("ok"); } else say("unknown: " + a); }
  else if (cmd === "forget" && a) { delete state[a]; delete PRICING_RECIPES[a]; save(); rebuildGroup(); say("ok"); }
  else if (cmd === "hist") { let h = []; try { h = JSON.parse(world.getDynamicProperty(HIST_KEY) ?? "[]"); } catch (e) {} say(h.slice(-15).join("\n") || "(none)"); }
  else say("usage: list|check|hist|alias <ID> <like>|name <ID> <name>|forget <ID>");
}

export function startExternalItems() {
  system.run(() => {
    try { scanExternal(); verifyExternal(); } catch (e) { console.warn("[BeeMyHoney] ext scan: " + e); }
  });
  system.runInterval(() => { try { scanExternal(); verifyExternal(); } catch (e) { console.warn("[BeeMyHoney] ext check: " + e); } }, 12000);
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:ext" || ev.sourceEntity?.typeId !== "minecraft:player") return;
    try { externalCommand(ev.sourceEntity, ev.message); } catch (e) { console.warn("[BeeMyHoney] bmh:ext: " + e); }
  });
}
