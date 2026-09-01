# 家族 de TODO！

家族間で日常のちょっとしたToDo（買い物・ゴミ出し・提出物確認・予約など）を共有・管理するスマートフォン向けPWA。

- **フロントエンド**: Next.js（PWA） — [`apps/frontend/`](apps/frontend/)
- **バックエンド**: Express（Cloudflare Workers 上で実行、REST API） — [`apps/backend/`](apps/backend/)
- **DB**: Cloudflare D1
- **認証**: Googleログイン（OAuth）
- **通知**: Web Push（VAPID）

pnpm workspace のモノレポ構成（`apps/frontend` / `apps/backend` / `packages/shared`）。機能は1画面（ログイン）から実装を始めた段階で、残りの画面は順次実装していく。

このリポジトリは **Claude Code / Codex / GitHub Copilot のどれを使っても、同じ開発方針・ルール・スキルを共有できる**ように作られています。詳しくは「AIエージェントによる開発」を参照。

## 主な機能

要件定義の8画面のうち、実装済みのものだけを載せる。残りは [`docs/todo/TODO.md`](docs/todo/TODO.md)「次にやること」を参照。

| 画面 | ルート | 内容 |
|---|---|---|
| ログイン | `/`（ログイン後の戻り先: `/auth/callback`） | Googleログイン。所属グループの有無で遷移先を振り分ける → [`docs/specs/02_basic-design/family-todo/10_ログイン.md`](docs/specs/02_basic-design/family-todo/10_ログイン.md) |

## セットアップ

### 1. 依存パッケージを取得する

```bash
pnpm install
```

### 2. 環境変数を用意する

| コピー元 | コピー先 | 内容 |
|---|---|---|
| [`apps/backend/.dev.vars.example`](apps/backend/.dev.vars.example) | `apps/backend/.dev.vars` | Google OAuthクライアントシークレット・CORSの許可オリジン・VAPID鍵（Backend用） |
| [`apps/frontend/.env.local.example`](apps/frontend/.env.local.example) | `apps/frontend/.env.local` | Google OAuthクライアントID・VAPID公開鍵（Frontend用） |

Google OAuthクライアントの作り方、VAPID鍵の生成コマンドは [`docs/todo/notes/cloudflare-workers-検証.md`](docs/todo/notes/cloudflare-workers-検証.md) を参照。次の「起動する」自体は値が空でも動くが、ログイン画面を実際に使う（Googleの認可画面まで進む）にはGoogleのクライアントID・シークレットの設定が必要。

### 3. 起動する

別々のターミナルで、それぞれ起動する。

```bash
pnpm dev:backend    # Express on Cloudflare Workers（wrangler dev）。http://localhost:8787
pnpm dev:frontend   # Next.js。http://localhost:3000
```

ローカルの Cloudflare D1 は `wrangler dev` が自動で用意するため、事前準備は不要（実機の D1 を用意する手順は [`apps/backend/migrations/README.md`](apps/backend/migrations/README.md)）。

## よく使うコマンド

```bash
pnpm install         # 依存パッケージの取得
pnpm dev:frontend     # Next.js 開発サーバー
pnpm dev:backend      # wrangler dev（Backend）
pnpm lint             # ESLint
pnpm format:check     # Prettier チェック
pnpm typecheck        # 各ワークスペースの tsc --noEmit
pnpm test             # 各ワークスペースの Vitest（単体）
pnpm build            # 各ワークスペースのビルド確認（next build / wrangler deploy --dry-run）
pnpm test:e2e         # Playwright（画面操作）
```

## 各 AI での使い方

### Claude Code

- 起動すると [`CLAUDE.md`](CLAUDE.md) が読まれ、そこから [`AGENTS.md`](AGENTS.md) が読み込まれます。
- スキルは `/update-todo` のようにスラッシュコマンドで起動するか、説明文に合う依頼をすると自動で起動します。
- サブエージェント（`.claude/agents/`）は「試行錯誤を本体の会話に残さない」用途で使います。`@agent-create-vitest-test` のように指定できます。
- 権限は `.claude/settings.json` の `allow` / `deny` で強制されます。

### Codex

- 専用の入口ファイルはありません。**`AGENTS.md` を直接読みます。**
- スキルは `.agents/skills/<name>/SKILL.md` の説明文に合う依頼をすると起動します。
- 禁止コマンドは `.codex/rules/project.rules`（execpolicy）で強制されます。サンドボックスと承認ポリシーは `.codex/config.toml` ですが、**プロジェクトを trusted として承認していないと読み込まれません**。

### GitHub Copilot（VS Code のエージェントモード）

- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) が自動で読まれ、そこから `AGENTS.md` へ誘導します。
- スキルは Copilot Chat で `/update-todo` のように起動します（`.github/prompts/`。`chat.promptFiles` が有効である必要があります）。
- カスタムエージェントは `.github/agents/`。チャット上部のドロップダウンから選びます。
- ターミナルの自動承認は `.vscode/settings.json` の `chat.tools.terminal.autoApprove`。**`false` は「禁止」ではなく「毎回確認する」**です。

## ドキュメント

| 書いてあること | 書く場所 |
|---|---|
| 3 ツール共通のルール・方針（**正本**） | [`AGENTS.md`](AGENTS.md) |
| そのツールでしか意味がない補足 | `CLAUDE.md` / `.github/copilot-instructions.md` の「〜固有」節 |
| UI / デザイン規約 | [`DESIGN.md`](DESIGN.md) |
| コミット / PR のレビュー観点 | [`REVIEW.md`](REVIEW.md) |
| テストの書き方 | [`TESTING.md`](TESTING.md) |
| Frontend / Backend それぞれの構造・依存方向 | [`apps/frontend/AGENTS.md`](apps/frontend/AGENTS.md) / [`apps/backend/AGENTS.md`](apps/backend/AGENTS.md) |
| 許可・禁止コマンド（**正本**） | [`docs/agent_permissions.md`](docs/agent_permissions.md) |
| 繰り返す作業の手順（**正本**） | [`docs/skills/<name>.md`](docs/skills/README.md) |
| 要件・基本設計・詳細設計 | [`docs/specs/`](docs/specs/README.md) |
| 残タスク・履歴 | [`docs/todo/`](docs/todo/TODO.md) |

**同じルールを 2 か所に書かないこと。** 迷ったら `AGENTS.md` に書き、他からはリンクします。

## 同梱しているスキル

| スキル | 何をするか |
|---|---|
| `update-todo` | `docs/todo/TODO.md` を最新化し、影響があれば README も直す |
| `push-skip-ci` | CI を起動させずに push する（実行前に必ずユーザーの承認を取る） |
| `create-unit-test-spec` | 単体テスト仕様書を Markdown で作る |
| `create-vitest-test` | Vitest の単体テストを書き、`pnpm test` が通るまで直す |
| `playwright-evidence-test` | 仕様書どおりに画面を操作し、スクリーンショットと DB 状態をエビデンスとして残す |

## CI（GitHub Actions）

`.github/workflows/ci.yml` で、PR・`main` への push のたびに次を実行する（`*.md` / `docs/` のみの変更は起動しない）。

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm format:check`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm build`

## 本番デプロイ

未着手。デプロイ先は Cloudflare。Backend は Cloudflare Workers 上で Express を動かす方式で確定（技術検証・環境構築で動作確認済み）。Frontend の具体的なデプロイ方式（Pages / Workers Static Assets 等）は未定。詳細は [`docs/todo/TODO.md`](docs/todo/TODO.md) を参照。

## ライセンス

MIT（[`LICENSE`](LICENSE)）。
