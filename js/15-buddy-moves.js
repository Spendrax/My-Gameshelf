'use strict';
// HOW THE BUDDY MOVES — he can stand on anything flat: shelves, the monitor, the desk, the floor, the trophy shelf,
// the screens and LED panels, the beanbag, the corkboard, the bed and the nightstand.
// He walks along a surface and jumps between surfaces, and walks off the side of a floor onto the next wall.
// You can drag him anywhere (he falls onto whatever is below), and tapping a food bowl calls him to it.
//
// Positions are in "wall coordinates": pixels from the top-left of the wall's content, so they scroll with it.
// pet.x / pet.y is the point between his feet.

/* ---------- Where he can stand ---------- */

// For each wall: [what to look for, which edge of it is walkable → [left x, right x, y]]
const topEdge = (b) => [b.x + 6, b.x + b.w - 6, b.y];
const SURFACES = {
  room: [
    ['.window', (b) => [b.x - 4, b.x + b.w + 4, b.y + b.h]], // the windowsill
    ['.shelf', (b) => [b.x + 12, b.x + b.w - 12, b.y + b.h]], // the board under the cases
    ['.monitor', topEdge],
    ['.desk', (b) => [b.x + 4, b.x + b.w - 4, b.y + 8]],
    ['.floor', (b) => [0, b.w, b.y + 34]],
  ],
  stats: [
    ['.trophies', (b) => [b.x, b.x + b.w, b.y + b.h - 8]],
    ['.kpi', topEdge],
    ['.card', topEdge],
    ['.beanbag', (b) => [b.x + 22, b.x + b.w - 22, b.y + 16]],
    ['.floor', (b) => [0, b.w, b.y + 34]],
  ],
  ach: [
    ['.ach-shelf', (b) => [b.x + 12, b.x + b.w - 12, b.y + b.h]], // the cabinet shelves
    ['.floor', (b) => [0, b.w, b.y + 34]],
  ],
  goals: [
    ['.board', topEdge],
    ['.board .card', topEdge],
    // the bed has three heights: pillow, mattress, blanket (he sinks in a little)
    ['.bed .pillow', (b) => [b.x + 4, b.x + b.w - 4, b.y + 6]],
    ['.bed .mattress', (b) => [b.x + 4, b.x + (b.w + 10) * 0.34 - 4, b.y + 2]], // only the bit between pillow and blanket
    ['.bed .blanket', (b) => [b.x + 6, b.x + b.w - 2, b.y + 3]],
    ['.floor', (b) => [0, b.w, b.y + 34]],
  ],
};
// Which wall is through the left / right edge of each floor (Goals ← Room → Stats)
const NEXT_WALL = {
  room: { left: 'goals', right: 'stats' },
  stats: { left: 'room' },
  goals: { left: 'ach', right: 'room' },
  ach: { right: 'goals' },
};

const wallOf = (name) => $('#view-' + name);

// An element's box inside its wall, measured from the layout so the wall's 3D turn doesn't affect it
function box(el, wall) {
  let x = 0;
  let y = 0;
  for (let e = el; e !== wall; e = e.offsetParent) {
    if (!e) return null; // not shown
    x += e.offsetLeft;
    y += e.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

// Every walkable surface on every wall, measured fresh (the shelves move when games are added)
function surfaces() {
  return Object.entries(SURFACES).reduce((all, [name, list]) => {
    const wall = wallOf(name);
    for (const [sel, edge] of list) {
      for (const el of wall.querySelectorAll(sel)) {
        const b = box(el, wall);
        if (!b || !b.w) continue;
        const [x0, x1, y] = edge(b);
        all.push({ wall: name, sel, x0, x1, y, floor: sel === '.floor' });
      }
    }
    return all;
  }, []);
}

// The surface he's standing on, or the first one below the point (the floor if nothing else)
function surfaceBelow(S, wall, x, y) {
  return (
    S.reduce(
      (best, s) =>
        s.wall === wall && x >= s.x0 - 4 && x <= s.x1 + 4 && s.y >= y - 6 && (!best || s.y < best.y)
          ? s
          : best,
      null,
    ) || S.find((s) => s.wall === wall && s.floor)
  );
}

/* ---------- Finding a way there ---------- */

const MAX_JUMP_UP = 250; // px; anything higher he climbs up the side of. Jumping down has no limit

function canJump(a, b) {
  const overlap = Math.min(a.x1, b.x1 + 40) - Math.max(a.x0, b.x0 - 40);
  return a !== b && a.wall === b.wall && overlap > 0;
}
function crossesTo(a, b) {
  return a.floor && b.floor && Object.values(NEXT_WALL[a.wall]).includes(b.wall);
}

// Shortest list of surfaces from `from` to `to` (breadth-first search)
function route(S, from, to) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const s = queue.shift();
    if (s === to) break;
    for (const n of S) {
      if (!prev.has(n) && (canJump(s, n) || crossesTo(s, n))) {
        prev.set(n, s);
        queue.push(n);
      }
    }
  }
  if (!prev.has(to)) return null;
  const path = [];
  for (let s = to; s; s = prev.get(s)) path.unshift(s);
  return path;
}

/* ---------- Moving ---------- */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Puts him at a point on a wall (moving his element into that wall if needed)
function put(wall, x, y) {
  const w = wallOf(wall);
  if (pet.el.parentElement !== w) w.append(pet.el);
  pet.wall = wall;
  pet.x = x;
  pet.y = y;
  pet.el.style.transform = `translate(${x - 27}px, ${y - 50}px)`; // -50, not -54: his feet touch the surface
}
const face = (left) => pet.el.classList.toggle('flip', left);

// Runs step(t) from t=0 to 1 over `ms`; stops early (false) if a newer move started
function animate(ms, step, job) {
  return new Promise((done) => {
    const t0 = performance.now();
    const frame = (now) => {
      if (job !== pet.job) return done(false);
      const t = Math.min(1, (now - t0) / ms);
      step(t);
      if (t < 1) requestAnimationFrame(frame);
      else done(true);
    };
    requestAnimationFrame(frame);
  });
}

async function walk(x, job) {
  const x0 = pet.x;
  const d = x - x0;
  if (Math.abs(d) < 1) return true;
  face(d < 0);
  pet.el.classList.add('walk');
  const ok = await animate((Math.abs(d) / 90) * 1000, (t) => put(pet.wall, x0 + d * t, pet.y), job);
  pet.el.classList.remove('walk');
  return ok;
}

// A jump is an arc: higher when jumping up, a little hop when jumping down
async function jump(x, y, job) {
  const x0 = pet.x;
  const y0 = pet.y;
  const h = y0 > y ? y0 - y + 28 : 18;
  if (Math.abs(x - x0) > 2) face(x < x0);
  return animate(
    380 + Math.min(500, Math.abs(y - y0) * 0.8),
    (t) => put(pet.wall, x0 + (x - x0) * t, y0 + (y - y0) * t - h * 4 * t * (1 - t)),
    job,
  );
}

// Too high to jump: he walks to the nearest side of `b`, climbs straight up it, and steps on top
async function climb(a, b, job) {
  const left = Math.abs(pet.x - b.x0) < Math.abs(pet.x - b.x1);
  const ex = clamp(left ? b.x0 - 6 : b.x1 + 6, a.x0 + 10, a.x1 - 10);
  if (!(await walk(ex, job))) return false;
  const y0 = pet.y;
  face(!left);
  pet.el.classList.add('climb');
  const ok = await animate(((y0 - b.y) / 160) * 1000, (t) => put(pet.wall, ex, y0 + (b.y + 4 - y0) * t), job);
  pet.el.classList.remove('climb');
  return ok && jump(clamp(left ? b.x0 + 18 : b.x1 - 18, b.x0, b.x1), b.y, job);
}

// Walks and jumps to point x on surface `to`, even on another wall. Resolves true when he got there.
async function travel(to, x) {
  const job = ++pet.job;
  const S = surfaces();
  const from = surfaceBelow(S, pet.wall, pet.x, pet.y);
  // `to` came from an older measurement: use the matching surface from this one
  to =
    S.find(
      (s) =>
        s.wall === to.wall && s.floor === to.floor && Math.abs(s.y - to.y) < 3 && Math.abs(s.x0 - to.x0) < 3,
    ) || to;
  const path = route(S, from, to);
  if (!path) return false;
  pet.moving = true;
  try {
    if (Math.abs(pet.y - from.y) > 2 && !(await jump(pet.x, from.y, job))) return false;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (a.wall !== b.wall) {
        // walk off this wall's edge and come in from the opposite edge of the next one
        const right = NEXT_WALL[a.wall].right === b.wall;
        if (!(await walk(right ? a.x1 + 40 : a.x0 - 40, job))) return false;
        put(b.wall, right ? b.x0 - 40 : b.x1 + 40, b.y);
        continue;
      }
      const lo = Math.max(a.x0, b.x0) + 10;
      const hi = Math.min(a.x1, b.x1) - 10;
      const jx = lo <= hi ? clamp(pet.x, lo, hi) : b.x0 > a.x1 ? a.x1 - 10 : a.x0 + 10;
      if (a.y - b.y > MAX_JUMP_UP) {
        if (!(await climb(a, b, job))) return false;
        continue;
      }
      if (!(await walk(clamp(jx, a.x0 + 10, a.x1 - 10), job))) return false;
      if (!(await jump(clamp(jx, b.x0 + 14, b.x1 - 14), b.y, job))) return false;
    }
    return await walk(clamp(x, to.x0 + 20, to.x1 - 20), job);
  } finally {
    if (job === pet.job) pet.moving = false;
  }
}

// Somewhere new to go: usually on his own wall, sometimes the wall you're looking at
function wander() {
  const wall = pet.wall !== view && Math.random() < 0.5 ? view : pet.wall;
  const spots = surfaces().reduce((a, s) => (s.wall === wall ? a.concat(s) : a), []);
  const s = rand(spots);
  travel(s, s.x0 + Math.random() * (s.x1 - s.x0));
}

// If the shelves moved under him (games added, screen turned), he drops onto what's below
function settle() {
  if (pet.moving || pet.held) return;
  const s = surfaceBelow(surfaces(), pet.wall, pet.x, pet.y);
  if (Math.abs(s.y - pet.y) > 2) travel(s, clamp(pet.x, s.x0 + 20, s.x1 - 20));
}

// The desk in the room: where he starts, and where Customize brings him so you see his new look
function putOnDesk() {
  const d = surfaces().find((s) => s.wall === 'room' && s.sel === '.desk');
  put('room', d.x0 + (d.x1 - d.x0) * 0.2, d.y);
}
function petHome() {
  if (pet.wall === 'room') return;
  pet.job++;
  pet.moving = false;
  putOnDesk();
}

/* ---------- Bedtime ---------- */

const night = () => {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
};
// He walks to the bed, lies down with his head by the pillow, and sleeps tucked under the blanket
async function goToBed() {
  const blanket = surfaces().find((s) => s.sel === '.bed .blanket');
  if (!blanket || !(await travel(blanket, blanket.x0 + 6))) return;
  face(true); // head towards the pillow
  pet.el.classList.add('tucked');
  sleep();
  say(rand(['Good night… 🌙', '*yawn* Bedtime.', 'Sweet dreams, player one.']), 2500);
}

/* ---------- Dragging him ---------- */

const pointIn = (wall, e) => {
  const r = wallOf(wall).getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top + wallOf(wall).scrollTop];
};
let press = null;

pet.el.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, edge: 0, armed: true };
});

// Holding him at the left or right edge of the screen for a moment carries him to the next wall
const EDGE = 28; // px from the screen edge
function edgeCheck(e) {
  const side = e.clientX < EDGE ? 'left' : e.clientX > innerWidth - EDGE ? 'right' : '';
  if (!side) {
    clearTimeout(press.edge);
    press.edge = 0;
    press.armed = true; // finger left the edge: it can carry him again
    return;
  }
  const next = NEXT_WALL[pet.wall][side];
  if (!next || press.edge || !press.armed) return;
  press.edge = setTimeout(() => {
    if (!press || !pet.held) return;
    press.edge = 0;
    press.armed = false; // must leave the edge before going on to another wall
    go(WALLS[next]);
    const [x, y] = pointIn(next, press.last);
    put(next, clamp(x, 20, wallOf(next).clientWidth - 20), y + 26);
  }, 450);
}

addEventListener('pointermove', (e) => {
  if (!press || e.pointerId !== press.id) return;
  press.last = e;
  if (!pet.held && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
  if (!pet.held) {
    pet.held = true;
    pet.job++; // stop whatever he was doing
    pet.moving = false;
    if (pet.sleeping) wake();
    pet.el.classList.remove('walk');
    pet.el.classList.add('held');
    say(rand(['Wheee!', 'Where are we going?', 'Put me down! 😆', 'I can fly!']), 1500);
  }
  const [x, y] = pointIn(pet.wall, e);
  const w = wallOf(pet.wall).clientWidth;
  put(pet.wall, clamp(x, 20, w - 20), y + 26); // you hold him by the middle
  edgeCheck(e);
});
const letGo = async (e) => {
  if (!press || e.pointerId !== press.id) return;
  clearTimeout(press.edge);
  press = null;
  if (!pet.held) return e.type === 'pointerup' && e.target.closest?.('.pet') && petTap(e); // a tap, not a drag
  pet.held = false;
  pet.el.classList.remove('held');
  pet.lastTouch = Date.now();
  const s = surfaceBelow(surfaces(), pet.wall, pet.x, pet.y);
  const job = ++pet.job;
  await jump(clamp(pet.x, s.x0 + 14, s.x1 - 14), s.y, job);
  if (job === pet.job) petClass('hop', 500);
};
addEventListener('pointerup', letGo);
addEventListener('pointercancel', letGo);

/* ---------- Food bowls ---------- */

$$('.bowl').forEach((bowl) =>
  bowl.addEventListener('click', async () => {
    if (bowl.classList.contains('full')) return;
    bowl.classList.add('full');
    const wall = bowl.closest('.view').id.replace('view-', '');
    if (pet.sleeping) wake();
    pet.lastTouch = Date.now();
    say(rand(['Food?! 🍖', 'Coming!', 'Yum, on my way!']), 2000);
    const b = box(bowl, wallOf(wall));
    const floor = surfaces().find((s) => s.wall === wall && s.floor);
    const side = bowl.dataset.side === 'right' ? 1 : -1; // which side of the bowl he stands on
    if (!(await travel(floor, b.x + b.w / 2 + side * 30))) return bowl.classList.remove('full');
    face(side > 0); // facing the bowl
    petClass('eat', 3000);
    setTimeout(() => {
      bowl.classList.remove('full');
      pet.lastTouch = Date.now();
      emit('fed'); // for the "Best Friends" medal
      say(rand(['Yum! Thanks! 💜', 'That hit the spot!', '*burp* 😳', 'Best meal ever!']));
    }, 3000);
  }),
);

/* ---------- Start: on the desk ---------- */

putOnDesk();
on('change', () => setTimeout(settle, 50));
addEventListener('resize', () => setTimeout(settle, 50));
