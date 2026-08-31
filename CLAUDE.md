# Project Instructions

共通の指示はすべて AGENTS.md に記載しています。

@AGENTS.md

## Claude Code 固有

- UI / デザイン作業時は `DESIGN.md`、コミット / PR レビュー時は `REVIEW.md`、テスト作成時は `TESTING.md` を参照してください。
- サブディレクトリ作業時は近接の `AGENTS.md`（`src/AGENTS.md` / `prisma/AGENTS.md`）も参照してください。
- スキルは `.claude/skills/<name>/SKILL.md`（`/update-todo` など）。中身は `docs/skills/<name>.md` を読ませる薄い入口であり、手順の正本は `docs/skills/` 側です。
- サブエージェントは `.claude/agents/<name>.md`。こちらも `docs/skills/<name>.md` を読ませる薄い入口です。
- 権限設定は `.claude/settings.json`。ただし**ポリシーの正本は `docs/agent_permissions.md`**（Codex / Copilot と共有）。許可・禁止コマンドを変えるときはまずそちらを直し、`.claude/settings.json` / `.vscode/settings.json` / `.codex/rules/project.rules` の 3 つへ反映してください（`.codex/config.toml` はサンドボックス / 承認ポリシーのみ）。
- （Claude 固有の注意が出たらここに追記）
