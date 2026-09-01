import { z } from "zod";

// GET /todos のクエリパラメータ。
// docs/specs/02_basic-design/family-todo/02_API仕様.md「ToDo」のとおり、並び替えのクエリは持たない
// （並び順は画面側で決める）。
export const listTodosQuerySchema = z.object({
  status: z.enum(["incomplete", "completed"]).default("incomplete"),
  category_id: z.coerce.number().int().positive().optional(),
});

export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
