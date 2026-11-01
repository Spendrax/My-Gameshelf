'use strict';
// The room: filter chips, the wall rack of cases, the monitor showing what you're playing, the tabs.
let filter = 'all';

function renderChips() {
  const counts = games.reduce((c, g) => (c[g.status] = (c[g.status] || 0) + 1, c), {});
  $('#chips').innerHTML = [['all', 'All', games.length], ...Object.entries(STATUS).map(([k, s]) => [k, s.label, counts[k] || 0])]
    .reduce((h, [k, label, n]) => k === 'all' || n ? h + `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${label}<i>${n}</i></button>` : h, '');
}
$('#chips').onclick = e => {
  const f = e.target.closest('[data-f]')?.dataset.f; if (!f) return;
  filter = f; renderRoom();
};

const SORTS = {
  added: (a, b) => (b.added || 0) - (a.added || 0),
  title: (a, b) => a.title.localeCompare(b.title),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  hours: (a, b) => (b.hours || 0) - (a.hours || 0),
};

function renderRack() {
  const q = $('#q').value.trim().toLowerCase();
  const list = games.reduce((a, g) => (filter === 'all' || g.status === filter) && (!q || (g.title + ' ' + g.platform).toLowerCase().includes(q)) ? a.concat(g) : a, [])
    .sort(SORTS[$('#sort').value]);
  const rack = $('#rack');
  if (!list.length) {
    rack.innerHTML = `<div class="empty">${games.length ? '<b>Nothing here</b>No game matches.' : '<b>Your rack is empty</b>Tap <b style="display:inline">+</b> to add your first game.'}</div><div class="shelf"></div>`;
    return;
  }
  const per = Math.max(3, Math.floor((rack.clientWidth - 24 + 10) / 88));
  let h = '';
  for (let i = 0; i < list.length; i += per) h += `<div class="shelf">${list.slice(i, i + per).reduce((s, g) => s + caseHTML(g), '')}</div>`;
  rack.innerHTML = h;
}

// The monitor cycles through the games you're playing
let screenI = 0;
function renderScreen() {
  const playing = games.reduce((a, g) => g.status === 'playing' ? a.concat(g) : a, []).sort((a, b) => (b.updated || 0) - (a.updated || 0));
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
  scr.innerHTML = (g.cover ? `<img src="${esc(g.cover)}" alt="" onerror="this.remove()">` : `<div class="idle" style="animation:none;background:linear-gradient(150deg,hsl(${hue(g.title)} 60% 30%),#000)"></div>`)
    + `<div class="np"><em>▶ NOW PLAYING</em> · ${esc(g.title)}</div>`;
}
setInterval(() => { screenI++; renderScreen(); }, 9000);
$('#monitor').onclick = () => {
  const id = $('#monitor').dataset.id;
  if (id) openGame(id);
  else if (!games.length) openAdd();
  else { filter = 'backlog'; renderRoom(); $('#rack').scrollIntoView({ behavior: 'smooth' }); }
};

function renderRoom() { renderChips(); renderRack(); renderScreen(); }

$('#q').addEventListener('input', renderRack);
$('#sort').onchange = renderRack;
let rw = 0;
addEventListener('resize', () => { if (innerWidth !== rw) { rw = innerWidth; renderRack(); } });

// Tabs
let view = 'room';
function showView(v) {
  view = v;
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
  $$('.tabs [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  emit('view', v);
  scrollTo(0, 0);
}
$$('.tabs [data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));

on('change', renderRoom);
renderRoom();
