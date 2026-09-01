import { describe, expect, it } from "vitest";
import {
  commentSchema,
  createTodoSchema,
  listTodosQuerySchema,
  replaceAssigneesSchema,
} from "./validation";

/**
 * 対象: todo/validation listTodosQuerySchema
 * 目的: GET /todos のクエリパラメータの検証（statusのenum・既定値、category_idの型変換）を担保する。
 */
describe("todo/validation listTodosQuerySchema", () => {
  describe("statusが省略されたとき", () => {
    it("既定値としてincompleteが入る", () => {
      const result = listTodosQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe("incomplete");
    });
  });

  describe("statusが「incomplete」または「completed」のとき", () => {
    it("incompleteは検証を通す", () => {
      const result = listTodosQuerySchema.safeParse({ status: "incomplete" });
      expect(result.success).toBe(true);
    });

    it("completedは検証を通す", () => {
      const result = listTodosQuerySchema.safeParse({ status: "completed" });
      expect(result.success).toBe(true);
    });
  });

  describe("statusが未定義の値のとき", () => {
    it("検証を弾く", () => {
      const result = listTodosQuerySchema.safeParse({ status: "deleted" });
      expect(result.success).toBe(false);
    });
  });

  describe("category_idが文字列で渡されたとき", () => {
    it("数値へ型変換する", () => {
      const result = listTodosQuerySchema.safeParse({ category_id: "3" });
      expect(result.success).toBe(true);
      expect(result.data?.category_id).toBe(3);
    });
  });

  describe("category_idが省略されたとき", () => {
    it("undefinedのまま検証を通す", () => {
      const result = listTodosQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.category_id).toBeUndefined();
    });
  });

  describe("category_idが0以下または整数でないとき", () => {
    it("0は検証を弾く", () => {
      const result = listTodosQuerySchema.safeParse({ category_id: "0" });
      expect(result.success).toBe(false);
    });

    it("小数は検証を弾く", () => {
      const result = listTodosQuerySchema.safeParse({ category_id: "1.5" });
      expect(result.success).toBe(false);
    });
  });
});

// ToDo作成の共通入力。必要な項目だけを差し替えて各入力制約を確認する。
const validTodoInput = {
  title: "牛乳を買う",
  memo: null,
  categoryId: 6,
  priority: "medium",
  dueAt: null,
  dueHasTime: false,
  recurrenceType: "none",
  recurrenceConfig: null,
  userIds: [],
  unregisteredMemberIds: [],
  followerUserIds: [],
};

describe("todo/validation createTodoSchema", () => {
  describe("正常な作成内容のとき", () => {
    it("検証を通す", () => {
      expect(createTodoSchema.safeParse(validTodoInput).success).toBe(true);
    });
  });

  describe("タイトルが空白だけのとき", () => {
    it("タイトルを入力するよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, title: "  " });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("タイトルを入力してください。");
    });
  });

  describe("繰り返しに毎週を選び、曜日がないとき", () => {
    it("繰り返す曜日を選ぶよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({
        ...validTodoInput,
        dueAt: "2026-09-01T00:00:00.000Z",
        recurrenceType: "weekly",
        recurrenceConfig: null,
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("繰り返す曜日を選択してください。");
    });
  });

  describe("非登録メンバーを担当者にしてフォロー役がいないとき", () => {
    it("通知を受け取る家族を選ぶよう検証を弾く", () => {
      const result = replaceAssigneesSchema.safeParse({
        userIds: [],
        unregisteredMemberIds: [2],
        followerUserIds: [],
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe(
          "ログインしないメンバーを担当者にする場合は、通知を受け取る家族を1人以上選んでください。",
        );
    });
  });

  describe("タイトルの文字数上限のとき", () => {
    it("ちょうど100文字は検証を通す", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, title: "あ".repeat(100) });
      expect(result.success).toBe(true);
    });

    it("101文字は文字数上限を示して検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, title: "あ".repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("タイトルは100文字以内で入力してください。");
    });
  });

  describe("詳細メモの文字数上限のとき", () => {
    it("ちょうど1000文字は検証を通す", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, memo: "あ".repeat(1000) });
      expect(result.success).toBe(true);
    });

    it("1001文字は文字数上限を示して検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, memo: "あ".repeat(1001) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("詳細メモは1000文字以内で入力してください。");
    });
  });

  describe("categoryIdが0以下または整数でないとき", () => {
    it("0はカテゴリを選ぶよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, categoryId: 0 });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("カテゴリを選択してください。");
    });

    it("負の数はカテゴリを選ぶよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, categoryId: -1 });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("カテゴリを選択してください。");
    });

    it("小数は検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, categoryId: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("dueAtに不正な日付文字列を渡したとき", () => {
    it("検証を弾く", () => {
      const result = createTodoSchema.safeParse({ ...validTodoInput, dueAt: "2026-09-99" });
      expect(result.success).toBe(false);
    });
  });

  describe("期限の日付なしで時刻ありを指定したとき", () => {
    it("期限の日付を選ぶよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({
        ...validTodoInput,
        dueAt: null,
        dueHasTime: true,
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("期限の日付を選択してください。");
    });
  });

  describe("繰り返しを設定して期限を設定しないとき", () => {
    it("期限も設定するよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({
        ...validTodoInput,
        dueAt: null,
        dueHasTime: false,
        recurrenceType: "daily",
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe(
          "繰り返しを設定する場合は期限も設定してください。",
        );
    });
  });

  describe("繰り返しに毎月を選び、日付がないとき", () => {
    it("繰り返す日付を選ぶよう検証を弾く", () => {
      const result = createTodoSchema.safeParse({
        ...validTodoInput,
        dueAt: "2026-09-01T00:00:00.000Z",
        recurrenceType: "monthly",
        recurrenceConfig: null,
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("繰り返す日付を選択してください。");
    });
  });

  describe("recurrenceConfigの境界値", () => {
    describe("繰り返しが毎週のとき", () => {
      const baseInput = {
        ...validTodoInput,
        dueAt: "2026-09-01T00:00:00.000Z",
        recurrenceType: "weekly",
      };

      it("曜日0（日曜）は検証を通す", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { weekdays: [0] },
        });
        expect(result.success).toBe(true);
      });

      it("曜日6（土曜）は検証を通す", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { weekdays: [6] },
        });
        expect(result.success).toBe(true);
      });

      it("曜日-1は検証を弾く", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { weekdays: [-1] },
        });
        expect(result.success).toBe(false);
      });

      it("曜日7は検証を弾く", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { weekdays: [7] },
        });
        expect(result.success).toBe(false);
      });

      it("曜日が0件のときは検証を弾く", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { weekdays: [] },
        });
        expect(result.success).toBe(false);
      });
    });

    describe("繰り返しが毎月のとき", () => {
      const baseInput = {
        ...validTodoInput,
        dueAt: "2026-09-01T00:00:00.000Z",
        recurrenceType: "monthly",
      };

      it("日付1は検証を通す", () => {
        const result = createTodoSchema.safeParse({ ...baseInput, recurrenceConfig: { day: 1 } });
        expect(result.success).toBe(true);
      });

      it("日付31は検証を通す", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { day: 31 },
        });
        expect(result.success).toBe(true);
      });

      it("日付0は検証を弾く", () => {
        const result = createTodoSchema.safeParse({ ...baseInput, recurrenceConfig: { day: 0 } });
        expect(result.success).toBe(false);
      });

      it("日付32は検証を弾く", () => {
        const result = createTodoSchema.safeParse({
          ...baseInput,
          recurrenceConfig: { day: 32 },
        });
        expect(result.success).toBe(false);
      });
    });
  });
});

describe("todo/validation commentSchema", () => {
  describe("本文が空白だけのとき", () => {
    it("コメントを入力するよう検証を弾く", () => {
      const result = commentSchema.safeParse({ body: "  " });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("コメントを入力してください。");
    });
  });

  describe("本文が500文字を超えるとき", () => {
    it("文字数上限を示して検証を弾く", () => {
      const result = commentSchema.safeParse({ body: "あ".repeat(501) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("コメントは500文字以内で入力してください。");
    });
  });
});
