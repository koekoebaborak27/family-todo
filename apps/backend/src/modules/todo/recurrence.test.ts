import { describe, expect, it } from "vitest";
import { calculateNextDueAt } from "./recurrence";

/**
 * 対象: todo/recurrence calculateNextDueAt
 * 目的: 繰り返しToDoを完了にしたときの次回due_atの計算
 *       （docs/specs/03_detail-design/family-todo/10_繰り返しToDoの期限計算.md）を担保する。
 *       JST基準の日付計算・境界値（毎週の同一曜日のみ選択・毎月の月末はみ出し・年またぎ）を確認する。
 */

describe("todo/recurrence calculateNextDueAt", () => {
  describe("daily", () => {
    it("時刻なしのとき、翌日の00:00 JSTへ進める", () => {
      // due_at: JST 2026-09-03 00:00 → UTC 2026-09-02T15:00:00.000Z
      const result = calculateNextDueAt("2026-09-02T15:00:00.000Z", false, "daily", null);
      // 期待: JST 2026-09-04 00:00 → UTC 2026-09-03T15:00:00.000Z
      expect(result).toBe("2026-09-03T15:00:00.000Z");
    });

    it("時刻ありのとき、時刻を保ったまま翌日へ進める", () => {
      // due_at: JST 2026-09-03 18:30 → UTC 2026-09-03T09:30:00.000Z
      const result = calculateNextDueAt("2026-09-03T09:30:00.000Z", true, "daily", null);
      // 期待: JST 2026-09-04 18:30 → UTC 2026-09-04T09:30:00.000Z
      expect(result).toBe("2026-09-04T09:30:00.000Z");
    });
  });

  describe("weekly", () => {
    it("選択曜日が複数あり、今週分がまだ残っているとき、直後の曜日へ進める", () => {
      // 2026-09-03(木)。月(1)・木(4)を選択 → 直後は月曜（+4日）
      const dueAt = "2026-09-02T15:00:00.000Z"; // JST 2026-09-03(木) 00:00
      const result = calculateNextDueAt(dueAt, false, "weekly", { weekdays: [1, 4] });
      // 期待: 次の月曜 = JST 2026-09-07 00:00 → UTC 2026-09-06T15:00:00.000Z
      expect(result).toBe("2026-09-06T15:00:00.000Z");
    });

    it("選択曜日が1つだけで、それが現在の期限と同じ曜日のとき、翌週の同じ曜日へ進める", () => {
      const dueAt = "2026-09-02T15:00:00.000Z"; // JST 2026-09-03(木) 00:00
      const result = calculateNextDueAt(dueAt, false, "weekly", { weekdays: [4] });
      // 期待: 翌週の木曜 = JST 2026-09-10 00:00 → UTC 2026-09-09T15:00:00.000Z
      expect(result).toBe("2026-09-09T15:00:00.000Z");
    });
  });

  describe("monthly", () => {
    it("翌月に同じ日付が存在するとき、翌月の同じ日にする", () => {
      const dueAt = "2026-09-14T15:00:00.000Z"; // JST 2026-09-15 00:00
      const result = calculateNextDueAt(dueAt, false, "monthly", { day: 15 });
      // 期待: JST 2026-10-15 00:00 → UTC 2026-10-14T15:00:00.000Z
      expect(result).toBe("2026-10-14T15:00:00.000Z");
    });

    it("翌月にその日付が存在しないとき、翌月の末日にする", () => {
      const dueAt = "2026-01-30T15:00:00.000Z"; // JST 2026-01-31 00:00
      const result = calculateNextDueAt(dueAt, false, "monthly", { day: 31 });
      // 翌月=2026年2月（28日まで）。期待: JST 2026-02-28 00:00 → UTC 2026-02-27T15:00:00.000Z
      expect(result).toBe("2026-02-27T15:00:00.000Z");
    });

    it("12月から1月への年またぎでも正しく計算する", () => {
      const dueAt = "2026-12-14T15:00:00.000Z"; // JST 2026-12-15 00:00
      const result = calculateNextDueAt(dueAt, false, "monthly", { day: 15 });
      // 期待: JST 2027-01-15 00:00 → UTC 2027-01-14T15:00:00.000Z
      expect(result).toBe("2027-01-14T15:00:00.000Z");
    });
  });
});
