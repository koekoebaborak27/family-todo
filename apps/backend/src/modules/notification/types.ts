// 通知バッチが扱う通知の種類。ToDo追加・担当者設定の通知はAPI呼び出しに紐づくため、ここには含めない
// （docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「対象範囲」）。
export type BatchNotificationType = "due_soon" | "overdue";

// 通知の判定と本文組み立てに必要なToDoの情報。一覧表示用の情報は取らない。
export interface NotificationTodoRow {
  id: number;
  title: string;
  due_at: string;
}

// 通知先を決めるための担当者1件分。登録ユーザーならuser_id、非登録メンバーならunregistered_member_idが入る。
export interface NotificationAssigneeRow {
  todo_id: number;
  user_id: number | null;
  unregistered_member_id: number | null;
  is_follower: number;
}

// 通知先ユーザーの通知設定1件分。remind_before_*は期限接近通知でのみ使う。
export interface NotificationSettingRow {
  user_id: number;
  enabled: number;
  remind_before_value: number | null;
  remind_before_unit: "hours" | "days" | null;
}

// 送信先となるブラウザの購読情報1件分。
export interface PushSubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// 1件のToDoについて「誰に送るか」をまとめたもの。userIdsが空なら送信は行わない。
export interface NotificationTarget {
  todo: NotificationTodoRow;
  userIds: number[];
}
