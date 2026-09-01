import { Errors } from "../../shared/errors/app-error";
import {
  findUserProfile,
  listNotificationSettings,
  updateNotificationSetting,
  updateUserProfile,
} from "./repository";
import {
  NOTIFICATION_TYPES,
  type MyProfile,
  type NotificationSetting,
  type NotificationType,
} from "./types";
import type { UpdateMyProfileInput, UpdateNotificationSettingInput } from "./validation";

// 期限接近通知で選べる時刻を、仕様どおりの組み合わせに限定する。
const REMIND_BEFORE_OPTIONS = new Set([
  "1:hours",
  "3:hours",
  "6:hours",
  "1:days",
  "2:days",
  "3:days",
  "7:days",
]);

// 自分のプロフィールを画面表示用の形式で返す。
export async function getMyProfile(userId: number): Promise<MyProfile> {
  const profile = await findUserProfile(userId);
  if (!profile) {
    throw Errors.NOT_FOUND("ユーザー情報が見つかりません。");
  }
  return {
    displayName: profile.display_name,
    email: profile.email,
    defaultDueTime: profile.default_due_time,
  };
}

// 自分の表示名または期限の基準時刻を変更する。
export async function updateMyProfile(userId: number, input: UpdateMyProfileInput): Promise<void> {
  await updateUserProfile(userId, input);
}

// 自分の通知設定を画面表示用の形式で返す。
export async function getMyNotificationSettings(userId: number): Promise<NotificationSetting[]> {
  const settings = await listNotificationSettings(userId);
  const settingsByType = new Map(settings.map((setting) => [setting.notification_type, setting]));
  return NOTIFICATION_TYPES.map((type) => {
    const setting = settingsByType.get(type);
    return {
      type,
      enabled: setting?.enabled === 1,
      remindBeforeValue: setting?.remind_before_value ?? null,
      remindBeforeUnit: setting?.remind_before_unit ?? null,
    };
  });
}

// 自分の通知設定を変更する。期限接近通知だけにリマインド時刻を持たせる。
export async function updateMyNotificationSetting(
  userId: number,
  type: NotificationType,
  input: UpdateNotificationSettingInput,
): Promise<void> {
  if (
    type !== "due_soon" &&
    (input.remindBeforeValue !== undefined || input.remindBeforeUnit !== undefined)
  ) {
    throw Errors.VALIDATION_ERROR("この通知にはリマインドのタイミングを指定できません。");
  }
  if (type === "due_soon") {
    if (input.remindBeforeValue === undefined || input.remindBeforeUnit === undefined) {
      throw Errors.VALIDATION_ERROR("リマインドのタイミングを指定してください。");
    }
    if (!REMIND_BEFORE_OPTIONS.has(`${input.remindBeforeValue}:${input.remindBeforeUnit}`)) {
      throw Errors.VALIDATION_ERROR("リマインドのタイミングが正しくありません。");
    }
  }
  await updateNotificationSetting(userId, type, input);
}
