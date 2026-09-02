# docs/todo/notes/ — 補足メモの索引

**設定値・落とし穴・実測値**を分類ごとに置く。`TODO.md` から本文へリンクし、同じ内容を本編へ書かない。

| ファイル | 内容 |
| --- | --- |
| [`cloudflare-workers-検証.md`](cloudflare-workers-検証.md) | Cloudflare Workers 上での Express / Web Push（VAPID）/ Cron Triggers の技術検証で使ったコマンドと落とし穴 |
| [`wrangler-dev-ローカル起動.md`](wrangler-dev-ローカル起動.md) | `wrangler dev` のローカル起動で詰まった点（ポート衝突・残留プロセスの見分け方と終了手順など） |
| [`ローカルD1へのセッション投入によるUI確認.md`](ローカルD1へのセッション投入によるUI確認.md) | Google OAuth無しでログイン後の画面をブラウザ確認する手順（D1へのテストユーザー/セッション投入・Cookie付与・iOS User-Agent判定の確認方法）。globals.cssの余白ユーティリティが効かなくなる落とし穴も記載 |
| [`cloudflare本番デプロイ.md`](cloudflare本番デプロイ.md) | GitHub ActionsからCloudflareへ自動デプロイする際の本番リソース名・設定値の置き分け（公開設定リポジトリでの注意）と、APIトークンのD1権限漏れ・D1のIDがダミーのままだった件・Windowsでのビルド失敗・`__name`エラー・Google OAuth本番公開の要件などの落とし穴 |

## 書き方

- **そのままコピペできるコマンド付き**で書く。あとで自分が再現できることが目的。
- 節の見出しは `## YYYY-MM-DD <何の話か>`。日付は絶対日付で書く。
- 秘密情報（接続文字列の実値・パスワード・トークン）は書かない。プレースホルダにする。
- 1 ファイルが 20KB を超えたら分類を分ける。
