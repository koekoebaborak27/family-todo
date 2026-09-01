"use client";

import { Button } from "@/shared/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";

type IosInstallDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ホーム画面への追加手順を説明するDrawer。
// バナーの「追加のしかた」と、個人設定画面の「追加のしかたを見る」の両方から開く共通部品。
export function IosInstallDrawer({ open, onOpenChange }: IosInstallDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>ホーム画面に追加する</DrawerTitle>
          <DrawerDescription>
            iPhone・iPadでは、ホーム画面に追加したときだけ通知を受け取れます。次の手順で追加してください。
          </DrawerDescription>
        </DrawerHeader>
        <ol className="flex flex-col gap-3 px-4 py-2 text-sm">
          <li>1. 画面の下にある「共有」ボタン（□に↑のアイコン）を押します。</li>
          <li>2. メニューを下にスクロールして「ホーム画面に追加」を押します。</li>
          <li>3. 右上の「追加」を押します。</li>
        </ol>
        <p className="px-4 pb-2 text-sm text-muted-foreground">
          追加した後は、ホーム画面のアイコンからアプリを開いてください。
        </p>
        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
