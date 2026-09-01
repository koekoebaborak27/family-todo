import { Suspense } from "react";
import { JoinRedirectScreen } from "@/modules/family";

// 招待リンク（/join?code=XXXXXXXX）の入口（薄いアダプタ）。実装は src/modules/family を参照。
// useSearchParams を使うためSuspenseで包む（Next.jsの要件）。
export default function JoinPage() {
  return (
    <Suspense>
      <JoinRedirectScreen />
    </Suspense>
  );
}
