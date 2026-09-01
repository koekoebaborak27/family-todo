import { describe, expect, it } from "vitest";
import { googleCallbackSchema } from "./validation";

/**
 * 対象: auth/validation googleCallbackSchema
 * 目的: POST /auth/google/callback の入力チェック（認可コード必須）を担保する。
 */
describe("auth/validation googleCallbackSchema", () => {
  it("codeが入っていれば検証を通す", () => {
    const result = googleCallbackSchema.safeParse({ code: "auth-code" });
    expect(result.success).toBe(true);
  });

  describe("codeが無い・空文字のとき", () => {
    it("codeが未指定なら検証を弾く", () => {
      const result = googleCallbackSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("codeが空文字なら検証を弾く", () => {
      const result = googleCallbackSchema.safeParse({ code: "" });
      expect(result.success).toBe(false);
    });
  });
});
