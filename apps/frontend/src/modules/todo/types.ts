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

// ToDo追加・編集画面で担当者として選べる、ログイン済みの家族。
export interface FamilyMember {
  id: number;
  displayName: string;
}

// ToDo追加・編集画面で担当者として選べる、ログインしない家族。
export interface UnregisteredMember {
  id: number;
  name: string;
}

// 編集画面の初期値に使うToDoの詳細。
export interface TodoDetail extends Todo {
  recurrenceConfig: { weekdays: number[] } | { day: number } | null;
  assignees: (TodoAssignee & { isFollower: boolean })[];
  createdByDisplayName: string;
  comments: TodoComment[];
}

// ToDo詳細画面に表示するコメント1件分。
export interface TodoComment {
  id: number;
  body: string;
  userDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

// ToDo作成・更新でAPIへ送る入力。
export interface TodoInput {
  title: string;
  memo: string | null;
  categoryId: number;
  priority: TodoPriority;
  dueAt: string | null;
  dueHasTime: boolean;
  recurrenceType: RecurrenceType;
  recurrenceConfig: { weekdays: number[] } | { day: number } | null;
}

// ToDoの担当者を丸ごと置き換える入力。
export interface AssigneeInput {
  userIds: number[];
  unregisteredMemberIds: number[];
  followerUserIds: number[];
}

// 完了状態タブ。
export type StatusTab = "incomplete" | "completed";

// 並び順タブ（タブを選ぶとプルダウンの値がこの表の初期値へ戻る）。
export type SortTab = "due" | "priority";

// 並び替えプルダウンの項目。
export type SortField = "due" | "priority" | "assignee";
export type SortOrder = "asc" | "desc";
