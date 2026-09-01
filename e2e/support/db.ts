import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ローカルD1（wrangler dev が使うMiniflare上のsqlite）へ直接SQLを実行するヘルパー。
// テスト用ユーザー・セッションなど、Google OAuthを経由せずには作れないデータの投入・後始末に使う。
// Windowsのシェル解釈（丸括弧の扱い等）を避けるため、--command ではなく一時ファイル経由の --file を使う。

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(here, "../../apps/backend");

type D1ExecResult<T> = Array<{ results: T[]; success: boolean }>;

function runWrangler(sql: string, { json }: { json: boolean }): string {
  const dir = mkdtempSync(path.join(tmpdir(), "family-todo-e2e-sql-"));
  const file = path.join(dir, `${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf-8");

  const args = ["exec", "wrangler", "d1", "execute", "family-todo-db", "--local", `--file=${file}`];
  if (json) {
    args.push("--json");
  }
  return execFileSync("pnpm", args, { cwd: BACKEND_DIR, encoding: "utf-8", shell: true });
}

// SELECTの結果を行の配列で返す。
export function querySql<T = Record<string, unknown>>(sql: string): T[] {
  const output = runWrangler(sql, { json: true });
  const parsed = JSON.parse(output) as D1ExecResult<T>;
  return parsed[0]?.results ?? [];
}

// INSERT / UPDATE / DELETE を実行する（戻り値は使わない）。
export function execSql(sql: string): void {
  runWrangler(sql, { json: false });
}

// SQL文字列リテラルの中でシングルクォートをエスケープする。
export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
