import { LOGIN_ERROR_MESSAGES } from "./service";

// Backend（Express on Cloudflare Workers）の認証APIを呼び出す。
// httpOnly Cookieでセッションを扱うため、必ず credentials: "include" を付ける。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ログイン画面に表示するエラー文言をそのまま持たせる例外。
// 原因（不正な認可コード・サーバーエラー・通信断）ごとに文言が決まっている
// （docs/specs/02_basic-design/family-todo/10_ログイン.md「7. エラー時の表示文言」）。
export class LoginError extends Error {}

export type MeResult = { authenticated: false } | { authenticated: true; hasFamily: boolean };

// ログイン状態と所属グループの有無を確認する（画面表示時に必ず呼ぶ）。
// 未ログインはAPIが401を返す設計のため、例外にはせず戻り値で表す。
export async function fetchMe(): Promise<MeResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    credentials: "include",
  }).catch((): never => {
    throw new LoginError(LOGIN_ERROR_MESSAGES.network);
  });

  if (response.status === 401) {
    return { authenticated: false };
  }
  if (!response.ok) {
    throw new LoginError(LOGIN_ERROR_MESSAGES.serverError);
  }

  const body = (await response.json()) as { hasFamily: boolean };
  return { authenticated: true, hasFamily: body.hasFamily };
}

// ログアウトする。呼び出し側でCookie失効後の画面遷移（ログイン画面へ）を行う。
export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch((): never => {
    throw new LoginError(LOGIN_ERROR_MESSAGES.network);
  });
}

// Googleから戻ってきた認可コードでログインする。
export async function exchangeGoogleCode(code: string): Promise<{ hasFamily: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/google/callback`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch((): never => {
    throw new LoginError(LOGIN_ERROR_MESSAGES.network);
  });

  if (response.status === 400) {
    throw new LoginError(LOGIN_ERROR_MESSAGES.invalidCode);
  }
  if (!response.ok) {
    throw new LoginError(LOGIN_ERROR_MESSAGES.serverError);
  }

  return (await response.json()) as { hasFamily: boolean };
}
