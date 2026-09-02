"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchMe } from "@/modules/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import {
  addUnregisteredFamilyMember,
  deleteFamily,
  deleteUnregisteredFamilyMember,
  fetchMyFamilyDetail,
  fetchMyFamilyMembers,
  fetchMyUnregisteredFamilyMembers,
  FamilyError,
  leaveFamily,
  renewFamilyInviteCode,
} from "../api-client";
import type { FamilyDetail, FamilyMember, UnregisteredFamilyMember } from "../api-client";
import { FAMILY_ERROR_MESSAGES } from "../service";
import { validateUnregisteredMemberName } from "../validation";

type Phase = "checking" | "loading" | "ready" | "error";
type DialogKind = "deleteMember" | "renewInvite" | "leave" | "deleteFamily" | null;

// 日付文字列を画面で読みやすい年月日表記へ変換する。
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

// 家族グループ設定画面。ログイン済みかつグループ所属済みのユーザーだけが操作できる。
// docs/specs/02_basic-design/family-todo/20_家族グループ設定.md
export function FamilySettingsScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [isInviteExpired, setIsInviteExpired] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [unregisteredMembers, setUnregisteredMembers] = useState<UnregisteredFamilyMember[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [selectedMember, setSelectedMember] = useState<UnregisteredFamilyMember | null>(null);
  const [processing, setProcessing] = useState(false);

  // 設定画面に必要なグループ情報・メンバー一覧をまとめて取得する。
  const loadSettings = useCallback(() => {
    setPhase("loading");
    setPageError(null);
    Promise.all([fetchMyFamilyDetail(), fetchMyFamilyMembers(), fetchMyUnregisteredFamilyMembers()])
      .then(([nextFamily, nextMembers, nextUnregisteredMembers]) => {
        setFamily(nextFamily);
        setIsInviteExpired(new Date(nextFamily.inviteCodeExpiresAt).getTime() <= Date.now());
        setMembers(nextMembers);
        setUnregisteredMembers(nextUnregisteredMembers);
        setPhase("ready");
      })
      .catch((error: FamilyError) => {
        if (error.status === 401) {
          router.replace("/");
          return;
        }
        if (error.status === 403) {
          router.replace("/family/setup");
          return;
        }
        setPageError("家族グループ設定の読み込みに失敗しました。もう一度お試しください。");
        setPhase("error");
      });
  }, [router]);

  // 画面表示時にログインと家族グループへの所属を確認する。
  useEffect(() => {
    fetchMe()
      .then((result) => {
        if (!result.authenticated) {
          router.replace("/");
          return;
        }
        if (!result.hasFamily) {
          router.replace("/family/setup");
          return;
        }
        loadSettings();
      })
      .catch(() => router.replace("/"));
  }, [loadSettings, router]);

  // セッション失効（401）を、ログイン画面への遷移として共通処理する。
  // 該当すればtrueを返す（呼び出し側はそれ以上のエラー表示をしない）。
  function handleUnauthorized(error: FamilyError): boolean {
    if (error.status !== 401) {
      return false;
    }
    toast.error(FAMILY_ERROR_MESSAGES.unauthorized);
    router.replace("/");
    return true;
  }

  // 非登録メンバーの追加フォームを送信する。
  function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateUnregisteredMemberName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }
    setAdding(true);
    setNameError(null);
    addUnregisteredFamilyMember(name)
      .then((member) => {
        setUnregisteredMembers((current) => [...current, member]);
        setName("");
        toast.success("非登録メンバーを追加しました。");
      })
      .catch((error: FamilyError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        if (error.placement === "field") {
          setNameError(error.message);
          return;
        }
        toast.error("非登録メンバーの追加に失敗しました。もう一度お試しください。");
      })
      .finally(() => setAdding(false));
  }

  // 非登録メンバーを選び、削除確認ダイアログを開く。
  function openDeleteMemberDialog(member: UnregisteredFamilyMember) {
    setSelectedMember(member);
    setDialogKind("deleteMember");
  }

  // ダイアログで確定した非登録メンバーの削除を実行する。
  function handleDeleteMember() {
    if (!selectedMember) {
      return;
    }
    setProcessing(true);
    deleteUnregisteredFamilyMember(selectedMember.id)
      .then(() => {
        setUnregisteredMembers((current) =>
          current.filter((member) => member.id !== selectedMember.id),
        );
        toast.success("非登録メンバーを削除しました。");
        setDialogKind(null);
      })
      .catch((error: FamilyError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        toast.error(
          error.status === 404
            ? "この非登録メンバーは削除されています。"
            : "非登録メンバーの削除に失敗しました。もう一度お試しください。",
        );
        if (error.status === 404) {
          loadSettings();
          setDialogKind(null);
        }
      })
      .finally(() => setProcessing(false));
  }

  // 招待リンクを端末のクリップボードへコピーする。
  function handleCopyInviteLink() {
    if (!family) {
      return;
    }
    const inviteLink = `${window.location.origin}/join?code=${family.inviteCode}`;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => toast.success("招待リンクをコピーしました。"))
      .catch(() =>
        toast.error("コピーできませんでした。リンクを長押しして手動でコピーしてください。"),
      );
  }

  // ダイアログで確定した招待コードの再発行を実行する。
  function handleRenewInvite() {
    setProcessing(true);
    renewFamilyInviteCode()
      .then((nextFamily) => {
        setFamily(nextFamily);
        setIsInviteExpired(new Date(nextFamily.inviteCodeExpiresAt).getTime() <= Date.now());
        toast.success("招待コードを再発行しました。");
        setDialogKind(null);
      })
      .catch((error: FamilyError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        toast.error("招待コードの再発行に失敗しました。もう一度お試しください。");
      })
      .finally(() => setProcessing(false));
  }

  // ダイアログで確定した家族グループからの退出を実行する。
  function handleLeaveFamily() {
    setProcessing(true);
    leaveFamily()
      .then(() => {
        toast.success("家族グループから退出しました。");
        router.replace("/family/setup");
      })
      .catch((error: FamilyError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        toast.error("退出に失敗しました。もう一度お試しください。");
      })
      .finally(() => setProcessing(false));
  }

  // ダイアログで確定した家族グループ全体の削除を実行する。
  function handleDeleteFamily() {
    setProcessing(true);
    deleteFamily()
      .then(() => {
        toast.success("家族グループを削除しました。");
        router.replace("/family/setup");
      })
      .catch((error: FamilyError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        toast.error("家族グループの削除に失敗しました。もう一度お試しください。");
      })
      .finally(() => setProcessing(false));
  }

  // 開いている確認ダイアログで承諾された操作を振り分ける。
  function handleDialogConfirm() {
    if (dialogKind === "deleteMember") {
      handleDeleteMember();
    } else if (dialogKind === "renewInvite") {
      handleRenewInvite();
    } else if (dialogKind === "leave") {
      handleLeaveFamily();
    } else if (dialogKind === "deleteFamily") {
      handleDeleteFamily();
    }
  }

  // 操作ごとの確認文言を返す。
  function dialogContent(): {
    title: string;
    description: string;
    action: string;
    destructive: boolean;
  } {
    if (dialogKind === "deleteMember" && selectedMember) {
      return {
        title: `${selectedMember.name} を削除します。`,
        description: "この人が担当者になっているToDoからも外れます。削除しますか？",
        action: "削除する",
        destructive: true,
      };
    }
    if (dialogKind === "renewInvite") {
      return {
        title: "新しい招待コードを発行します。",
        description: "今のリンクは使えなくなります。再発行しますか？",
        action: "再発行する",
        destructive: false,
      };
    }
    if (dialogKind === "leave") {
      const isLastMember = members.length === 1;
      return {
        title: isLastMember ? "あなたが最後のメンバーです。" : "家族グループから退出します。",
        description: isLastMember
          ? `退出すると家族グループ「${family?.name}」は削除され、ToDo・コメント・非登録メンバーもすべて消えます。退出しますか？`
          : `家族グループ「${family?.name}」から退出します。あなたが担当者になっているToDoからは外れます。退出しますか？`,
        action: "退出する",
        destructive: true,
      };
    }
    return {
      title: `家族グループ「${family?.name}」を削除します。`,
      description: "ToDo・コメント・非登録メンバーがすべて消え、元に戻せません。削除しますか？",
      action: "削除する",
      destructive: true,
    };
  }

  if (phase === "checking" || phase === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-muted-foreground" role="status">
          読み込んでいます…
        </p>
      </main>
    );
  }
  if (phase === "error" || !family) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-destructive" role="alert">
          {pageError}
        </p>
        <Button onClick={loadSettings}>再読み込み</Button>
      </main>
    );
  }

  const inviteLink = `${typeof window === "undefined" ? "" : window.location.origin}/join?code=${family.inviteCode}`;
  const currentDialog = dialogContent();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-5">
      <header className="flex items-center gap-2">
        <Link
          href="/todos"
          aria-label="ToDo一覧へ戻る"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <ArrowLeft />
        </Link>
        <h1 className="text-2xl font-semibold">家族グループ設定</h1>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">グループ情報</h2>
        <p className="text-base">{family.name}</p>
        <p className="text-sm text-muted-foreground">{formatDate(family.createdAt)} に作成</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">家族メンバー ({members.length}人)</h2>
        {members.map((member) => (
          <p key={member.id} className="text-sm">
            {member.displayName}
            {member.isCurrentUser ? " (あなた)" : ""}
            {member.id === family.createdByUserId ? " (作成者)" : ""}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">非登録メンバー ({unregisteredMembers.length}人)</h2>
        <p className="text-sm text-muted-foreground">
          アプリにログインしない人（お子さんなど）を、担当者として選べるように登録します。
        </p>
        {unregisteredMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">非登録メンバーはまだ登録されていません。</p>
        ) : (
          unregisteredMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3">
              <p className="text-sm">{member.name}</p>
              <Button variant="outline" size="sm" onClick={() => openDeleteMemberDialog(member)}>
                削除
              </Button>
            </div>
          ))
        )}
        <form onSubmit={handleAddMember} className="flex flex-col gap-2">
          <Label htmlFor="unregistered-member-name">名前</Label>
          <div className="flex gap-2">
            <Input
              id="unregistered-member-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameError !== null}
              disabled={adding}
            />
            <Button type="submit" disabled={adding}>
              追加
            </Button>
          </div>
          {nameError && (
            <p className="text-sm text-destructive" role="alert">
              {nameError}
            </p>
          )}
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">家族を招待する</h2>
        <p className="text-sm">
          招待コード: <span className="font-semibold">{family.inviteCode}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {isInviteExpired
            ? "有効期限が切れています"
            : `${formatDate(family.inviteCodeExpiresAt)} まで有効`}
        </p>
        <p className="break-all text-sm text-muted-foreground">{inviteLink}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopyInviteLink}>
            <Copy />
            リンクをコピー
          </Button>
          <Button variant="outline" onClick={() => setDialogKind("renewInvite")}>
            <RefreshCw />
            招待コードを再発行
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <Button variant="outline" onClick={() => setDialogKind("leave")}>
          グループを退出する
        </Button>
        {family.createdByUserId === members.find((member) => member.isCurrentUser)?.id && (
          <Button variant="destructive" onClick={() => setDialogKind("deleteFamily")}>
            グループを削除する
          </Button>
        )}
      </section>

      <AlertDialog open={dialogKind !== null} onOpenChange={(open) => !open && setDialogKind(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{currentDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{currentDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              variant={currentDialog.destructive ? "destructive" : "default"}
              disabled={processing}
              onClick={handleDialogConfirm}
            >
              {currentDialog.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
