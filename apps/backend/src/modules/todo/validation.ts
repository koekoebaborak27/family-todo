import { z } from "zod";

// GET /todos のクエリパラメータ。
// docs/specs/02_basic-design/family-todo/02_API仕様.md「ToDo」のとおり、並び替えのクエリは持たない
// （並び順は画面側で決める）。
export const listTodosQuerySchema = z.object({
  status: z.enum(["incomplete", "completed"]).default("incomplete"),
  category_id: z.coerce.number().int().positive().optional(),
});

export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;

// ToDoの作成・更新で共通に受け取る内容を検証する。
// 期限は画面側でUTCのISO 8601文字列に変換して送る。
const todoInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "タイトルを入力してください。")
      .max(100, "タイトルは100文字以内で入力してください。"),
    memo: z.string().max(1000, "詳細メモは1000文字以内で入力してください。").nullable(),
    categoryId: z.number().int().positive("カテゴリを選択してください。"),
    priority: z.enum(["high", "medium", "low"]),
    dueAt: z.string().datetime().nullable(),
    dueHasTime: z.boolean(),
    recurrenceType: z.enum(["none", "daily", "weekly", "monthly"]),
    recurrenceConfig: z
      .object({ weekdays: z.array(z.number().int().min(0).max(6)).min(1) })
      .or(z.object({ day: z.number().int().min(1).max(31) }))
      .nullable(),
  })
  .superRefine((input, context) => {
    if (input.dueAt === null && input.dueHasTime) {
      context.addIssue({
        code: "custom",
        message: "期限の日付を選択してください。",
        path: ["dueAt"],
      });
    }
    if (input.recurrenceType !== "none" && input.dueAt === null) {
      context.addIssue({
        code: "custom",
        message: "繰り返しを設定する場合は期限も設定してください。",
        path: ["dueAt"],
      });
    }
    if (
      input.recurrenceType === "weekly" &&
      !(input.recurrenceConfig && "weekdays" in input.recurrenceConfig)
    ) {
      context.addIssue({
        code: "custom",
        message: "繰り返す曜日を選択してください。",
        path: ["recurrenceConfig"],
      });
    }
    if (
      input.recurrenceType === "monthly" &&
      !(input.recurrenceConfig && "day" in input.recurrenceConfig)
    ) {
      context.addIssue({
        code: "custom",
        message: "繰り返す日付を選択してください。",
        path: ["recurrenceConfig"],
      });
    }
  });

// POST /todos の入力。担当者は作成と同時に丸ごと保存する。
export const createTodoSchema = todoInputSchema
  .extend({
    userIds: z.array(z.number().int().positive()),
    unregisteredMemberIds: z.array(z.number().int().positive()),
    followerUserIds: z.array(z.number().int().positive()),
  })
  .superRefine(validateAssignees);

// PATCH /todos/:id の入力。担当者は別のPUTで置き換える。
export const updateTodoSchema = todoInputSchema;

// PUT /todos/:id/assignees の入力。
export const replaceAssigneesSchema = z
  .object({
    userIds: z.array(z.number().int().positive()),
    unregisteredMemberIds: z.array(z.number().int().positive()),
    followerUserIds: z.array(z.number().int().positive()),
  })
  .superRefine(validateAssignees);

// コメントの投稿・編集で受け取る本文を検証する。
export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "コメントを入力してください。")
    .max(500, "コメントは500文字以内で入力してください。"),
});

// 非登録メンバーを担当者にするときは、通知を受ける登録ユーザーを必須にする。
function validateAssignees(
  input: { unregisteredMemberIds: number[]; followerUserIds: number[] },
  context: z.RefinementCtx,
): void {
  if (input.unregisteredMemberIds.length > 0 && input.followerUserIds.length === 0) {
    context.addIssue({
      code: "custom",
      message:
        "ログインしないメンバーを担当者にする場合は、通知を受け取る家族を1人以上選んでください。",
      path: ["followerUserIds"],
    });
  }
}

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ReplaceAssigneesInput = z.infer<typeof replaceAssigneesSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
