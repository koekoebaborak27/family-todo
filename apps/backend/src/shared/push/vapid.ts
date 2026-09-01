import webpush from "web-push";

// Web Push（VAPID）を送るための鍵を、リクエストごとに渡された env から設定する。
// Workers はリクエストのたびに新しい実行コンテキストになりうるため、
// モジュール読み込み時ではなくリクエスト処理の中でこの関数を呼ぶ。
export function configureWebPush(env: {
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}): typeof webpush {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return webpush;
}
