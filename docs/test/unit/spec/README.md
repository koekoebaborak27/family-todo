# docs/test/unit/spec/ — 単体テスト仕様書

`create-unit-test-spec` スキル（正本: [`docs/skills/create-unit-test-spec.md`](../../../skills/create-unit-test-spec.md)）が作る Markdown の仕様書を置く。

```
spec/
└─ <ドメイン>/          ← src/modules/<機能> に合わせる
   └─ UT_<番号>_<画面や機能名>.md
```

この仕様書は `playwright-evidence-test` スキルがそのまま読んで画面操作テストを組み立てる。操作手順は**画面に出る言葉**で、期待結果は**実際の文言・値・件数**で書く。
