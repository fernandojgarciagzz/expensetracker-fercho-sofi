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
const VERSION = 'v5';
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
  // A rejected respondWith() kills the navigation outright — another blank
  // screen, and this time one the user can't even reload out of. Whatever goes
  // wrong in here, fall back to a plain network fetch.
  try {
    return await swr(req, isNav);
  } catch (_) {
    try { return safeForNavigation(await fetch(req)); }
    catch (__) {
      return new Response('Sin conexión', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
}

async function swr(req, isNav) {
  const cache  = await caches.open(CACHE);
  // For a navigation, ANY cached shell will do — the Home Screen app may launch
  // a URL that never got cached under that exact key (see the redirect note in
  // safeForNavigation below), and answering it with index.html is always right
  // for a single-page app.
  const cached = (await cache.match(req, { ignoreSearch: true }))
    || (isNav ? await cache.match('./index.html') || await cache.match('./') : null);

  const fresh = fetch(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);

  if (cached) return isNav ? safeForNavigation(cached) : cached;

  const res = await fresh;
  if (res) return isNav ? safeForNavigation(res) : res;

  // Offline and nothing cached at all.
  return new Response('Sin conexión', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// Handing a REDIRECTED response back to a navigation is a hard error in every
// browser ("a redirected response was used for a navigation request") and the
// result is a blank white screen with nothing in the UI to explain it.
//
// This is how it bit us: GitHub Pages 301s the no-trailing-slash URL
// (/expensetracker-fercho-sofi -> /expensetracker-fercho-sofi/), and iOS stores
// whatever URL was on screen when you tapped "Agregar a inicio". So a Home
// Screen app launched at the no-slash form got a redirected response — blank —
// while Safari, opened on the slash form, was fine. Same site, same worker.
//
// Rebuilding the Response from its body drops the redirect flag; the bytes are
// identical.
function safeForNavigation(res) {
  if (!res || !res.redirected) return res;
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
