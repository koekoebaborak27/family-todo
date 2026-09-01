import { beforeEach, describe, expect, it } from "vitest";
import { buildGoogleAuthUrl, consumeOAuthState, getPostLoginPath } from "./service";

/**
 * 対象: auth/service
 * 目的: Google認可URLの組み立て・stateの一致確認（OAuthのCSRF対策）・
 *       ログイン成功後の遷移先振り分けを担保する。
 */

beforeEach(() => {
  sessionStorage.clear();
});

describe("auth/service buildGoogleAuthUrl", () => {
  it("client_id・redirect_uri・scopeを含むGoogleの認可URLを組み立てる", () => {
    const url = new URL(buildGoogleAuthUrl("test-client-id"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/auth/callback`);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("発行したstateをsessionStorageへ保存する", () => {
    const url = new URL(buildGoogleAuthUrl("test-client-id"));
    const state = url.searchParams.get("state");

    expect(state).toBeTruthy();
    expect(sessionStorage.getItem("family-todo:google-oauth-state")).toBe(state);
  });
});

describe("auth/service consumeOAuthState", () => {
  describe("発行したstateと一致するとき", () => {
    it("trueを返し、保存していた値を削除する", () => {
      const url = new URL(buildGoogleAuthUrl("test-client-id"));
      const state = url.searchParams.get("state");

      expect(consumeOAuthState(state)).toBe(true);
      expect(sessionStorage.getItem("family-todo:google-oauth-state")).toBeNull();
    });
  });

  describe("stateが無い・一致しないとき", () => {
    it("受け取ったstateがnullならfalseを返す", () => {
      expect(consumeOAuthState(null)).toBe(false);
    });

    it("発行した値と異なればfalseを返す", () => {
      buildGoogleAuthUrl("test-client-id");
      expect(consumeOAuthState("不正な値")).toBe(false);
    });
  });
});

describe("auth/service getPostLoginPath", () => {
  it("所属グループがあれば /todos を返す", () => {
    expect(getPostLoginPath(true)).toBe("/todos");
  });

  it("所属グループが無ければ /family/setup を返す", () => {
    expect(getPostLoginPath(false)).toBe("/family/setup");
  });
});
