import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMyProfile, updateDisplayName, updateNotificationSetting } from "./api-client";

/**
 * 対象: settings/api-client
 * 目的: 個人設定APIの成功値と、認証切れ・入力エラーの画面向け変換を担保する。
 */
function mockFetchOnce(response: Partial<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings/api-client fetchMyProfile", () => {
  it("200が返るとき、プロフィールを返す", async () => {
    mockFetchOnce({
      json: async () => ({
        displayName: "花子",
        email: "hanako@example.com",
        defaultDueTime: "20:00",
      }),
    });
    await expect(fetchMyProfile()).resolves.toEqual({
      displayName: "花子",
      email: "hanako@example.com",
      defaultDueTime: "20:00",
    });
  });
});

describe("settings/api-client updateDisplayName", () => {
  describe("400が返るとき", () => {
    it("Backendの入力エラー文言とステータスを持つSettingsErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "表示名を入力してください。" } }),
      });
      await expect(updateDisplayName("")).rejects.toMatchObject({
        message: "表示名を入力してください。",
        status: 400,
      });
    });
  });
});

describe("settings/api-client updateNotificationSetting", () => {
  describe("401が返るとき", () => {
    it("認証切れの文言を持つSettingsErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: "ログインの有効期限が切れました。もう一度ログインしてください。" },
        }),
      });
      await expect(updateNotificationSetting("overdue", { enabled: false })).rejects.toMatchObject({
        status: 401,
      });
    });
  });
});
