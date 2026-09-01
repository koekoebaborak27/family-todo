"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeGoogleCode, type LoginError } from "../api-client";
import { consumeOAuthState, getPostLoginPath, LOGIN_ERROR_MESSAGES } from "../service";

// Googleの認可画面から戻ってくる画面。認可コードをBackendへ渡してログインを完了させ、
// 結果に応じて次の画面（成功）かログイン画面（失敗。エラー文言付き）へ遷移する。
// この画面自体には操作項目が無く、常に一瞬で次の画面へ移る。
export function OAuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    function backToLoginWithError(message: string) {
      if (!cancelled) {
        router.replace(`/?error=${encodeURIComponent(message)}`);
      }
    }

    // Google側で拒否・中断した場合、Googleはcodeの代わりにerrorパラメータを付けて戻す。
    if (searchParams.get("error")) {
      backToLoginWithError(LOGIN_ERROR_MESSAGES.cancelled);
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !consumeOAuthState(state)) {
      backToLoginWithError(LOGIN_ERROR_MESSAGES.invalidCode);
      return;
    }

    exchangeGoogleCode(code)
      .then((result) => {
        if (!cancelled) {
          router.replace(getPostLoginPath(result.hasFamily));
        }
      })
      .catch((error: LoginError) => {
        backToLoginWithError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-sm text-muted-foreground" role="status">
        ログインしています…
      </p>
    </main>
  );
}
