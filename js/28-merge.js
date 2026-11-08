'use strict';
// MERGING THE SAME GAME — played on two consoles (or synced from two accounts)? The game card shows the
// other copy and a "Merge into this one" button: you keep this one, with the hours of both.
// The other copy's account links (Steam, PlayStation, Xbox, Nintendo) and hours are kept in g.merged, so
// later syncs keep topping up the right part (14-steam-sync.js), and the hours stay added together.

const LINKS = ['steam', 'psn', 'xbox', 'ns'];
const twinsOf = (g) =>
  games.reduce((a, o) => (o.id !== g.id && sameTitle(o.title) === sameTitle(g.title) ? a.concat(o) : a), []);
const union = (a = [], b = []) => [...new Set([...a, ...b])];

CARD_EXTRAS.push((g) => {
  const was = (g.merged || []).reduce(
    (h, p) => h + `<span>🔗 ${esc(p.platform || '?')} · ${p.hours || 0} h</span>`,
    '',
  );
  const twins = twinsOf(g).reduce(
    (h, o) =>
      h +
      `<div class="twin">🔗 Also on your rack: <b>${esc(o.platform || '?')}</b> (${o.hours || 0} h)
        <button class="btn" data-merge="${o.id}">Merge into this one</button></div>`,
    '',
  );
  return (was ? `<div class="tags">${was}</div>` : '') + twins;
});

$('#gBody').addEventListener('click', (e) => {
  const o = byId(e.target.closest('[data-merge]')?.dataset.merge);
  const g = byId(curId);
  if (o && g) mergeGames(g, o);
});

// Keeps g, with o's hours, links, dates, notes, genres and tags; o is removed
function mergeGames(g, o) {
  if (!confirm(`Keep this one and add the ${o.hours || 0} h from ${o.platform || 'the other copy'}?`))
    return false;
  const part = { platform: o.platform || '', hours: +o.hours || 0 };
  for (const k of LINKS) if (o[k]) part[k] = o[k];
  Object.assign(g, {
    merged: (g.merged || []).concat(part, o.merged || []),
    hours: Math.round(((+g.hours || 0) + (+o.hours || 0)) * 10) / 10,
    rating: Math.max(g.rating || 0, o.rating || 0),
    started: [g.started, o.started].filter(Boolean).sort()[0] || '',
    finished: g.finished || o.finished || '',
    notes: [g.notes, o.notes].filter(Boolean).join('\n\n'),
    genres: union(g.genres, o.genres),
    tags: union(g.tags, o.tags),
    cover: g.cover || o.cover || '',
    updated: Date.now(),
  });
  games = games.filter((x) => x.id !== o.id);
  set.gone = (set.gone || []).concat({ id: o.id, at: Date.now() }).slice(-500); // deleted on your other devices too
  saveSet();
  save();
  openGame(g.id);
  toast(`Merged: ${g.hours} h in total`);
  return true;
}

/* ---------- Merging any two games (Edit → 🔗 Merge…) ---------- */
// For when the names don't match exactly ("Pokémon Sun" and "Pokemon Ultra Sun", a remaster…).
// Likely matches come first: the more title words in common, the higher.

const SMALL = new Set([
  'the',
  'of',
  'a',
  'and',
  'edition',
  'deluxe',
  'hd',
  'remastered',
  'definitive',
  'game',
  'goty',
]);
const words = (t) =>
  plainTitle(t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // é → e
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !SMALL.has(w));
const likeness = (a, b) => {
  const wa = words(a.title);
  const wb = new Set(words(b.title));
  return wa.reduce((n, w) => n + wb.has(w), 0) + (wa[0] && wa[0] === [...wb][0] ? 0.5 : 0);
};

const dlgMerge = document.createElement('dialog');
dlgMerge.id = 'dlgMerge';
dlgMerge.innerHTML = `<div class="sheet-h"><h2>Merge with…</h2><button class="x" data-close aria-label="Close">✕</button></div>
  <p class="dim small">Pick the other copy of this game. You keep this one, with the hours of both.</p>
  <input id="mQ" type="search" placeholder="Find a game" autocomplete="off">
  <div class="list" id="mList"></div>`;
document.body.append(dlgMerge);
dlgMerge.addEventListener('click', (e) => e.target === dlgMerge && dlgMerge.close());

let mergeInto = null;
function drawMergeList() {
  const g = mergeInto;
  const q = $('#mQ').value.trim().toLowerCase();
  const list = games
    .reduce(
      (a, o) =>
        o.id !== g.id && (!q || o.title.toLowerCase().includes(q)) ? a.concat([[likeness(g, o), o]]) : a,
      [],
    )
    .sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title))
    .slice(0, q ? 40 : 12);
  $('#mList').innerHTML =
    list.reduce(
      (h, [n, o]) =>
        h +
        `<div class="lrow" role="button" data-into="${o.id}">${caseHTML(o)}<span>${esc(o.title)}</span><small class="dim">${esc(o.platform || '')} · ${o.hours || 0} h${n >= 1 && !q ? ' · ⭐' : ''}</small></div>`,
      '',
    ) || '<p class="dim">No game matches.</p>';
}
$('#mQ').oninput = drawMergeList;
$('#mList').addEventListener(
  'click',
  (e) => {
    const o = byId(e.target.closest('[data-into]')?.dataset.into);
    e.stopPropagation(); // the case inside shouldn't open the game
    if (o && mergeGames(mergeInto, o)) {
      dlgMerge.close();
      $('#dlgEdit').close();
    }
  },
  true,
);
$('#eMerge').onclick = () => {
  mergeInto = byId(draft.id);
  if (!mergeInto) return;
  $('#mQ').value = '';
  drawMergeList();
  dlgMerge.showModal();
};
