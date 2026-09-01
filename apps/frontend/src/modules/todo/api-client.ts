import type { ApiErrorBody } from "shared";
import { TODO_ERROR_MESSAGES } from "./service";
import type { Category, StatusTab, Todo } from "./types";

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
