// ==========================================
// 労働市場データ定義 / Labor Market Data
// (HRMHRM Partners HLD)
// ==========================================

// ---- スタッフサービス：資格なし（オーバーワールド全般） ----
export const UNQUALIFIED_JOBS = [
  {
    key: "farm_help",
    name: { ja: "農家の手伝い", en: "Farm Helper" },
    itemId: "minecraft:wheat",
    countMin: 8,
    countMax: 16,
    wageMin: 4,
    wageMax: 10
  },
  {
    key: "bee_part_time",
    name: { ja: "養蜂のバイト", en: "Beekeeping Part-timer" },
    itemId: "minecraft:honeycomb",
    countMin: 4,
    countMax: 10,
    wageMin: 4,
    wageMax: 10
  },
  {
    key: "mining",
    name: { ja: "採掘", en: "Mining" },
    itemId: "minecraft:cobblestone",
    countMin: 32,
    countMax: 64,
    wageMin: 5,
    wageMax: 12
  },
  {
    key: "escort",
    name: { ja: "護衛", en: "Escort Duty" },
    itemId: "minecraft:rotten_flesh",
    countMin: 6,
    countMax: 12,
    wageMin: 6,
    wageMax: 14
  }
];

// ---- スタッフサービス：資格あり（ネザー／水中／エンド） ----
export const QUALIFIED_JOBS = {
  nether: {
    name: { ja: "ネザー", en: "Nether" },
    minLicenseLevel: 1,
    jobs: [
      {
        key: "nether_bridge",
        name: { ja: "溶岩に渡す橋の建設", en: "Bridge Construction over Lava" },
        itemId: "minecraft:blackstone",
        countMin: 32,
        countMax: 64,
        wageMin: 150,
        wageMax: 400
      }
    ]
  },
  underwater: {
    name: { ja: "水中", en: "Underwater" },
    minLicenseLevel: 1,
    jobs: [
      {
        key: "ocean_ruins",
        name: { ja: "海底神殿の探索", en: "Ocean Monument Exploration" },
        itemId: "minecraft:prismarine_shard",
        countMin: 16,
        countMax: 32,
        wageMin: 150,
        wageMax: 400
      }
    ]
  },
  end: {
    name: { ja: "エンド", en: "End" },
    minLicenseLevel: 1,
    jobs: [
      {
        key: "end_city_infra",
        name: { ja: "エンド市のインフラ整備", en: "End City Infrastructure" },
        itemId: "minecraft:end_stone",
        countMin: 32,
        countMax: 64,
        wageMin: 150,
        wageMax: 400
      }
    ]
  }
};

// ==========================================
// ライセンス制度（実測進捗方式）
// ------------------------------------------
// 「試験に金を払って運試し」ではなく、実際にその分野の作業(設置/破壊)を
// 行った実績でライセンスレベルが上がる。
// 方針: スモールスタート・スケールアウト。
//   - Lv1(見習い): 1つのチャンク(16x16)の中で対象ブロックをquota個
//     設置/破壊すれば取得(=「チャンクのn分の一の最小プロジェクト」)。
//   - Lv2以降は将来的にプロジェクト規模を広げる(複数チャンクにまたがる、
//     quotaを増やす等)形でスケールアウトできるよう、段階(stages)を配列で
//     持たせてある。現時点ではLv1・Lv2のみ実装。
// ==========================================
export const LICENSES = {
  nether: {
    name: { ja: "ネザー作業許可", en: "Nether Work License" },
    trackAction: "place", // "place" | "break"
    blockType: "minecraft:blackstone",
    dimension: "minecraft:nether",
    biome: "minecraft:nether_wastes", // 溶岩の海が広がる典型的なネザー原野。今回は単一バイオーム限定(スモールスタート)
    stages: [
      { level: 1, quota: 16, label: { ja: "見習い", en: "Trainee" } }, // 1チャンク(256マス)の1/16
      { level: 2, quota: 256, label: { ja: "一人前", en: "Journeyman" } } // 1チャンク分まるごと
    ]
  },
  underwater: {
    name: { ja: "水中作業許可", en: "Underwater Work License" },
    trackAction: "break",
    blockType: "minecraft:prismarine_bricks",
    dimension: null, // ディメンション制限なし
    biome: "minecraft:deep_ocean", // 海底神殿が生成される深海バイオーム。他の深海バリエーション(暖流/寒流等)は今回は対象外
    stages: [
      { level: 1, quota: 16, label: { ja: "見習い", en: "Trainee" } },
      { level: 2, quota: 256, label: { ja: "一人前", en: "Journeyman" } }
    ]
  },
  end: {
    name: { ja: "エンド作業許可", en: "End Work License" },
    trackAction: "place",
    blockType: "minecraft:end_bricks", // Bedrock版の正式ブロックID(Java版の end_stone_bricks とは異なる)
    dimension: "minecraft:the_end",
    biome: "minecraft:the_end", // 中央島のエンドバイオーム。外周諸島(end_highlands等)は今回は対象外
    stages: [
      { level: 1, quota: 16, label: { ja: "見習い", en: "Trainee" } },
      { level: 2, quota: 256, label: { ja: "一人前", en: "Journeyman" } }
    ]
  }
};

// ライセンス自体は賃金を直接上げない(=職務にアクセスできるかどうかの関門)。
// 賃金の上下は引き続き RESUME_TIERS(実績件数によるグレード)で決まる。
export const HRMHRM_ORG_NAME = "HRMHRM Partners HLD";

// ---- クエスト納品物・ライセンス対象ブロックの表示名 ----
// (UNQUALIFIED_JOBS/QUALIFIED_JOBS の itemId、LICENSES の blockType で使われるIDのみ収録)
export const LABOR_ITEM_NAMES = {
  wheat: { ja: "小麦", en: "Wheat" },
  honeycomb: { ja: "ハニカム", en: "Honeycomb" },
  cobblestone: { ja: "丸石", en: "Cobblestone" },
  rotten_flesh: { ja: "腐った肉", en: "Rotten Flesh" },
  blackstone: { ja: "ブラックストーン", en: "Blackstone" },
  prismarine_shard: { ja: "プリズマリンの欠片", en: "Prismarine Shard" },
  end_stone: { ja: "エンドストーン", en: "End Stone" },
  prismarine_bricks: { ja: "プリズマリンレンガ", en: "Prismarine Bricks" },
  end_bricks: { ja: "エンドストーンレンガ", en: "End Stone Bricks" }
};

// ---- ライセンス対象バイオームの表示名 ----
// (LICENSES の biome で使われるIDのみ収録)
export const LABOR_BIOME_NAMES = {
  nether_wastes: { ja: "ネザー原野", en: "Nether Wastes" },
  deep_ocean: { ja: "深海", en: "Deep Ocean" },
  the_end: { ja: "ジ・エンド", en: "The End" }
};

// 人件費(食費・宿代相当)。プレイヤー自身の労働(スタッフサービス)でも、
// 村人の労働(オーナーズクラブの派遣・コンサルタントサービス)でも、
// 「働かせた日数 × 定額」を賃金/マージンから差し引く形で統一して請求する。
export const LABOR_COST_PER_DAY = 2;

// スタッフサービス(プレイヤー自身の労働実績)の履歴書ランク表。
// オーナーズクラブの村人と同じ C/B/A/S グレード表記に統一し、労働市場からは
// 「プレイヤーか村人か」を区別せず同一テンプレートの履歴書として扱えるようにする。
// (区別が必要な箇所は employee.kind タグで判定する)
export const RESUME_TIERS = [
  { minCompleted: 0, grade: "C", level: 1 },
  { minCompleted: 5, grade: "C", level: 2 },
  { minCompleted: 10, grade: "C", level: 3 },
  { minCompleted: 20, grade: "B", level: 1 },
  { minCompleted: 35, grade: "B", level: 2 },
  { minCompleted: 50, grade: "B", level: 3 },
  { minCompleted: 75, grade: "A", level: 1 },
  { minCompleted: 100, grade: "A", level: 2 },
  { minCompleted: 150, grade: "S", level: 1 }
];

export function resolveResumeTier(completedCount) {
  let best = RESUME_TIERS[0];
  for (const tier of RESUME_TIERS) {
    if (completedCount >= tier.minCompleted) best = tier;
  }
  return best;
}

// ---- コンサルタントサービス（村人を借りる） ----
export const CONSULTANT_CONTRACTS = [
  { key: "short", name: { ja: "短期契約（3日）", en: "Short-term (3 days)" }, days: 3, marginMin: 40, marginMax: 90 },
  { key: "medium", name: { ja: "中期契約（7日）", en: "Mid-term (7 days)" }, days: 7, marginMin: 120, marginMax: 260 },
  { key: "long", name: { ja: "長期契約（14日）", en: "Long-term (14 days)" }, days: 14, marginMin: 300, marginMax: 600 }
];
// 紛失時のペナルティ倍率（未消化日数×このレートを違約金として支払う）
export const CONSULTANT_LOSS_PENALTY_PER_DAY = 25;

// ---- オーナーズクラブ（自分の村人を派遣する） ----
export const OWNER_GRADES = [
  { key: "C", weight: 45, wageMultiplier: 1.0 },
  { key: "B", weight: 30, wageMultiplier: 1.4 },
  { key: "A", weight: 18, wageMultiplier: 2.0 },
  { key: "S", weight: 7, wageMultiplier: 3.0 }
];
export const OWNER_BASE_WAGE_PER_DAY = 20; // グレードC・レベル1基準の1日あたり賃金

// グレードキー("C"/"B"/"A"/"S")から倍率を引く共通ヘルパー。
// 村人(オーナーズクラブ)・プレイヤー(スタッフサービス)どちらの履歴書でも同じ表を使う。
export function gradeWageMultiplier(gradeKey) {
  const found = OWNER_GRADES.find((g) => g.key === gradeKey);
  return found ? found.wageMultiplier : 1.0;
}

export const OWNER_NAME_POOL = [
  "太郎", "花子", "次郎", "咲", "健太", "美咲", "亮", "陽菜", "翔太", "大輔",
  "さくら", "拓海", "蓮", "葵", "颯太", "結衣", "悠人", "凛", "直樹", "愛"
];

// 村人登録時に「自己申告」として1〜2個ランダムに付与するフレーバースキル(ゲームには影響しない)
export const VILLAGER_FLAVOR_SKILLS = [
  "力持ち", "早起き", "算盤が得意", "力仕事は任せて", "交渉上手",
  "危機管理◎", "夜目が利く", "体力自慢", "几帳面", "顔が広い"
];

export const MAX_EMPLOYEES = 128;
export const ACCIDENT_SOFT_CAP = 100;
export const BASE_ACCIDENT_CHANCE = 0.03;
export const ACCIDENT_CHANCE_STEP = 0.01; // 100人超え、1人ごとに+1%
export const MAX_ACCIDENT_CHANCE = 0.6;

export function getAccidentChance(employeeCount) {
  if (employeeCount <= ACCIDENT_SOFT_CAP) return BASE_ACCIDENT_CHANCE;
  const over = employeeCount - ACCIDENT_SOFT_CAP;
  return Math.min(MAX_ACCIDENT_CHANCE, BASE_ACCIDENT_CHANCE + over * ACCIDENT_CHANCE_STEP);
}

// OW協会からの補助金（オーナーズクラブ登録時の一時金）
export const OWNERS_CLUB_REGISTRATION_GRANT = 50;
