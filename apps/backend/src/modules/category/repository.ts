import { getDb } from "../../shared/db/get-db";
import type { CategorySummary } from "./types";

// カテゴリの固定マスタ一覧を取得する。idの昇順（seed投入順）で返す。
export async function listCategories(): Promise<CategorySummary[]> {
  const { results } = await getDb()
    .prepare("SELECT id, name FROM categories ORDER BY id ASC")
    .all<CategorySummary>();
  return results;
}
