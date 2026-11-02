'use strict';
// Core: saving games, helpers, the add / search / edit / game card windows, settings and backups.
const VERSION = '1.5';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STATUS = {
  playing:  { label: 'Playing',  color: '#3ef08a' },
  backlog:  { label: 'Backlog',  color: '#8a8fb0' },
  finished: { label: 'Finished', color: '#ffcf4a' },
  dropped:  { label: 'Dropped',  color: '#ff5c7a' },
  wishlist: { label: 'Wishlist', color: '#6ac8ff' },
};
const PLATFORMS = ['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series S/X', 'Xbox One', 'Nintendo Switch', 'Nintendo Switch 2', 'Steam Deck', 'iOS', 'Android', 'Retro'];
// The app's shared RAWG key, so search works right after install. A key pasted in Settings overrides it.
const RAWG_KEY = '';
const rawgKey = () => set.key || RAWG_KEY;
const LEDS = ['#b05cff', '#00e5ff', '#ff3fa4', '#39ff88', '#ffb020', '#ff4646'];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('Storage is full: save a backup and use smaller pictures'); return false; } };

let games = load('gr.games', []);
const set = Object.assign({ pet: 'Byte', led: LEDS[0], key: '', goal: 12 }, load('gr.set', {}));

const listeners = {};
const on = (e, f) => (listeners[e] ??= []).push(f);
const emit = (e, d) => (listeners[e] || []).forEach(f => f(d));
const save = () => { store('gr.games', games); emit('change'); };
const saveSet = () => store('gr.set', set);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const byId = id => games.find(g => g.id === id);
const rand = a => a[Math.floor(Math.random() * a.length)];

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

// Platform colour band on top of each case
function platInfo(p = '') {
  const c = /ps|playstation/i.test(p) ? '#2f6bff' : /xbox/i.test(p) ? '#1f9e45' : /switch|nintendo|wii|3ds|gamecube|game ?boy/i.test(p) ? '#e60012'
    : /pc|steam|windows|mac|linux/i.test(p) ? '#4d5363' : '';
  const s = p.replace(/PlayStation\s*/i, 'PS').replace(/Nintendo\s*/i, '').replace(/Xbox Series S\/X/i, 'Xbox Series').toUpperCase().slice(0, 16) || 'GAME';
  return { c, s };
}

function caseHTML(g, cls = '') {
  const p = platInfo(g.platform);
  return `<button class="case ${cls}" data-id="${g.id}" style="${p.c ? `--pc:${p.c};` : ''}" aria-label="${esc(g.title)}">`
    + `<span class="pb">${esc(p.s)}</span><span class="fb" style="--h:${hue(g.title)}">${esc(g.title)}</span>`
    + (g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" onerror="this.remove()">` : '')
    + `<i class="dot" style="--sc:${STATUS[g.status]?.color || '#888'}"></i></button>`;
}
// Any case anywhere opens its game
document.addEventListener('click', e => {
  const c = e.target.closest('.case[data-id]');
  if (c && !c.closest('#dlgGame')) openGame(c.dataset.id);
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
});
// Tapping the dark backdrop closes a sheet
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

function applyLed() {
  document.documentElement.style.setProperty('--led', set.led);
}

/* ---------- Add: search RAWG ---------- */
const smallImg = u => u && !/\/media\/(resize|crop)\//.test(u) ? u.replace('/media/', '/media/resize/420/-/') : u;

function openAdd() {
  $('#keyBox').hidden = !!rawgKey();
  $('#addQ').value = ''; $('#results').innerHTML = '';
  $('#dlgAdd').showModal();
  if (rawgKey()) $('#addQ').focus();
}
$('#btnAdd').onclick = openAdd;
$('#keySave').onclick = () => {
  const k = $('#keyIn').value.trim(); if (!k) return;
  set.key = k; saveSet(); $('#keyBox').hidden = true; $('#addQ').focus();
};

let searchT, lastResults = [];
const found = new Map(); // remembers searches so the same words don't use another request
$('#addQ').addEventListener('input', e => {
  clearTimeout(searchT);
  const q = e.target.value.trim();
  if (q.length < 3) { $('#results').innerHTML = ''; return; }
  searchT = setTimeout(() => search(q), 700);
});

async function search(q) {
  if (!rawgKey()) { $('#keyBox').hidden = false; return; }
  const box = $('#results'), k = q.toLowerCase();
  box.innerHTML = '<p class="dim">Searching…</p>';
  try {
    if (!found.has(k)) {
      const r = await fetch(`https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey())}&search=${encodeURIComponent(q)}&page_size=10`);
      if (r.status === 401 || r.status === 403) { box.innerHTML = '<p class="dim">The search key doesn\'t work. Check it in Settings, or add the game by hand.</p>'; return; }
      if (r.status === 429) { box.innerHTML = '<p class="dim">Game search is full for this month. Add your own free RAWG key in Settings, or add the game by hand.</p>'; return; }
      found.set(k, (await r.json()).results || []);
    }
    if (q !== $('#addQ').value.trim()) return;
    lastResults = found.get(k);
    box.innerHTML = lastResults.length ? lastResults.reduce((h, g, i) => h + `<button class="res" data-i="${i}">`
      + (g.background_image ? `<img src="${esc(smallImg(g.background_image))}" alt="" loading="lazy">` : '<span class="ph"></span>')
      + `<div><b>${esc(g.name)}</b><span>${esc([(g.released || '').slice(0, 4), (g.platforms || []).slice(0, 3).map(p => p.platform.name).join(', ')].filter(Boolean).join(' · '))}</span></div></button>`, '')
      : '<p class="dim">Nothing found. Try another spelling, or add it by hand.</p>';
  } catch {
    box.innerHTML = '<p class="dim">No connection. You can still add it by hand.</p>';
  }
}

$('#results').addEventListener('click', e => {
  const b = e.target.closest('.res'); if (!b) return;
  const r = lastResults[b.dataset.i];
  const dup = games.find(g => g.rawg === r.id);
  if (dup && !confirm(`"${r.name}" is already on your rack. Add it again (another platform)?`)) return;
  $('#dlgAdd').close();
  const plats = (r.platforms || []).map(p => p.platform.name);
  openEdit({
    title: r.name, cover: smallImg(r.background_image) || '', year: (r.released || '').slice(0, 4),
    genres: (r.genres || []).map(x => x.name), rawg: r.id, platforms: plats, platform: plats.length === 1 ? plats[0] : '',
  });
});
$('#addManual').onclick = () => { const t = $('#addQ').value.trim(); $('#dlgAdd').close(); openEdit({ title: t }); };

/* ---------- Edit form ---------- */
let draft = null;
const form = $('#fEdit');

function openEdit(g) {
  draft = Object.assign({ status: 'backlog', rating: 0, genres: [] }, g);
  const isNew = !draft.id;
  $('#editH').textContent = isNew ? 'New game' : 'Edit game';
  $('#eDel').hidden = isNew;
  for (const k of ['title', 'platform', 'hours', 'year', 'started', 'finished', 'notes']) form.elements[k].value = draft[k] ?? '';
  form.elements.genres.value = (draft.genres || []).join(', ');
  $('#platList').innerHTML = [...new Set([...(draft.platforms || []), ...PLATFORMS])].reduce((h, p) => h + `<option value="${esc(p)}">`, '');
  drawEditBits();
  $('#dlgEdit').showModal();
}

function drawCover() {
  $('#eCover').innerHTML = caseHTML({ ...draft, title: form.elements.title.value || draft.title || '?', platform: form.elements.platform.value, id: '' }, 'big');
}
function drawEditBits() {
  drawCover();
  $('#eStatus').innerHTML = Object.entries(STATUS).reduce((h, [k, s]) =>
    h + `<button type="button" data-s="${k}" style="--sc:${s.color}" class="${draft.status === k ? 'on' : ''}">${s.label}</button>`, '');
  $('#eRate').innerHTML = Array.from({ length: 10 }, (_, i) => `<button type="button" data-r="${i + 1}" aria-label="${i + 1} out of 10" class="${i < draft.rating ? 'on' : ''}"></button>`).join('');
  $('#eRateTxt').textContent = draft.rating ? `${draft.rating}/10` : '';
}
$('#eStatus').onclick = e => {
  const s = e.target.dataset.s; if (!s) return;
  draft.status = s;
  if (s === 'playing' && !form.elements.started.value) form.elements.started.value = today();
  if (s === 'finished' && !form.elements.finished.value) form.elements.finished.value = today();
  drawEditBits();
};
$('#eRate').onclick = e => {
  const r = +e.target.dataset.r; if (!r) return;
  draft.rating = draft.rating === r ? 0 : r; drawEditBits();
};
form.elements.title.addEventListener('change', drawCover);
form.elements.platform.addEventListener('change', drawCover);
$('#eNoCover').onclick = () => { draft.cover = ''; drawCover(); };
$('#eFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  draft.cover = await shrinkImage(f); drawCover();
};

// Crops a picture to the case shape and keeps it small enough for the phone's storage
function shrinkImage(file) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const W = 360, H = 430, c = document.createElement('canvas');
      c.width = W; c.height = H;
      const s = Math.max(W / img.width, H / img.height);
      c.getContext('2d').drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      URL.revokeObjectURL(img.src); res(c.toDataURL('image/jpeg', .78));
    };
    img.src = URL.createObjectURL(file);
  });
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const v = k => form.elements[k].value.trim();
  const wasFinished = draft.id && byId(draft.id)?.status === 'finished';
  const g = {
    ...draft, title: v('title'), platform: v('platform'), hours: Math.max(0, +v('hours') || 0), year: v('year'),
    started: v('started'), finished: v('finished'), notes: v('notes'),
    genres: v('genres').split(',').reduce((a, x) => (x = x.trim()) ? a.concat(x) : a, []), updated: Date.now(),
  };
  delete g.platforms;
  if (!g.title) return;
  const isNew = !g.id;
  if (isNew) { g.id = uid(); g.added = Date.now(); games.unshift(g); }
  else games[games.findIndex(x => x.id === g.id)] = g;
  save();
  $('#dlgEdit').close();
  if (isNew) emit('added', g);
  if (g.status === 'finished' && !wasFinished) emit('finished', g);
  if (!isNew && $('#dlgGame').open) openGame(g.id);
  toast(isNew ? 'On the rack!' : 'Saved');
});
$('#eDel').onclick = () => {
  if (!confirm(`Delete "${draft.title}"?`)) return;
  games = games.filter(g => g.id !== draft.id); save();
  $('#dlgEdit').close(); $('#dlgGame').close(); toast('Deleted');
};

/* ---------- Game card ---------- */
let curId = null;
function openGame(id) {
  const g = byId(id); if (!g) return;
  curId = id;
  const s = STATUS[g.status] || STATUS.backlog;
  const sub = [g.platform, g.year].filter(Boolean).join(' · ');
  const days = g.started && g.finished ? Math.max(1, Math.round((new Date(g.finished) - new Date(g.started)) / 864e5) + 1) : 0;
  $('#gBody').innerHTML = `
    <div class="g-top" style="--img:${g.cover ? `url('${g.cover.replace(/'/g, '%27')}')` : 'none'}">
      <button class="x" data-close aria-label="Close">✕</button>
      ${caseHTML(g, 'big')}
      <div><h2>${esc(g.title)}</h2>${sub ? `<div class="dim">${esc(sub)}</div>` : ''}<span class="pill" style="--sc:${s.color}">${s.label}</span></div>
    </div>
    <div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < g.rating ? 'on' : ''}"></i>`).join('')}</div>
    <div class="facts">
      <div><b>${g.rating ? g.rating + '/10' : '—'}</b><span>Rating</span></div>
      <div><b>${g.hours || 0} h</b><span>Played</span></div>
      <div><b>${days ? days + ' d' : g.finished ? g.finished.slice(0, 4) : g.started ? g.started.slice(5) : '—'}</b><span>${days ? 'To finish' : g.finished ? 'Finished' : 'Started'}</span></div>
    </div>
    ${g.genres?.length ? `<div class="tags">${g.genres.reduce((h, x) => h + `<span>${esc(x)}</span>`, '')}</div>` : ''}
    ${g.notes ? `<div class="notes">${esc(g.notes)}</div>` : ''}
    ${g.rawg ? `<p class="dim small">Game info from <a href="https://rawg.io/games/${+g.rawg}" target="_blank" rel="noopener">RAWG</a></p>` : ''}
    <div class="quick">
      ${g.status !== 'playing' ? '<button class="btn" data-q="playing">▶ Playing</button>' : ''}
      ${g.status !== 'finished' ? '<button class="btn" data-q="finished">🏆 Finished</button>' : ''}
      <button class="btn" data-q="hour">+1 h</button>
    </div>
    <div class="actions"><button class="btn primary" data-q="edit">Edit</button></div>`;
  if (!$('#dlgGame').open) $('#dlgGame').showModal();
}
$('#gBody').addEventListener('click', e => {
  const q = e.target.closest('[data-q]')?.dataset.q; if (!q) return;
  const g = byId(curId); if (!g) return;
  if (q === 'edit') return openEdit(g);
  if (q === 'playing') { g.status = 'playing'; g.started ||= today(); }
  if (q === 'finished') { g.status = 'finished'; g.finished ||= today(); }
  if (q === 'hour') g.hours = (+g.hours || 0) + 1;
  g.updated = Date.now(); save(); openGame(g.id);
  if (q === 'finished') emit('finished', g);
});

/* ---------- Settings & backup ---------- */
$('#btnSettings').onclick = () => {
  $('#sKey').value = set.key; $('#ver').textContent = VERSION;
  $('#dlgSet').showModal();
};
$('#sKey').onchange = e => { set.key = e.target.value.trim(); saveSet(); };
$('#sExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ app: 'my-gameshelf', version: VERSION, saved: new Date().toISOString(), settings: { ...set, key: '' }, games }, null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `gameshelf-backup-${today()}.json` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e4);
  toast('Backup saved');
};
$('#sImport').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const list = Array.isArray(data) ? data : data.games;
    if (!Array.isArray(list)) throw 0;
    const map = new Map(games.map(g => [g.id, g]));
    const n = list.reduce((n, g) => {
      if (!g || !g.title) return n;
      const id = g.id || uid();
      map.set(id, { status: 'backlog', rating: 0, genres: [], ...g, id });
      return n + 1;
    }, 0);
    games = [...map.values()]; save();
    toast(`${n} games loaded`);
  } catch { toast('That file isn\'t a Gameshelf backup'); }
};

applyLed();
