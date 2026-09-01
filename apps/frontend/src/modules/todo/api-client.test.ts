import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeTodo,
  createComment,
  createTodo,
  deleteComment,
  deleteTodo,
  fetchCategories,
  fetchFamilyMembers,
  fetchTodo,
  fetchUnregisteredMembers,
  fetchTodos,
  incompleteTodo,
  registerPushSubscription,
  replaceAssignees,
  TodoError,
  updateTodo,
  updateComment,
} from "./api-client";
import { TODO_ERROR_MESSAGES } from "./service";

/**
 * 対象: todo/api-client
 * 目的: BackendのステータスコードをFrontendの状態（成功値/エラー文言/エラー種別kind）へ
 *       正しく変換できることを担保する
 *       （docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「7. エラー時の表示文言」）。
 */

function mockFetchOnce(response: Partial<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("todo/api-client fetchCategories", () => {
  describe("200が返るとき", () => {
    it("カテゴリの配列を返す", async () => {
      mockFetchOnce({ ok: true, status: 200, json: async () => [{ id: 1, name: "家事" }] });
      await expect(fetchCategories()).resolves.toEqual([{ id: 1, name: "家事" }]);
    });
  });

  describe("401が返るとき", () => {
    it("kind: unauthorized のTodoErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 401 });
      await expect(fetchCategories()).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.unauthorized,
        kind: "unauthorized",
      });
    });
  });

  describe("500系が返るとき", () => {
    it("kind: server のTodoErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(fetchCategories()).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.serverError,
        kind: "server",
      });
    });
  });

  describe("通信自体に失敗したとき", () => {
    it("kind: network のTodoErrorを投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));
      await expect(fetchCategories()).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.network,
        kind: "network",
      });
    });
  });
});

describe("todo/api-client fetchTodos", () => {
  describe("200が返るとき", () => {
    it("ToDoの配列を返す", async () => {
      mockFetchOnce({ ok: true, status: 200, json: async () => [{ id: 1, title: "牛乳を買う" }] });
      await expect(fetchTodos("incomplete", null)).resolves.toEqual([
        { id: 1, title: "牛乳を買う" },
      ]);
    });

    it("category_idがnullのときはクエリに含めない", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
      vi.stubGlobal("fetch", fetchMock);
      await fetchTodos("incomplete", null);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("status=incomplete");
      expect(calledUrl).not.toContain("category_id");
    });

    it("category_idを指定したときはクエリに含める", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
      vi.stubGlobal("fetch", fetchMock);
      await fetchTodos("completed", 3);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("status=completed");
      expect(calledUrl).toContain("category_id=3");
    });
  });

  describe("401が返るとき", () => {
    it("kind: unauthorized のTodoErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 401 });
      await expect(fetchTodos("incomplete", null)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.unauthorized,
        kind: "unauthorized",
      });
    });
  });

  describe("403が返るとき", () => {
    it("Backendの文言で、kind: forbidden のTodoErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: "FORBIDDEN", message: "家族グループに参加していません。" },
        }),
      });
      await expect(fetchTodos("incomplete", null)).rejects.toMatchObject({
        message: "家族グループに参加していません。",
        kind: "forbidden",
      });
    });

    it("応答本文が読めないときは既定のサーバーエラー文言にする", async () => {
      mockFetchOnce({ ok: false, status: 403, json: async () => Promise.reject(new Error()) });
      await expect(fetchTodos("incomplete", null)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.serverError,
        kind: "forbidden",
      });
    });
  });

  describe("500系が返るとき", () => {
    it("kind: server のTodoErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(fetchTodos("incomplete", null)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.serverError,
        kind: "server",
      });
    });
  });

  describe("通信自体に失敗したとき", () => {
    it("kind: network のTodoErrorを投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));
      await expect(fetchTodos("incomplete", null)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.network,
        kind: "network",
      });
    });
  });
});

describe("todo/api-client completeTodo", () => {
  describe("200が返るとき", () => {
    it("何も返さず正常終了する", async () => {
      mockFetchOnce({ ok: true, status: 200 });
      await expect(completeTodo(1)).resolves.toBeUndefined();
    });
  });

  describe("401が返るとき", () => {
    it("kind: unauthorized のTodoErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 401 });
      await expect(completeTodo(1)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.unauthorized,
        kind: "unauthorized",
      });
    });
  });

  describe("404が返るとき", () => {
    it("Backendの文言で、kind: notFound のTodoErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { code: "NOT_FOUND", message: "このToDoは削除されています。" },
        }),
      });
      await expect(completeTodo(1)).rejects.toMatchObject({
        message: "このToDoは削除されています。",
        kind: "notFound",
      });
    });
  });

  describe("500系が返るとき", () => {
    it("更新失敗の文言で、kind: server のTodoErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(completeTodo(1)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.updateFailed,
        kind: "server",
      });
    });
  });

  describe("通信自体に失敗したとき", () => {
    it("kind: network のTodoErrorを投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));
      await expect(completeTodo(1)).rejects.toMatchObject({
        message: TODO_ERROR_MESSAGES.network,
        kind: "network",
      });
    });
  });
});

describe("todo/api-client incompleteTodo", () => {
  describe("200が返るとき", () => {
    it("何も返さず正常終了する", async () => {
      mockFetchOnce({ ok: true, status: 200 });
      await expect(incompleteTodo(1)).resolves.toBeUndefined();
    });
  });

  describe("404が返るとき", () => {
    it("kind: notFound のTodoErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { code: "NOT_FOUND", message: "このToDoは削除されています。" },
        }),
      });
      await expect(incompleteTodo(1)).rejects.toMatchObject({ kind: "notFound" });
    });
  });
});

describe("todo/api-client registerPushSubscription", () => {
  const subscription = { endpoint: "https://push.example.com/xyz", p256dh: "key", auth: "secret" };

  describe("応答が成功のとき", () => {
    it("何も返さず正常終了する", async () => {
      mockFetchOnce({ ok: true, status: 201 });
      await expect(registerPushSubscription(subscription)).resolves.toBeUndefined();
    });
  });

  describe("応答が失敗のとき", () => {
    it("購読登録失敗のErrorを投げる", async () => {
      mockFetchOnce({ ok: false, status: 500 });
      await expect(registerPushSubscription(subscription)).rejects.toThrow(
        "Push通知の購読登録に失敗しました。",
      );
    });
  });
});

// TodoErrorのkind分岐が網羅されていることを確認するため、クラス自体もエクスポート経由で参照できることを担保する。
describe("todo/api-client TodoError", () => {
  it("messageとkindを保持する", () => {
    const error = new TodoError("テストメッセージ", "server");
    expect(error.message).toBe("テストメッセージ");
    expect(error.kind).toBe("server");
  });
});

const todoInput = {
  title: "牛乳を買う",
  memo: null,
  categoryId: 6,
  priority: "medium" as const,
  dueAt: null,
  dueHasTime: false,
  recurrenceType: "none" as const,
  recurrenceConfig: null,
};

describe("todo/api-client ToDo追加編集API", () => {
  describe("担当者の選択肢を取得するとき", () => {
    it("登録ユーザーと非登録メンバーをそれぞれ返す", async () => {
      mockFetchOnce({ json: async () => [{ id: 1, displayName: "太郎" }] });
      await expect(fetchFamilyMembers()).resolves.toEqual([{ id: 1, displayName: "太郎" }]);
      mockFetchOnce({ json: async () => [{ id: 2, name: "花子" }] });
      await expect(fetchUnregisteredMembers()).resolves.toEqual([{ id: 2, name: "花子" }]);
    });
  });

  describe("ToDoを追加するとき", () => {
    it("POSTで入力を送り、作成IDを返す", async () => {
      mockFetchOnce({ status: 201, json: async () => ({ id: 9 }) });
      await expect(
        createTodo({ ...todoInput, userIds: [], unregisteredMemberIds: [], followerUserIds: [] }),
      ).resolves.toBe(9);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/todos"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("ToDoを更新するとき", () => {
    it("PATCHと担当者置換のPUTを正しいURLで送る", async () => {
      mockFetchOnce({ status: 204 });
      await expect(updateTodo(9, todoInput)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/todos/9"),
        expect.objectContaining({ method: "PATCH" }),
      );
      mockFetchOnce({ status: 204 });
      await expect(
        replaceAssignees(9, { userIds: [1], unregisteredMemberIds: [], followerUserIds: [] }),
      ).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/todos/9/assignees"),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  describe("編集対象を取得するとき", () => {
    it("404ならkind: notFoundのTodoErrorを投げる", async () => {
      mockFetchOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "このToDoは削除されています。" } }),
      });
      await expect(fetchTodo(9)).rejects.toMatchObject({ kind: "notFound" });
    });
  });
});

describe("todo/api-client ToDo詳細API", () => {
  describe("削除・コメント操作をするとき", () => {
    it("それぞれのURLとHTTPメソッドで送る", async () => {
      mockFetchOnce({ status: 204 });
      await deleteTodo(9);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/todos/9"),
        expect.objectContaining({ method: "DELETE" }),
      );
      mockFetchOnce({ status: 204 });
      await createComment(9, "確認しました");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/todos/9/comments"),
        expect.objectContaining({ method: "POST" }),
      );
      mockFetchOnce({ status: 204 });
      await updateComment(3, "変更しました");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/comments/3"),
        expect.objectContaining({ method: "PATCH" }),
      );
      mockFetchOnce({ status: 204 });
      await deleteComment(3);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/comments/3"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
