// Fjällkoll's service worker exists only to show push notifications when a
// favourite region's danger level changes. It deliberately has no fetch
// handler and caches nothing, so it can never serve a stale version of the
// site.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Fjällkoll";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Farograden har ändrats i ett av dina områden.",
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: "/icons/icon-192.webp",
      badge: "/icons/icon-96.webp",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin) && "focus" in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
