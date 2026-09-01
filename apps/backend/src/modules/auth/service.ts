import type { Env } from "../../env";
import { Errors } from "../../shared/errors/app-error";
import { exchangeCodeForIdToken, verifyGoogleIdToken } from "./google-client";
import {
  createSession,
  createUserWithDefaultNotificationSettings,
  deleteSession,
  extendSessionExpiry,
  findUserByGoogleSub,
  findUserBySessionId,
  newSessionExpiry,
} from "./repository";
import type { AuthenticatedUser, CreatedSession } from "./types";

// セッションIDに使う推測不可能なランダム値（32バイトの暗号学的乱数を16進文字列にする）。
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Googleの認可コードでログインし、セッションを新規発行する。
// 初回ログインならusersを新規作成する（10_ログイン.md「8. DBへの影響」）。
export async function loginWithGoogleCode(
  code: string,
  env: Env,
): Promise<CreatedSession & { hasFamily: boolean }> {
  const idToken = await exchangeCodeForIdToken(code, env);
  const claims = await verifyGoogleIdToken(idToken, env);

  const existingUser = await findUserByGoogleSub(claims.sub);
  const user =
    existingUser ??
    (await createUserWithDefaultNotificationSettings({
      googleSub: claims.sub,
      email: claims.email,
      displayName: claims.name,
    }));

  const sessionId = generateSessionId();
  const expiresAt = newSessionExpiry();
  await createSession({ sessionId, userId: user.id, expiresAt });

  return { sessionId, expiresAt, hasFamily: user.family_id !== null };
}

// 認証が必要なAPI全般の入口（src/index.ts）から呼ぶ唯一のセッション検証。
// 無効なら401、有効ならスライディングセッションとして延長したうえでユーザー情報を返す。
// docs/specs/03_detail-design/family-todo/30_ログインセッション管理.md「セッションの検証」。
export async function verifySession(sessionId: string | undefined): Promise<AuthenticatedUser> {
  if (!sessionId) {
    throw Errors.UNAUTHORIZED("ログインが必要です。");
  }

  const user = await findUserBySessionId(sessionId);
  if (!user) {
    throw Errors.UNAUTHORIZED("ログインが必要です。");
  }

  await extendSessionExpiry(sessionId);
  return { id: user.id, familyId: user.family_id };
}

export async function logout(sessionId: string): Promise<void> {
  await deleteSession(sessionId);
}
