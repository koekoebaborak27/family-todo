"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchMe, logout } from "@/modules/auth";
import { FamilyError, fetchMyFamily } from "@/modules/family";
import { IosInstallBanner } from "@/modules/ios-install-guide";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button, buttonVariants } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  completeTodo,
  fetchCategories,
  fetchTodos,
  incompleteTodo,
  TodoError,
} from "../api-client";
import { requestPushPermissionAndSubscribe } from "../push-subscription";
import {
  emptyStateMessage,
  SORT_FIELD_LABELS,
  SORT_ORDER_LABELS,
  SORT_TAB_DEFAULTS,
  sortTodos,
  TODO_ERROR_MESSAGES,
  TODO_TOAST_MESSAGES,
} from "../service";
import type { Category, SortField, SortOrder, SortTab, StatusTab, Todo } from "../types";
import { TodoCard } from "./todo-card";

type Phase = "checking" | "ready";
type ListState = "loading" | "ready" | "error";

// ToDo一覧画面。ログイン済みかつ家族グループに所属しているユーザーのみが対象。
// docs/specs/02_basic-design/family-todo/14_ToDo一覧.md
export function TodoListScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("checking");
  const [familyName, setFamilyName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [statusTab, setStatusTab] = useState<StatusTab>("incomplete");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [sortTab, setSortTab] = useState<SortTab>("due");
  const [sortField, setSortField] = useState<SortField>(SORT_TAB_DEFAULTS.due.field);
  const [sortOrder, setSortOrder] = useState<SortOrder>(SORT_TAB_DEFAULTS.due.order);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [listState, setListState] = useState<ListState>("loading");
  const [listError, setListError] = useState<string | null>(null);

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // 画面表示時に、ログイン状態と所属グループの有無を確認する
  // （「2. 画面へのアクセス条件・初期表示」）。
  useEffect(() => {
    let cancelled = false;

    fetchMe()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.authenticated) {
          router.replace("/");
          return;
        }
        if (!result.hasFamily) {
          router.replace("/family/setup");
          return;
        }
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) {
          router.replace("/");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // グループ名・カテゴリ一覧の取得、およびPush通知許可のリクエストは画面表示時に1回行う。
  useEffect(() => {
    if (phase !== "ready") {
      return;
    }

    fetchMyFamily()
      .then((family) => setFamilyName(family.name))
      .catch((error: FamilyError) => {
        if (error.message === TODO_ERROR_MESSAGES.unauthorized) {
          router.replace("/");
        }
      });
    fetchCategories()
      .then(setCategories)
      .catch(() => undefined);
    void requestPushPermissionAndSubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 一覧を取得する。タブ・カテゴリ切り替え時の自動取得（useEffect）と、
  // 再読み込みボタン・リトライボタンからの手動取得の両方から呼ぶ。
  // 「読み込み中」表示への切り替えは、setState呼び出しをeffect本体に直接置かないよう、
  // 呼び出し側（手動操作のイベントハンドラ）で行う。
  const loadTodos = useCallback(() => {
    fetchTodos(statusTab, categoryFilter)
      .then((result) => {
        setTodos(result);
        setListState("ready");
      })
      .catch((error: TodoError) => {
        if (error.kind === "unauthorized") {
          router.replace("/");
          return;
        }
        if (error.kind === "forbidden") {
          router.replace("/family/setup");
          return;
        }
        setListError(error.message);
        setListState("error");
      });
  }, [statusTab, categoryFilter, router]);

  useEffect(() => {
    if (phase !== "ready") {
      return;
    }
    loadTodos();
  }, [phase, loadTodos]);

  const sortedTodos = useMemo(
    () => sortTodos(todos, sortField, sortOrder),
    [todos, sortField, sortOrder],
  );

  function handleSortTabChange(value: string) {
    const tab = value as SortTab;
    setSortTab(tab);
    setSortField(SORT_TAB_DEFAULTS[tab].field);
    setSortOrder(SORT_TAB_DEFAULTS[tab].order);
  }

  // 完了/未完了の切り替えは、応答を待たずに先に画面上の表示を切り替える
  // （タップしてから反応するまでの待ち時間をなくすため。「5. 操作と遷移先」）。
  function handleToggleComplete(todo: Todo) {
    const wasIncomplete = todo.status === "incomplete";
    setTodos((prev) => prev.filter((item) => item.id !== todo.id));

    const request = wasIncomplete ? completeTodo(todo.id) : incompleteTodo(todo.id);
    request
      .then(() => {
        if (wasIncomplete) {
          toast.success(TODO_TOAST_MESSAGES.completed, {
            action: { label: "元に戻す", onClick: () => handleUndo(todo) },
          });
        } else {
          toast.success(TODO_TOAST_MESSAGES.incomplete);
        }
      })
      .catch((error: TodoError) => {
        setTodos((prev) => [...prev, todo]);
        if (error.kind === "unauthorized") {
          router.replace("/");
          return;
        }
        if (error.kind === "notFound") {
          toast.error(error.message);
          loadTodos();
          return;
        }
        toast.error(TODO_ERROR_MESSAGES.updateFailed);
      });
  }

  // 再読み込みボタン・リトライボタン用。イベントハンドラなので、ここでの同期的なsetStateは問題ない。
  function handleManualRefresh() {
    setListState("loading");
    loadTodos();
  }

  function handleUndo(todo: Todo) {
    incompleteTodo(todo.id)
      .then(() => loadTodos())
      .catch(() => toast.error(TODO_ERROR_MESSAGES.updateFailed));
  }

  function handleLogout() {
    logout()
      .then(() => router.replace("/"))
      .catch(() => toast.error(TODO_ERROR_MESSAGES.network));
  }

  if (phase !== "ready") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-sm text-muted-foreground" role="status">
          読み込んでいます…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <h1 className="truncate text-lg font-semibold">{familyName}</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="再読み込み" onClick={handleManualRefresh}>
            <RefreshCw />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="メニュー"
            >
              <Menu />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => router.push("/family/settings")}>
                家族グループ設定
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>個人設定</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setLogoutDialogOpen(true)}>
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <IosInstallBanner />

      <div className="flex flex-col gap-3 px-4 py-3">
        <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as StatusTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="incomplete" className="flex-1">
              未完了
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              完了
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={sortTab} onValueChange={handleSortTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="due" className="flex-1">
              期限順
            </TabsTrigger>
            <TabsTrigger value="priority" className="flex-1">
              優先度順
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue>{(value: SortField) => SORT_FIELD_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_FIELD_LABELS) as SortField[]).map((field) => (
                <SelectItem key={field} value={field}>
                  {SORT_FIELD_LABELS[field]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue>{(value: SortOrder) => SORT_ORDER_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_ORDER_LABELS) as SortOrder[]).map((order) => (
                <SelectItem key={order} value={order}>
                  {SORT_ORDER_LABELS[order]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={categoryFilter === null ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setCategoryFilter(null)}
          >
            すべて
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={categoryFilter === category.id ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setCategoryFilter(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        {listState === "loading" && (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">
            読み込んでいます…
          </p>
        )}

        {listState === "error" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive" role="alert">
              {listError}
            </p>
            <Button variant="outline" onClick={handleManualRefresh}>
              再読み込み
            </Button>
          </div>
        )}

        {listState === "ready" && sortedTodos.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyStateMessage(statusTab, categoryFilter !== null)}
          </p>
        )}

        {listState === "ready" &&
          sortedTodos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              category={categories.find((category) => category.id === todo.categoryId)}
              onToggleComplete={handleToggleComplete}
            />
          ))}
      </div>

      <Link
        href="/todos/new"
        className={cn(buttonVariants({ size: "icon-lg" }), "fixed right-6 bottom-6 shadow-md")}
        aria-label="ToDoを追加する"
      >
        <Plus />
      </Link>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトします。よろしいですか？</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>ログアウト</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
