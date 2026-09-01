import { describe, expect, it } from "vitest";
import { listTodosQuerySchema } from "./validation";

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
