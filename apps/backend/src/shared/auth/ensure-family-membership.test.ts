import { describe, expect, it } from "vitest";
import { ensureFamilyMembership } from "./ensure-family-membership";

/**
 * 対象: shared/auth/ensure-family-membership ensureFamilyMembership
 * 目的: グループ所属者専用APIの入口で使う権限判定（未所属なら403、所属していれば
 *       所属グループのidを返す）を担保する。
 */
describe("shared/auth/ensure-family-membership ensureFamilyMembership", () => {
  describe("familyIdがnullのとき（グループ未所属）", () => {
    it("AppError(FORBIDDEN) を投げる", () => {
      expect(() => ensureFamilyMembership({ familyId: null })).toThrowError(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
    });
  });

  describe("familyIdが設定されているとき（グループ所属済み）", () => {
    it("そのfamilyIdをそのまま返す", () => {
      const result = ensureFamilyMembership({ familyId: 42 });
      expect(result).toBe(42);
    });
  });
});
