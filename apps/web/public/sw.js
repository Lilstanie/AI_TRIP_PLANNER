// Service worker for the installed app. Planning needs the network, so nothing dynamic is
// cached: page navigations go to the network and fall back to a static offline page, the offline
// page's own files come from the cache, and every other request (API calls, streams, Clerk) is
// left to the browser untouched.
const CACHE = "trip-planner-shell-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached ?? fetch(event.request)));
    return;
  }
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match("/offline.html").then((page) => page ?? Response.error()),
    ),
  );
});
