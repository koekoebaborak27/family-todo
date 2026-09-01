import { getDb } from "../../shared/db/get-db";
import type { NotificationType } from "./types";

// usersテーブルから個人設定画面用のプロフィールを取得する。
export async function findUserProfile(userId: number) {
  return getDb()
    .prepare("SELECT display_name, email, default_due_time FROM users WHERE id = ?")
    .bind(userId)
    .first<{ display_name: string; email: string; default_due_time: string }>();
}

// 表示名と期限の基準時刻のうち、変更された値だけをusersテーブルへ保存する。
export async function updateUserProfile(
  userId: number,
  values: { displayName?: string; defaultDueTime?: string },
): Promise<void> {
  const fields: string[] = [];
  const bindings: string[] = [];
  if (values.displayName !== undefined) {
    fields.push("display_name = ?");
    bindings.push(values.displayName);
  }
  if (values.defaultDueTime !== undefined) {
    fields.push("default_due_time = ?");
    bindings.push(values.defaultDueTime);
  }
  await getDb()
    .prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...bindings, userId)
    .run();
}

// 指定ユーザーの通知設定をすべて取得する。
export async function listNotificationSettings(userId: number) {
  const { results } = await getDb()
    .prepare(
      "SELECT notification_type, enabled, remind_before_value, remind_before_unit FROM notification_settings WHERE user_id = ? ORDER BY id",
    )
    .bind(userId)
    .all<{
      notification_type: NotificationType;
      enabled: number;
      remind_before_value: number | null;
      remind_before_unit: "hours" | "days" | null;
    }>();
  return results;
}

// 通知のON/OFFと、期限接近通知の時刻を保存する。
export async function updateNotificationSetting(
  userId: number,
  type: NotificationType,
  values: { enabled: boolean; remindBeforeValue?: number; remindBeforeUnit?: "hours" | "days" },
): Promise<void> {
  if (values.remindBeforeValue === undefined || values.remindBeforeUnit === undefined) {
    await getDb()
      .prepare(
        "UPDATE notification_settings SET enabled = ? WHERE user_id = ? AND notification_type = ?",
      )
      .bind(Number(values.enabled), userId, type)
      .run();
    return;
  }
  await getDb()
    .prepare(
      "UPDATE notification_settings SET enabled = ?, remind_before_value = ?, remind_before_unit = ? WHERE user_id = ? AND notification_type = ?",
    )
    .bind(Number(values.enabled), values.remindBeforeValue, values.remindBeforeUnit, userId, type)
    .run();
}
