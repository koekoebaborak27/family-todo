import type {
  RecurrenceType,
  SortField,
  SortOrder,
  SortTab,
  Todo,
  TodoDetail,
  TodoPriority,
} from "./types";

// ToDo一覧画面に表示するエラー文言。
// docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「7. エラー時の表示文言」のとおり。
export const TODO_ERROR_MESSAGES = {
  unauthorized: "ログインの有効期限が切れました。もう一度ログインしてください。",
  forbidden: "家族グループに参加していません。",
  serverError: "ToDoの読み込みに失敗しました。時間をおいてもう一度お試しください。",
  network: "通信に失敗しました。電波状況を確認してもう一度お試しください。",
  updateFailed: "更新に失敗しました。もう一度お試しください。",
  notFound: "このToDoは削除されています。",
} as const;

// 完了/未完了の切り替え結果を伝えるトースト文言。
export const TODO_TOAST_MESSAGES = {
  completed: "完了にしました。",
  incomplete: "未完了に戻しました。",
} as const;

// 並び順タブを選んだときのプルダウンの初期値
// （docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.4」）。
export const SORT_TAB_DEFAULTS: Record<SortTab, { field: SortField; order: SortOrder }> = {
  due: { field: "due", order: "asc" },
  priority: { field: "priority", order: "desc" },
};

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  due: "期限",
  priority: "優先度",
  assignee: "担当者",
};

export const SORT_ORDER_LABELS: Record<SortOrder, string> = {
  asc: "昇順",
  desc: "降順",
};

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};

// 繰り返しの表示文言（「none」は表示しないためnullを返す）。
export function recurrenceLabel(recurrenceType: string): string | null {
  return RECURRENCE_LABELS[recurrenceType] ?? null;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 詳細画面向けに、繰り返す曜日または日付まで含めた文言を作る。
export function recurrenceDetailLabel(todo: TodoDetail): string {
  if (todo.recurrenceType === "none") return "なし";
  if (todo.recurrenceType === "daily") return "毎日";
  if (
    todo.recurrenceType === "weekly" &&
    todo.recurrenceConfig &&
    "weekdays" in todo.recurrenceConfig
  )
    return `毎週 ${todo.recurrenceConfig.weekdays.map((day) => WEEKDAY_LABELS[day]).join("・")}`;
  if (todo.recurrenceType === "monthly" && todo.recurrenceConfig && "day" in todo.recurrenceConfig)
    return `毎月 ${todo.recurrenceConfig.day}日`;
  return RECURRENCE_LABELS[todo.recurrenceType as RecurrenceType] ?? "なし";
}

// 期限を「9/3(水)」または時刻ありなら「9/3(水) 18:00」の形式にする。
export function formatDueAt(dueAt: string, dueHasTime: boolean): string {
  const date = new Date(dueAt);
  const datePart = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
  if (!dueHasTime) {
    return datePart;
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${datePart} ${hours}:${minutes}`;
}

// 完了者・完了日時の表示文言（例: 「太郎 が 9/1(月) に完了」）。
// ToDo一覧のカードで使う（docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.6」は時刻を含めない表記）。
export function formatCompletedInfo(displayName: string, completedAt: string): string {
  const date = new Date(completedAt);
  const datePart = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
  return `${displayName} が ${datePart} に完了`;
}

// 完了者・完了日時の表示文言（時刻あり。例: 「太郎 が 9/1(月) 20:15 に完了」）。
// ToDo詳細画面で使う（docs/specs/02_basic-design/family-todo/18_ToDo詳細.md「3.1」は時刻を含める表記）。
export function formatCompletedInfoWithTime(displayName: string, completedAt: string): string {
  const date = new Date(completedAt);
  const datePart = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${displayName} が ${datePart} ${hours}:${minutes} に完了`;
}

// 繰り返しToDoを完了操作したときの、次回の期限の表示文言（例: 「9/4(木)」）。
export function formatShortDate(dateTime: string): string {
  const date = new Date(dateTime);
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

// 作成者と作成日時の表示文言を作る。
export function formatCreatedInfo(displayName: string, createdAt: string): string {
  const date = new Date(createdAt);
  return `${displayName} が ${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]}) に作成`;
}

// コメントの投稿日時を表示用に整える。
export function formatCommentDate(dateTime: string): string {
  const date = new Date(dateTime);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]}) ${hours}:${minutes}`;
}

// 未完了タブで、期限を過ぎたToDoかどうか。
export function isOverdue(todo: Todo): boolean {
  return (
    todo.status === "incomplete" &&
    todo.dueAt !== null &&
    new Date(todo.dueAt).getTime() < Date.now()
  );
}

// 担当者の表示名（非登録メンバーには「(未登録)」を付ける）。
export function assigneeLabel(assignee: Todo["assignees"][number]): string {
  return assignee.type === "unregistered"
    ? `${assignee.displayName}(未登録)`
    : assignee.displayName;
}

// 「3.7 該当するToDoが0件のとき」の表示文言。
export function emptyStateMessage(
  status: "incomplete" | "completed",
  hasCategoryFilter: boolean,
): string {
  if (hasCategoryFilter) {
    return "このカテゴリのToDoはありません。";
  }
  return status === "incomplete"
    ? "未完了のToDoはありません。右下のボタンから追加できます。"
    : "完了したToDoはまだありません。";
}

function isMissingSortValue(todo: Todo, field: SortField): boolean {
  if (field === "due") {
    return todo.dueAt === null;
  }
  if (field === "assignee") {
    return todo.assignees.length === 0;
  }
  return false;
}

// 担当者が複数いるToDoは、表示名を五十音順に並べたときの先頭の名前で比較する
// （docs/specs/02_basic-design/family-todo/14_ToDo一覧.md「3.4」）。
function firstAssigneeName(todo: Todo): string {
  const names = todo.assignees
    .map((assignee) => assignee.displayName)
    .sort((a, b) => a.localeCompare(b, "ja"));
  return names[0];
}

const PRIORITY_ORDER: Record<TodoPriority, number> = { low: 0, medium: 1, high: 2 };

// 値がある前提での昇順比較（負: aが先、正: bが先）。
function compareBySortValue(a: Todo, b: Todo, field: SortField): number {
  if (field === "due") {
    return new Date(a.dueAt as string).getTime() - new Date(b.dueAt as string).getTime();
  }
  if (field === "priority") {
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  }
  return firstAssigneeName(a).localeCompare(firstAssigneeName(b), "ja");
}

// 作成日時が新しい順（同じ値になったToDo同士のタイブレーク）。
function compareByCreatedAtDesc(a: Todo, b: Todo): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

// 取得済みのToDoを画面側で並べ替える
// （家族数名分の件数しか扱わないためAPIを呼び直さない。「3.4」）。
export function sortTodos(todos: Todo[], field: SortField, order: SortOrder): Todo[] {
  return [...todos].sort((a, b) => {
    const aMissing = isMissingSortValue(a, field);
    const bMissing = isMissingSortValue(b, field);
    if (aMissing && bMissing) {
      return compareByCreatedAtDesc(a, b);
    }
    if (aMissing) {
      return 1;
    }
    if (bMissing) {
      return -1;
    }

    const raw = compareBySortValue(a, b, field);
    const signed = order === "asc" ? raw : -raw;
    return signed !== 0 ? signed : compareByCreatedAtDesc(a, b);
  });
}
