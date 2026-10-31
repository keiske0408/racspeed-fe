// ==============================================================================
// RacSpeed Progressive Web App (PWA) Service Worker
// Enables offline navigation, static asset caching, and rural mission reliability
// ==============================================================================

const CACHE_NAME = "racspeed-cache-v1";
const OFFLINE_URL = "/";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/globals.css"
];

// Install event: Pre-cache static shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Service worker precache skipped missing asset:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up legacy caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "You have a new RacSpeed update." };
  }
  const requestedTarget = new URL(payload.url || "/dashboard", self.location.origin);
  const target = requestedTarget.origin === self.location.origin
    ? requestedTarget.toString()
    : new URL("/dashboard", self.location.origin).toString();
  event.waitUntil(self.registration.showNotification(payload.title || "RacSpeed", {
    body: payload.body || "You have a new club update.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { target },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.target || new URL("/dashboard", self.location.origin).toString();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const windowClient of windows) {
      if ("focus" in windowClient && new URL(windowClient.url).origin === self.location.origin) {
        await windowClient.focus();
        if ("navigate" in windowClient) await windowClient.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

// Fetch event: Network-first with cache fallback for navigation & static files
self.addEventListener("fetch", (event) => {
  // Only handle GET requests (skip mutations, APIs, and auth tokens)
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip Next.js internal runtime, static chunks, and API routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for offline access
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Return cached version if network is offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If request is navigation, serve fallback offline shell
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});
