import { expect, test } from "@playwright/test";
import { API_BASE_URL, createFamily } from "../support/api";
import { evidenceDir, screenshotPath } from "../support/evidence";
import { cleanupE2eData, createSeedUser, sessionCookie } from "../support/seed";

// 仕様書: docs/test/unit/spec/auth/UT_10_ログイン.md
// 対象: ログイン画面（/）。Google認可コードフローは検証環境にクレデンシャルが無いため使わず、
// ログイン済み状態はローカルD1へのセッション直接投入で代替する（ユーザー承認済み）。
const DIR = evidenceDir("auth", "UT_10_ログイン");

// 実装の文言（apps/frontend/src/modules/auth/service.ts の LOGIN_ERROR_MESSAGES と一致させる）。
const MESSAGES = {
  cancelled: "Googleログインがキャンセルされました。もう一度お試しください。",
  serverError: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。",
  network: "通信に失敗しました。電波状況を確認してもう一度お試しください。",
};

test.afterAll(() => {
  cleanupE2eData();
});

test("TC-001: 未ログイン状態での初期表示", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
  await expect(page.getByText("家族 de TODO！")).toBeVisible();
  await expect(page.getByText("家族のちょっとしたToDoを、みんなで共有。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 1, "ログイン画面初期表示") });
});

test("TC-002: ログインボタン押下時の遷移先URL", async ({ page, context }) => {
  // window.location.href への代入（実際のトップレベル遷移）を伴うため、Googleの実サーバーへは
  // 到達させずcontext.routeでabortし、リクエストURLの組み立てだけを検証する。
  // abort後はブラウザのエラーページに遷移しSPAのコンテキストが失われるため、
  // 画面のスクリーンショットはクリック前（ボタン表示中）に取得する。
  await page.goto("/");
  await page.screenshot({ path: screenshotPath(DIR, 2, "google遷移url") });

  await context.route("https://accounts.google.com/**", (route) => route.abort());
  const requestPromise = page.waitForRequest((req) =>
    req.url().startsWith("https://accounts.google.com/o/oauth2/v2/auth"),
  );

  await page.getByRole("button", { name: "Googleでログイン" }).click();
  const request = await requestPromise;
  const url = new URL(request.url());

  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("scope")).toBe("openid email profile");
  expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/callback");
  // stateはcrypto.randomUUID()が生成する値。同じ変数がsessionStorageへの保存にも使われる
  // （apps/frontend/src/modules/auth/service.ts buildGoogleAuthUrl）ため、
  // URLの形式を確認できればsessionStorage側も同じ値であることが保証される。
  expect(url.searchParams.get("state")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
});

test("TC-003: 招待コード付きURLで未ログインのまま開く", async ({ page }) => {
  await page.goto("/?inviteCode=TESTCODE1");
  await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();

  const storedInviteCode = await page.evaluate(() =>
    window.sessionStorage.getItem("family-todo:pending-invite-code"),
  );
  expect(storedInviteCode).toBe("TESTCODE1");

  await page.screenshot({ path: screenshotPath(DIR, 3, "招待コード付き初期表示") });
});

test("TC-004: コールバックからのエラー伝達を表示", async ({ page }) => {
  const params = new URLSearchParams({ error: MESSAGES.cancelled });
  await page.goto(`/?${params.toString()}`);

  // role="alert" は名前をコンテンツから算出しないため、getByRole の name フィルタでは
  // 拾えない（Next.jsのroute-announcer用divも同じroleを持ち曖昧になる）。要素を絞り込む。
  await expect(page.locator('p[role="alert"]')).toHaveText(MESSAGES.cancelled);
  await expect(page).toHaveURL(/\/$/); // error クエリが history.replaceState で消える
  await page.screenshot({ path: screenshotPath(DIR, 4, "ログインキャンセルエラー") });
});

test("TC-005: グループ未所属ユーザーの自動振り分け", async ({ page, context }) => {
  const user = createSeedUser({ slug: "login-no-family", displayName: "未所属太郎" });
  await context.addCookies(sessionCookie(user.sessionId));

  await page.goto("/");
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 5, "未所属ユーザー自動遷移") });
});

test("TC-006: グループ所属済みユーザーの自動振り分け", async ({ page, context }) => {
  const user = createSeedUser({ slug: "login-has-family", displayName: "所属花子" });
  await context.addCookies(sessionCookie(user.sessionId));
  await createFamily(context.request, "ログインテスト家族");

  await page.goto("/");
  await expect(page).toHaveURL(/\/todos$/);
  await page.screenshot({ path: screenshotPath(DIR, 6, "所属済みユーザー自動遷移") });
});

test("TC-007: GET /auth/meがサーバーエラー", async ({ page, context }) => {
  await context.route(`${API_BASE_URL}/api/v1/auth/me`, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await expect(page.locator('p[role="alert"]')).toHaveText(MESSAGES.serverError);
  await page.screenshot({ path: screenshotPath(DIR, 7, "サーバーエラー表示") });
});

test("TC-008: GET /auth/meが通信エラー", async ({ page, context }) => {
  await context.route(`${API_BASE_URL}/api/v1/auth/me`, (route) => route.abort("connectionfailed"));
  await page.goto("/");
  await expect(page.locator('p[role="alert"]')).toHaveText(MESSAGES.network);
  await page.screenshot({ path: screenshotPath(DIR, 8, "通信エラー表示") });
});
