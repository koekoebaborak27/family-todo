import { Router } from "express";
import type { AuthContext } from "../auth";
import { Errors } from "../../shared/errors/app-error";
import {
  createFamily,
  addMyUnregisteredFamilyMember,
  deleteMyFamily,
  getMyFamily,
  getMyFamilyMembers,
  getMyUnregisteredFamilyMembers,
  joinFamily,
  leaveMyFamily,
  removeMyUnregisteredFamilyMember,
  renewMyFamilyInviteCode,
} from "./service";
import { createFamilySchema, createUnregisteredMemberSchema, joinFamilySchema } from "./validation";

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

// 非登録メンバーを追加する。名前の入力チェックはschemaで行う。
familyRouter.post("/families/me/unregistered-members", async (req, res) => {
  const parsed = createUnregisteredMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.VALIDATION_ERROR(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    );
  }
  const { user } = res.locals.authContext as AuthContext;
  const member = await addMyUnregisteredFamilyMember(parsed.data, user);
  res.status(201).json(member);
});

// 非登録メンバーを削除する。
familyRouter.delete("/families/me/unregistered-members/:id", async (req, res) => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw Errors.VALIDATION_ERROR("削除する非登録メンバーが正しくありません。");
  }
  const { user } = res.locals.authContext as AuthContext;
  await removeMyUnregisteredFamilyMember(memberId, user);
  res.status(204).end();
});

// 招待コードを再発行する。
familyRouter.post("/families/me/invite", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  const family = await renewMyFamilyInviteCode(user);
  res.status(200).json(family);
});

// 自分を家族グループから退出させる。
familyRouter.post("/families/me/leave", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  await leaveMyFamily(user);
  res.status(204).end();
});

// 作成者が家族グループ全体を削除する。
familyRouter.delete("/families/me", async (_req, res) => {
  const { user } = res.locals.authContext as AuthContext;
  await deleteMyFamily(user);
  res.status(204).end();
});
