# 繰り返しToDoの期限計算

関連: 基本設計 [`16_ToDo追加・編集.md`](../../02_basic-design/family-todo/16_ToDo追加・編集.md)（保存形式・完了時の動作の概要）、[`01_データベース.md`](../../02_basic-design/family-todo/01_データベース.md)（`todos`テーブル）。

## 前提

- 日付・曜日の判定は**JST（UTC+9）で行う**（対象が日本国内の家族利用のみのため）。`due_at`はISO 8601（UTC）で保存されているため、計算前にJSTへ変換し、計算後にUTCへ戻して保存する。
- `due_has_time = false`（時刻未指定）のToDoは、その日の`00:00 JST`をUTCに変換した値を`due_at`に保存する（例: JSTの`2026-09-03 00:00` → UTC `2026-09-02T15:00:00Z`）。日付だけを取り出すときはこの変換を逆に行う。
- この計算は`POST /todos/:id/complete`が呼ばれ、かつ`recurrence_type`が`none`以外のときに実行する。

## 次回の期限（`due_at`）の求め方

入力: 現在の`due_at`（UTC）、`due_has_time`、`recurrence_type`、`recurrence_config`
出力: 次回の`due_at`（UTC）

1. 現在の`due_at`をJSTに変換し、日付部分`D`（年・月・日）と時刻部分`T`（`due_has_time = true`のときのみ使う）に分ける。
2. `recurrence_type`ごとに次回の日付`D'`を求める。
   - **`daily`**: `D' = D + 1日`
   - **`weekly`**: `recurrence_config.weekdays`（日曜=0〜土曜=6の配列）の中から、`D`の曜日より**後**にあり、かつ最も近いものを選ぶ。該当が無ければ翌週の最も早い曜日にする。

     ```text
     diffs_after  = weekdays.map(w => (w - D.曜日 + 7) % 7).filter(d => d > 0)
     diff = diffs_after が1件以上ある場合 → min(diffs_after)
           それ以外（選択曜日が全て今日と同じ = 1曜日だけ選択され、それが今日）→ min(weekdays.map(w => (w - D.曜日 + 7) % 7 の中で0になったもの)) + 7 = 7
     D' = D + diff日
     ```

   - **`monthly`**: `recurrence_config.day`を対象の日付とする。`D`の**翌月**の当該日を`D'`とする。翌月にその日が存在しない場合（例: 31日で翌月が2月）は、翌月の末日を`D'`とする。
3. `due_has_time = true`のときは`D'`に`T`を組み合わせてJSTの日時にする。`due_has_time = false`のときは`D'`の`00:00 JST`にする。
4. 3で求めたJSTの日時をUTCに変換し、新しい`due_at`とする。

## 境界値の扱い

| ケース | 結果 |
| --- | --- |
| `weekly`で選択曜日が1つだけ、かつ現在の期限と同じ曜日 | 7日後（同じ曜日の翌週）。「今日」自体は候補にしない |
| `weekly`で選択曜日が複数、今週分をすべて消化済み | 翌週の最も早い曜日 |
| `monthly`で日付が31・30・29、翌月がそれより短い | 翌月の末日（例: 1/31→2月は28日または29日、2/29のうるう年翌年→翌年2月は28日） |
| `monthly`の月またぎ | 常に「現在の`due_at`の暦上の翌月」を基準に計算するため、年またぎ（12月→1月）やうるう年の判定は`D`の年月から自動的に決まる。特別扱いは不要 |

## DBへの影響

基本設計 [`16_ToDo追加・編集.md`](../../02_basic-design/family-todo/16_ToDo追加・編集.md)「8. DBへの影響 > 繰り返しToDoを完了にしたときの動き」のとおり、`todos.due_at`を上記の計算結果に更新する。`status`・`completed_by_user_id`・`completed_at`は変更しない。

あわせて`due_soon_notified_at`・`overdue_notified_at`（[`20_通知バッチ処理.md`](20_通知バッチ処理.md)参照）をNULLに戻し、新しい期限に対して通知の判定をやり直せるようにする。
