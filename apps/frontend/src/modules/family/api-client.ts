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
  readonly status?: number;

  constructor(message: string, placement: "field" | "top", status?: number) {
    super(message);
    this.placement = placement;
    this.status = status;
  }
}

export interface FamilySummary {
  id: number;
  name: string;
}

// 家族グループ設定画面に必要なグループの詳細情報。
export interface FamilyDetail extends FamilySummary {
  inviteCode: string;
  inviteCodeExpiresAt: string;
  createdByUserId: number;
  createdAt: string;
}

// 家族グループ設定画面に表示する登録ユーザー。
export interface FamilyMember {
  id: number;
  displayName: string;
  isCurrentUser: boolean;
}

// 家族グループ設定画面に表示する非登録メンバー。
export interface UnregisteredFamilyMember {
  id: number;
  name: string;
}

async function getJson(path: string): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
  }).catch((): never => {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.network, "top");
  });
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

// BackendへDELETEリクエストを送る。Cookieでセッションを渡す。
async function deleteJson(path: string): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
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

// 自分の所属グループの情報を取得する（ToDo一覧のヘッダーでグループ名を表示するために使う）。
export async function fetchMyFamily(): Promise<FamilySummary> {
  const response = await getJson("/api/v1/families/me");

  if (response.status === 401) {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.unauthorized, "top");
  }
  if (response.status === 403) {
    throw new FamilyError(await readErrorMessage(response), "top");
  }
  if (!response.ok) {
    throw new FamilyError(FAMILY_ERROR_MESSAGES.serverError, "top");
  }

  return (await response.json()) as FamilySummary;
}

// 家族グループ設定に表示する詳細情報を取得する。
export async function fetchMyFamilyDetail(): Promise<FamilyDetail> {
  const response = await getJson("/api/v1/families/me");
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
  return (await response.json()) as FamilyDetail;
}

// 家族グループ設定に表示する登録ユーザー一覧を取得する。
export async function fetchMyFamilyMembers(): Promise<FamilyMember[]> {
  const response = await getJson("/api/v1/families/me/members");
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
  return (await response.json()) as FamilyMember[];
}

// 家族グループ設定に表示する非登録メンバー一覧を取得する。
export async function fetchMyUnregisteredFamilyMembers(): Promise<UnregisteredFamilyMember[]> {
  const response = await getJson("/api/v1/families/me/unregistered-members");
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
  return (await response.json()) as UnregisteredFamilyMember[];
}

// 非登録メンバーを追加する。入力エラーと重複は入力欄の近くへ返す。
export async function addUnregisteredFamilyMember(name: string): Promise<UnregisteredFamilyMember> {
  const response = await postJson("/api/v1/families/me/unregistered-members", { name });
  if (response.status === 400 || response.status === 409) {
    throw new FamilyError(await readErrorMessage(response), "field", response.status);
  }
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
  return (await response.json()) as UnregisteredFamilyMember;
}

// 非登録メンバーを削除する。
export async function deleteUnregisteredFamilyMember(memberId: number): Promise<void> {
  const response = await deleteJson(`/api/v1/families/me/unregistered-members/${memberId}`);
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
}

// 招待コードを再発行し、新しいグループ情報を返す。
export async function renewFamilyInviteCode(): Promise<FamilyDetail> {
  const response = await postJson("/api/v1/families/me/invite", {});
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
  return (await response.json()) as FamilyDetail;
}

// ログイン中のユーザーを家族グループから退出させる。
export async function leaveFamily(): Promise<void> {
  const response = await postJson("/api/v1/families/me/leave", {});
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
}

// 作成者として家族グループ全体を削除する。
export async function deleteFamily(): Promise<void> {
  const response = await deleteJson("/api/v1/families/me");
  if (!response.ok) {
    throw new FamilyError(await readErrorMessage(response), "top", response.status);
  }
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
