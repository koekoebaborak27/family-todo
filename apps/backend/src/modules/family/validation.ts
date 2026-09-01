import { z } from "zod";

// POST /families のリクエストボディ。
// エラー文言は docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「4. 入力チェック」のとおり。
export const createFamilySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "グループ名を入力してください。")
    .max(30, "グループ名は30文字以内で入力してください。"),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

// POST /families/join のリクエストボディ。
export const joinFamilySchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(1, "招待コードを入力してください。")
    .regex(/^[A-Z0-9]{8}$/, "招待コードは半角英数字8桁で入力してください。"),
});

export type JoinFamilyInput = z.infer<typeof joinFamilySchema>;

// POST /families/me/unregistered-members のリクエストボディ。
export const createUnregisteredMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください。")
    .max(20, "名前は20文字以内で入力してください。"),
});

export type CreateUnregisteredMemberInput = z.infer<typeof createUnregisteredMemberSchema>;
