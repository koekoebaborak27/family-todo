import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ISR/SSGのキャッシュ設定は使っていないため、既定値のまま。
// （wrangler.jsonc の "services" コメント参照）
export default defineCloudflareConfig();
