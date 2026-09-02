import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth";
import {
  advanceTodoDueDate,
  countCommentsForTodoIds,
  countValidAssignees,
  createCommentRow,
  createTodoRow,
  deleteCommentRow,
  deleteTodoRows,
  findCommentFamilyId,
  findTodoFamilyId,
  findTodoRow,
  listAssigneesForTodoIds,
  listCommentRows,
  listTodoRows,
  markTodoCompleted,
  markTodoIncomplete,
  replaceTodoAssignees,
  updateCommentRow,
  updateTodoRow,
  type CommentRow,
  type TodoRow,
} from "./repository";
import {
  completeTodo,
  createComment,
  createTodo,
  deleteComment,
  deleteTodo,
  getTodo,
  incompleteTodo,
  listTodos,
  updateComment,
  updateTodo,
  updateTodoAssignees,
} from "./service";
import type { CreateTodoInput, ReplaceAssigneesInput, UpdateTodoInput } from "./validation";

/**
 * 対象: todo/service listTodos・createTodo・getTodo・updateTodo・updateTodoAssignees・
 *       completeTodo・incompleteTodo・コメント関連（追加・更新・削除）・deleteTodo
 * 目的: ToDo一覧取得（担当者・コメント件数の組み立て）、作成・編集・担当者置換・完了/未完了切り替え・
 *       コメント操作それぞれの業務ルール（グループ未所属・他グループ/存在しないToDo・担当者の
 *       不整合の扱い）を担保する。
 */

vi.mock("./repository", () => ({
  listTodoRows: vi.fn(),
  listAssigneesForTodoIds: vi.fn(),
  countCommentsForTodoIds: vi.fn(),
  findTodoFamilyId: vi.fn(),
  markTodoCompleted: vi.fn(),
  markTodoIncomplete: vi.fn(),
  advanceTodoDueDate: vi.fn(),
  createCommentRow: vi.fn(),
  deleteCommentRow: vi.fn(),
  deleteTodoRows: vi.fn(),
  findCommentFamilyId: vi.fn(),
  findTodoRow: vi.fn(),
  countValidAssignees: vi.fn(),
  createTodoRow: vi.fn(),
  replaceTodoAssignees: vi.fn(),
  updateTodoRow: vi.fn(),
  updateCommentRow: vi.fn(),
  listCommentRows: vi.fn(),
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

// テスト用のToDo詳細行ファクトリ（findTodoRowの戻り値。必要な差分だけoverride）。
const makeTodoDetailRow = (
  o: Partial<TodoRow & { family_id: number; recurrence_config: string | null }> = {},
): TodoRow & { family_id: number; recurrence_config: string | null } => ({
  id: 1,
  family_id: 10,
  title: "牛乳を買う",
  memo: null,
  due_at: null,
  due_has_time: 0,
  priority: "medium",
  category_id: 1,
  status: "incomplete",
  recurrence_type: "none",
  recurrence_config: null,
  completed_at: null,
  completed_by_display_name: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_display_name: "太郎",
  ...o,
});

// テスト用のコメント行ファクトリ（必要な差分だけoverride）。
const makeCommentRow = (o: Partial<CommentRow> = {}): CommentRow => ({
  id: 1,
  body: "確認しました",
  user_display_name: "太郎",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

// テスト用のToDo作成入力ファクトリ（必要な差分だけoverride）。
const makeCreateInput = (o: Partial<CreateTodoInput> = {}): CreateTodoInput => ({
  title: "牛乳を買う",
  memo: null,
  categoryId: 6,
  priority: "medium",
  dueAt: null,
  dueHasTime: false,
  recurrenceType: "none",
  recurrenceConfig: null,
  userIds: [5],
  unregisteredMemberIds: [7],
  followerUserIds: [9],
  ...o,
});

// テスト用のToDo編集入力ファクトリ（必要な差分だけoverride）。
const makeUpdateInput = (o: Partial<UpdateTodoInput> = {}): UpdateTodoInput => ({
  title: "牛乳を買う",
  memo: null,
  categoryId: 6,
  priority: "medium",
  dueAt: null,
  dueHasTime: false,
  recurrenceType: "none",
  recurrenceConfig: null,
  ...o,
});

// テスト用の担当者置換入力ファクトリ（必要な差分だけoverride）。
const makeReplaceAssigneesInput = (
  o: Partial<ReplaceAssigneesInput> = {},
): ReplaceAssigneesInput => ({
  userIds: [5],
  unregisteredMemberIds: [7],
  followerUserIds: [9],
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

describe("todo/service createTodo", () => {
  describe("正常系", () => {
    it("担当者の整合性を確認したうえでToDoと担当者を保存し、生成IDを返す", async () => {
      vi.mocked(countValidAssignees).mockResolvedValue({ users: 2, unregisteredMembers: 1 });
      vi.mocked(createTodoRow).mockResolvedValue(42);

      const result = await createTodo(makeCreateInput(), affiliatedUser);

      expect(countValidAssignees).toHaveBeenCalledWith({
        familyId: 10,
        userIds: [5, 9],
        unregisteredMemberIds: [7],
      });
      expect(createTodoRow).toHaveBeenCalledWith({
        familyId: 10,
        createdByUserId: 2,
        title: "牛乳を買う",
        memo: null,
        dueAt: null,
        dueHasTime: false,
        priority: "medium",
        categoryId: 6,
        recurrenceType: "none",
        recurrenceConfig: null,
      });
      expect(replaceTodoAssignees).toHaveBeenCalledWith({
        todoId: 42,
        userIds: [5],
        unregisteredMemberIds: [7],
        followerUserIds: [9],
      });
      expect(result).toEqual({ id: 42 });
    });
  });

  describe("担当者の登録ユーザー・非登録メンバーの組み合わせがおかしいとき", () => {
    it("AppError(VALIDATION_ERROR) を投げ、ToDoは作成しない", async () => {
      // userIds+followerUserIdsは2件のはずなのに1件しか自分の家族グループに存在しない。
      vi.mocked(countValidAssignees).mockResolvedValue({ users: 1, unregisteredMembers: 1 });

      await expect(createTodo(makeCreateInput(), affiliatedUser)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      expect(createTodoRow).not.toHaveBeenCalled();
      expect(replaceTodoAssignees).not.toHaveBeenCalled();
    });
  });
});

describe("todo/service getTodo", () => {
  describe("正常系", () => {
    it("担当者・コメントを組み立てたToDo詳細を返す", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(makeTodoDetailRow());
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([
        {
          todo_id: 1,
          user_id: 5,
          unregistered_member_id: null,
          user_display_name: "太郎",
          unregistered_name: null,
          is_follower: 1,
        },
      ]);
      vi.mocked(listCommentRows).mockResolvedValue([makeCommentRow()]);

      const result = await getTodo(1, affiliatedUser);

      expect(result.id).toBe(1);
      expect(result.assignees).toEqual([
        { type: "user", id: 5, displayName: "太郎", isFollower: true },
      ]);
      expect(result.commentCount).toBe(1);
      expect(result.comments).toEqual([
        {
          id: 1,
          body: "確認しました",
          userDisplayName: "太郎",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
      expect(result.createdByDisplayName).toBe("太郎");
    });
  });

  describe("ToDoが存在しない、または他グループのものであるとき", () => {
    it("存在しない場合、AppError(NOT_FOUND) を投げる", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(null);

      await expect(getTodo(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(listAssigneesForTodoIds).not.toHaveBeenCalled();
    });

    it("他グループのものである場合、AppError(NOT_FOUND) を投げる", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(makeTodoDetailRow({ family_id: 999 }));

      await expect(getTodo(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(listAssigneesForTodoIds).not.toHaveBeenCalled();
    });
  });
});

describe("todo/service updateTodo", () => {
  describe("正常系", () => {
    it("自分のグループのToDoなら編集内容を保存する", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);

      await updateTodo(1, makeUpdateInput({ title: "牛乳と卵を買う" }), affiliatedUser);

      expect(updateTodoRow).toHaveBeenCalledWith(1, {
        title: "牛乳と卵を買う",
        memo: null,
        dueAt: null,
        dueHasTime: false,
        priority: "medium",
        categoryId: 6,
        recurrenceType: "none",
        recurrenceConfig: null,
      });
    });
  });

  describe("ToDoが存在しない・他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、編集は行わない", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(999);

      await expect(updateTodo(1, makeUpdateInput(), affiliatedUser)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(updateTodoRow).not.toHaveBeenCalled();
    });
  });
});

describe("todo/service updateTodoAssignees", () => {
  describe("正常系", () => {
    it("担当者の整合性を確認したうえで担当者を丸ごと置き換える", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);
      vi.mocked(countValidAssignees).mockResolvedValue({ users: 2, unregisteredMembers: 1 });

      await updateTodoAssignees(1, makeReplaceAssigneesInput(), affiliatedUser);

      expect(replaceTodoAssignees).toHaveBeenCalledWith({
        todoId: 1,
        userIds: [5],
        unregisteredMemberIds: [7],
        followerUserIds: [9],
      });
    });
  });

  describe("ToDoが存在しない・他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、担当者は置き換えない", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(999);

      await expect(
        updateTodoAssignees(1, makeReplaceAssigneesInput(), affiliatedUser),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(countValidAssignees).not.toHaveBeenCalled();
      expect(replaceTodoAssignees).not.toHaveBeenCalled();
    });
  });

  describe("担当者の登録ユーザー・非登録メンバーの組み合わせがおかしいとき", () => {
    it("AppError(VALIDATION_ERROR) を投げ、担当者は置き換えない", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);
      vi.mocked(countValidAssignees).mockResolvedValue({ users: 1, unregisteredMembers: 1 });

      await expect(
        updateTodoAssignees(1, makeReplaceAssigneesInput(), affiliatedUser),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(replaceTodoAssignees).not.toHaveBeenCalled();
    });
  });
});

describe("todo/service completeTodo", () => {
  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(completeTodo(1, unaffiliatedUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(findTodoRow).not.toHaveBeenCalled();
    });
  });

  describe("ToDoが存在しないとき", () => {
    it("AppError(NOT_FOUND) を投げ、完了処理は行わない", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(null);

      await expect(completeTodo(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(markTodoCompleted).not.toHaveBeenCalled();
    });
  });

  describe("ToDoが他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、完了処理は行わない", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(makeTodoDetailRow({ family_id: 999 }));

      await expect(completeTodo(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(markTodoCompleted).not.toHaveBeenCalled();
    });
  });

  describe("繰り返し設定が「なし」のとき", () => {
    it("自分のグループのToDoを完了にし、recurring: falseを返す", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(makeTodoDetailRow({ recurrence_type: "none" }));

      await expect(completeTodo(1, affiliatedUser)).resolves.toEqual({
        recurring: false,
        nextDueAt: null,
      });
      expect(markTodoCompleted).toHaveBeenCalledWith(1, affiliatedUser.id);
      expect(advanceTodoDueDate).not.toHaveBeenCalled();
    });
  });

  describe("繰り返し設定があるとき", () => {
    it("完了にはせず、期限を次回へ進めてrecurring: trueと次回の期限を返す", async () => {
      vi.mocked(findTodoRow).mockResolvedValue(
        makeTodoDetailRow({
          recurrence_type: "daily",
          recurrence_config: null,
          due_at: "2026-09-02T15:00:00.000Z", // JST 2026-09-03 00:00
          due_has_time: 0,
        }),
      );

      const result = await completeTodo(1, affiliatedUser);

      expect(result).toEqual({ recurring: true, nextDueAt: "2026-09-03T15:00:00.000Z" });
      expect(advanceTodoDueDate).toHaveBeenCalledWith(1, "2026-09-03T15:00:00.000Z");
      expect(markTodoCompleted).not.toHaveBeenCalled();
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

describe("todo/service updateComment", () => {
  describe("正常系", () => {
    it("自分のグループのコメントなら本文を更新する", async () => {
      vi.mocked(findCommentFamilyId).mockResolvedValue(10);

      await updateComment(1, { body: "了解です" }, affiliatedUser);

      expect(updateCommentRow).toHaveBeenCalledWith(1, "了解です");
    });
  });

  describe("コメントが存在しない・他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、更新は行わない", async () => {
      vi.mocked(findCommentFamilyId).mockResolvedValue(999);

      await expect(updateComment(1, { body: "了解です" }, affiliatedUser)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(updateCommentRow).not.toHaveBeenCalled();
    });
  });
});

describe("todo/service コメントと削除", () => {
  describe("コメントを追加するとき", () => {
    it("自分のグループのToDoなら本文と投稿者を保存する", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);
      await createComment(1, { body: "確認しました" }, affiliatedUser);
      expect(createCommentRow).toHaveBeenCalledWith(1, 2, "確認しました");
    });
  });

  describe("コメントが他グループのものであるとき", () => {
    it("AppError(NOT_FOUND) を投げ、削除しない", async () => {
      vi.mocked(findCommentFamilyId).mockResolvedValue(999);
      await expect(deleteComment(1, affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(deleteCommentRow).not.toHaveBeenCalled();
    });
  });

  describe("ToDoを削除するとき", () => {
    it("自分のグループのToDoと関連データを削除する", async () => {
      vi.mocked(findTodoFamilyId).mockResolvedValue(10);
      await deleteTodo(1, affiliatedUser);
      expect(deleteTodoRows).toHaveBeenCalledWith(1);
    });
  });
});
