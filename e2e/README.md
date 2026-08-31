# e2e/ — ブラウザ操作の自動テスト

`playwright-evidence-test` スキル（正本: [`docs/skills/playwright-evidence-test.md`](../docs/skills/playwright-evidence-test.md)）が作るテストコードを置く。

```
e2e/
└─ <ドメイン>/                ← docs/test/unit/spec/<ドメイン>/ と揃える
   └─ <スラッグ>.spec.ts
```

- 実行: `pnpm test:e2e`（初回はブラウザ本体の取得が必要: `pnpm exec playwright install`）
- 設定: [`playwright.config.ts`](../playwright.config.ts)。接続先は `E2E_BASE_URL` で上書きできる。
- **本番 URL・本番 DB に対して実行しない。** 判定と停止条件はスキルの「安全確認」に従う。
