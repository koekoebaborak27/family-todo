# ローカルD1へのセッション投入によるUI確認

Google OAuthの実クレデンシャルが無い開発環境で、ログイン後の画面をブラウザで確認するための手順。
セッションCookieは`HttpOnly`のためJavaScriptから直接設定できない。使い捨てのローカルHTTPサーバーで`Set-Cookie`を発行させ、ブラウザに載せる。

## 1. テスト用ユーザー・セッションをD1へ投入する

`apps/backend/`で実行する（`wrangler dev`でバックエンドを起動済みであること）。

```bash
node -e "
const bytes = new Uint8Array(32);
require('crypto').webcrypto.getRandomValues(bytes);
console.log(Array.from(bytes, b => b.toString(16).padStart(2,'0')).join(''));
"
# 出力（例: 663d39...）をセッションIDとして以下のSQLで使う
```

```sql
-- seed.sql（例。familyやtodosは必要な画面に応じて増減する）
INSERT INTO users (google_sub, email, display_name, family_id)
VALUES ('dev-ui-review-sub-1', 'ui-review@example.com', 'テスト太郎', NULL);

INSERT INTO notification_settings (user_id, notification_type, enabled, remind_before_value, remind_before_unit)
SELECT id, 'todo_added', 1, NULL, NULL FROM users WHERE google_sub = 'dev-ui-review-sub-1';
-- assignee_set / due_soon(remind_before_value=1,unit='days') / overdue も同様に4種類分INSERTする

INSERT INTO sessions (id, user_id, expires_at)
SELECT '<上で生成したセッションID>', id, '2099-01-01T00:00:00.000Z'
FROM users WHERE google_sub = 'dev-ui-review-sub-1';
```

```bash
pnpm exec wrangler d1 execute family-todo-db --local --file=seed.sql
```

## 2. Cookieをブラウザへ載せる

```js
// set-cookie-server.js（リポジトリの外、使い捨て）
const http = require("http");
const SESSION_ID = "<上のセッションID>";
http.createServer((req, res) => {
  res.writeHead(302, {
    "Set-Cookie": `session_id=${SESSION_ID}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=31536000`,
    Location: "http://localhost:3000",
  });
  res.end();
}).listen(9999);
```

```bash
node set-cookie-server.js &
```

ブラウザで`http://localhost:9999`を1回開く。Cookieは`Domain`未指定（host-only、ただしポートは無視される）なので、`localhost:3000`（Frontend）・`localhost:8787`（Backend）の両方に送られる。

## 3. 片付け

- ヘルパーサーバーを停止する。
- 投入したテストデータを削除する（外部キーの都合で **子→親の順**に削除する。`comments`→`todo_assignees`→`todos`→`families`→`sessions`→`notification_settings`→`users`）。`families`を`users`より先に消さないと`FOREIGN KEY constraint failed`になる。

## iOS Safari向けのUser-Agent判定を確認する場合

`navigator.userAgent`を上書きしたうえで、**クライアント側遷移**（リンククリックやブラウザの戻る/進む）で対象画面へ移動する。フルリロードすると上書きが消える。

```js
Object.defineProperty(navigator, "userAgent", {
  value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  configurable: true,
});
```

## globals.cssの落とし穴（あわせて発見・修正した既存バグ）

`apps/frontend/src/app/globals.css`に`@layer`の**外**で書かれた`* { padding: 0; margin: 0; }`があると、CSSカスケードレイヤーの仕様上、Tailwindの`p-*`/`m-*`ユーティリティ（レイヤー内）より常に優先されてしまい、**全画面で余白指定が効かなくなる**。`getComputedStyle(el).padding`で`0px`になっていないか疑うとすぐ気づける。修正は該当ルールを`@layer base { ... }`で囲むだけ（2026-09-01に発見・修正 → [履歴](../history/2026-09.md#2026-09-01-ui見直しログイン画面の再実装と7画面の確認)）。
