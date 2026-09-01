"use client";

import Link from "next/link";
import { MessageCircle, Repeat } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  assigneeLabel,
  formatCompletedInfo,
  formatDueAt,
  isOverdue,
  PRIORITY_LABELS,
  recurrenceLabel,
} from "../service";
import type { Category, Todo, TodoPriority } from "../types";

interface TodoCardProps {
  todo: Todo;
  category: Category | undefined;
  onToggleComplete: (todo: Todo) => void;
}

const PRIORITY_BADGE_VARIANT: Record<TodoPriority, "destructive" | "default" | "secondary"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

// ToDo一覧の1件分のカード。docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.6 ToDoカード」。
export function TodoCard({ todo, category, onToggleComplete }: TodoCardProps) {
  const overdue = isOverdue(todo);
  const recurrence = recurrenceLabel(todo.recurrenceType);

  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
      <Checkbox
        checked={todo.status === "completed"}
        onCheckedChange={() => onToggleComplete(todo)}
        aria-label={todo.status === "completed" ? "未完了に戻す" : "完了にする"}
        className="mt-1"
      />

      {/* カード本文をタップしたら詳細を開く（チェックボックスは兄弟要素なので影響しない）。 */}
      <Link href={`/todos/${todo.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 text-sm font-medium">{todo.title}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={PRIORITY_BADGE_VARIANT[todo.priority]}>
            {PRIORITY_LABELS[todo.priority]}
          </Badge>
          {category && <Badge variant="outline">{category.name}</Badge>}
          {recurrence && (
            <Badge variant="outline" className="gap-1">
              <Repeat />
              {recurrence}
            </Badge>
          )}
        </div>

        {todo.dueAt && (
          <p
            className={cn(
              "text-sm",
              overdue ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {formatDueAt(todo.dueAt, todo.dueHasTime)}
            {overdue && "（期限切れ）"}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {todo.assignees.length > 0 ? todo.assignees.map(assigneeLabel).join("、") : "担当者なし"}
        </p>

        {todo.commentCount > 0 && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MessageCircle className="size-3.5" />
            {todo.commentCount}
          </p>
        )}

        {todo.status === "completed" && todo.completedByDisplayName && todo.completedAt && (
          <p className="text-sm text-muted-foreground">
            {formatCompletedInfo(todo.completedByDisplayName, todo.completedAt)}
          </p>
        )}
      </Link>
    </div>
  );
}
