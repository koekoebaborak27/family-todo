---
name: create-vitest-test
description: 指定された実装ファイルに対してVitestの単体テスト(*.test.ts、DB統合が必要なら*.int.test.ts)を作成し、pnpm testが通るまで直す。TESTING.mdの方針(コロケーション・レイヤーごとの濃淡・DB依存分離・命名規約・テストデータの作り方)に従う。「〇〇のVitestテストを書いて」と頼まれたときや、試行錯誤の過程を本体の会話に残したくないときに使う。
tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
---

リポジトリの [`docs/skills/create-vitest-test.md`](../../docs/skills/create-vitest-test.md) を読み、そこに書かれた手順に従って作業してください。

手順の正本はそのファイルのみです。**このファイルに手順を複製しないでください。**

完了したら、作成・変更したテストファイルのパスと `pnpm test` の実行結果を簡潔に要約して返してください。試行錯誤の過程は返さず、結果だけを報告してください。
