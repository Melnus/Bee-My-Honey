# クエスト追加ガイド(コード知識ゼロでも新規クエストを足せるように)

このファイルは、`quest_listing`テンプレート(#3で合意した5種類の`questType`方式)を前提に、
「新しいクエストを1個追加したいだけなのに、システムの中身を理解しないといけない」状態を避けるための
早見表です。新しいクエストを思いついたら、まずこのファイルの表だけ見て、該当する型にデータを1件足せば
動く、という状態を目指します。

セッションをまたいで実装する際は、`CONVENTIONS.md`・`MILESTONES.md`と合わせて参照してください。

---

## 0. 共通フィールド

どの型でも`quest_listing`は以下の共通フィールドを持ちます。

```
{
  issuer:      { type: "hrmhrm" | "company" | "player", id: null },
  questType:   "delivery" | "defeat" | "arrival" | "action" | "score",
  name:        "プレイヤーに見せる指示文(例:「スケルトンを5体倒して」)",
  requirement: { ... },   // 型ごとに中身が変わる(下記参照)
  reward:      { ... },   // 既存のreward定義をそのまま使う
  price:       0,         // 常に0円固定(購入するものではないため)
  status:      "open" | "claimed" | "completed",
  claimedBy:   { type: "player", id: null }
}
```

**新しいクエストを1個追加するとは、この形のオブジェクトを1件、データファイルに書き足すことです。**
型を選んで`requirement`の中身を埋めるだけで、判定ロジック自体は既存の共通処理が型ごとに解釈します。

---

## 1. 早見表:どの型を選べばいいか

| やりたいこと | 選ぶ型 | 判定方法 |
|---|---|---|
| 特定のアイテムを集めて納品してほしい | **delivery** | コンテナへの納品を検知 |
| 特定のモブを倒してほしい | **defeat** | `entityDie`イベントでカウント |
| 特定の場所(バイオーム/座標)に行ってほしい | **arrival** | プレイヤー位置の巡回チェック |
| ブロックの設置・破壊・クラフトの回数をこなしてほしい | **action** | 実測進捗カウント(ライセンス制度と同じ`stages`方式) |
| 何かを壊されずに守ってほしい(プロテクト) | **action**(逆方向) | 対象ブロックの破壊イベントを検知したら即失敗 |
| 特定のアイテムを名札で名前を付けて持っているか確認したい(所持・チケット型) | **action**(所持サブタイプ) | インベントリ走査、消費せず`nameTag`一致だけ見る |
| 口座残高・信用スコア・取引高など、数値のしきい値に到達してほしい | **score** | 週次ロールオーバーでスナップショットチェック(イベント駆動ではない) |

迷ったら上から順に当てはめて、どれにも当てはまらなければ`action`に入れる、で大体足ります。

---

## 2. 型ごとの`requirement`の書き方

### delivery(納品)
```
requirement: { itemId: "minecraft:cod", count: 20 }
```
- 既存の労働市場のクエストと完全に同じ形式。`itemId`と`count`を書くだけ。

### defeat(討伐)
```
requirement: { mobType: "minecraft:skeleton", count: 5 }
```
- `entityDie`イベントのハンドラで、倒したモブの`typeId`が一致するたびにカウントを進める想定。

### arrival(到達)
```
requirement: { biomeTag: "region:deep_ocean", dimension: "overworld" }
```
- 座標ピンポイントではなく、既存の`region:*`タグ(バイオーム判定)を再利用する想定。
- 特定座標を厳密に使いたい場合のみ`coord: {x, y, z, radius}`を追加。

### action(実測進捗・汎用)
```
// 通常の回数カウント型
requirement: { blockId: "minecraft:copper_ore", actionType: "break", count: 64 }

// プロテクト型(逆方向)
requirement: { blockId: "custom:village_core", actionType: "protect", days: 7 }
// → 対象ブロックが「壊された」イベントを検知した時点で即失敗、
//    daysの間壊されなければ達成

// 所持・チケット型
requirement: { itemId: "minecraft:paper", nameTag: "冒険者ギルド 会員証" }
// → インベントリ走査で itemId + nameTag が一致するものを持っているか確認するだけ。
//    消費しない・手放させない。名前の重複は実害がないので許容でよい。
```
- ライセンス制度(`labor-data.js`の`stages`配列)と同じ実測進捗の仕組みをそのまま流用できる。
- プロテクト型・所持型は独立した新しい型を作らず、`action`の`actionType`違いとして表現する。

### score(しきい値到達)
```
requirement: { metric: "creditScore", threshold: 700 }
requirement: { metric: "emeralds", threshold: 10000 }
requirement: { metric: "freshMarketVolume", genreTag: "genre:seafood", threshold: 500 }
```
- `metric`は既存の数値(信用スコア・口座残高・生鮮市場の取引高など)のキー名を指定するだけ。
- 他の4型と違い、イベントが起きた瞬間ではなく、**既存の週次ロールオーバー処理に相乗りして**
  毎週その時点の値をチェックする(スナップショット方式)。

---

## 3. 新しいクエストを1個追加する手順(実例)

例:「トウヒの原木を32本納品してほしい」というクエストを追加したい場合。

1. 上の早見表で「アイテムを集めて納品」→ **delivery型**と判断
2. `requirement: { itemId: "minecraft:spruce_log", count: 32 }`を書く
3. `reward`欄に渡したい報酬(エメラルド・アイテムなど)を既存のreward定義形式で書く
4. `issuer`・`name`(表示文)を埋めて、データファイルに1件追加する

これだけで、新しい判定ロジックやUIを書く必要はありません。**型を選んでrequirementを埋めるだけ**が、
このガイドで目指している「知識ゼロでも追加できる」状態です。

---

## 4. 新しい"型"自体を増やしたくなったら

上の5種類でカバーしきれない要求が出てきた場合(マルチサーバー運用で実際に出てくるまでは
先回りしすぎない方針)は、このファイルに型を1つ追記する形で拡張してください。
その際も、既存の型(特に`action`)に寄せられないか一度検討するのがおすすめです。
実際、プロテクト型・所持型はどちらも独立した型を作らず`action`に寄せることで解決しています。

---

## 5. まだ決まっていないこと

- `region:*`タグの段階粒度(近い/普通/遠い、何段階にするか)
- 実際のデータファイルの配置場所(`labor-data.js`を拡張するか、`quest-data.js`を新設するか)
