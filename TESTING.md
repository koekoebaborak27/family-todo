# テスト方針 — 単体テスト

本ファイルは**テスト作成時のガイド**。正本は `AGENTS.md`、配置の最低限は `src/AGENTS.md` にもサマリを置く。
採用ツール・設定は `AGENTS.md` の「ポイント」節を参照。画面操作テスト（Playwright）は `docs/skills/playwright-evidence-test.md` が扱い、本ファイルは単体テストのみ扱う。

- 単体: **Vitest**（`pnpm test` = `vitest run` / `pnpm test:watch` = watch）
- 対象パターン: `src/**/*.{test,spec}.{ts,tsx}`（`vitest.config.ts`）
- CI: GitHub Actions（`.github/workflows/ci.yml`）で `pnpm test` が**必須ゲート**（手元のフックはその前倒しであり、CI の二重化ではない）

## 1. 配置 — コロケーション

- テストは**対象ファイルと同階層**に `<name>.test.ts` で置く。`__tests__/` グローバル集約は作らない。
- 理由: feature-modular（縦割り）の凝集を保つ／実装変更時に更新漏れが起きにくい／既存のテストと配置が揃う。

## 2. レイヤーごとの濃淡 — 全部を均一にテストしない

lite-DDD はレイヤーで責務が違う。テストの優先度も変える（これがファイル乱立の抑制にもなる）。

| レイヤー | 要否 | 観点（何を担保するか） | 形式 |
|---|---|---|---|
| `service.ts`（ユースケース） | ★必須・最優先 | 業務ルールの分岐・計算。`repository` はモックし**ロジックだけ**検証。正しい条件で `AppError` が飛ぶか | 単体（依存モック） |
| `validation.ts`（Zod） | ★必須 | 境界値・必須/任意・異常入力の弾き。仕様が凝縮され費用対効果が高い | 純粋単体 |
| 権限判定などの純粋関数 | ★必須 | 入力→出力の網羅 | 純粋単体 |
| `actions.ts`（Server Action） | △要所のみ | 「認可→service呼び出し→結果整形」の**配線**確認。ロジックは service 側で済 | service モック |
| `repository.ts`（DB アクセス） | △原則書かない | 複雑なクエリ・トランザクション境界のみ。単純 CRUD は書かない（ORM を信用） | DB 統合（後述） |
| `ui/` | ✕当面スキップ | E2E に委譲。単体では原則書かない | — |

**観測性との整合**: 業務コードは `try/catch`・ログを書かず `throw new AppError(...)` のみ（`src/AGENTS.md`）。したがって —
- `service` のテストは「条件 → 正常戻り値 or AppError スロー」だけ見ればよい（副作用がなく書きやすい）。
- ログ／エラー整形は入口ラッパー（`shared/observability`）のテストで**一度だけ**担保し、各 action で再テストしない。

**service 向け観点チェックリスト**:
- 正常系: 代表ケース1本
- 業務分岐: if/ロジックの各分岐
- 異常系: どの条件で**どの `AppError`**（code/メッセージまで）が飛ぶか（標準 code は `shared/errors/app-error.ts` の `Errors` ファクトリ＝`NOT_FOUND` / `UNAUTHORIZED` / `FORBIDDEN` / `VALIDATION_ERROR` / `CONFLICT`、それ以外は grep 可能な独自キー）
- 境界値: ロック判定の閾値、ページング境界 等

## 3. ファイル分割 — 「1対象 = 1テストファイル」

- 基本は **実装ファイル1つ = テストファイル1つ**（`service.ts → service.test.ts`）。
- 1ファイル内は `describe` で関数／ユースケース単位にグルーピング（分割と整理を両立）。
- **「見通しのためにテストを1ファイルへ統合」は非推奨**（対応関係が消え、コンフリクトしやすく、行数が膨張）。減らすなら統合ではなく**レイヤー選別**で。
- 関数ごとに刻みすぎ（`createUser.test.ts` 等）も不要。粒度は実装ファイルに合わせる。

```ts
describe("user/service", () => {
  describe("createUser", () => {
    it("正常に作成できる", () => { /* ... */ })
    it("重複ログインIDは AppError(CONFLICT) を投げる", () => { /* ... */ })
  })
  describe("lockUser", () => { /* ... */ })
})
```

## 4. DB 依存テストの分離（フック化の前提）

テストは性質で2階層に割れる。混在させるとフックや手元実行が破綻する。

- **純粋単体**（`rbac` / `service`(モック) / `validation` / `with-op`）= DB不要・高速 → 手元/フック向き
- **DB統合**（`repository` の複雑クエリ等）= 要 PostgreSQL → 手元で DB 未起動だと必ず失敗

→ DB 依存は `*.int.test.ts` など命名で分離し、**フック・手元の既定は純粋単体のみ**。DB 統合は CI と明示実行（`docker compose ... up -d db` 後）に委ねる。

## 5. フック化の指針

CI に `pnpm test` ゲートが既にある前提で、フックは**手前の速いフィードバック**に限定する。

| 層 | 推奨 | 非推奨 |
|---|---|---|
| Claude Code（`settings.json`） | `Stop` で `vitest related --run`（変更関連のみ） | `PostToolUse`（編集ごと）に全テスト＝途中の壊れ状態でノイズ |
| Git（lefthook/husky） | `pre-push` に `pnpm test` + `pnpm typecheck` | `pre-commit` に全テスト＝重く形骸化 |

- 編集ごとに回すなら、テストより `typecheck`/`lint`（高速・決定的）の方がフック向き。
- 導入順序: **①本方針の確定 → ②DB依存テストの分離（§4）→ ③フック導入**。仕組みを先に重くしない。

## 6. 命名 — テスト一覧がそのまま「仕様書」になるように

**狙い**: 個々の assert を読まなくても、テスト名の一覧を眺めるだけで「**何を・どの条件で・どうなるか**」が網羅・確認できる状態にする。テスト名は実装者向けのラベルではなく、**読み物としての仕様**として書く。

### 6.1 すべて日本語で書く

`describe` / `it` の名前は日本語。技術用語・識別子（関数名・`AppError` の code・型名など）は原文のまま埋め込む（例: `AppError(CONFLICT) を投げる`）。

### 6.2 `describe` を入れ子にして「大項目 → 条件 → 期待」の3階層にする

| 階層 | 役割 | 書き方 | 例 |
|---|---|---|---|
| L1 `describe` | **大項目** = テスト対象と目的 | 対象を示す（`<モジュール>/<関数>`） | `"user/service createUser"` |
| L2 `describe` | **条件・前提** = どんな状況か | 「〜のとき」「〜の場合」「正常系」「異常系」 | `"ログインIDが既に存在するとき"` |
| `it` / `test` | **期待される振る舞い** = どうなるか | 「〜する」「〜を返す」「〜を投げる」「〜になる」 | `"AppError(CONFLICT) を投げ、作成は行わない"` |

- **L1+L2+it を連結して日本語の一文として読める**ように命名する（`createUser は / ログインIDが既に存在するとき / AppError(CONFLICT) を投げる`）。
- 条件が1つしかない単純な関数では L2 を省略してよい（過剰な入れ子を避ける）。逆に条件が多い関数は L2 を厚くする。

### 6.3 ファイル冒頭に「テストの目的（大項目）」をコメントで明示

何を担保するためのテストかを、ファイル先頭に1ブロックで書く（一覧の見出し代わり）。

```ts
/**
 * 対象: user/service createUser
 * 目的: ユーザー新規作成の業務ルール（ログインID重複禁止・初期ロール付与）を担保する
 */
describe("user/service createUser", () => {
  describe("正常系", () => {
    it("未使用のログインIDなら、ユーザーを作成して生成IDを返す", () => { /* ... */ })
    it("初期ロール未指定なら VIEWER を既定で付与する", () => { /* ... */ })
  })

  describe("ログインIDが既に存在するとき", () => {
    it("AppError(CONFLICT) を投げ、作成は行わない", () => { /* ... */ })
  })

  describe("ログインIDが規定の最大長を超えるとき", () => {
    it("AppError(VALIDATION_ERROR) を投げる", () => { /* ... */ })
  })
})
```

このとき `vitest run --reporter=verbose` の出力はそのまま仕様一覧になる:

```
 user/service createUser
   正常系
     ✓ 未使用のログインIDなら、ユーザーを作成して生成IDを返す
     ✓ 初期ロール未指定なら VIEWER を既定で付与する
   ログインIDが既に存在するとき
     ✓ AppError(CONFLICT) を投げ、作成は行わない
   ログインIDが規定の最大長を超えるとき
     ✓ AppError(VALIDATION_ERROR) を投げる
```

### 6.4 全体を俯瞰する手段

- **`pnpm exec vitest list`** … 実行せずに全テスト名を列挙（テスト一覧 = 実装済み仕様の棚卸し）。
- **`pnpm exec vitest run --reporter=verbose`** … 階層ツリー付きで実行結果を表示。
- 「この条件のテストが無い」を一覧で気づけるようにするのが目的。**網羅の抜けはコードでなくこの一覧で確認する**。

### 6.5 アンチパターン

- `it("works")` / `it("test1")` / 関数名そのまま … 何を確認したか読めない。禁止。
- 1つの `it` に複数の関心事を詰める（名前が「〜かつ〜かつ〜」になる）… 条件ごとに `it` を分け、名前を1事実にする。
- 条件（前提）を `it` 名に押し込んで `describe` を使わない … 階層が崩れ、一覧が平坦になる。前提は L2 `describe` へ。

## 7. テストデータ（フィクスチャ／モックデータ）

DBの状態で挙動が変わるテストは、**「検証したいのがロジックか、クエリ自体か」**で与え方を変える。判断はこの一行で決める。

| 検証対象 | DB状態の与え方 | 実DB | データの形 |
|---|---|---|---|
| `service` のロジック分岐（存在/不在/ロック/0件/閾値 等で挙動が変わる） | `repository` のモック戻り値で表現 | **不要** | 型付きファクトリ（DB不使用） |
| `repository` の複雑クエリ（WHERE/JOIN/並び/ページング/トランザクション）が正しい行を返すか | 実DBに行を投入 | **必要**（`*.int.test.ts`、§4） | ORM で投入 → 後始末 |

### 7.1 service 層 — 実DB不要。状態は「モック戻り値」で作る

“DBの状態” は service にとって `repository` の戻り値という**入力**にすぎない。実データを投入せず、モック戻り値で状態を再現する。

- **型付きファクトリ（ビルダー）を用意し、テストごとに変える属性だけ `override`** する。これが「モックデータ」の実体。
- 状態の種類（存在/不在/ロック/失敗回数閾値/0件/複数件）はファクトリ引数で網羅でき、速くて決定的。
- 大半の「データ状態で条件が変わる」ケースはここで賄う。

```ts
// テスト用ファクトリ（必要な差分だけ override）
const makeUser = (o: Partial<User> = {}): User => ({
  USER_ID: 1, LOGIN_ID: "user01", ROLE: "VIEWER",
  LOCKED: false, FAILED_COUNT: 0, ...o,
})

describe("auth/service login", () => {
  describe("アカウントがロック中のとき", () => {
    it("AppError(LOCKED) を投げ、認証は試行しない", async () => {
      repo.findByLoginId.mockResolvedValue(makeUser({ LOCKED: true })) // ← これが“DB状態”
      await expect(login(input)).rejects.toThrow(/* AppError(LOCKED) */)
    })
  })

  describe("ログインIDが存在しないとき", () => {
    it("AppError(UNAUTHORIZED) を投げる", async () => {
      repo.findByLoginId.mockResolvedValue(null) // ← 0件状態
      await expect(login(input)).rejects.toThrow(/* ... */)
    })
  })
})
```

### 7.2 repository 層 — ここだけ実データ（フィクスチャ）が要る

クエリ自体の正しさはモックでは検証できないので、実DBに行を入れて確かめる（`*.int.test.ts`）。**テスト間の独立性**を必ず確保する。

- 各テストの `beforeEach` で対象テーブルを truncate → 必要な行だけ投入、または**トランザクションで包んで毎回ロールバック**（速く漏れにくい）。
- 投入は ORM で行い、**初期データ投入用の seed を流用しない**。seed はアプリ起動用。テストが seed の中身に依存すると壊れやすいので、テスト用データはテスト側で明示的に作る。

### 7.3 原則

- **「DBのモック」ではなく「`repository` 戻り値を組み立てるファクトリ」**を作る。service のデータ依存分岐は実DBなしで網羅する。
- 実DB＋フィクスチャは `repository` の複雑クエリ検証に限定する（§4）。
- ファクトリは過剰共有しない。モジュール内で使うものはそのテスト近くに置き、複数モジュールで再利用するものだけテスト用ヘルパに切り出す。
