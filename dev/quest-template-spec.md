# クエストテンプレートの決め打ち(案)

`quest-guide.md`(型の書き方)と、コードの `quest_listing`(`labor.js` の `getTodayQuest` / `completeQuest`)の形を1つに揃える。
2026-10-07 の会話で決まった受注の流れを反映した。**決定済み**と**未決**は末尾に分けてある。

---

## 1. いまの食い違い

| 項目 | コード | quest-guide.md | 揃え方 |
|---|---|---|---|
| 種類 | なし(納品のみ) | `questType` 5種 | `questType` を採用。既存の納品は `delivery`。**実装できる型だけ**に絞る(第3章) |
| 表示文 | `title: {ja,en}` | `name: "文字列"` | `title: {ja,en}`(i18n のため) |
| 条件 | `requirement: {itemId,count}` | 型ごとに中身が変わる | ガイドの形を採用(`delivery` は今と同じ) |
| 受注者 | `claimedBy: {type,id}`(1人固定) | 同左 | `claimedBy` を**配列**にする |
| 状態 | `open / completed` | `open / claimed / completed` | 掲示側は `open / expired` のみ。受注者ごとに状態を持つ |
| 生成 | プレイヤーごと・カテゴリごとに乱数 | — | ワールド共通の日替わり掲示(日付がシード) |

---

## 2. 統一した形

```js
quest_listing = {
  id,                          // "q_<day>_<index>" など。日付と番号で一意
  kind: "quest",
  issuer: { type: "hrmhrm" | "company" | "player", id: null },
  questType: "delivery" | "defeat" | "action" | "score",   // 実装できるものだけ。arrival・protect・所持・クラフトは入れない(下記)
  title: { ja, en },
  requirement: { ... },        // 型ごと(quest-guide.md の第2章のまま)
  reward: { amount, currency: "emerald" },   // 生成時の名目額(ベース×掛率)で確定
  slots: null | number,        // 同時に受注できる人数。null=無制限(HRMHRM発)
  claimedBy: [                 // 受注者の一覧(表示と枠の計算に使う)
    { id, name, state, claimedAt, expiresWeek }
  ],                           // state: "claimed" | "completed"
  createdAt,                   // 掲示した日(world day)
  // HRMHRM生成分のみ
  category, jobKey,            // 求人カテゴリ / 求人テンプレート(履歴書の records 用)
  // プレイヤー発のみ(将来)
  deposit: { amount }          // 発行者が預けた報酬
}
```

**掲示側に `claimed` という状態は持たない。** 枠が埋まっているかは、`slots` と `claimedBy`(`state: "claimed"` の数)から計算する。
- HRMHRM発: `slots: null` なので常に受けられる。`claimedBy` は「誰が受けたか」を見せるためだけに使う。
- プレイヤー発: `claimed` の人数が `slots` に達したら「受注済み」と表示する。1人の枠なら独占、複数なら協力になる。

---

## 3. 型の範囲と日替わりの掲示

**入れる型(スクリプトAPIで判定できるもの)**
| 型 | 判定 | 今回の実装 |
|---|---|---|
| `delivery` | 集荷箱への納品(今の方式) | **する**(既存ロジックをそのまま移す) |
| `defeat` | `entityDie` でモブの種類を数える | 枠だけ(判定は後) |
| `action` | ブロックの破壊・設置の回数(ライセンス制度の `stages` と同じ方式) | 枠だけ(判定は後) |
| `score` | 週次の処理に相乗りして、口座残高や信用スコアのしきい値を確認 | 枠だけ(判定は後) |

**入れない型(判定できる見込みが立つまで)**: `arrival`(到達)、`action` のうち守る(protect)・所持・クラフト。`quest-guide.md` では「未対応」に移した。

**今回の実装範囲は、クエストテンプレート(形・受注・納品・放棄・期限切れ・設定値)と `delivery` だけ。**

**日替わりの掲示**
- 毎日4件を掲示する。**求人カテゴリごとに1件**(資格なし / ネザー / 水中 / エンド)。今は `delivery` だけなので、カテゴリの求人表から1件ずつ選ぶ。資格が要るカテゴリは、ライセンスが無いとロック表示で受注できない。
- 抽選の種は日付(`currentGlobalDay()`)にして、全員同じ掲示にする。今のように呼び出しごとに `Math.random()` を使わない。
- 保存先はワールドの動的プロパティ(`quest_board`)に、日付ごとのJSONで持つ。古い日付のものは次の掲示のときに消す。
- `delivery` の中身(品目・数・賃金)は、今の `UNQUALIFIED_JOBS` / `QUALIFIED_JOBS` から作る。

---

## 4. 受注・納品・放棄

画面の流れ: 掲示板 → 一覧 → 1つ選ぶ → 受注 → **同じクエストをもう一度選ぶ** → 納品 / 放棄

| 操作 | 関数(案) | 動き |
|---|---|---|
| 受注 | `claimQuest(player, questId)` | 枠(`slots`)と同時受注の上限(`quest_max_active`)を確認 → `claimedBy` に追加し、`expiresWeek`(受けた週の終わり)を入れる |
| 納品 | `completeQuest(player, questId, lecternLocation)` | 型ごとの判定(`delivery` は今の集荷箱方式)→ 報酬を支払い、自分の `state` を `completed` にする |
| 放棄 | `releaseQuest(player, questId, "abandon")` | 自分の `claimedBy` の項目を外す。ほかの受注者には影響しない |
| 期限切れ | `releaseQuest(..., "expired")` | `expiresWeek` を過ぎた項目を外す。**一覧を開くときに遅延評価する** |

- 期限切れは、週次の処理で「オンラインの人だけ」を処理する形にしない。ログインしていない人の受注が残り続けて、`claimedBy` に居座るため。`expiresWeek` を保存しておいて、一覧を開いたときに除く。
- 受注中のクエストは、日替わりの4件とは別枠にして、一覧の先頭に固定表示する(掲示が翌日に入れ替わっても、同じクエストを選べるようにするため)。
- 同時に受けられる件数は、ハードコードせず政策パラメータ `quest_max_active` にする(初期値2。第6章)。上限を下げても、すでに受けている分は取り消さず、新しい受注だけが止まる。
- 同じプレイヤーが、同じクエストを2回受けることはできない(`completed` が残っている間は不可)。
- 納品は**個人ごと**(それぞれが指定数を納める)。複数人の合算は、必要になったときに足す。

---

## 5. 報酬と会計

- `reward.amount` は生成時に確定する(今と同じ)。賃金の計算は今の `completeQuest` を引き継ぐ: 総額 × グレード倍率 − 労働コスト。
- **報酬は口座を通して払う。** HRMHRM発は HRMHRM 口座からの支払いにする。会計は、`hrmhrm.js` が台帳(`FLOW.QUEST_WAGE`)から週ごとに締めて「費用」に載せる今の仕組みのまま使える。`account.js` は変更しない。
- **振込元が分かるようにする。** 台帳は理由別の合計しか持たないので、プレイヤー側に入出金の履歴を足す。
  - `creditEmeralds(player, amount, category, { from })` の `from` に払った側(`"HRMHRM"` など)を渡す。
  - 払ったときに「[クエスト] HRMHRM から ○○E が振り込まれました」とメッセージを出す。
  - プレイヤーごとに直近20件ほどの履歴(日付・相手・額・理由)を動的プロパティに持ち、融資管理のような画面で見られるようにする(画面は別作業)。
- プレイヤー発は、発行時に発行者の口座から報酬を預託し、達成時に受注者へ振り込む。発行者からの振込として履歴に残る。放棄・期限切れでは預託は動かず、枠だけが解放される。プレイヤー間の送金は、台帳の発行・回収にはならない扱いが必要(プレイヤー発を入れるときに決める)。

---

## 6. 設定値(政策パラメータ)

同時受注の上限は、金利や開発銀行機構と同じく `policy.js` の `POLICY_PARAMS` に置く。

```js
quest_max_active: {
  unit: "count",
  default: 2, min: 1, max: 10, maxStep: 1, cooldownWeeks: 1,
  label: { ja: "クエスト: 同時に受けられる件数", en: "Quests: max active per player" },
  desc: { ja: "1人が同時に受注できるクエストの数", en: "How many quests one player can have claimed at once" }
}
```
- `fmtParam`(管理コマンドの表示)に `unit === "count"` の分岐を足す。足さないと、百分率で表示されてしまう。
- 読むときは `getPolicyParam("quest_max_active")`。管理コマンド `/scriptevent bmh:policy` で変更できる。
- 受注の判定に使う数字は、今後ここに足していく(例: 受注期限の週数)。

## 7. 移行

- 今の `questStateKey(category)` に保存しているプレイヤーごとの状態は、新形式に変換せず捨てる。日替わりなので、影響は最大1日分。
- 履歴書の `records` / `advancePlayerResume` は、`jobKey` が付いている HRMHRM 生成分の納品で、今までどおり進める。

---

## 8. 決定済み

- 毎日4件を掲示し、受注はクリックで行う。
- HRMHRM発は全員が同じものを受けられる。プレイヤー発は枠(`slots`)を持ち、複数人で受けられる。
- 受注済みのクエストは、もう一度選ぶと納品か放棄を選べる。
- 週をまたいで未達成ならリセット。その前に放棄してもリセット。
- 納品は個人ごと。
- 同時受注の上限は設定値(`quest_max_active`)で、初期値は2。
- 入れる型は実装できるものだけ(`delivery / defeat / action(破壊・設置) / score`)。今回の実装はテンプレートと `delivery` のみ。
- 報酬は口座を通して払い、振込元を履歴とメッセージで分かるようにする。

## 9. 未決

- 入出金の履歴を見る画面をどこに置くか(銀行メニューか、融資管理のような別画面か)。
- `defeat / action / score` の `requirement` の候補表の中身(判定を実装するときに決める)。
- プレイヤー間の送金を、台帳でどう扱うか(プレイヤー発を入れるときに決める)。

---

## 10. 初回の仕事(初めてのアルバイト)

- スタッフサービスを初めて使う人(クエスト・派遣・ライセンスの実績がない人)の一覧の先頭に、固定で1件だけ出す。`quest_listing` ではなく特別扱い(`FIRST_JOB_ID = "q_first"`)。
- 納品物は要らない。使い方の説明を読み、「報告する」でシュルカーボックスを1個もらう。**報酬にEは付けない**。
- 受注せずにその場で完了するので、`quest_max_active` には数えない。履歴書の実績(`records`)にも入れない。
- 「もらい済み」の印はプレイヤーの動的プロパティ `labor_first_job_done`。渡せなかった時は印を付けない。
- 実績がある人には、印がなくても出さない(`hasWorkHistory`)。履歴書を開いただけの人には出す。
- 登録の仕組み(面接→スターターキット)ができたら、シュルカーの配布はそちらへ移し、印を共通にする。
