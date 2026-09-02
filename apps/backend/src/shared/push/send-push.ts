import type webpush from "web-push";

// Web Push を1件送った結果。
// sent = 送信できた / expired = 購読が失効していた / failed = それ以外の失敗。
export type PushSendResult = "sent" | "expired" | "failed";

// 購読が失効したことを表すHTTPステータス。この2つが返った購読は保存しておいても届かないため削除する
// （docs/specs/03_detail-design/family-todo/20_通知バッチ処理.md「Push送信失敗時の扱い」）。
const EXPIRED_STATUS_CODES = [404, 410];

// 通知の中身。ブラウザ側のサービスワーカー（apps/frontend/public/sw.js）が読む形に合わせる。
export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// 1つの購読へWeb Pushを送り、結果を3種類に分けて返す。
// 1件の送信失敗でバッチ全体を止めないため、業務コードでは書かない例外の受け止めをここだけで行う。
export async function sendPushNotification(
  client: typeof webpush,
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<PushSendResult> {
  try {
    await client.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (error) {
    // web-push は送信先から返ったHTTPステータスを statusCode として持つ例外を投げる。
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode !== undefined && EXPIRED_STATUS_CODES.includes(statusCode)) {
      return "expired";
    }
    return "failed";
  }
}
