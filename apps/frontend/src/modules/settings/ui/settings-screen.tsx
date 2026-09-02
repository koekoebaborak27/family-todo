"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchMe, logout } from "@/modules/auth";
import { IosInstallDrawer } from "@/modules/ios-install-guide";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import {
  fetchMyProfile,
  fetchNotificationSettings,
  SettingsError,
  updateDefaultDueTime,
  updateDisplayName,
  updateNotificationSetting,
} from "../api-client";
import { subscribePushNotifications } from "../push-subscription";
import {
  DUE_TIME_LABELS,
  NOTIFICATION_LABELS,
  REMIND_BEFORE_LABELS,
  SETTINGS_ERROR_MESSAGES,
  validateDisplayName,
} from "../service";
import type { MyProfile, NotificationSetting, NotificationType } from "../types";

type Phase = "checking" | "loading" | "ready" | "error";

// iPhone・iPadでホーム画面から開いていない場合を判定する。
function isIosNotInstalled(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIos && !("standalone" in navigator && navigator.standalone === true);
}

// 現在の端末でPush通知を受け取れるかを説明する文言を返す。
function getPushStatusMessage(): string {
  if (isIosNotInstalled()) {
    return "iPhone・iPadでは、ホーム画面に追加すると通知を受け取れます。";
  }
  if (typeof Notification === "undefined" || Notification.permission === "default") {
    return "この端末では通知を受け取れません。";
  }
  if (Notification.permission === "denied") {
    return "この端末では通知がブロックされています。ブラウザの設定から通知を許可してください。";
  }
  return "この端末では通知を受け取れます。";
}

// 個人設定画面。ログイン済みの自分だけが表示・変更できる。
// docs/specs/02_basic-design/family-todo/22_個人設定.md
export function SettingsScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [hasFamily, setHasFamily] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingDueTime, setSavingDueTime] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState("");
  const [installDrawerOpen, setInstallDrawerOpen] = useState(false);

  // プロフィールと通知設定をまとめて読み込む。
  const loadSettings = useCallback(() => {
    setPhase("loading");
    Promise.all([fetchMyProfile(), fetchNotificationSettings()])
      .then(([nextProfile, nextSettings]) => {
        setProfile(nextProfile);
        setDisplayName(nextProfile.displayName);
        setSettings(nextSettings);
        setPushStatusMessage(getPushStatusMessage());
        setPhase("ready");
      })
      .catch((error: SettingsError) => {
        if (error.status === 401) {
          toast.error(SETTINGS_ERROR_MESSAGES.unauthorized);
          router.replace("/");
          return;
        }
        setPhase("error");
      });
  }, [router]);

  // 画面表示時にログイン状態だけを確認する。個人設定はグループ未所属でも使える。
  useEffect(() => {
    fetchMe()
      .then((result) => {
        if (!result.authenticated) {
          router.replace("/");
          return;
        }
        setHasFamily(result.hasFamily);
        loadSettings();
      })
      .catch(() => router.replace("/"));
  }, [loadSettings, router]);

  // セッション失効（401）を、ログイン画面への遷移として共通処理する。
  // 該当すればtrueを返す（呼び出し側はそれ以上のエラー表示をしない）。
  function handleUnauthorized(error: SettingsError): boolean {
    if (error.status !== 401) {
      return false;
    }
    toast.error(SETTINGS_ERROR_MESSAGES.unauthorized);
    router.replace("/");
    return true;
  }

  // 指定した通知設定を現在の配列から取り出す。
  function getSetting(type: NotificationType): NotificationSetting {
    return (
      settings.find((setting) => setting.type === type) ?? {
        type,
        enabled: true,
        remindBeforeValue: type === "due_soon" ? 1 : null,
        remindBeforeUnit: type === "due_soon" ? "days" : null,
      }
    );
  }

  // 表示名フォームを送信し、成功時は現在のプロフィールへ反映する。
  function handleSaveDisplayName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateDisplayName(displayName);
    if (error) {
      setDisplayNameError(error);
      return;
    }
    setSavingDisplayName(true);
    setDisplayNameError(null);
    updateDisplayName(displayName.trim())
      .then(() => {
        setProfile((current) =>
          current ? { ...current, displayName: displayName.trim() } : current,
        );
        toast.success("表示名を変更しました。");
      })
      .catch((requestError: SettingsError) => {
        if (handleUnauthorized(requestError)) {
          return;
        }
        if (requestError.status === 400) {
          setDisplayNameError(requestError.message);
          return;
        }
        toast.error("表示名の保存に失敗しました。もう一度お試しください。");
      })
      .finally(() => setSavingDisplayName(false));
  }

  // 通知スイッチは先に画面を切り替え、保存できなければ元の状態へ戻す。
  function handleNotificationToggle(type: NotificationType, enabled: boolean) {
    const previous = getSetting(type);
    const next = { ...previous, enabled };
    setSettings((current) => current.map((setting) => (setting.type === type ? next : setting)));
    updateNotificationSetting(type, {
      enabled,
      ...(type === "due_soon"
        ? {
            remindBeforeValue: previous.remindBeforeValue ?? 1,
            remindBeforeUnit: previous.remindBeforeUnit ?? "days",
          }
        : {}),
    }).catch((error: SettingsError) => {
      setSettings((current) =>
        current.map((setting) => (setting.type === type ? previous : setting)),
      );
      if (error.status === 401) {
        toast.error(SETTINGS_ERROR_MESSAGES.unauthorized);
        router.replace("/");
        return;
      }
      toast.error("通知設定の保存に失敗しました。もう一度お試しください。");
    });
  }

  // 期限接近通知のタイミングを保存し、成功時だけ画面の値を更新する。
  function handleRemindBeforeChange(value: string) {
    const [valueText, unit] = value.split(":") as [string, "hours" | "days"];
    const previous = getSetting("due_soon");
    updateNotificationSetting("due_soon", {
      enabled: previous.enabled,
      remindBeforeValue: Number(valueText),
      remindBeforeUnit: unit,
    })
      .then(() => {
        setSettings((current) =>
          current.map((setting) =>
            setting.type === "due_soon"
              ? { ...setting, remindBeforeValue: Number(valueText), remindBeforeUnit: unit }
              : setting,
          ),
        );
        toast.success("リマインドのタイミングを変更しました。");
      })
      .catch((error: SettingsError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        toast.error("通知設定の保存に失敗しました。もう一度お試しください。");
      });
  }

  // 日付だけの期限に使う基準時刻を保存する。
  function handleDueTimeChange(value: string) {
    setSavingDueTime(true);
    updateDefaultDueTime(value)
      .then(() => {
        setProfile((current) => (current ? { ...current, defaultDueTime: value } : current));
        toast.success("基準時刻を変更しました。");
      })
      .catch((error: SettingsError) => {
        if (handleUnauthorized(error)) {
          return;
        }
        toast.error("基準時刻の保存に失敗しました。もう一度お試しください。");
      })
      .finally(() => setSavingDueTime(false));
  }

  // ブラウザの通知許可を求め、結果を表示へ反映する。
  // 「拒否された」（許可リクエスト自体の結果）と「購読情報の登録に失敗」（許可後のサーバー登録）を
  // 別のメッセージにするため、許可後の処理は内側のcatchで別扱いにする。
  function handleRequestPushPermission() {
    Notification.requestPermission()
      .then((permission) => {
        setPushStatusMessage(getPushStatusMessage());
        if (permission !== "granted") {
          toast.error("通知が許可されませんでした。ブラウザの設定から許可できます。");
          return;
        }
        subscribePushNotifications()
          .then((subscribed) => {
            if (!subscribed) {
              throw new Error("購読情報を取得できませんでした。");
            }
            toast.success("この端末で通知を受け取れるようになりました。");
          })
          .catch((error: unknown) => {
            if (error instanceof SettingsError && handleUnauthorized(error)) {
              return;
            }
            toast.error("通知の設定に失敗しました。もう一度お試しください。");
          });
      })
      .catch(() => toast.error("通知が許可されませんでした。ブラウザの設定から許可できます。"));
  }

  // ログアウトを実行し、ログイン画面へ戻る。
  function handleLogout() {
    logout()
      .then(() => router.replace("/"))
      .catch(() => toast.error(SETTINGS_ERROR_MESSAGES.network));
  }

  if (phase === "checking" || phase === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        読み込んでいます…
      </main>
    );
  }
  if (phase === "error" || !profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-destructive">
          個人設定の読み込みに失敗しました。もう一度お試しください。
        </p>
        <Button variant="outline" onClick={loadSettings}>
          再読み込み
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 px-4 py-5">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="戻る"
          onClick={() => router.push(hasFamily ? "/todos" : "/family/setup")}
        >
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-semibold">個人設定</h1>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="text-lg font-semibold">プロフィール</h2>
        <form className="flex flex-col gap-2" onSubmit={handleSaveDisplayName}>
          <Label htmlFor="display-name">表示名</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              aria-invalid={Boolean(displayNameError)}
            />
            <Button type="submit" disabled={savingDisplayName}>
              保存
            </Button>
          </div>
          {displayNameError && (
            <p className="text-sm text-destructive" role="alert">
              {displayNameError}
            </p>
          )}
        </form>
        <div className="flex flex-col gap-1">
          <Label>メールアドレス</Label>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="text-lg font-semibold">通知</h2>
        {(["todo_added", "assignee_set", "due_soon", "overdue"] as NotificationType[]).map(
          (type) => {
            const setting = getSetting(type);
            const labels = NOTIFICATION_LABELS[type];
            return (
              <div
                key={type}
                className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor={`notification-${type}`}>{labels.title}</Label>
                    <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
                  </div>
                  <Switch
                    id={`notification-${type}`}
                    checked={setting.enabled}
                    onCheckedChange={(checked) => handleNotificationToggle(type, checked)}
                  />
                </div>
                {type === "due_soon" && (
                  <Select
                    value={`${setting.remindBeforeValue ?? 1}:${setting.remindBeforeUnit ?? "days"}`}
                    onValueChange={(value) => {
                      if (value) handleRemindBeforeChange(value);
                    }}
                    disabled={!setting.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue>{(value: string) => REMIND_BEFORE_LABELS[value]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REMIND_BEFORE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          },
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <h2 className="text-lg font-semibold">期限の扱い</h2>
        <Label htmlFor="default-due-time">時刻を決めていない期限の基準時刻</Label>
        <Select
          value={profile.defaultDueTime}
          onValueChange={(value) => {
            if (value) handleDueTimeChange(value);
          }}
          disabled={savingDueTime}
        >
          <SelectTrigger id="default-due-time">
            <SelectValue>{(value: string) => DUE_TIME_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DUE_TIME_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          時刻を指定していない期限は、この時刻を締め切りとして通知します。
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <h2 className="text-lg font-semibold">Push通知の受け取り状態</h2>
        <p className="text-sm text-muted-foreground">{pushStatusMessage}</p>
        {typeof Notification !== "undefined" &&
          Notification.permission === "default" &&
          !isIosNotInstalled() && (
            <Button variant="outline" onClick={handleRequestPushPermission}>
              通知を許可する
            </Button>
          )}
        {isIosNotInstalled() && (
          <Button variant="outline" onClick={() => setInstallDrawerOpen(true)}>
            追加のしかたを見る
          </Button>
        )}
      </section>
      <IosInstallDrawer open={installDrawerOpen} onOpenChange={setInstallDrawerOpen} />

      <Button variant="destructive" onClick={() => setLogoutDialogOpen(true)}>
        ログアウト
      </Button>
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトします。よろしいですか？</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>ログアウト</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
