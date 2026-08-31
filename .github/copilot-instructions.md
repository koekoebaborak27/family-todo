# Copilot Instructions

本プロジェクトの基本方針・規約・落とし穴は、リポジトリの **`AGENTS.md`（正本）** に従ってください。
作業対象に応じて、近接の `src/AGENTS.md`（アーキテクチャ規約）・`prisma/AGENTS.md`（DB 規約。Prisma 採用時のみ）も参照してください。

**このファイルに規約を複製しないでください。** 内容が増えるときは `AGENTS.md` 側へ書き、ここからは委譲するだけにします。

## Copilot 固有

- UI / デザイン規約は `DESIGN.md`、コミット / PR レビュー観点は `REVIEW.md`、テスト方針は `TESTING.md` を参照。
- 定型作業は `.github/prompts/<name>.prompt.md` に用意しています（Copilot Chat で `/update-todo` など）。中身は `docs/skills/<name>.md` を読ませる薄い入口であり、手順の正本は `docs/skills/` 側です。
- カスタムエージェントは `.github/agents/<name>.agent.md`（Copilot Chat のエージェント切替ドロップダウンから選択）。
- **権限ポリシーの正本は `docs/agent_permissions.md`。** ターミナルの自動承認ルールは `.vscode/settings.json` の `chat.tools.terminal.autoApprove` に写してあります（`true` = 確認なしで実行、`false` = 常に手動承認）。設定を変えるときはまず `docs/agent_permissions.md` を直してください。
- 自動承認の `false` は「実行禁止」ではなく「確認を出す」だけです。`.env` の読み取り、`git push --force` / `git reset --hard`、データベースを作り直すコマンドは**確認が出ても提案しない**こと。
- （Copilot 固有の補足が出たらここに追記）
