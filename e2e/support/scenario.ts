import type { BrowserContext, Page } from "@playwright/test";
import { createFamily, getMyFamily, joinFamily } from "./api";
import { createSeedUser, sessionCookie } from "./seed";

// カード（ToDo一覧の1件）を、囲みdivのCSSクラスで拾う。
// apps/frontend/src/modules/todo/ui/todo-card.tsx の className と一致させる。
export function cardByTitle(page: Page, title: string) {
  return page
    .locator("div.rounded-2xl.border")
    .filter({ has: page.getByText(title, { exact: true }) });
}

// 指定した接頭辞で始まるカードのタイトルを、画面表示順のまま取得する。
// 他のテストケースが同じ家族グループに作ったカードが混ざっても、
// 接頭辞でフィルタした要素同士の相対順序はDOM順のまま保たれる。
export function cardTitles(page: Page, prefix: string) {
  return page.locator("p.line-clamp-2").filter({ hasText: new RegExp(`^${prefix}`) });
}

// 並び替えプルダウン（1つ目=項目、2つ目=順序）を選択する。
export async function selectSortOption(page: Page, index: 0 | 1, optionLabel: string): Promise<void> {
  await page.locator('[data-slot="select-trigger"]').nth(index).click();
  await page.getByRole("option", { name: optionLabel }).click();
}

// セッションCookieを載せてToDo一覧を開く。
export async function openTodosAs(page: Page, context: BrowserContext, sessionId: string) {
  await context.addCookies(sessionCookie(sessionId));
  await page.goto("/todos");
}

// n日後（負数で過去）のISO日時文字列を作る。hasTimeがfalseなら時刻は00:00に揃える。
export function isoDaysFromNow(days: number, hasTime = false, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  if (hasTime) {
    date.setHours(hour, 0, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

// ログイン済み・家族グループ所属済みの状態を1回で作る（多くのToDo一覧テストの前提条件）。
// D1へのユーザー・セッション直接投入（Google OAuthの代替）と、家族グループ作成API呼び出しをまとめる。
export async function setupUserWithNewFamily(
  context: BrowserContext,
  options: { slug: string; displayName: string; familyName: string },
): Promise<{ userId: number; sessionId: string; familyId: number }> {
  const user = createSeedUser({ slug: options.slug, displayName: options.displayName });
  await context.addCookies(sessionCookie(user.sessionId));
  const family = await createFamily(context.request, options.familyName);
  return { ...user, familyId: family.id };
}

// 既存の家族グループに2人目以降のメンバーとして参加させる。
export async function setupUserJoiningFamily(
  context: BrowserContext,
  options: { slug: string; displayName: string; inviteCode: string },
): Promise<{ userId: number; sessionId: string }> {
  const user = createSeedUser({ slug: options.slug, displayName: options.displayName });
  await context.addCookies(sessionCookie(user.sessionId));
  await joinFamily(context.request, options.inviteCode);
  return user;
}

export { getMyFamily };
