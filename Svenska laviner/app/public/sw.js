// Snöläge's service worker: keeps the app itself for use without coverage,
// and shows push notifications.
//
// Offline without stale versions: page loads always try the network first
// and only fall back to the saved copy when offline (or the network takes
// over six seconds), so a new deploy shows up straight away whenever there
// is a working connection. Built files have
// content hashes in their names, so they can be served from the saved copy.
// The build writes the version and file list below (see vite.config.ts);
// each new build gets a new cache and the old one is deleted. Map tiles
// saved for offline use live in their own caches and are never touched here.

const VERSION = "__APP_VERSION__";
const FILES = ["__APP_FILES__"];
const APP_CACHE = `snolage-app-${VERSION}`;
const APP_PREFIXES = ["snolage-app-", "turkoll-app-", "toppkoll-app-", "fjallkoll-app-"];
/** A page load slower than this opens the saved app instead. */
const NAVIGATION_TIMEOUT_MS = 6000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // In development the placeholders aren't replaced: cache nothing then.
      if (VERSION.startsWith("__")) return;
      const cache = await caches.open(APP_CACHE);
      // One by one, so a single missing file doesn't stop the rest.
      await Promise.all(FILES.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {})));
    })().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (APP_PREFIXES.some((p) => name.startsWith(p)) && name !== APP_CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only the app's own files; the worker API and map tiles are handled in the app.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Any page: fresh from the network, the saved app when offline – or when
    // a weak signal leaves the request hanging (it can for minutes).
    event.respondWith(
      (async () => {
        const network = fetch(request);
        const saved = await caches.match("/", { cacheName: APP_CACHE });
        if (!saved) return network.catch(() => Response.error());
        const slow = new Promise((resolve) => setTimeout(() => resolve(saved), NAVIGATION_TIMEOUT_MS));
        return Promise.race([network.catch(() => saved), slow]);
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    // Hashed file names never change content: the saved copy is always right.
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) (await caches.open(APP_CACHE)).put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // Everything else (icons, manifest): network first, saved copy offline.
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? Response.error()));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Snöläge";
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
