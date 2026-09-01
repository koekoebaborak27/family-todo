import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../../env";
import { Errors } from "../../shared/errors/app-error";
import type { GoogleIdTokenClaims } from "./types";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Google の公開鍵（JWKS）は使い回す。リクエストのたびに取得し直すと遅く、
// jose 側にキャッシュ機構があるためモジュールスコープに1つ持てばよい。
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

interface GoogleTokenResponse {
  id_token: string;
}

// Googleの認可コードをトークン（id_token）に交換する。
// 認可コードが不正・期限切れの場合、Googleは4xxを返す。
export async function exchangeCodeForIdToken(code: string, env: Env): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw Errors.VALIDATION_ERROR("ログインに失敗しました。もう一度お試しください。", {
      googleStatus: response.status,
    });
  }

  const body = (await response.json()) as GoogleTokenResponse;
  return body.id_token;
}

// id_tokenの署名・発行者・有効期限・audience（このアプリのクライアントID）を検証し、
// ログインに必要な項目（sub・email・氏名）を取り出す。
export async function verifyGoogleIdToken(idToken: string, env: Env): Promise<GoogleIdTokenClaims> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: GOOGLE_ISSUERS,
    audience: env.GOOGLE_CLIENT_ID,
  }).catch(() => {
    throw Errors.VALIDATION_ERROR("ログインに失敗しました。もう一度お試しください。");
  });

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw Errors.VALIDATION_ERROR("ログインに失敗しました。もう一度お試しください。");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : payload.email,
  };
}
