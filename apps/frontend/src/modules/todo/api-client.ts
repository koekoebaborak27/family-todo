import type { ApiErrorBody } from "shared";
import { TODO_ERROR_MESSAGES } from "./service";
import type {
  AssigneeInput,
  Category,
  FamilyMember,
  StatusTab,
  Todo,
  TodoDetail,
  TodoInput,
  UnregisteredMember,
} from "./types";

// Backend（Express on Cloudflare Workers）のToDo一覧関連APIを呼び出す。
// httpOnly Cookieでセッションを扱うため、必ず credentials: "include" を付ける。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// 画面に表示するエラー文言をそのまま持たせる例外。
// docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「7. エラー時の表示文言」のとおり。
export class TodoError extends Error {
  readonly kind: "unauthorized" | "forbidden" | "notFound" | "network" | "server";

  constructor(message: string, kind: TodoError["kind"]) {
    super(message);
    this.kind = kind;
  }
}

async function getJson(path: string): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
  }).catch((): never => {
    throw new TodoError(TODO_ERROR_MESSAGES.network, "network");
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch((): null => null)) as ApiErrorBody | null;
  return body?.error.message ?? TODO_ERROR_MESSAGES.serverError;
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await getJson("/api/v1/categories");
  if (response.status === 401) {
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  }
  if (!response.ok) {
    throw new TodoError(TODO_ERROR_MESSAGES.serverError, "server");
  }
  return (await response.json()) as Category[];
}

// ToDo一覧を取得する。並び替えは画面側で行うため、statusとcategoryIdのみをクエリに渡す
// （docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.4」「9. 使用API」）。
export async function fetchTodos(status: StatusTab, categoryId: number | null): Promise<Todo[]> {
  const params = new URLSearchParams({ status });
  if (categoryId !== null) {
    params.set("category_id", String(categoryId));
  }

  const response = await getJson(`/api/v1/todos?${params.toString()}`);
  if (response.status === 401) {
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  }
  if (response.status === 403) {
    throw new TodoError(await readErrorMessage(response), "forbidden");
  }
  if (!response.ok) {
    throw new TodoError(TODO_ERROR_MESSAGES.serverError, "server");
  }
  return (await response.json()) as Todo[];
}

async function postComplete(todoId: number, action: "complete" | "incomplete"): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/todos/${todoId}/${action}`, {
    method: "POST",
    credentials: "include",
  }).catch((): never => {
    throw new TodoError(TODO_ERROR_MESSAGES.network, "network");
  });

  if (response.status === 401) {
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  }
  if (response.status === 404) {
    throw new TodoError(await readErrorMessage(response), "notFound");
  }
  if (!response.ok) {
    throw new TodoError(TODO_ERROR_MESSAGES.updateFailed, "server");
  }
}

export function completeTodo(todoId: number): Promise<void> {
  return postComplete(todoId, "complete");
}

export function incompleteTodo(todoId: number): Promise<void> {
  return postComplete(todoId, "incomplete");
}

// ToDo追加・編集画面の担当者選択肢を取得する。
export async function fetchFamilyMembers(): Promise<FamilyMember[]> {
  const response = await getJson("/api/v1/families/me/members");
  if (response.status === 401)
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  if (response.status === 403) throw new TodoError(await readErrorMessage(response), "forbidden");
  if (!response.ok) throw new TodoError(TODO_ERROR_MESSAGES.serverError, "server");
  return (await response.json()) as FamilyMember[];
}

// ToDo追加・編集画面の非登録メンバー選択肢を取得する。
export async function fetchUnregisteredMembers(): Promise<UnregisteredMember[]> {
  const response = await getJson("/api/v1/families/me/unregistered-members");
  if (response.status === 401)
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  if (response.status === 403) throw new TodoError(await readErrorMessage(response), "forbidden");
  if (!response.ok) throw new TodoError(TODO_ERROR_MESSAGES.serverError, "server");
  return (await response.json()) as UnregisteredMember[];
}

// ToDoの編集画面に表示する内容を取得する。
export async function fetchTodo(todoId: number): Promise<TodoDetail> {
  const response = await getJson(`/api/v1/todos/${todoId}`);
  if (response.status === 401)
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  if (response.status === 403) throw new TodoError(await readErrorMessage(response), "forbidden");
  if (response.status === 404) throw new TodoError(await readErrorMessage(response), "notFound");
  if (!response.ok) throw new TodoError(TODO_ERROR_MESSAGES.serverError, "server");
  return (await response.json()) as TodoDetail;
}

// JSONを送る更新APIの共通処理。通信・認証・入力エラーを画面用例外へ変換する。
async function sendTodo(
  path: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((): never => {
    throw new TodoError(TODO_ERROR_MESSAGES.network, "network");
  });
  if (response.status === 401)
    throw new TodoError(TODO_ERROR_MESSAGES.unauthorized, "unauthorized");
  if (response.status === 403) throw new TodoError(await readErrorMessage(response), "forbidden");
  if (response.status === 404) throw new TodoError(await readErrorMessage(response), "notFound");
  if (response.status === 400) throw new TodoError(await readErrorMessage(response), "server");
  if (!response.ok)
    throw new TodoError("保存に失敗しました。時間をおいてもう一度お試しください。", "server");
  return response;
}

// ToDoを追加し、作成されたIDを返す。
export async function createTodo(input: TodoInput & AssigneeInput): Promise<number> {
  const response = await sendTodo("/api/v1/todos", "POST", input);
  return ((await response.json()) as { id: number }).id;
}

// ToDo本体を更新する。
export async function updateTodo(todoId: number, input: TodoInput): Promise<void> {
  await sendTodo(`/api/v1/todos/${todoId}`, "PATCH", input);
}

// ToDoの担当者を丸ごと置き換える。
export async function replaceAssignees(todoId: number, input: AssigneeInput): Promise<void> {
  await sendTodo(`/api/v1/todos/${todoId}/assignees`, "PUT", input);
}

// Push通知の購読情報を登録する。失敗しても画面の利用には支障が無いため、
// 呼び出し側でエラーを画面に表示する必要はない（呼び出し側の判断でconsole出力等に留める）。
export async function registerPushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/push-subscriptions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    throw new Error("Push通知の購読登録に失敗しました。");
  }
}
