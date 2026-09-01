import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// docs/skills/playwright-evidence-test.md「エビデンス保存の命名規則」のとおり、
// docs/test/unit/result/<ドメイン>/テスト結果<仕様書のファイル名>/ に固定する。
const RESULT_ROOT = path.resolve(here, "../../docs/test/unit/result");

export function evidenceDir(domain: string, specFileNameWithoutExt: string): string {
  const dir = path.join(RESULT_ROOT, domain, `テスト結果${specFileNameWithoutExt}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// 3桁連番_説明.png の形式でスクリーンショットのパスを組み立てる。
export function screenshotPath(dir: string, seq: number, label: string): string {
  const no = String(seq).padStart(3, "0");
  return path.join(dir, `${no}_${label}.png`);
}
