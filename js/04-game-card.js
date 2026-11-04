'use strict';
// GAME CARD — what you see when you tap a case: cover, rating, hours, notes,
// plus quick buttons (▶ Playing, 🏆 Finished, +1 h) and Edit.

let curId = null;
function openGame(id) {
  const g = byId(id);
  if (!g) return;
  curId = id;
  const s = STATUS[g.status] || STATUS.backlog;
  const sub = [g.platform, g.year].filter(Boolean).join(' · ');
  const days =
    g.started && g.finished
      ? Math.max(1, Math.round((new Date(g.finished) - new Date(g.started)) / 864e5) + 1)
      : 0;
  $('#gBody').innerHTML = `
    <button class="x gx" data-close aria-label="Close">✕</button>
    <div class="g-top" style="--img:${g.cover ? `url('${g.cover.replace(/'/g, '%27')}')` : 'none'}">
      ${caseHTML(g, 'big')}
      <div><h2>${esc(g.title)}</h2>${sub ? `<div class="dim">${esc(sub)}</div>` : ''}<span class="pill" style="--sc:${s.color}">${s.label}</span>${g.endless ? ' <span class="pill" style="--sc:#8ab4ff">\u221E Endless</span>' : ''}</div>
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
      ${g.status !== 'finished' && !g.endless ? '<button class="btn" data-q="finished">🏆 Finished</button>' : ''}
      <button class="btn" data-q="hour">+1 h</button>
    </div>
    <div class="actions"><button class="btn primary" data-q="edit">Edit</button></div>`;
  if (!$('#dlgGame').open) $('#dlgGame').showModal();
}
$('#gBody').addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]')?.dataset.q;
  if (!q) return;
  const g = byId(curId);
  if (!g) return;
  if (q === 'edit') return openEdit(g);
  if (q === 'playing') {
    g.status = 'playing';
    g.started ||= today();
  }
  if (q === 'finished')
    return askFinished((date) => {
      g.status = 'finished';
      g.finished = date;
      g.updated = Date.now();
      save();
      openGame(g.id);
      emit('finished', g);
    });
  if (q === 'hour') g.hours = (+g.hours || 0) + 1;
  g.updated = Date.now();
  save();
  openGame(g.id);
});

// "When did you finish it?": today, a day in the past, or long ago (no date: still finished, but not in
// this year's challenge). done(date) gets 'YYYY-MM-DD' or ''.
let whenDone = null;
function askFinished(done) {
  whenDone = done;
  $('#whenDate').max = today();
  $('#whenDate').value = '';
  $('#dlgWhen').showModal();
}
$('#dlgWhen').addEventListener('click', (e) => {
  const w = e.target.closest('[data-when]')?.dataset.when;
  if (!w) return;
  const date = w === 'today' ? today() : w === 'date' ? $('#whenDate').value : '';
  if (w === 'date' && !date) return toast('Pick the day first');
  $('#dlgWhen').close();
  whenDone?.(date);
  whenDone = null;
});
