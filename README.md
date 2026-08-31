# AI 開発テンプレート（ai-dev-template）

**Claude Code / Codex / GitHub Copilot のどれを使っても、同じ開発方針・ルール・スキルを共有できる**ようにするための、新規プロジェクト用テンプレートです。

業務機能は入っていません。入っているのは「AI と一緒に開発するための土台」だけです。

- **共通ルールの正本は 1 つ**（[`AGENTS.md`](AGENTS.md)）。各 AI の入口ファイルはそこへ委譲するだけ。
- **作業手順（スキル）の正本も 1 つ**（[`docs/skills/`](docs/skills/README.md)）。3 ツール分の入口は「その正本を読め」と書いてあるだけ。
- **権限ポリシー（許可・禁止コマンド）の正本も 1 つ**（[`docs/agent_permissions.md`](docs/agent_permissions.md)）。3 ツールの設定ファイルはその写し。

言語・フレームワークは決め打ちしていません。TypeScript / Node.js（pnpm・Vitest・Playwright・GitHub Actions）で動く最小の土台だけが入っており、その上に好きなフレームワークを載せられます。

## 全体の構造

```
各AI専用の入口        CLAUDE.md / .github/copilot-instructions.md /（Codex は AGENTS.md を直読み）
        ↓
共通ルール            AGENTS.md（正本）+ DESIGN.md / REVIEW.md / TESTING.md / src/AGENTS.md
        ↓
共通スキル            docs/skills/<name>.md（正本）
                        └ 入口: .claude/skills/ · .agents/skills/ · .github/prompts/
        ↓
権限ポリシー          docs/agent_permissions.md（正本）
                        └ 写し: .claude/settings.json · .vscode/settings.json · .codex/rules/
        ↓
プロジェクト固有      docs/specs/（要件・設計）· docs/todo/（残タスク・履歴）
```

## 新規プロジェクトへのコピー方法

1. **新しいプロジェクト用のリポジトリを作り、テンプレートの中身を持ってくる。** GitHub CLI（`gh`）を使う方法・使わない方法の両方を [`docs/development/本テンプレートPJをコピーする方法.md`](docs/development/本テンプレートPJをコピーする方法.md) にまとめてある。
2. 次の 5 か所を書き換える。

| 場所 | 直すこと |
|---|---|
| `AGENTS.md` 冒頭 | `<PROJECT_NAME>` / `<PROJECT_SUMMARY>` |
| `AGENTS.md`「ポイント」 | 技術スタック（`<FRONTEND>` / `<BACKEND>` / `<DATABASE>` / `<DEPLOY_TARGET>`）・起動方法 |
| `package.json` | `name`、そのプロジェクトで使う依存とスクリプト |
| `docs/todo/TODO.md` | `<PROJECT_NAME>` と最初のタスク |
| `LICENSE` | 著作権者名（公開しないなら削除してよい） |

3. 使わないものを削除する。**削除したら `AGENTS.md` の構成表・`REVIEW.md` §3 の該当行も消す。**

| 使わない場合                   | 消すもの                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| 画面を持たない（CLI / API / バッチ） | `DESIGN.md`、`e2e/`、`playwright.config.ts`、`docs/skills/playwright-evidence-test.md` と 3 つの入口 |
| DB を使わない                 | `prisma/`、`docs/prisma_operations.md`                                                        |
| Prisma 以外の DB アクセスを使う    | `prisma/AGENTS.md` を選んだ仕組みの規約へ書き換える                                                          |

4. `src/example/` を消して、自分のコードを書き始める。
5. `pnpm install` → `pnpm lint && pnpm typecheck && pnpm test` が通ることを確認する。
6. 変更をコミットして push する（1 の手順で新しいリポジトリと `git remote` はすでに用意できている）。

```bash
pnpm install && pnpm lint && pnpm typecheck && pnpm test
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

## どこに何を書くか

| 書きたいこと | 書く場所 |
|---|---|
| 3 ツール共通のルール・方針 | [`AGENTS.md`](AGENTS.md)（**正本**） |
| そのツールでしか意味がない補足 | `CLAUDE.md` / `.github/copilot-instructions.md` の「〜固有」節 |
| UI / デザイン規約 | [`DESIGN.md`](DESIGN.md) |
| コミット / PR のレビュー観点 | [`REVIEW.md`](REVIEW.md) |
| テストの書き方 | [`TESTING.md`](TESTING.md) |
| `src/` の構造・依存方向 | [`src/AGENTS.md`](src/AGENTS.md) |
| 許可・禁止コマンド | [`docs/agent_permissions.md`](docs/agent_permissions.md)（**正本**。3 つの設定ファイルへ写す） |
| 繰り返す作業の手順 | [`docs/skills/<name>.md`](docs/skills/README.md)（**正本**。入口 3 つは薄いまま） |
| 要件・設計 | [`docs/specs/`](docs/specs/README.md) |
| 残タスク・履歴 | [`docs/todo/`](docs/todo/TODO.md) |

**同じルールを 2 か所に書かないこと。** 迷ったら `AGENTS.md` に書き、他からはリンクします。

## スキルを追加する

手順は [`docs/skills/README.md`](docs/skills/README.md)「新しいスキルを追加する手順」にあります。要点は 2 つだけです。

1. 手順の正本は `docs/skills/<name>.md` に **1 つだけ**置く。
2. 3 ツールの入口（`.claude/skills/` / `.agents/skills/` / `.github/prompts/`）は、その正本を読ませる 3〜5 行にとどめる。

## 同梱しているスキル

| スキル | 何をするか |
|---|---|
| `update-todo` | `docs/todo/TODO.md` を最新化し、影響があれば README も直す |
| `push-skip-ci` | CI を起動させずに push する（実行前に必ずユーザーの承認を取る） |
| `create-unit-test-spec` | 単体テスト仕様書を Markdown で作る |
| `create-vitest-test` | Vitest の単体テストを書き、`pnpm test` が通るまで直す |
| `playwright-evidence-test` | 仕様書どおりに画面を操作し、スクリーンショットと DB 状態をエビデンスとして残す |

## よく使うコマンド

```
pnpm install        # 依存パッケージの取得
pnpm lint           # ESLint
pnpm format:check   # Prettier チェック
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest（単体）
pnpm test:e2e       # Playwright（画面操作）
```

## ライセンス

MIT（[`LICENSE`](LICENSE)）。コピーして自由に使ってください。
