import { defineConfig, devices } from "@playwright/test";

// テスト用アカウントなどを .env.example から環境変数として読み込む。
try {
  process.loadEnvFile(".env.example");
} catch {
  // ファイルが無い場合はスキップする
}

/**
 * ブラウザ操作テストの設定。手順は docs/skills/playwright-evidence-test.md。
 * 初回はブラウザ本体の取得が必要: pnpm exec playwright install
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on",
    video: "on",
  },
  expect: { timeout: 15000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
