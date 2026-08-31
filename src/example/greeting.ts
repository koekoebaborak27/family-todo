// このファイルはテンプレートの動作確認用サンプル。プロジェクトを始めたら example フォルダごと削除してよい。

// 受け取った名前へのあいさつ文を作る。
// 名前が空文字や空白だけのときは、誰に向けたものか分からない文になるため「ゲスト」で代用する。
export function createGreeting(name: string): string {
  const trimmed = name.trim();
  const target = trimmed === "" ? "ゲスト" : trimmed;
  return `こんにちは、${target}さん`;
}
