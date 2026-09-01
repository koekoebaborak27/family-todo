import { z } from "zod";

// POST /auth/google/callback のリクエストボディ。
// Googleから戻ってくる認可コードのみを受け取る。
export const googleCallbackSchema = z.object({
  code: z.string().min(1),
});

export type GoogleCallbackInput = z.infer<typeof googleCallbackSchema>;
