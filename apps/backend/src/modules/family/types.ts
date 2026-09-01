// POST /families・POST /families/join の成功時レスポンス（共通）。
// トースト表示用にグループ名を含める（フロントは応答の name をそのまま使う）。
export interface FamilySummary {
  id: number;
  name: string;
}

// GET /families/me の応答。
export interface FamilyDetail {
  id: number;
  name: string;
  inviteCode: string;
  inviteCodeExpiresAt: string;
  createdByUserId: number;
  createdAt: string;
}
