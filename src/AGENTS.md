# src/ — アーキテクチャ規約

正本は `@AGENTS.md`。ここは `src/` 配下の構造ルールのみ。
**採用しない項目は削除してよい。** ただし削除するときは `AGENTS.md` の「ポイント」節と `REVIEW.md` §3 の対応する行も併せて直す。

## フィーチャーモジュラー（DDD-lite）

- 機能（境界づけられたコンテキスト）ごとに `src/modules/<機能>/` に**縦割り**で完結させる。1機能=1フォルダ=レビュー単位。
- **依存方向は一方向**: `app/ → modules/ → shared/`（逆流・横流れ禁止）。
- `modules/A` は `modules/B` の内部を直接 import しない。**`modules/B/index.ts` の公開 API のみ**使う。
- `app/`（画面やエンドポイントの入口）は**薄いアダプタ**。データを取得して module を呼び、描画・応答するだけ。ロジックを持たせない。
- 認証ガード / 権限判定は入口の 1 か所に集約する。判定そのものは純粋関数（例: `modules/auth/route-guard.ts` の `decideRedirect`）に置き、入口はリクエストとの入出力変換に徹する（フレームワークの型抜きで分岐を網羅テストするため）。

## モジュール標準ファイル

`ui/*.tsx`（画面）/ `actions.ts`（入口の処理）/ `service.ts`（ユースケース）/ `repository.ts`（DB I/O）/ `validation.ts`（入力検証）/ `types.ts` / `index.ts`（公開API）。

- CRUD 機能は上記でフラットに。**複雑な機能のみ** `domain/ application/ infrastructure/ jobs/` に層化する（過剰設計を避ける）。

## 厳守事項

- **DB アクセスは `repository.ts` と `shared/db` 以外から触らない**。
- DB・シークレット等サーバ専用コードは、クライアントへ混入しない仕組みを入れる（例: Next.js なら `server-only` を import する）。
- **観測性（ログ）**: 入口は `shared/observability` のラッパー（画面操作用・API 用・ジョブ用）でくるむ。業務コードに `try/catch` やログは**書かない**。エラーは `throw new AppError(code, httpStatus, userMessage, context)` するだけ（ログは境界が1回だけ出す）。生成は `shared/errors/app-error.ts` の `Errors` ファクトリを使う。`code` は grep 可能なキー文字列で、標準コードは `Errors.*`（`NOT_FOUND` / `UNAUTHORIZED` / `FORBIDDEN` / `VALIDATION_ERROR` / `CONFLICT`）、それ以外は独自キーを足してよい。
- 一覧 UI の規約は `DESIGN.md`「一覧（テーブル）」を正本とする。
- **テスト**は対象ファイル隣にコロケーション（`<name>.test.ts`、`__tests__/` は原則作らない）。レイヤー選別・観点・分割方針の詳細は `TESTING.md`。

## フレームワーク固有（採用する場合のみ）

- **Next.js**: ミドルウェアは `src/proxy.ts`（Next.js 16 で `middleware.ts` から改名・Node ランタイム）。**middleware から Server Action の POST をリダイレクトしない**（リダイレクトすると POST が転送先へ再送され、誘導先との間で往復し続ける）。ログイン済みユーザーの誘導は画面遷移（GET）でのみ行い、認可はメソッドを問わず適用する。サーバ専用コードには `server-only` を付ける（ただしワーカー等 Next.js の外から読まれるモジュールには付けない）。
