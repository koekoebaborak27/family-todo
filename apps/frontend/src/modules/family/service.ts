// 家族グループ作成・参加画面に表示するエラー文言・トースト文言。
// docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「5. 操作と遷移先」「7. エラー時の表示文言」のとおり。
export const FAMILY_ERROR_MESSAGES = {
  unauthorized: "ログインの有効期限が切れました。もう一度ログインしてください。",
  serverError: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
  network: "通信に失敗しました。電波状況を確認してもう一度お試しください。",
} as const;

// 移動先のToDo一覧画面で表示するトースト文言を組み立てる。
export function buildCreatedToastMessage(familyName: string): string {
  return `家族グループ「${familyName}」を作成しました。`;
}

export function buildJoinedToastMessage(familyName: string): string {
  return `家族グループ「${familyName}」に参加しました。`;
}
