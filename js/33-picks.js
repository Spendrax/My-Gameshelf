'use strict';
// WHAT SHOULD I PLAY? — a card on the Goals wall with ideas, from how long games take to beat
// (24-game-facts.js) and your hours:
//   • Almost done: games you're playing with 4 hours or less to go
//   • Quick ones: backlog games that take 8 hours or less
//   • Waiting the longest: the oldest games in your backlog

GOALS_EXTRAS.push(() => {
  const left = (g) => Math.round((g.facts.beat - (+g.hours || 0)) * 2) / 2;
  const picks = games.reduce(
    (a, g) => {
      const beat = g.facts?.beat;
      if (['playing', 'onoff', 'paused'].includes(g.status) && beat && left(g) > 0 && left(g) <= 4)
        a.close.push(g);
      if (g.status === 'backlog' && beat && beat <= 8) a.quick.push(g);
      if (g.status === 'backlog') a.old.push(g);
      return a;
    },
    { close: [], quick: [], old: [] },
  );
  const rows = (title, list, label) =>
    list.length
      ? `<h4>${title}</h4><div class="list">${list.slice(0, 3).reduce((h, g) => h + listRow(g, label(g)), '')}</div>`
      : '';
  const html =
    rows(
      '🏁 Almost done',
      picks.close.sort((a, b) => left(a) - left(b)),
      (g) => `~${left(g)} h left`,
    ) +
    rows(
      '⚡ Quick ones',
      picks.quick.sort((a, b) => a.facts.beat - b.facts.beat),
      (g) => `${g.facts.beat} h`,
    ) +
    rows(
      '⏳ Waiting the longest',
      picks.old.sort((a, b) => (a.added || 0) - (b.added || 0)).slice(0, 2),
      (g) =>
        new Date(g.added || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    );
  return html ? `<div class="card picks"><h3>🎯 What should I play?</h3>${html}</div>` : '';
});
renderWalls();
