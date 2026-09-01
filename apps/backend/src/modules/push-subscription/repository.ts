import { getDb } from "../../shared/db/get-db";
import type { CreatePushSubscriptionInput } from "./validation";

// 購読情報を1件追加する。同じuser_id・endpointの組み合わせが既にあれば何もしない
// （01_データベース.md「push_subscriptions」。同じブラウザからの再登録を重複させないため）。
export async function insertPushSubscriptionIfNotExists(
  userId: number,
  input: CreatePushSubscriptionInput,
): Promise<void> {
  await getDb()
    .prepare(
      "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, endpoint) DO NOTHING",
    )
    .bind(userId, input.endpoint, input.p256dh, input.auth)
    .run();
}
