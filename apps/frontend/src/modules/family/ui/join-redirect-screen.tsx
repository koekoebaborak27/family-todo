"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchMe } from "@/modules/auth";

// 招待リンク（/join?code=XXXXXXXX）から来た場合の振り分け専用画面。
// 未ログインならログイン画面（コードを引き継ぐ）、ログイン済みで所属グループ有りなら
// ToDo一覧、未所属なら家族グループ作成・参加画面（招待コード欄を埋めた状態）へ移動する。
// docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md「2. 画面へのアクセス条件・初期表示」。
export function JoinRedirectScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    const code = searchParams.get("code");

    fetchMe()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.authenticated) {
          router.replace(code ? `/?inviteCode=${encodeURIComponent(code)}` : "/");
          return;
        }
        if (result.hasFamily) {
          router.replace("/todos");
          return;
        }
        router.replace(code ? `/family/setup?code=${encodeURIComponent(code)}` : "/family/setup");
      })
      .catch(() => {
        if (!cancelled) {
          router.replace("/");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-sm text-muted-foreground" role="status">
        読み込んでいます…
      </p>
    </main>
  );
}
