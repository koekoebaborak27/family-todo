import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  addUnregisteredMember,
  API_BASE_URL,
  createFamily,
  getMyFamily,
  joinFamily,
} from "../support/api";
import { querySql } from "../support/db";
import { evidenceDir, screenshotPath } from "../support/evidence";
import {
  cleanupE2eData,
  clearFamily,
  createSeedUser,
  expireSession,
  sessionCookie,
} from "../support/seed";

// 仕様書: docs/test/unit/spec/family/UT_20_家族グループ設定.md
// 対象: 家族グループ設定画面（/family/settings）。ログイン済み状態はローカルD1へのセッション直接投入で代替する。
const DIR = evidenceDir("family", "UT_20_家族グループ設定");

function apiFor(sessionId: string): Promise<APIRequestContext> {
  return request.newContext({ extraHTTPHeaders: { Cookie: `session_id=${sessionId}` } });
}

interface SeedUser {
  userId: number;
  sessionId: string;
}

// テストケースごとに専用の家族グループを作る（退出・削除で状態が壊れるテストが多いため、
// 前回・前々回のようにToDoを都度作るのと同じ方針で、家族グループも都度作る）。
async function setupFamily(
  prefix: string,
  options: { secondMember?: boolean; unregisteredMember?: boolean } = {},
): Promise<{
  u1: SeedUser;
  u2: SeedUser | null;
  api1: APIRequestContext;
  api2: APIRequestContext | null;
  familyId: number;
  memberName: string;
}> {
  const u1 = createSeedUser({ slug: `${prefix}-u1`, displayName: "テスト太郎" });
  const api1 = await apiFor(u1.sessionId);
  const family = await createFamily(api1, "テスト家族");

  let u2: SeedUser | null = null;
  let api2: APIRequestContext | null = null;
  if (options.secondMember) {
    u2 = createSeedUser({ slug: `${prefix}-u2`, displayName: "花子" });
    api2 = await apiFor(u2.sessionId);
    const detail = await getMyFamily(api1);
    await joinFamily(api2, detail.inviteCode);
  }

  const memberName = "じいじ";
  if (options.unregisteredMember) {
    await addUnregisteredMember(api1, memberName);
  }

  return { u1, u2, api1, api2, familyId: family.id, memberName };
}

async function openSettingsAs(
  page: Page,
  context: import("@playwright/test").BrowserContext,
  sessionId: string,
) {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto("/family/settings");
}

test.afterAll(() => {
  cleanupE2eData();
});

test("TC-001: 初期表示", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-001", {
    secondMember: true,
    unregisteredMember: true,
  });

  await openSettingsAs(page, context, u1.sessionId);

  await expect(page.getByText("テスト家族", { exact: true })).toBeVisible();
  await expect(page.getByText("家族メンバー (2人)")).toBeVisible();
  await expect(page.getByText("非登録メンバー (1人)")).toBeVisible();
  await expect(page.getByText("じいじ", { exact: true })).toBeVisible();
  await expect(page.getByText("招待コード:")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 1, "初期表示") });
});

test("TC-002: 自分の行に「(あなた)」表示", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-002");

  await openSettingsAs(page, context, u1.sessionId);
  await expect(page.getByText("テスト太郎 (あなた)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 2, "あなた表示") });
});

test("TC-003: 作成者の行に「(作成者)」表示", async ({ page, context }) => {
  const { u2 } = await setupFamily("settings-003", { secondMember: true });

  await openSettingsAs(page, context, u2!.sessionId);
  await expect(page.getByText("テスト太郎 (作成者)")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 3, "作成者表示") });
});

test("TC-004: 非登録メンバー0件のメッセージ", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-004");

  await openSettingsAs(page, context, u1.sessionId);
  await expect(page.getByText("非登録メンバーはまだ登録されていません。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 4, "非登録メンバー0件") });
});

test("TC-005: 非登録メンバーの追加", async ({ page, context }) => {
  const { u1, familyId } = await setupFamily("settings-005");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByLabel("名前").fill("ばあば");
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("非登録メンバーを追加しました。")).toBeVisible();
  await expect(page.getByText("ばあば", { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 5, "非登録メンバー追加") });

  const rows = querySql<{ id: number }>(
    `SELECT id FROM unregistered_members WHERE family_id = ${familyId} AND name = 'ばあば';`,
  );
  expect(rows).toHaveLength(1);
});

test("TC-006: 非登録メンバーの削除確認ダイアログ", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-006", { unregisteredMember: true });

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "削除", exact: true }).click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText("じいじ を削除します。")).toBeVisible();
  await expect(
    page.getByText("この人が担当者になっているToDoからも外れます。削除しますか？"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 6, "非登録メンバー削除確認") });
});

test("TC-007: 非登録メンバーの削除実行", async ({ page, context }) => {
  const { u1, familyId } = await setupFamily("settings-007", { unregisteredMember: true });

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("非登録メンバーを削除しました。")).toBeVisible();
  await expect(page.getByText("じいじ", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 7, "非登録メンバー削除実行") });

  const rows = querySql<{ id: number }>(
    `SELECT id FROM unregistered_members WHERE family_id = ${familyId};`,
  );
  expect(rows).toHaveLength(0);
});

test("TC-008: 招待リンクをコピー", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-008");
  await context.grantPermissions(["clipboard-write", "clipboard-read"]);

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "リンクをコピー" }).click();

  await expect(page.getByText("招待リンクをコピーしました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 8, "リンクコピー") });
});

test("TC-009: 招待コード再発行の確認ダイアログ", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-009");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "招待コードを再発行" }).click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText("新しい招待コードを発行します。")).toBeVisible();
  await expect(page.getByText("今のリンクは使えなくなります。再発行しますか？")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 9, "再発行確認") });
});

test("TC-010: 招待コード再発行の実行", async ({ page, context }) => {
  const { u1, familyId } = await setupFamily("settings-010");
  const before = querySql<{ invite_code: string }>(
    `SELECT invite_code FROM families WHERE id = ${familyId};`,
  )[0];

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "招待コードを再発行" }).click();
  await page.getByRole("button", { name: "再発行する" }).click();

  await expect(page.getByText("招待コードを再発行しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 10, "再発行実行") });

  const after = querySql<{ invite_code: string }>(
    `SELECT invite_code FROM families WHERE id = ${familyId};`,
  )[0];
  expect(after.invite_code).not.toBe(before.invite_code);
});

test("TC-011: 退出確認ダイアログ（他にメンバーがいる）", async ({ page, context }) => {
  const { u2 } = await setupFamily("settings-011", { secondMember: true });

  await openSettingsAs(page, context, u2!.sessionId);
  await page.getByRole("button", { name: "グループを退出する" }).click();

  await expect(page.getByText("家族グループから退出します。")).toBeVisible();
  await expect(
    page.getByText(
      "家族グループ「テスト家族」から退出します。あなたが担当者になっているToDoからは外れます。退出しますか？",
    ),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 11, "退出確認_複数人") });
});

test("TC-012: 退出確認ダイアログ（自分が最後の1人）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-012");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを退出する" }).click();

  await expect(page.getByText("あなたが最後のメンバーです。")).toBeVisible();
  await expect(
    page.getByText(
      "退出すると家族グループ「テスト家族」は削除され、ToDo・コメント・非登録メンバーもすべて消えます。退出しますか？",
    ),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 12, "退出確認_最後の1人") });
});

test("TC-013: 退出の実行（他にメンバーが残る・作成者ではない）", async ({ page, context }) => {
  const { u2, familyId } = await setupFamily("settings-013", { secondMember: true });

  await openSettingsAs(page, context, u2!.sessionId);
  await page.getByRole("button", { name: "グループを退出する" }).click();
  await page.getByRole("button", { name: "退出する" }).click();

  await expect(page.getByText("家族グループから退出しました。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 13, "退出実行_複数人") });

  const [user] = querySql<{ family_id: number | null }>(
    `SELECT family_id FROM users WHERE id = ${u2!.userId};`,
  );
  expect(user.family_id).toBeNull();
  const [family] = querySql<{ created_by_user_id: number }>(
    `SELECT created_by_user_id FROM families WHERE id = ${familyId};`,
  );
  expect(family.created_by_user_id).not.toBe(u2!.userId);
});

test("TC-014: 退出の実行（作成者が退出し、残ったメンバーへ引き継がれる）", async ({
  page,
  context,
}) => {
  const { u1, u2, familyId } = await setupFamily("settings-014", { secondMember: true });

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを退出する" }).click();
  await page.getByRole("button", { name: "退出する" }).click();

  await expect(page.getByText("家族グループから退出しました。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 14, "退出実行_作成者引き継ぎ") });

  const [family] = querySql<{ created_by_user_id: number }>(
    `SELECT created_by_user_id FROM families WHERE id = ${familyId};`,
  );
  expect(family.created_by_user_id).toBe(u2!.userId);
});

test("TC-015: 退出の実行（最後の1人）", async ({ page, context }) => {
  const { u1, familyId } = await setupFamily("settings-015");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを退出する" }).click();
  await page.getByRole("button", { name: "退出する" }).click();

  await expect(page.getByText("家族グループから退出しました。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 15, "退出実行_最後の1人") });

  const families = querySql<{ id: number }>(`SELECT id FROM families WHERE id = ${familyId};`);
  expect(families).toHaveLength(0);
});

test("TC-016: 削除ボタンは作成者にのみ表示", async ({ page, context }) => {
  const { u2 } = await setupFamily("settings-016", { secondMember: true });

  await openSettingsAs(page, context, u2!.sessionId);
  await expect(page.getByRole("button", { name: "グループを削除する" })).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 16, "削除ボタン非表示") });
});

test("TC-017: グループ削除の確認ダイアログ", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-017");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを削除する" }).click();

  await expect(page.getByText("家族グループ「テスト家族」を削除します。")).toBeVisible();
  await expect(
    page.getByText("ToDo・コメント・非登録メンバーがすべて消え、元に戻せません。削除しますか？"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 17, "削除確認") });
});

test("TC-018: グループ削除の実行", async ({ page, context }) => {
  const { u1, familyId } = await setupFamily("settings-018", { unregisteredMember: true });

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを削除する" }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("家族グループを削除しました。")).toBeVisible();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 18, "削除実行") });

  const families = querySql<{ id: number }>(`SELECT id FROM families WHERE id = ${familyId};`);
  const unregistered = querySql<{ id: number }>(
    `SELECT id FROM unregistered_members WHERE family_id = ${familyId};`,
  );
  const [user] = querySql<{ family_id: number | null }>(
    `SELECT family_id FROM users WHERE id = ${u1.userId};`,
  );
  expect(families).toHaveLength(0);
  expect(unregistered).toHaveLength(0);
  expect(user.family_id).toBeNull();
});

test("TC-019: 非登録メンバー名未入力", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-019");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("名前を入力してください。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 19, "名前未入力") });
});

test("TC-020: 非登録メンバー名20文字ちょうど", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-020");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByLabel("名前").fill("あ".repeat(20));
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("非登録メンバーを追加しました。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 20, "名前20文字") });
});

test("TC-021: 非登録メンバー名21文字（超過）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-021");

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByLabel("名前").fill("あ".repeat(21));
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("名前は20文字以内で入力してください。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 21, "名前21文字") });
});

test("TC-022: 非登録メンバー名の重複（409）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-022", { unregisteredMember: true });

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByLabel("名前").fill("じいじ");
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("同じ名前の非登録メンバーがすでに登録されています。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 22, "名前重複") });
});

test("TC-023: 画面表示時の未認証（401）", async ({ page, context }) => {
  const u = createSeedUser({ slug: "settings-023", displayName: "失効太郎" });
  expireSession(u.sessionId);

  await context.addCookies(sessionCookie(u.sessionId));
  await page.goto("/family/settings");

  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: screenshotPath(DIR, 23, "表示時セッション失効") });
});

test("TC-024: 画面表示時のグループ未所属（403）", async ({ page, context }) => {
  const u = createSeedUser({ slug: "settings-024", displayName: "未所属太郎" });
  clearFamily(u.userId);

  await context.addCookies(sessionCookie(u.sessionId));
  await page.goto("/family/settings");

  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.screenshot({ path: screenshotPath(DIR, 24, "表示時グループ未所属") });
});

test("TC-025: 非登録メンバーの追加に失敗（500）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-025");

  await context.route(
    (url) => url.pathname === "/api/v1/families/me/unregistered-members",
    (route) =>
      route.request().method() !== "POST"
        ? route.continue()
        : route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByLabel("名前").fill("テスト");
  await page.getByRole("button", { name: "追加" }).click();

  await expect(
    page.getByText("非登録メンバーの追加に失敗しました。もう一度お試しください。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 25, "追加失敗") });
});

test("TC-026: 非登録メンバーの削除に失敗（500）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-026", { unregisteredMember: true });

  await context.route(
    (url) => /\/api\/v1\/families\/me\/unregistered-members\/\d+$/.test(url.pathname),
    (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(
    page.getByText("非登録メンバーの削除に失敗しました。もう一度お試しください。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 26, "削除失敗") });
});

test("TC-027: 削除対象の非登録メンバーが既に無い（404）", async ({ page, context }) => {
  const { u1, api1 } = await setupFamily("settings-027", { unregisteredMember: true });

  await openSettingsAs(page, context, u1.sessionId);
  await expect(page.getByText("じいじ", { exact: true })).toBeVisible();

  const members = (await (
    await api1.get(`${API_BASE_URL}/api/v1/families/me/unregistered-members`)
  ).json()) as { id: number }[];
  await api1.delete(`${API_BASE_URL}/api/v1/families/me/unregistered-members/${members[0].id}`);

  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("この非登録メンバーは削除されています。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 27, "削除対象なし") });
});

test("TC-028: クリップボードへのコピーに失敗", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-028");

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    });
  });

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "リンクをコピー" }).click();

  await expect(
    page.getByText("コピーできませんでした。リンクを長押しして手動でコピーしてください。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 28, "コピー失敗") });
});

test("TC-029: 招待コード再発行に失敗（500）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-029");

  await context.route(
    (url) => url.pathname === "/api/v1/families/me/invite",
    (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "招待コードを再発行" }).click();
  await page.getByRole("button", { name: "再発行する" }).click();

  await expect(
    page.getByText("招待コードの再発行に失敗しました。もう一度お試しください。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 29, "再発行失敗") });
});

test("TC-030: 退出に失敗（500）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-030");

  await context.route(
    (url) => url.pathname === "/api/v1/families/me/leave",
    (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを退出する" }).click();
  await page.getByRole("button", { name: "退出する" }).click();

  await expect(page.getByText("退出に失敗しました。もう一度お試しください。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 30, "退出失敗") });
});

test("TC-031: グループの削除に失敗（500）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-031");

  await context.route(
    (url) => url.pathname === "/api/v1/families/me",
    (route) =>
      route.request().method() !== "DELETE"
        ? route.continue()
        : route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await openSettingsAs(page, context, u1.sessionId);
  await page.getByRole("button", { name: "グループを削除する" }).click();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(
    page.getByText("家族グループの削除に失敗しました。もう一度お試しください。"),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 31, "削除失敗") });
});

test("TC-032: 操作中のセッション失効（401）", async ({ page, context }) => {
  const { u1 } = await setupFamily("settings-032");

  await openSettingsAs(page, context, u1.sessionId);
  await expect(page.getByRole("button", { name: "招待コードを再発行" })).toBeVisible();
  expireSession(u1.sessionId);

  await page.getByRole("button", { name: "招待コードを再発行" }).click();
  await page.getByRole("button", { name: "再発行する" }).click();

  await expect(
    page.getByText("ログインの有効期限が切れました。もう一度ログインしてください。"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: screenshotPath(DIR, 32, "操作中セッション失効") });
});
