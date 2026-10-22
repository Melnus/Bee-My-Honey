// ==========================================
// 村・会社・村人の名前の日英対応 / Bilingual names
// ------------------------------------------
// 名前は生成した時に日本語と英語の両方を決めて保存し、表示の時にプレイヤーの言語のほうを見せる。
//   村     … core.name(日本語) / core.nameEn / core.headName / core.headNameEn
//   会社   … core.name(入力した名前) / core.nameEn(任意の英語名)。英語名がなければ、どちらの言語でも name を見せる
//   村人   … identity.name(日本語) / identity.nameEn
// 古いデータ(英語名を持たない村・村人)は、日本語名から対応する英語名を引く(下の表の組み合わせで作った名前だけ。引けなければ、決まった規則で選ぶ)。
// ==========================================

// 村名 = A + B。日本語は連結、英語は "A B"
export const VILLAGE_A = [
  ["ひだまり", "Sunny"], ["みどり", "Green"], ["あさひ", "Dawn"], ["せせらぎ", "Brook"], ["こもれび", "Dapple"], ["つきみ", "Moon"], ["はなぞの", "Bloom"]
];
export const VILLAGE_B = [
  ["の里", "Hamlet"], ["村", "Village"], ["ヶ丘", "Hill"], ["の森", "Woods"], ["の郷", "Haven"]
];
export const HEADS = [
  ["ロンド", "Rondo"], ["ミナ", "Mina"], ["ハンス", "Hans"], ["ユキ", "Yuki"], ["ベル", "Belle"],
  ["トマス", "Thomas"], ["ノア", "Noah"], ["サラ", "Sarah"], ["ガルド", "Gard"], ["リタ", "Rita"]
];
// 村人(オーナーズクラブの履歴書)。英語は日本語と同じ順
export const VILLAGER_NAMES = [
  ["太郎", "Tom"], ["花子", "Hannah"], ["次郎", "Jack"], ["咲", "Emma"], ["健太", "Kenny"], ["美咲", "Mia"], ["亮", "Ray"], ["陽菜", "Lily"],
  ["翔太", "Sean"], ["大輔", "Dan"], ["さくら", "Rose"], ["拓海", "Theo"], ["蓮", "Ren"], ["葵", "Ivy"], ["颯太", "Sam"], ["結衣", "Yuna"],
  ["悠人", "Luke"], ["凛", "Rin"], ["直樹", "Nick"], ["愛", "Amy"]
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hasNonAscii = (s) => /[^\x00-\x7f]/.test(String(s ?? ""));
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };

// 新しい村の名前(日英)
export function pickVillageName() {
  const a = pick(VILLAGE_A), b = pick(VILLAGE_B);
  return { ja: a[0] + b[0], en: `${a[1]} ${b[1]}` };
}
export function pickHeadName() { const h = pick(HEADS); return { ja: h[0], en: h[1] }; }
export function pickVillagerName() { const n = pick(VILLAGER_NAMES); return { ja: n[0], en: n[1] }; }

// 日本語名 → 英語名(古いデータ用)
export function villageNameEnFromJa(ja) {
  for (const a of VILLAGE_A) for (const b of VILLAGE_B) if (ja === a[0] + b[0]) return `${a[1]} ${b[1]}`;
  return ja;
}
export function headNameEnFromJa(ja) { return HEADS.find((h) => h[0] === ja)?.[1] ?? ja; }
export function villagerNameEnFromJa(ja) {
  const hit = VILLAGER_NAMES.find((n) => n[0] === ja);
  if (hit) return hit[1];
  return hasNonAscii(ja) ? VILLAGER_NAMES[hash(ja) % VILLAGER_NAMES.length][1] : ja;
}

// 表示用。lang は "ja" / "en"
export function coreName(core, lang) {
  if (!core) return "";
  if (lang !== "en") return core.name;
  if (core.nameEn) return core.nameEn;
  return core.kind === "village" ? villageNameEnFromJa(core.name) : core.name;
}
export function headName(core, lang) {
  if (!core) return "";
  if (lang !== "en") return core.headName;
  if (core.headNameEn) return core.headNameEn;
  return core.kind === "village" ? headNameEnFromJa(core.headName) : core.headName;
}
export function employeeName(employee, lang) {
  const id = employee?.identity ?? {};
  if (id.tag !== "villager") return id.name ?? ""; // プレイヤー本人の履歴書はプレイヤー名のまま
  if (lang !== "en") return id.name ?? "";
  return id.nameEn ?? villagerNameEnFromJa(id.name);
}
// 発注元の名前を {ja, en} で(クエストの題名など、言語を後で決める所に保存する用)
export function coreNamePair(core) { return { ja: coreName(core, "ja"), en: coreName(core, "en") }; }
