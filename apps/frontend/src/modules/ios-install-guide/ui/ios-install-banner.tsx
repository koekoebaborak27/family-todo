"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { isIosUserAgent, shouldShowInstallBanner } from "../service";
import { loadDismissedAt, saveDismissedAt } from "../storage";
import { IosInstallDrawer } from "./ios-install-drawer";

// iPhone・iPadのSafariでホーム画面に未追加のときだけ表示する常設バナー。
// ToDo一覧・家族グループ作成/参加画面のヘッダー直下に置く。
// docs/specs/02_basic-design/family-todo/24_iOSインストール案内.md
export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const isStandalone = "standalone" in navigator && navigator.standalone === true;
    // サーバー側の描画結果とは一致しない（ブラウザのUser-Agent等に依存する）ため、
    // マウント後にのみ判定して表示を切り替える。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(
      shouldShowInstallBanner({
        isIos: isIosUserAgent(navigator.userAgent),
        isStandalone,
        dismissedAt: loadDismissedAt(),
        now: Date.now(),
      }),
    );
  }, []);

  // バナーを閉じ、閉じた日時を端末に記録する。以後7日間は表示しない。
  function handleClose() {
    setVisible(false);
    saveDismissedAt(Date.now());
  }

  if (!visible) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground">
        <Smartphone className="size-4 shrink-0" aria-hidden="true" />
        <p className="flex-1">ホーム画面に追加すると、通知を受け取れます。</p>
        <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)}>
          追加のしかた
        </Button>
        <Button variant="ghost" size="icon" aria-label="閉じる" onClick={handleClose}>
          <X className="size-4" />
        </Button>
      </div>
      <IosInstallDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
