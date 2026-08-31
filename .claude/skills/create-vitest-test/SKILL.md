---
name: create-vitest-test
description: 指定された実装ファイルに対してVitestの単体テスト(*.test.ts、DB統合が必要なら*.int.test.ts)を作成し、pnpm testが通るまで直す。TESTING.mdの方針(コロケーション・レイヤーごとの濃淡・DB依存分離・命名規約・テストデータの作り方)に従う。「〇〇のVitestテストを書いて」と頼まれたときに使う。
---

リポジトリの [`docs/skills/create-vitest-test.md`](../../../docs/skills/create-vitest-test.md) を読み、そこに書かれた手順に従って作業してください。

手順の正本はそのファイルのみです。**このファイルに手順を複製しないでください。**

なお、試行錯誤の過程を本体の会話に残したくない場合は、サブエージェント `.claude/agents/create-vitest-test.md` を使ってください（同じ手順書を読みます）。
