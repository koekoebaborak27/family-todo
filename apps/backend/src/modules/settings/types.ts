// 個人設定画面で返す自分自身のプロフィール情報。
export interface MyProfile {
  displayName: string;
  email: string;
  defaultDueTime: string;
}

// 通知の種類。DBのnotification_typeと同じ値だけを扱う。
export const NOTIFICATION_TYPES = ["todo_added", "assignee_set", "due_soon", "overdue"] as const;

// 通知の種類を表す型。
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// 個人設定画面で返す通知の設定。
export interface NotificationSetting {
  type: NotificationType;
  enabled: boolean;
  remindBeforeValue: number | null;
  remindBeforeUnit: "hours" | "days" | null;
}
