import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendPushNotification } from "../../shared/push/send-push";
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
import {
  buildPushPayload,
  calculateNotifyAtMs,
  resolveRecipientUserIds,
  runNotificationBatch,
  selectDueSoonTargets,
  selectOverdueTargets,
  shouldNotifyDueSoon,
  type NotificationEnv,
} from "./service";
import type {
  NotificationAssigneeRow,
  NotificationSettingRow,
  NotificationTodoRow,
  PushSubscriptionRow,
} from "./types";

/**
 * 対象: notification/service（期限接近・期限超過の通知バッチ）
 * 目的: 通知先の決定（非登録メンバーはフォロー役が受け取る）・送信タイミングの判定・
 *       通知設定OFFの扱い・重複送信を防ぐ印の付け方・失効した購読の削除を担保する。
 */

vi.mock("./repository", () => ({
  listDueSoonCandidateTodos: vi.fn(),
  listOverdueCandidateTodos: vi.fn(),
  listAssigneesForTodoIds: vi.fn(),
  listNotificationSettingsForUsers: vi.fn(),
  listPushSubscriptionsForUsers: vi.fn(),
  markTodosNotified: vi.fn(),
  deletePushSubscriptions: vi.fn(),
}));

// VAPID鍵の検証を伴う本物の設定処理を動かさないよう、送信の入口ごと差し替える。
vi.mock("../../shared/push/vapid", () => ({
  configureWebPush: vi.fn(),
}));
vi.mock("../../shared/push/send-push", () => ({
  sendPushNotification: vi.fn(),
}));

// テストで使う環境の値。宛先URLの組み立てにだけ意味がある。
const testEnv: NotificationEnv = {
  FRONTEND_ORIGIN: "https://todo.example.com",
  VAPID_SUBJECT: "mailto:test@example.com",
  VAPID_PUBLIC_KEY: "test-public-key",
  VAPID_PRIVATE_KEY: "test-private-key",
};

// 期限は 2026-09-10T00:00:00Z 固定。現在時刻はテストごとに前後させる。
const DUE_AT = "2026-09-10T00:00:00.000Z";

function makeTodo(override: Partial<NotificationTodoRow> = {}): NotificationTodoRow {
  return { id: 1, title: "牛乳を買う", due_at: DUE_AT, ...override };
}

function makeAssignee(override: Partial<NotificationAssigneeRow> = {}): NotificationAssigneeRow {
  return { todo_id: 1, user_id: 10, unregistered_member_id: null, is_follower: 0, ...override };
}

function makeSetting(override: Partial<NotificationSettingRow> = {}): NotificationSettingRow {
  return {
    user_id: 10,
    enabled: 1,
    remind_before_value: 1,
    remind_before_unit: "days",
    ...override,
  };
}

function makeSubscription(override: Partial<PushSubscriptionRow> = {}): PushSubscriptionRow {
  return {
    id: 100,
    user_id: 10,
    endpoint: "https://push.example.com/abc",
    p256dh: "p256dh-value",
    auth: "auth-value",
    ...override,
  };
}

beforeEach(() => {
  // 呼び出し履歴と mockResolvedValueOnce の指定をテストごとに白紙へ戻す。
  vi.resetAllMocks();
  vi.mocked(listDueSoonCandidateTodos).mockResolvedValue([]);
  vi.mocked(listOverdueCandidateTodos).mockResolvedValue([]);
  vi.mocked(listAssigneesForTodoIds).mockResolvedValue([]);
  vi.mocked(listNotificationSettingsForUsers).mockResolvedValue([]);
  vi.mocked(listPushSubscriptionsForUsers).mockResolvedValue([]);
  vi.mocked(markTodosNotified).mockResolvedValue(undefined);
  vi.mocked(deletePushSubscriptions).mockResolvedValue(undefined);
  vi.mocked(sendPushNotification).mockResolvedValue("sent");
  vi.mocked(configureWebPush).mockReturnValue({} as ReturnType<typeof configureWebPush>);
});

describe("notification/service resolveRecipientUserIds", () => {
  describe("担当者に登録ユーザーと非登録メンバーが混ざるとき", () => {
    it("登録ユーザーのIDだけを返し、非登録メンバーは通知先にしない", () => {
      const assignees = [
        makeAssignee({ user_id: 10 }),
        makeAssignee({ user_id: null, unregistered_member_id: 5 }),
      ];

      expect(resolveRecipientUserIds(assignees)).toEqual([10]);
    });
  });

  describe("非登録メンバーとフォロー役が担当者のとき", () => {
    it("フォロー役の登録ユーザーを通知先にする", () => {
      const assignees = [
        makeAssignee({ user_id: null, unregistered_member_id: 5 }),
        makeAssignee({ user_id: 20, is_follower: 1 }),
      ];

      expect(resolveRecipientUserIds(assignees)).toEqual([20]);
    });
  });

  describe("同じユーザーが複数の行で担当者になっているとき", () => {
    it("重複を除いて1人分だけ返す", () => {
      const assignees = [makeAssignee({ user_id: 10 }), makeAssignee({ user_id: 10 })];

      expect(resolveRecipientUserIds(assignees)).toEqual([10]);
    });
  });

  describe("担当者が1人もいないとき", () => {
    it("空の配列を返す", () => {
      expect(resolveRecipientUserIds([])).toEqual([]);
    });
  });
});

describe("notification/service calculateNotifyAtMs", () => {
  describe("単位が days のとき", () => {
    it("期限から日数分さかのぼった時刻を返す", () => {
      expect(calculateNotifyAtMs(DUE_AT, 1, "days")).toBe(
        new Date("2026-09-09T00:00:00.000Z").getTime(),
      );
    });
  });

  describe("単位が hours のとき", () => {
    it("期限から時間分さかのぼった時刻を返す", () => {
      expect(calculateNotifyAtMs(DUE_AT, 3, "hours")).toBe(
        new Date("2026-09-09T21:00:00.000Z").getTime(),
      );
    });
  });
});

describe("notification/service shouldNotifyDueSoon", () => {
  const setting = makeSetting({ remind_before_value: 1, remind_before_unit: "days" });

  describe("知らせる時刻ちょうどのとき", () => {
    it("送信対象と判定する", () => {
      const nowMs = new Date("2026-09-09T00:00:00.000Z").getTime();

      expect(shouldNotifyDueSoon(DUE_AT, setting, nowMs)).toBe(true);
    });
  });

  describe("知らせる時刻の1ミリ秒前のとき", () => {
    it("まだ送信対象ではないと判定する", () => {
      const nowMs = new Date("2026-09-09T00:00:00.000Z").getTime() - 1;

      expect(shouldNotifyDueSoon(DUE_AT, setting, nowMs)).toBe(false);
    });
  });

  describe("期限ちょうどのとき", () => {
    it("期限接近の送信対象から外す（期限超過の通知が受け持つため）", () => {
      const nowMs = new Date(DUE_AT).getTime();

      expect(shouldNotifyDueSoon(DUE_AT, setting, nowMs)).toBe(false);
    });
  });

  describe("通知設定がOFFのとき", () => {
    it("送信対象にしない", () => {
      const nowMs = new Date("2026-09-09T12:00:00.000Z").getTime();

      expect(shouldNotifyDueSoon(DUE_AT, makeSetting({ enabled: 0 }), nowMs)).toBe(false);
    });
  });

  describe("通知設定の行が無いとき", () => {
    it("送信対象にしない", () => {
      const nowMs = new Date("2026-09-09T12:00:00.000Z").getTime();

      expect(shouldNotifyDueSoon(DUE_AT, undefined, nowMs)).toBe(false);
    });
  });

  describe("知らせるタイミングが未設定のとき", () => {
    it("送る時刻を決められないため送信対象にしない", () => {
      const nowMs = new Date("2026-09-09T12:00:00.000Z").getTime();
      const noTiming = makeSetting({ remind_before_value: null, remind_before_unit: null });

      expect(shouldNotifyDueSoon(DUE_AT, noTiming, nowMs)).toBe(false);
    });
  });
});

describe("notification/service selectDueSoonTargets", () => {
  const nowMs = new Date("2026-09-09T12:00:00.000Z").getTime();

  describe("担当者ごとに知らせるタイミングが違うとき", () => {
    it("条件を満たした担当者だけを宛先にする", () => {
      const todos = [makeTodo({ id: 1 })];
      const assignees = [
        makeAssignee({ todo_id: 1, user_id: 10 }),
        makeAssignee({ todo_id: 1, user_id: 20 }),
      ];
      const settings = [
        // 1日前 → 2026-09-09T00:00:00Z に到達済み。
        makeSetting({ user_id: 10, remind_before_value: 1, remind_before_unit: "days" }),
        // 3時間前 → 2026-09-09T21:00:00Z でまだ先。
        makeSetting({ user_id: 20, remind_before_value: 3, remind_before_unit: "hours" }),
      ];

      expect(selectDueSoonTargets(todos, assignees, settings, nowMs)).toEqual([
        { todo: todos[0], userIds: [10] },
      ]);
    });
  });

  describe("条件を満たす担当者が1人もいないとき", () => {
    it("そのToDoを対象から外す（送信済みの印も付けない）", () => {
      const todos = [makeTodo({ id: 1 })];
      const assignees = [makeAssignee({ todo_id: 1, user_id: 10 })];
      const settings = [makeSetting({ user_id: 10, enabled: 0 })];

      expect(selectDueSoonTargets(todos, assignees, settings, nowMs)).toEqual([]);
    });
  });
});

describe("notification/service selectOverdueTargets", () => {
  describe("通知設定がONの担当者とOFFの担当者がいるとき", () => {
    it("ONの担当者だけを宛先にする", () => {
      const todos = [makeTodo({ id: 1 })];
      const assignees = [
        makeAssignee({ todo_id: 1, user_id: 10 }),
        makeAssignee({ todo_id: 1, user_id: 20 }),
      ];
      const settings = [
        makeSetting({ user_id: 10, enabled: 1 }),
        makeSetting({ user_id: 20, enabled: 0 }),
      ];

      expect(selectOverdueTargets(todos, assignees, settings)).toEqual([
        { todo: todos[0], userIds: [10] },
      ]);
    });
  });

  describe("担当者全員の通知設定がOFFのとき", () => {
    it("宛先は空でもToDoは対象として残す（後から設定をONにしても再送しないため）", () => {
      const todos = [makeTodo({ id: 1 })];
      const assignees = [makeAssignee({ todo_id: 1, user_id: 10 })];
      const settings = [makeSetting({ user_id: 10, enabled: 0 })];

      expect(selectOverdueTargets(todos, assignees, settings)).toEqual([
        { todo: todos[0], userIds: [] },
      ]);
    });
  });
});

describe("notification/service buildPushPayload", () => {
  describe("期限接近のとき", () => {
    it("期限が近づいた旨の文言と、ToDo詳細画面のURLを返す", () => {
      expect(buildPushPayload("due_soon", makeTodo({ id: 7 }), testEnv.FRONTEND_ORIGIN)).toEqual({
        title: "まもなく期限です",
        body: "「牛乳を買う」の期限が近づいています。",
        url: "https://todo.example.com/todos/7",
      });
    });
  });

  describe("期限超過のとき", () => {
    it("期限を過ぎた旨の文言を返す", () => {
      expect(buildPushPayload("overdue", makeTodo({ id: 7 }), testEnv.FRONTEND_ORIGIN)).toEqual({
        title: "期限を過ぎています",
        body: "「牛乳を買う」がまだ終わっていません。",
        url: "https://todo.example.com/todos/7",
      });
    });
  });
});

describe("notification/service runNotificationBatch", () => {
  // 期限（2026-09-10T00:00:00Z）の1日前を過ぎた時点。
  const now = new Date("2026-09-09T12:00:00.000Z");

  describe("期限接近の対象があるとき", () => {
    beforeEach(() => {
      vi.mocked(listDueSoonCandidateTodos).mockResolvedValue([makeTodo({ id: 1 })]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([makeAssignee({ todo_id: 1 })]);
      vi.mocked(listNotificationSettingsForUsers).mockResolvedValue([makeSetting()]);
      vi.mocked(listPushSubscriptionsForUsers).mockResolvedValue([makeSubscription()]);
    });

    it("購読ごとに通知を送る", async () => {
      await runNotificationBatch(now, testEnv);

      expect(sendPushNotification).toHaveBeenCalledTimes(1);
      expect(vi.mocked(sendPushNotification).mock.calls[0][2]).toEqual({
        title: "まもなく期限です",
        body: "「牛乳を買う」の期限が近づいています。",
        url: "https://todo.example.com/todos/1",
      });
    });

    it("送信済みの印として現在時刻を書き込む", async () => {
      await runNotificationBatch(now, testEnv);

      expect(markTodosNotified).toHaveBeenCalledWith("due_soon", [1], now.toISOString());
    });

    it("送信できた購読は削除しない", async () => {
      await runNotificationBatch(now, testEnv);

      expect(deletePushSubscriptions).toHaveBeenCalledWith([]);
    });
  });

  describe("期限接近の対象が1件も無いとき", () => {
    it("送信も印付けも行わない", async () => {
      await runNotificationBatch(now, testEnv);

      expect(sendPushNotification).not.toHaveBeenCalled();
      expect(markTodosNotified).not.toHaveBeenCalled();
    });
  });

  describe("期限接近の候補はあるが送る相手がいないとき", () => {
    it("送信済みの印を付けず、次回のバッチで再び判定できる状態にする", async () => {
      vi.mocked(listDueSoonCandidateTodos).mockResolvedValue([makeTodo({ id: 1 })]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([makeAssignee({ todo_id: 1 })]);
      vi.mocked(listNotificationSettingsForUsers).mockResolvedValue([makeSetting({ enabled: 0 })]);

      await runNotificationBatch(now, testEnv);

      expect(markTodosNotified).not.toHaveBeenCalled();
      expect(sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe("購読が失効していたとき", () => {
    it("該当する購読を削除する", async () => {
      vi.mocked(listDueSoonCandidateTodos).mockResolvedValue([makeTodo({ id: 1 })]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([makeAssignee({ todo_id: 1 })]);
      vi.mocked(listNotificationSettingsForUsers).mockResolvedValue([makeSetting()]);
      vi.mocked(listPushSubscriptionsForUsers).mockResolvedValue([
        makeSubscription({ id: 100 }),
        makeSubscription({ id: 101, endpoint: "https://push.example.com/def" }),
      ]);
      vi.mocked(sendPushNotification).mockResolvedValueOnce("expired").mockResolvedValue("sent");

      await runNotificationBatch(now, testEnv);

      expect(deletePushSubscriptions).toHaveBeenCalledWith([100]);
    });
  });

  describe("送信が一時的に失敗したとき", () => {
    it("購読を削除せず、送り直しもしない", async () => {
      vi.mocked(listDueSoonCandidateTodos).mockResolvedValue([makeTodo({ id: 1 })]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([makeAssignee({ todo_id: 1 })]);
      vi.mocked(listNotificationSettingsForUsers).mockResolvedValue([makeSetting()]);
      vi.mocked(listPushSubscriptionsForUsers).mockResolvedValue([makeSubscription()]);
      vi.mocked(sendPushNotification).mockResolvedValue("failed");

      await runNotificationBatch(now, testEnv);

      expect(sendPushNotification).toHaveBeenCalledTimes(1);
      expect(deletePushSubscriptions).toHaveBeenCalledWith([]);
    });
  });

  describe("期限超過の対象があり、担当者全員の通知設定がOFFのとき", () => {
    it("送信は行わないが、送信済みの印は付ける", async () => {
      vi.mocked(listOverdueCandidateTodos).mockResolvedValue([makeTodo({ id: 2 })]);
      vi.mocked(listAssigneesForTodoIds).mockResolvedValue([makeAssignee({ todo_id: 2 })]);
      vi.mocked(listNotificationSettingsForUsers).mockResolvedValue([makeSetting({ enabled: 0 })]);

      await runNotificationBatch(now, testEnv);

      expect(markTodosNotified).toHaveBeenCalledWith("overdue", [2], now.toISOString());
      expect(sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe("期限超過の候補を取り出すとき", () => {
    it("現在時刻を渡して、期限を過ぎたものだけをDBから絞り込む", async () => {
      await runNotificationBatch(now, testEnv);

      expect(listOverdueCandidateTodos).toHaveBeenCalledWith(now.toISOString());
    });
  });
});
