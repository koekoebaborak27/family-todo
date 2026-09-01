import { describe, expect, it } from "vitest";
import { isIosUserAgent, shouldShowInstallBanner } from "./service";

/**
 * 対象: ios-install-guide/service
 * 目的: iOSインストール案内バナーの表示条件（iOS判定・表示条件の3条件すべて）を担保する。
 */
describe("ios-install-guide/service isIosUserAgent", () => {
  it("iPhoneのUser-Agentならtrueを返す", () => {
    expect(
      isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"),
    ).toBe(true);
  });

  it("iPadのUser-Agentならtrueを返す", () => {
    expect(
      isIosUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15"),
    ).toBe(true);
  });

  it("AndroidのUser-Agentならfalseを返す", () => {
    expect(isIosUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36")).toBe(
      false,
    );
  });
});

describe("ios-install-guide/service shouldShowInstallBanner", () => {
  const now = new Date("2026-09-01T00:00:00Z").getTime();

  describe("iOSでない場合", () => {
    it("falseを返す", () => {
      expect(
        shouldShowInstallBanner({ isIos: false, isStandalone: false, dismissedAt: null, now }),
      ).toBe(false);
    });
  });

  describe("iOSだがホーム画面に追加済み（standalone）の場合", () => {
    it("falseを返す", () => {
      expect(
        shouldShowInstallBanner({ isIos: true, isStandalone: true, dismissedAt: null, now }),
      ).toBe(false);
    });
  });

  describe("iOSかつ未追加で、一度も閉じていない場合", () => {
    it("trueを返す", () => {
      expect(
        shouldShowInstallBanner({ isIos: true, isStandalone: false, dismissedAt: null, now }),
      ).toBe(true);
    });
  });

  describe("iOSかつ未追加で、閉じてから7日未満の場合", () => {
    it("falseを返す", () => {
      const dismissedAt = now - 6 * 24 * 60 * 60 * 1000;
      expect(shouldShowInstallBanner({ isIos: true, isStandalone: false, dismissedAt, now })).toBe(
        false,
      );
    });
  });

  describe("iOSかつ未追加で、閉じてからちょうど7日経過した場合", () => {
    it("trueを返す", () => {
      const dismissedAt = now - 7 * 24 * 60 * 60 * 1000;
      expect(shouldShowInstallBanner({ isIos: true, isStandalone: false, dismissedAt, now })).toBe(
        true,
      );
    });
  });

  describe("iOSかつ未追加で、閉じてから7日を超えた場合", () => {
    it("trueを返す", () => {
      const dismissedAt = now - 8 * 24 * 60 * 60 * 1000;
      expect(shouldShowInstallBanner({ isIos: true, isStandalone: false, dismissedAt, now })).toBe(
        true,
      );
    });
  });
});
