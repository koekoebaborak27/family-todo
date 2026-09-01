# はじめての方へ（かんたん版）

「家族 de TODO！」は、家族間で日常のちょっとしたToDo（買い物・ゴミ出し・提出物確認・予約など）を共有・管理するスマートフォン向けPWAです。

詳しい説明は [`README.md`](README.md) にあります。ここでは最初の3ステップだけを案内します。

## 使いはじめる3ステップ

### 1. 依存パッケージを取得する

```bash
pnpm install
```

### 2. 環境変数を用意する

`apps/backend/.dev.vars.example` → `apps/backend/.dev.vars`、`apps/frontend/.env.local.example` → `apps/frontend/.env.local` にそれぞれコピーする。詳しくは [`README.md`](README.md#セットアップ) の「セットアップ」を参照。

### 3. 起動する

```bash
pnpm dev:backend    # http://localhost:8787
pnpm dev:frontend   # http://localhost:3000
```

## よく使うコマンド

```
pnpm install        # 必要な部品をそろえる
pnpm dev:frontend    # 画面の開発サーバーを起動する
pnpm dev:backend     # APIの開発サーバーを起動する
pnpm lint            # 書き方のチェック
pnpm typecheck       # 型のチェック
pnpm test            # テストの実行
```

## AIエージェントで開発する

このリポジトリは Claude Code / Codex / GitHub Copilot のどれを使っても、同じ開発方針・ルール・スキルを共有できるように作られています。

| 知りたいこと | 見る場所 |
|---|---|
| ルール・方針の正本 | [`AGENTS.md`](AGENTS.md) |
| 各AIでの使い方の詳細 | [`README.md`](README.md#各-ai-での使い方) |

## 困ったときは

| 知りたいこと | 見る場所 |
|---|---|
| このリポジトリの全体像 | [`README.md`](README.md) |
| Git の使い方（変更を反映する手順） | [`docs/development/gitの操作ルール.md`](docs/development/gitの操作ルール.md) |
| AI に何を許可しているか | [`docs/agent_permissions.md`](docs/agent_permissions.md) |
| いま何が残っているか | [`docs/todo/TODO.md`](docs/todo/TODO.md) |
