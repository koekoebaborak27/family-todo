"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import {
  createTodo,
  fetchCategories,
  fetchFamilyMembers,
  fetchTodo,
  fetchUnregisteredMembers,
  replaceAssignees,
  TodoError,
  updateTodo,
} from "../api-client";
import type {
  Category,
  FamilyMember,
  RecurrenceType,
  TodoInput,
  TodoPriority,
  UnregisteredMember,
} from "../types";

const PRIORITY_LABELS: Record<TodoPriority, string> = { high: "高", medium: "中", low: "低" };
const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "なし",
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ToDoの追加・編集画面。新規時はtodoIdを省略し、編集時は指定IDの内容を初期値へ入れる。
export function TodoFormScreen({ todoId }: { todoId?: number }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [unregisteredMembers, setUnregisteredMembers] = useState<UnregisteredMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [hasDueTime, setHasDueTime] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [userIds, setUserIds] = useState<number[]>([]);
  const [unregisteredMemberIds, setUnregisteredMemberIds] = useState<number[]>([]);
  const [followerUserIds, setFollowerUserIds] = useState<number[]>([]);

  // 選択肢と編集対象をまとめて読み込む。認証・所属エラーは既存画面と同じ遷移先へ戻す。
  useEffect(() => {
    Promise.all([
      fetchCategories(),
      fetchFamilyMembers(),
      fetchUnregisteredMembers(),
      todoId ? fetchTodo(todoId) : Promise.resolve(null),
    ])
      .then(([loadedCategories, loadedMembers, loadedUnregisteredMembers, todo]) => {
        setCategories(loadedCategories);
        setMembers(loadedMembers);
        setUnregisteredMembers(loadedUnregisteredMembers);
        if (todo) {
          setTitle(todo.title);
          setMemo(todo.memo ?? "");
          setCategoryId(todo.categoryId);
          setPriority(todo.priority);
          setHasDueDate(todo.dueAt !== null);
          setHasDueTime(todo.dueHasTime);
          setRecurrenceType(todo.recurrenceType);
          if (todo.dueAt) {
            const date = new Date(todo.dueAt);
            setDueDate(date.toLocaleDateString("en-CA"));
            setDueTime(date.toTimeString().slice(0, 5));
          }
          if (todo.recurrenceConfig && "weekdays" in todo.recurrenceConfig)
            setWeekdays(todo.recurrenceConfig.weekdays);
          if (todo.recurrenceConfig && "day" in todo.recurrenceConfig)
            setMonthlyDay(todo.recurrenceConfig.day);
          setUserIds(
            todo.assignees
              .filter((item) => item.type === "user" && !item.isFollower)
              .map((item) => item.id),
          );
          setUnregisteredMemberIds(
            todo.assignees.filter((item) => item.type === "unregistered").map((item) => item.id),
          );
          setFollowerUserIds(
            todo.assignees
              .filter((item) => item.type === "user" && item.isFollower)
              .map((item) => item.id),
          );
        } else
          setCategoryId(
            loadedCategories.find((item) => item.name === "その他")?.id ??
              loadedCategories[0]?.id ??
              null,
          );
        setLoading(false);
      })
      .catch((caught: TodoError) => {
        if (caught.kind === "unauthorized") router.replace("/");
        else if (caught.kind === "forbidden") router.replace("/family/setup");
        else if (caught.kind === "notFound") {
          toast.error(caught.message);
          router.replace("/todos");
        } else {
          setError("読み込みに失敗しました。時間をおいてもう一度お試しください。");
          setLoading(false);
        }
      });
  }, [router, todoId]);

  // チェックの選択状態を切り替える。
  function toggleId(id: number, current: number[], setCurrent: (value: number[]) => void) {
    setCurrent(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  // 日付・時刻の入力をUTCのISO文字列へ変換する。時刻なしはJSTの午前0時として保存する。
  function buildDueAt(): string | null {
    if (!hasDueDate || !dueDate) return null;
    const [year, month, day] = dueDate.split("-").map(Number);
    const [hour, minute] = hasDueTime && dueTime ? dueTime.split(":").map(Number) : [0, 0];
    return new Date(year, month - 1, day, hour, minute).toISOString();
  }

  // 入力を確認して保存する。失敗時は入力を保持し、画面上部へ理由を出す。
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError("タイトルを入力してください。");
    if (title.length > 100) return setError("タイトルは100文字以内で入力してください。");
    if (memo.length > 1000) return setError("詳細メモは1000文字以内で入力してください。");
    if (categoryId === null) return setError("カテゴリを選択してください。");
    if (hasDueDate && !dueDate) return setError("期限の日付を選択してください。");
    if (hasDueTime && !dueTime) return setError("期限の時刻を選択してください。");
    if (recurrenceType !== "none" && !hasDueDate)
      return setError("繰り返しを設定する場合は期限も設定してください。");
    if (recurrenceType === "weekly" && weekdays.length === 0)
      return setError("繰り返す曜日を選択してください。");
    if (unregisteredMemberIds.length > 0 && followerUserIds.length === 0)
      return setError(
        "ログインしないメンバーを担当者にする場合は、通知を受け取る家族を1人以上選んでください。",
      );
    const input: TodoInput = {
      title: title.trim(),
      memo: memo || null,
      categoryId,
      priority,
      dueAt: buildDueAt(),
      dueHasTime: hasDueTime,
      recurrenceType,
      recurrenceConfig:
        recurrenceType === "weekly"
          ? { weekdays }
          : recurrenceType === "monthly"
            ? { day: monthlyDay }
            : null,
    };
    const assignees = { userIds, unregisteredMemberIds, followerUserIds };
    setSaving(true);
    try {
      if (todoId) {
        await updateTodo(todoId, input);
        await replaceAssignees(todoId, assignees);
        toast.success("ToDoを保存しました。");
        router.replace(`/todos/${todoId}`);
      } else {
        await createTodo({ ...input, ...assignees });
        toast.success("ToDoを追加しました。");
        router.replace("/todos");
      }
    } catch (caught) {
      const message =
        caught instanceof TodoError
          ? caught.message
          : "保存に失敗しました。時間をおいてもう一度お試しください。";
      if (caught instanceof TodoError && caught.kind === "unauthorized") router.replace("/");
      else if (caught instanceof TodoError && caught.kind === "forbidden")
        router.replace("/family/setup");
      else if (caught instanceof TodoError && caught.kind === "notFound") {
        toast.error(message);
        router.replace("/todos");
      } else setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">読み込んでいます…</p>
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">{todoId ? "ToDoを編集" : "ToDoを追加"}</h1>
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="title">タイトル</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例: 牛乳を買う"
            disabled={saving}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="memo">詳細メモ</Label>
          <Textarea
            id="memo"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            disabled={saving}
          />
        </div>
        <div className="grid gap-2">
          <Label>カテゴリ</Label>
          <Select
            value={categoryId === null ? "" : String(categoryId)}
            onValueChange={(value) => setCategoryId(Number(value))}
          >
            <SelectTrigger>
              <SelectValue>
                {(value: string) => categories.find((item) => String(item.id) === value)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>優先度</Label>
          <div className="flex gap-2">
            {(Object.keys(PRIORITY_LABELS) as TodoPriority[]).map((item) => (
              <Button
                key={item}
                type="button"
                variant={priority === item ? "default" : "outline"}
                onClick={() => setPriority(item)}
              >
                {PRIORITY_LABELS[item]}
              </Button>
            ))}
          </div>
        </div>
        <section className="grid gap-3">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={hasDueDate}
              onCheckedChange={(checked) => setHasDueDate(checked === true)}
            />
            期限を設定する
          </label>
          {hasDueDate && (
            <>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={hasDueTime}
                  onCheckedChange={(checked) => setHasDueTime(checked === true)}
                />
                時刻も指定する
              </label>
              {hasDueTime && (
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                />
              )}
            </>
          )}
        </section>
        <div className="grid gap-2">
          <Label>繰り返し</Label>
          <Select
            value={recurrenceType}
            onValueChange={(value) => setRecurrenceType(value as RecurrenceType)}
          >
            <SelectTrigger>
              <SelectValue>{(value: RecurrenceType) => RECURRENCE_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {RECURRENCE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {recurrenceType === "weekly" && (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((label, index) => (
                <label key={label} className="flex items-center gap-1">
                  <Checkbox
                    checked={weekdays.includes(index)}
                    onCheckedChange={() => toggleId(index, weekdays, setWeekdays)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
          {recurrenceType === "monthly" && (
            <Input
              type="number"
              min="1"
              max="31"
              value={monthlyDay}
              onChange={(event) => setMonthlyDay(Number(event.target.value))}
            />
          )}
        </div>
        <section className="grid gap-3">
          <Label>家族（登録ユーザー）</Label>
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-2">
              <Checkbox
                checked={userIds.includes(member.id)}
                onCheckedChange={() => toggleId(member.id, userIds, setUserIds)}
              />
              {member.displayName}
            </label>
          ))}
          <Label>非登録メンバー</Label>
          {unregisteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              非登録メンバーは登録されていません。家族グループ設定から追加できます。
            </p>
          ) : (
            unregisteredMembers.map((member) => (
              <label key={member.id} className="flex items-center gap-2">
                <Checkbox
                  checked={unregisteredMemberIds.includes(member.id)}
                  onCheckedChange={() =>
                    toggleId(member.id, unregisteredMemberIds, setUnregisteredMemberIds)
                  }
                />
                {member.name}（未登録）
              </label>
            ))
          )}
          {unregisteredMemberIds.length > 0 && (
            <div className="grid gap-2">
              <Label>フォロー役</Label>
              <p className="text-sm text-muted-foreground">
                ログインしないメンバーの代わりに通知を受け取る家族を選んでください。
              </p>
              {members.map((member) => (
                <label key={member.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={followerUserIds.includes(member.id)}
                    onCheckedChange={() => toggleId(member.id, followerUserIds, setFollowerUserIds)}
                  />
                  {member.displayName}
                </label>
              ))}
            </div>
          )}
        </section>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
            キャンセル
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "保存中…" : todoId ? "保存する" : "追加する"}
          </Button>
        </div>
      </form>
    </main>
  );
}
