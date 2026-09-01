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

// 非登録メンバーを家族グループへ追加し、追加した情報を返す。
export async function createUnregisteredMemberRow(params: {
  familyId: number;
  name: string;
}): Promise<{ id: number; name: string } | null> {
  const row = await getDb()
    .prepare(
      "INSERT INTO unregistered_members (family_id, name) VALUES (?, ?) ON CONFLICT(family_id, name) DO NOTHING RETURNING id, name",
    )
    .bind(params.familyId, params.name)
    .first<{ id: number; name: string }>();

  return row ?? null;
}

// 家族グループ内の非登録メンバーを削除する。削除件数を返して、存在確認に使う。
export async function deleteUnregisteredMemberRow(
  familyId: number,
  memberId: number,
): Promise<boolean> {
  const db = getDb();
  const member = await db
    .prepare("SELECT id FROM unregistered_members WHERE id = ? AND family_id = ?")
    .bind(memberId, familyId)
    .first<{ id: number }>();
  if (!member) {
    return false;
  }
  await db.batch([
    db.prepare("DELETE FROM todo_assignees WHERE unregistered_member_id = ?").bind(memberId),
    db.prepare("DELETE FROM unregistered_members WHERE id = ?").bind(memberId),
  ]);
  return true;
}

// 招待コードと有効期限を新しい値へ更新する。
export async function updateInviteCode(params: {
  familyId: number;
  inviteCode: string;
  expiresAt: Date;
}): Promise<void> {
  await getDb()
    .prepare("UPDATE families SET invite_code = ?, invite_code_expires_at = ? WHERE id = ?")
    .bind(params.inviteCode, params.expiresAt.toISOString(), params.familyId)
    .run();
}

// 指定ユーザー以外で最も早く参加したメンバーを返す。作成者の引き継ぎに使う。
export async function findOldestFamilyMemberExcept(
  familyId: number,
  excludedUserId: number,
): Promise<{ id: number } | null> {
  const row = await getDb()
    .prepare(
      "SELECT id FROM users WHERE family_id = ? AND id != ? ORDER BY created_at ASC, id ASC LIMIT 1",
    )
    .bind(familyId, excludedUserId)
    .first<{ id: number }>();
  return row ?? null;
}

// グループ退出時に、自分を担当者にした関連付けと所属情報を削除する。
export async function leaveFamilyRow(familyId: number, userId: number): Promise<void> {
  const db = getDb();
  await db.batch([
    db
      .prepare(
        "DELETE FROM todo_assignees WHERE user_id = ? AND todo_id IN (SELECT id FROM todos WHERE family_id = ?)",
      )
      .bind(userId, familyId),
    db.prepare("UPDATE users SET family_id = NULL WHERE id = ?").bind(userId),
  ]);
}

// 残ったメンバーへグループ作成者を引き継ぐ。
export async function updateFamilyCreator(familyId: number, userId: number): Promise<void> {
  await getDb()
    .prepare("UPDATE families SET created_by_user_id = ? WHERE id = ?")
    .bind(userId, familyId)
    .run();
}

// グループとグループに属するデータを削除する。外部キーの参照順に削除する。
export async function deleteFamilyRow(familyId: number): Promise<void> {
  const db = getDb();
  await db.batch([
    db
      .prepare("DELETE FROM comments WHERE todo_id IN (SELECT id FROM todos WHERE family_id = ?)")
      .bind(familyId),
    db
      .prepare(
        "DELETE FROM todo_assignees WHERE todo_id IN (SELECT id FROM todos WHERE family_id = ?)",
      )
      .bind(familyId),
    db.prepare("DELETE FROM todos WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM unregistered_members WHERE family_id = ?").bind(familyId),
    db.prepare("UPDATE users SET family_id = NULL WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM families WHERE id = ?").bind(familyId),
  ]);
}
