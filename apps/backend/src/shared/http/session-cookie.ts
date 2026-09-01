// セッションIDを保持するCookieの名前。
// 属性は詳細設計のとおり（docs/specs/03_detail-design/family-todo/30_ログインセッション管理.md「セッションの発行」）。
export const SESSION_COOKIE_NAME = "session_id";

// リクエストのCookieヘッダーからセッションIDを取り出す。無ければundefined。
export function getSessionIdFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

// ログイン成功時にレスポンスへ設定するSet-Cookie値。
export function buildSessionCookie(sessionId: string, expiresAt: Date): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
  ].join("; ");
}

// ログアウト時にCookieを失効させるSet-Cookie値（Max-Age=0で上書き）。
export function buildExpiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}
