import { Router } from "express";
import { Errors } from "../../shared/errors/app-error";
import type { AuthContext } from "../auth";
import { completeTodo, incompleteTodo, listTodos } from "./service";
import { listTodosQuerySchema } from "./validation";

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

todoRouter.post("/todos/:id/complete", async (req, res) => {
  const todoId = parseTodoId(req.params.id);
  const { user } = res.locals.authContext as AuthContext;
  await completeTodo(todoId, user);
  res.status(204).end();
});

todoRouter.post("/todos/:id/incomplete", async (req, res) => {
  const todoId = parseTodoId(req.params.id);
  const { user } = res.locals.authContext as AuthContext;
  await incompleteTodo(todoId, user);
  res.status(204).end();
});
