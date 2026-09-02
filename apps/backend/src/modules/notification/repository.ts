import { getDb } from "../../shared/db/get-db";
import type {
  BatchNotificationType,
  NotificationAssigneeRow,
  NotificationSettingRow,
  NotificationTodoRow,
  PushSubscriptionRow,
} from "./types";

// 通知の種類ごとに「送信済みかどうか」を持つtodosの列名。
// SQLへ埋め込む値なので、外から渡された文字列をそのまま使わずこの対応表を経由する。
const NOTIFIED_AT_COLUMNS: Record<BatchNotificationType, string> = {
  due_soon: "due_soon_notified_at",
  overdue: "overdue_notified_at",
};

// 指定した件数分の「?」を並べた文字列を作る。IN句へ配列を渡すために使う。
function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

// 期限接近通知の候補になるToDoを取得する。実際に今送るかどうかは担当者ごとの設定で決まるため、
// ここでは「未完了・期限あり・この期限ではまだ未送信」までを絞り込む
// （docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「期限接近（due_soon）」）。
export async function listDueSoonCandidateTodos(): Promise<NotificationTodoRow[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT id, title, due_at FROM todos
       WHERE status = 'incomplete' AND due_at IS NOT NULL AND due_soon_notified_at IS NULL`,
    )
    .all<NotificationTodoRow>();
  return results;
}

// 期限超過通知の候補になるToDoを取得する。期限を過ぎたかどうかの判定もSQLで行う
// （docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「期限超過（overdue）」）。
export async function listOverdueCandidateTodos(nowIso: string): Promise<NotificationTodoRow[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT id, title, due_at FROM todos
       WHERE status = 'incomplete' AND due_at IS NOT NULL AND due_at <= ?
         AND overdue_notified_at IS NULL`,
    )
    .bind(nowIso)
    .all<NotificationTodoRow>();
  return results;
}

// 指定したToDo群の担当者をまとめて取得する。通知先の判定にしか使わないので、表示名は引かない。
export async function listAssigneesForTodoIds(
  todoIds: number[],
): Promise<NotificationAssigneeRow[]> {
  if (todoIds.length === 0) {
    return [];
  }
  const { results } = await getDb()
    .prepare(
      `SELECT todo_id, user_id, unregistered_member_id, is_follower
       FROM todo_assignees WHERE todo_id IN (${placeholders(todoIds.length)})`,
    )
    .bind(...todoIds)
    .all<NotificationAssigneeRow>();
  return results;
}

// 通知先候補のユーザーについて、指定した種類の通知設定をまとめて取得する。
export async function listNotificationSettingsForUsers(
  userIds: number[],
  notificationType: BatchNotificationType,
): Promise<NotificationSettingRow[]> {
  if (userIds.length === 0) {
    return [];
  }
  const { results } = await getDb()
    .prepare(
      `SELECT user_id, enabled, remind_before_value, remind_before_unit
       FROM notification_settings
       WHERE notification_type = ? AND user_id IN (${placeholders(userIds.length)})`,
    )
    .bind(notificationType, ...userIds)
    .all<NotificationSettingRow>();
  return results;
}

// 通知先ユーザーが登録しているブラウザの購読情報をまとめて取得する。
// 1人が複数の端末・ブラウザを登録していることがあるため、ユーザーごとに複数行返りうる。
export async function listPushSubscriptionsForUsers(
  userIds: number[],
): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) {
    return [];
  }
  const { results } = await getDb()
    .prepare(
      `SELECT id, user_id, endpoint, p256dh, auth
       FROM push_subscriptions WHERE user_id IN (${placeholders(userIds.length)})`,
    )
    .bind(...userIds)
    .all<PushSubscriptionRow>();
  return results;
}

// 通知の送信対象になったToDoへ、送信済みの印として現在時刻を書き込む。
// これにより次回以降のバッチでは候補に挙がらなくなり、15分間隔の実行が重なっても二重に送らない。
export async function markTodosNotified(
  notificationType: BatchNotificationType,
  todoIds: number[],
  nowIso: string,
): Promise<void> {
  if (todoIds.length === 0) {
    return;
  }
  await getDb()
    .prepare(
      `UPDATE todos SET ${NOTIFIED_AT_COLUMNS[notificationType]} = ?
       WHERE id IN (${placeholders(todoIds.length)})`,
    )
    .bind(nowIso, ...todoIds)
    .run();
}

// 失効していた購読情報を削除する。ブラウザ側で通知を解除された購読へ送り続けないようにする。
export async function deletePushSubscriptions(subscriptionIds: number[]): Promise<void> {
  if (subscriptionIds.length === 0) {
    return;
  }
  await getDb()
    .prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders(subscriptionIds.length)})`)
    .bind(...subscriptionIds)
    .run();
}
