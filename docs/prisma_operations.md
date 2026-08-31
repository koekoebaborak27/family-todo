# Prisma マイグレーション運用フロー（prisma_operations.md）

Prisma スキーマ変更〜DB 反映の**運用手順の正本**。スキーマの命名規約は [`prisma/AGENTS.md`](../prisma/AGENTS.md)、本番構成は `docs/specs/99_infra/` を参照。

> **Prisma を採用しない場合はこのファイルを削除する。** 別の仕組みを使う場合も、「スキーマを変える手段はマイグレーションだけ」「本番は適用コマンドのみ」という考え方はそのまま流用できる。

## 環境ごとのコマンド一覧

| 環境 | 使うコマンド | 使ってはいけないコマンド |
|---|---|---|
| ローカル開発 | `pnpm prisma:migrate`（= `prisma migrate dev`）/ `pnpm db:reset` / `pnpm prisma:seed` | `prisma db push`（migrations と乖離するため恒久禁止） |
| CI（GitHub Actions） | `prisma validate` / `prisma migrate deploy`（使い捨て PostgreSQL に対して） | — |
| 本番 | **`prisma migrate deploy` のみ**（ローカルから本番 DATABASE_URL に対して手動実行） | `migrate dev` / `migrate reset` / `db push` / 手動 DDL |

> 原則: **DB スキーマを変える手段は migration ファイルだけ**。どの環境でも psql 等で直接 DDL を流さない（drift の原因）。

---

## 1. 開発時フロー（ローカル）

> **clone 直後の前提**: `pnpm install` だけでは Prisma Client は生成されない。clone 後は最初に一度 `pnpm prisma:generate` を実行する。以降の日常開発では `pnpm prisma:migrate` が generate も行うため、個別に実行する必要はない。

### 1-1. マイグレーションの作り方は 2 パターン（判断表）

マイグレーションは必ず `pnpm prisma:migrate` 経由で作る（フォルダ・SQL の完全手作りは禁止。タイムスタンプ順序と `_prisma_migrations` 管理から外れるため）。その上で、変更内容によって**SQL を自動生成させるか（A）、雛形だけ作って手書きするか（B）**を使い分ける:

| 変更内容（具体例） | パターン | 補足 |
|---|---|---|
| テーブルの追加・削除（`model` + `@@map`） | **A** | |
| カラムの追加（NULL 許容 / `@default` 付き） | **A** | 本番に安全な後方互換変更（§3-2） |
| 通常のインデックス・ユニーク制約（`@@index` / `@@unique` / `@unique`） | **A** | |
| リレーション（FK）の追加・削除 | **A** | |
| `enum` の追加・値の追加 | **A** | |
| カラムの NOT NULL 化・型変更・リネーム | **A + B** | schema.prisma も編集するが、既存データの埋め戻し UPDATE が要るため `--create-only` で生成して SQL に手を入れる（§3-2 expand/contract も参照） |
| 既存データの移行・backfill（`UPDATE` / `INSERT`） | **B** | schema.prisma に対応する記述が存在しない |
| DB 関数（`calc` スキーマの集計関数。`CREATE OR REPLACE FUNCTION`） | **B** | 同上 |
| トリガー / ビュー / マテリアライズドビュー | **B** | 同上 |
| 部分インデックス・式インデックス（`WHERE` 付き / 関数インデックス） | **B** | Prisma スキーマでは表現できない |
| `CHECK` 制約 | **B** | 同上 |
| `CREATE EXTENSION` / `GRANT` 等の DB 設定系 DDL | **B** | 同上 |

> **鉄則**: schema.prisma が管理している対象（テーブル・カラム・通常インデックス）をパターン B の手書き SQL で変更してはいけない。schema.prisma と実 DB が乖離し、次の `pnpm prisma:migrate` で drift 検出されて開発が止まる。逆に、schema.prisma で表現できないオブジェクト（関数・トリガー・ビュー等）は drift 検出の対象外なので、B で安全に管理できる。

### 1-2. パターン A: schema.prisma 編集 → SQL 自動生成（通常はこちら）

```bash
# 0) DB 起動（未起動なら）
docker compose -f docker/docker-compose.yml up -d db

# 1) prisma/schema.prisma を編集（命名規約は prisma/AGENTS.md）

# 2) マイグレーション生成 + ローカル DB へ適用 + クライアント再生成
pnpm prisma:migrate -- --name <変更内容を表す英語スネークケース>
#    例: pnpm prisma:migrate -- --name add_role_to_users
```

- `--name` は**必ず付ける**（対話プロンプト待ちで止まらないため。AI エージェントは特に必須）。

### 1-3. パターン B: `--create-only` で雛形生成 → SQL 手書き

schema.prisma で表現できない変更（§1-1 の表）と、自動生成 SQL に手を入れたい場合（NOT NULL 化前の UPDATE 挿入等）はこちら。

```bash
# 1) （A+B の場合のみ）prisma/schema.prisma を先に編集する。B 単独なら編集不要

# 2) 空（または schema 差分のみ）のマイグレーションを生成する。ローカル DB にはまだ適用されない
pnpm prisma:migrate -- --create-only --name <name>
#    例: pnpm prisma:migrate -- --create-only --name add_calc_royalty_summary_fn

# 3) 生成された prisma/migrations/<timestamp>_<name>/migration.sql に SQL を記述する
#    - DB 関数は CREATE OR REPLACE FUNCTION で書く（再適用に強くする）
#    - データ移行 UPDATE は自動生成 DDL の適切な位置（NOT NULL 化の直前等）に挿入する

# 4) ローカル DB へ適用して動作確認する
pnpm prisma:migrate
```

- `--create-only` で生成したマイグレーションを**ローカル適用（手順 4）した後に SQL を書き換えない**（書き換えたら `pnpm db:reset` で再適用して整合させる）。
- B 単独（schema.prisma 非編集）の場合、`migration.sql` には自動生成の中身が無い。空のまま放置せず、必ず SQL を書いてから適用する。

### 1-4. 生成された SQL のレビュー（必須）

`prisma/migrations/<timestamp>_<name>/migration.sql` を**目視確認してからコミット**する。特に:

- **データ損失の警告**（カラム削除・型変更時に `DROP COLUMN` 等が出る）が意図通りか。
- 既存データがある本番で `NOT NULL` カラムを追加していないか（→ §3-2 の expand/contract）。
- `pgboss` スキーマに触れる SQL が**混入していない**か（pg-boss が自動管理。混入したら手で削る前にスキーマ定義を疑う）。
- パターン A のはずなのに手書き SQL が混ざっていないか（逆に B のはずの変更が schema.prisma 管理対象を触っていないか）。

### 1-5. コミット

- `prisma/schema.prisma` と `prisma/migrations/**` は**必ず同一コミット**に含める（片方だけだと CI の `migrate deploy` / drift 検知が壊れる）。
- マイグレーションを含む PR は、PR 説明に「スキーマ変更あり（リリース時に migrate 必要）」と明記する。

### 1-6. やってはいけないこと（開発時）

| 禁止事項 | 理由 |
|---|---|
| **適用済みマイグレーションの編集・削除**（main にマージ済み、または staging/production 適用済みのもの） | 適用先 DB の `_prisma_migrations` のチェックサムと不一致になり `migrate deploy` が失敗する |
| `prisma db push` | migrations ディレクトリと実 DB が乖離し、以降のマイグレーション生成が壊れる |
| psql 等での直接 DDL | 同上（drift）。検証で直接いじったローカル DB は `pnpm db:reset` で作り直す |
| `migrations/` 配下の SQL をローカル適用後に書き換える | ローカル DB と SQL の内容がズレる。書き換えたら `pnpm db:reset` で再適用して整合させる |

### 1-7. drift・ブランチコンフリクト時のリカバリ

**ローカル DB は使い捨て**が前提。迷ったらリセットでよい（業務データは入っていない）。

```bash
pnpm db:reset    # 全 migration を再適用 + seed 実行（確認プロンプトあり）
```

- `pnpm prisma:migrate` が「drift を検出した」と言う場合 → ローカル DB が migrations と乖離している。リセットする。
- 他ブランチを取り込んで migrations が並んだ場合 → タイムスタンプ順で両方が適用可能か（同一テーブルへの競合変更がないか）を確認し、ローカルはリセットして全適用が通ることを確かめる。
- **マージ済みマイグレーションとの競合は、自分の側のマイグレーションを作り直して解消する**（相手側・適用済みのものは絶対に書き換えない）。

### 1-8. seed

```bash
pnpm prisma:seed   # 初期 ADMIN ユーザ等。冪等に作る（再実行で重複・破壊が起きないこと）
```

seed の投入経路は 2 つある。どちらも同じ `prisma/seed.ts` を実行する。

| 経路 | 実体 | 設定の参照元 |
|---|---|---|
| `pnpm prisma:seed` | `tsx prisma/seed.ts` の直接実行 | なし（設定を経由しない） |
| `prisma db seed` / `pnpm db:reset` の後段 | Prisma CLI が seed コマンドを起動 | `prisma.config.ts` の `migrations.seed` |

### 1-9. Prisma CLI の設定ファイル（`prisma.config.ts`）

`schema` / `migrations.path` / `migrations.seed` はリポジトリ直下の `prisma.config.ts` に集約する（旧来の `package.json#prisma` は非推奨。Prisma 7 で削除される）。

**注意点**: この設定ファイルが存在すると、Prisma CLI は `.env` の自動読み込みを行わなくなる。

```
Prisma config detected, skipping environment variable loading.
```

そのため `prisma.config.ts` の冒頭で `process.loadEnvFile()`（Node 標準。`engines.node >= 22.12.0` 前提）を呼び、`DATABASE_URL` 等を読み込んでいる。`.env` が無い環境（CI / 本番コンテナ）では例外を握りつぶして実 env のみを使う。既に設定済みの環境変数が優先されるため、実行環境側の環境変数を上書きすることはない。

---

## 2. CI（GitHub Actions）

PR / push で [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) が以下を実行する:

1. `prisma validate` — スキーマ構文・整合性チェック
2. `prisma generate` — クライアント生成（typecheck / build の前提）
3. `prisma migrate deploy` — 使い捨て PostgreSQL（`services: postgres`）へ全マイグレーション適用 → **migrations だけで 0 からスキーマを再現できる**ことの検証

ここが落ちる典型例は「schema.prisma だけ変えて migration を作っていない」「適用済み migration を書き換えた」。§1 の規約を守っていれば落ちない。CI はテストのみを行い、デプロイは行わない。

---

## 3. 本番運用

### 3-1. 適用方法

適用コマンドは **`prisma migrate deploy` のみ**。デプロイ前フックを持たない実行環境（コンテナ系のマネージドサービス等）では、**ローカルから本番の DATABASE_URL に対して手動実行**する。

```powershell
$env:DATABASE_URL="<本番 DB の接続文字列>"
pnpm exec prisma migrate deploy
```

- 接続プーラーを挟む構成では、プリペアドステートメントに対応した接続方式を選ぶ（対応していない経路だと `migrate deploy` が通らないことがある）。
- `migrate deploy` は未適用のマイグレーションを**順番に適用するだけ**。生成・drift 検知・reset は行わない（本番に安全）。
- 適用後、疎通確認用のエンドポイントやコマンドで接続を確認する。
- 自動化する場合は、デプロイ後に走らせるジョブやパイプラインのステップとして実行する。

### 3-2. リリースとの順序（後方互換の原則）

ローリング更新中は**旧コードと新スキーマが同時に存在する**。マイグレーションは**後方互換（旧コードが動き続けられる変更）**を基本とする:

- ✅ そのまま可: テーブル追加、NULL 許容カラム追加、デフォルト付きカラム追加、インデックス追加
- ⚠️ 段階実施（expand → contract）: カラム削除 / リネーム / NOT NULL 化 / 型変更
  1. **expand**: 新カラム追加・両対応コードをリリース（旧カラムは残す）
  2. データ移行（migration SQL 内の UPDATE、または one-off スクリプト）
  3. **contract**: 旧カラムへの参照を消したコードをリリース後、**別リリース**で旧カラムを DROP するマイグレーションを適用

後方互換なマイグレーションなら「migrate → release」「release → migrate」どちらの順でもよい。

### 3-3. 本番でやってはいけないこと

- `prisma migrate dev`（= `pnpm prisma:migrate`）/ `prisma migrate reset`（= `pnpm db:reset`）/ `prisma db push` を本番の DATABASE_URL に対して実行する（reset は**全データ削除**）。
- seed の再実行（初回構築時のみ）。
- `_prisma_migrations` テーブルの手動書き換え（失敗時の解消は §3-4 の手順で）。

### 3-4. 失敗時・ロールバック

- **migrate deploy が途中失敗した場合**: PostgreSQL では各 migration がトランザクション適用されるため、失敗した migration は未適用扱いで残る。実行したターミナルの出力で原因を確認し、**修正は新しいマイグレーションを追加する forward fix を基本**とする。失敗状態が `_prisma_migrations` に残って再適用がブロックされる場合のみ `prisma migrate resolve --rolled-back <name>` をローカルから本番 DATABASE_URL に対して一時的に実行してから再 deploy する。
- **アプリのロールバック**: 実行環境のリビジョン管理から直前の正常リビジョンへ戻す。後方互換マイグレーション（§3-2）を守っていれば、スキーマはそのままでコードだけ戻せる。
- **スキーマ自体を戻す必要がある場合**: down マイグレーションは作っていないため、逆操作の新規マイグレーションを書く（forward fix）。それも不可能なデータ破壊時は、DB サービスのバックアップ（Point-in-time Recovery 等）からの復元が最終手段。

---

## 4. 特記事項

- **`pgboss` スキーマ**: pg-boss が起動時に自動作成・自動マイグレーションする。Prisma の管理外であり、`schema.prisma` にも `migrations/` にも含めない。
- **案件固有の業務テーブルの追加**: 1 機能（モジュール）= 1 PR の単位でマイグレーションも分割する。命名規約は `prisma/AGENTS.md` に従う。
