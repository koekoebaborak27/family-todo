"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image, { getImageProps } from "next/image";
import { Button } from "@/shared/ui/button";
import { fetchMe, type LoginError } from "../api-client";
import { buildGoogleAuthUrl, getPostLoginPath, storePendingInviteCode } from "../service";
import { GoogleIcon } from "./google-icon";

type Phase = "checking" | "ready" | "redirecting";

// 背景写真はPC/スマホで別の画像を使う（構図が縦横で異なるため）。
// <picture>のsourceでブラウザ自身に選ばせることで、表示しない方の画像は読み込まれない
// （JS側で表示/非表示を切り替える方式だと、両方を読み込んでしまい通信量が無駄になる）。
const backgroundImageCommon = { alt: "", sizes: "100vw", priority: true } as const;
const {
  props: { srcSet: pcBackgroundSrcSet },
} = getImageProps({
  ...backgroundImageCommon,
  src: "/images/login-background-pc.webp",
  width: 1600,
  height: 900,
});
const {
  props: { srcSet: mobileBackgroundSrcSet, ...mobileBackgroundImageProps },
} = getImageProps({
  ...backgroundImageCommon,
  src: "/images/login-background-mobile.webp",
  width: 900,
  height: 1599,
});

// ログイン画面。画面表示時に GET /auth/me でログイン状態を確認し、
// ログイン済みならボタンを見せずに遷移先へ移動する（ちらつき防止）。
// docs/specs/02_basic-design/family-todo/10_ログイン.md
export function LoginScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // コールバック画面（/auth/callback）から失敗を伝えられた場合、文言をそのまま表示する
    // （エラーは常にログイン画面上・ボタンの下に表示する方針のため）。
    // URLの書き換え（history.replaceState）は、この実行がキャンセルされていないと分かって
    // からfetchMeのthen内で行う。開発時のStrict Mode（mount→unmount→再mount）で先に
    // 消費・除去されてしまい、生き残った側が読めなくなる事故を避けるため。
    const searchParams = new URLSearchParams(window.location.search);
    const errorFromCallback = searchParams.get("error");
    // 招待リンク（/join?code=XXXXXXXX）が未ログインだった場合、ここへ ?inviteCode=XXXXXXXX
    // 付きで戻ってくる（modules/family の JoinRedirectScreen）。Google認可画面を挟んでも
    // 引き継げるよう、ボタンを押す前にsessionStorageへ控えておく。
    const inviteCode = searchParams.get("inviteCode");

    fetchMe()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.authenticated) {
          router.replace(getPostLoginPath(result.hasFamily, inviteCode));
          return;
        }
        if (inviteCode) {
          storePendingInviteCode(inviteCode);
        }
        if (errorFromCallback) {
          setErrorMessage(errorFromCallback);
          window.history.replaceState(null, "", window.location.pathname);
        }
        setPhase("ready");
      })
      .catch((error: LoginError) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(error.message);
        setPhase("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLoginClick() {
    setPhase("redirecting");
    setErrorMessage(null);
    window.location.href = buildGoogleAuthUrl(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-end overflow-hidden p-6 pb-12 md:p-16">
      <picture className="absolute inset-0 block">
        <source media="(min-width: 768px)" srcSet={pcBackgroundSrcSet} />
        <img
          {...mobileBackgroundImageProps}
          alt=""
          srcSet={mobileBackgroundSrcSet}
          className="h-full w-full object-cover"
        />
      </picture>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-foreground/85 p-8 text-center text-background shadow-sm backdrop-blur-sm">
        <Image src="/images/login-icon.webp" alt="" width={72} height={74} />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">家族 de TODO！</h1>
          <p className="text-sm text-background/80">家族のちょっとしたToDoを、みんなで共有。</p>
        </div>

        {phase === "checking" ? (
          <p className="text-sm text-background/80" role="status">
            読み込んでいます…
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Button onClick={handleLoginClick} disabled={phase === "redirecting"} className="gap-2">
              <GoogleIcon />
              {phase === "redirecting" ? "ログインしています…" : "Googleでログイン"}
            </Button>
            {errorMessage && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
