"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchMe } from "@/modules/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  completeTodo,
  createComment,
  deleteComment,
  deleteTodo,
  fetchCategories,
  fetchTodo,
  incompleteTodo,
  TodoError,
  updateComment,
} from "../api-client";
import {
  assigneeLabel,
  formatCommentDate,
  formatCompletedInfo,
  formatCreatedInfo,
  formatDueAt,
  isOverdue,
  PRIORITY_LABELS,
  recurrenceDetailLabel,
} from "../service";
import type { Category, TodoComment, TodoDetail } from "../types";

// ToDo詳細画面。内容の確認、完了切り替え、削除、コメント操作をまとめて行う。
export function TodoDetailScreen({ todoId }: { todoId: number }) {
  const router = useRouter();
  const invalidTodoId = !Number.isInteger(todoId) || todoId <= 0;
  const [todo, setTodo] = useState<TodoDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [editingComment, setEditingComment] = useState<TodoComment | null>(null);
  const [deleteTodoOpen, setDeleteTodoOpen] = useState(false);
  const [deleteCommentOpen, setDeleteCommentOpen] = useState<TodoComment | null>(null);

  // 詳細とカテゴリを取り直す。コメント操作の後にも同じ内容で画面を最新化する。
  function loadTodo() {
    setLoading(true);
    Promise.all([fetchMe(), fetchTodo(todoId), fetchCategories()])
      .then(([me, loadedTodo, loadedCategories]) => {
        if (!me.authenticated) return router.replace("/");
        if (!me.hasFamily) return router.replace("/family/setup");
        setTodo(loadedTodo);
        setCategories(loadedCategories);
        setError(null);
      })
      .catch((caught: TodoError) => {
        if (caught.kind === "unauthorized") return router.replace("/");
        if (caught.kind === "forbidden") return router.replace("/family/setup");
        setError(
          caught.kind === "notFound"
            ? "このToDoは見つかりませんでした。すでに削除された可能性があります。"
            : "ToDoの読み込みに失敗しました。時間をおいてもう一度お試しください。",
        );
      })
      .finally(() => setLoading(false));
  }

  // 画面を開いたときに認証・所属を確認してから内容を取得する。
  useEffect(() => {
    if (invalidTodoId) return;
    // 読み込み開始を次の処理へ送ることで、effect中の同期的な状態更新を避ける。
    void Promise.resolve().then(loadTodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidTodoId, todoId]);

  // 完了状態を切り替え、成功後は詳細を取り直す。
  async function handleToggleComplete() {
    if (!todo) return;
    try {
      if (todo.status === "incomplete") {
        await completeTodo(todo.id);
        toast.success("完了にしました。");
      } else {
        await incompleteTodo(todo.id);
        toast.success("未完了に戻しました。");
      }
      loadTodo();
    } catch (caught) {
      if (caught instanceof TodoError && caught.kind === "unauthorized") return router.replace("/");
      toast.error("更新に失敗しました。もう一度お試しください。");
    }
  }

  // ToDoを削除し、一覧へ戻る。
  async function handleDeleteTodo() {
    if (!todo) return;
    try {
      await deleteTodo(todo.id);
      toast.success("ToDoを削除しました。");
      router.replace("/todos");
    } catch (caught) {
      if (caught instanceof TodoError && caught.kind === "unauthorized") return router.replace("/");
      if (caught instanceof TodoError && caught.kind === "notFound") {
        toast.error("このToDoは削除されています。");
        return router.replace("/todos");
      }
      toast.error("削除に失敗しました。もう一度お試しください。");
    }
  }

  // 新規コメントを保存し、入力欄を空にして一覧を更新する。
  async function handleCreateComment() {
    if (!todo || !commentBody.trim()) return;
    if (commentBody.length > 500) return toast.error("コメントは500文字以内で入力してください。");
    try {
      await createComment(todo.id, commentBody.trim());
      setCommentBody("");
      loadTodo();
    } catch {
      toast.error("コメントの保存に失敗しました。もう一度お試しください。");
    }
  }

  // 編集中のコメントを保存し、一覧を更新する。
  async function handleUpdateComment() {
    if (!editingComment || !editingComment.body.trim()) return;
    if (editingComment.body.length > 500)
      return toast.error("コメントは500文字以内で入力してください。");
    try {
      await updateComment(editingComment.id, editingComment.body.trim());
      setEditingComment(null);
      loadTodo();
    } catch {
      toast.error("コメントの保存に失敗しました。もう一度お試しください。");
    }
  }

  // コメントを削除し、一覧を更新する。
  async function handleDeleteComment() {
    if (!deleteCommentOpen) return;
    try {
      await deleteComment(deleteCommentOpen.id);
      setDeleteCommentOpen(null);
      loadTodo();
    } catch (caught) {
      if (caught instanceof TodoError && caught.kind === "notFound") {
        toast.error("このコメントは削除されています。");
        return loadTodo();
      }
      toast.error("コメントの削除に失敗しました。もう一度お試しください。");
    }
  }

  if (invalidTodoId)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert">このToDoは見つかりませんでした。すでに削除された可能性があります。</p>
        <Button variant="outline" onClick={() => router.replace("/todos")}>
          ToDo一覧へ戻る
        </Button>
      </main>
    );
  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">読み込んでいます…</p>
      </main>
    );
  if (error)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert">{error}</p>
        <Button variant="outline" onClick={() => (todo ? loadTodo() : router.replace("/todos"))}>
          {todo ? "再読み込み" : "ToDo一覧へ戻る"}
        </Button>
      </main>
    );
  if (!todo) return null;

  const category = categories.find((item) => item.id === todo.categoryId);
  const overdue = isOverdue(todo);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="ToDo一覧へ戻る"
          onClick={() => router.push("/todos")}
        >
          <ArrowLeft />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/todos/${todo.id}/edit`)}>
            <Pencil />
            編集
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteTodoOpen(true)}>
            <Trash2 />
            削除
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={todo.status === "completed" ? "secondary" : "default"}>
            {todo.status === "completed" ? "完了" : "未完了"}
          </Badge>
          <Badge
            variant={
              todo.priority === "high"
                ? "destructive"
                : todo.priority === "medium"
                  ? "default"
                  : "secondary"
            }
          >
            {PRIORITY_LABELS[todo.priority]}
          </Badge>
          {category && <Badge variant="outline">{category.name}</Badge>}
          {overdue && <Badge variant="destructive">期限切れ</Badge>}
        </div>
        <h1 className="text-2xl font-semibold break-words">{todo.title}</h1>
        {todo.status === "completed" && todo.completedByDisplayName && todo.completedAt && (
          <p className="text-sm text-muted-foreground">
            {formatCompletedInfo(todo.completedByDisplayName, todo.completedAt)}
          </p>
        )}
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">期限</dt>
            <dd>{todo.dueAt ? formatDueAt(todo.dueAt, todo.dueHasTime) : "期限なし"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">繰り返し</dt>
            <dd>{recurrenceDetailLabel(todo)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">担当者</dt>
            <dd>
              {todo.assignees.length
                ? todo.assignees
                    .map(
                      (item) =>
                        `${assigneeLabel(item)}${item.isFollower ? "(通知の受け取り役)" : ""}`,
                    )
                    .join("、")
                : "担当者なし"}
            </dd>
          </div>
          {todo.memo && (
            <div>
              <dt className="text-muted-foreground">詳細メモ</dt>
              <dd className="whitespace-pre-wrap">{todo.memo}</dd>
            </div>
          )}
        </dl>
        <Button onClick={handleToggleComplete}>
          {todo.status === "completed" ? "未完了に戻す" : "完了にする"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {formatCreatedInfo(todo.createdByDisplayName, todo.createdAt)}
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">コメント ({todo.comments.length})</h2>
        {todo.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだコメントはありません。</p>
        ) : (
          todo.comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl border border-border p-4">
              {editingComment?.id === comment.id ? (
                <div className="grid gap-2">
                  <Textarea
                    value={editingComment.body}
                    onChange={(event) =>
                      setEditingComment({ ...editingComment, body: event.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdateComment}>
                      保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {comment.userDisplayName} ・ {formatCommentDate(comment.createdAt)}
                    {comment.createdAt !== comment.updatedAt && " (編集済み)"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingComment(comment)}>
                      編集
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteCommentOpen(comment)}
                    >
                      削除
                    </Button>
                  </div>
                </>
              )}
            </article>
          ))
        )}
        <div className="grid gap-2">
          <Textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="コメントを入力"
          />
          <Button onClick={handleCreateComment} disabled={!commentBody.trim()}>
            送信
          </Button>
        </div>
      </section>

      <AlertDialog open={deleteTodoOpen} onOpenChange={setDeleteTodoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ToDoを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このToDoを削除します。コメントもすべて消え、元に戻せません。削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteTodo}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteCommentOpen !== null}
        onOpenChange={(open) => !open && setDeleteCommentOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>コメントを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このコメントを削除します。元に戻せません。削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteComment}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
