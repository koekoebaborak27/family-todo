import type { ApiErrorBody } from "shared";
import { FAMILY_ERROR_MESSAGES } from "./service";

// Backend（Express on Cloudflare Workers）の家族グループAPIを呼び出す。
// httpOnly Cookieでセッションを扱うため、必ず credentials: "include" を付ける。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// 画面に表示するエラー文言をそのまま持たせる例外。
// placementは表示場所（"field": 入力欄の下、"top": 画面上部）。
// docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「7. エラー時の表示文言」のとおり。
export class FamilyError extends Error {
  readonly placement: "field" | "top";

  constructor(message: string, placement: "field" | "top") {
    super(message);
    this.placement = placement;
  }
}

export interface FamilySummary {
  id: number;
  name: string;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((): never => {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.network, "top");
  });
}

// レスポンスの共通エラー形式（{ error: { code, message } }）から表示文言を取り出す。
// Backend側の文言がそのまま画面表示用の文言になる。
async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch((): null => null)) as ApiErrorBody | null;
  return body?.error.message ?? FAMILY_ERROR_MESSAGES.serverError;
}

// 家族グループを新規作成する。
export async function createFamily(name: string): Promise<FamilySummary> {
  const response = await postJson("/api/v1/families", { name });

  if (response.status === 401) {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.unauthorized, "top");
  }
  if (response.status === 400) {
    throw new FamilyError(await readErrorMessage(response), "field");
  }
  if (response.status === 409) {
    throw new FamilyError(await readErrorMessage(response), "top");
  }
  if (!response.ok) {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.serverError, "top");
  }

  return (await response.json()) as FamilySummary;
}

// 招待コードで家族グループに参加する。
export async function joinFamily(inviteCode: string): Promise<FamilySummary> {
  const response = await postJson("/api/v1/families/join", { inviteCode });

  if (response.status === 401) {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.unauthorized, "top");
  }
  if (response.status === 404 || response.status === 400) {
    throw new FamilyError(await readErrorMessage(response), "field");
  }
  if (response.status === 409) {
    throw new FamilyError(await readErrorMessage(response), "top");
  }
  if (!response.ok) {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.serverError, "top");
  }

  return (await response.json()) as FamilySummary;
}
