/* Woven service worker (gap 16). Keeps the dashboard's shell so it opens
   without the network and shows the household's own notifications (gap 17).
   It never caches anything under /v1/: the Core's answers are always live. */
const SHELL = "woven-shell-v1";
const ASSETS = "woven-assets-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/offline", "/dashboard", "/dashboard/core"]).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/share")) return; // live, always
  if (url.pathname.startsWith("/_next/static/")) {
    // Hashed assets: cache first, forever.
    event.respondWith(caches.open(ASSETS).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => (r.ok ? (c.put(req, r.clone()), r) : r))));
    return;
  }
  if (req.headers.get("accept")?.includes("text/html")) {
    // Pages: network first, the shell when there is none.
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(SHELL).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match("/offline")) ?? Response.error()),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Woven", body: "Something needs a look.", url: "/dashboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/apple-icon", badge: "/icon", data: { url: data.url }, tag: data.tag || undefined }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => "focus" in c);
      if (open) return open.navigate ? open.navigate(url).then((c) => c && c.focus()) : open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
