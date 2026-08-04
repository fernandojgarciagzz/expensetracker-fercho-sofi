/* De Dos — service worker.
 *
 * Without this the app is a plain web page: GitHub Pages only lets the browser
 * keep index.html for 10 minutes (cache-control: max-age=600), so every cold
 * launch after that has to re-download 100+ KB before anything paints. On wifi
 * that's invisible; on a weak cellular link it's a blank screen.
 *
 * Here we keep our own copy of the app shell forever and serve it first, then
 * refresh it in the background. The app opens instantly, always — even with the
 * radio off. Fresh data still needs the network; that's what the outbox in
 * index.html is for.
 *
 * BUMP `VERSION` whenever index.html changes, otherwise phones keep serving the
 * old shell until their background refresh happens to land.
 */
const VERSION = 'v4';
const CACHE   = 'dedos-' + VERSION;

// Split deliberately, because addAll() is all-or-nothing: ONE slow or failing
// entry and the whole install rejects, leaving nothing cached — the exact
// scenario this worker exists to survive. So the app itself is required, and
// everything cosmetic is best-effort.
const CRITICAL = ['./', './index.html'];                 // enough to boot offline
const OPTIONAL = [                                       // nice to have; never blocks install
  './icon.png', './manifest.json',
  './fonts/fraunces.woff2', './fonts/sora.woff2', './fonts/jetbrains-mono.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CRITICAL);                            // must succeed
    // allSettled, not all: a font that hangs or 404s must not abort the install.
    // Whatever misses here gets picked up later by the fetch handler.
    await Promise.allSettled(OPTIONAL.map(u => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // POSTs (Apps Script writes) must never be intercepted — they go straight out
  // and the app queues them itself if they fail.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // App shell: serve the cached copy immediately, update it in the background.
  if (req.mode === 'navigate' || url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req, req.mode === 'navigate'));
    return;
  }

  // Apps Script reads and frankfurter.app: network only. Stale money is worse
  // than no money — index.html keeps its own last-good snapshot instead.
  // (Fonts used to need a rule here; they're same-origin now and handled above.)
});

async function staleWhileRevalidate(req, isNav) {
  const cache  = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  const fresh = fetch(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);

  if (cached) return cached;

  const res = await fresh;
  if (res) return res;

  // Offline and this exact URL was never cached — a navigation can still be
  // answered with the shell (e.g. launched with a ?query the cache never saw).
  if (isNav) {
    const shell = (await cache.match('./index.html')) || (await cache.match('./'));
    if (shell) return shell;
  }
  return new Response('Sin conexión', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
