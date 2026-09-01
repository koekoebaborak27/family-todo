// 入力チェック（ボタン押下時に実行する）。
// docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「4. 入力チェック」のとおり。
const FAMILY_NAME_MAX_LENGTH = 30;
const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/;

export function validateFamilyName(name: string): string | null {
  if (name.trim().length === 0) {
    return "グループ名を入力してください。";
  }
  if (name.length > FAMILY_NAME_MAX_LENGTH) {
    return "グループ名は30文字以内で入力してください。";
  }
  return null;
}

export function validateInviteCode(inviteCode: string): string | null {
  if (inviteCode.trim().length === 0) {
    return "招待コードを入力してください。";
  }
  if (!INVITE_CODE_PATTERN.test(inviteCode)) {
    return "招待コードは半角英数字8桁で入力してください。";
  }
  return null;
}
