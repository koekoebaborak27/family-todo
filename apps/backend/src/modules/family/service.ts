import type { AuthenticatedUser } from "../auth";
import { Errors } from "../../shared/errors/app-error";
import { createFamilyRow, findFamilyByInviteCode, setUserFamilyId } from "./repository";
import type { FamilySummary } from "./types";
import type { CreateFamilyInput, JoinFamilyInput } from "./validation";

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const INVITE_CODE_LIFETIME_DAYS = 7;
const INVITE_CODE_MAX_ATTEMPTS = 5;

function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => INVITE_CODE_CHARS[byte % INVITE_CODE_CHARS.length]).join("");
}

// 半角英数字8桁（大文字）の招待コードを、既存のコードと重複しないものが
// 見つかるまで生成する（衝突確率は極めて低いが念のため再試行する）。
async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode();
    const existing = await findFamilyByInviteCode(code);
    if (!existing) {
      return code;
    }
  }
  throw new Error("招待コードの生成に失敗しました。");
}

function newInviteCodeExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITE_CODE_LIFETIME_DAYS);
  return expiresAt;
}

// グループ未所属であることを確認する。作成・参加どちらの入口でも最初に呼ぶ。
function ensureNotAlreadyInFamily(user: AuthenticatedUser): void {
  if (user.familyId !== null) {
    throw Errors.CONFLICT("すでに家族グループに参加しています。");
  }
}

// 家族グループを新規作成し、自分を最初のメンバーにする。
// docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「8. DBへの影響」。
export async function createFamily(
  input: CreateFamilyInput,
  user: AuthenticatedUser,
): Promise<FamilySummary> {
  ensureNotAlreadyInFamily(user);

  const inviteCode = await generateUniqueInviteCode();
  const family = await createFamilyRow({
    name: input.name,
    createdByUserId: user.id,
    inviteCode,
    expiresAt: newInviteCodeExpiry(),
  });
  await setUserFamilyId(user.id, family.id);

  return family;
}

// 招待コードで既存の家族グループに参加する。
export async function joinFamily(
  input: JoinFamilyInput,
  user: AuthenticatedUser,
): Promise<FamilySummary> {
  ensureNotAlreadyInFamily(user);

  const family = await findFamilyByInviteCode(input.inviteCode);
  if (!family) {
    throw Errors.NOT_FOUND("招待コードが正しくありません。家族に確認してください。");
  }
  if (new Date(family.invite_code_expires_at).getTime() <= Date.now()) {
    throw Errors.VALIDATION_ERROR(
      "この招待コードは有効期限が切れています。家族に招待リンクを再発行してもらってください。",
    );
  }

  await setUserFamilyId(user.id, family.id);
  return { id: family.id, name: family.name };
}
