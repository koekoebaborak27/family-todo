import type { ApiErrorBody } from "shared";
import { SETTINGS_ERROR_MESSAGES } from "./service";
import type { MyProfile, NotificationSetting, NotificationType } from "./types";

// Backendの個人設定APIを呼び出すURLの先頭。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// 画面で扱えるよう、APIエラーのHTTPステータスと表示文言を持たせる例外。
export class SettingsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// APIのエラー応答から画面に表示する文言を取り出す。
async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch((): null => null)) as ApiErrorBody | null;
  return body?.error.message ?? SETTINGS_ERROR_MESSAGES.server;
}

// Cookieを含めてGETリクエストを送る。
async function getJson(path: string): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, { credentials: "include" }).catch((): never => {
    throw new SettingsError(SETTINGS_ERROR_MESSAGES.network);
  });
}

// Cookieを含めてPATCHリクエストを送る。
async function patchJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((): never => {
    throw new SettingsError(SETTINGS_ERROR_MESSAGES.network);
  });
}

// 自分のプロフィールを取得する。
export async function fetchMyProfile(): Promise<MyProfile> {
  const response = await getJson("/api/v1/users/me");
  if (!response.ok) {
    throw new SettingsError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as MyProfile;
}

// 自分の表示名を保存する。
export async function updateDisplayName(displayName: string): Promise<void> {
  const response = await patchJson("/api/v1/users/me", { displayName });
  if (!response.ok) {
    throw new SettingsError(await readErrorMessage(response), response.status);
  }
}

// 日付だけの期限に使う基準時刻を保存する。
export async function updateDefaultDueTime(defaultDueTime: string): Promise<void> {
  const response = await patchJson("/api/v1/users/me", { defaultDueTime });
  if (!response.ok) {
    throw new SettingsError(await readErrorMessage(response), response.status);
  }
}

// 自分の通知設定を取得する。
export async function fetchNotificationSettings(): Promise<NotificationSetting[]> {
  const response = await getJson("/api/v1/notification-settings");
  if (!response.ok) {
    throw new SettingsError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as NotificationSetting[];
}

// 1種類の通知設定を保存する。
export async function updateNotificationSetting(
  type: NotificationType,
  value: { enabled: boolean; remindBeforeValue?: number; remindBeforeUnit?: "hours" | "days" },
): Promise<void> {
  const response = await patchJson(`/api/v1/notification-settings/${type}`, value);
  if (!response.ok) {
    throw new SettingsError(await readErrorMessage(response), response.status);
  }
}

// ブラウザから取得したPush購読情報をBackendへ登録する。
export async function registerPushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/push-subscriptions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  }).catch((): never => {
    throw new SettingsError(SETTINGS_ERROR_MESSAGES.network);
  });
  if (!response.ok) {
    throw new SettingsError(await readErrorMessage(response), response.status);
  }
}
