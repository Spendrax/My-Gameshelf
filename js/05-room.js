'use strict';
// THE ROOM — the main wall: filter chips, search/sort, the rack of game cases, and the monitor on the desk
// that shows what you're playing. Redraws itself whenever the games change.
let filter = 'all';

function renderChips() {
  const counts = games.reduce((c, g) => ((c[g.status] = (c[g.status] || 0) + 1), c), {});
  $('#chips').innerHTML = [
    ['all', 'All', games.length],
    ...Object.entries(STATUS).map(([k, s]) => [k, s.label, counts[k] || 0]),
  ].reduce(
    (h, [k, label, n]) =>
      k === 'all' || n
        ? h + `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${label}<i>${n}</i></button>`
        : h,
    '',
  );
}
$('#chips').onclick = (e) => {
  const f = e.target.closest('[data-f]')?.dataset.f;
  if (!f) return;
  filter = f;
  renderRoom();
};

const SORTS = {
  added: (a, b) => (b.added || 0) - (a.added || 0),
  title: (a, b) => a.title.localeCompare(b.title),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  hours: (a, b) => (b.hours || 0) - (a.hours || 0),
};

// The platform list (most games first); only shown once you have games on 2 or more platforms
function renderPlatforms() {
  const count = games.reduce(
    (m, g) => ((m[g.platform || 'Other'] = (m[g.platform || 'Other'] || 0) + 1), m),
    {},
  );
  const names = Object.keys(count).sort((a, b) => count[b] - count[a]);
  const sel = $('#plat');
  const tags = [...new Set(games.flatMap((g) => g.tags || []))].sort();
  sel.parentElement.hidden = names.length < 2 && !tags.length;
  if (!names.includes(sel.value)) sel.value = '';
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">All platforms</option>` +
    names.reduce((h, n) => h + `<option value="${esc(n)}">${esc(n)} (${count[n]})</option>`, '') +
    (tags.length
      ? `<optgroup label="Tags">${tags.reduce((h, t) => h + `<option value="tag:${esc(t)}">🏷 ${esc(t)}</option>`, '')}</optgroup>`
      : '');
  sel.value = cur;
}

function renderRack() {
  const plat = $('#plat').value;
  const q = $('#q').value.trim().toLowerCase();
  const list = games
    .reduce(
      (a, g) =>
        (filter === 'all' || g.status === filter) &&
        (!plat ||
          (plat.startsWith('tag:')
            ? (g.tags || []).includes(plat.slice(4))
            : (g.platform || 'Other') === plat)) &&
        (!q || [g.title, g.platform, ...(g.tags || [])].join(' ').toLowerCase().includes(q))
          ? a.concat(g)
          : a,
      [],
    )
    .sort(SORTS[$('#sort').value]);
  const rack = $('#rack');
  if (!list.length) {
    rack.innerHTML = `<div class="empty">${games.length ? '<b>Nothing here</b>No game matches.' : '<b>Your rack is empty</b>Tap <b style="display:inline">+</b> to add your first game.'}</div><div class="shelf"></div>`;
    return;
  }
  const per = Math.max(3, Math.floor((rack.clientWidth - 24 + 10) / 88));
  const shelves = (l) => {
    let h = '';
    for (let i = 0; i < l.length; i += per)
      h += `<div class="shelf">${l.slice(i, i + per).reduce((s, g) => s + caseHTML(g), '')}</div>`;
    return h;
  };
  // Searching or one filter chosen: just the matching games
  if (q || plat || filter !== 'all') {
    rack.innerHTML = shelves(list);
    return;
  }
  // Everything: one section per status. A folded section is a single shelf you scroll sideways.
  const groups = list.reduce((m, g) => ((m[g.status] = (m[g.status] || []).concat(g)), m), {});
  rack.innerHTML = Object.keys(STATUS).reduce((h, k) => {
    const l = groups[k];
    if (!l) return h;
    const open = rackOpen(k);
    return (
      h +
      `<button class="grp-h" data-g="${k}" aria-expanded="${open}" style="--sc:${STATUS[k].color}"><i></i>${STATUS[k].label}<span>${l.length}</span></button>` +
      (open
        ? shelves(l)
        : `<div class="peek-wrap"><div class="shelf peek">${l.reduce((s, g) => s + caseHTML(g), '')}</div></div>`)
    );
  }, '');
}

// Which sections are open (remembered); Playing and On & off start open
const rackOpen = (k) => (set.rackOpen || {})[k] ?? (k === 'playing' || k === 'onoff');
$('#rack').addEventListener('click', (e) => {
  const b = e.target.closest('.grp-h');
  if (!b) return;
  set.rackOpen = { ...set.rackOpen, [b.dataset.g]: !rackOpen(b.dataset.g) };
  saveSet();
  renderRack();
});

// The monitor cycles through the games you're playing
let screenI = 0;
function renderScreen() {
  const playing = games
    .reduce((a, g) => (g.status === 'playing' ? a.concat(g) : a), [])
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const scr = $('#screen');
  if (!playing.length) {
    const txt = games.length ? 'PICK A GAME' : 'PRESS + TO START';
    if (scr.textContent !== txt) scr.innerHTML = `<div class="idle">${txt}</div>`;
    $('#monitor').dataset.id = '';
    return;
  }
  const g = playing[screenI % playing.length];
  if ($('#monitor').dataset.id === g.id && scr.querySelector('img,.np')) return;
  $('#monitor').dataset.id = g.id;
  const wide = g.screen; // a wide screenshot found for the monitor (see monitorPicture)
  if (!wide && g.cover) monitorPicture(g);
  scr.innerHTML =
    (wide
      ? `<img src="${esc(wide)}" alt="" onerror="this.remove()">`
      : g.cover
        ? // a tall cover: the whole cover in the middle, on a blurred copy of itself
          `<img class="blur" src="${esc(g.cover)}" alt=""><img class="whole" src="${esc(g.cover)}" alt="" onerror="this.remove()">`
        : `<div class="idle" style="animation:none;background:linear-gradient(150deg,hsl(${hue(g.title)} 60% 30%),#000)"></div>`) +
    `<div class="np"><em>▶ NOW PLAYING</em> · ${esc(g.title)}</div>`;
}
// Covers are tall but the monitor is wide: find a wide picture of the game (a screenshot or artwork) once,
// and keep it with the game (g.screen) for next time
const lookedFor = new Set();
// pictures picked by version 3.0 could be an IGDB artwork (often a white logo): look again
games.forEach((g) => /t_screenshot_big\/ar/.test(g.screen || '') && delete g.screen);
async function monitorPicture(g) {
  if (lookedFor.has(g.id)) return;
  lookedFor.add(g.id);
  const tall = /t_cover|library_600x900/;
  const list = (await gamePictures(g)).reduce((a, u, i) => (i > 0 && !tall.test(u) ? a.concat(u) : a), []);
  // IGDB screenshots (ids start with "sc") first: IGDB "artworks" ("ar") are often logos on plain white
  const wide =
    list.find((u) => /\/sc[^/]*\.jpg$/.test(u)) || list.find((u) => !/\/ar[^/]*\.jpg$/.test(u)) || list[0];
  if (!wide || !byId(g.id)) return;
  g.screen = wide;
  store('gr.games', games); // saved quietly: nothing else needs redrawing
  if ($('#monitor').dataset.id === g.id) {
    $('#monitor').dataset.id = '';
    renderScreen();
  }
}
setInterval(() => {
  screenI++;
  renderScreen();
}, 9000);
$('#monitor').onclick = () => {
  const id = $('#monitor').dataset.id;
  if (id) openGame(id);
  else if (!games.length) openAdd();
  else {
    filter = 'backlog';
    renderRoom();
    $('#rack').scrollIntoView({ behavior: 'smooth' });
  }
};

function renderRoom() {
  renderPlatforms();
  renderChips();
  renderRack();
  renderScreen();
}

$('#q').addEventListener('input', renderRack);
$('#sort').onchange = renderRack;
$('#plat').onchange = renderRack;
let rw = 0;
addEventListener('resize', () => {
  if (innerWidth !== rw) {
    rw = innerWidth;
    renderRack();
  }
});

on('change', renderRoom);
renderRoom();
