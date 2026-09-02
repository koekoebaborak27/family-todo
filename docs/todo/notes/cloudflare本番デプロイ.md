# Cloudflare への本番デプロイ

GitHub Actions から Cloudflare へ自動デプロイする際の設定値と、実際に踏んだ落とし穴。

## 2026-09-02 本番リソースと設定値の置き場所

作成したリソース（値そのものは公開情報のみ記載。秘密の値はプレースホルダ）。

| リソース | 名前 | 備考 |
| --- | --- | --- |
| Worker（Backend） | `family-todo-backend` | https://family-todo-backend.koekoe-app.workers.dev |
| Worker（Frontend） | `family-todo-frontend` | https://family-todo-frontend.koekoe-app.workers.dev |
| D1 | `family-todo-db` | IDは [`apps/backend/wrangler.jsonc`](../../../apps/backend/wrangler.jsonc) に記載 |
| KV | `family-todo-frontend-cache` | 作成済みだが未使用（下記「KV・R2は現状使っていない」参照） |
| R2 | `family-todo-frontend-assets` | 同上 |

設定値は性質ごとに 3 か所へ分けている。**リポジトリが公開設定のため、この使い分けを崩さないこと。**

| 置き場所 | 入れるもの | 例 |
| --- | --- | --- |
| `wrangler.jsonc` の `vars` | 公開されても問題ない値 | GoogleクライアントID・各URL・VAPID公開鍵 |
| ワークフローの `env` | ビルド時にJSへ埋め込まれる値（`NEXT_PUBLIC_` で始まるもの） | Backendの接続先URL |
| GitHub Secrets | 本当に秘密の値 | `CLOUDFLARE_API_TOKEN` / `GOOGLE_CLIENT_SECRET` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `CLOUDFLARE_ACCOUNT_ID` |

`NEXT_PUBLIC_` で始まる値は**ビルド時にJavaScriptへ焼き込まれる**ため、Cloudflare側の環境変数では差し替えられない。デプロイのたびにワークフローの `env` で渡す必要がある。

VAPIDの鍵ペアを作り直す場合のコマンド（秘密鍵は GitHub Secrets にだけ入れる）。

```bash
cd apps/backend
node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"
```

## 2026-09-02 APIトークンにD1の権限が含まれない

Cloudflareの API トークンをテンプレート「Edit Cloudflare Workers」から作ると、Workers・KV・R2 の権限は入るが **D1 が入らない**。この状態で `wrangler d1 migrations apply --remote` を実行すると、原因の分かりにくい次のエラーになる。

```
The given account is not valid or is not authorized to access this service [code: 7403]
```

対処: ダッシュボードの「Manage account」→「Account API tokens」→ 該当トークンを Edit →「Add policy」で **D1 Write** を追加する。トークンの文字列自体は変わらないため、GitHub Secrets の再登録は不要。

## 2026-09-02 D1のdatabase_idがダミー値のままだった

開発中はローカルD1だけを使っていたため、`apps/backend/wrangler.jsonc` の `database_id` が `00000000-...` のまま残っていた。`wrangler deploy --dry-run`（CIの `pnpm build`）は**リモートに問い合わせないため素通りし**、実際の `wrangler deploy` で初めて次のエラーになる。

```
D1 binding 'DB' references database '00000000-0000-0000-0000-000000000000' which was not found.
```

対処: ダッシュボードで本番用D1を作成し、発行されたIDを転記する。マイグレーションはデプロイのたびに GitHub Actions が自動適用する（未適用分のみ実行されるので何度動いても安全）。

## 2026-09-02 Windowsでは opennextjs-cloudflare build が失敗する

ローカル（Windows）で `pnpm --filter frontend exec opennextjs-cloudflare build` を実行すると、シンボリックリンク作成の権限エラーで止まる。

```
Error: EPERM: operation not permitted, symlink '...\node_modules\.pnpm\@next+env@...'
```

OpenNext自身も起動時に「Windowsには完全対応していない（WSL推奨）」と警告する。**GitHub Actions は Ubuntu 上で動くためこの制限を受けない**ので、実デプロイには影響しない。ローカルで確認したい場合は WSL を使う。`next build` 単体（`pnpm --filter frontend run build`）は Windows でも通る。

## 2026-09-02 ブラウザで `__name is not defined` エラーが出る

`next-themes` がHTMLへ埋め込む「表示直後に配色を決めるスクリプト」の中に、ビルドツール（esbuild）が関数名保持のために挿入する `__name` の呼び出しが紛れ込み、ブラウザ側に定義が無いためエラーになる。

対処: `apps/frontend/wrangler.jsonc` に `"keep_names": false` を追加する（wrangler 4.13.0 以降で使える）。参考: [next-themes#370](https://github.com/pacocoursey/next-themes/issues/370)

## 2026-09-02 KV・R2は作成したが現状使っていない

OpenNext が KV・R2 を使うのは **ISR / SSG（あらかじめ生成したページを一定間隔で作り直す仕組み）のキャッシュ置き場としてのみ**。このアプリはその仕組みを使っていないため、`wrangler.jsonc` にバインディングを書いていない。作成済みのリソースは空のまま残しているが、未使用なら課金は発生しない。将来ISRを使うページを追加するときに、[OpenNextのCachingドキュメント](https://opennext.js.org/cloudflare/caching)に従って設定する。

## 2026-09-02 Google OAuth を本番公開するには追加の準備が要る

Google Auth Platform の公開ステータスを「テスト中」から「本番」へ移すには、次の4つが必要（テスト中の間は不要なため、空欄のままでも動く）。

- アプリのホームページURL
- プライバシーポリシーのURL（一般公開）
- 利用規約のURL（一般公開）
- 承認済みドメイン（Google Search Console での所有確認が必要 = 独自ドメインの取得が事実上必要）

テスト中のままでも、テストユーザーとして登録したGoogleアカウント（上限100人）はログインできる。このアプリはGoogleログインを最初の本人確認にしか使わず、その後はアプリ自身のセッションで動くため、テスト中特有の制限（Googleのトークンが短期間で失効する等）の影響を受けない。家族の人数分を登録すれば実用上は足りる。
