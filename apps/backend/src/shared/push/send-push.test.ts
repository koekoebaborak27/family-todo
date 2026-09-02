import { describe, expect, it, vi } from "vitest";
import type webpush from "web-push";
import { sendPushNotification } from "./send-push";

/**
 * 対象: shared/push sendPushNotification
 * 目的: Web Push 1件の送信結果を「成功」「購読が失効」「その他の失敗」へ正しく分類することを担保する
 *       （失効した購読だけを削除対象にするため。
 *       docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「Push送信失敗時の扱い」）。
 */

const subscription = {
  endpoint: "https://push.example.com/abc",
  p256dh: "p256dh-value",
  auth: "auth-value",
};

const payload = {
  title: "まもなく期限です",
  body: "「牛乳を買う」の期限が近づいています。",
  url: "https://todo.example.com/todos/1",
};

// 送信時の例外だけを差し替えた、web-push の代役を作る。
function makeClient(sendNotification: () => Promise<unknown>): typeof webpush {
  return { sendNotification: vi.fn(sendNotification) } as unknown as typeof webpush;
}

// 送信先から返ったHTTPステータスを持つ、web-push の例外を模したもの。
function makeWebPushError(statusCode: number): Error {
  return Object.assign(new Error("push service returned an error"), { statusCode });
}

describe("shared/push sendPushNotification", () => {
  describe("送信できたとき", () => {
    it("sent を返し、購読情報と通知の中身を文字列にして渡す", async () => {
      const client = makeClient(async () => undefined);

      const result = await sendPushNotification(client, subscription, payload);

      expect(result).toBe("sent");
      expect(client.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
    });
  });

  describe("410 Gone が返ったとき", () => {
    it("expired を返す", async () => {
      const client = makeClient(async () => {
        throw makeWebPushError(410);
      });

      expect(await sendPushNotification(client, subscription, payload)).toBe("expired");
    });
  });

  describe("404 Not Found が返ったとき", () => {
    it("expired を返す", async () => {
      const client = makeClient(async () => {
        throw makeWebPushError(404);
      });

      expect(await sendPushNotification(client, subscription, payload)).toBe("expired");
    });
  });

  describe("500 など他のステータスが返ったとき", () => {
    it("failed を返す（購読は削除しない）", async () => {
      const client = makeClient(async () => {
        throw makeWebPushError(500);
      });

      expect(await sendPushNotification(client, subscription, payload)).toBe("failed");
    });
  });

  describe("ステータスを持たない例外（通信断など）が起きたとき", () => {
    it("failed を返す", async () => {
      const client = makeClient(async () => {
        throw new Error("network error");
      });

      expect(await sendPushNotification(client, subscription, payload)).toBe("failed");
    });
  });
});
