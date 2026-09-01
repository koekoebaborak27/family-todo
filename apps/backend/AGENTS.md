# apps/backend/ — アーキテクチャ規約

正本は `@AGENTS.md`。ここは `apps/backend/` 配下の構造ルールのみ。
**採用しない項目は削除してよい。** ただし削除するときは `AGENTS.md` の「ポイント」節と `REVIEW.md` §3 の対応する行も併せて直す。

Express を Cloudflare Workers 上で動かす構成（技術検証: [`docs/todo/notes/cloudflare-workers-検証.md`](../../docs/todo/notes/cloudflare-workers-検証.md)）。D1のスキーマはPrismaではなく wrangler のマイグレーション機能で管理する（手順は [`migrations/README.md`](migrations/README.md)）。

## フィーチャーモジュラー（DDD-lite）

- 機能（境界づけられたコンテキスト）ごとに `src/modules/<機能>/` に**縦割り**で完結させる。1機能=1フォルダ=レビュー単位。
- **依存方向は一方向**: `src/index.ts`（ルーティングの入口） → `modules/` → `shared/`（逆流・横流れ禁止）。
- `modules/A` は `modules/B` の内部を直接 import しない。**`modules/B/index.ts` の公開 API のみ**使う。
- 認証ガード / 権限判定は入口の1か所に集約する（セッション検証: [`docs/specs/03_detail-design/family-todo/30_ログインセッション管理.md`](../../docs/specs/03_detail-design/family-todo/30_ログインセッション管理.md)）。判定そのものは純粋関数に置き、入口はリクエストとの入出力変換に徹する。

## モジュール標準ファイル

`routes.ts`（Expressルーター）/ `service.ts`（ユースケース）/ `repository.ts`（D1 I/O）/ `validation.ts`（入力検証）/ `types.ts` / `index.ts`（公開API）。

- CRUD機能は上記でフラットに。**複雑な機能のみ** `domain/ application/ infrastructure/` に層化する（過剰設計を避ける）。

## 厳守事項

- **D1 アクセスは `repository.ts` と `shared/db` 以外から触らない**。D1バインディングは `cloudflare:workers` の `env` からリクエストごとに読む（技術検証の結果、モジュール読み込み時に固定しない）。
- **観測性（ログ）**: 業務コードに `try/catch` やログは**書かない**。エラーは `throw new AppError(code, httpStatus, userMessage, context)` するだけ（ログは入口が1回だけ出す）。
- **テスト**は対象ファイル隣にコロケーション（`<name>.test.ts`）。方針は `TESTING.md`。
- Web Push の送信は `shared/push/vapid.ts` の `configureWebPush(env)` 経由で行う（VAPID鍵をリクエストごとに設定する）。
