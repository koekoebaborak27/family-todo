import { describe, expect, it } from "vitest";
import { createTodoSchema, listTodosQuerySchema, replaceAssigneesSchema } from "./validation";

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
});
