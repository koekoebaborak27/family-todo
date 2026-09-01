import { describe, expect, it } from "vitest";
import {
  assigneeLabel,
  emptyStateMessage,
  formatCommentDate,
  formatCompletedInfo,
  formatCreatedInfo,
  formatDueAt,
  isOverdue,
  recurrenceDetailLabel,
  recurrenceLabel,
  sortTodos,
} from "./service";
import type { RecurrenceType, Todo, TodoAssignee, TodoDetail } from "./types";

/**
 * 対象: todo/service
 * 目的: ToDo一覧画面の表示整形（期限・完了情報・担当者名・空状態文言・繰り返し文言）と、
 *       並び替えロジック（期限/優先度/担当者の昇順・降順、値なしの末尾集約、作成日時によるタイブレーク）を
 *       docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.4」「3.6」「3.7」のとおりに担保する。
 */

// テスト用のToDoファクトリ。差分だけ override する。
function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    title: "サンプルToDo",
    memo: null,
    dueAt: null,
    dueHasTime: false,
    priority: "medium",
    categoryId: 1,
    status: "incomplete",
    recurrenceType: "none",
    assignees: [],
    commentCount: 0,
    completedByDisplayName: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function makeAssignee(displayName: string, overrides: Partial<TodoAssignee> = {}): TodoAssignee {
  return { type: "user", id: 1, displayName, ...overrides };
}

// テスト用のToDo詳細ファクトリ。差分だけ override する。
function makeTodoDetail(overrides: Partial<TodoDetail> = {}): TodoDetail {
  return {
    ...makeTodo(),
    recurrenceConfig: null,
    assignees: [],
    createdByDisplayName: "太郎",
    comments: [],
    ...overrides,
  };
}

describe("todo/service recurrenceLabel", () => {
  it("noneのときはnullを返す", () => {
    expect(recurrenceLabel("none")).toBeNull();
  });

  it("dailyのときは「毎日」を返す", () => {
    expect(recurrenceLabel("daily")).toBe("毎日");
  });

  it("weeklyのときは「毎週」を返す", () => {
    expect(recurrenceLabel("weekly")).toBe("毎週");
  });

  it("monthlyのときは「毎月」を返す", () => {
    expect(recurrenceLabel("monthly")).toBe("毎月");
  });
});

describe("todo/service recurrenceDetailLabel", () => {
  describe("recurrenceTypeがnoneのとき", () => {
    it("「なし」を返す", () => {
      const todo = makeTodoDetail({ recurrenceType: "none" });
      expect(recurrenceDetailLabel(todo)).toBe("なし");
    });
  });

  describe("recurrenceTypeがdailyのとき", () => {
    it("「毎日」を返す", () => {
      const todo = makeTodoDetail({ recurrenceType: "daily" });
      expect(recurrenceDetailLabel(todo)).toBe("毎日");
    });
  });

  describe("recurrenceTypeがweeklyのとき", () => {
    it("recurrenceConfigに曜日があれば「毎週 月・水」のように曜日を連結して返す", () => {
      const todo = makeTodoDetail({
        recurrenceType: "weekly",
        recurrenceConfig: { weekdays: [1, 3] },
      });
      expect(recurrenceDetailLabel(todo)).toBe("毎週 月・水");
    });

    it("recurrenceConfigが無ければ「毎週」のみを返す", () => {
      const todo = makeTodoDetail({ recurrenceType: "weekly", recurrenceConfig: null });
      expect(recurrenceDetailLabel(todo)).toBe("毎週");
    });
  });

  describe("recurrenceTypeがmonthlyのとき", () => {
    it("recurrenceConfigに日付があれば「毎月 15日」のように返す", () => {
      const todo = makeTodoDetail({
        recurrenceType: "monthly",
        recurrenceConfig: { day: 15 },
      });
      expect(recurrenceDetailLabel(todo)).toBe("毎月 15日");
    });

    it("recurrenceConfigが無ければ「毎月」のみを返す", () => {
      const todo = makeTodoDetail({ recurrenceType: "monthly", recurrenceConfig: null });
      expect(recurrenceDetailLabel(todo)).toBe("毎月");
    });
  });

  describe("recurrenceTypeが想定外の値のとき", () => {
    it("「なし」を返す", () => {
      const todo = makeTodoDetail({ recurrenceType: "yearly" as RecurrenceType });
      expect(recurrenceDetailLabel(todo)).toBe("なし");
    });
  });
});

describe("todo/service formatDueAt", () => {
  describe("時刻指定が無いとき", () => {
    it("「M/D(曜日)」の形式で返す", () => {
      expect(formatDueAt("2026-09-03T00:00:00", false)).toBe("9/3(木)");
    });
  });

  describe("時刻指定が有るとき", () => {
    it("「M/D(曜日) HH:MM」の形式で返す", () => {
      expect(formatDueAt("2026-09-03T18:05:00", true)).toBe("9/3(木) 18:05");
    });
  });
});

describe("todo/service formatCompletedInfo", () => {
  it("「表示名 が M/D(曜日) に完了」の形式で返す", () => {
    expect(formatCompletedInfo("太郎", "2026-09-01T10:00:00")).toBe("太郎 が 9/1(火) に完了");
  });
});

describe("todo/service formatCreatedInfo", () => {
  it("「表示名 が M/D(曜日) に作成」の形式で返す", () => {
    expect(formatCreatedInfo("太郎", "2026-09-01T10:00:00")).toBe("太郎 が 9/1(火) に作成");
  });
});

describe("todo/service formatCommentDate", () => {
  it("「M/D(曜日) HH:MM」の形式で返す", () => {
    expect(formatCommentDate("2026-09-03T18:05:00")).toBe("9/3(木) 18:05");
  });
});

describe("todo/service isOverdue", () => {
  describe("未完了かつ期限が過去のとき", () => {
    it("trueを返す", () => {
      const todo = makeTodo({
        status: "incomplete",
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect(isOverdue(todo)).toBe(true);
    });
  });

  describe("未完了かつ期限が未来のとき", () => {
    it("falseを返す", () => {
      const todo = makeTodo({
        status: "incomplete",
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });
      expect(isOverdue(todo)).toBe(false);
    });
  });

  describe("期限が無いとき", () => {
    it("falseを返す", () => {
      const todo = makeTodo({ status: "incomplete", dueAt: null });
      expect(isOverdue(todo)).toBe(false);
    });
  });

  describe("完了済みで期限が過去のとき", () => {
    it("falseを返す", () => {
      const todo = makeTodo({
        status: "completed",
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect(isOverdue(todo)).toBe(false);
    });
  });
});

describe("todo/service assigneeLabel", () => {
  describe("登録済みメンバーのとき", () => {
    it("表示名をそのまま返す", () => {
      expect(assigneeLabel(makeAssignee("太郎", { type: "user" }))).toBe("太郎");
    });
  });

  describe("非登録メンバーのとき", () => {
    it("表示名の後ろに「(未登録)」を付ける", () => {
      expect(assigneeLabel(makeAssignee("花子", { type: "unregistered" }))).toBe("花子(未登録)");
    });
  });
});

describe("todo/service emptyStateMessage", () => {
  describe("カテゴリで絞り込んでいるとき", () => {
    it("完了状態にかかわらず「このカテゴリのToDoはありません。」を返す", () => {
      expect(emptyStateMessage("incomplete", true)).toBe("このカテゴリのToDoはありません。");
      expect(emptyStateMessage("completed", true)).toBe("このカテゴリのToDoはありません。");
    });
  });

  describe("絞り込みが無いとき", () => {
    it("未完了タブなら「未完了のToDoはありません。右下のボタンから追加できます。」を返す", () => {
      expect(emptyStateMessage("incomplete", false)).toBe(
        "未完了のToDoはありません。右下のボタンから追加できます。",
      );
    });

    it("完了タブなら「完了したToDoはまだありません。」を返す", () => {
      expect(emptyStateMessage("completed", false)).toBe("完了したToDoはまだありません。");
    });
  });
});

describe("todo/service sortTodos", () => {
  describe("並び替える項目が期限のとき", () => {
    describe("昇順のとき", () => {
      it("期限が早い順に並べる", () => {
        const early = makeTodo({ id: 1, dueAt: "2026-09-01T00:00:00" });
        const middle = makeTodo({ id: 2, dueAt: "2026-09-03T00:00:00" });
        const late = makeTodo({ id: 3, dueAt: "2026-09-05T00:00:00" });
        const sorted = sortTodos([late, early, middle], "due", "asc");
        expect(sorted.map((t) => t.id)).toEqual([1, 2, 3]);
      });

      it("期限なしのToDoを末尾にまとめる", () => {
        const withDue = makeTodo({ id: 1, dueAt: "2026-09-01T00:00:00" });
        const noDue = makeTodo({ id: 2, dueAt: null });
        const sorted = sortTodos([noDue, withDue], "due", "asc");
        expect(sorted.map((t) => t.id)).toEqual([1, 2]);
      });
    });

    describe("降順のとき", () => {
      it("期限が遅い順に並べる", () => {
        const early = makeTodo({ id: 1, dueAt: "2026-09-01T00:00:00" });
        const middle = makeTodo({ id: 2, dueAt: "2026-09-03T00:00:00" });
        const late = makeTodo({ id: 3, dueAt: "2026-09-05T00:00:00" });
        const sorted = sortTodos([early, late, middle], "due", "desc");
        expect(sorted.map((t) => t.id)).toEqual([3, 2, 1]);
      });

      it("期限なしのToDoを末尾にまとめる", () => {
        const withDue = makeTodo({ id: 1, dueAt: "2026-09-01T00:00:00" });
        const noDue = makeTodo({ id: 2, dueAt: null });
        const sorted = sortTodos([noDue, withDue], "due", "desc");
        expect(sorted.map((t) => t.id)).toEqual([1, 2]);
      });
    });
  });

  describe("並び替える項目が優先度のとき", () => {
    describe("昇順のとき", () => {
      it("低→中→高の順に並べる", () => {
        const high = makeTodo({ id: 1, priority: "high" });
        const low = makeTodo({ id: 2, priority: "low" });
        const medium = makeTodo({ id: 3, priority: "medium" });
        const sorted = sortTodos([high, low, medium], "priority", "asc");
        expect(sorted.map((t) => t.id)).toEqual([2, 3, 1]);
      });
    });

    describe("降順のとき", () => {
      it("高→中→低の順に並べる", () => {
        const high = makeTodo({ id: 1, priority: "high" });
        const low = makeTodo({ id: 2, priority: "low" });
        const medium = makeTodo({ id: 3, priority: "medium" });
        const sorted = sortTodos([low, high, medium], "priority", "desc");
        expect(sorted.map((t) => t.id)).toEqual([1, 3, 2]);
      });
    });
  });

  describe("並び替える項目が担当者のとき", () => {
    describe("昇順のとき", () => {
      it("担当者名の五十音順に並べる", () => {
        const sakura = makeTodo({ id: 1, assignees: [makeAssignee("さくら")] });
        const aoi = makeTodo({ id: 2, assignees: [makeAssignee("あおい")] });
        const kaede = makeTodo({ id: 3, assignees: [makeAssignee("かえで")] });
        const sorted = sortTodos([sakura, aoi, kaede], "assignee", "asc");
        expect(sorted.map((t) => t.id)).toEqual([2, 3, 1]);
      });

      it("担当者が複数いる場合は五十音順で先頭になる名前で比較する", () => {
        // 複数担当（さくら・あおい）は先頭名「あおい」で比較され、単独担当「かえで」より先になる。
        const multi = makeTodo({
          id: 1,
          assignees: [makeAssignee("さくら"), makeAssignee("あおい")],
        });
        const single = makeTodo({ id: 2, assignees: [makeAssignee("かえで")] });
        const sorted = sortTodos([single, multi], "assignee", "asc");
        expect(sorted.map((t) => t.id)).toEqual([1, 2]);
      });

      it("担当者なしのToDoを末尾にまとめる", () => {
        const withAssignee = makeTodo({ id: 1, assignees: [makeAssignee("あおい")] });
        const noAssignee = makeTodo({ id: 2, assignees: [] });
        const sorted = sortTodos([noAssignee, withAssignee], "assignee", "asc");
        expect(sorted.map((t) => t.id)).toEqual([1, 2]);
      });
    });

    describe("降順のとき", () => {
      it("担当者名の五十音順の逆に並べる", () => {
        const sakura = makeTodo({ id: 1, assignees: [makeAssignee("さくら")] });
        const aoi = makeTodo({ id: 2, assignees: [makeAssignee("あおい")] });
        const kaede = makeTodo({ id: 3, assignees: [makeAssignee("かえで")] });
        const sorted = sortTodos([aoi, kaede, sakura], "assignee", "desc");
        expect(sorted.map((t) => t.id)).toEqual([1, 3, 2]);
      });

      it("担当者なしのToDoを末尾にまとめる", () => {
        const withAssignee = makeTodo({ id: 1, assignees: [makeAssignee("あおい")] });
        const noAssignee = makeTodo({ id: 2, assignees: [] });
        const sorted = sortTodos([noAssignee, withAssignee], "assignee", "desc");
        expect(sorted.map((t) => t.id)).toEqual([1, 2]);
      });
    });
  });

  describe("並び替えた結果が同じ値になったとき", () => {
    it("値がある場合は、作成日時が新しい順にする", () => {
      const older = makeTodo({
        id: 1,
        priority: "medium",
        createdAt: "2026-01-01T00:00:00",
      });
      const newer = makeTodo({
        id: 2,
        priority: "medium",
        createdAt: "2026-06-01T00:00:00",
      });
      const sorted = sortTodos([older, newer], "priority", "asc");
      expect(sorted.map((t) => t.id)).toEqual([2, 1]);
    });

    it("値が両方無い場合も、作成日時が新しい順にする", () => {
      const older = makeTodo({ id: 1, dueAt: null, createdAt: "2026-01-01T00:00:00" });
      const newer = makeTodo({ id: 2, dueAt: null, createdAt: "2026-06-01T00:00:00" });
      const sorted = sortTodos([older, newer], "due", "asc");
      expect(sorted.map((t) => t.id)).toEqual([2, 1]);
    });
  });
});
