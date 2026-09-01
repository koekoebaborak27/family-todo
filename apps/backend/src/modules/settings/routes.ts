import { Router } from "express";
import { Errors } from "../../shared/errors/app-error";
import type { AuthContext } from "../auth";
import {
  getMyNotificationSettings,
  getMyProfile,
  updateMyNotificationSetting,
  updateMyProfile,
} from "./service";
import { NOTIFICATION_TYPES, type NotificationType } from "./types";
import { updateMyProfileSchema, updateNotificationSettingSchema } from "./validation";

// 個人設定に関するAPIをまとめるルーター。
export const settingsRouter = Router();

// ログイン中の自分のプロフィールを取得する。requireAuthを通過済み。
settingsRouter.get("/users/me", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  res.status(200).json(await getMyProfile(user.id));
});

// ログイン中の自分の表示名または期限の基準時刻を変更する。
settingsRouter.patch("/users/me", async (req, res) => {
  const parsed = updateMyProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }
  const { user } = res.locals.authContext as AuthContext;
  await updateMyProfile(user.id, parsed.data);
  res.status(204).end();
});

// ログイン中の自分の通知設定をすべて取得する。
settingsRouter.get("/notification-settings", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  res.status(200).json(await getMyNotificationSettings(user.id));
});

// 指定した種類の通知設定を変更する。
settingsRouter.patch("/notification-settings/:type", async (req, res) => {
  const type = req.params.type as NotificationType;
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw Errors.VALIDATION_ERROR("通知の種類が正しくありません。");
  }
  const parsed = updateNotificationSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }
  const { user } = res.locals.authContext as AuthContext;
  await updateMyNotificationSetting(user.id, type, parsed.data);
  res.status(204).end();
});
