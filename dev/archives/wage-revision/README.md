# wage-revision(賃金改定サブレポジトリ)

メインのレポジトリにはまだ入れない、価格オーバーホール一式の置き場。
`v0.4.2` の配布版(未改造)に**上から重ねる**と、そのまま賃金改定+統一プライシングが入る形にしてある。

## 中身
- パックのルートと同じ相対パス(`scripts/...`, `CHANGELOG.md`)で、変更・追加したファイルだけを置いている(価格改定+発行台帳+数量入力+掛率+インフレ+金利・保険・換算+金融政策+HRMHRMの会計+開発銀行機構)。
- git履歴で差分を追える:
  1. `baseline` … 0.4.2 配布版そのまま(変更対象ファイルのみ)
  2. `wip` … 賃金改定(`labor-data.js`)+プライシングエンジン第1版
  3. `pricing` … クエスト/モブ/バルク/郵便販売への適用
  4. `ledger` … エメラルド発行台帳
  5. `ui` … 数量入力を入力欄+全額トグルに変更
  6. `price-level` … 掛率64の層(価格・名目額を読む時にベース×掛率)
  7. `inflation` … インフレ指数の自動更新(週0.05%上限)
  8. `rates-insurance-migration` … 金利を政策金利ベースに/保険の支給額を引き上げ/既存ワールドの金額換算
  9. `policy` … 金融政策のパラメータ(呼び出し口)/カード・プライム・配当の見直し
  10. `hrmhrm` … 口座テンプレート + HRMHRMの会計と自動運用(貴金属の時価評価・週次の締め・介入の判定)
  11. `dev-bank` … 開発銀行機構(独立機関。申請の審査 = 売れる資産があれば却下して売却 / なければ最低限の運用資金を支給)。法人が派生できる共通の運用に整理(最新)
  - 例: `git diff HEAD~2 HEAD -- scripts/data/mail-order-data.js`

## 適用手順(0.4.2配布版に重ねる)
```
cd <0.4.2 を展開したフォルダ>          # manifest.json がある場所
cp -r <dev>/wage-revision/scripts/. scripts/
cp <dev>/wage-revision/CHANGELOG.md CHANGELOG.md
node <dev>/check_pricing.mjs scripts   # → OK が出ること
node <dev>/check_ledger.mjs scripts    # → OK が出ること(台帳の恒等式・直接書き込みの検出)
node <dev>/check_quantity_prompt.mjs scripts  # → OK が出ること(数量入力)
node <dev>/check_price_level.mjs scripts      # → OK が出ること(掛率が価格・名目額に効いている)
node <dev>/check_inflation.mjs scripts        # → OK が出ること(インフレ指数の自動更新)
node <dev>/check_migration.mjs scripts        # → OK が出ること(既存ワールドの換算・金利・保険)
node <dev>/check_policy.mjs scripts           # → OK が出ること(金融政策のパラメータ)
node <dev>/check_hrmhrm.mjs scripts           # → OK が出ること(HRMHRMの会計・自動運用・介入のルール)
node <dev>/check_devbank.mjs scripts          # → OK が出ること(開発銀行機構の審査)
node <dev>/check_startup.mjs scripts          # → OK が出ること(起動。早期実行の制約とimportのリンク)
node <dev>/check_undefined.js scripts  # → giveItemJob と onBack の誤検出2件のみ
```
(`manifest.json` のバージョンは未変更。リリース時に上げること)

## 関連ドキュメント
- 方式: `dev/pricing-guide.md` / 適用結果・未決事項: `dev/pricing-settings.md`
- 次の構想(インフレ・台帳・破産): `dev/sketch/sketch-inflation-economy.md`

## 実機で確認する時
`dev/real-device-checklist.md` を参照(法人テンプレートの前に1回通す想定)。

## 既存ワールドに入れる時
- プレイヤーの初回ログイン時に、保存済みの金額が掛率(64)で1回だけ換算される(`economy/migration.js`)。ワールドごとに旧/新を自動判定する。
- 換算前にワールドのバックアップを取っておくこと(換算は元に戻す機能なし)。
- その日のクエスト掲示板に旧金額が残っていれば、その日だけ報酬が低い(翌日の掲示から新金額)。
