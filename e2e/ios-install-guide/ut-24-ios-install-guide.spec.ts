import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { evidenceDir, screenshotPath } from "../support/evidence";
import { cleanupE2eData, createSeedUser, sessionCookie } from "../support/seed";
import { setupUserWithNewFamily } from "../support/scenario";

// 仕様書: docs/test/unit/spec/ios-install-guide/UT_24_iOSインストール案内.md
// 対象: iOSインストール案内バナー・Drawer（ToDo一覧・家族グループ作成/参加画面の上に重ねて表示する）。
// DB確認対象は無し（サーバー通信・DB更新を行わない機能のため）。
const DIR = evidenceDir("ios-install-guide", "UT_24_iOSインストール案内");

const DISMISSED_AT_KEY = "ios-install-guide-dismissed-at";
const DAY_MS = 24 * 60 * 60 * 1000;

const IOS_SAFARI_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IOS_CHROME_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1";
const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

// navigator.standalone（Safari固有のプロパティ。Chromiumには存在しない）を模擬する。
async function mockStandalone(page: Page, value: boolean): Promise<void> {
  await page.addInitScript((v) => {
    Object.defineProperty(navigator, "standalone", { get: () => v, configurable: true });
  }, value);
}

// バナーを閉じた日時（ミリ秒）をlocalStorageへ事前に仕込む。
async function seedDismissedAt(page: Page, timestampMs: number): Promise<void> {
  await page.addInitScript(
    (args) => {
      window.localStorage.setItem(args.key, String(args.value));
    },
    { key: DISMISSED_AT_KEY, value: timestampMs },
  );
}

// localStorageへの書き込みが例外を投げる状態（プライベートブラウズ等）を模擬する。
// 読み込みは元のlocalStorageに委譲し、書き込みだけ失敗させる。
async function mockLocalStorageWriteFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => original.getItem(key),
        setItem: () => {
          throw new DOMException("write blocked", "SecurityError");
        },
        removeItem: (key: string) => original.removeItem(key),
      },
    });
  });
}

async function openTodosWithSession(
  page: Page,
  context: BrowserContext,
  sessionId: string,
): Promise<void> {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto("/todos");
}

async function openFamilySetupWithSession(
  page: Page,
  context: BrowserContext,
  sessionId: string,
): Promise<void> {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto("/family/setup");
}

async function openSettingsWithSession(
  page: Page,
  context: BrowserContext,
  sessionId: string,
): Promise<void> {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto("/settings");
}

test.afterAll(() => {
  cleanupE2eData();
});

test("TC-001: ToDo一覧画面でのバナー表示", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-001",
    displayName: "テスト太郎",
    familyName: "テスト家族001",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 1, "ToDo一覧バナー表示") });
  await iosContext.close();
});

test("TC-002: 家族グループ作成・参加画面でのバナー表示", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = createSeedUser({ slug: "ios-002", displayName: "花子" });

  await openFamilySetupWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 2, "家族グループ作成参加バナー表示") });
  await iosContext.close();
});

test("TC-003: バナーの表示内容", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-003",
    displayName: "テスト太郎",
    familyName: "テスト家族003",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await expect(page.getByRole("button", { name: "追加のしかた" })).toBeVisible();
  await expect(page.getByRole("button", { name: "閉じる" })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 3, "バナー表示内容") });
  await iosContext.close();
});

test("TC-004: 「追加のしかた」からDrawerを開く", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-004",
    displayName: "テスト太郎",
    familyName: "テスト家族004",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);
  await page.getByRole("button", { name: "追加のしかた" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 4, "Drawer表示") });
  await iosContext.close();
});

test("TC-005: Drawerの表示内容", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-005",
    displayName: "テスト太郎",
    familyName: "テスト家族005",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);
  await page.getByRole("button", { name: "追加のしかた" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByText("ホーム画面に追加する")).toBeVisible();
  await expect(
    dialog.getByText(
      "iPhone・iPadでは、ホーム画面に追加したときだけ通知を受け取れます。次の手順で追加してください。",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByText("1. 画面の下にある「共有」ボタン（□に↑のアイコン）を押します。"),
  ).toBeVisible();
  await expect(
    dialog.getByText("2. メニューを下にスクロールして「ホーム画面に追加」を押します。"),
  ).toBeVisible();
  await expect(dialog.getByText("3. 右上の「追加」を押します。")).toBeVisible();
  await expect(
    dialog.getByText("追加した後は、ホーム画面のアイコンからアプリを開いてください。"),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "閉じる" })).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 5, "Drawer表示内容") });
  await iosContext.close();
});

test("TC-006: Drawerの「閉じる」", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-006",
    displayName: "テスト太郎",
    familyName: "テスト家族006",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);
  await page.getByRole("button", { name: "追加のしかた" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 6, "Drawer閉じる") });
  await iosContext.close();
});

test("TC-007: バナーの「×」", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-007",
    displayName: "テスト太郎",
    familyName: "テスト家族007",
  });

  const before = Date.now();
  await openTodosWithSession(page, iosContext, user.sessionId);
  await page.getByRole("button", { name: "閉じる" }).click();

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);
  const saved = await page.evaluate((key) => window.localStorage.getItem(key), DISMISSED_AT_KEY);
  expect(saved).not.toBeNull();
  expect(Number(saved)).toBeGreaterThanOrEqual(before);
  await page.screenshot({ path: screenshotPath(DIR, 7, "バナー閉じる") });
  await iosContext.close();
});

test("TC-008: 閉じてから7日未満の再訪問", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  await seedDismissedAt(page, Date.now() - 3 * DAY_MS);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-008",
    displayName: "テスト太郎",
    familyName: "テスト家族008",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 8, "7日未満は非表示") });
  await iosContext.close();
});

test("TC-009: 閉じてから7日経過後の再訪問", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  await seedDismissedAt(page, Date.now() - 8 * DAY_MS);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-009",
    displayName: "テスト太郎",
    familyName: "テスト家族009",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 9, "7日経過で再表示") });
  await iosContext.close();
});

test("TC-010: iOS上の非Safariブラウザでの表示", async ({ browser }) => {
  const iosChromeContext = await browser.newContext({ userAgent: IOS_CHROME_USER_AGENT });
  const page = await iosChromeContext.newPage();
  const user = await setupUserWithNewFamily(iosChromeContext, {
    slug: "ios-010",
    displayName: "テスト太郎",
    familyName: "テスト家族010",
  });

  await openTodosWithSession(page, iosChromeContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 10, "iOS非Safariでも表示") });
  await iosChromeContext.close();
});

test("TC-011: 閉じてからちょうど7日経過", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  await seedDismissedAt(page, Date.now() - 7 * DAY_MS);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-011",
    displayName: "テスト太郎",
    familyName: "テスト家族011",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 11, "7日ちょうどで表示") });
  await iosContext.close();
});

test("TC-012: 閉じてから7日に僅かに届かない", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  await seedDismissedAt(page, Date.now() - (7 * DAY_MS - 60 * 1000));
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-012",
    displayName: "テスト太郎",
    familyName: "テスト家族012",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 12, "7日未満僅差で非表示") });
  await iosContext.close();
});

test("TC-013: ホーム画面に追加済み", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, true);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-013",
    displayName: "テスト太郎",
    familyName: "テスト家族013",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 13, "ホーム画面追加済みは非表示") });
  await iosContext.close();
});

test("TC-014: 非iOS端末", async ({ browser }) => {
  const androidContext = await browser.newContext({ userAgent: ANDROID_USER_AGENT });
  const page = await androidContext.newPage();
  const user = await setupUserWithNewFamily(androidContext, {
    slug: "ios-014",
    displayName: "テスト太郎",
    familyName: "テスト家族014",
  });

  await openTodosWithSession(page, androidContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 14, "非iOSは非表示") });
  await androidContext.close();
});

test("TC-015: 対象外画面ではバナーが設置されていない", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-015",
    displayName: "テスト太郎",
    familyName: "テスト家族015",
  });

  await openSettingsWithSession(page, iosContext, user.sessionId);

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(DIR, 15, "対象外画面は非設置") });
  await iosContext.close();
});

test("TC-016: localStorageが使用できない環境", async ({ browser }) => {
  const iosContext = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
  const page = await iosContext.newPage();
  await mockStandalone(page, false);
  await mockLocalStorageWriteFailure(page);
  const user = await setupUserWithNewFamily(iosContext, {
    slug: "ios-016",
    displayName: "テスト太郎",
    familyName: "テスト家族016",
  });

  await openTodosWithSession(page, iosContext, user.sessionId);
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toHaveCount(0);

  await page.reload();

  await expect(page.getByText("ホーム画面に追加すると、通知を受け取れます。")).toBeVisible();
  await page.screenshot({ path: screenshotPath(DIR, 16, "保存不可でも再表示") });
  await iosContext.close();
});
