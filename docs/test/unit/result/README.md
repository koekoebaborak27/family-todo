# docs/test/unit/result/ — テスト実施エビデンス

`playwright-evidence-test` スキル（正本: [`docs/skills/playwright-evidence-test.md`](../../../skills/playwright-evidence-test.md)）が保存するスクリーンショット・DB 状態・実行結果を置く。

```
result/
└─ <ドメイン>/
   └─ テスト結果<仕様書のファイル名（拡張子なし）>/
      ├─ 001_<画面や操作の説明>.png
      ├─ db_before_<テーブル名>.csv
      ├─ db_after_<テーブル名>.csv
      └─ result.md
```

**このディレクトリの中身は `.gitignore` で除外している**（画像と DB ダンプでリポジトリが重くなるため）。
共有が必要なら別のストレージに置き、この README からリンクする。コミットしたい場合は `.gitignore` の該当行を消す。
