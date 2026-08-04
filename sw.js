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
const VERSION = 'v6';
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
    // Deadlined and individually caught: install must ALWAYS complete. A stuck
    // install leaves a worker that never activates and a cache that stays empty,
    // which is precisely how the Home Screen app ended up unopenable.
    await Promise.allSettled(CRITICAL.concat(OPTIONAL).map(async u => {
      const res = await fetchDeadline(new Request(u, { cache: 'reload' }));
      if (res && res.ok) await c.put(u, res);
    }));
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
    const res = await fetchDeadline(req);          // deadline here too — see below
    if (res) return safeForNavigation(res);
    if (isNav) return offlinePage();
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// Every fetch this worker makes MUST have a deadline.
//
// This is the bug that made the Home Screen app unopenable: a bare fetch() here
// meant respondWith() could stay pending forever, and a navigation whose
// respondWith never settles doesn't fail — it HANGS, which Safari eventually
// reports as "the server stopped responding". It bit exactly when the cache was
// empty (older versions used an all-or-nothing addAll, so one failed font left
// nothing cached), and then every launch took the hanging path, wifi included.
// A page that can't load also can't update the worker, so it stayed broken.
//
// 10s: long enough for a slow-but-alive network, short enough to fall through
// to something useful. Timing out here is cheap — the app has its own snapshot.
function fetchDeadline(req, ms = 10000) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => finish(null), ms);
    fetch(req).then(finish, () => finish(null));
  });
}

async function swr(req, isNav) {
  const cache  = await caches.open(CACHE);
  // For a navigation, ANY cached shell will do — the Home Screen app may launch
  // a URL that never got cached under that exact key (see the redirect note in
  // safeForNavigation below), and answering it with index.html is always right
  // for a single-page app.
  const cached = (await cache.match(req, { ignoreSearch: true }))
    || (isNav ? await cache.match('./index.html') || await cache.match('./') : null);

  const fresh = fetchDeadline(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; });

  if (cached) return isNav ? safeForNavigation(cached) : cached;

  const res = await fresh;
  if (res) return isNav ? safeForNavigation(res) : res;

  // Nothing cached and the network didn't answer in time. A navigation must get
  // real HTML — a text/plain 503 renders as raw text with no way out — so hand
  // back a minimal page that can retry on its own.
  if (isNav) return offlinePage();
  return new Response('Sin conexión', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// Self-contained: no CSS, no fonts, no cached assets. Whatever is broken, this
// renders. Deliberately NO auto-reload — an earlier version retried every 5s and
// each retry costs a 10s network deadline, so an offline phone would sit in a
// flashing reload loop burning battery and never settling. A button the user
// taps is predictable; the loop was not.
function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>De Dos</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;
background:#0C0806;color:#F5E9E2;font:15px/1.6 -apple-system,system-ui,sans-serif;text-align:center">
<div style="padding:24px">
  <div style="font-size:34px">📴</div>
  <h1 style="font-size:17px;margin:12px 0 6px">Sin conexión</h1>
  <p style="margin:0 0 18px;opacity:.7;font-size:13px">No se pudo contactar el servidor.</p>
  <button onclick="location.reload()" style="padding:11px 22px;border-radius:10px;border:0;
    background:#E0855A;color:#1a0f0a;font-size:14px;font-weight:700">Reintentar</button>
</div>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
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
