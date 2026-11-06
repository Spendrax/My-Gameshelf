'use strict';
// YOUR PHOTOS — cover pictures you take ("From my photos") are kept in the app's offline file storage
// (the "gs-photos" cache, served by sw.js at photos/…), not inside the game list. The game list lives in
// the browser's small 5 MB storage; photos would fill it up fast. A game's cover is then just "photos/…jpg".
// Backups still carry the photos (photoData turns them back into data inside the backup file).

const PHOTOS = 'gs-photos';

// Moves new photos (data: pictures) out of the game list into the photo storage, and forgets unused ones
async function keepPhotos() {
  if (!('caches' in window) || !navigator.serviceWorker?.controller) return; // the offline helper shows them
  const c = await caches.open(PHOTOS);
  let moved = 0;
  for (const g of games) {
    if (!g.cover?.startsWith('data:')) continue;
    const path = `photos/${g.id}-${Date.now().toString(36)}.jpg`;
    await c.put(path, await fetch(g.cover));
    g.cover = path;
    moved++;
  }
  if (moved) store('gr.games', games);
  // photos no game uses any more (replaced or deleted games)
  const used = new Set(games.reduce((a, g) => (g.cover?.startsWith('photos/') ? a.concat(g.cover) : a), []));
  for (const req of await c.keys())
    if (!used.has(new URL(req.url).pathname.replace(/^.*\/photos\//, 'photos/'))) c.delete(req);
}

// A stored photo as data, for backups (empty if it's gone)
async function photoData(path) {
  try {
    const hit = await (await caches.open(PHOTOS)).match(path);
    if (!hit) return '';
    const blob = await hit.blob();
    return await new Promise((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// Ask the phone not to clear the app's storage when space runs low
navigator.storage?.persist?.().catch(() => {});

on('change', () => setTimeout(keepPhotos, 500));
navigator.serviceWorker?.ready.then(() => setTimeout(keepPhotos, 2000));
