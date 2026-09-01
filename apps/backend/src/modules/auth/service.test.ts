import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../env";
import { AppError } from "../../shared/errors/app-error";
import { exchangeCodeForIdToken, verifyGoogleIdToken } from "./google-client";
import {
  createSession,
  createUserWithDefaultNotificationSettings,
  deleteSession,
  extendSessionExpiry,
  findUserByGoogleSub,
  findUserBySessionId,
  newSessionExpiry,
} from "./repository";
import { loginWithGoogleCode, logout, verifySession } from "./service";

/**
 * 対象: auth/service
 * 目的: Googleログインのユースケース（新規/既存ユーザー振り分け）と
 *       セッション検証（未ログイン・期限切れの401化、スライディングセッション延長）を担保する。
 */

// repository.ts は shared/db 経由で cloudflare:workers（Workers専用モジュール）を読み込むため、
// 自動モック（実装の読み込みが必要）ではなくファクトリでモックし、Node上のテストから隔離する。
vi.mock("./google-client", () => ({
  exchangeCodeForIdToken: vi.fn(),
  verifyGoogleIdToken: vi.fn(),
}));
vi.mock("./repository", () => ({
  createSession: vi.fn(),
  createUserWithDefaultNotificationSettings: vi.fn(),
  deleteSession: vi.fn(),
  extendSessionExpiry: vi.fn(),
  findUserByGoogleSub: vi.fn(),
  findUserBySessionId: vi.fn(),
  newSessionExpiry: vi.fn(),
}));

const fakeEnv = {} as Env;
const fakeExpiresAt = new Date("2026-12-01T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(newSessionExpiry).mockReturnValue(fakeExpiresAt);
});

describe("auth/service loginWithGoogleCode", () => {
  it("初回ログイン（該当するusersが無い）なら、ユーザーを新規作成してセッションを発行する", async () => {
    vi.mocked(exchangeCodeForIdToken).mockResolvedValue("id-token");
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: "google-sub-1",
      email: "taro@example.com",
      name: "太郎",
    });
    vi.mocked(findUserByGoogleSub).mockResolvedValue(null);
    vi.mocked(createUserWithDefaultNotificationSettings).mockResolvedValue({
      id: 1,
      family_id: null,
    });

    const result = await loginWithGoogleCode("auth-code", fakeEnv);

    expect(createUserWithDefaultNotificationSettings).toHaveBeenCalledWith({
      googleSub: "google-sub-1",
      email: "taro@example.com",
      displayName: "太郎",
    });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, expiresAt: fakeExpiresAt }),
    );
    expect(result.hasFamily).toBe(false);
    expect(result.expiresAt).toBe(fakeExpiresAt);
  });

  it("2回目以降のログイン（該当するusersがある）なら、usersを新規作成しない", async () => {
    vi.mocked(exchangeCodeForIdToken).mockResolvedValue("id-token");
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: "google-sub-2",
      email: "hanako@example.com",
      name: "花子",
    });
    vi.mocked(findUserByGoogleSub).mockResolvedValue({ id: 2, family_id: 10 });

    const result = await loginWithGoogleCode("auth-code", fakeEnv);

    expect(createUserWithDefaultNotificationSettings).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, expiresAt: fakeExpiresAt }),
    );
    expect(result.hasFamily).toBe(true);
  });

  it("id_tokenの検証に失敗したとき、AppErrorをそのまま伝播しセッションを発行しない", async () => {
    vi.mocked(exchangeCodeForIdToken).mockResolvedValue("id-token");
    vi.mocked(verifyGoogleIdToken).mockRejectedValue(
      new AppError("VALIDATION_ERROR", 400, "ログインに失敗しました。もう一度お試しください。"),
    );

    await expect(loginWithGoogleCode("auth-code", fakeEnv)).rejects.toThrow(AppError);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("auth/service verifySession", () => {
  describe("セッションIDが無いとき", () => {
    it("AppError(UNAUTHORIZED) を投げる", async () => {
      await expect(verifySession(undefined)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(findUserBySessionId).not.toHaveBeenCalled();
    });
  });

  describe("セッションが存在しない・期限切れのとき", () => {
    it("AppError(UNAUTHORIZED) を投げ、有効期限は延長しない", async () => {
      vi.mocked(findUserBySessionId).mockResolvedValue(null);

      await expect(verifySession("expired-session")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(extendSessionExpiry).not.toHaveBeenCalled();
    });
  });

  describe("有効なセッションのとき", () => {
    it("有効期限を延長し、ユーザー情報を返す", async () => {
      vi.mocked(findUserBySessionId).mockResolvedValue({ id: 5, family_id: 20 });

      const result = await verifySession("valid-session");

      expect(extendSessionExpiry).toHaveBeenCalledWith("valid-session");
      expect(result).toEqual({ id: 5, familyId: 20 });
    });
  });
});

describe("auth/service logout", () => {
  it("対応するセッションを削除する", async () => {
    await logout("session-to-delete");
    expect(deleteSession).toHaveBeenCalledWith("session-to-delete");
  });
});
