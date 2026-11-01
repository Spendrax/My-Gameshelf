// Offline copy. Bump V on every release.
const V = 'gs-v1';
const IMG = 'gs-img';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/01-core.js', 'js/02-room.js', 'js/03-pet.js', 'js/04-walls.js', 'js/05-install.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.reduce((a, k) => k !== V && k !== IMG ? a.concat(caches.delete(k)) : a, []))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname === 'api.rawg.io') return;
  if (r.destination === 'image' && u.origin !== location.origin) {
    // covers: keep a copy so the rack works offline
    e.respondWith(caches.open(IMG).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { c.put(r, res.clone()); return res; }))));
    return;
  }
  e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
