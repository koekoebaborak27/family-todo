import { ensureFamilyMembership } from "../../shared/auth/ensure-family-membership";
import { Errors } from "../../shared/errors/app-error";
import type { AuthenticatedUser } from "../auth";
import {
  countCommentsForTodoIds,
  findTodoFamilyId,
  listAssigneesForTodoIds,
  listTodoRows,
  markTodoCompleted,
  markTodoIncomplete,
} from "./repository";
import type { TodoAssigneeSummary, TodoSummary } from "./types";
import type { ListTodosQuery } from "./validation";

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

// ToDoを完了にする。繰り返し設定を持つToDoの次回分の扱いはToDo追加・編集側の責務
// （docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「8. DBへの影響」）のため、ここでは扱わない。
export async function completeTodo(todoId: number, user: AuthenticatedUser): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await markTodoCompleted(todoId, user.id);
}

export async function incompleteTodo(todoId: number, user: AuthenticatedUser): Promise<void> {
  const familyId = ensureFamilyMembership(user);
  await ensureTodoInMyFamily(todoId, familyId);
  await markTodoIncomplete(todoId);
}
