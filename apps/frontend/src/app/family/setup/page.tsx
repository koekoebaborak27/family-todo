import { Suspense } from "react";
import { FamilySetupScreen } from "@/modules/family";

// 家族グループ作成・参加画面（薄いアダプタ）。実装は src/modules/family を参照。
// useSearchParams を使うためSuspenseで包む（Next.jsの要件）。
export default function FamilySetupPage() {
  return (
    <Suspense>
      <FamilySetupScreen />
    </Suspense>
  );
}
