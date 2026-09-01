import { Router } from "express";
import { listCategories } from "./repository";

export const categoryRouter = Router();

// カテゴリの固定マスタ一覧を返す。requireAuth（src/index.ts）を通過済み。
// グループに依存しない全体共通データのため、グループ所属は問わない。
categoryRouter.get("/categories", async (_req, res) => {
  const categories = await listCategories();
  res.status(200).json(categories);
});
