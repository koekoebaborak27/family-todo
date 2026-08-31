/**
 * テストの目的（大項目）
 * 1. 名前を渡したとき、その名前を使ったあいさつ文になること
 * 2. 名前が空のとき、「ゲスト」で代用されること
 *
 * このファイルは TESTING.md の書き方（コロケーション・日本語 3 階層・目的コメント）の見本を兼ねる。
 * プロジェクトを始めたら example フォルダごと削除してよい。
 */
import { describe, it, expect } from "vitest";
import { createGreeting } from "./greeting";

describe("createGreeting", () => {
  describe("名前を渡したとき", () => {
    it("その名前を使ったあいさつ文を返す", () => {
      expect(createGreeting("山田")).toBe("こんにちは、山田さん");
    });

    it("前後の空白を取り除いてから使う", () => {
      expect(createGreeting("  山田  ")).toBe("こんにちは、山田さん");
    });
  });

  describe("名前が空のとき", () => {
    it("空文字なら「ゲスト」で代用する", () => {
      expect(createGreeting("")).toBe("こんにちは、ゲストさん");
    });

    it("空白だけでも「ゲスト」で代用する", () => {
      expect(createGreeting("   ")).toBe("こんにちは、ゲストさん");
    });
  });
});
