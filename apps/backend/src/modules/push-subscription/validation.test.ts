import { describe, expect, it } from "vitest";
import { createPushSubscriptionSchema } from "./validation";

/**
 * 対象: push-subscription/validation createPushSubscriptionSchema
 * 目的: POST /push-subscriptions の入力チェック（endpoint・p256dh・authがいずれも空でないこと）を担保する。
 */
describe("push-subscription/validation createPushSubscriptionSchema", () => {
  it("endpoint・p256dh・authがすべて有効な文字列なら検証を通す", () => {
    const result = createPushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
      p256dh: "p256dh-key",
      auth: "auth-secret",
    });
    expect(result.success).toBe(true);
  });

  describe("endpointが未指定・空文字・空白のみのとき", () => {
    it("未指定なら「購読情報が正しくありません。」で検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        p256dh: "p256dh-key",
        auth: "auth-secret",
      });
      expect(result.success).toBe(false);
    });

    it("空文字なら「購読情報が正しくありません。」で検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "",
        p256dh: "p256dh-key",
        auth: "auth-secret",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("購読情報が正しくありません。");
    });

    it("空白のみでも検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "   ",
        p256dh: "p256dh-key",
        auth: "auth-secret",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("購読情報が正しくありません。");
    });
  });

  describe("p256dhが未指定・空文字・空白のみのとき", () => {
    it("未指定なら検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
        auth: "auth-secret",
      });
      expect(result.success).toBe(false);
    });

    it("空文字なら「購読情報が正しくありません。」で検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
        p256dh: "",
        auth: "auth-secret",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("購読情報が正しくありません。");
    });

    it("空白のみでも検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
        p256dh: "   ",
        auth: "auth-secret",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("購読情報が正しくありません。");
    });
  });

  describe("authが未指定・空文字・空白のみのとき", () => {
    it("未指定なら検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
        p256dh: "p256dh-key",
      });
      expect(result.success).toBe(false);
    });

    it("空文字なら「購読情報が正しくありません。」で検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
        p256dh: "p256dh-key",
        auth: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("購読情報が正しくありません。");
    });

    it("空白のみでも検証を弾く", () => {
      const result = createPushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/xxx",
        p256dh: "p256dh-key",
        auth: "   ",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("購読情報が正しくありません。");
    });
  });
});
