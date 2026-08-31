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
    ignores: ["node_modules/**", "coverage/**", "playwright.config.ts", "e2e/**"],
  },
];

export default config;
