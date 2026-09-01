import { env } from "cloudflare:workers";
import { Router } from "express";
import type { Env } from "../../env";
import { Errors } from "../../shared/errors/app-error";
import { buildExpiredSessionCookie, buildSessionCookie } from "../../shared/http/session-cookie";
import { loginWithGoogleCode, logout } from "./service";
import type { AuthContext } from "./types";
import { googleCallbackSchema } from "./validation";

export const authRouter = Router();

// Googleから戻ってきた認可コードでログインする。未登録ユーザーならusersを新規作成する。
// 認証不要（このAPIを呼ぶ時点ではまだログインしていない）。
authRouter.post("/auth/google/callback", async (req, res) => {
  const parsed = googleCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR("ログインに失敗しました。もう一度お試しください。");
  }

  const { sessionId, expiresAt, hasFamily } = await loginWithGoogleCode(
    parsed.data.code,
    env as Env,
  );

  res.setHeader("Set-Cookie", buildSessionCookie(sessionId, expiresAt));
  res.status(200).json({ hasFamily });
});

// ログイン状態と所属グループの有無を返す（ログイン画面の初期表示振り分けに使用）。
// 認証必須。requireAuth（src/index.ts）を通過済みで、未ログインならここへは到達せず401になる。
authRouter.get("/auth/me", (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  res.status(200).json({ hasFamily: user.familyId !== null });
});

// 認証必須。requireAuth（src/index.ts）を通過済み。
authRouter.post("/auth/logout", async (_req, res) => {
  const { sessionId } = res.locals.authContext as AuthContext;
  await logout(sessionId);
  res.setHeader("Set-Cookie", buildExpiredSessionCookie());
  res.status(204).end();
});
