'use strict';
// MOVING GAMES BETWEEN SECTIONS — hold a game on the rack for half a second, then drag it onto another
// section (or onto one of the status chips that appear at the bottom) to change its status.
// Dropped on Finished, it asks when you finished it, like the 🏆 button.

let drag = null;

$('#rack').addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.case[data-id]');
  if (!c || e.button > 0) return;
  const start = { x: e.clientX, y: e.clientY };
  const t = setTimeout(() => startDrag(c, start), 450);
  const cancel = (ev) => {
    if (ev.type === 'pointermove' && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) return;
    clearTimeout(t);
    removeEventListener('pointermove', cancel);
    removeEventListener('pointerup', cancel);
  };
  addEventListener('pointermove', cancel);
  addEventListener('pointerup', cancel);
});
$('#rack').addEventListener('contextmenu', (e) => e.target.closest('.case') && e.preventDefault());

function startDrag(c, at) {
  const g = byId(c.dataset.id);
  if (!g) return;
  navigator.vibrate?.(20);
  const ghost = c.cloneNode(true);
  ghost.className += ' drag-ghost';
  document.body.append(ghost);
  const bar = document.createElement('div');
  bar.className = 'drop-bar';
  bar.innerHTML = Object.entries(STATUS).reduce(
    (h, [k, s]) =>
      k === g.status ? h : h + `<span data-drop="${k}" style="--sc:${s.color}">${s.label}</span>`,
    '',
  );
  document.body.append(bar);
  document.body.classList.add('dragcase');
  drag = { g, ghost, bar, target: null };
  moveDrag(at.x, at.y);
}

// The section under your finger: a chip at the bottom, a section title, or a shelf under a title
function dropAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const chip = el?.closest('[data-drop]');
  if (chip) return [chip.dataset.drop, chip];
  let s = el?.closest('#rack .grp-h, #rack .shelf, #rack .peek-wrap');
  if (s?.matches('.peek')) s = s.closest('.peek-wrap');
  while (s && !s.matches('.grp-h')) s = s.previousElementSibling;
  return s ? [s.dataset.g, s] : [null, null];
}

function moveDrag(x, y) {
  drag.ghost.style.transform = `translate(${x - 36}px, ${y - 50}px) rotate(-6deg)`;
  const [, el] = dropAt(x, y);
  if (el !== drag.target) {
    drag.target?.classList.remove('drop-here');
    el?.classList.add('drop-here');
    drag.target = el;
  }
}

addEventListener('pointermove', (e) => drag && moveDrag(e.clientX, e.clientY));
// while dragging, the page doesn't scroll and the walls don't turn
addEventListener('touchmove', (e) => drag && e.preventDefault(), { passive: false });
addEventListener('pointerup', (e) => {
  if (!drag) return;
  const { g, ghost, bar } = drag;
  const [k] = dropAt(e.clientX, e.clientY);
  drag.target?.classList.remove('drop-here');
  ghost.remove();
  bar.remove();
  drag = null;
  document.body.classList.remove('dragcase');
  // the tap that ends a drag doesn't open the game
  const eat = (ev) => (ev.stopPropagation(), ev.preventDefault());
  addEventListener('click', eat, { capture: true, once: true });
  setTimeout(() => removeEventListener('click', eat, true), 400);
  if (k && k !== g.status) moveGame(g, k);
});
addEventListener('pointercancel', () => {
  if (!drag) return;
  drag.target?.classList.remove('drop-here');
  drag.ghost.remove();
  drag.bar.remove();
  drag = null;
  document.body.classList.remove('dragcase');
});

function moveGame(g, k) {
  const done = () => {
    g.updated = Date.now();
    save();
    toast(`Moved to ${STATUS[k].label}`);
  };
  if (k === 'finished')
    return askFinished((date) => {
      g.status = 'finished';
      g.finished = date;
      done();
      emit('finished', g);
    });
  if (k === 'playing') g.started ||= today();
  g.status = k;
  done();
}
