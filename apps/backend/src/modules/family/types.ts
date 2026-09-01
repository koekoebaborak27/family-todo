// POST /families・POST /families/join の成功時レスポンス（共通）。
// トースト表示用にグループ名を含める（フロントは応答の name をそのまま使う）。
export interface FamilySummary {
  id: number;
  name: string;
}
