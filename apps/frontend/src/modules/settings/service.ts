import type { NotificationType } from "./types";

// 個人設定画面に表示する共通のエラー文言。
export const SETTINGS_ERROR_MESSAGES = {
  unauthorized: "ログインの有効期限が切れました。もう一度ログインしてください。",
  network: "通信に失敗しました。電波状況を確認してもう一度お試しください。",
  server: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
} as const;

// 通知の種類を画面の日本語ラベルへ変換する。
export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; description: string }> =
  {
    todo_added: {
      title: "ToDoが追加されたとき",
      description: "家族の誰かがToDoを追加したときに知らせます。",
    },
    assignee_set: {
      title: "自分が担当者になったとき",
      description:
        "あなたが担当者に設定されたときに知らせます。ログインしないメンバーの通知の受け取り役になっている場合も含みます。",
    },
    due_soon: { title: "期限が近づいたとき", description: "期限の前に知らせます。" },
    overdue: { title: "期限を過ぎたとき", description: "期限を過ぎても未完了のToDoを知らせます。" },
  };

// リマインドの値を日本語ラベルへ変換する。
export const REMIND_BEFORE_LABELS: Record<string, string> = {
  "1:hours": "1時間前",
  "3:hours": "3時間前",
  "6:hours": "6時間前",
  "1:days": "1日前",
  "2:days": "2日前",
  "3:days": "3日前",
  "7:days": "1週間前",
};

// 基準時刻の値を日本語ラベルへ変換する。
export const DUE_TIME_LABELS = Object.fromEntries(
  Array.from({ length: 24 }, (_, hour) => {
    const value = `${String(hour).padStart(2, "0")}:00`;
    return [value, `${hour}:00`];
  }),
) as Record<string, string>;

// 表示名を画面と同じルールで検査する。
export function validateDisplayName(value: string): string | null {
  if (!value.trim()) {
    return "表示名を入力してください。";
  }
  if (value.length > 20) {
    return "表示名は20文字以内で入力してください。";
  }
  return null;
}
