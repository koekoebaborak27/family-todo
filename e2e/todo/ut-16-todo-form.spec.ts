import { expect, request, test, type APIRequestContext } from "@playwright/test";
import {
  addUnregisteredMember,
  API_BASE_URL,
  CATEGORY_IDS,
  createFamily,
  createTodo,
  deleteTodo,
} from "../support/api";
import { evidenceDir, screenshotPath } from "../support/evidence";
import {
  cleanupE2eData,
  clearFamily,
  createSeedUser,
  expireSession,
  sessionCookie,
} from "../support/seed";
import { isoDaysFromNow } from "../support/scenario";

// 仕様書: docs/test/unit/spec/todo/UT_16_ToDo追加・編集.md
// 対象: ToDo追加・編集画面（新規作成 /todos/new、編集 /todos/:id/edit）。
// ログイン済み状態はローカルD1へのセッション直接投入で代替する。
const DIR = evidenceDir("todo", "UT_16_ToDo追加・編集");

function apiFor(sessionId: string): Promise<APIRequestContext> {
  return request.newContext({ extraHTTPHeaders: { Cookie: `session_id=${sessionId}` } });
}

// 主要シナリオ用の共有ユーザー2名（U1本人・U2担当者候補）が家族グループを共有する。
let u1: { userId: number; sessionId: string };
let u2: { userId: number; sessionId: string };
let api1: APIRequestContext;
let familyId: number;

test.beforeAll(async () => {
  u1 = createSeedUser({ slug: "todoform-main", displayName: "テスト太郎" });
  api1 = await apiFor(u1.sessionId);
  const family = await createFamily(api1, "ToDo追加編集テスト家族");
  familyId = family.id;

  u2 = createSeedUser({ slug: "todoform-second", displayName: "花子" });
  const api2 = await apiFor(u2.sessionId);
  const inviteCode = (await (await api1.get(`${API_BASE_URL}/api/v1/families/me`)).json())
    .inviteCode;
  await api2.post(`${API_BASE_URL}/api/v1/families/join`, { data: { inviteCode } });
  await api2.dispose();
});

test.afterAll(async () => {
  await api1.dispose();
  cleanupE2eData();
});

async function openNewTodoAs(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  sessionId: string,
) {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto("/todos/new");
}

test.describe.serial("新規作成・編集の基本操作", () => {
  test("TC-001: 新規作成の初期表示", async ({ page, context }) => {
    const m1 = await addUnregisteredMember(api1, "じいじ001");
    await openNewTodoAs(page, context, u1.sessionId);

    await expect(page.getByRole("heading", { name: "ToDoを追加" })).toBeVisible();
    await expect(page.getByRole("button", { name: "追加する" })).toBeVisible();
    await expect(page.getByLabel("タイトル")).toHaveValue("");
    await expect(page.getByText("その他")).toBeVisible();
    await expect(page.getByRole("button", { name: "中" })).toHaveAttribute("data-slot", "button");
    await expect(page.getByText(`${m1.name}（未登録）`)).toBeVisible();
    await page.screenshot({ path: screenshotPath(DIR, 1, "新規作成初期表示") });
  });

  test("TC-002: 編集の初期表示", async ({ page, context }) => {
    const todo = await createTodo(api1, {
      title: "TC002-編集対象",
      categoryId: CATEGORY_IDS.その他,
      priority: "medium",
      userIds: [u1.userId],
    });

    await context.addCookies(sessionCookie(u1.sessionId));
    await page.goto(`/todos/${todo.id}/edit`);

    await expect(page.getByRole("heading", { name: "ToDoを編集" })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存する" })).toBeVisible();
    await expect(page.getByLabel("タイトル")).toHaveValue("TC002-編集対象");
    await expect(page.getByText("テスト太郎").first()).toBeVisible();
    await page.screenshot({ path: screenshotPath(DIR, 2, "編集初期表示") });
  });
});

test("TC-003: 新規作成の保存（最小入力）", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC003-牛乳を買う");
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 3, "新規作成成功") });
});

test("TC-004: 編集の保存", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC004-変更前",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });

  await context.addCookies(sessionCookie(u1.sessionId));
  await page.goto(`/todos/${todo.id}/edit`);
  await page.getByLabel("タイトル").fill("TC004-買い物リスト");
  await page.getByRole("button", { name: "保存する" }).click();

  await expect(page.getByText("ToDoを保存しました。")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/todos/${todo.id}$`));
  await page.screenshot({ path: screenshotPath(DIR, 4, "編集保存成功") });
});

test("TC-005: 期限「設定する」ON時の表示", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByText("期限を設定する").click();

  await expect(page.locator('input[type="date"]')).toBeVisible();
  await expect(page.locator('input[type="time"]')).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 5, "期限ON表示") });
});

test("TC-006: 期限「時刻も指定する」ON時の表示", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByText("期限を設定する").click();
  await page.getByText("時刻も指定する").click();

  await expect(page.locator('input[type="time"]')).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 6, "時刻指定ON表示") });
});

test("TC-007: 期限付きで保存（日付のみ）", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC007-期限日付のみ");
  await page.getByText("期限を設定する").click();
  await page.locator('input[type="date"]').fill(isoDaysFromNow(1).slice(0, 10));
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 7, "期限日付のみ保存") });
});

test("TC-008: 期限付きで保存（日付＋時刻）", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC008-期限日時");
  await page.getByText("期限を設定する").click();
  await page.locator('input[type="date"]').fill(isoDaysFromNow(1).slice(0, 10));
  await page.getByText("時刻も指定する").click();
  await page.locator('input[type="time"]').fill("09:30");
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 8, "期限日時保存") });
});

test("TC-009: 繰り返し「毎日」の追加欄なし", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByText("期限を設定する").click();
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎日" }).click();

  await expect(page.getByText("日", { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 9, "繰り返し毎日表示") });
});

test("TC-010: 繰り返し「毎週」の追加欄表示", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByText("期限を設定する").click();
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎週" }).click();

  await expect(page.getByText("月", { exact: true })).toBeVisible();
  await expect(page.getByText("木", { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 10, "繰り返し毎週表示") });
});

test("TC-011: 繰り返し「毎週」で保存", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC011-繰り返し毎週");
  await page.getByText("期限を設定する").click();
  await page.locator('input[type="date"]').fill(isoDaysFromNow(1).slice(0, 10));
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎週" }).click();
  await page.getByText("月", { exact: true }).click();
  await page.getByText("木", { exact: true }).click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 11, "繰り返し毎週保存") });
});

test("TC-012: 繰り返し「毎月」の追加欄表示", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByText("期限を設定する").click();
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎月" }).click();

  const numberInput = page.locator('input[type="number"]');
  await expect(numberInput).toBeVisible();
  await expect(numberInput).toHaveValue("1");
  await page.screenshot({ path: screenshotPath(DIR, 12, "繰り返し毎月表示") });
});

test("TC-013: 繰り返し「毎月」で保存", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC013-繰り返し毎月");
  await page.getByText("期限を設定する").click();
  await page.locator('input[type="date"]').fill(isoDaysFromNow(1).slice(0, 10));
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎月" }).click();
  await page.locator('input[type="number"]').fill("15");
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 13, "繰り返し毎月保存") });
});

test("TC-014: 登録ユーザーを担当者に選ぶ", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC014-登録担当者");
  await page.getByText("花子", { exact: true }).click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 14, "登録担当者選択") });
});

test("TC-015: 非登録メンバー選択でフォロー役欄が表示される", async ({ page, context }) => {
  const m = await addUnregisteredMember(api1, "じいじ015");
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByText(`${m.name}（未登録）`).click();

  await expect(page.getByText("フォロー役")).toBeVisible();
  await expect(
    page.getByText("ログインしないメンバーの代わりに通知を受け取る家族を選んでください。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 15, "フォロー役欄表示") });
});

test("TC-016: 非登録メンバー＋フォロー役で保存", async ({ page, context }) => {
  const m = await addUnregisteredMember(api1, "じいじ016");
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC016-非登録メンバー保存");
  await page.getByText(`${m.name}（未登録）`).click();
  // 「テスト太郎」は担当者一覧とフォロー役一覧の2箇所に表示されるため、後から描画される
  // フォロー役側（DOM順で後ろ）をlast()で指定する。
  await page.getByRole("checkbox", { name: "テスト太郎" }).last().click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 16, "非登録メンバー保存") });
});

test("TC-017: 非登録メンバー選択解除でフォロー役欄が消える", async ({ page, context }) => {
  const m = await addUnregisteredMember(api1, "じいじ017");
  await openNewTodoAs(page, context, u1.sessionId);
  const memberLabel = page.getByText(`${m.name}（未登録）`);
  await memberLabel.click();
  await expect(page.getByText("フォロー役")).toBeVisible();

  await memberLabel.click();
  await expect(page.getByText("フォロー役")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 17, "フォロー役欄消去") });
});

test.describe("非登録メンバー0件（専用の家族グループを使う）", () => {
  test("TC-018: 非登録メンバー0件のメッセージ", async ({ page, context }) => {
    const uEmpty = createSeedUser({ slug: "todoform-no-member", displayName: "0件太郎" });
    const api = await apiFor(uEmpty.sessionId);
    await createFamily(api, "非登録メンバー0件家族");

    await context.addCookies(sessionCookie(uEmpty.sessionId));
    await page.goto("/todos/new");

    await expect(
      page.getByText("非登録メンバーは登録されていません。家族グループ設定から追加できます。"),
    ).toBeVisible();
    await page.screenshot({ path: screenshotPath(DIR, 18, "非登録メンバー0件") });
    await api.dispose();
  });
});

test("TC-019: キャンセル", async ({ page, context }) => {
  await context.addCookies(sessionCookie(u1.sessionId));
  await page.goto("/todos");
  await page.goto("/todos/new");
  await page.getByLabel("タイトル").fill("キャンセルされるはずの入力");
  await page.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 19, "キャンセル") });
});

test("TC-020: タイトル未入力", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("タイトルを入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 20, "タイトル未入力") });
});

test("TC-021: タイトル101文字（超過）", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("あ".repeat(101));
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("タイトルは100文字以内で入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 21, "タイトル101文字") });
});

test("TC-022: タイトル100文字ちょうど", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("あ".repeat(100));
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 22, "タイトル100文字") });
});

test("TC-023: 詳細メモ1001文字（超過）", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC023-メモ超過");
  await page.getByLabel("詳細メモ").fill("あ".repeat(1001));
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("詳細メモは1000文字以内で入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 23, "メモ1001文字") });
});

test("TC-024: 詳細メモ1000文字ちょうど", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC024-メモちょうど");
  await page.getByLabel("詳細メモ").fill("あ".repeat(1000));
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 24, "メモ1000文字") });
});

test("TC-025: 期限ON・日付未入力", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC025-日付未入力");
  await page.getByText("期限を設定する").click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("期限の日付を選択してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 25, "期限日付未入力") });
});

test("TC-026: 時刻指定ON・時刻未入力", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC026-時刻未入力");
  await page.getByText("期限を設定する").click();
  await page.locator('input[type="date"]').fill(isoDaysFromNow(1).slice(0, 10));
  await page.getByText("時刻も指定する").click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("期限の時刻を選択してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 26, "期限時刻未入力") });
});

test("TC-027: 繰り返しあり・期限なし", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC027-繰り返し期限なし");
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎日" }).click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("繰り返しを設定する場合は期限も設定してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 27, "繰り返しに期限なし") });
});

test("TC-028: 繰り返し「毎週」・曜日未選択", async ({ page, context }) => {
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC028-曜日未選択");
  await page.getByText("期限を設定する").click();
  await page.locator('input[type="date"]').fill(isoDaysFromNow(1).slice(0, 10));
  await page.locator('[data-slot="select-trigger"]').filter({ hasText: "なし" }).click();
  await page.getByRole("option", { name: "毎週" }).click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByText("繰り返す曜日を選択してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 28, "毎週曜日未選択") });
});

test("TC-029: 非登録メンバー選択・フォロー役未選択", async ({ page, context }) => {
  const m = await addUnregisteredMember(api1, "じいじ029");
  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC029-フォロー役未選択");
  await page.getByText(`${m.name}（未登録）`).click();
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(
    page.getByText(
      "ログインしないメンバーを担当者にする場合は、通知を受け取る家族を1人以上選んでください。",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/todos\/new$/);
  await page.screenshot({ path: screenshotPath(DIR, 29, "フォロー役未選択") });
});

test("TC-030: 編集対象が既に削除されている（404）", async ({ page, context }) => {
  const todo = await createTodo(api1, {
    title: "TC030-削除済み編集対象",
    categoryId: CATEGORY_IDS.その他,
    priority: "medium",
  });
  await deleteTodo(api1, todo.id);

  await context.addCookies(sessionCookie(u1.sessionId));
  await page.goto(`/todos/${todo.id}/edit`);

  // Next.jsの開発モード（StrictMode）でuseEffectが2回実行され、
  // 同じ内容のトーストが2件表示されることがあるためfirst()で拾う。
  await expect(page.getByText("このToDoは削除されています。").first()).toBeVisible();
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 30, "編集対象削除済み") });
});

test("TC-031: グループ未所属（403）", async ({ page, context }) => {
  const u = createSeedUser({ slug: "todoform-no-family", displayName: "未所属太郎" });
  clearFamily(u.userId);

  await context.addCookies(sessionCookie(u.sessionId));
  await page.goto("/todos/new");

  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 31, "グループ未所属") });
});

test("TC-032: セッション失効（401）", async ({ page, context }) => {
  const u = createSeedUser({ slug: "todoform-unauth", displayName: "失効太郎" });
  expireSession(u.sessionId);

  await context.addCookies(sessionCookie(u.sessionId));
  await page.goto("/todos/new");

  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: screenshotPath(DIR, 32, "セッション失効") });
});

test("TC-033: 送信中のボタン操作不可", async ({ page, context }) => {
  await context.route(
    (url) => url.pathname === "/api/v1/todos",
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    },
  );

  await openNewTodoAs(page, context, u1.sessionId);
  await page.getByLabel("タイトル").fill("TC033-送信中");
  await page.getByRole("button", { name: "追加する" }).click();

  await expect(page.getByRole("button", { name: "保存中…" })).toBeDisabled();
  await page.screenshot({ path: screenshotPath(DIR, 33, "送信中操作不可") });
  await expect(page.getByText("ToDoを追加しました。")).toBeVisible();
});
