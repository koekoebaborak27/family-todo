import type { AuthenticatedUser } from "../auth";
import { ensureFamilyMembership } from "../../shared/auth/ensure-family-membership";
import { Errors } from "../../shared/errors/app-error";
import {
  createFamilyRow,
  createUnregisteredMemberRow,
  deleteFamilyRow,
  deleteUnregisteredMemberRow,
  findFamilyByInviteCode,
  findFamilyById,
  findOldestFamilyMemberExcept,
  listFamilyMembers,
  listUnregisteredFamilyMembers,
  leaveFamilyRow,
  setUserFamilyId,
  updateFamilyCreator,
  updateInviteCode,
} from "./repository";
import type { FamilyDetail, FamilyMember, FamilySummary, UnregisteredFamilyMember } from "./types";
import type {
  CreateFamilyInput,
  CreateUnregisteredMemberInput,
  JoinFamilyInput,
} from "./validation";

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const INVITE_CODE_LIFETIME_DAYS = 7;
const INVITE_CODE_MAX_ATTEMPTS = 5;

function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => INVITE_CODE_CHARS[byte % INVITE_CODE_CHARS.length]).join("");
}

// 自分の家族グループで担当者に選べる、登録ユーザーを返す。
export async function getMyFamilyMembers(user: AuthenticatedUser): Promise<FamilyMember[]> {
  const familyId = ensureFamilyMembership(user);
  const members = await listFamilyMembers(familyId);
  return members.map((member) => ({
    id: member.id,
    displayName: member.display_name,
    isCurrentUser: member.id === user.id,
  }));
}

// 自分の家族グループで担当者に選べる、非登録メンバーを返す。
export async function getMyUnregisteredFamilyMembers(
  user: AuthenticatedUser,
): Promise<UnregisteredFamilyMember[]> {
  const familyId = ensureFamilyMembership(user);
  return listUnregisteredFamilyMembers(familyId);
}

// 非登録メンバーを追加する。同じ名前はDBの一意制約で409に変換する。
export async function addMyUnregisteredFamilyMember(
  input: CreateUnregisteredMemberInput,
  user: AuthenticatedUser,
): Promise<UnregisteredFamilyMember> {
  const familyId = ensureFamilyMembership(user);
  const member = await createUnregisteredMemberRow({ familyId, name: input.name });
  if (!member) {
    throw Errors.CONFLICT("同じ名前の非登録メンバーがすでに登録されています。");
  }
  return member;
}

// 非登録メンバーを削除する。所属グループ外のIDも存在しないものとして扱う。
export async function removeMyUnregisteredFamilyMember(
  memberId: number,
  user: AuthenticatedUser,
): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  const deleted = await deleteUnregisteredMemberRow(familyId, memberId);
  if (!deleted) {
    throw Errors.NOT_FOUND("この非登録メンバーは削除されています。");
  }
}

// 招待コードを再発行する。現在のコードは更新後に使えなくなる。
export async function renewMyFamilyInviteCode(user: AuthenticatedUser): Promise<FamilyDetail> {
  const family = await getMyFamily(user);
  const inviteCode = await generateUniqueInviteCode();
  const expiresAt = newInviteCodeExpiry();
  await updateInviteCode({ familyId: family.id, inviteCode, expiresAt });
  return { ...family, inviteCode, inviteCodeExpiresAt: expiresAt.toISOString() };
}

// 自分を家族グループから退出させる。最後のメンバーならグループ全体を削除する。
export async function leaveMyFamily(user: AuthenticatedUser): Promise<void> {
  const family = await getMyFamily(user);
  const nextCreator = await findOldestFamilyMemberExcept(family.id, user.id);
  if (!nextCreator) {
    await deleteFamilyRow(family.id);
    return;
  }
  await leaveFamilyRow(family.id, user.id);
  if (family.createdByUserId === user.id) {
    await updateFamilyCreator(family.id, nextCreator.id);
  }
}

// 作成者だけが家族グループ全体を削除する。
export async function deleteMyFamily(user: AuthenticatedUser): Promise<void> {
  const family = await getMyFamily(user);
  if (family.createdByUserId !== user.id) {
    throw Errors.FORBIDDEN("家族グループを削除できるのは、グループを作成した人だけです。");
  }
  await deleteFamilyRow(family.id);
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

// 自分の所属グループの情報を取得する。docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「9. 使用API」。
export async function getMyFamily(user: AuthenticatedUser): Promise<FamilyDetail> {
  const familyId = ensureFamilyMembership(user);

  const family = await findFamilyById(familyId);
  if (!family) {
    throw Errors.NOT_FOUND("所属している家族グループが見つかりません。");
  }

  return {
    id: family.id,
    name: family.name,
    inviteCode: family.invite_code,
    inviteCodeExpiresAt: family.invite_code_expires_at,
    createdByUserId: family.created_by_user_id,
    createdAt: family.created_at,
  };
}
