'use strict';
// ADD A GAME — the + button opens a sheet that searches the RAWG game database.
// Picking a result opens the edit form already filled in; 'Add it by hand' opens it empty.

const smallImg = (u) =>
  u && !/\/media\/(resize|crop)\//.test(u) ? u.replace('/media/', '/media/resize/420/-/') : u;

// Set by a scan (13-scan.js) when the case shows the platform, e.g. PS5
let scanPlatform = '';

function openAdd() {
  scanPlatform = '';
  $('#keyBox').hidden = !!rawgKey();
  $('#addQ').value = '';
  $('#results').innerHTML = '';
  $('#dlgAdd').showModal();
  if (rawgKey()) $('#addQ').focus();
}
$('#btnAdd').onclick = openAdd;
$('#keySave').onclick = () => {
  const k = $('#keyIn').value.trim();
  if (!k) return;
  set.key = k;
  saveSet();
  $('#keyBox').hidden = true;
  $('#addQ').focus();
};

let searchT,
  lastResults = [];
const found = new Map(); // remembers searches so the same words don't use another request
$('#addQ').addEventListener('input', (e) => {
  clearTimeout(searchT);
  const q = e.target.value.trim();
  if (q.length < 3) {
    $('#results').innerHTML = '';
    return;
  }
  searchT = setTimeout(() => search(q), 450);
});

// Game search. First your Cloudflare helper (HELPER/search): it asks IGDB, then RAWG, then the Steam store.
// If the helper can't be reached, RAWG straight from the phone (skipped for 10 minutes after it fails).
// Returns { results } or { error: 'key' | 'full' | 'helper' | 'offline' }.
let rawgDownUntil = 0;
async function findGames(q) {
  let helperOld = false;
  try {
    const r = await fetch(
      `${HELPER}/search?key=${encodeURIComponent(rawgKey())}&q=${encodeURIComponent(q)}`,
      {
        signal: AbortSignal.timeout(9000),
      },
    );
    const d = r.ok ? await r.json() : {};
    if (Array.isArray(d.results) && (d.results.length || d.source)) return { results: d.results };
    helperOld = r.ok; // an older helper that doesn't know /search yet
  } catch {}
  if (Date.now() > rawgDownUntil) {
    try {
      const r = await fetch(
        `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey())}&search=${encodeURIComponent(q)}&page_size=10`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (r.status === 401 || r.status === 403) return { error: 'key' };
      if (r.status === 429) return { error: 'full' };
      if (r.ok) return { results: (await r.json()).results || [] };
    } catch {
      rawgDownUntil = Date.now() + 10 * 60e3;
    }
  }
  return { error: helperOld ? 'helper' : 'offline' };
}
const SEARCH_ERRORS = {
  key: "The search key doesn't work. Check it in Settings, or add the game by hand.",
  full: 'Game search is full for this month. Add your own free RAWG key in Settings, or add the game by hand.',
  helper:
    'Game search needs the newest Cloudflare helper code. Paste it into Cloudflare (tools/cloudflare-helper.js) and Deploy, or add the game by hand.',
  offline: "Game search isn't answering right now. Try again in a moment, or add the game by hand.",
};

async function search(q) {
  if (!rawgKey()) {
    $('#keyBox').hidden = false;
    return;
  }
  const box = $('#results'),
    k = q.toLowerCase();
  box.innerHTML = '<p class="dim">Searching…</p>';
  try {
    if (!found.has(k)) {
      const d = await findGames(q);
      if (d.error) {
        if (q === $('#addQ').value.trim()) box.innerHTML = `<p class="dim">${SEARCH_ERRORS[d.error]}</p>`;
        return;
      }
      found.set(k, d.results);
    }
    if (q !== $('#addQ').value.trim()) return;
    lastResults = found.get(k);
    box.innerHTML = lastResults.length
      ? lastResults.reduce(
          (h, g, i) =>
            h +
            `<button class="res" data-i="${i}">` +
            (g.background_image
              ? `<img src="${esc(smallImg(g.background_image))}" alt="" loading="lazy">`
              : '<span class="ph"></span>') +
            `<div><b>${esc(g.name)}</b><span>${esc(
              [
                (g.released || '').slice(0, 4),
                (g.platforms || [])
                  .slice(0, 3)
                  .map((p) => p.platform.name)
                  .join(', '),
              ]
                .filter(Boolean)
                .join(' · '),
            )}</span></div></button>`,
          '',
        )
      : '<p class="dim">Nothing found. Try another spelling, or add it by hand.</p>';
  } catch {
    box.innerHTML = '<p class="dim">No connection. You can still add it by hand.</p>';
  }
}

$('#results').addEventListener('click', (e) => {
  const b = e.target.closest('.res');
  if (!b) return;
  const r = lastResults[b.dataset.i];
  const dup = games.find(
    (g) => (r.id && g.rawg === r.id) || (r.igdb && g.igdb === r.igdb) || (r.steam && g.steam === r.steam),
  );
  if (dup && !confirm(`"${r.name}" is already on your rack. Add it again (another platform)?`)) return;
  $('#dlgAdd').close();
  const plats = (r.platforms || []).map((p) => p.platform.name);
  openEdit({
    title: r.name,
    cover: smallImg(r.background_image) || '',
    year: (r.released || '').slice(0, 4),
    genres: (r.genres || []).map((x) => x.name),
    rawg: r.id || undefined,
    igdb: r.igdb, // results from IGDB or the Steam store (when RAWG is down)
    steam: r.steam,
    platforms: plats,
    platform: scanPlatform || (plats.length === 1 ? plats[0] : ''),
  });
});
$('#addManual').onclick = () => {
  const t = $('#addQ').value.trim();
  $('#dlgAdd').close();
  openEdit({ title: t });
};

// A title as databases know it: "Star Wars: Battlefront 2 (Classic, 2005)™" → "Star Wars: Battlefront 2"
const plainTitle = (t) =>
  t
    .replace(/\(.*?\)|\[.*?\]|[\u2122\u00AE\u00A9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || t;

// Every picture we can find for a game (for its cover in the edit form): its cover, Steam's
// poster art, IGDB's box art, artwork and screenshots, and RAWG's
const imgCache = new Map();
async function gamePictures(g) {
  const key = g.id || g.title; // a game being added has no id yet
  if (imgCache.has(key)) return imgCache.get(key);
  const list = [g.cover];
  if (g.steam) {
    const s = `https://cdn.akamai.steamstatic.com/steam/apps/${g.steam}`;
    list.push(`${s}/library_600x900.jpg`, `${s}/library_hero.jpg`, `${s}/header.jpg`);
  }
  // IGDB (through your helper): box art, artwork, screenshots
  try {
    const q = g.igdb ? `igdb=${g.igdb}` : `q=${encodeURIComponent(plainTitle(g.title))}`;
    const d = await fetch(`${HELPER}/pictures?${q}`, { signal: AbortSignal.timeout(8000) }).then((r) =>
      r.json(),
    );
    list.push(...(d.pictures || []));
  } catch {}
  // RAWG: more artwork and screenshots
  try {
    const api = (path, extra = '') =>
      fetch(`https://api.rawg.io/api/${path}?key=${encodeURIComponent(rawgKey())}${extra}`, {
        signal: AbortSignal.timeout(5000),
      }).then((r) => r.json());
    // games added by hand have no RAWG id: look the title up once
    const id =
      g.rawg || (await api('games', `&page_size=1&search=${encodeURIComponent(plainTitle(g.title))}`)).results?.[0]?.id;
    if (id) {
      const [info, shots] = await Promise.all([api(`games/${id}`), api(`games/${id}/screenshots`)]);
      list.push(
        info.background_image,
        info.background_image_additional,
        ...(shots.results || []).map((r) => r.image),
      );
    }
  } catch {} // offline: just the cover (and Steam art)
  const unique = [...new Set(list.reduce((a, u) => (u ? a.concat(smallImg(u)) : a), []))];
  imgCache.set(key, unique);
  return unique;
}
