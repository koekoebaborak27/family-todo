# エージェント権限ポリシー（正本）

Claude Code / Codex / GitHub Copilot が**確認なしで実行してよいコマンド**と**実行してはならない操作**を定める。
ポリシーの正本はこのファイルのみ。各ツールの設定ファイルはこの表を機械可読な形へ写しただけの入口であり、**内容を変えるときはまずこのファイルを直す**。

## 許可（確認なしで実行してよい）

| 分類 | コマンド | 理由 |
|---|---|---|
| 依存 | `pnpm install` | ネットワークアクセスを伴うが、副作用は `node_modules/` に閉じる |
| 検証 | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | 読み取りのみ |
| 検証 | `pnpm test` / `pnpm test:*` | 読み取りのみ（DB を破壊しない） |
| Git（読み取り） | `git status` / `git diff` / `git log` / `git show` / `git branch` | 読み取りのみ |

プロジェクトで追加したコマンドは、この表に 1 行足してから各ツールの設定へ反映する。よく足すもの:

| 分類 | コマンド例 | 備考 |
|---|---|---|
| ビルド | `pnpm build` | フレームワークを導入したら追加する |
| DB（ローカル） | `docker compose -f docker/docker-compose.yml up` / `ps` / `logs` | ローカル開発 DB を Docker で動かす場合。各設定ファイルにコメントで雛形を入れてある |
| DB（生成物のみ） | `pnpm prisma:generate` | Prisma を採用する場合 |

## 禁止（エージェントが単独で実行してはならない）

| 対象 | 理由 |
|---|---|
| `.env` の読み取り | 実クレデンシャルを含む。参照が必要なら `.env.example` を見る |
| `pnpm db:reset*` | 開発 DB を破壊する |
| `prisma migrate reset*` | マイグレーション履歴とデータを破壊する |
| `git push --force*` | リモート履歴を破壊する |
| `git reset --hard*` | 未コミットの変更を破壊する |

上記に加えて、`AGENTS.md` の最小規約どおり **`main` への直接 push はドキュメント（`*.md` / `docs/`）のみ**、CI スキップ push は `docs/skills/push-skip-ci.md` に従いユーザー承認を得ること。

## ツールごとの適用先

| ツール | 設定ファイル | 強制の仕方 |
|---|---|---|
| Claude Code | `.claude/settings.json` | `permissions.allow` / `permissions.deny` でコマンド単位に強制 |
| GitHub Copilot（VS Code Agent モード） | `.vscode/settings.json` の `chat.tools.terminal.autoApprove` | 正規表現ルール。`true` = 自動承認、`false` = 常に手動承認 |
| Codex CLI | `.codex/rules/project.rules`（コマンド単位）+ `.codex/config.toml`（面の制御） | execpolicy の `prefix_rule` で `allow` / `prompt` / `forbidden` をコマンド単位に強制。サンドボックスと承認ポリシーは `config.toml` 側 |

### Codex の execpolicy ルール

`.codex/rules/*.rules` は Codex が起動時に読み込むルールファイル（Starlark 風の構文）。

```python
prefix_rule(pattern=["git", "reset", "--hard"], decision="forbidden")
prefix_rule(pattern=["git", ["status", "diff", "log"]], decision="allow")
```

- `decision` は `"allow"`（確認なしで実行）/ `"prompt"`（常に確認）/ `"forbidden"`（実行拒否）の 3 値。`"deny"` は無効値で構文エラーになる。
- `pattern` はコマンドの**先頭トークン列（前方一致）**。要素にリストを書くと「そのいずれか」を意味する。
- 読み込み先は 2 か所: `<repo>/.codex/rules/*.rules`（プロジェクト）と `~/.codex/rules/*.rules`（ユーザー）。**`.codex/config.toml` と違い、プロジェクトを trusted 承認していなくても読み込まれる。**
- `~/.codex/rules/default.rules` は Codex が「常に許可」を選んだときに自動で追記するファイル。手で編集してもよいが、リポジトリで共有されず Codex 自身が書き換えるため、**チーム共通のポリシーはプロジェクト側の `.codex/rules/` に置く。**
- 構文エラーがあると Codex は起動時に `Error loading rules` で停止する。効いているかは起動可否で確認できる。

### 注意点

- Copilot の `false` ルールは「常に確認を出す」であり、実行の禁止ではない。**確認された人間が拒否することで初めて禁止が成立する。**
- Codex はプロジェクト設定 `.codex/config.toml` を、そのプロジェクトを **trusted** として承認した場合のみ読み込む。初回起動時の信頼確認で承認していないと `sandbox_mode` / `approval_policy` は効かない（`.codex/rules/` は影響を受けない）。
- Codex の `forbidden` には以下の穴があるため、**規約としての遵守は引き続き必要**。
  - 前方一致のため、フラグが後ろに回った形（`git push origin main --force`）は一致しない。
  - リダイレクト（`>`）・変数展開（`$(...)`）・ワイルドカードを含むコマンドはルール評価の対象外になる（Codex の仕様。allow の適用範囲を絞るための挙動）。
  - Windows では `pwsh -Command "<コマンド>"` の形で実行されることがあり、その場合トークン列が一致しない。
  - execpolicy はシェルコマンドのみを見るため、`.env` の読み取り禁止は組み込みのファイル読み取りツール経由では強制できない（ルールは `cat .env` 等のベストエフォート）。
- 3 ツールとも粒度が異なるため完全な等価にはならない。**強制力の弱いツールほど、この文書の禁止リストを規約として守ることが重要になる。**
