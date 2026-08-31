# Cloudflare Workers 技術検証（2026-08-31）

基本設計フェーズの技術検証3件（[検証1〜3](../../specs/02_basic-design/README.md#インフラ関連事項の技術検証)）で使ったコマンドと、ハマった点。
検証用コードはリポジトリ外の一時ディレクトリ（`C:\cfv`）に作ったため、このリポジトリには残っていない。再現する場合は下記の手順で作り直す。

## 2026-08-31 事前準備（Windows のローカル実行に必要なもの）

`wrangler dev`（ローカル実行）は `workerd.exe` を直接動かす。このマシンには Visual C++ 再頒布可能パッケージ（x64）が入っておらず、`write EOF` というエラーで起動に失敗した。

```powershell
winget install --id Microsoft.VCRedist.2015+.x64 --exact
```

**落とし穴**: 検証用プロジェクトの置き場所が深すぎると、ローカル D1（SQLite ファイル）の絶対パスが Windows の 260 文字制限を超え、`internal error` になる。プロジェクトはリポジトリ直下（`C:\work\code\kojin_learn\family-todo`、39文字）程度の深さなら問題ないが、OS の一時ディレクトリ配下（`AppData\Local\Temp\...`）は要注意。検証では `C:\cfv` のような短いパスへ作り直して解決した。

## 2026-08-31 検証1: Cloudflare Workers 上で Express を動かす

```bash
mkdir /c/cfv && cd /c/cfv
pnpm init
pnpm add express wrangler
```

`wrangler.jsonc`:

```jsonc
{
  "name": "cf-verify",
  "main": "src/index.js",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    { "binding": "DB", "database_name": "cf-verify-db", "database_id": "<wrangler d1 create の出力を貼る>" }
  ]
}
```

`src/index.js` の骨格（`cloudflare:node` の `httpServerHandler` に Express を載せる）:

```js
import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import express from 'express';

const app = express();
app.use(express.json());
// ...ここに app.get / app.post / express.Router() などを普通に書ける

app.listen(8080);
export default httpServerHandler({ port: 8080 });
```

D1 バインディングは `cloudflare:workers` の `env` からリクエストごとに読めばよい（`env.DB.prepare(...)`）。特別な受け渡しは不要。

```bash
pnpm dlx wrangler d1 create cf-verify-db   # 実機のD1を作る。出力の database_id を wrangler.jsonc へ転記
pnpm dlx wrangler login                     # ブラウザでCloudflareアカウント認証
pnpm dlx wrangler dev --port 8787 --local   # ローカル確認
pnpm dlx wrangler deploy                    # 実機へデプロイ
```

**落とし穴**: `wrangler deploy` 初回は `workers.dev` サブドメインが未登録だと `You need to register a workers.dev subdomain before publishing` という警告が出て、実機URLが繋がらない。ダッシュボードの `Workers & Pages` → サブドメイン設定（`https://dash.cloudflare.com/<アカウントID>/workers/subdomain`）で一度だけ登録する（アカウント単位の設定。あとで変更可）。

## 2026-08-31 検証2: Web Push（VAPID）

```bash
cd /c/cfv
pnpm add web-push
node -e "console.log(require('web-push').generateVAPIDKeys())"   # 検証用の使い捨て鍵ペアを生成
```

秘密鍵は Cloudflare の Secret として登録する（ファイルにもリポジトリにも残さない）。

```powershell
echo <公開鍵> | npx wrangler secret put VAPID_PUBLIC_KEY
echo <秘密鍵> | npx wrangler secret put VAPID_PRIVATE_KEY
echo mailto:<連絡先メールアドレス> | npx wrangler secret put VAPID_SUBJECT
```

Worker側:

```js
import webpush from 'web-push';
// ...
webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
await webpush.sendNotification(subscription, JSON.stringify({ title: '...', body: '...' }));
```

追加コードの書き換えなしにそのまま動いた。ブラウザ側は通常のPush API（`Notification.requestPermission()` → `serviceWorker.register()` → `pushManager.subscribe({ applicationServerKey: ... })`）で購読を作り、購読情報（`PushSubscription`）をサーバーへ送って保存すればよい。

**落とし穴**: エディタツールで生成したHTML/JSに `"\n"`（改行エスケープ）を埋め込もうとしたところ、ツール呼び出しの JSON エスケープと二重になり、実際のファイルには意図せず本物の改行文字が入ってしまい、ブラウザ側で `SyntaxError` になった。バックスラッシュを含む文字列をコード生成する際は `String.fromCharCode(10)` のようにバックスラッシュを使わない書き方に逃がすと安全。

## 2026-08-31 検証3: Cron Triggers の実行間隔

`wrangler.jsonc` に `triggers.crons` を追加し、`scheduled` ハンドラで `event.scheduledTime`（予定時刻）と `Date.now()`（実際の起動時刻）の差を記録した。

```jsonc
"triggers": { "crons": ["* * * * *"] }
```

```js
export default {
  fetch: nodeHandler.fetch,
  async scheduled(event, env, ctx) {
    const delayMs = Date.now() - event.scheduledTime;
    // env.DB へ記録
  },
};
```

1分おきの Cron Triggers を実機で約8分間動かし、6回分を実測。結果は [検証3の結果](../../specs/02_basic-design/README.md#検証3-期限接近と期限超過の通知を送る定期実行の間隔をいくつにするか) を参照。1時間おき等の候補をそれぞれ実測すると数時間かかるため、1分おきで遅延の傾向（ジッター）を確認し、5分・15分・1時間のどの間隔でも同程度に収まると判断する方法を取った。

Workers Free プランの制限（参考）:

- 1日あたりリクエスト数: 100,000 まで
- Cron Triggers: アカウントあたり最大5個まで
- CPU時間: リクエストあたり10ms

いずれの候補間隔（5分・15分・1時間）でも実行回数は無料枠に対して微々たるもの。ただし本実装で「期限が近いTODOを全件検索してPushを複数送る」処理を1回のCronで行う場合、CPU時間10msの上限に注意（無料枠のままで済むかは詳細設計時に確認）。

## 後片付け

検証で作った実機リソースは以下で削除できる。

```bash
cd /c/cfv
npx wrangler delete            # Worker本体（cf-verifyという名前）とVAPIDのSecretを削除
npx wrangler d1 delete cf-verify-db   # D1データベースを削除
```

workers.dev サブドメイン自体（アカウント単位の設定）は削除されず、今後の本番デプロイでもそのまま使える。
