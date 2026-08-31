# はじめての方へ（かんたん版）

このフォルダは、**AI（Claude Code / Codex / GitHub Copilot）と一緒に開発するための「ひな形」**です。
新しいアプリを作るときに、このフォルダをコピーして使います。中身にアプリの機能は入っていません。

詳しい説明は [`README.md`](README.md) にあります。ここでは最初の 3 ステップだけを案内します。

## これは何をしてくれるもの？

3 つの AI ツールは、それぞれ別の場所に「指示書」を置く決まりになっています。
そのままだと同じルールを 3 回書くことになり、片方だけ古くなります。

このひな形では、**ルールを 1 か所（`AGENTS.md`）にまとめ、各 AI の指示書からはそこを読ませるだけ**にしてあります。
だから、ルールを直すときは 1 か所だけ直せば済みます。

同じ考え方で、次の 2 つも 1 か所にまとめてあります。

- **作業手順**（例:「TODO を更新して」と頼んだときの進め方）→ `docs/skills/` の中
- **AI に実行を許すコマンド / 禁止するコマンド** → `docs/agent_permissions.md`

## 使いはじめる 3 ステップ

### 1. コピーする

このフォルダをまるごと、新しい場所へコピーします（`.git` フォルダは持っていきません）。

### 2. 名前とスタックを書き換える

[`AGENTS.md`](AGENTS.md) の冒頭にある `<PROJECT_NAME>` などの `< >` で囲まれた部分を、これから作るアプリの内容に書き換えます。
どこを直すかの一覧は [`README.md`](README.md) の「新規プロジェクトへのコピー方法」にあります。

### 3. 動くことを確かめる

```bash
pnpm install && pnpm lint && pnpm typecheck && pnpm test
```

サンプルのテストが 4 件通れば準備完了です。サンプル（`src/example/`）は消してかまいません。

## よく使うコマンド

```
pnpm install        # 必要な部品をそろえる
pnpm lint           # 書き方のチェック
pnpm typecheck      # 型のチェック
pnpm test           # テストの実行
```

## 困ったときは

| 知りたいこと | 見る場所 |
|---|---|
| このひな形の全体像・各 AI での使い方 | [`README.md`](README.md) |
| Git の使い方（変更を反映する手順） | [`docs/development/gitの操作ルール.md`](docs/development/gitの操作ルール.md) |
| AI に何を許可しているか | [`docs/agent_permissions.md`](docs/agent_permissions.md) |
| いま何が残っているか | [`docs/todo/TODO.md`](docs/todo/TODO.md) |
