// 個人設定画面で表示するプロフィール。
export interface MyProfile {
  displayName: string;
  email: string;
  defaultDueTime: string;
}

// 通知設定で使う種類。
export type NotificationType = "todo_added" | "assignee_set" | "due_soon" | "overdue";

// 通知設定画面で表示する1種類分の値。
export interface NotificationSetting {
  type: NotificationType;
  enabled: boolean;
  remindBeforeValue: number | null;
  remindBeforeUnit: "hours" | "days" | null;
}
