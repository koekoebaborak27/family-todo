-- Migration number: 0002 	 2026-09-01T02:19:27.000Z
-- 家族グループ作成・参加機能に必要な families テーブルを作成する（設計:
-- docs/specs/02_basic-design/family-todo/01_データベース.md）。
-- users.family_id は 0001 で外部キー制約なしのnullableカラムとして作成済みのため変更しない。

CREATE TABLE families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invite_code_expires_at TEXT NOT NULL,
  created_by_user_id INTEGER NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
