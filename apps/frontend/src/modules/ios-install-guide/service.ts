// バナーを閉じてから再表示するまでの日数。
// 一度閉じたら7日間は表示しない仕様（docs/specs/02_basic-design/family-todo/24_iOSインストール案内.md）のため。
export const HIDE_DAYS_AFTER_CLOSE = 7;

const HIDE_DURATION_MS = HIDE_DAYS_AFTER_CLOSE * 24 * 60 * 60 * 1000;

// User-Agent文字列からiPhone・iPad・iPodかどうかを判定する。
export function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

// iOSインストール案内のバナーを表示するかどうかを判定する。
// iOSのSafariで開いていて、ホーム画面に未追加、かつ「閉じる」を押してから7日以上経っている
// （または一度も閉じていない）ときだけ表示する。
export function shouldShowInstallBanner(params: {
  isIos: boolean;
  isStandalone: boolean;
  dismissedAt: number | null;
  now: number;
}): boolean {
  if (!params.isIos || params.isStandalone) {
    return false;
  }
  if (params.dismissedAt === null) {
    return true;
  }
  return params.now - params.dismissedAt >= HIDE_DURATION_MS;
}
