// Offline support: network first, cached copy when offline. Only caches this site and Google Fonts — never GitHub API calls.
const CACHE = 'closet-v15';
const CORE = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png',
  './icons/activewear.png', './icons/bags.png', './icons/belts.png', './icons/blazers.png', './icons/bodysuits.png', './icons/cardigans.png', './icons/coats.png', './icons/dresses.png', './icons/footwear.png', './icons/heels.png', './icons/glasses.png', './icons/hats.png', './icons/jackets.png', './icons/jeans.png', './icons/jewelry.png', './icons/jumpsuits.png', './icons/overalls.png', './icons/pants.png', './icons/shorts.png', './icons/skirts.png', './icons/sweaters.png', './icons/hoodies.png', './icons/tops.png', './icons/tanktops.png', './icons/vests.png', './icons/other.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
