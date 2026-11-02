'use strict';
// ADD A GAME — the + button opens a sheet that searches the RAWG game database.
// Picking a result opens the edit form already filled in; 'Add it by hand' opens it empty.

const smallImg = (u) =>
  u && !/\/media\/(resize|crop)\//.test(u) ? u.replace('/media/', '/media/resize/420/-/') : u;

function openAdd() {
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
  searchT = setTimeout(() => search(q), 700);
});

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
      const r = await fetch(
        `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey())}&search=${encodeURIComponent(q)}&page_size=10`,
      );
      if (r.status === 401 || r.status === 403) {
        box.innerHTML =
          '<p class="dim">The search key doesn\'t work. Check it in Settings, or add the game by hand.</p>';
        return;
      }
      if (r.status === 429) {
        box.innerHTML =
          '<p class="dim">Game search is full for this month. Add your own free RAWG key in Settings, or add the game by hand.</p>';
        return;
      }
      found.set(k, (await r.json()).results || []);
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
  const dup = games.find((g) => g.rawg === r.id);
  if (dup && !confirm(`"${r.name}" is already on your rack. Add it again (another platform)?`)) return;
  $('#dlgAdd').close();
  const plats = (r.platforms || []).map((p) => p.platform.name);
  openEdit({
    title: r.name,
    cover: smallImg(r.background_image) || '',
    year: (r.released || '').slice(0, 4),
    genres: (r.genres || []).map((x) => x.name),
    rawg: r.id,
    platforms: plats,
    platform: plats.length === 1 ? plats[0] : '',
  });
});
$('#addManual').onclick = () => {
  const t = $('#addQ').value.trim();
  $('#dlgAdd').close();
  openEdit({ title: t });
};
