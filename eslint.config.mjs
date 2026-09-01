import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

// ESLint の設定。フレームワークを導入したら、その公式 config を先頭へ足す。
//   例（Next.js）: import next from "eslint-config-next"; → const config = [...next, ...]
/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...tseslint.configs.recommended,
  // Prettier と競合する整形系ルールを無効化（format は Prettier に一任）
  prettier,
  {
    rules: {
      // 意図的に使わない引数は `_` 接頭辞で許可する（例: Workers の scheduled ハンドラの未使用引数）。
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/coverage/**",
      "**/dist/**",
      "**/.next/**",
      "**/.wrangler/**",
      "playwright.config.ts",
      "e2e/**",
      // apps/frontend は Next.js 公式の eslint 設定（next lint 相当）を自分の
      // package.json の lint スクリプトで個別に実行する（ルートの汎用設定は対象外にする）。
      "apps/frontend/**",
    ],
  },
];

export default config;
