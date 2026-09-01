"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { fetchMe } from "@/modules/auth";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { createFamily, FamilyError, joinFamily } from "../api-client";
import {
  buildCreatedToastMessage,
  buildJoinedToastMessage,
  FAMILY_ERROR_MESSAGES,
} from "../service";
import { validateFamilyName, validateInviteCode } from "../validation";

type Phase = "checking" | "ready" | "redirecting";
type ActiveTab = "create" | "join";

// 家族グループ作成・参加画面。ログイン済みかつグループ未所属のユーザーのみが対象。
// docs/specs/02_basic-design/family-todo/12_家族グループ作成・参加.md
export function FamilySetupScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromLink = searchParams.get("code");

  const [phase, setPhase] = useState<Phase>("checking");
  const [activeTab, setActiveTab] = useState<ActiveTab>(codeFromLink ? "join" : "create");
  const [topError, setTopError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [inviteCode, setInviteCode] = useState(codeFromLink ?? "");
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // 画面表示時に、ログイン状態と所属グループの有無を確認する
  // （「2. 画面へのアクセス条件・初期表示」）。
  useEffect(() => {
    let cancelled = false;

    fetchMe()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.authenticated) {
          router.replace(codeFromLink ? `/?inviteCode=${encodeURIComponent(codeFromLink)}` : "/");
          return;
        }
        if (result.hasFamily) {
          router.replace("/todos");
          return;
        }
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) {
          router.replace("/");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function handleTabChange(value: string) {
    setActiveTab(value as ActiveTab);
    setName("");
    setNameError(null);
    setInviteCode("");
    setInviteCodeError(null);
    setTopError(null);
  }

  function handleFamilyError(error: FamilyError, fieldSetter: (message: string) => void) {
    if (error.placement === "field") {
      fieldSetter(error.message);
      return;
    }
    setTopError(error.message);
    if (error.message === FAMILY_ERROR_MESSAGES.unauthorized) {
      router.replace("/");
    }
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateFamilyName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setNameError(null);
    setTopError(null);
    setCreating(true);
    createFamily(name)
      .then((family) => {
        setPhase("redirecting");
        toast.success(buildCreatedToastMessage(family.name));
        router.replace("/todos");
      })
      .catch((error: FamilyError) => {
        setCreating(false);
        handleFamilyError(error, setNameError);
      });
  }

  function handleJoinSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateInviteCode(inviteCode);
    if (validationError) {
      setInviteCodeError(validationError);
      return;
    }

    setInviteCodeError(null);
    setTopError(null);
    setJoining(true);
    joinFamily(inviteCode)
      .then((family) => {
        setPhase("redirecting");
        toast.success(buildJoinedToastMessage(family.name));
        router.replace("/todos");
      })
      .catch((error: FamilyError) => {
        setJoining(false);
        handleFamilyError(error, setInviteCodeError);
      });
  }

  if (phase !== "ready") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-sm text-muted-foreground" role="status">
          読み込んでいます…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-full max-w-sm flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">家族グループ</h1>
        <p className="text-sm text-muted-foreground">
          ToDoを共有する家族グループを作るか、家族から届いた招待コードで参加してください。
        </p>
      </div>

      {topError && (
        <p className="w-full max-w-sm text-sm text-destructive" role="alert">
          {topError}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full max-w-sm">
        <TabsList className="w-full">
          <TabsTrigger value="create" className="flex-1">
            家族グループを作る
          </TabsTrigger>
          <TabsTrigger value="join" className="flex-1">
            招待コードで参加する
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3 pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="family-name">グループ名</Label>
              <Input
                id="family-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例: 山田家"
                aria-invalid={nameError !== null}
                disabled={creating}
              />
              {nameError && (
                <p className="text-sm text-destructive" role="alert">
                  {nameError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={creating}>
              この名前で作成する
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="join">
          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3 pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-code">招待コード</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="例: A3F9K2QP"
                aria-invalid={inviteCodeError !== null}
                disabled={joining}
              />
              {inviteCodeError && (
                <p className="text-sm text-destructive" role="alert">
                  {inviteCodeError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={joining}>
              参加する
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </main>
  );
}
