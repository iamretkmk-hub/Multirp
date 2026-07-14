/* StoryMind service worker — optional offline cache.
   The app is a single HTML file, so we cache the app shell (this directory's index)
   and serve it offline. API calls to OpenRouter/ModelsLab are always network-only.
   Bump CACHE_VERSION whenever you upload a new build so clients fetch the new file. */
const CACHE_VERSION = "storymind-v73";
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache API traffic — always go to network for live model calls.
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;
  // App shell: network-first so a new upload is picked up, falling back to cache offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy).catch(() => {}));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
