# wrangler dev のローカル起動で詰まった点

`pnpm dev:backend`（`wrangler dev`）を使う際の、技術検証には含まれない運用上の落とし穴を置く。

## 目次

- [2026-09-01 ポート8787を古いセッションの残留プロセスが握ったまま離さない](#2026-09-01-ポート8787を古いセッションの残留プロセスが握ったまま離さない)

## 2026-09-01 ポート8787を古いセッションの残留プロセスが握ったまま離さない

**症状**: `pnpm dev:backend` を実行しても `[wrangler:info] Ready on http://127.0.0.1:8788` のように、規約どおりの8787番ではなく8788番で起動する。Frontend（`NEXT_PUBLIC_API_BASE_URL=http://localhost:8787`）から見るとCORSエラー（`No 'Access-Control-Allow-Origin' header`）またはネットワークエラーに見える。

**原因**: 以前のセッションで起動した`wrangler dev`（`node.exe`）が終了されないまま残り、8787番を握り続けている。`workerd.exe`を`taskkill`しても、親の`wrangler dev`（`node.exe`）が生きていると即座に新しい`workerd.exe`を再起動して同じポートを握り直すため、`workerd.exe`だけを狙って終わらせても解決しない。

**確認・対処**（Windows / PowerShellまたはGit Bash）:

```bash
# 1. 8787/8788を握っているPIDを確認する
netstat -ano | grep -E ":8787|:8788"

# 2. そのPIDの実体・起動コマンド・親PIDを確認する（workerd.exeなら親のnode.exeを探す）
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=<PID>' | Select-Object ProcessId,ParentProcessId,CommandLine | Format-List"

# 3. コマンドラインが本リポジトリの `wrangler ... dev` だと確認できたら、子プロセスごと終了する
taskkill //PID <親のnode.exeのPID> //T //F
```

- `workerd.exe`は`wrangler dev`（`cli.js dev`）を起動コマンドに持つ`node.exe`の子プロセスとして立ち上がる。ポートを本当に解放するには子ではなく親を終了する。
- 無関係なプロセスを巻き込まないよう、**PIDを1つずつ特定してから**終了する（`taskkill /IM node.exe /F`のような一括終了はしない）。
- 終了は「別セッションの残留プロセスと確認できたときだけ」行う。ユーザーの別作業のプロセスである可能性があるため、確信が持てない場合は終了前に確認を取る。
