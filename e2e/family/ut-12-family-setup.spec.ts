import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { createFamily, joinFamily } from "../support/api";
import { evidenceDir, screenshotPath } from "../support/evidence";
import { cleanupE2eData, createSeedUser, expireSession, sessionCookie } from "../support/seed";

// 仕様書: docs/test/unit/spec/family/UT_12_家族グループ作成・参加.md
// 対象: 家族グループ作成・参加画面（/family/setup）、招待リンク振り分け画面（/join?code=）。
// ログイン済み状態はローカルD1へのセッション直接投入で代替する。
const DIR = evidenceDir("family", "UT_12_家族グループ作成・参加");

function apiFor(sessionId: string): Promise<APIRequestContext> {
  return request.newContext({ extraHTTPHeaders: { Cookie: `session_id=${sessionId}` } });
}

// ユーザー1人を、未所属のログイン済み状態で用意する。
function newUnaffiliatedUser(slug: string, displayName: string) {
  return createSeedUser({ slug, displayName });
}

test.afterAll(() => {
  cleanupE2eData();
});

test("TC-001: 初期表示（通常アクセス）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-init", "初期太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await expect(page.getByRole("heading", { name: "家族グループ" })).toBeVisible();
  await expect(
    page.getByText(
      "ToDoを共有する家族グループを作るか、家族から届いた招待コードで参加してください。",
    ),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "家族グループを作る" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("グループ名")).toHaveValue("");
  await page.screenshot({ path: screenshotPath(DIR, 1, "初期表示") });
});

test("TC-002: タブ切り替え（作る→参加）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-tab", "タブ太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByLabel("グループ名").fill("入力中の名前");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();

  await expect(page.getByRole("textbox", { name: "招待コード" })).toBeVisible();
  await expect(page.getByRole("button", { name: "参加する" })).toBeVisible();
  await page.getByRole("tab", { name: "家族グループを作る" }).click();
  await expect(page.getByLabel("グループ名")).toHaveValue("");
  await page.screenshot({ path: screenshotPath(DIR, 2, "タブ切り替え") });
});

test("TC-003: タブ切り替え時のエラー表示クリア", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-tab-error", "タブエラー太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("button", { name: "この名前で作成する" }).click();
  await expect(page.getByText("グループ名を入力してください。")).toBeVisible();

  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await expect(page.getByText("グループ名を入力してください。")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 3, "タブ切り替えエラー消去") });
});

test("TC-004: 家族グループの新規作成", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-create", "作成太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByLabel("グループ名").fill("山田家");
  await page.getByRole("button", { name: "この名前で作成する" }).click();

  await expect(page).toHaveURL(/\/todos$/);
  await expect(page.getByText("家族グループ「山田家」を作成しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 4, "グループ作成成功") });
});

test("TC-005: 招待コードでの参加", async ({ page, context }) => {
  const owner = newUnaffiliatedUser("family-join-owner", "招待元太郎");
  const ownerApi = await apiFor(owner.sessionId);
  const family = await createFamily(ownerApi, "テスト家族");

  const joiner = newUnaffiliatedUser("family-join-joiner", "参加太郎");
  await context.addCookies(sessionCookie(joiner.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await page
    .getByRole("textbox", { name: "招待コード" })
    .fill(family.inviteCode ?? (await fetchInviteCode(ownerApi)));
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page).toHaveURL(/\/todos$/);
  await expect(page.getByText("家族グループ「テスト家族」に参加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 5, "参加成功") });
  await ownerApi.dispose();
});

// createFamilyのレスポンスにinviteCodeが無い場合の保険（型定義上は無いためGET /families/meで取得する）。
async function fetchInviteCode(api: APIRequestContext): Promise<string> {
  const response = await api.get(
    `${process.env.E2E_API_BASE_URL ?? "http://localhost:8787"}/api/v1/families/me`,
  );
  const body = (await response.json()) as { inviteCode: string };
  return body.inviteCode;
}

test("TC-006: 招待コードの自動大文字変換", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-upper", "大文字太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await page.getByRole("textbox", { name: "招待コード" }).fill("abcdef12");

  await expect(page.getByRole("textbox", { name: "招待コード" })).toHaveValue("ABCDEF12");
  await page.screenshot({ path: screenshotPath(DIR, 6, "招待コード大文字変換") });
});

test("TC-007: 招待リンクからの遷移（未所属）", async ({ page, context }) => {
  const owner = newUnaffiliatedUser("family-link-owner", "リンク元太郎");
  const ownerApi = await apiFor(owner.sessionId);
  await createFamily(ownerApi, "リンク家族");
  const inviteCode = await fetchInviteCode(ownerApi);

  const u = newUnaffiliatedUser("family-link-user", "リンク太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto(`/join?code=${inviteCode}`);
  await expect(page).toHaveURL(new RegExp(`/family/setup\\?code=${inviteCode}$`));
  await expect(page.getByRole("tab", { name: "招待コードで参加する" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("textbox", { name: "招待コード" })).toHaveValue(inviteCode);
  await page.screenshot({ path: screenshotPath(DIR, 7, "招待リンク遷移") });
  await ownerApi.dispose();
});

test("TC-008: 招待リンクからの遷移（未ログイン）", async ({ page }) => {
  await page.goto("/join?code=ABCDEF12");
  await expect(page).toHaveURL(/\/\?inviteCode=ABCDEF12$/);
  await page.screenshot({ path: screenshotPath(DIR, 8, "招待リンク未ログイン") });
});

test("TC-009: 招待リンクからの遷移（既に所属済み）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-link-affiliated", "所属済み太郎");
  const api = await apiFor(u.sessionId);
  await createFamily(api, "所属済み家族");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/join?code=ZZZZZZZZ");
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 9, "招待リンク所属済み") });
  await api.dispose();
});

test("TC-010: 既に所属済みユーザーが直接開いた場合", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-direct-affiliated", "直接所属太郎");
  const api = await apiFor(u.sessionId);
  await createFamily(api, "直接所属家族");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 10, "所属済みアクセス") });
  await api.dispose();
});

test("TC-011: グループ名未入力", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-name-empty", "名前未入力太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("button", { name: "この名前で作成する" }).click();

  await expect(page.getByText("グループ名を入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 11, "グループ名未入力") });
});

test("TC-012: グループ名31文字（超過）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-name-31", "31文字太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByLabel("グループ名").fill("あ".repeat(31));
  await page.getByRole("button", { name: "この名前で作成する" }).click();

  await expect(page.getByText("グループ名は30文字以内で入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 12, "グループ名31文字") });
});

test("TC-013: グループ名30文字ちょうど", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-name-30", "30文字太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByLabel("グループ名").fill("あ".repeat(30));
  await page.getByRole("button", { name: "この名前で作成する" }).click();

  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 13, "グループ名30文字") });
});

test("TC-014: 招待コード未入力", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-code-empty", "コード未入力太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page.getByText("招待コードを入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 14, "招待コード未入力") });
});

test("TC-015: 招待コード桁数不足（7桁）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-code-short", "桁数不足太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await page.getByRole("textbox", { name: "招待コード" }).fill("ABC123");
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page.getByText("招待コードは半角英数字8桁で入力してください。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 15, "招待コード7桁") });
});

test("TC-016: 招待コードが正しくない", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-code-wrong", "不一致太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await page.getByRole("textbox", { name: "招待コード" }).fill("ZZZZZZZZ");
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(
    page.getByText("招待コードが正しくありません。家族に確認してください。"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 16, "招待コード不一致") });
});

test("TC-017: 招待コードの有効期限切れ", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-code-expired", "期限切れ太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  // 期限切れの招待コードはAPI経由では作れないため、POST /families/joinをモックして
  // サーバーの400応答（有効期限切れ）を再現する（UT_14のサーバーエラー再現と同じ手法）。
  await context.route(
    (url) => url.pathname === "/api/v1/families/join",
    (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "この招待コードは有効期限が切れています。家族に招待リンクを再発行してもらってください。",
          },
        }),
      }),
  );

  await page.goto("/family/setup");
  await page.getByRole("tab", { name: "招待コードで参加する" }).click();
  await page.getByRole("textbox", { name: "招待コード" }).fill("EXPIRED1");
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(
    page.getByText(
      "この招待コードは有効期限が切れています。家族に招待リンクを再発行してもらってください。",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 17, "招待コード期限切れ") });
});

test("TC-018: 既に所属済みで作成を試みる（409）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-conflict", "競合太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  // POST /families をモックして409応答を再現する（UT_14のサーバーエラー再現と同じ手法）。
  await context.route(
    (url) => url.pathname === "/api/v1/families",
    (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "CONFLICT", message: "すでに家族グループに参加しています。" },
        }),
      }),
  );

  await page.goto("/family/setup");
  await page.getByLabel("グループ名").fill("競合家族");
  await page.getByRole("button", { name: "この名前で作成する" }).click();

  await expect(page.getByText("すでに家族グループに参加しています。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 18, "既に所属済み409") });
});

test("TC-019: セッション失効（401）", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-unauth", "失効太郎");
  expireSession(u.sessionId);
  await context.addCookies(sessionCookie(u.sessionId));

  await page.goto("/family/setup");
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: screenshotPath(DIR, 19, "セッション失効") });
});

test("TC-020: 送信中のボタン操作不可", async ({ page, context }) => {
  const u = newUnaffiliatedUser("family-submitting", "送信中太郎");
  await context.addCookies(sessionCookie(u.sessionId));

  // POST /families の応答を遅らせて、送信中の操作不可状態を確認する。
  await context.route(
    (url) => url.pathname === "/api/v1/families",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    },
  );

  await page.goto("/family/setup");
  await page.getByLabel("グループ名").fill("送信中家族");
  await page.getByRole("button", { name: "この名前で作成する" }).click();

  await expect(page.getByRole("button", { name: "この名前で作成する" })).toBeDisabled();
  await page.screenshot({ path: screenshotPath(DIR, 20, "送信中操作不可") });
  await expect(page).toHaveURL(/\/todos$/);
});
