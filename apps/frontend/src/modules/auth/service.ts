const GOOGLE_OAUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_STATE_STORAGE_KEY = "family-todo:google-oauth-state";
const PENDING_INVITE_CODE_STORAGE_KEY = "family-todo:pending-invite-code";

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
// 招待リンク（/join?code=XXXXXXXX）経由でログインを挟んだ場合は、まだグループに
// 未所属である限り招待コードを引き継いだ家族グループ作成・参加画面へ進む
// （docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「2. 画面へのアクセス条件・初期表示」）。
export function getPostLoginPath(hasFamily: boolean, inviteCode?: string | null): string {
  if (!hasFamily && inviteCode) {
    return `/family/setup?code=${encodeURIComponent(inviteCode)}`;
  }
  return hasFamily ? "/todos" : "/family/setup";
}

// ログイン画面が招待コード付きで開かれた場合に、Google認可画面を経由しても
// 引き継げるようsessionStorageへ控える（OAuth state と同じ理由でsessionStorageを使う）。
export function storePendingInviteCode(inviteCode: string): void {
  sessionStorage.setItem(PENDING_INVITE_CODE_STORAGE_KEY, inviteCode);
}

// コールバック画面で、控えておいた招待コードを取り出す。一致確認は不要なため
// consumeOAuthStateとは異なり戻り値の真偽判定はしない。取り出し後は使い捨てるため削除する。
export function consumePendingInviteCode(): string | null {
  const inviteCode = sessionStorage.getItem(PENDING_INVITE_CODE_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_INVITE_CODE_STORAGE_KEY);
  return inviteCode;
}
