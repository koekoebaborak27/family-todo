# API仕様

REST API。共通規約（ベースパス・認証・エラー形式）は [`00_family-todo共通.md`](00_family-todo共通.md) を参照。個別のリクエスト/レスポンスの項目詳細・バリデーション文言は詳細設計または単体テスト仕様書で定める。

## 認証

| Method | Path | 概要 | 認証 |
| --- | --- | --- | --- |
| POST | `/auth/google/callback` | GoogleのOAuth認可コードを受け取り、ログインセッションを発行する。未登録ユーザーなら`users`を新規作成する | 不要 |
| POST | `/auth/logout` | ログアウトする | 必須 |
| GET | `/auth/me` | ログイン状態と所属グループの有無を返す（初期表示の振り分けに使用） | 必須 |

## 家族グループ

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| POST | `/families` | 家族グループを新規作成する。作成者は自動的にそのグループに所属する | 未所属ユーザー |
| POST | `/families/join` | 招待コードでグループに参加する。コードが存在しなければ`404`、有効期限切れなら`400`、すでにグループ所属なら`409` | 未所属ユーザー |
| GET | `/families/me` | 自分の所属グループの情報（グループ名、招待コード、招待コードの有効期限、作成者、作成日時）を取得する | グループ所属者 |
| POST | `/families/me/invite` | 招待リンク/招待コードを（再）発行する。半角英数字8桁（大文字）を生成し、有効期限を発行日時の7日後にする。古いコードは無効になる | グループ所属者全員 |
| POST | `/families/me/leave` | 自分がグループから退出する。担当していたToDoからは外れる。自分が作成者だった場合は残ったメンバーのうち最も古くから所属している人へ作成者を引き継ぐ。自分が最後の1人だった場合はグループごと削除する | グループ所属者全員 |
| DELETE | `/families/me` | グループを削除（解散）する。関連する`todos`等も削除される | グループ作成者のみ |

## メンバー（登録ユーザー・非登録メンバー）

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| GET | `/families/me/members` | 登録ユーザー一覧を取得する | グループ所属者 |
| GET | `/families/me/unregistered-members` | 非登録メンバー一覧を取得する | グループ所属者 |
| POST | `/families/me/unregistered-members` | 非登録メンバーを登録する（`name`必須。グループ内で名前が重複する場合は`409`） | グループ所属者全員 |
| DELETE | `/families/me/unregistered-members/:id` | 非登録メンバーを削除する | グループ所属者全員 |

## 自分のプロフィール

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| GET | `/users/me` | 自分のプロフィール（表示名、メールアドレス、`default_due_time`）を取得する | 必須 |
| PATCH | `/users/me` | 表示名（`display_name`）と、時刻を指定していない期限の基準時刻（`default_due_time`）を変更する | 本人 |

## カテゴリ

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| GET | `/categories` | カテゴリの固定マスタ一覧（6件）を取得する | 必須 |

## ToDo

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| GET | `/todos` | ToDo一覧を取得する。クエリ: `status`（`incomplete`/`completed`）、`category_id`（任意の絞り込み）。並び順は画面側で決めるため並び替えのクエリは持たない | グループ所属者 |
| POST | `/todos` | ToDoを新規作成する。主な項目: `title`（必須）、`memo`、`due_at`、`due_has_time`、`priority`、`category_id`、`recurrence_type`、`recurrence_config`、`assignees`（担当者リスト） | グループ所属者全員 |
| GET | `/todos/:id` | ToDo詳細を取得する（担当者・コメント含む） | グループ所属者 |
| PATCH | `/todos/:id` | ToDoを編集する | グループ所属者全員 |
| DELETE | `/todos/:id` | ToDoを物理削除する | グループ所属者全員 |
| POST | `/todos/:id/complete` | 完了にする（`completed_by_user_id`・`completed_at`を記録）。繰り返し設定があるToDoは完了にせず、`due_at`を次回へ進めて未完了のまま残す | グループ所属者全員 |
| POST | `/todos/:id/incomplete` | 未完了に戻す | グループ所属者全員 |
| PUT | `/todos/:id/assignees` | 担当者を置き換える。非登録メンバーを含める場合は`is_follower`の登録ユーザーを最低1人含める必要があり、含まない場合は`400` | グループ所属者全員 |

## コメント

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| GET | `/todos/:id/comments` | 指定ToDoのコメント一覧を取得する | グループ所属者 |
| POST | `/todos/:id/comments` | コメントを投稿する | グループ所属者全員 |
| PATCH | `/comments/:id` | コメントを編集する（投稿者以外も可） | グループ所属者全員 |
| DELETE | `/comments/:id` | コメントを削除する（投稿者以外も可） | グループ所属者全員 |

## 通知設定

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| GET | `/notification-settings` | 通知種別（4種類）ごとのON/OFF・リマインド時間を取得する | 本人 |
| PATCH | `/notification-settings/:type` | 指定した通知種別の設定を更新する。`type`は`todo_added`/`assignee_set`/`due_soon`/`overdue`。`due_soon`のみ`remind_before_value`・`remind_before_unit`を受け付ける | 本人 |

## Push購読（Web Push）

| Method | Path | 概要 | 権限 |
| --- | --- | --- | --- |
| POST | `/push-subscriptions` | ブラウザから取得した購読情報（endpoint/p256dh/auth）を登録する | 必須 |
| DELETE | `/push-subscriptions/:id` | 購読を解除する | 本人 |

## 定期処理（バッチ）

- 期限接近・期限超過の通知は、ユーザー操作に紐づくAPIではなく、Cloudflare Cron Triggers等による定期実行から`todos`・`notification_settings`を突き合わせて送信する想定。具体的な実行間隔・実装方式は基本設計の技術検証（`docs/specs/02_basic-design/README.md`のインフラ関連事項）で確定する。
