import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    // テストは実装ファイルの隣に置く（コロケーション）。方針は TESTING.md。
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // まだテストが1件もない（環境構築の段階のため）。追加され次第このオプションは外してよい。
    passWithNoTests: true,
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
