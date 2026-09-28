/* StoryMind service worker — optional offline cache.
   The app is a single HTML file, so we cache the app shell (this directory's index)
   and serve it offline. API calls to OpenRouter/ModelsLab are always network-only.
   Bump CACHE_VERSION whenever you upload a new build so clients fetch the new file. */
const CACHE_VERSION = "storymind-v406";
const APP_SHELL = ["./", "./index.html"];

/* v144.1 — an install whose shell could not be cached FAILS, instead of succeeding empty. The failure
   used to be swallowed, and activate then deleted the previous cache — so one bad network moment during
   an update left the installed app with no offline copy at all. A failed install keeps the old worker
   and its cache; the browser simply tries again on the next update check. */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Old caches go only once this version's shell is really in place.
    caches.open(CACHE_VERSION).then((c) => c.match("./index.html")).then((have) =>
      have
        ? caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
        : null
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
        // v144.1 — only a good answer is cached: a 404 or 500 page must never replace the app shell.
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => {
        if (r) return r;
        // v144.1 — the app page stands in only for a page navigation, never for a script, image or JSON.
        if (e.request.mode === "navigate") return caches.match("./index.html").then((h) => h || Response.error());
        return Response.error();
      }))
  );
});
