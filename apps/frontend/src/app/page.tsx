import { Button } from "@/shared/ui/button";

// 開発環境の起動確認用の仮ページ。画面の実装はここでは行わない。
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">家族 de TODO！</h1>
      <p className="text-sm text-muted-foreground">開発環境の構築中です。</p>
      <Button>ボタンの表示確認</Button>
    </main>
  );
}
