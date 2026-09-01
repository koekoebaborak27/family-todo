import { env } from "cloudflare:workers";
import type { Env } from "../../env";

// D1バインディングをリクエストごとに取得する。
// Cloudflare Workers上ではモジュール読み込み時にenvを固定できない（技術検証の結果。
// docs/todo/notes/cloudflare-workers-検証.md「検証1」）ため、呼び出しのたびにここを経由する。
export function getDb(): D1Database {
  return (env as Env).DB;
}
