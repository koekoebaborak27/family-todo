import { httpServerHandler } from "cloudflare:node";
import express from "express";
import type { Env } from "./env";

// Cloudflare Workers 上で Express を動かす構成（技術検証の結果。
// docs/todo/notes/cloudflare-workers-検証.md「検証1」を参照）。
const app = express();
app.use(express.json());

// 動作確認用。画面・API本体の実装はここでは行わない。
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(8080);

const httpHandler = httpServerHandler({ port: 8080 });

export default {
  fetch: httpHandler.fetch,

  // 期限接近・期限超過の通知バッチ（15分おき。wrangler.jsonc の triggers.crons で設定済み）。
  // バッチ本体（対象抽出・送信・重複防止）は未実装。詳細設計:
  // docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md
  async scheduled(_event, _env, _ctx) {
    // TODO: 実装フェーズで対象抽出・送信処理を追加する。
  },
} satisfies ExportedHandler<Env>;
