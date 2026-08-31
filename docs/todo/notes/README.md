# docs/todo/notes/ — 補足メモの索引

**設定値・落とし穴・実測値**を分類ごとに置く。`TODO.md` から本文へリンクし、同じ内容を本編へ書かない。

| ファイル | 内容 |
| --- | --- |
| [`cloudflare-workers-検証.md`](cloudflare-workers-検証.md) | Cloudflare Workers 上での Express / Web Push（VAPID）/ Cron Triggers の技術検証で使ったコマンドと落とし穴 |

## 書き方

- **そのままコピペできるコマンド付き**で書く。あとで自分が再現できることが目的。
- 節の見出しは `## YYYY-MM-DD <何の話か>`。日付は絶対日付で書く。
- 秘密情報（接続文字列の実値・パスワード・トークン）は書かない。プレースホルダにする。
- 1 ファイルが 20KB を超えたら分類を分ける。
