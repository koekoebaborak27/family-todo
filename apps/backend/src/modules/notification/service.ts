import type { Env } from "../../env";
import { sendPushNotification, type PushPayload } from "../../shared/push/send-push";
import { configureWebPush } from "../../shared/push/vapid";
import {
  deletePushSubscriptions,
  listAssigneesForTodoIds,
  listDueSoonCandidateTodos,
  listNotificationSettingsForUsers,
  listOverdueCandidateTodos,
  listPushSubscriptionsForUsers,
  markTodosNotified,
} from "./repository";
import type {
  BatchNotificationType,
  NotificationAssigneeRow,
  NotificationSettingRow,
  NotificationTarget,
  NotificationTodoRow,
} from "./types";

// 通知バッチが使う環境ごとの値だけを取り出したもの。
// D1はshared/dbから取るが、宛先URLとVAPID鍵は入口（src/index.ts）から受け取る。
export type NotificationEnv = Pick<
  Env,
  "FRONTEND_ORIGIN" | "VAPID_SUBJECT" | "VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY"
>;

// 1時間・1日をミリ秒で表したもの。期限の何時間前・何日前に知らせるかの計算に使う。
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// 通知に載せる文言。仕様書に文面の指定が無いため、画面で使っている言葉に合わせて定めた。
const PUSH_TEXTS: Record<
  BatchNotificationType,
  { title: string; buildBody: (todoTitle: string) => string }
> = {
  due_soon: {
    title: "まもなく期限です",
    buildBody: (todoTitle) => `「${todoTitle}」の期限が近づいています。`,
  },
  overdue: {
    title: "期限を過ぎています",
    buildBody: (todoTitle) => `「${todoTitle}」がまだ終わっていません。`,
  },
};

// 1件のToDoの担当者から、通知を届ける登録ユーザーを求める。
// 担当者が非登録メンバーの行はその人へ直接届けられないため、代わりにフォロー役の登録ユーザーが受け取る。
// フォロー役も登録ユーザーとして todo_assignees に入っているので、結果として
// 「user_id が入っている行の人」がそのまま通知先になる（同じ人が重複しないようまとめる）。
export function resolveRecipientUserIds(assignees: NotificationAssigneeRow[]): number[] {
  const userIds = new Set<number>();
  for (const assignee of assignees) {
    if (assignee.user_id !== null) {
      userIds.add(assignee.user_id);
    }
  }
  return [...userIds];
}

// 期限接近の通知を送るべき時刻（期限の何時間前・何日前か）をミリ秒で求める。
// 期限との差を引くだけなので、時差の変換は行わなくてよい
// （docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「対象の絞り込み」）。
export function calculateNotifyAtMs(
  dueAtUtc: string,
  remindBeforeValue: number,
  remindBeforeUnit: "hours" | "days",
): number {
  const unitMs = remindBeforeUnit === "hours" ? HOUR_MS : DAY_MS;
  return new Date(dueAtUtc).getTime() - remindBeforeValue * unitMs;
}

// その人へ今このToDoの期限接近通知を送るべきかを判定する。
// 通知がOFF、またはタイミングが未設定のときは送らない（設定値からは送る時刻を決められないため）。
export function shouldNotifyDueSoon(
  dueAtUtc: string,
  setting: NotificationSettingRow | undefined,
  nowMs: number,
): boolean {
  if (!setting || setting.enabled !== 1) {
    return false;
  }
  if (setting.remind_before_value === null || setting.remind_before_unit === null) {
    return false;
  }
  const notifyAtMs = calculateNotifyAtMs(
    dueAtUtc,
    setting.remind_before_value,
    setting.remind_before_unit,
  );
  // 知らせる時刻を過ぎていて、かつ期限にはまだ達していない間だけ送る。
  // 期限を過ぎたものは期限超過の通知が受け持つ。
  return notifyAtMs <= nowMs && nowMs < new Date(dueAtUtc).getTime();
}

// 担当者の一覧を、ToDoごとのまとまりに整理する。
function groupAssigneesByTodoId(
  assignees: NotificationAssigneeRow[],
): Map<number, NotificationAssigneeRow[]> {
  const grouped = new Map<number, NotificationAssigneeRow[]>();
  for (const assignee of assignees) {
    const list = grouped.get(assignee.todo_id) ?? [];
    list.push(assignee);
    grouped.set(assignee.todo_id, list);
  }
  return grouped;
}

// 通知設定の一覧を、ユーザーIDから引ける形に整理する。
function toSettingsByUserId(
  settings: NotificationSettingRow[],
): Map<number, NotificationSettingRow> {
  return new Map(settings.map((setting) => [setting.user_id, setting]));
}

// 期限接近の候補ToDoから、実際に送る相手を決める。
// 送る相手が1人もいないToDoは対象から外す（＝送信済みの印も付けず、次回以降のバッチで再び判定する）。
export function selectDueSoonTargets(
  todos: NotificationTodoRow[],
  assignees: NotificationAssigneeRow[],
  settings: NotificationSettingRow[],
  nowMs: number,
): NotificationTarget[] {
  const assigneesByTodoId = groupAssigneesByTodoId(assignees);
  const settingsByUserId = toSettingsByUserId(settings);

  const targets: NotificationTarget[] = [];
  for (const todo of todos) {
    const userIds = resolveRecipientUserIds(assigneesByTodoId.get(todo.id) ?? []).filter((userId) =>
      shouldNotifyDueSoon(todo.due_at, settingsByUserId.get(userId), nowMs),
    );
    if (userIds.length > 0) {
      targets.push({ todo, userIds });
    }
  }
  return targets;
}

// 期限超過の候補ToDoから、実際に送る相手を決める。
// 期限を過ぎたこと自体は候補の抽出時点で確定しているため、送る相手がいなくてもToDoは対象のまま残す
// （呼び出し側が送信済みの印を付け、後から通知をONにしても再送しないようにする。
// docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「重複送信の防止」）。
export function selectOverdueTargets(
  todos: NotificationTodoRow[],
  assignees: NotificationAssigneeRow[],
  settings: NotificationSettingRow[],
): NotificationTarget[] {
  const assigneesByTodoId = groupAssigneesByTodoId(assignees);
  const settingsByUserId = toSettingsByUserId(settings);

  return todos.map((todo) => ({
    todo,
    userIds: resolveRecipientUserIds(assigneesByTodoId.get(todo.id) ?? []).filter(
      (userId) => settingsByUserId.get(userId)?.enabled === 1,
    ),
  }));
}

// 通知の中身を組み立てる。押したときはそのToDoの詳細画面を開く。
export function buildPushPayload(
  notificationType: BatchNotificationType,
  todo: NotificationTodoRow,
  frontendOrigin: string,
): PushPayload {
  const text = PUSH_TEXTS[notificationType];
  return {
    title: text.title,
    body: text.buildBody(todo.title),
    url: `${frontendOrigin}/todos/${todo.id}`,
  };
}

// 決まった相手へ通知を送り、失効していた購読情報を削除する。
// 一時的な失敗はやり直さない（この送信自体を次の実行で送り直すこともしない）。
async function sendToTargets(
  notificationType: BatchNotificationType,
  targets: NotificationTarget[],
  appEnv: NotificationEnv,
): Promise<void> {
  const userIds = [...new Set(targets.flatMap((target) => target.userIds))];
  const subscriptions = await listPushSubscriptionsForUsers(userIds);
  if (subscriptions.length === 0) {
    return;
  }

  const client = configureWebPush(appEnv);
  // 「どのToDoの通知を、どの購読へ送るか」を先に並べてから、まとめて送る。
  const sendPlans = targets.flatMap((target) => {
    const payload = buildPushPayload(notificationType, target.todo, appEnv.FRONTEND_ORIGIN);
    return subscriptions
      .filter((subscription) => target.userIds.includes(subscription.user_id))
      .map((subscription) => ({ subscription, payload }));
  });

  const results = await Promise.all(
    sendPlans.map(async (plan) => ({
      subscriptionId: plan.subscription.id,
      result: await sendPushNotification(client, plan.subscription, plan.payload),
    })),
  );

  // 同じ購読が複数のToDoで失効と判定されることがあるため、重複を除いてから削除する。
  const expiredIds = [
    ...new Set(results.filter((r) => r.result === "expired").map((r) => r.subscriptionId)),
  ];
  await deletePushSubscriptions(expiredIds);
}

// 期限接近の通知をまとめて処理する。
async function processDueSoon(now: Date, appEnv: NotificationEnv): Promise<void> {
  const todos = await listDueSoonCandidateTodos();
  if (todos.length === 0) {
    return;
  }
  const assignees = await listAssigneesForTodoIds(todos.map((todo) => todo.id));
  const settings = await listNotificationSettingsForUsers(
    resolveRecipientUserIds(assignees),
    "due_soon",
  );

  const targets = selectDueSoonTargets(todos, assignees, settings, now.getTime());
  if (targets.length === 0) {
    return;
  }
  // 送信より先に印を付ける。送信の成否に関わらず、この期限に対する通知は1回だけにする。
  await markTodosNotified(
    "due_soon",
    targets.map((target) => target.todo.id),
    now.toISOString(),
  );
  await sendToTargets("due_soon", targets, appEnv);
}

// 期限超過の通知をまとめて処理する。
async function processOverdue(now: Date, appEnv: NotificationEnv): Promise<void> {
  const todos = await listOverdueCandidateTodos(now.toISOString());
  if (todos.length === 0) {
    return;
  }
  const assignees = await listAssigneesForTodoIds(todos.map((todo) => todo.id));
  const settings = await listNotificationSettingsForUsers(
    resolveRecipientUserIds(assignees),
    "overdue",
  );

  const targets = selectOverdueTargets(todos, assignees, settings);
  // 期限超過は、送る相手がいなかったToDoにも印を付ける（後から通知をONにしても再送はしない）。
  await markTodosNotified(
    "overdue",
    targets.map((target) => target.todo.id),
    now.toISOString(),
  );
  await sendToTargets(
    "overdue",
    targets.filter((target) => target.userIds.length > 0),
    appEnv,
  );
}

// 通知バッチの本体。期限接近 → 期限超過の順に処理する
// （docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「バッチ全体の処理順序」）。
export async function runNotificationBatch(now: Date, appEnv: NotificationEnv): Promise<void> {
  await processDueSoon(now, appEnv);
  await processOverdue(now, appEnv);
}
