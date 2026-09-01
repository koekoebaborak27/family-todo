export type TodoStatus = "incomplete" | "completed";
export type TodoPriority = "high" | "medium" | "low";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface TodoAssignee {
  type: "user" | "unregistered";
  id: number;
  displayName: string;
}

// GET /todos の応答項目1件分。
export interface Todo {
  id: number;
  title: string;
  memo: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  priority: TodoPriority;
  categoryId: number;
  status: TodoStatus;
  recurrenceType: RecurrenceType;
  assignees: TodoAssignee[];
  commentCount: number;
  completedByDisplayName: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
}

// 完了状態タブ。
export type StatusTab = "incomplete" | "completed";

// 並び順タブ（タブを選ぶとプルダウンの値がこの表の初期値へ戻る）。
export type SortTab = "due" | "priority";

// 並び替えプルダウンの項目。
export type SortField = "due" | "priority" | "assignee";
export type SortOrder = "asc" | "desc";
