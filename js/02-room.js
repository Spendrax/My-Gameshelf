'use strict';
// The room: filter chips, the wall rack of cases, the monitor showing what you're playing, turning the walls.
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

// The three walls stand round a hexagon (120° corners): swipe left/right to turn. Goals ← Room → Stats
const WALLS = { goals: -1, room: 0, stats: 1 };
const wallEls = Object.entries(WALLS).map(([v, k]) => [$('#view-' + v), k]);
let view = 'room', cam = 0, sw = null, swBlock = false;

const hexT = phi => { const R = innerWidth * .866, P = R * 1.55; return `perspective(${P}px) translateZ(${R}px) rotateY(${phi}deg) translateZ(${-R}px)`; };
function camSet(c) {
  cam = c;
  wallEls.forEach(([el, k]) => { el.style.transform = hexT((c - k) * 60); el.style.visibility = Math.abs(k - c) < 1.5 ? '' : 'hidden'; });
}
function go(k) {
  document.body.classList.add('snap');
  camSet(k);
  wallEls.forEach(([el, kk]) => el.inert = kk !== k);
  $$('.dots button').forEach(b => b.classList.toggle('on', +b.dataset.k === k));
  const v = Object.keys(WALLS).find(w => WALLS[w] === k);
  if (v !== view) { view = v; emit('view', v); }
}

$('main').addEventListener('pointerdown', e => {
  if (sw || e.target.closest('input,select,textarea,.pet')) return;
  sw = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, c0: WALLS[view], v: 0, lx: e.clientX, lt: performance.now() };
});
addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
    if (!(Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3)) return;
    sw.on = true; sw.x = e.clientX;
    document.body.classList.remove('snap');
    wallEls.forEach(([el]) => el.inert = false);
  }
  const now = performance.now();
  sw.v = (e.clientX - sw.lx) / Math.max(1, now - sw.lt); sw.lx = e.clientX; sw.lt = now;
  let c = sw.c0 - (e.clientX - sw.x) / innerWidth;
  if (c < -1) c = -1 - Math.min(.06, (-1 - c) * .2);
  else if (c > 1) c = 1 + Math.min(.06, (c - 1) * .2);
  camSet(c);
});
function swEnd(e) {
  if (!sw || e.pointerId !== sw.id) return;
  const s = sw; sw = null;
  if (!s.on) return;
  swBlock = true; setTimeout(() => swBlock = false, 80);
  const dc = cam - s.c0, dir = Math.sign(dc), fast = Math.abs(s.v) > .45 && Math.sign(-s.v) === dir;
  go(dir && Math.abs(s.c0 + dir) <= 1 && (Math.abs(dc) > .22 || (fast && Math.abs(dc) > .03)) ? s.c0 + dir : s.c0);
}
addEventListener('pointerup', swEnd);
addEventListener('pointercancel', swEnd);
document.addEventListener('click', e => { if (swBlock) { e.stopPropagation(); e.preventDefault(); } }, true);
$('.dots').onclick = e => { const k = e.target.dataset.k; if (k != null) go(+k); };
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight' && WALLS[view] < 1) go(WALLS[view] + 1);
  if (e.key === 'ArrowLeft' && WALLS[view] > -1) go(WALLS[view] - 1);
});
addEventListener('resize', () => camSet(cam));

on('change', renderRoom);
renderRoom();
go(0);
