import { describe, expect, it } from "vitest";
import { DUE_TIME_LABELS, REMIND_BEFORE_LABELS, validateDisplayName } from "./service";

/**
 * 対象: settings/service
 * 目的: 個人設定の表示名入力チェックと、選択値を日本語で表示する対応を担保する。
 */
describe("settings/service validateDisplayName", () => {
  describe("表示名が空白のみのとき", () => {
    it("「表示名を入力してください。」を返す", () => {
      expect(validateDisplayName("  ")).toBe("表示名を入力してください。");
    });
  });

  describe("表示名が20文字を超えるとき", () => {
    it("「表示名は20文字以内で入力してください。」を返す", () => {
      expect(validateDisplayName("あ".repeat(21))).toBe("表示名は20文字以内で入力してください。");
    });

    it("ちょうど20文字ならnullを返す", () => {
      expect(validateDisplayName("あ".repeat(20))).toBeNull();
    });
  });

  it("20文字以内ならnullを返す", () => {
    expect(validateDisplayName("山田花子")).toBeNull();
  });
});

describe("settings/service 選択値の表示", () => {
  it("リマインド値を日本語ラベルへ変換する", () => {
    expect(REMIND_BEFORE_LABELS["1:days"]).toBe("1日前");
  });

  it("基準時刻を日本語ラベルへ変換する", () => {
    expect(DUE_TIME_LABELS["20:00"]).toBe("20:00");
  });
});
