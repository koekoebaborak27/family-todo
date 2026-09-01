import { describe, expect, it } from "vitest";
import { updateMyProfileSchema, updateNotificationSettingSchema } from "./validation";

/**
 * 対象: settings/validation
 * 目的: 個人設定APIの表示名・基準時刻・通知スイッチの入力形式を担保する。
 */
describe("settings/validation updateMyProfileSchema", () => {
  describe("表示名が空白のみのとき", () => {
    it("「表示名を入力してください。」で検証を弾く", () => {
      const result = updateMyProfileSchema.safeParse({ displayName: "  " });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("表示名を入力してください。");
    });
  });

  describe("基準時刻が23時を超えるとき", () => {
    it("検証を弾く", () => {
      expect(updateMyProfileSchema.safeParse({ defaultDueTime: "24:00" }).success).toBe(false);
    });
  });

  describe("表示名がちょうど20文字のとき", () => {
    it("検証を通す", () => {
      expect(updateMyProfileSchema.safeParse({ displayName: "あ".repeat(20) }).success).toBe(true);
    });
  });

  describe("表示名が21文字のとき", () => {
    it("「表示名は20文字以内で入力してください。」で検証を弾く", () => {
      const result = updateMyProfileSchema.safeParse({ displayName: "あ".repeat(21) });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("表示名は20文字以内で入力してください。");
    });
  });

  describe("表示名と基準時刻を両方省略したとき", () => {
    it("「変更する項目を指定してください。」で検証を弾く", () => {
      const result = updateMyProfileSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("変更する項目を指定してください。");
    });
  });

  it("表示名または基準時刻があれば検証を通す", () => {
    expect(updateMyProfileSchema.safeParse({ displayName: "花子" }).success).toBe(true);
    expect(updateMyProfileSchema.safeParse({ defaultDueTime: "20:00" }).success).toBe(true);
  });
});

describe("settings/validation updateNotificationSettingSchema", () => {
  it("ON/OFFとリマインドの単位を受け取る", () => {
    expect(
      updateNotificationSettingSchema.safeParse({
        enabled: true,
        remindBeforeValue: 1,
        remindBeforeUnit: "days",
      }).success,
    ).toBe(true);
  });
});
