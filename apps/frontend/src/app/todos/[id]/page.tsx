import { TodoDetailScreen } from "@/modules/todo";

// ToDo詳細画面の薄い入口。URLのIDを数値に変換してモジュールへ渡す。
export default async function TodoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TodoDetailScreen todoId={Number(id)} />;
}
