import { z } from "zod";

// PATCH /users/meで受け取る、自分のプロフィールの変更内容。
export const updateMyProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "表示名を入力してください。")
      .max(20, "表示名は20文字以内で入力してください。")
      .optional(),
    defaultDueTime: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):00$/, "基準時刻が正しくありません。")
      .optional(),
  })
  .refine((value) => value.displayName !== undefined || value.defaultDueTime !== undefined, {
    message: "変更する項目を指定してください。",
  });

// PATCH /notification-settings/:typeで受け取る通知設定の変更内容。
export const updateNotificationSettingSchema = z.object({
  enabled: z.boolean(),
  remindBeforeValue: z.number().int().optional(),
  remindBeforeUnit: z.enum(["hours", "days"]).optional(),
});

// 検証済みのプロフィール変更内容の型。
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

// 検証済みの通知設定変更内容の型。
export type UpdateNotificationSettingInput = z.infer<typeof updateNotificationSettingSchema>;
