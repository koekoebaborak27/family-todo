import type { APIRequestContext } from "@playwright/test";

// テストデータの準備・後始末を、UIではなくBackend REST APIを直接叩いて行うヘルパー。
// context.request（BrowserContextと同じCookieストレージを共有するAPIRequestContext）経由で呼ぶことで、
// addCookiesで載せたセッションのままログイン済みユーザーとして操作できる。
export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? "http://localhost:8787";

async function postJson<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await request.post(`${API_BASE_URL}${path}`, { data });
  if (!response.ok()) {
    throw new Error(`POST ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

// 家族グループを作る（自分が作成者兼最初のメンバーになる）。
export async function createFamily(
  request: APIRequestContext,
  name: string,
): Promise<{ id: number; name: string }> {
  return postJson(request, "/api/v1/families", { name });
}

// 自分の所属グループの詳細（招待コードを含む）を取得する。
export async function getMyFamily(
  request: APIRequestContext,
): Promise<{ id: number; name: string; inviteCode: string }> {
  const response = await request.get(`${API_BASE_URL}/api/v1/families/me`);
  if (!response.ok()) {
    throw new Error(`GET /families/me failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

// 招待コードで家族グループに参加する。
export async function joinFamily(
  request: APIRequestContext,
  inviteCode: string,
): Promise<{ id: number; name: string }> {
  return postJson(request, "/api/v1/families/join", { inviteCode });
}

// 非登録メンバーを追加する。
export async function addUnregisteredMember(
  request: APIRequestContext,
  name: string,
): Promise<{ id: number; name: string }> {
  return postJson(request, "/api/v1/families/me/unregistered-members", { name });
}

export type TodoPriority = "high" | "medium" | "low";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface CreateTodoInput {
  title: string;
  memo?: string | null;
  categoryId: number;
  priority: TodoPriority;
  dueAt?: string | null;
  dueHasTime?: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceConfig?: { weekdays: number[] } | { day: number } | null;
  userIds?: number[];
  unregisteredMemberIds?: number[];
  followerUserIds?: number[];
}

// ToDoを1件作る。テストで使わない項目は既定値で埋める。
export async function createTodo(
  request: APIRequestContext,
  input: CreateTodoInput,
): Promise<{ id: number }> {
  return postJson(request, "/api/v1/todos", {
    title: input.title,
    memo: input.memo ?? null,
    categoryId: input.categoryId,
    priority: input.priority,
    dueAt: input.dueAt ?? null,
    dueHasTime: input.dueHasTime ?? false,
    recurrenceType: input.recurrenceType ?? "none",
    recurrenceConfig: input.recurrenceConfig ?? null,
    userIds: input.userIds ?? [],
    unregisteredMemberIds: input.unregisteredMemberIds ?? [],
    followerUserIds: input.followerUserIds ?? [],
  });
}

export async function completeTodo(request: APIRequestContext, todoId: number): Promise<void> {
  const response = await request.post(`${API_BASE_URL}/api/v1/todos/${todoId}/complete`);
  if (!response.ok()) {
    throw new Error(`POST /todos/${todoId}/complete failed: ${response.status()}`);
  }
}

export async function deleteTodo(request: APIRequestContext, todoId: number): Promise<void> {
  const response = await request.delete(`${API_BASE_URL}/api/v1/todos/${todoId}`);
  if (!response.ok()) {
    throw new Error(`DELETE /todos/${todoId} failed: ${response.status()}`);
  }
}

// 204 No Content を返すエンドポイント用（postJsonはレスポンスボディのJSONパースを前提とするため使えない）。
export async function addComment(
  request: APIRequestContext,
  todoId: number,
  body: string,
): Promise<void> {
  const response = await request.post(`${API_BASE_URL}/api/v1/todos/${todoId}/comments`, {
    data: { body },
  });
  if (!response.ok()) {
    throw new Error(`POST /todos/${todoId}/comments failed: ${response.status()} ${await response.text()}`);
  }
}

// カテゴリ名からID（固定6件のseed）を引く。
export const CATEGORY_IDS: Record<string, number> = {
  学校: 1,
  仕事: 2,
  習い事: 3,
  家事: 4,
  買い物: 5,
  その他: 6,
};
