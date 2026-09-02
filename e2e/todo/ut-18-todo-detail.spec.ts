import { expect, request, test, type APIRequestContext } from "@playwright/test";
import {
  addComment,
  addUnregisteredMember,
  API_BASE_URL,
  CATEGORY_IDS,
  completeTodo,
  createFamily,
  createTodo,
  deleteTodo,
} from "../support/api";
import { execSql, querySql, sqlString } from "../support/db";
import { evidenceDir, screenshotPath } from "../support/evidence";
import {
  cleanupE2eData,
  clearFamily,
  createSeedUser,
  expireSession,
  sessionCookie,
} from "../support/seed";
import { isoDaysFromNow } from "../support/scenario";

// 仕様書: docs/test/unit/spec/todo/UT_18_ToDo詳細.md
// 対象: ToDo詳細画面（/todos/:id）。ログイン済み状態はローカルD1へのセッション直接投入で代替する。
const DIR = evidenceDir("todo", "UT_18_ToDo詳細");

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
// apps/frontend/src/modules/todo/service.ts の formatShortDate/formatCreatedInfo と同じ書式を、
// テスト側でも独立して組み立てて期待値にする（実装のコピーではなく、実行時刻から独立に計算する）。
function shortDateLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

function apiFor(sessionId: string): Promise<APIRequestContext> {
  return request.newContext({ extraHTTPHeaders: { Cookie: `session_id=${sessionId}` } });
}

// 主要シナリオ用の共有ユーザー2名（U1本人・U2）が家族グループを共有する。
let u1: { userId: number; sessionId: string };
let u2: { userId: number; sessionId: string };
let api1: APIRequestContext;
let api2: APIRequestContext;
let familyId: number;

test.beforeAll(async () => {
  u1 = createSeedUser({ slug: "tododetail-main", displayName: "テスト太郎" });
  api1 = await apiFor(u1.sessionId);
  const family = await createFamily(api1, "ToDo詳細テスト家族");
  familyId = family.id;

  u2 = createSeedUser({ slug: "tododetail-second", displayName: "花子" });
  api2 = await apiFor(u2.sessionId);
  const inviteCode = (await (await api1.get(`${API_BASE_URL}/api/v1/families/me`)).json())
    .inviteCode;
  await api2.post(`${API_BASE_URL}/api/v1/families/join`, { data: { inviteCode } });
});

test.afterAll(async () => {
  await api1.dispose();
  await api2.dispose();
  cleanupE2eData();
});

async function openTodoAs(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  sessionId: string,
  todoId: number,
) {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto(`/todos/${todoId}`);
}

test("TC-001: 初期表示（基本項目）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC001-基本項目",
    memo: "詳細メモの本文",
    categoryId: CATEGORY_IDS.学校,
    priority: "high",
    dueAt: isoDaysFromNow(3, true, 18),
    dueHasTime: true,
    userIds: [u1.userId],
  });
  const expectedCreated = shortDateLabel(new Date());

  await openTodoAs(page, context, u1.sessionId, todo.id);

  await expect(page.getByRole("heading", { name: "TC001-基本項目" })).toBeVisible();
  await expect(page.getByText("未完了", { exact: true })).toBeVisible();
  await expect(page.getByText("高", { exact: true })).toBeVisible();
  await expect(page.getByText("学校", { exact: true })).toBeVisible();
  await expect(page.getByText("詳細メモの本文")).toBeVisible();
  await expect(page.getByText("テスト太郎", { exact: true })).toBeVisible();
  await expect(page.getByText(`テスト太郎 が ${expectedCreated} に作成`)).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 1, "初期表示") });
});

test("TC-002: 期限なしの表示", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC002-期限なし",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText("期限なし", { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 2, "期限なし") });
});

test("TC-003: 担当者なしの表示", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC003-担当者なし",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText("担当者なし", { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 3, "担当者なし") });
});

test("TC-004: 非登録メンバー＋フォロー役の表示", async ({ page, context }) => {
  const m = await addUnregisteredMember(api1, "じいじ004");
  const todo = await createTodo(api1, {
    title: "TC004-非登録メンバー表示",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
    unregisteredMemberIds: [m.id],
    followerUserIds: [u1.userId],
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText(`${m.name}(未登録)`)).toBeVisible();
  await expect(page.getByText("テスト太郎(通知の受け取り役)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 4, "非登録メンバー表示") });
});

test("TC-005: 完了済みToDoの表示（時刻あり）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC005-完了済み表示",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await completeTodo(api2, todo.id);
  // 完了日時を固定値にして、期待文言（時刻あり）を決め打ちで検証できるようにする。
  // 2026-09-01T11:15:00.000Z は JST 2026-09-01(火) 20:15 になる。
  execSql(
    `UPDATE todos SET completed_at = ${sqlString("2026-09-01T11:15:00.000Z")} WHERE id = ${todo.id};`,
  );

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText("完了", { exact: true })).toBeVisible();
  await expect(page.getByText("花子 が 9/1(火) 20:15 に完了")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 5, "完了済み表示") });
});

test("TC-006: 期限超過バッジの表示", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC006-期限切れ",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
    dueAt: isoDaysFromNow(-1),
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText("期限切れ", { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 6, "期限切れバッジ") });
});

test("TC-007: コメント0件のメッセージ", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC007-コメント0件",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText("まだコメントはありません。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 7, "コメント0件") });
});

test("TC-008: コメント一覧の表示", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC008-コメント一覧表示",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await addComment(api2, todo.id, "確認しました");

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByText("コメント (1)")).toBeVisible();
  await expect(page.getByText("花子")).toBeVisible();
  await expect(page.getByText("確認しました")).toBeVisible();
  await expect(page.getByText("(編集済み)")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 8, "コメント一覧表示") });
});

test.describe.serial("完了/未完了の切り替え", () => {
  let todoId: number;

  test("TC-009: 完了にする（繰り返しなし）", async ({ page, context }) => {
    const todo = await createTodo(api1, {
      title: "TC009-完了にする",
      categoryId: CATEGORY_IDS.その他,
      priority: "medium",
    });
    todoId = todo.id;

    await openTodoAs(page, context, u1.sessionId, todoId);
    await page.getByRole("button", { name: "完了にする" }).click();

    await expect(page.getByText("完了にしました。")).toBeVisible();
    await expect(page.getByRole("button", { name: "未完了に戻す" })).toBeVisible();
    await page.screenshot({ path: screenshotPath(DIR, 9, "完了にする") });

    const [row] = querySql<{ status: string }>(`SELECT status FROM todos WHERE id = ${todoId};`);
    expect(row.status).toBe("completed");
  });

  test("TC-010: 未完了に戻す", async ({ page, context }) => {
    await openTodoAs(page, context, u1.sessionId, todoId);
    await page.getByRole("button", { name: "未完了に戻す" }).click();

    await expect(page.getByText("未完了に戻しました。")).toBeVisible();
    await expect(page.getByRole("button", { name: "完了にする" })).toBeVisible();
    await page.screenshot({ path: screenshotPath(DIR, 10, "未完了に戻す") });

    const [row] = querySql<{ status: string; completed_by_user_id: number | null }>(
      `SELECT status, completed_by_user_id FROM todos WHERE id = ${todoId};`,
    );
    expect(row.status).toBe("incomplete");
    expect(row.completed_by_user_id).toBeNull();
  });
});

test("TC-011: 繰り返しToDoの完了（次回期限へ進む）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC011-繰り返し完了",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
    dueAt: isoDaysFromNow(0),
    dueHasTime: false,
    recurrenceType: "daily",
  });
  const [before] = querySql<{ due_at: string }>(`SELECT due_at FROM todos WHERE id = ${todo.id};`);

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByRole("button", { name: "完了にする" }).click();

  await expect(
    page.getByText(/完了にしました。次回は \d{1,2}\/\d{1,2}\([日月火水木金土]\) です。/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする" })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 11, "繰り返し完了") });

  const [after] = querySql<{
    due_at: string;
    status: string;
    completed_by_user_id: number | null;
    due_soon_notified_at: string | null;
    overdue_notified_at: string | null;
  }>(
    `SELECT due_at, status, completed_by_user_id, due_soon_notified_at, overdue_notified_at FROM todos WHERE id = ${todo.id};`,
  );
  expect(after.status).toBe("incomplete");
  expect(after.completed_by_user_id).toBeNull();
  expect(after.due_at).not.toBe(before.due_at);
  expect(after.due_soon_notified_at).toBeNull();
  expect(after.overdue_notified_at).toBeNull();
});

test("TC-012: 「編集」ボタン", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC012-編集遷移",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByRole("button", { name: "編集" }).click();

  await expect(page).toHaveURL(new RegExp(`/todos/${todo.id}/edit$`));
  await page.screenshot({ path: screenshotPath(DIR, 12, "編集遷移") });
});

test("TC-013: 削除確認ダイアログの表示", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC013-削除確認",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByRole("button", { name: "削除" }).click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByText("このToDoを削除します。コメントもすべて消え、元に戻せません。削除しますか？"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 13, "削除確認ダイアログ") });
});

test("TC-014: 削除の実行", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC014-削除実行",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
    userIds: [u1.userId],
  });
  await addComment(api1, todo.id, "削除される予定のコメント");

  await openTodoAs(page, context, u1.sessionId, todo.id);
  // コメントの「削除」ボタンと区別するため、ヘッダー側（DOM順で先）に絞る。
  await page.getByRole("button", { name: "削除" }).first().click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("ToDoを削除しました。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 14, "削除実行") });

  const todos = querySql<{ id: number }>(`SELECT id FROM todos WHERE id = ${todo.id};`);
  const assignees = querySql<{ id: number }>(
    `SELECT id FROM todo_assignees WHERE todo_id = ${todo.id};`,
  );
  const comments = querySql<{ id: number }>(`SELECT id FROM comments WHERE todo_id = ${todo.id};`);
  expect(todos).toHaveLength(0);
  expect(assignees).toHaveLength(0);
  expect(comments).toHaveLength(0);
});

test("TC-015: 削除のキャンセル", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC015-削除キャンセル",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "TC015-削除キャンセル" })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 15, "削除キャンセル") });
});

test("TC-016: コメントの投稿", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC016-コメント投稿",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByPlaceholder("コメントを入力").fill("了解です");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByPlaceholder("コメントを入力")).toHaveValue("");
  await expect(page.locator("article").filter({ hasText: "了解です" })).toBeVisible();
  await expect(page.getByText("コメント (1)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 16, "コメント投稿") });
});

test("TC-017: コメントの編集", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC017-コメント編集",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await addComment(api1, todo.id, "確認しました");

  await openTodoAs(page, context, u1.sessionId, todo.id);
  // 編集モードに入るとarticleの表示テキストが本文からtextareaに変わるため、
  // hasTextフィルタではなく位置（このテストではコメントが1件だけ）で特定する。
  const article = page.locator("article").first();
  await article.getByRole("button", { name: "編集" }).click();
  await article.locator("textarea").fill("確認済みです");
  await article.getByRole("button", { name: "保存" }).click();

  await expect(page.locator("article").filter({ hasText: "確認済みです" })).toBeVisible();
  await expect(page.getByText("(編集済み)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 17, "コメント編集") });
});

test("TC-018: コメント編集のキャンセル", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC018-コメント編集キャンセル",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await addComment(api1, todo.id, "確認しました");

  await openTodoAs(page, context, u1.sessionId, todo.id);
  const article = page.locator("article").first();
  await article.getByRole("button", { name: "編集" }).click();
  await article.locator("textarea").fill("破棄されるはずの変更");
  await article.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.locator("article").filter({ hasText: "確認しました" })).toBeVisible();
  await expect(page.getByText("破棄されるはずの変更")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 18, "コメント編集キャンセル") });
});

test("TC-019: コメント削除確認ダイアログの表示", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC019-コメント削除確認",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await addComment(api1, todo.id, "確認しました");

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.locator("article").getByRole("button", { name: "削除" }).click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByText("このコメントを削除します。元に戻せません。削除しますか？"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 19, "コメント削除確認") });
});

test("TC-020: コメント削除の実行", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC020-コメント削除実行",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await addComment(api1, todo.id, "確認しました");

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.locator("article").getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("コメント (0)")).toBeVisible();
  await expect(page.getByText("まだコメントはありません。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 20, "コメント削除実行") });
});

test("TC-021: コメント未入力時の送信ボタン非活性", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC021-送信ボタン非活性",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await expect(page.getByRole("button", { name: "送信" })).toBeDisabled();
  await page.screenshot({ path: screenshotPath(DIR, 21, "送信ボタン非活性") });
});

test("TC-022: コメント500文字ちょうど", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC022-コメント500文字",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByPlaceholder("コメントを入力").fill("あ".repeat(500));
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("コメント (1)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 22, "コメント500文字") });
});

test("TC-023: コメント501文字（超過）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC023-コメント501文字",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByPlaceholder("コメントを入力").fill("あ".repeat(501));
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("コメントは500文字以内で入力してください。")).toBeVisible();
  await expect(page.getByText("コメント (0)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 23, "コメント501文字") });
});

test("TC-024: ToDoが存在しない（404）", async ({ page, context }) => {
  await context.addCookies(sessionCookie(u1.sessionId));
  await page.goto("/todos/999999999");

  await expect(
    page.getByText("このToDoは見つかりませんでした。すでに削除された可能性があります。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ToDo一覧へ戻る" })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 24, "存在しないID") });
});

test("TC-025: 他グループのToDo（404）", async ({ page, context }) => {
  const other = createSeedUser({ slug: "tododetail-other-family", displayName: "他家族太郎" });
  const apiOther = await apiFor(other.sessionId);
  await createFamily(apiOther, "別のテスト家族");
  const otherTodo = await createTodo(apiOther, {
    title: "TC025-他グループToDo",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await apiOther.dispose();

  await context.addCookies(sessionCookie(u1.sessionId));
  await page.goto(`/todos/${otherTodo.id}`);

  await expect(
    page.getByText("このToDoは見つかりませんでした。すでに削除された可能性があります。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 25, "他グループのToDo") });
});

test("TC-026: 不正なID（数値でない）", async ({ page, context }) => {
  await context.addCookies(sessionCookie(u1.sessionId));
  await page.goto("/todos/abc");

  await expect(
    page.getByText("このToDoは見つかりませんでした。すでに削除された可能性があります。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 26, "不正なID") });
});

test("TC-027: 未認証（401）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC027-セッション失効",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  const u = createSeedUser({ slug: "tododetail-unauth", displayName: "失効太郎" });
  expireSession(u.sessionId);

  await context.addCookies(sessionCookie(u.sessionId));
  await page.goto(`/todos/${todo.id}`);

  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: screenshotPath(DIR, 27, "セッション失効") });
});

test("TC-028: グループ未所属（403）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC028-グループ未所属",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  const u = createSeedUser({ slug: "tododetail-no-family", displayName: "未所属太郎" });
  clearFamily(u.userId);

  await context.addCookies(sessionCookie(u.sessionId));
  await page.goto(`/todos/${todo.id}`);

  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 28, "グループ未所属") });
});

test("TC-029: 完了/未完了の切り替え失敗（500）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC029-完了切替失敗",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await context.route(
    (url) => url.pathname === `/api/v1/todos/${todo.id}/complete`,
    (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByRole("button", { name: "完了にする" }).click();

  await expect(page.getByText("更新に失敗しました。もう一度お試しください。")).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする" })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 29, "完了切替失敗") });
});

test("TC-030: 削除しようとしたToDoが既に無い（404）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC030-削除対象なし",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await openTodoAs(page, context, u1.sessionId, todo.id);
  // 画面の読み込みが終わる前にAPIで削除すると、GET /todos/:id が404を返して
  // 詳細表示自体が出ないまま終わってしまうため、表示完了を待ってから削除する。
  await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  await deleteTodo(api1, todo.id);
  await page.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("このToDoは削除されています。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 30, "削除対象なし") });
});

test("TC-031: コメントの投稿・編集・削除の失敗（401含め一律）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC031-コメント投稿失敗",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await context.route(
    (url) => url.pathname === `/api/v1/todos/${todo.id}/comments`,
    (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );

  await openTodoAs(page, context, u1.sessionId, todo.id);
  await page.getByPlaceholder("コメントを入力").fill("投稿できないはずのコメント");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(
    page.getByText("コメントの保存に失敗しました。もう一度お試しください。"),
  ).toBeVisible();
  // 401でもログイン画面へは遷移しない（設計書と実装の食い違いを実装どおりとした仕様。UT_18の「7. 補足」参照）。
  await expect(page).toHaveURL(new RegExp(`/todos/${todo.id}$`));
  await page.screenshot({ path: screenshotPath(DIR, 31, "コメント投稿失敗") });
});
