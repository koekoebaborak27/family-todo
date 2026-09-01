const DISMISSED_AT_KEY = "ios-install-guide-dismissed-at";

// バナーを閉じた日時（ミリ秒）を端末に保存する。
// プライベートブラウズ等で保存領域が使えない場合は何もしない。次に開いたときにバナーが再び出るだけとして扱う仕様のため。
export function saveDismissedAt(timestampMs: number): void {
  try {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(timestampMs));
  } catch {
    // 保存できなくてもエラーにはしない。
  }
}

// バナーを閉じた日時（ミリ秒）を端末から読み込む。保存されていない・読み込めない場合はnullを返す。
export function loadDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISSED_AT_KEY);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
