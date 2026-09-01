import { Router } from "express";
import type { AuthContext } from "../auth";
import { Errors } from "../../shared/errors/app-error";
import {
  createFamily,
  getMyFamily,
  getMyFamilyMembers,
  getMyUnregisteredFamilyMembers,
  joinFamily,
} from "./service";
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

// 自分の所属グループの情報を取得する。requireAuth（src/index.ts）を通過済み。
// 未所属なら403（service側でensureFamilyMembershipにより判定）。
familyRouter.get("/families/me", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  const family = await getMyFamily(user);
  res.status(200).json(family);
});

// ToDoの担当者・フォロー役に選べる登録ユーザーを返す。
familyRouter.get("/families/me/members", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  const members = await getMyFamilyMembers(user);
  res.status(200).json(members);
});

// ToDoの担当者に選べる、ログインしないメンバーを返す。
familyRouter.get("/families/me/unregistered-members", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  const members = await getMyUnregisteredFamilyMembers(user);
  res.status(200).json(members);
});
