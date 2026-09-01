-- Migration number: 0003 	 2026-09-01T02:45:33.926Z
-- ToDo一覧画面に必要なテーブル一式を作成する（設計:
-- docs/specs/02_basic-design/family-todo/01_データベース.md）。
-- ToDo追加・編集/詳細/家族グループ設定など後続の画面もこのスキーマを使うため、
-- ER図に含まれる関連テーブル（unregistered_members・todo_assignees・comments）も
-- 合わせて作成する。

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO categories (name) VALUES
  ('学校'), ('仕事'), ('習い事'), ('家事'), ('買い物'), ('その他');

CREATE TABLE unregistered_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families (id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (family_id, name)
);

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families (id),
  title TEXT NOT NULL,
  memo TEXT,
  due_at TEXT,
  due_has_time INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  category_id INTEGER NOT NULL REFERENCES categories (id),
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'completed')),
  recurrence_type TEXT NOT NULL DEFAULT 'none' CHECK (
    recurrence_type IN ('none', 'daily', 'weekly', 'monthly')
  ),
  recurrence_config TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users (id),
  completed_by_user_id INTEGER REFERENCES users (id),
  completed_at TEXT,
  due_soon_notified_at TEXT,
  overdue_notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_todos_family_id_status ON todos (family_id, status);

CREATE TABLE todo_assignees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos (id),
  user_id INTEGER REFERENCES users (id),
  unregistered_member_id INTEGER REFERENCES unregistered_members (id),
  is_follower INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (user_id IS NOT NULL AND unregistered_member_id IS NULL) OR
    (user_id IS NULL AND unregistered_member_id IS NOT NULL)
  )
);

CREATE INDEX idx_todo_assignees_todo_id ON todo_assignees (todo_id);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos (id),
  user_id INTEGER NOT NULL REFERENCES users (id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_comments_todo_id ON comments (todo_id);

CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, endpoint)
);
