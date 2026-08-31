# prisma/ — DB 規約

正本は `@AGENTS.md`。ここは Prisma スキーマ／マイグレーションのルールのみ。
**Prisma を採用しない場合は `prisma/` フォルダごと削除し、`AGENTS.md` の構成表と `REVIEW.md` §3 の該当行も消すこと。**

## 命名規約

- Prisma 標準の命名慣習に従う。テーブル名・カラム名ともに `@@map` / `@map` は基本使わず、モデル定義どおりの camelCase をそのままDBに反映させる。
- 既存の物理DB（レガシーシステム）に合わせて物理名を固定する必要がある場合のみ、個別に `@@map` / `@map` を使う。

## マイグレーション運用（MUST）

運用フローの正本は `@docs/prisma_operations.md`。エージェントが守る最小規則:

- **DB スキーマを変える手段は migration ファイルのみ**。`prisma db push` と psql 等での直接 DDL はどの環境でも禁止。
- 開発: `pnpm prisma:migrate -- --name <英語snake_case>`（`--name` 必須。対話プロンプトで止まるため）。本番: `prisma migrate deploy` のみ（ローカルから本番 DATABASE_URL に対して手動実行）。
- **適用済みマイグレーション（main マージ済み・本番適用済み）の編集・削除は禁止**。修正は新しいマイグレーションの追加（forward fix）で行う。
- **schema.prisma 編集 → 自動生成が原則**。schema.prisma で表現できない DDL（DB 関数・トリガー・ビュー・部分インデックス・CHECK 制約・データ移行 UPDATE）のみ `--create-only` で雛形を生成して SQL を手書きする（判断表は `docs/prisma_operations.md` §1-1）。schema.prisma 管理対象（テーブル・カラム・通常インデックス）を手書き SQL で変えるのは禁止（drift になる）。
- 生成された `migration.sql` は**コミット前に目視レビュー**する（データ損失を伴う DDL や、ライブラリが自前で作るスキーマの混入がないこと）。
- `schema.prisma` と `migrations/**` は**同一コミット**に含める。スキーマ変更を含む PR はその旨を説明に明記する。
- **本番は後方互換マイグレーションが基本**。カラム削除・リネーム・NOT NULL 化・型変更は expand → contract の段階実施（`docs/prisma_operations.md` §3-2）。
- ローカル DB は使い捨て。drift やブランチコンフリクト時は `pnpm db:reset` で作り直す。
- ジョブキュー等のライブラリが自前でスキーマを作る場合、それをマイグレーションで作らない（二重管理回避）。
- seed: `pnpm prisma:seed`（初期の管理ユーザなど、アプリ起動に必要な最小限のデータ）。冪等に保つ。本番では初回構築時のみ実行。

## Prisma CLI 設定（`prisma.config.ts`）

- CLI 設定の置き場は**リポジトリ直下の `prisma.config.ts`**（`schema` / `migrations.path` / `migrations.seed`）。旧来の `package.json#prisma` は非推奨で Prisma 7 で削除されるため使わない。
- **この設定ファイルがあると Prisma CLI は `.env` を自動読み込みしない**（`Prisma config detected, skipping environment variable loading.`）。そのため `prisma.config.ts` の中で `process.loadEnvFile()` を呼んで `DATABASE_URL` 等を読み込んでいる。**この行を消すと CLI コマンドが軒並み `Environment variable not found: DATABASE_URL` で落ちる**。
- `migrations.seed` は `prisma db seed` と `prisma migrate reset`（= `pnpm db:reset`）から使われる。`pnpm prisma:seed` は `tsx prisma/seed.ts` の直接実行なのでこの設定を経由しない。
