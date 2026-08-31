# 家族 de TODO！ — エージェント向け方針（正本）

家族間で日常のちょっとしたToDo（買い物・ゴミ出し・提出物確認・予約など）を共有・管理するスマートフォン向けPWA。
Next.js（Frontend）と Express（Backend・REST API）を分離し、Cloudflare D1 にデータを保存する。認証は Googleログイン、通知は Web Push。

本ファイルは Claude Code / Codex / GitHub Copilot すべてが読む**正本**。詳細は各サブディレクトリの AGENTS.md・`DESIGN.md`・`REVIEW.md` に委譲し、ここは薄く保つ。

> **本文中の `@パス` は参照先を示すだけで、自動読み込みはされない。** 必要になった時点でエージェントが自分で開くこと。
> したがって、**開かなくても必ず守らせたいルールは、リンクに委譲せずこのファイルの本文へ直接書く**（下記「最小規約」の禁止コマンド一覧がその例）。

**エージェントは常にトークン消費を意識すること。** 必要な作業を正確に終えるため、読む量・調べる量・出力する量を必要最小限にする。最初から大量の情報を読むのではなく、概要を確認してから必要な箇所だけを追加で確認する。成功している処理の詳細を繰り返し確認せず、失敗・差分・判断が必要な箇所に集中する。

具体的には、以下を避ける。

- ドキュメントやコードの不要な全文読み込み、対象範囲を絞らない広すぎる探索、全履歴・全差分の確認。ドキュメントはまずディレクトリの `README.md`（索引）か見出し検索で該当箇所を特定し、そのうえで必要な節だけを開く。20KBを超えるファイルは、最初から全文を読まない。読む前に `rg -n "^#{1,3} " <file>` で見出しを確認し、読む範囲を判断する。
- コマンド出力の不要な全文確認。まず終了コード・件数・警告・失敗箇所を確認し、成功した処理の詳細ログ、長い一覧、差分全文は必要な場合だけ読む。
- 同じ目的の確認やテストの不要な個別実行。可能な範囲でまとめて実行し、失敗したものだけを個別に調査・再実行する。
- 必要性の薄いサブエージェント起動や、過剰な並列調査。
- 作業対象と関係のない変更、ファイル、ログの確認や変更。既存の変更がある場合は対象外として区別する。
- ユーザーの承認後に、新たな権限・安全確認・要件判断が不要であるにもかかわらず作業を止めること。
- エージェントによるチャット上の回答・報告が冗長になること。結論・重要な判断・失敗・次に必要な承認に絞り、不要な説明の繰り返しや過剰な要約を避ける。

ただし、安全確認、仕様上の曖昧さ、失敗原因の切り分け、変更内容の最終確認に必要な調査は省略しない。

## トップレベル構成

> 実際のディレクトリを増やしたら、この表にも 1 行足すこと。表に無いディレクトリはエージェントから見えていないのと同じ。

| ディレクトリ | 説明 |
| --- | --- |
| `src/` | アプリ本体。規約は `@src/AGENTS.md` |
| `e2e/` | ブラウザ操作の自動テスト（Playwright）。`@docs/skills/playwright-evidence-test.md` |
| `docs/` | 設計・計画ドキュメント。作業手順（スキル）の正本は `docs/skills/`、開発フローは `docs/development/gitの操作ルール.md`、残タスク一式は `docs/todo/`（本編 `TODO.md` + 補足 `notes/` + 履歴 `history/`）。設計書は機能ごとに分割し、各ディレクトリの `README.md` が索引 |
| `.github/` | Copilot 指示（`copilot-instructions.md`）+ Copilot プロンプト（`prompts/`）+ Copilot カスタムエージェント（`agents/<name>.agent.md`）+ CI ワークフロー（`workflows/ci.yml`） |
| `.agents/` | Codex が読むリポジトリ内スキル（`skills/<name>/SKILL.md`。サブエージェントの入口も兼ねる） |
| `.codex/` | Codex CLI のプロジェクト設定（`config.toml`。サンドボックス / 承認ポリシー）+ 権限ルール（`rules/*.rules`） |
| `.claude/` | Claude Code が読むスキル（`skills/<name>/SKILL.md`）+ サブエージェント（`agents/<name>.md`）+ 権限設定（`settings.json`） |
| `.vscode/` | 推奨拡張機能 + Copilot の権限設定（`settings.json`） |
| `prisma/` | （Prisma を採用する場合）スキーマ・マイグレーション・seed。規約は `@prisma/AGENTS.md`。使わないならフォルダごと削除する |

## ポイント

- **技術スタック**: 言語 = TypeScript / Node.js（`.nvmrc` のバージョン）、パッケージマネージャ = pnpm、テスト = Vitest（単体）+ Playwright（画面）。フロントエンド = Next.js（PWA）、バックエンド = Express（REST API）、DB = Cloudflare D1。
- **アーキテクチャ**: 依存方向は `app → modules → shared` の一方向のみ。詳細 → `@src/AGENTS.md`
- **CI は GitHub Actions**（lint / format / typecheck / test）。デプロイ先は Cloudflare（Frontend/Backendの具体構成は基本設計で確定。現時点ではBackendはCloudflare Workers上でExpressを動かす方式が第一候補）。
- **ローカル開発の起動方法**: 未定（コード未着手。基本設計・開発環境構築時に確定する）。
- **認証**: Googleログイン（OAuth）のみ。アプリ独自パスワードは持たない。権限はグループ内一律（家族グループ削除のみ作成者限定の例外）。

## 最小規約

- ブランチ: `main` 保護 + feature ブランチ → PR。PR は**機能（モジュール）単位**で分割する。
- **例外**: `*.md` / `docs/` 配下だけの変更は CI（`paths-ignore`）が起動しないため、`main` へ直接 push してよい。コードが 1 ファイルでも混ざる場合は PR に戻す。
- CI を意図的に飛ばして push する場合（コードを含む場合も可）は `@docs/skills/push-skip-ci.md` に従う。**エージェントは実行前に必ずユーザーの承認を取り、得るまでコミットも push もしない。**
- コミット / PR のレビュー観点は `REVIEW.md`、UI / デザインは `DESIGN.md`、テスト作成は `TESTING.md` に従う。
- コミット/PR には「何を・なぜ・どう検証したか」を記載する。
- **コードにはコメントを書く。** 関数・コンポーネント・エクスポートする定数は、定義の直前に「何をするものか」を必ず書く。関数の中でも、意図が読み取りにくい分岐・条件・値には理由を添える。書き方は次の 2 点を守る。
  - **1 文目で端的に何をするかを書き、2 文目以降で詳細や「何のために」を補う。** 例: `// リクエストで渡された検索条件を使いやすく変換する。` → `// 文字列のまま渡ってくるので、数値に変換する・値が入っていない項目には初期値を入れる、等を行う。`
  - **専門用語やカタカナ語に頼らず、平易な日本語で書く。** 「フォールバック」「ファサード」「楽観ロック」等はそのまま使わず、実際の動作を説明する言葉へ置き換える（例: 「代わりに分類一覧の一番先頭を選択状態にする」）。
- **エージェントが確認なしで実行してよいコマンドと、単独で実行してはならない操作は `@docs/agent_permissions.md` が正本。** `.env` の読み取り、`git push --force` / `git reset --hard`、およびデータベースを作り直すコマンド（`pnpm db:reset` / `prisma migrate reset` 等）は設定ファイルでも禁止しているが、強制には穴があるため**規約としても実行しない**。
- `docs/todo/TODO.md` と `README.md` / `README_SIMPLE.md` の更新は、`@docs/skills/update-todo.md` の手順に従う。
- **ドキュメントを分割・移動したら、参照元のリンクを必ず張り替える。** 移動先が 1 階層深くなる場合は本文中の相対リンク（`../`）も繰り上げる。作業後にリポジトリ全体の `.md` を走査してリンク切れが無いことを確認する。

## 主要コマンド

> `package.json` の `scripts` を増やしたら、この表にも 1 行足す。`docs/agent_permissions.md` と各ツールの権限設定にも反映すること。

```
pnpm install        # 依存パッケージの取得
pnpm lint           # ESLint
pnpm format:check   # Prettier チェック
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest（単体）
pnpm test:watch     # Vitest（監視）
```

フレームワークを導入したら `dev` / `build` / `start` などをここへ追記する。

## 参照

- 開発フロー（ブランチ → PR → CI → マージ）: `@docs/development/gitの操作ルール.md`
- 要件・基本設計・詳細設計: `@docs/specs/README.md`
- UI / デザイン規約: `DESIGN.md`
- コミット / PR レビュー観点: `REVIEW.md`
- テスト方針（単体）: `TESTING.md`
- エージェント権限ポリシー（許可 / 禁止コマンド）: `@docs/agent_permissions.md`
- アーキテクチャ規約: `@src/AGENTS.md`
- DB 規約（Prisma 採用時）: `@prisma/AGENTS.md`
- 図（mermaid）の作成手順: `@docs/diagrams.md`
- スキルの一覧と追加手順: `@docs/skills/README.md`

## スキル（作業手順）

繰り返す作業の手順は `docs/skills/<name>.md` に**正本を 1 つだけ**置き、各ツールの入口はそれを読ませるだけの薄いラッパーにする（`AGENTS.md` ↔ `CLAUDE.md` ↔ `copilot-instructions.md` と同じ方式）。

| ツール | 入口 | 起動方法 |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `/<name>` または説明文による自動起動 |
| GitHub Copilot | `.github/prompts/<name>.prompt.md` | Copilot Chat で `/<name>` |
| Codex | `.agents/skills/<name>/SKILL.md` | 説明文による自動起動 |

手順を変更するときは `docs/skills/<name>.md` だけを編集する。入口ファイルに手順を複製しない。追加手順は `@docs/skills/README.md`。

導入済み: `update-todo` / `push-skip-ci` / `create-unit-test-spec` / `create-vitest-test` / `playwright-evidence-test`

## サブエージェント

試行錯誤のログを本体の会話に残したくない等、独立した実行単位として動かす価値がある作業は、スキルとは別に「サブエージェント」としても用意する。**正本は引き続き `docs/skills/<name>.md`** に置き、二重管理を避ける。ツールごとに実現度合いが異なる点に注意。

| ツール | 入口 | 起動方法 | 分離の実態 |
|---|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | 自動委譲、または `@agent-<name>` / 自然言語での明示指定 | 独立した会話で実行し、要約のみ本体へ返る（真の分離） |
| GitHub Copilot | `.github/agents/<name>.agent.md` | Copilot Chat のエージェント切替ドロップダウンから手動選択 | 会話全体がそのエージェントに切り替わる。要約だけを本体へ返す仕組みは無い |
| Codex | `.agents/skills/<name>/SKILL.md`（既存の「スキル」と同じ入口を流用） | 説明文による自動起動 | 同一セッション内で実行される（真の分離は未対応。Codex にプロジェクト同梱できる独立サブエージェント機構が現状無いため） |

試行錯誤の隔離によるトークン削減効果が確実に得られるのは Claude Code のみ。Copilot / Codex は「役割ごとに指示を切り替えられる」以上の効果は期待しない。

導入済み: `create-vitest-test`（Vitest の単体テスト作成・実行、`docs/skills/create-vitest-test.md`）
