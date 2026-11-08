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
  if (!o || !g) return;
  if (!confirm(`Keep this one and add the ${o.hours || 0} h from ${o.platform || 'the other copy'}?`)) return;
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
});
