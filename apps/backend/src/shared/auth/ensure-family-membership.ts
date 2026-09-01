import { Errors } from "../errors/app-error";

// グループ所属者専用のAPI（ToDo・家族グループ情報など）の入口で使う。
// 未所属なら403（docs/specs/02_basic-design/family-todo/00_family-todo共通.md「認証・アクセス制御」）。
// 所属していれば所属グループのidを返す。
export function ensureFamilyMembership(user: { familyId: number | null }): number {
  if (user.familyId === null) {
    throw Errors.FORBIDDEN("家族グループに参加していません。");
  }
  return user.familyId;
}
