/**
 * The calculator, kept on the device.
 *
 * There is no server behind this app — it is a static export — so there is no
 * good reason for it to need the network twice. Everything it fetches is kept,
 * and after one visit it opens with the radio off.
 *
 * The build hashes its own asset names, so a precache list written by hand
 * would be wrong the moment anything changed. Instead: pages are fetched fresh
 * when they can be, so an update lands on the next visit, and hashed assets
 * are served from the cache immediately and refreshed behind the scenes.
 */

const CACHE = "titi-v1";

/**
 * Everything the start page pulls in.
 *
 * The build hashes its own filenames, so the list cannot be written by hand —
 * but the page itself names every one of them, so read it off the page. This
 * matters: the worker takes control only after the visit that installed it,
 * so without this the first offline load would find an empty cache.
 */
async function shellUrls() {
  const urls = new Set(["./", "./manifest.webmanifest"]);
  try {
    const html = await (await fetch("./", { cache: "reload" })).text();
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = new URL(m[1], self.registration.scope);
      if (url.origin === self.location.origin) urls.add(url.href);
    }
  } catch {
    // Offline at install time: the runtime cache will fill in later.
  }
  return [...urls];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = await shellUrls();
      // One bad URL must not fail the whole install, so they go in one by one.
      await Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A page: try the network so a new build is picked up, fall back to what we
  // have — which is the whole point on a plane.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  // Everything else is a hashed asset: serve it at once, refresh behind.
  event.respondWith(
    caches.match(request).then((hit) => {
      const live = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || live;
    }),
  );
});
