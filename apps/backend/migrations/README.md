# D1 マイグレーション

Cloudflare D1（SQLite互換）のスキーマ変更は、wrangler のマイグレーション機能で管理する（Prisma は不採用）。

```bash
# 追加: 新しいマイグレーションファイルの雛形を作る
pnpm --filter backend exec wrangler d1 migrations create family-todo-db <英語snake_case>

# 適用: ローカルのD1へ反映する
pnpm --filter backend exec wrangler d1 migrations apply family-todo-db --local

# 適用: 実機のD1へ反映する
pnpm --filter backend exec wrangler d1 migrations apply family-todo-db --remote
```

- 生成された `.sql` はコミット前に目視レビューする。
- 適用済み（`main` マージ済み・本番適用済み）のマイグレーションファイルは編集・削除しない。修正は新しいマイグレーションの追加で行う。
- テーブル設計は [`docs/specs/02_basic-design/family-todo/01_データベース.md`](../../../docs/specs/02_basic-design/family-todo/01_データベース.md) を参照。まだ1件もマイグレーションを作成していない（実装フェーズで着手する）。
