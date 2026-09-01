// APIの共通エラーレスポンスの形（docs/specs/02_basic-design/family-todo/00_family-todo共通.md「API共通規約」）。
// FrontendとBackendの両方で参照する。
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
