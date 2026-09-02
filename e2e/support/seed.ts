import { randomBytes, randomUUID } from "node:crypto";
import type { Cookie } from "@playwright/test";
import { execSql, querySql, sqlString } from "./db";

const SESSION_COOKIE_NAME = "session_id";

// テスト用に投入するデータであることが分かるよう、google_subに付ける接頭辞。
export const E2E_GOOGLE_SUB_PREFIX = "e2e-";

function futureIso(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString();
}

function pastIso(): string {
  return "2000-01-01T00:00:00.000Z";
}

// ログインを経由せず、テスト用ユーザーとログイン済みセッションを直接D1へ投入する。
// docs/todo/notes/ローカルD1へのセッション投入によるUI確認.md と同じ割り切り。
export function createSeedUser(options: { slug: string; displayName: string }): {
  userId: number;
  sessionId: string;
  googleSub: string;
} {
  const googleSub = `${E2E_GOOGLE_SUB_PREFIX}${options.slug}-${randomUUID().slice(0, 8)}`;
  const email = `${googleSub}@example.com`;

  const [user] = querySql<{ id: number }>(
    `INSERT INTO users (google_sub, email, display_name) VALUES (${sqlString(googleSub)}, ${sqlString(email)}, ${sqlString(options.displayName)}) RETURNING id;`,
  );
  const userId = user.id;

  const sessionId = randomBytes(32).toString("hex");
  execSql(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (${sqlString(sessionId)}, ${userId}, ${sqlString(futureIso(365))});`,
  );

  // 実際のGoogleログイン時のseed（apps/backend/src/modules/auth/repository.ts の
  // createUserWithDefaultNotificationSettings）と同じ既定値を、通知設定4種別に投入する。
  execSql(`
    INSERT INTO notification_settings (user_id, notification_type, enabled) VALUES (${userId}, 'todo_added', 1);
    INSERT INTO notification_settings (user_id, notification_type, enabled) VALUES (${userId}, 'assignee_set', 1);
    INSERT INTO notification_settings (user_id, notification_type, enabled, remind_before_value, remind_before_unit) VALUES (${userId}, 'due_soon', 1, 1, 'days');
    INSERT INTO notification_settings (user_id, notification_type, enabled) VALUES (${userId}, 'overdue', 1);
  `);

  return { userId, sessionId, googleSub };
}

// セッションを期限切れにする（401を再現する）。
export function expireSession(sessionId: string): void {
  execSql(
    `UPDATE sessions SET expires_at = ${sqlString(pastIso())} WHERE id = ${sqlString(sessionId)};`,
  );
}

// セッションを削除する（Cookieは残っているがセッション自体が無い状態を再現する）。
export function deleteSession(sessionId: string): void {
  execSql(`DELETE FROM sessions WHERE id = ${sqlString(sessionId)};`);
}

// 所属家族グループを外す（403を再現する）。
export function clearFamily(userId: number): void {
  execSql(`UPDATE users SET family_id = NULL WHERE id = ${userId};`);
}

// PlaywrightのBrowserContext.addCookies()にそのまま渡せるセッションCookieを作る。
// バックエンドが発行するCookie属性（Secure・SameSite=None・HttpOnly）と一致させる
// （apps/backend/src/shared/http/session-cookie.ts）。Chromiumはhttp://localhostを
// secure contextとして扱うため、Secure属性付きでも送信される。
export function sessionCookie(sessionId: string): Cookie[] {
  const expires = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  return [
    {
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
      expires,
    },
  ];
}

// テストで投入したユーザー一式（家族・ToDo・非登録メンバー等を含む）を後始末する。
// 外部キーの都合で子→親の順に削除する。google_subがE2E_GOOGLE_SUB_PREFIXで始まるものだけを対象にする
// （通常の開発データを誤って消さないため）。
export function cleanupE2eData(): void {
  const prefix = sqlString(`${E2E_GOOGLE_SUB_PREFIX}%`);
  execSql(`
    DELETE FROM comments WHERE todo_id IN (
      SELECT todos.id FROM todos
      JOIN families ON families.id = todos.family_id
      JOIN users ON users.id = families.created_by_user_id
      WHERE users.google_sub LIKE ${prefix}
    );
    DELETE FROM todo_assignees WHERE todo_id IN (
      SELECT todos.id FROM todos
      JOIN families ON families.id = todos.family_id
      JOIN users ON users.id = families.created_by_user_id
      WHERE users.google_sub LIKE ${prefix}
    );
    DELETE FROM todos WHERE family_id IN (
      SELECT families.id FROM families
      JOIN users ON users.id = families.created_by_user_id
      WHERE users.google_sub LIKE ${prefix}
    );
    DELETE FROM unregistered_members WHERE family_id IN (
      SELECT families.id FROM families
      JOIN users ON users.id = families.created_by_user_id
      WHERE users.google_sub LIKE ${prefix}
    );
    UPDATE users SET family_id = NULL WHERE google_sub LIKE ${prefix};
    DELETE FROM families WHERE created_by_user_id IN (
      SELECT id FROM users WHERE google_sub LIKE ${prefix}
    );
    DELETE FROM sessions WHERE user_id IN (
      SELECT id FROM users WHERE google_sub LIKE ${prefix}
    );
    DELETE FROM notification_settings WHERE user_id IN (
      SELECT id FROM users WHERE google_sub LIKE ${prefix}
    );
    DELETE FROM push_subscriptions WHERE user_id IN (
      SELECT id FROM users WHERE google_sub LIKE ${prefix}
    );
    DELETE FROM users WHERE google_sub LIKE ${prefix};
  `);
}
