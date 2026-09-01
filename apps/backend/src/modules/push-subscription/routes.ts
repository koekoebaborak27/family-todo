import { Router } from "express";
import { Errors } from "../../shared/errors/app-error";
import type { AuthContext } from "../auth";
import { insertPushSubscriptionIfNotExists } from "./repository";
import { createPushSubscriptionSchema } from "./validation";

export const pushSubscriptionRouter = Router();

// Push通知の購読情報を登録する。requireAuth（src/index.ts）を通過済み。
// グループ所属は問わない（購読はユーザー単位の設定のため）。
pushSubscriptionRouter.post("/push-subscriptions", async (req, res) => {
  const parsed = createPushSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "購読情報が正しくありません。",
    );
  }

  const { user } = res.locals.authContext as AuthContext;
  await insertPushSubscriptionIfNotExists(user.id, parsed.data);
  res.status(204).end();
});
