// Web Push を受け取るための最小限のサービスワーカー。
// 通知の内容（テンプレート・遷移先）は画面実装時に詰める。ここでは受信と表示・クリック時の遷移だけを扱う。

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? "家族 de TODO！";
  const options = {
    body: data.body ?? "",
    data: { url: data.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
