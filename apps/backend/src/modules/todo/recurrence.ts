import type { RecurrenceType, TodoDetail } from "./types";

type RecurrenceConfig = TodoDetail["recurrenceConfig"];

// 日付・曜日の判定はJST（UTC+9）で行う
// （docs/specs/03_detail-design/family-todo/10_繰り返しToDoの期限計算.md「前提」）。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// UTC保存のdue_atを、JSTの暦（年月日・曜日・時刻）として扱えるDateへ変換する。
// UTCのgetter/setterをそのまま使うことで、実行環境のタイムゾーンに依存させない。
function toJstDate(dueAtUtc: string): Date {
  return new Date(new Date(dueAtUtc).getTime() + JST_OFFSET_MS);
}

// JSTの暦として組み立てたDateを、UTCのISO 8601文字列（due_at保存用）へ戻す。
function toUtcIso(jstDate: Date): string {
  return new Date(jstDate.getTime() - JST_OFFSET_MS).toISOString();
}

// 繰り返し設定のあるToDoを完了にしたときの、次回のdue_atを求める
// （docs/specs/03_detail-design/family-todo/10_繰り返しToDoの期限計算.md）。
export function calculateNextDueAt(
  dueAtUtc: string,
  dueHasTime: boolean,
  recurrenceType: Exclude<RecurrenceType, "none">,
  recurrenceConfig: RecurrenceConfig | null,
): string {
  const jstDate = toJstDate(dueAtUtc);

  if (recurrenceType === "daily") {
    jstDate.setUTCDate(jstDate.getUTCDate() + 1);
  } else if (recurrenceType === "weekly") {
    const weekdays =
      recurrenceConfig && "weekdays" in recurrenceConfig ? recurrenceConfig.weekdays : [];
    const currentWeekday = jstDate.getUTCDay();
    const diffsAfter = weekdays
      .map((weekday) => (weekday - currentWeekday + 7) % 7)
      .filter((diff) => diff > 0);
    const diff = diffsAfter.length > 0 ? Math.min(...diffsAfter) : 7;
    jstDate.setUTCDate(jstDate.getUTCDate() + diff);
  } else {
    const day = recurrenceConfig && "day" in recurrenceConfig ? recurrenceConfig.day : 1;
    const targetYear = jstDate.getUTCFullYear();
    const targetMonth = jstDate.getUTCMonth() + 1; // 翌月（JSの月またぎはDate.UTCが自動で正規化する）
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    jstDate.setUTCFullYear(targetYear, targetMonth, Math.min(day, lastDayOfTargetMonth));
  }

  if (!dueHasTime) {
    jstDate.setUTCHours(0, 0, 0, 0);
  }

  return toUtcIso(jstDate);
}
