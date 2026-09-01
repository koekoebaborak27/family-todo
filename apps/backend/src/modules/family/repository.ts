import { getDb } from "../../shared/db/get-db";

export interface FamilyRow {
  id: number;
  name: string;
  invite_code_expires_at: string;
}

// 招待コードでfamiliesを検索する。参加時の存在確認・有効期限確認、および
// 招待コード生成時の重複チェックの両方に使う。
export async function findFamilyByInviteCode(inviteCode: string): Promise<FamilyRow | null> {
  const row = await getDb()
    .prepare("SELECT id, name, invite_code_expires_at FROM families WHERE invite_code = ?")
    .bind(inviteCode)
    .first<FamilyRow>();
  return row ?? null;
}

// familiesへ1件追加する。作成者はこの時点ではまだメンバーではないため、
// 呼び出し側で続けて setUserFamilyId を呼ぶ必要がある。
export async function createFamilyRow(params: {
  name: string;
  createdByUserId: number;
  inviteCode: string;
  expiresAt: Date;
}): Promise<{ id: number; name: string }> {
  const row = await getDb()
    .prepare(
      "INSERT INTO families (name, invite_code, invite_code_expires_at, created_by_user_id) VALUES (?, ?, ?, ?) RETURNING id, name",
    )
    .bind(params.name, params.inviteCode, params.expiresAt.toISOString(), params.createdByUserId)
    .first<{ id: number; name: string }>();

  if (!row) {
    throw new Error("家族グループの作成に失敗しました。");
  }
  return row;
}

// usersの所属グループを更新する（作成・参加どちらでも使う）。
export async function setUserFamilyId(userId: number, familyId: number): Promise<void> {
  await getDb().prepare("UPDATE users SET family_id = ? WHERE id = ?").bind(familyId, userId).run();
}

export interface FamilyDetailRow {
  id: number;
  name: string;
  invite_code: string;
  invite_code_expires_at: string;
  created_by_user_id: number;
  created_at: string;
}

// 指定した家族グループに所属する、ログイン可能なメンバーを取得する。
// ToDoの担当者・通知を受け取る家族の選択肢に使う。
export async function listFamilyMembers(
  familyId: number,
): Promise<{ id: number; display_name: string }[]> {
  const { results } = await getDb()
    .prepare("SELECT id, display_name FROM users WHERE family_id = ? ORDER BY id")
    .bind(familyId)
    .all<{ id: number; display_name: string }>();
  return results;
}

// 指定した家族グループに登録済みの、ログインしないメンバーを取得する。
// ToDoの担当者選択で、登録ユーザーとは分けて表示する。
export async function listUnregisteredFamilyMembers(
  familyId: number,
): Promise<{ id: number; name: string }[]> {
  const { results } = await getDb()
    .prepare("SELECT id, name FROM unregistered_members WHERE family_id = ? ORDER BY id")
    .bind(familyId)
    .all<{ id: number; name: string }>();
  return results;
}

// idで家族グループの詳細を取得する。GET /families/me で使う。
export async function findFamilyById(id: number): Promise<FamilyDetailRow | null> {
  const row = await getDb()
    .prepare(
      "SELECT id, name, invite_code, invite_code_expires_at, created_by_user_id, created_at FROM families WHERE id = ?",
    )
    .bind(id)
    .first<FamilyDetailRow>();
  return row ?? null;
}
