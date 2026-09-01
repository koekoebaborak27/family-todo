// ログイン中のユーザーを表す最小限の情報。認証ガード（requireAuth）が他モジュールへ渡す。
export interface AuthenticatedUser {
  id: number;
  familyId: number | null;
}

// GET /auth/me の応答（ログイン画面の初期表示振り分けに使う）。
// 未ログインの場合は200ではなく401を返すため、bodyに持たせるのは所属グループの有無のみ。
export interface MeResponse {
  hasFamily: boolean;
}

// requireAuthミドルウェア（src/index.ts）がres.localsへ格納する、検証済みの認証情報。
export interface AuthContext {
  sessionId: string;
  user: AuthenticatedUser;
}

// POST /auth/google/callback 成功時にrepositoryへ保存するセッション情報。
export interface CreatedSession {
  sessionId: string;
  expiresAt: Date;
}

// Googleのidトークンから取り出す、ログインに必要な項目。
export interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  name: string;
}
