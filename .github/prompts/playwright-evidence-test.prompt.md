---
mode: agent
description: Playwrightで画面操作テストを実行し、スクリーンショットとDB状態をエビデンスとして保存する（DB書き換え・ファイル生成前にユーザーへ確認する）
---

リポジトリの `docs/skills/playwright-evidence-test.md` を読み、そこに書かれた手順に従って
Markdown形式の単体テスト仕様書からテストケースを洗い出し、Playwrightで画面操作を実行してください。

DBの事前・事後状態の保存、スクリーンショットの保存、実行結果Markdownの作成まで行いますが、
Playwrightの未導入・本番DB/本番URLへの接続・DBの書き換え・ファイル生成については、
実行前に必ずユーザーの承認を得てください。パスワードはチャット本文に残さず、環境変数を優先してください。

手順の正本は `docs/skills/playwright-evidence-test.md` のみです。このファイルに手順を複製しないでください。
