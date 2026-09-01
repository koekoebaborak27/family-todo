const GOOGLE_OAUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_STATE_STORAGE_KEY = "family-todo:google-oauth-state";

// ログイン画面に表示するエラー文言（唯一の正本）。
// docs/specs/02_basic-design/family-todo/10_ログイン.md「7. エラー時の表示文言」のとおり。
export const LOGIN_ERROR_MESSAGES = {
  cancelled: "Googleログインがキャンセルされました。もう一度お試しください。",
  invalidCode: "ログインに失敗しました。もう一度お試しください。",
  serverError: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
  network: "通信に失敗しました。電波状況を確認してもう一度お試しください。",
} as const;

// 「Googleでログイン」ボタンから遷移する先のURLを組み立てる。
// stateはGoogleの認可画面を経由するOAuthフロー自体へのCSRF対策（発行した値をsessionStorageへ控え、
// コールバック画面で一致を確認する）。
export function buildGoogleAuthUrl(clientId: string): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);

  const redirectUri = `${window.location.origin}/auth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `${GOOGLE_OAUTH_ENDPOINT}?${params.toString()}`;
}

// コールバック画面で、Googleから返ってきたstateが自分が発行したものと一致するか確認する。
// 一致確認後は使い捨てるため削除する。
export function consumeOAuthState(receivedState: string | null): boolean {
  const expected = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
  return receivedState !== null && receivedState === expected;
}

// ログイン成功後の遷移先を決める
// （docs/specs/02_basic-design/family-todo/10_ログイン.md「5. 操作と遷移先」）。
// 遷移先のToDo一覧・家族グループ作成/参加画面は別機能で実装するため、ここではパスのみ確定する。
export function getPostLoginPath(hasFamily: boolean): string {
  return hasFamily ? "/todos" : "/family/setup";
}
