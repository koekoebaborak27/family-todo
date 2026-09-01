import { describe, expect, it } from "vitest";
import {
  validateFamilyName,
  validateInviteCode,
  validateUnregisteredMemberName,
} from "./validation";

/**
 * 対象: family/validation
 * 目的: 家族グループ作成・参加画面の入力チェック（文字数上限・招待コードの形式）を担保する。
 */
describe("family/validation validateFamilyName", () => {
  it("30文字以内ならnullを返す（エラー無し）", () => {
    expect(validateFamilyName("山田家")).toBeNull();
  });

  describe("未入力のとき", () => {
    it("「グループ名を入力してください。」を返す", () => {
      expect(validateFamilyName("")).toBe("グループ名を入力してください。");
    });

    it("空白のみでも未入力扱いにする", () => {
      expect(validateFamilyName("   ")).toBe("グループ名を入力してください。");
    });
  });

  describe("30文字を超えるとき", () => {
    it("「グループ名は30文字以内で入力してください。」を返す", () => {
      expect(validateFamilyName("あ".repeat(31))).toBe(
        "グループ名は30文字以内で入力してください。",
      );
    });

    it("ちょうど30文字ならnullを返す", () => {
      expect(validateFamilyName("あ".repeat(30))).toBeNull();
    });
  });
});

describe("family/validation validateInviteCode", () => {
  it("半角英数字8桁（大文字）ならnullを返す（エラー無し）", () => {
    expect(validateInviteCode("A3F9K2QP")).toBeNull();
  });

  describe("未入力のとき", () => {
    it("「招待コードを入力してください。」を返す", () => {
      expect(validateInviteCode("")).toBe("招待コードを入力してください。");
    });
  });

  describe("半角英数字8桁でないとき", () => {
    it("桁数が足りなければ「招待コードは半角英数字8桁で入力してください。」を返す", () => {
      expect(validateInviteCode("A3F9K2Q")).toBe("招待コードは半角英数字8桁で入力してください。");
    });

    it("小文字を含む場合はエラーを返す", () => {
      expect(validateInviteCode("a3f9k2qp")).toBe("招待コードは半角英数字8桁で入力してください。");
    });
  });
});

describe("family/validation validateUnregisteredMemberName", () => {
  describe("未入力のとき", () => {
    it("「名前を入力してください。」を返す", () => {
      expect(validateUnregisteredMemberName("  ")).toBe("名前を入力してください。");
    });
  });

  describe("20文字を超えるとき", () => {
    it("「名前は20文字以内で入力してください。」を返す", () => {
      expect(validateUnregisteredMemberName("あ".repeat(21))).toBe(
        "名前は20文字以内で入力してください。",
      );
    });
  });
});
