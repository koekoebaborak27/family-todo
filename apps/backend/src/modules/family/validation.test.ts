import { describe, expect, it } from "vitest";
import { createFamilySchema, joinFamilySchema } from "./validation";

/**
 * 対象: family/validation createFamilySchema・joinFamilySchema
 * 目的: POST /families・POST /families/join の入力チェック（文字数上限・招待コードの形式）を担保する。
 */
describe("family/validation createFamilySchema", () => {
  it("30文字以内のnameなら検証を通す", () => {
    const result = createFamilySchema.safeParse({ name: "山田家" });
    expect(result.success).toBe(true);
  });

  describe("nameが空のとき", () => {
    it("「グループ名を入力してください。」で検証を弾く", () => {
      const result = createFamilySchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("グループ名を入力してください。");
    });

    it("空白のみでも検証を弾く", () => {
      const result = createFamilySchema.safeParse({ name: "   " });
      expect(result.success).toBe(false);
    });
  });

  describe("nameが30文字を超えるとき", () => {
    it("「グループ名は30文字以内で入力してください。」で検証を弾く", () => {
      const result = createFamilySchema.safeParse({ name: "あ".repeat(31) });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("グループ名は30文字以内で入力してください。");
    });

    it("ちょうど30文字なら検証を通す", () => {
      const result = createFamilySchema.safeParse({ name: "あ".repeat(30) });
      expect(result.success).toBe(true);
    });
  });
});

describe("family/validation joinFamilySchema", () => {
  it("半角英数字8桁（大文字）のinviteCodeなら検証を通す", () => {
    const result = joinFamilySchema.safeParse({ inviteCode: "A3F9K2QP" });
    expect(result.success).toBe(true);
  });

  describe("inviteCodeが空のとき", () => {
    it("「招待コードを入力してください。」で検証を弾く", () => {
      const result = joinFamilySchema.safeParse({ inviteCode: "" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("招待コードを入力してください。");
    });
  });

  describe("inviteCodeが半角英数字8桁でないとき", () => {
    it("桁数が足りなければ「招待コードは半角英数字8桁で入力してください。」で弾く", () => {
      const result = joinFamilySchema.safeParse({ inviteCode: "A3F9K2Q" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "招待コードは半角英数字8桁で入力してください。",
      );
    });

    it("小文字を含む場合は弾く（大文字化はフロント側の責務）", () => {
      const result = joinFamilySchema.safeParse({ inviteCode: "a3f9k2qp" });
      expect(result.success).toBe(false);
    });

    it("記号を含む場合は弾く", () => {
      const result = joinFamilySchema.safeParse({ inviteCode: "A3F9-2QP" });
      expect(result.success).toBe(false);
    });
  });
});
