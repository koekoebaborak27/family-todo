<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/frontend/ — アーキテクチャ規約

正本は `@AGENTS.md`。ここは `apps/frontend/` 配下の構造ルールのみ。上のブロックは `next dev` が自動生成するため編集・削除しない（消しても次回起動時に復元される）。

## フィーチャーモジュラー（DDD-lite）

- 機能（境界づけられたコンテキスト）ごとに `src/modules/<機能>/` に**縦割り**で完結させる。1機能=1フォルダ=レビュー単位。
- **依存方向は一方向**: `src/app/ → src/modules/ → src/shared/`（逆流・横流れ禁止）。
- `modules/A` は `modules/B` の内部を直接 import しない。**`modules/B/index.ts` の公開 API のみ**使う。
- `src/app/`（画面の入口）は**薄いアダプタ**。データを取得して module を呼び、描画するだけ。ロジックを持たせない。
- 認証ガード / 権限判定は入口の1か所に集約する。判定そのものは純粋関数に置き、入口はリクエストとの入出力変換に徹する。
- ミドルウェアは `src/proxy.ts`（Next.js 16 で `middleware.ts` から改名・Node ランタイム）。**middleware から Server Action の POST をリダイレクトしない**。ログイン済みユーザーの誘導は画面遷移（GET）でのみ行う。
- サーバ専用コード（Backendの秘密情報を扱うコード等、通常は無い想定）には `server-only` を付ける。

## モジュール標準ファイル

`ui/*.tsx`（画面）/ `actions.ts`（入口の処理）/ `service.ts`（ユースケース）/ `api-client.ts`（Backend REST APIの呼び出し）/ `validation.ts`（入力検証）/ `types.ts` / `index.ts`（公開API）。

- CRUD機能は上記でフラットに。**複雑な機能のみ** `domain/ application/ infrastructure/` に層化する（過剰設計を避ける）。

## UI / デザイン

- Tailwind CSS v4 + Shadcn/UI。規約・トークンの正本は `DESIGN.md`。汎用プリミティブは `src/shared/ui`（`components.json` の `aliases` で設定済み）、機能専用コンポーネントは `src/modules/<機能>/ui/`。
- 新規UI部品は `pnpm dlx shadcn@latest add <name>` で追加する。
- 一覧UIの規約は `DESIGN.md`「一覧（テーブル）」を正本とする。

## 厳守事項

- **観測性（ログ）**: 業務コードに `try/catch` やログは**書かない**。エラーは `throw new AppError(code, httpStatus, userMessage, context)` するだけ。
- **テスト**は対象ファイル隣にコロケーション（`<name>.test.ts`、`__tests__/` は原則作らない）。方針は `TESTING.md`。
- Web Push の購読登録は `public/sw.js`（サービスワーカー）経由で行う。VAPID公開鍵は `NEXT_PUBLIC_VAPID_PUBLIC_KEY` を使う。
