import { getDb } from "../../shared/db/get-db";

const SESSION_LIFETIME_DAYS = 90;
const NOTIFICATION_TYPES = ["todo_added", "assignee_set", "due_soon", "overdue"] as const;

export interface UserRow {
  id: number;
  family_id: number | null;
}

// googleのsubでusersを検索する。初回ログインかどうかの判定に使う。
export async function findUserByGoogleSub(googleSub: string): Promise<UserRow | null> {
  const row = await getDb()
    .prepare("SELECT id, family_id FROM users WHERE google_sub = ?")
    .bind(googleSub)
    .first<UserRow>();
  return row ?? null;
}

// 初回ログイン時にusersを1件追加し、通知設定4種別を既定値でseedする。
// docs/specs/02_basic-design/family-todo/10_ログイン.md「8. DBへの影響」のとおり。
export async function createUserWithDefaultNotificationSettings(params: {
  googleSub: string;
  email: string;
  displayName: string;
}): Promise<UserRow> {
  const db = getDb();
  const insertUser = db
    .prepare(
      "INSERT INTO users (google_sub, email, display_name) VALUES (?, ?, ?) RETURNING id, family_id",
    )
    .bind(params.googleSub, params.email, params.displayName);

  const userResult = await insertUser.first<UserRow>();
  if (!userResult) {
    throw new Error("ユーザーの作成に失敗しました。");
  }

  const seedStatements = NOTIFICATION_TYPES.map((notificationType) =>
    notificationType === "due_soon"
      ? db
          .prepare(
            "INSERT INTO notification_settings (user_id, notification_type, enabled, remind_before_value, remind_before_unit) VALUES (?, ?, 1, 1, 'days')",
          )
          .bind(userResult.id, notificationType)
      : db
          .prepare(
            "INSERT INTO notification_settings (user_id, notification_type, enabled) VALUES (?, ?, 1)",
          )
          .bind(userResult.id, notificationType),
  );
  await db.batch(seedStatements);

  return userResult;
}

// 新しいセッションをsessionsへ追加する。idは呼び出し側が暗号学的乱数で生成する。
export async function createSession(params: {
  sessionId: string;
  userId: number;
  expiresAt: Date;
}): Promise<void> {
  await getDb()
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(params.sessionId, params.userId, params.expiresAt.toISOString())
    .run();
}

// セッションIDから、有効期限内のセッションに紐づくユーザーを取得する。
// 期限切れ・存在しない場合はnull（呼び出し側で401にする）。
export async function findUserBySessionId(sessionId: string): Promise<UserRow | null> {
  const row = await getDb()
    .prepare(
      `SELECT users.id, users.family_id
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP`,
    )
    .bind(sessionId)
    .first<UserRow>();
  return row ?? null;
}

// スライディングセッション: 認証付きAPI呼び出しのたびに有効期限を延長する。
export async function extendSessionExpiry(sessionId: string): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE sessions SET expires_at = datetime(CURRENT_TIMESTAMP, '+${SESSION_LIFETIME_DAYS} days') WHERE id = ?`,
    )
    .bind(sessionId)
    .run();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getDb().prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function newSessionExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + SESSION_LIFETIME_DAYS);
  return expiresAt;
}
