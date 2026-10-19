/* TATA PWA: cache public app shell only. Never cache Supabase/API calls or private data. */
const CACHE_NAME = "tata-transportes-shell-v3";
const BASE = "/tata-control-transportes/";
const APP_SHELL = [
  BASE, BASE+"index.html", BASE+"manifest.webmanifest",
  BASE+"icons/tata-192.png", BASE+"icons/tata-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("tata-transportes-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(BASE+"index.html",copy)));
        }
        return response;
      }).catch(async () => await caches.match(BASE+"index.html") || Response.error())
    );
    return;
  }
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
