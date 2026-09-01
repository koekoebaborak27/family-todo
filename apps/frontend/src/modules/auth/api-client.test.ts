import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeGoogleCode, fetchMe, LoginError } from "./api-client";

/**
 * 対象: auth/api-client
 * 目的: BackendのステータスコードをFrontendの状態（未ログイン/成功/エラー文言）へ
 *       正しく変換できることを担保する。
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

describe("auth/api-client fetchMe", () => {
  describe("401が返るとき", () => {
    it("authenticated: false を返す", async () => {
      mockFetchOnce({ ok: false, status: 401 });
      await expect(fetchMe()).resolves.toEqual({ authenticated: false });
    });
  });

  describe("200が返るとき", () => {
    it("authenticated: true と所属グループの有無を返す", async () => {
      mockFetchOnce({ ok: true, status: 200, json: async () => ({ hasFamily: true }) });
      await expect(fetchMe()).resolves.toEqual({ authenticated: true, hasFamily: true });
    });
  });

  describe("500系が返るとき", () => {
    it("サーバーエラーのLoginErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(fetchMe()).rejects.toThrow(
        "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
      );
    });
  });

  describe("通信自体に失敗したとき", () => {
    it("通信エラーのLoginErrorを投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));
      await expect(fetchMe()).rejects.toThrow(
        "通信に失敗しました。電波状況を確認してもう一度お試しください。",
      );
    });
  });
});

describe("auth/api-client exchangeGoogleCode", () => {
  describe("200が返るとき", () => {
    it("所属グループの有無を返す", async () => {
      mockFetchOnce({ ok: true, status: 200, json: async () => ({ hasFamily: false }) });
      await expect(exchangeGoogleCode("auth-code")).resolves.toEqual({ hasFamily: false });
    });
  });

  describe("400が返るとき", () => {
    it("認可コード不正のLoginErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 400 });
      await expect(exchangeGoogleCode("bad-code")).rejects.toThrow(
        "ログインに失敗しました。もう一度お試しください。",
      );
    });
  });

  describe("500系が返るとき", () => {
    it("サーバーエラーのLoginErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(exchangeGoogleCode("auth-code")).rejects.toThrow(LoginError);
    });
  });
});
