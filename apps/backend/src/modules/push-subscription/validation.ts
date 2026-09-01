import { z } from "zod";

// POST /push-subscriptions のリクエストボディ。ブラウザのPushManagerから取得する値をそのまま送る。
export const createPushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(1, "購読情報が正しくありません。"),
  p256dh: z.string().trim().min(1, "購読情報が正しくありません。"),
  auth: z.string().trim().min(1, "購読情報が正しくありません。"),
});

export type CreatePushSubscriptionInput = z.infer<typeof createPushSubscriptionSchema>;
