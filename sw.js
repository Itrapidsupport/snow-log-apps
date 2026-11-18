/* Offline shell for Snow Log (multi-company): the app opens with no signal (parking lots, back lanes).
   One worker at /snow-log-apps/sw.js serves every company page /snow-log-apps/<slug>/.
   Pages: network first, cached per company page as fallback. Hashed _next/static assets, fonts and
   company files (t/<slug>/): cache first. Shares the itrapidsupport.github.io origin with other apps:
   only ever touches caches named "snowlog-apps-*". */
const CACHE = "snowlog-apps-v2";
const BASE = "/snow-log-apps";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([`${BASE}/fonts/InstrumentSans-Regular.ttf`, `${BASE}/fonts/InstrumentSans-Medium.ttf`, `${BASE}/fonts/InstrumentSans-SemiBold.ttf`])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("snowlog-apps-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// "/snow-log-apps/acme-snow/anything" -> "/snow-log-apps/acme-snow/"
const pageKey = (p) => { const m = p.slice(BASE.length).match(/^\/([^/]+)\//); return m ? `${BASE}/${m[1]}/` : `${BASE}/`; };
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(`${BASE}/`)) return;
  if (req.mode === "navigate") {
    const key = pageKey(url.pathname);
    e.respondWith(
      fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key).then((hit) => hit || new Response("<h1>Offline</h1><p>Open this app once with signal so it can work offline.</p>", { headers: { "Content-Type": "text/html" } }))),
    );
    return;
  }
  if (["_next", "fonts", "t", "brand"].some((d) => url.pathname.startsWith(`${BASE}/${d}/`))) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
  }
});
// The page tells the worker what it loaded before the worker took control (first visit), so the
// company page and its chunks are cached for the next offline open.
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type !== "warm" || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(d.urls.slice(0, 80).map((u) => {
    try {
      const url = new URL(u, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith(`${BASE}/`)) return null;
      const isPage = !/\.[a-z0-9]+$/i.test(url.pathname);
      const key = isPage ? pageKey(url.pathname) : url.pathname;
      return c.match(key).then((hit) => hit || fetch(isPage ? key : url.href).then((res) => (res.ok ? c.put(key, res) : null)));
    } catch { return null; }
  }).map((p) => (p ? p.catch(() => null) : null)))));
});
