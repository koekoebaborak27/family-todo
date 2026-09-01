import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ApiErrorBody } from "shared";
import type { Env } from "./env";
import { authRouter, verifySession } from "./modules/auth";
import type { AuthContext } from "./modules/auth";
import { AppError } from "./shared/errors/app-error";
import { getSessionIdFromCookieHeader } from "./shared/http/session-cookie";

// Cloudflare Workers 上で Express を動かす構成（技術検証の結果。
// docs/todo/notes/cloudflare-workers-検証.md「検証1」を参照）。
const app = express();
app.use(express.json());

// CORS: FrontendのオリジンのみAPI呼び出しを許可する。CSRF対策の一部
// （docs/specs/03_detail-design/family-todo/30_ログインセッション管理.md「CSRF対策」）。
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", (env as Env).FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// 認証ガード（入口の1か所に集約。判定そのものはmodules/auth/serviceの純粋関数）。
// 有効なセッションならres.locals.authContextへ格納し、以降のハンドラから参照できるようにする。
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie);
  const user = await verifySession(sessionId);
  // verifySessionが例外を投げずに戻った時点でsessionIdは必ず文字列（未定義なら401で例外）。
  res.locals.authContext = { sessionId: sessionId as string, user } satisfies AuthContext;
  next();
}

// 動作確認用。画面・API本体の実装はここでは行わない。
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth/me", requireAuth);
app.use("/api/v1/auth/logout", requireAuth);
app.use("/api/v1", authRouter);

// エラー整形とログ出力は、業務コードではなくここで1回だけ行う
// （apps/backend/AGENTS.md「観測性（ログ）」）。
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    console.error(`[${err.code}]`, err.message, err.context ?? "");
    res
      .status(err.httpStatus)
      .json({ error: { code: err.code, message: err.message } } satisfies ApiErrorBody);
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
    },
  } satisfies ApiErrorBody);
});

app.listen(8080);

const httpHandler = httpServerHandler({ port: 8080 });

export default {
  fetch: httpHandler.fetch,

  // 期限接近・期限超過の通知バッチ（15分おき。wrangler.jsonc の triggers.crons で設定済み）。
  // バッチ本体（対象抽出・送信・重複防止）は未実装。詳細設計:
  // docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md
  async scheduled(_event, _env, _ctx) {
    // TODO: 実装フェーズで対象抽出・送信処理を追加する。
  },
} satisfies ExportedHandler<Env>;
