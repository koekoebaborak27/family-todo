import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth";
import {
  countCommentsForTodoIds,
  findTodoFamilyId,
  listAssigneesForTodoIds,
  listTodoRows,
  markTodoCompleted,
  markTodoIncomplete,
} from "./repository";
import { completeTodo, incompleteTodo, listTodos } from "./service";

/**
 * 対象: todo/service listTodos・completeTodo・incompleteTodo
 * 目的: ToDo一覧取得（担当者・コメント件数の組み立て）と完了/未完了切り替えの業務ルール
 *       （グループ未所属・他グループ/存在しないToDoの扱い）を担保する。
 */

vi.mock("./repository", () => ({
  listTodoRows: vi.fn(),
  listAssigneesForTodoIds: vi.fn(),
  countCommentsForTodoIds: vi.fn(),
  findTodoFamilyId: vi.fn(),
  markTodoCompleted: vi.fn(),
  markTodoIncomplete: vi.fn(),
}));

const unaffiliatedUser: AuthenticatedUser = { id: 1, familyId: null };
const affiliatedUser: AuthenticatedUser = { id: 2, familyId: 10 };

// テスト用のToDo行ファクトリ（必要な差分だけoverride）。
const makeTodoRow = (o: Partial<Awaited<ReturnType<typeof listTodoRows>>[number]> = {}) => ({
  id: 1,
  title: "牛乳を買う",
  memo: null,
  due_at: null,
  due_has_time: 0,
  priority: "medium",
  category_id: 1,
  status: "incomplete",
  recurrence_type: "none",
  completed_at: null,
  completed_by_display_name: null,
  created_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("todo/service listTodos", () => {
  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(listTodos(unaffiliatedUser, { status: "incomplete" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(listTodoRows).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    it("担当者（登録ユーザー・非登録メンバー）とコメント件数を組み立てて返す", async () => {
      vi.mocked(listTodoRows).mockResolvedValue([makeTodoRow({ id: 1 }), makeTodoRow({ id: 2 })]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([
        {
          todo_id: 1,
          user_id: 5,
          unregistered_member_id: null,
          user_display_name: "太郎",
          unregistered_name: null,
        },
        {
          todo_id: 1,
          user_id: null,
          unregistered_member_id: 7,
          user_display_name: null,
          unregistered_name: "花子",
        },
      ]);
      vi.mocked(countCommentsForTodoIds).mockResolvedValue([{ todo_id: 1, count: 3 }]);

      const result = await listTodos(affiliatedUser, { status: "incomplete" });

      expect(listTodoRows).toHaveBeenCalledWith({
        familyId: 10,
        status: "incomplete",
        categoryId: undefined,
      });
      expect(result[0].assignees).toEqual([
        { type: "user", id: 5, displayName: "太郎" },
        { type: "unregistered", id: 7, displayName: "花子" },
      ]);
      expect(result[0].commentCount).toBe(3);
      // 担当者・コメントが無いToDoは空配列・0件になる。
      expect(result[1].assignees).toEqual([]);
      expect(result[1].commentCount).toBe(0);
    });

    it("category_idを指定した場合はrepositoryへそのまま渡す", async () => {
      vi.mocked(listTodoRows).mockResolvedValue([]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([]);
      vi.mocked(countCommentsForTodoIds).mockResolvedValue([]);

      await listTodos(affiliatedUser, { status: "completed", category_id: 3 });

      expect(listTodoRows).toHaveBeenCalledWith({
        familyId: 10,
        status: "completed",
        categoryId: 3,
      });
    });
  });
});

describe("todo/service completeTodo", () => {
  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(completeTodo(1, unaffiliatedUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(findTodoFamilyId).not.toHaveBeenCalled();
    });
  });

  describe("ToDoが存在しないとき", () => {
    it("AppError(NOT_FOUND) を投げ、完了処理は行わない", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(null);

      await expect(completeTodo(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(markTodoCompleted).not.toHaveBeenCalled();
    });
  });

  describe("ToDoが他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、完了処理は行わない", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(999);

      await expect(completeTodo(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(markTodoCompleted).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    it("自分のグループのToDoを完了にする", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);

      await completeTodo(1, affiliatedUser);

      expect(markTodoCompleted).toHaveBeenCalledWith(1, affiliatedUser.id);
    });
  });
});

describe("todo/service incompleteTodo", () => {
  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(incompleteTodo(1, unaffiliatedUser)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(findTodoFamilyId).not.toHaveBeenCalled();
    });
  });

  describe("ToDoが存在しない・他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、未完了処理は行わない", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(null);

      await expect(incompleteTodo(1, affiliatedUser)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(markTodoIncomplete).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    it("自分のグループのToDoを未完了に戻す", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);

      await incompleteTodo(1, affiliatedUser);

      expect(markTodoIncomplete).toHaveBeenCalledWith(1);
    });
  });
});
