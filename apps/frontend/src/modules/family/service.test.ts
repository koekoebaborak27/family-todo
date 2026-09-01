import { describe, expect, it } from "vitest";
import { buildCreatedToastMessage, buildJoinedToastMessage } from "./service";

/**
 * 対象: family/service buildCreatedToastMessage・buildJoinedToastMessage
 * 目的: 家族グループ作成・参加後にToDo一覧画面へ表示するトースト文言に、家族名が正しく埋め込まれることを担保する。
 */
describe("family/service buildCreatedToastMessage", () => {
  it("家族名を埋め込んだ作成完了メッセージを返す", () => {
    expect(buildCreatedToastMessage("山田家")).toBe(
      "家族グループ「山田家」を作成しました。",
    );
  });
});

describe("family/service buildJoinedToastMessage", () => {
  it("家族名を埋め込んだ参加完了メッセージを返す", () => {
    expect(buildJoinedToastMessage("山田家")).toBe(
      "家族グループ「山田家」に参加しました。",
    );
  });
});
