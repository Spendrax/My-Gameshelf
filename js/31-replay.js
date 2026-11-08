'use strict';
// PLAYING AGAIN — a finished game has a "🔁 Play again" button: it goes back to Playing but still counts as
// finished (stats, goals, medals), with a 🔁 on its case. Each finish date is kept in g.beatenOn; finishing
// it again adds the new date.

const timesBeaten = (g) => (g.beatenOn?.length || 0) + (g.status === 'finished' || g.status === 'enough');

CARD_EXTRAS.push((g) =>
  g.status === 'finished' || g.status === 'enough'
    ? `<button class="btn wide" data-replay>🔁 Play again</button>`
    : g.beatenOn?.length
      ? `<p class="g-facts">🔁 Playing again · Finished ${timesBeaten(g)}×</p>`
      : '',
);
CASE_BADGES.push((g) =>
  g.beatenOn?.length && g.status !== 'finished' ? '<span class="badge again">🔁</span>' : '',
);

$('#gBody').addEventListener('click', (e) => {
  const g = e.target.closest('[data-replay]') && byId(curId);
  if (!g) return;
  g.beatenOn = (g.beatenOn || []).concat(g.finished || 'past');
  g.status = 'playing';
  g.updated = Date.now();
  save();
  openGame(g.id);
  say(`Round ${timesBeaten(g) + 1}! 🔁`);
});
