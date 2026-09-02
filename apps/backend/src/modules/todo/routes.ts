import { Router } from "express";
import { Errors } from "../../shared/errors/app-error";
import type { AuthContext } from "../auth";
import {
  completeTodo,
  createComment,
  createTodo,
  deleteComment,
  deleteTodo,
  getTodo,
  incompleteTodo,
  listTodos,
  updateTodo,
  updateTodoAssignees,
  updateComment,
} from "./service";
import {
  createTodoSchema,
  listTodosQuerySchema,
  replaceAssigneesSchema,
  updateTodoSchema,
  commentSchema,
} from "./validation";

export const todoRouter = Router();

// ToDo一覧を取得する。requireAuth（src/index.ts）を通過済み。
// グループ未所属なら403（service側でensureFamilyMembershipにより判定）。
todoRouter.get("/todos", async (req, res) => {
  const parsed = listTodosQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "検索条件が正しくありません。",
    );
  }

  const { user } = res.locals.authContext as AuthContext;
  const todos = await listTodos(user, parsed.data);
  res.status(200).json(todos);
});

// URLパラメータのToDoIDを数値へ変換する。数値でなければ「削除されている」扱いと同じ404にする
// （存在しないIDへのアクセスと区別する情報を返さないため）。
function parseTodoId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw Errors.NOT_FOUND("このToDoは削除されています。");
  }
  return id;
}

// ToDoを1件追加する。担当者も同じリクエストの内容で保存する。
todoRouter.post("/todos", async (req, res) => {
  const parsed = createTodoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }
  const { user } = res.locals.authContext as AuthContext;
  const todo = await createTodo(parsed.data, user);
  res.status(201).json(todo);
});

// ToDoの編集画面に必要な内容を返す。
todoRouter.get("/todos/:id", async (req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  const todo = await getTodo(parseTodoId(req.params.id), user);
  res.status(200).json(todo);
});

// ToDo本体を更新する。担当者はPUT /todos/:id/assigneesで置き換える。
todoRouter.patch("/todos/:id", async (req, res) => {
  const parsed = updateTodoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }
  const { user } = res.locals.authContext as AuthContext;
  await updateTodo(parseTodoId(req.params.id), parsed.data, user);
  res.status(204).end();
});

// ToDoの担当者を丸ごと置き換える。
todoRouter.put("/todos/:id/assignees", async (req, res) => {
  const parsed = replaceAssigneesSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }
  const { user } = res.locals.authContext as AuthContext;
  await updateTodoAssignees(parseTodoId(req.params.id), parsed.data, user);
  res.status(204).end();
});

todoRouter.post("/todos/:id/complete", async (req, res) => {
  const todoId = parseTodoId(req.params.id);
  const { user } = res.locals.authContext as AuthContext;
  const result = await completeTodo(todoId, user);
  res.status(200).json(result);
});

todoRouter.post("/todos/:id/incomplete", async (req, res) => {
  const todoId = parseTodoId(req.params.id);
  const { user } = res.locals.authContext as AuthContext;
  await incompleteTodo(todoId, user);
  res.status(204).end();
});

// ToDoを削除する。コメントと担当者も同時に削除する。
todoRouter.delete("/todos/:id", async (req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  await deleteTodo(parseTodoId(req.params.id), user);
  res.status(204).end();
});

// ToDoにコメントを追加する。
todoRouter.post("/todos/:id/comments", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success)
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  const { user } = res.locals.authContext as AuthContext;
  await createComment(parseTodoId(req.params.id), parsed.data, user);
  res.status(204).end();
});

// コメントを編集する。投稿者以外の家族も操作できる。
todoRouter.patch("/comments/:id", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success)
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  const { user } = res.locals.authContext as AuthContext;
  await updateComment(parseTodoId(req.params.id), parsed.data, user);
  res.status(204).end();
});

// コメントを削除する。投稿者以外の家族も操作できる。
todoRouter.delete("/comments/:id", async (req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  await deleteComment(parseTodoId(req.params.id), user);
  res.status(204).end();
});
