import { Suspense } from "react";
import { OAuthCallbackScreen } from "@/modules/auth";

// Googleの認可コールバック画面（薄いアダプタ）。実装は src/modules/auth を参照。
// useSearchParams を使うためSuspenseで包む（Next.jsの要件）。
export default function AuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackScreen />
    </Suspense>
  );
}
