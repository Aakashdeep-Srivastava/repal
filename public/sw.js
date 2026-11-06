/*
 * RePal service worker — makes the app installable and resilient offline.
 *
 * Strategy (kept deliberately conservative so it can never serve stale/broken
 * data):
 *   - Navigations (HTML): network-first, fall back to the last-seen page, then
 *     to a minimal offline notice. Never trap users on a stale shell.
 *   - Same-origin static GET (/_next/static, /icons, images, fonts):
 *     stale-while-revalidate for instant loads that still refresh in the bg.
 *   - Anything under /api/ or any non-GET: passthrough to the network, never
 *     cached (money/auth/data must always be live).
 */
const VERSION = "repal-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(["/icons/icon-192.png", "/icons/icon-512.png"]).catch(() => {}),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    /\.(?:css|js|woff2?|ttf|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // third-party: let the network handle it
  if (url.pathname.startsWith("/api/")) return; // live data only, never cached

  // HTML navigations: network-first with cache fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Offline</title><body style='font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#fff;color:#0b1220'><div style='text-align:center'><h1 style='margin:0 0 .25rem'>You're offline</h1><p style='color:#5b6475'>Reconnect to use RePal.</p></div>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
