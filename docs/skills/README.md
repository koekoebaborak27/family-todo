# docs/skills/ — スキル（作業手順）の正本

繰り返す作業の手順は、**このディレクトリに正本を 1 つだけ**置く。各 AI ツールの入口ファイルは、その正本を読ませるだけの薄いラッパーであり、**手順を複製しない**。

## 導入済みのスキル

| スキル | 何をするか | 起動例 |
|---|---|---|
| [`update-todo.md`](update-todo.md) | `docs/todo/TODO.md` を最新化し、影響があれば README も直す | `/update-todo` |
| [`push-skip-ci.md`](push-skip-ci.md) | CI を起動させずに push する（承認ゲート付き） | `/push-skip-ci` |
| [`create-unit-test-spec.md`](create-unit-test-spec.md) | 単体テスト仕様書を Markdown で作る | `/create-unit-test-spec` |
| [`create-vitest-test.md`](create-vitest-test.md) | Vitest の単体テストを書いて `pnpm test` が通るまで直す | `/create-vitest-test` |
| [`playwright-evidence-test.md`](playwright-evidence-test.md) | 仕様書どおりに画面を操作し、エビデンスを保存する | `/playwright-evidence-test` |

## 新しいスキルを追加する手順

1. [`_template.md`](_template.md) をコピーして `docs/skills/<name>.md` を作り、手順を書く。
2. 3 ツール分の入口ファイルを作る。**中身は正本を読ませる 3〜5 行だけ**にする。

| ツール | 入口 | 起動方法 |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `/<name>` または説明文による自動起動 |
| GitHub Copilot | `.github/prompts/<name>.prompt.md` | Copilot Chat で `/<name>` |
| Codex | `.agents/skills/<name>/SKILL.md` | 説明文による自動起動 |

3. 入口ファイルの `description`（frontmatter）は、**どんなときに使うかが分かる日本語**で書く。Claude Code と Codex はこの説明文を見て自動起動を判断するため、ここが曖昧だと呼ばれない。
4. `AGENTS.md`「スキル（作業手順）」の「導入済み」行と、この README の表に 1 行足す。

## サブエージェントにもする場合

試行錯誤のログを本体の会話に残したくない作業は、サブエージェントの入口も作る（正本は同じ `docs/skills/<name>.md`）。

| ツール | 入口 | 分離の実態 |
|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | 独立した会話で実行し、要約のみ本体へ返る（真の分離） |
| GitHub Copilot | `.github/agents/<name>.agent.md` | 会話全体がそのエージェントに切り替わる |
| Codex | （スキルと同じ入口を流用） | 同一セッション内で実行される |

## 変更するとき

手順を変えるときは `docs/skills/<name>.md` **だけ**を編集する。入口ファイルは触らない（触る必要が出たら、それは入口に手順が漏れ出しているサイン）。
