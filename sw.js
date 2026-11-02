// Offline copy. Bump V on every release.
const V = 'gs-v11';
const IMG = 'gs-img';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'css/base.css',
  'css/room.css',
  'css/buddy.css',
  'css/walls.css',
  'css/sheets.css',
  'js/01-core.js',
  'js/02-search.js',
  'js/03-edit-form.js',
  'js/04-game-card.js',
  'js/05-room.js',
  'js/06-turning-walls.js',
  'js/07-buddy.js',
  'js/08-stats-goals.js',
  'js/09-customize.js',
  'js/10-settings-backup.js',
  'js/11-install-update.js',
  'js/12-whats-new.js',
  'js/13-scan.js',
];

self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))));
// the page's "Update now" button asks the new version to take over
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
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
