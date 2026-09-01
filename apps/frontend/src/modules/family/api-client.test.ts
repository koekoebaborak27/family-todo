import { afterEach, describe, expect, it, vi } from "vitest";
import { createFamily, joinFamily } from "./api-client";

/**
 * 対象: family/api-client
 * 目的: BackendのステータスコードをFrontendの状態（成功/エラー文言/表示場所）へ
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

describe("family/api-client createFamily", () => {
  describe("201が返るとき", () => {
    it("作成したグループの情報を返す", async () => {
      mockFetchOnce({ ok: true, status: 201, json: async () => ({ id: 1, name: "山田家" }) });
      await expect(createFamily("山田家")).resolves.toEqual({ id: 1, name: "山田家" });
    });
  });

  describe("400が返るとき", () => {
    it("Backendの文言のまま、field配置のFamilyErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: "VALIDATION_ERROR", message: "入力エラー" } }),
      });
      await expect(createFamily("不正な名前")).rejects.toMatchObject({
        message: "入力エラー",
        placement: "field",
      });
    });
  });

  describe("409が返るとき", () => {
    it("top配置のFamilyErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: { code: "CONFLICT", message: "すでに家族グループに参加しています。" },
        }),
      });
      await expect(createFamily("山田家")).rejects.toMatchObject({
        message: "すでに家族グループに参加しています。",
        placement: "top",
      });
    });
  });

  describe("401が返るとき", () => {
    it("top配置で、セッション切れの文言のFamilyErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 401 });
      await expect(createFamily("山田家")).rejects.toMatchObject({
        message: "ログインの有効期限が切れました。もう一度ログインしてください。",
        placement: "top",
      });
    });
  });

  describe("500系が返るとき", () => {
    it("top配置で、サーバーエラーの文言のFamilyErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(createFamily("山田家")).rejects.toMatchObject({
        message: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
        placement: "top",
      });
    });
  });

  describe("通信自体に失敗したとき", () => {
    it("top配置で、通信エラーの文言のFamilyErrorを投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));
      await expect(createFamily("山田家")).rejects.toMatchObject({
        message: "通信に失敗しました。電波状況を確認してもう一度お試しください。",
        placement: "top",
      });
    });
  });
});

describe("family/api-client joinFamily", () => {
  describe("200が返るとき", () => {
    it("参加したグループの情報を返す", async () => {
      mockFetchOnce({ ok: true, status: 200, json: async () => ({ id: 2, name: "鈴木家" }) });
      await expect(joinFamily("A3F9K2QP")).resolves.toEqual({ id: 2, name: "鈴木家" });
    });
  });

  describe("404が返るとき", () => {
    it("field配置で、招待コード不正の文言のFamilyErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: "NOT_FOUND",
            message: "招待コードが正しくありません。家族に確認してください。",
          },
        }),
      });
      await expect(joinFamily("A3F9K2QP")).rejects.toMatchObject({
        message: "招待コードが正しくありません。家族に確認してください。",
        placement: "field",
      });
    });
  });

  describe("400が返るとき", () => {
    it("field配置で、有効期限切れの文言のFamilyErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "この招待コードは有効期限が切れています。家族に招待リンクを再発行してもらってください。",
          },
        }),
      });
      await expect(joinFamily("A3F9K2QP")).rejects.toMatchObject({ placement: "field" });
    });
  });

  describe("409が返るとき", () => {
    it("top配置のFamilyErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: { code: "CONFLICT", message: "すでに家族グループに参加しています。" },
        }),
      });
      await expect(joinFamily("A3F9K2QP")).rejects.toMatchObject({ placement: "top" });
    });
  });
});
