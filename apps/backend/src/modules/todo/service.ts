import { ensureFamilyMembership } from "../../shared/auth/ensure-family-membership";
import { Errors } from "../../shared/errors/app-error";
import type { AuthenticatedUser } from "../auth";
import {
  advanceTodoDueDate,
  countCommentsForTodoIds,
  countValidAssignees,
  createCommentRow,
  createTodoRow,
  deleteCommentRow,
  deleteTodoRows,
  findCommentFamilyId,
  findTodoRow,
  findTodoFamilyId,
  listAssigneesForTodoIds,
  listCommentRows,
  listTodoRows,
  markTodoCompleted,
  markTodoIncomplete,
  replaceTodoAssignees,
  updateTodoRow,
  updateCommentRow,
} from "./repository";
import { calculateNextDueAt } from "./recurrence";
import type { TodoAssigneeSummary, TodoDetail, TodoSummary } from "./types";
import type {
  CreateTodoInput,
  ListTodosQuery,
  ReplaceAssigneesInput,
  UpdateTodoInput,
  CommentInput,
} from "./validation";

// ToDo一覧を取得し、担当者・コメント件数を組み立てて返す。
export async function listTodos(
  user: AuthenticatedUser,
  query: ListTodosQuery,
): Promise<TodoSummary[]> {
  const familyId = ensureFamilyMembership(user);

  const rows = await listTodoRows({
    familyId,
    status: query.status,
    categoryId: query.category_id,
  });
  const todoIds = rows.map((row) => row.id);

  const [assigneeRows, commentCountRows] = await Promise.all([
    listAssigneesForTodoIds(todoIds),
    countCommentsForTodoIds(todoIds),
  ]);

  const assigneesByTodoId = new Map<number, TodoAssigneeSummary[]>();
  for (const assigneeRow of assigneeRows) {
    const assignee: TodoAssigneeSummary =
      assigneeRow.user_id !== null
        ? {
            type: "user",
            id: assigneeRow.user_id,
            displayName: assigneeRow.user_display_name ?? "",
          }
        : {
            type: "unregistered",
            id: assigneeRow.unregistered_member_id as number,
            displayName: assigneeRow.unregistered_name ?? "",
          };
    const list = assigneesByTodoId.get(assigneeRow.todo_id) ?? [];
    list.push(assignee);
    assigneesByTodoId.set(assigneeRow.todo_id, list);
  }

  const commentCountByTodoId = new Map(commentCountRows.map((row) => [row.todo_id, row.count]));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    memo: row.memo,
    dueAt: row.due_at,
    dueHasTime: row.due_has_time === 1,
    priority: row.priority as TodoSummary["priority"],
    categoryId: row.category_id,
    status: row.status as TodoSummary["status"],
    recurrenceType: row.recurrence_type as TodoSummary["recurrenceType"],
    assignees: assigneesByTodoId.get(row.id) ?? [],
    commentCount: commentCountByTodoId.get(row.id) ?? 0,
    completedByDisplayName: row.completed_by_display_name,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));
}

// 指定したToDoが自分の所属グループのものであることを確認する。存在しない・他グループのものは
// どちらも「削除されている」扱いにする（他グループのToDoの存在を漏らさないため）。
async function ensureTodoInMyFamily(todoId: number, familyId: number): Promise<void> {
  const todoFamilyId = await findTodoFamilyId(todoId);
  if (todoFamilyId === null || todoFamilyId !== familyId) {
    throw Errors.NOT_FOUND("このToDoは削除されています。");
  }
}

// 入力された担当者IDが、操作する人と同じ家族グループのものかを確認する。
async function ensureAssigneesInMyFamily(
  familyId: number,
  input: ReplaceAssigneesInput,
): Promise<void> {
  const userIds = [...input.userIds, ...input.followerUserIds];
  const counts = await countValidAssignees({
    familyId,
    userIds,
    unregisteredMemberIds: input.unregisteredMemberIds,
  });
  if (
    counts.users !== new Set(userIds).size ||
    counts.unregisteredMembers !== new Set(input.unregisteredMemberIds).size
  ) {
    throw Errors.VALIDATION_ERROR("担当者の選択内容を確認してください。");
  }
}

// 繰り返し設定をDB保存用JSONへ変換する。繰り返さない・毎日は設定値を持たない。
function serializeRecurrenceConfig(input: UpdateTodoInput): string | null {
  return input.recurrenceType === "weekly" || input.recurrenceType === "monthly"
    ? JSON.stringify(input.recurrenceConfig)
    : null;
}

// ToDoを追加し、担当者も同時に保存する。
export async function createTodo(
  input: CreateTodoInput,
  user: AuthenticatedUser,
): Promise<{ id: number }> {
  const familyId = ensureFamilyMembership(user);
  await ensureAssigneesInMyFamily(familyId, input);
  const todoId = await createTodoRow({
    familyId,
    createdByUserId: user.id,
    title: input.title,
    memo: input.memo,
    dueAt: input.dueAt,
    dueHasTime: input.dueHasTime,
    priority: input.priority,
    categoryId: input.categoryId,
    recurrenceType: input.recurrenceType,
    recurrenceConfig: serializeRecurrenceConfig(input),
  });
  await replaceTodoAssignees({
    todoId,
    userIds: input.userIds,
    unregisteredMemberIds: input.unregisteredMemberIds,
    followerUserIds: input.followerUserIds,
  });
  return { id: todoId };
}

// 編集画面に表示するToDoと担当者を取得する。
export async function getTodo(todoId: number, user: AuthenticatedUser): Promise<TodoDetail> {
  const familyId = ensureFamilyMembership(user);
  const row = await findTodoRow(todoId);
  if (!row || row.family_id !== familyId) {
    throw Errors.NOT_FOUND("このToDoは削除されています。");
  }
  const [assignees, comments] = await Promise.all([
    listAssigneesForTodoIds([todoId]),
    listCommentRows(todoId),
  ]);
  return {
    id: row.id,
    title: row.title,
    memo: row.memo,
    dueAt: row.due_at,
    dueHasTime: row.due_has_time === 1,
    priority: row.priority as TodoDetail["priority"],
    categoryId: row.category_id,
    status: row.status as TodoDetail["status"],
    recurrenceType: row.recurrence_type as TodoDetail["recurrenceType"],
    recurrenceConfig:
      row.recurrence_config === null
        ? null
        : (JSON.parse(row.recurrence_config) as TodoDetail["recurrenceConfig"]),
    assignees: assignees.map((assignee) => ({
      type: assignee.user_id === null ? "unregistered" : "user",
      id: (assignee.user_id ?? assignee.unregistered_member_id) as number,
      displayName: assignee.user_display_name ?? assignee.unregistered_name ?? "",
      isFollower: assignee.is_follower === 1,
    })),
    commentCount: comments.length,
    completedByDisplayName: row.completed_by_display_name,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    createdByDisplayName: row.created_by_display_name ?? "",
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      userDisplayName: comment.user_display_name,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    })),
  };
}

// ToDo本体を編集する。担当者は専用のreplaceTodoAssigneesで別に更新する。
export async function updateTodo(
  todoId: number,
  input: UpdateTodoInput,
  user: AuthenticatedUser,
): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await updateTodoRow(todoId, {
    title: input.title,
    memo: input.memo,
    dueAt: input.dueAt,
    dueHasTime: input.dueHasTime,
    priority: input.priority,
    categoryId: input.categoryId,
    recurrenceType: input.recurrenceType,
    recurrenceConfig: serializeRecurrenceConfig(input),
  });
}

// ToDoの担当者を、画面で選び直した内容に丸ごと置き換える。
export async function updateTodoAssignees(
  todoId: number,
  input: ReplaceAssigneesInput,
  user: AuthenticatedUser,
): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await ensureAssigneesInMyFamily(familyId, input);
  await replaceTodoAssignees({ todoId, ...input });
}

// ToDoを完了にする。繰り返し設定のあるToDoは完了にせず、期限を次回へ進める
// （docs/specs/02_basic-design/family-todo/16_ToDo追加・編集.md「8. DBへの影響」）。
export async function completeTodo(
  todoId: number,
  user: AuthenticatedUser,
): Promise<{ recurring: boolean; nextDueAt: string | null }> {
  const familyId = ensureFamilyMembership(user);
  const row = await findTodoRow(todoId);
  if (!row || row.family_id !== familyId) {
    throw Errors.NOT_FOUND("このToDoは削除されています。");
  }

  if (row.recurrence_type === "none") {
    await markTodoCompleted(todoId, user.id);
    return { recurring: false, nextDueAt: null };
  }

  const nextDueAt = calculateNextDueAt(
    row.due_at as string,
    row.due_has_time === 1,
    row.recurrence_type as Exclude<TodoDetail["recurrenceType"], "none">,
    row.recurrence_config === null
      ? null
      : (JSON.parse(row.recurrence_config) as TodoDetail["recurrenceConfig"]),
  );
  await advanceTodoDueDate(todoId, nextDueAt);
  return { recurring: true, nextDueAt };
}

export async function incompleteTodo(todoId: number, user: AuthenticatedUser): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await markTodoIncomplete(todoId);
}

// ToDoを削除する。関連するコメントと担当者も一緒に削除する。
export async function deleteTodo(todoId: number, user: AuthenticatedUser): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await deleteTodoRows(todoId);
}

// ToDoにコメントを追加する。
export async function createComment(
  todoId: number,
  input: CommentInput,
  user: AuthenticatedUser,
): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await createCommentRow(todoId, user.id, input.body);
}

// コメントの属する家族を確認する。存在しない・別グループなら同じ404を返す。
async function ensureCommentInMyFamily(commentId: number, familyId: number): Promise<void> {
  if ((await findCommentFamilyId(commentId)) !== familyId) {
    throw Errors.NOT_FOUND("このコメントは削除されています。");
  }
}

// コメント本文を更新する。グループ内のメンバー全員が操作できる。
export async function updateComment(
  commentId: number,
  input: CommentInput,
  user: AuthenticatedUser,
): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureCommentInMyFamily(commentId, familyId);
  await updateCommentRow(commentId, input.body);
}

// コメントを削除する。グループ内のメンバー全員が操作できる。
export async function deleteComment(commentId: number, user: AuthenticatedUser): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureCommentInMyFamily(commentId, familyId);
  await deleteCommentRow(commentId);
}
