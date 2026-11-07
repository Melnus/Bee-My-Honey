# 引き継ぎメモ(0.7.x のセッション向け。2026-11-06)

## 最初にやること
1. `CONVENTIONS.md` → `KNOWLEDGE.md` → `MILESTONES.md` の順に読む。
2. 作者から渡される `Bee-My-Honey-0610.zip`(配布パック)と `dev.zip` を、隣り合うフォルダに展開する(`<作業>/Bee-My-Honey-0610/` と `<作業>/dev/`)。
3. パックのルートで `node ../dev/check/run-all.mjs` を実行して、全部通ることを確認してから着手する(28本)。

## 作業の流れ(毎回)
- 作者との会話は日本語。コードの文言は `scripts/i18n/strings.js` に ja/en で追加する(CONVENTIONS §1)。
- **`manifest.json` には触らない。** 版の更新は作者が行う。パックの名前・版は、作者が渡した manifest が基準。
- 実装 → `run-all.mjs` → CHANGELOG.md(英語。先頭に版の項を足し、`Latest release` を更新) → readme.md / readme_jp.md の版の行 → `dev/real-device-checklist.md`(実機で確認する手順を節で足す) → `dev/MILESTONES.md`(到達点を更新)。
- スケッチ(`dev/sketch/`)は、実装したら削除する。仕様が固まったものは `dev/spec/` に移す。
- 配布: パックのフォルダ名を `Bee-My-Honey-<版>` に付け替えて zip にし、`dev.zip`(dev/ 全体)と一緒に渡す。manifest が作者のものと同一か、zip を開いて確かめる。
- 実機でしか分からない API は、実機の確認手順を添えて渡す(CONVENTIONS §6)。シミュレータのスタブは、公式の型定義の意味に合わせる(0.6.6 の `getBlocks` の件が教訓)。

## 0.6.10 の時点の主な仕組み(0.7.x で会社を発展させるときの足場)
- 経済の核: 口座(`economy/ledger.js`・`core-registry.js` の core)、取引所(`economy/exchange.js`。出品・入荷・相場・7日履歴)、HRMHRM(`hrmhrm.js`。週次の締め・仕入れ)、NPC会社(`npc-company.js`)、開発銀行・ローン。
- 村: `village-demand.js`(入荷の枠・週の締め・特産・村同士の取引)、`village-jobs.js`(職業検知と手工業)、`village-events.js`(運んでよ・緊急調達)、`village-barter.js`、`ui/village-menu.js`、`data/village-regions.js`(6種の地域)、`economy/calendar.js`(女王歴・記念日)。
- 方針値は `economy/policy.js` の `getPolicyParam`(設定名は `village_*` など)。
- 会社: 登記と解散(法人テンプレート)・口座・導入クエストの最終ステップが「会社を建てる」。0.7.x はここから発展させる。
- 品目の鍵: 通常は `minecraft:x`、外部アドオンは `ns:x`、種類つきは `ID#種類`(本・ポーション)。

## 注意(実機で効いた事実)
`KNOWLEDGE.md` の §11〜§15 にまとめた(`getBlocks` の個数の数え方、Bedrock の英雄エフェクトID `village_hero`、全角スペースが□になること、保存してから渡す順序、manifest の版)。
