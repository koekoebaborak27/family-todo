import { Router } from "express";
import type { AuthContext } from "../auth";
import { Errors } from "../../shared/errors/app-error";
import { createFamily, joinFamily } from "./service";
import { createFamilySchema, joinFamilySchema } from "./validation";

export const familyRouter = Router();

// 家族グループを新規作成する。requireAuth（src/index.ts）を通過済み。
// グループ未所属であることの確認はservice側で行い、既に所属していれば409。
familyRouter.post("/families", async (req, res) => {
  const parsed = createFamilySchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }

  const { user } = res.locals.authContext as AuthContext;
  const family = await createFamily(parsed.data, user);
  res.status(201).json(family);
});

// 招待コードで家族グループに参加する。requireAuth（src/index.ts）を通過済み。
familyRouter.post("/families/join", async (req, res) => {
  const parsed = joinFamilySchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }

  const { user } = res.locals.authContext as AuthContext;
  const family = await joinFamily(parsed.data, user);
  res.status(200).json(family);
});
