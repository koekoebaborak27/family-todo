import { getDb } from "../../shared/db/get-db";

export interface TodoRow {
  id: number;
  title: string;
  memo: string | null;
  due_at: string | null;
  due_has_time: number;
  priority: string;
  category_id: number;
  status: string;
  recurrence_type: string;
  completed_at: string | null;
  completed_by_display_name: string | null;
  created_at: string;
}

// 家族グループ内のToDoを、完了状態・カテゴリで絞り込んで取得する。
// 並び替えは画面側で行うため作成日時の新しい順で返す
// （docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.4」）。
export async function listTodoRows(params: {
  familyId: number;
  status: string;
  categoryId?: number;
}): Promise<TodoRow[]> {
  const conditions = ["t.family_id = ?", "t.status = ?"];
  const bindings: (string | number)[] = [params.familyId, params.status];
  if (params.categoryId !== undefined) {
    conditions.push("t.category_id = ?");
    bindings.push(params.categoryId);
  }

  const { results } = await getDb()
    .prepare(
      `SELECT t.id, t.title, t.memo, t.due_at, t.due_has_time, t.priority, t.category_id, t.status,
              t.recurrence_type, t.completed_at, t.created_at, completer.display_name AS completed_by_display_name
       FROM todos t
       LEFT JOIN users completer ON completer.id = t.completed_by_user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.created_at DESC`,
    )
    .bind(...bindings)
    .all<TodoRow>();
  return results;
}

export interface AssigneeRow {
  todo_id: number;
  user_id: number | null;
  unregistered_member_id: number | null;
  user_display_name: string | null;
  unregistered_name: string | null;
  // 一覧用の既存テストデータと互換を保つため、未取得時はフォロー役ではないものとして扱う。
  is_follower?: number;
}

// 指定したToDo群の担当者を、登録ユーザー・非登録メンバーの名前を解決したうえでまとめて取得する。
export async function listAssigneesForTodoIds(todoIds: number[]): Promise<AssigneeRow[]> {
  if (todoIds.length === 0) {
    return [];
  }
  const placeholders = todoIds.map(() => "?").join(", ");
  const { results } = await getDb()
    .prepare(
      `SELECT ta.todo_id, ta.user_id, ta.unregistered_member_id, ta.is_follower,
              u.display_name AS user_display_name, um.name AS unregistered_name
       FROM todo_assignees ta
       LEFT JOIN users u ON u.id = ta.user_id
       LEFT JOIN unregistered_members um ON um.id = ta.unregistered_member_id
       WHERE ta.todo_id IN (${placeholders})`,
    )
    .bind(...todoIds)
    .all<AssigneeRow>();
  return results;
}

// ToDoを1件取得する。編集・担当者置換の前に、所属グループを確認するために使う。
export async function findTodoRow(
  todoId: number,
): Promise<(TodoRow & { family_id: number; recurrence_config: string | null }) | null> {
  const row = await getDb()
    .prepare(
      `SELECT id, family_id, title, memo, due_at, due_has_time, priority, category_id, status,
              recurrence_type, recurrence_config, completed_at, created_at
       FROM todos WHERE id = ?`,
    )
    .bind(todoId)
    .first<TodoRow & { family_id: number; recurrence_config: string | null }>();
  return row ?? null;
}

// ToDoを追加し、採番されたIDを返す。担当者は呼び出し側で続けて保存する。
export async function createTodoRow(params: {
  familyId: number;
  createdByUserId: number;
  title: string;
  memo: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  priority: string;
  categoryId: number;
  recurrenceType: string;
  recurrenceConfig: string | null;
}): Promise<number> {
  const row = await getDb()
    .prepare(
      `INSERT INTO todos (family_id, title, memo, due_at, due_has_time, priority, category_id, recurrence_type, recurrence_config, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      params.familyId,
      params.title,
      params.memo,
      params.dueAt,
      params.dueHasTime ? 1 : 0,
      params.priority,
      params.categoryId,
      params.recurrenceType,
      params.recurrenceConfig,
      params.createdByUserId,
    )
    .first<{ id: number }>();
  if (!row) {
    throw new Error("ToDoの追加に失敗しました。");
  }
  return row.id;
}

// ToDo本体を更新する。完了状態と作成者は編集で変えない。
export async function updateTodoRow(
  todoId: number,
  params: Omit<Parameters<typeof createTodoRow>[0], "familyId" | "createdByUserId">,
): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE todos SET title = ?, memo = ?, due_at = ?, due_has_time = ?, priority = ?, category_id = ?,
       recurrence_type = ?, recurrence_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(
      params.title,
      params.memo,
      params.dueAt,
      params.dueHasTime ? 1 : 0,
      params.priority,
      params.categoryId,
      params.recurrenceType,
      params.recurrenceConfig,
      todoId,
    )
    .run();
}

// 指定ToDoの担当者を全件入れ替える。登録ユーザーのフォロー役はis_followerで識別する。
export async function replaceTodoAssignees(params: {
  todoId: number;
  userIds: number[];
  unregisteredMemberIds: number[];
  followerUserIds: number[];
}): Promise<void> {
  const db = getDb();
  const statements = [
    db.prepare("DELETE FROM todo_assignees WHERE todo_id = ?").bind(params.todoId),
  ];
  for (const userId of new Set([...params.userIds, ...params.followerUserIds])) {
    statements.push(
      db
        .prepare("INSERT INTO todo_assignees (todo_id, user_id, is_follower) VALUES (?, ?, ?)")
        .bind(params.todoId, userId, params.followerUserIds.includes(userId) ? 1 : 0),
    );
  }
  for (const memberId of new Set(params.unregisteredMemberIds)) {
    statements.push(
      db
        .prepare("INSERT INTO todo_assignees (todo_id, unregistered_member_id) VALUES (?, ?)")
        .bind(params.todoId, memberId),
    );
  }
  await db.batch(statements);
}

// 担当者として指定されたIDが、同じ家族グループに属するかを確認する。
// 他グループのユーザーや存在しないIDをToDoへ関連付けないために使う。
export async function countValidAssignees(params: {
  familyId: number;
  userIds: number[];
  unregisteredMemberIds: number[];
}): Promise<{ users: number; unregisteredMembers: number }> {
  const userIds = [...new Set(params.userIds)];
  const memberIds = [...new Set(params.unregisteredMemberIds)];
  const users =
    userIds.length === 0
      ? 0
      : ((
          await getDb()
            .prepare(
              `SELECT COUNT(*) AS count FROM users WHERE family_id = ? AND id IN (${userIds.map(() => "?").join(",")})`,
            )
            .bind(params.familyId, ...userIds)
            .first<{ count: number }>()
        )?.count ?? 0);
  const unregisteredMembers =
    memberIds.length === 0
      ? 0
      : ((
          await getDb()
            .prepare(
              `SELECT COUNT(*) AS count FROM unregistered_members WHERE family_id = ? AND id IN (${memberIds.map(() => "?").join(",")})`,
            )
            .bind(params.familyId, ...memberIds)
            .first<{ count: number }>()
        )?.count ?? 0);
  return { users, unregisteredMembers };
}

export interface CommentCountRow {
  todo_id: number;
  count: number;
}

// 指定したToDo群のコメント件数をまとめて取得する（コメントが無いToDoは結果に含まれない）。
export async function countCommentsForTodoIds(todoIds: number[]): Promise<CommentCountRow[]> {
  if (todoIds.length === 0) {
    return [];
  }
  const placeholders = todoIds.map(() => "?").join(", ");
  const { results } = await getDb()
    .prepare(
      `SELECT todo_id, COUNT(*) AS count FROM comments WHERE todo_id IN (${placeholders}) GROUP BY todo_id`,
    )
    .bind(...todoIds)
    .all<CommentCountRow>();
  return results;
}

// ToDoの所属グループを確認する。存在しなければnull（完了/未完了の切り替え時、
// 他グループのToDoや削除済みのToDoを操作できないようにするために使う）。
export async function findTodoFamilyId(todoId: number): Promise<number | null> {
  const row = await getDb()
    .prepare("SELECT family_id FROM todos WHERE id = ?")
    .bind(todoId)
    .first<{ family_id: number }>();
  return row?.family_id ?? null;
}

export async function markTodoCompleted(todoId: number, userId: number): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE todos
       SET status = 'completed', completed_by_user_id = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(userId, todoId)
    .run();
}

export async function markTodoIncomplete(todoId: number): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE todos
       SET status = 'incomplete', completed_by_user_id = NULL, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(todoId)
    .run();
}
