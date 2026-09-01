import { TodoFormScreen } from "@/modules/todo";

// ToDo編集画面の薄い入口。URLのIDを数値に変換してモジュールへ渡す。
export default async function EditTodoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TodoFormScreen todoId={Number(id)} />;
}
