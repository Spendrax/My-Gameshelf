'use strict';
// TURNING THE WALLS — the three walls stand round a hexagon (120° corners), like Bookshelf.
// Swipe left/right (or tap the dots, or use the arrow keys) to turn:  Goals ← Room → Stats
// `cam` is where you're facing: -1 = Goals, 0 = Room, 1 = Stats (in between while swiping).
const WALLS = { goals: -1, room: 0, stats: 1 };
const wallEls = Object.entries(WALLS).map(([v, k]) => [$('#view-' + v), k]);
let view = 'room',
  cam = 0,
  sw = null,
  swBlock = false;

const hexT = (phi) => {
  const R = innerWidth * 0.866,
    P = R * 1.55;
  return `perspective(${P}px) translateZ(${R}px) rotateY(${phi}deg) translateZ(${-R}px)`;
};
function camSet(c) {
  cam = c;
  wallEls.forEach(([el, k]) => {
    el.style.transform = hexT((c - k) * 60);
    el.style.visibility = Math.abs(k - c) < 1.5 ? '' : 'hidden';
  });
}
function go(k, now) {
  document.body.classList.toggle('snap', !now);
  camSet(k);
  wallEls.forEach(([el, kk]) => {
    el.inert = kk !== k;
    el.classList.toggle('away', kk !== k);
  });
  clearTimeout(go.t);
  go.t = setTimeout(() => document.body.classList.remove('turning'), now ? 0 : 400);
  $$('.dots button').forEach((b) => b.classList.toggle('on', +b.dataset.k === k));
  const v = Object.keys(WALLS).find((w) => WALLS[w] === k);
  if (v !== view) {
    view = v;
    emit('view', v);
  }
}

$('main').addEventListener('pointerdown', (e) => {
  if (sw || e.target.closest('input,select,textarea,.pet,.peek')) return;
  sw = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    on: false,
    c0: WALLS[view],
    v: 0,
    lx: e.clientX,
    lt: performance.now(),
  };
});
addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x,
    dy = e.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
      sw = null;
      return;
    }
    if (!(Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3)) return;
    sw.on = true;
    sw.x = e.clientX;
    clearTimeout(go.t);
    document.body.classList.remove('snap');
    document.body.classList.add('turning');
    wallEls.forEach(([el]) => (el.inert = false));
  }
  const now = performance.now();
  sw.v = (e.clientX - sw.lx) / Math.max(1, now - sw.lt);
  sw.lx = e.clientX;
  sw.lt = now;
  let c = sw.c0 - (e.clientX - sw.x) / innerWidth;
  if (c < -1) c = -1 - Math.min(0.06, (-1 - c) * 0.2);
  else if (c > 1) c = 1 + Math.min(0.06, (c - 1) * 0.2);
  camSet(c);
});
function swEnd(e) {
  if (!sw || e.pointerId !== sw.id) return;
  const s = sw;
  sw = null;
  if (!s.on) return;
  swBlock = true;
  setTimeout(() => (swBlock = false), 80);
  const dc = cam - s.c0,
    dir = Math.sign(dc),
    fast = Math.abs(s.v) > 0.45 && Math.sign(-s.v) === dir;
  go(
    dir && Math.abs(s.c0 + dir) <= 1 && (Math.abs(dc) > 0.22 || (fast && Math.abs(dc) > 0.03))
      ? s.c0 + dir
      : s.c0,
  );
}
addEventListener('pointerup', swEnd);
addEventListener('pointercancel', swEnd);
document.addEventListener(
  'click',
  (e) => {
    if (swBlock) {
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true,
);
$('.dots').onclick = (e) => {
  const k = e.target.dataset.k;
  if (k != null) go(+k);
};
document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))
    return;
  if (e.key === 'ArrowRight' && WALLS[view] < 1) go(WALLS[view] + 1);
  if (e.key === 'ArrowLeft' && WALLS[view] > -1) go(WALLS[view] - 1);
});
addEventListener('resize', () => camSet(cam));

go(0, true);
