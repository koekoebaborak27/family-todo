// Workers のバインディング・環境変数の型。
// ローカルは apps/backend/.dev.vars、実機は `wrangler secret put` で値を渡す。
export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  // CORSで許可するFrontendのオリジン（CSRF対策。docs/specs/03_detail-design/family-todo/30_ログインセッション管理.md「CSRF対策」）。
  FRONTEND_ORIGIN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}
