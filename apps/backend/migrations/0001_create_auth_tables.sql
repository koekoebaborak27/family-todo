-- Migration number: 0001 	 2026-09-01T01:28:43.146Z
-- ログイン機能に必要な最小限のテーブル（users / sessions / notification_settings）を作成する。
-- families テーブルは家族グループ機能の実装時に追加するため、users.family_id は
-- 外部キー制約を付けない単なる nullable カラムとする（設計: docs/specs/02_basic-design/family-todo/01_データベース.md）。

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  default_due_time TEXT NOT NULL DEFAULT '20:00',
  family_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('todo_added', 'assignee_set', 'due_soon', 'overdue')
  ),
  enabled INTEGER NOT NULL DEFAULT 1,
  remind_before_value INTEGER,
  remind_before_unit TEXT CHECK (remind_before_unit IN ('hours', 'days')),
  UNIQUE (user_id, notification_type)
);
