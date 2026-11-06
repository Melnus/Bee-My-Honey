import * as mc from "@minecraft/server";
import { listCores } from "./core-registry.js";

// ==========================================
// 女王歴 / Queen's Calendar  (作者の方針 2026-11-06)
// ------------------------------------------
// ワールドの日数(world.getDay)から数える独自の暦。うるう年なし。1か月 = 3週 = 21日、1年 = 12か月 = 252日。HUDには出さず、
// 取引所・電子取引所の画面で確かめる。日数0の日 = 女王歴1年1月1日。
// 記念日(毎年)
//   固定:       3/21 慰労祭(休日がないので作った)/ 5/17 創世記念祭(発売記念日)/ 10/7 収穫祭(YouTubeライブの日)
//   ワールド独自: 戦勝記念日 … 初めて「村の英雄」を得た日付。毎年その日に、村の英雄を、その日いるプレイヤー全員に付ける
//               村民の日   … 村の村人の人数が初めて20人に達した日付
//   記念日の贈り物(固定の3つ・村民の日): 村の画面の「★記念日」から、その年に1人1回受け取れる(中身は仮)。
// 保存: world の動的プロパティ cal_victory / cal_villagers20(記録した日数)、プレイヤーの cal_gift({記念日ID: 受け取った年})/ cal_victory_given(付けた日数)
// ==========================================
export const DAYS_PER_MONTH = 21;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;
export const VILLAGERS_MILESTONE = 20;
const VICTORY_KEY = "cal_victory";
const VILLAGERS_KEY = "cal_villagers20";
const GIFT_KEY = "cal_gift";
const HERO_GIVEN_KEY = "cal_victory_given";
// 統合版(Bedrock)の村の英雄のエフェクトIDは village_hero(Java版の hero_of_the_village ではない)。念のため両方を調べる。
const HERO_EFFECTS = ["village_hero", "hero_of_the_village"];
const HERO_TICKS = 48000;

export function toDate(day) {
  const d = Math.max(0, Math.floor(day));
  const inYear = d % DAYS_PER_YEAR;
  return { year: Math.floor(d / DAYS_PER_YEAR) + 1, month: Math.floor(inYear / DAYS_PER_MONTH) + 1, day: (inYear % DAYS_PER_MONTH) + 1 };
}
export function formatDate(day, lang) {
  const x = toDate(day);
  return lang === "en" ? `Queen's Era ${x.year}, Month ${x.month}, Day ${x.day}` : `女王歴${x.year}年${x.month}月${x.day}日`;
}

// 贈り物の中身(仮。変えるときはこの表だけ)
export const FIXED_FESTIVALS = [
  { id: "rest", month: 3, day: 21, ja: "慰労祭", en: "Rest Festival", gift: [{ id: "minecraft:lapis_lazuli", n: 16 }] },
  { id: "founding", month: 5, day: 17, ja: "創世記念祭", en: "Founding Festival", gift: [{ id: "minecraft:gold_ingot", n: 8 }] },
  { id: "harvest", month: 10, day: 7, ja: "収穫祭", en: "Harvest Festival", gift: [{ id: "minecraft:golden_carrot", n: 16 }] }
];
const WORLD_ANNIVERSARIES = [
  { id: "victory", ja: "戦勝記念日", en: "Victory Day", key: VICTORY_KEY, gift: [] }, // 贈り物の代わりに、村の英雄が付く
  { id: "villagers", ja: "村民の日", en: "Villagers' Day", key: VILLAGERS_KEY, gift: [{ id: "minecraft:bread", n: 16 }] }
];

const readDay = (key) => { const v = mc.world.getDynamicProperty(key); return typeof v === "number" ? v : null; };
export const getVictoryDay = () => readDay(VICTORY_KEY);
export const getVillagersDay = () => readDay(VILLAGERS_KEY);
export function recordVictory(day) { if (readDay(VICTORY_KEY) === null) { mc.world.setDynamicProperty(VICTORY_KEY, day); return true; } return false; }
export function recordVillagers(day) { if (readDay(VILLAGERS_KEY) === null) { mc.world.setDynamicProperty(VILLAGERS_KEY, day); return true; } return false; }

// その日が記念日のもの。ワールド独自の記念日は、記録した日の翌年から(記録した当日は記念日にしない)。
export function anniversariesOn(day) {
  const x = toDate(day);
  const out = [];
  for (const f of FIXED_FESTIVALS) if (f.month === x.month && f.day === x.day) out.push({ ...f, year: x.year });
  for (const a of WORLD_ANNIVERSARIES) {
    const rec = readDay(a.key);
    if (rec === null) continue;
    const r = toDate(rec);
    if (r.month === x.month && r.day === x.day && r.year < x.year) out.push({ ...a, year: x.year, since: r.year });
  }
  return out;
}

// 次の記念日(今日を含まない)。{ id, ja, en, inDays } | null。
export function nextAnniversary(day) {
  for (let i = 1; i <= DAYS_PER_YEAR; i++) {
    const a = anniversariesOn(day + i)[0];
    if (a) return { id: a.id, ja: a.ja, en: a.en, inDays: i };
  }
  return null;
}

// 画面に出す1〜2行(日付・今日の記念日・次の記念日)。
export function calendarLine(lang, day = mc.world.getDay()) {
  const today = anniversariesOn(day);
  let s = formatDate(day, lang);
  if (today.length) s += "  ★" + today.map((a) => (lang === "en" ? a.en : a.ja)).join(" / ");
  else {
    const n = nextAnniversary(day);
    if (n) s += lang === "en" ? `  (next: ${n.en} in ${n.inDays}d)` : `  (次は${n.ja}まであと${n.inDays}日)`;
  }
  return s;
}

// ---- カレンダー画面・管理コマンド用の表示(記録日そのものを出す。祝祭の判定=記録した翌年から、とは別) ----
const monthDay = (d, lang) => (lang === "en" ? `${d.month}/${d.day}` : `${d.month}月${d.day}日`);
// 固定の祭: [{ id, ja, en, month, day, inDays(0=今日) }]
export function fixedFestivalStatus(day = mc.world.getDay()) {
  return FIXED_FESTIVALS.map((f) => {
    let inDays = 0;
    for (; inDays <= DAYS_PER_YEAR; inDays++) { const x = toDate(day + inDays); if (x.month === f.month && x.day === f.day) break; }
    return { id: f.id, ja: f.ja, en: f.en, month: f.month, day: f.day, inDays };
  });
}
// ワールド記念日の登録の状態: "未登録" か "毎年M月D日(N年に登録。記録日: 女王歴…/ 日数 n)"
export function worldRecordLine(kind, lang) {
  const a = WORLD_ANNIVERSARIES.find((x) => x.id === kind);
  const rec = readDay(a.key);
  const name = lang === "en" ? a.en : a.ja;
  if (rec === null) return lang === "en" ? `${name}: not registered` : `${name}: 未登録`;
  const r = toDate(rec);
  return lang === "en"
    ? `${name}: every year on ${monthDay(r, lang)} (registered in year ${r.year}; recorded ${formatDate(rec, lang)} = world day ${rec})`
    : `${name}: 毎年${monthDay(r, lang)}(${r.year}年に登録。記録日: ${formatDate(rec, lang)} = ワールド${rec}日目)`;
}
export function fixedFestivalLines(lang, day = mc.world.getDay()) {
  return fixedFestivalStatus(day).map((f) => {
    const nm = lang === "en" ? f.en : f.ja;
    const when = f.inDays === 0 ? (lang === "en" ? "today!" : "今日です") : (lang === "en" ? `in ${f.inDays}d` : `あと${f.inDays}日`);
    return `・${nm} ${monthDay(f, lang)}: ${when}`;
  });
}
// 管理コマンド bmh:calendar の出力
export function calendarReport(day = mc.world.getDay()) {
  const n = nextAnniversary(day);
  const today = anniversariesOn(day);
  return [
    `[Calendar] today: ${formatDate(day, "en")} / ${formatDate(day, "ja")} (world day ${day})`,
    worldRecordLine("victory", "ja"), worldRecordLine("villagers", "ja"),
    today.length ? "today's anniversary: " + today.map((a) => a.ja).join(", ") : "today's anniversary: none",
    n ? `next anniversary: ${n.ja} (in ${n.inDays} days)` : "next anniversary: none"
  ];
}

// ---- 贈り物(その年に1人1回) ----
function readGifts(player) {
  try { return JSON.parse(player.getDynamicProperty(GIFT_KEY) ?? "{}") ?? {}; } catch (e) { return {}; }
}
export function giftClaimed(player, a) { return readGifts(player)[a.id] === a.year; }
export function giftAvailable(player, a) { return (a.gift?.length ?? 0) > 0 && !giftClaimed(player, a); }
export function markGiftClaimed(player, a) { const g = readGifts(player); g[a.id] = a.year; player.setDynamicProperty(GIFT_KEY, JSON.stringify(g)); }

// ---- 村の英雄(戦勝記念日) ----
function hasHero(player) {
  for (const id of HERO_EFFECTS) { try { if (player.getEffect?.(id)) return true; } catch (e) { /* 未知のIDは無視 */ } }
  return false;
}
function addHero(player) {
  let last;
  for (const id of HERO_EFFECTS) { try { player.addEffect(id, HERO_TICKS, { amplifier: 0, showParticles: true }); return true; } catch (e) { last = e; } }
  console.warn("[BeeMyHoney] hero effect: " + last);
  return false;
}
export function patrolHero(players, day = mc.world.getDay()) {
  let granted = 0;
  const victoryToday = anniversariesOn(day).some((a) => a.id === "victory");
  for (const p of players) {
    if (hasHero(p)) { recordVictory(day); }
    if (victoryToday && p.getDynamicProperty?.(HERO_GIVEN_KEY) !== day) {
      if (addHero(p)) granted++;
      try { p.setDynamicProperty(HERO_GIVEN_KEY, day); } catch (e) {}
    }
  }
  return granted;
}

// ---- 村民の日(村の人数が初めて20人) ----
export function patrolVillagers(day = mc.world.getDay()) {
  if (getVillagersDay() !== null) return false;
  if (listCores("village").some((c) => !c.npc && (c.pop ?? 0) >= VILLAGERS_MILESTONE)) return recordVillagers(day);
  return false;
}

export function startCalendar() {
  mc.system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "bmh:calendar") return;
    try {
      const src = ev.sourceEntity;
      for (const l of calendarReport()) (src && typeof src.sendMessage === "function") ? src.sendMessage(l) : console.warn("[BeeMyHoney] " + l);
    } catch (e) { console.warn("[BeeMyHoney] bmh:calendar: " + e); }
  });
  mc.system.runInterval(() => {
    try { patrolHero(mc.world.getAllPlayers()); } catch (e) { console.warn("[BeeMyHoney] calendar hero: " + e); }
  }, 100);
  mc.system.runInterval(() => {
    try { patrolVillagers(); } catch (e) { console.warn("[BeeMyHoney] calendar villagers: " + e); }
  }, 1200);
}
