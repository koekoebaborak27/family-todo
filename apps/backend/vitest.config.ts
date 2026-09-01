import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // テストは実装ファイルの隣に置く（コロケーション）。方針は TESTING.md。
    include: ["src/**/*.{test,spec}.ts"],
    // まだテストが1件もない（環境構築の段階のため）。追加され次第このオプションは外してよい。
    passWithNoTests: true,
    globals: true,
  },
});
