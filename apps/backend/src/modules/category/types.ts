// GET /categories の応答項目。カテゴリは固定マスタでグループに依存しない。
export interface CategorySummary {
  id: number;
  name: string;
}
