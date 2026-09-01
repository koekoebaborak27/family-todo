import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findUserProfile,
  listNotificationSettings,
  updateNotificationSetting,
  updateUserProfile,
} from "./repository";
import {
  getMyNotificationSettings,
  getMyProfile,
  updateMyNotificationSetting,
  updateMyProfile,
} from "./service";

/**
 * 対象: settings/service
 * 目的: 自分のプロフィール取得・更新と、期限接近通知だけに許可するリマインド時刻を担保する。
 */
vi.mock("./repository", () => ({
  findUserProfile: vi.fn(),
  listNotificationSettings: vi.fn(),
  updateNotificationSetting: vi.fn(),
  updateUserProfile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settings/service getMyProfile", () => {
  describe("ユーザー情報があるとき", () => {
    it("画面用のプロフィールを返す", async () => {
      vi.mocked(findUserProfile).mockResolvedValue({
        display_name: "花子",
        email: "hanako@example.com",
        default_due_time: "20:00",
      });
      await expect(getMyProfile(1)).resolves.toEqual({
        displayName: "花子",
        email: "hanako@example.com",
        defaultDueTime: "20:00",
      });
    });
  });

  describe("ユーザー情報がないとき", () => {
    it("AppError(NOT_FOUND)を投げる", async () => {
      vi.mocked(findUserProfile).mockResolvedValue(null);
      await expect(getMyProfile(1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});

describe("settings/service updateMyProfile", () => {
  it("表示名の変更をrepositoryへ渡す", async () => {
    await updateMyProfile(1, { displayName: "花子" });
    expect(updateUserProfile).toHaveBeenCalledWith(1, { displayName: "花子" });
  });
});

describe("settings/service getMyNotificationSettings", () => {
  it("保存済みの値を画面用の形式で返す", async () => {
    vi.mocked(listNotificationSettings).mockResolvedValue([
      {
        notification_type: "due_soon",
        enabled: 1,
        remind_before_value: 1,
        remind_before_unit: "days",
      },
    ]);
    await expect(getMyNotificationSettings(1)).resolves.toContainEqual({
      type: "due_soon",
      enabled: true,
      remindBeforeValue: 1,
      remindBeforeUnit: "days",
    });
  });
});

describe("settings/service updateMyNotificationSetting", () => {
  describe("期限接近通知に決められていない時刻を指定するとき", () => {
    it("AppError(VALIDATION_ERROR)を投げる", async () => {
      await expect(
        updateMyNotificationSetting(1, "due_soon", {
          enabled: true,
          remindBeforeValue: 4,
          remindBeforeUnit: "hours",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(updateNotificationSetting).not.toHaveBeenCalled();
    });
  });

  describe("期限超過通知にリマインド時刻を指定するとき", () => {
    it("AppError(VALIDATION_ERROR)を投げる", async () => {
      await expect(
        updateMyNotificationSetting(1, "overdue", {
          enabled: true,
          remindBeforeValue: 1,
          remindBeforeUnit: "days",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  it("期限接近通知の有効な時刻を保存する", async () => {
    await updateMyNotificationSetting(1, "due_soon", {
      enabled: false,
      remindBeforeValue: 1,
      remindBeforeUnit: "days",
    });
    expect(updateNotificationSetting).toHaveBeenCalledWith(1, "due_soon", {
      enabled: false,
      remindBeforeValue: 1,
      remindBeforeUnit: "days",
    });
  });
});
