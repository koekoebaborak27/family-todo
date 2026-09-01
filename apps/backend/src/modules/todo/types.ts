export type TodoStatus = "incomplete" | "completed";
export type TodoPriority = "high" | "medium" | "low";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

// 担当者1件分。登録ユーザーか非登録メンバーかをtypeで区別する
// （フロントは非登録メンバーの表示名の後ろに「(未登録)」を付ける）。
export interface TodoAssigneeSummary {
  type: "user" | "unregistered";
  id: number;
  displayName: string;
}

// GET /todos の応答項目1件分。
// docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.6 ToDoカード」に必要な項目一式。
export interface TodoSummary {
  id: number;
  title: string;
  memo: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  priority: TodoPriority;
  categoryId: number;
  status: TodoStatus;
  recurrenceType: RecurrenceType;
  assignees: TodoAssigneeSummary[];
  commentCount: number;
  completedByDisplayName: string | null;
  completedAt: string | null;
  // 並び替えた結果が同じ値になったToDo同士を作成日時の新しい順に並べるため、フロントの
  // 並び替えロジックが使う（docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.4」）。
  createdAt: string;
}

// GET /todos/:id の応答。編集画面の初期値に使う。
export interface TodoDetail extends TodoSummary {
  recurrenceConfig: { weekdays: number[] } | { day: number } | null;
  assignees: (TodoAssigneeSummary & { isFollower: boolean })[];
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
