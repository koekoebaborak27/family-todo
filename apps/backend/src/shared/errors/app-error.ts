// 業務コードから送出する唯一のエラー型。
// try/catch やログを業務コードに書かない代わりに、ここへエラー内容（コード・HTTPステータス・
// 利用者向け文言）を詰めて投げる。ログ出力とレスポンス整形は入口（src/index.ts）が1回だけ行う。
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: string,
    httpStatus: number,
    userMessage: string,
    context?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
  }
}

// よく使うエラーをコードとHTTPステータスを揃えて生成するための入口。
// 独自のエラーコードが必要な場合はこのファクトリを使わず AppError を直接 new してよい。
export const Errors = {
  UNAUTHORIZED: (userMessage: string, context?: Record<string, unknown>) =>
    new AppError("UNAUTHORIZED", 401, userMessage, context),
  FORBIDDEN: (userMessage: string, context?: Record<string, unknown>) =>
    new AppError("FORBIDDEN", 403, userMessage, context),
  NOT_FOUND: (userMessage: string, context?: Record<string, unknown>) =>
    new AppError("NOT_FOUND", 404, userMessage, context),
  VALIDATION_ERROR: (userMessage: string, context?: Record<string, unknown>) =>
    new AppError("VALIDATION_ERROR", 400, userMessage, context),
  CONFLICT: (userMessage: string, context?: Record<string, unknown>) =>
    new AppError("CONFLICT", 409, userMessage, context),
};
