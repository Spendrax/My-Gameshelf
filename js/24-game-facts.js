'use strict';
// GAME FACTS — how long a game takes to beat (from IGDB players) and when it comes out.
//   • the game card shows "About 25 h to beat · ~8 h left" (from your hours)
//   • a Wishlist game that isn't out yet gets a countdown on its case ("12 d"), and on release day
//     your buddy celebrates it
// Looked up through your helper (HELPER/facts), 40 games at a time. Each game is looked up once
// (g.facts.at); Wishlist games again every week, since release dates move.

const WEEK = 7 * 864e5;
const needsFacts = (g) =>
  !g.facts?.at || (g.status === 'wishlist' && Date.now() - g.facts.at > WEEK && !isOut(g));
const isOut = (g) => !g.facts?.release || g.facts.release <= today();
const daysTo = (date) => Math.round((new Date(date + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);

let factsBusy = false;
async function fillFacts() {
  if (factsBusy || !navigator.onLine) return;
  const todo = games.reduce((a, g) => (needsFacts(g) ? a.concat(g) : a), []).slice(0, 120);
  if (!todo.length) return;
  factsBusy = true;
  try {
    for (let i = 0; i < todo.length; i += 40) {
      const part = todo.slice(i, i + 40);
      const r = await fetch(HELPER + '/facts', {
        method: 'POST',
        body: JSON.stringify({
          games: part.map((g) => ({ key: g.id, igdb: g.igdb || 0, name: plainTitle(g.title) })),
        }),
        signal: AbortSignal.timeout(20000),
      }).then((x) => x.json());
      if (!r.facts) break; // helper too old or down: try another day
      for (const g of part) {
        const f = r.facts[g.id] || {};
        if (f.igdb && !g.igdb) g.igdb = f.igdb;
        g.facts = {
          beat: f.beat || 0,
          rush: f.rush || 0,
          full: f.full || 0,
          release: f.release || '',
          at: Date.now(),
        };
      }
      store('gr.games', games);
    }
    emit('change');
  } catch {
  } finally {
    factsBusy = false;
  }
}

/* ---------- What you see ---------- */

// On the case: days until release for Wishlist games that aren't out yet
CASE_BADGES.push((g) => {
  if (g.status !== 'wishlist' || isOut(g)) return '';
  const d = daysTo(g.facts.release);
  return `<span class="badge soon" title="${esc(g.facts.release)}">${d > 99 ? Math.round(d / 30) + ' mo' : d + ' d'}</span>`;
});

// On the game card
CARD_EXTRAS.push((g) => {
  const f = g.facts || {};
  const bits = [];
  if (!isOut(g)) {
    const d = daysTo(f.release);
    bits.push(`📅 ${d === 1 ? 'Out tomorrow' : `Out in ${d} days`} (${esc(f.release)})`);
  }
  if (f.beat) {
    const left = Math.round((f.beat - (+g.hours || 0)) * 2) / 2;
    bits.push(
      `⏱ About ${f.beat} h to beat` +
        (g.status !== 'finished' && g.hours > 0
          ? left > 0
            ? ` · ~${left} h left`
            : ' · past the usual time!'
          : '') +
        (f.full > f.beat ? ` · ${f.full} h for 100%` : ''),
    );
  }
  return bits.length ? `<p class="g-facts">${bits.join('<br>')}</p>` : '';
});

// Release day: celebrate each Wishlist game once
function cheerReleases() {
  for (const g of games)
    if (g.status === 'wishlist' && g.facts?.release === today() && g.cheered !== today()) {
      g.cheered = today();
      store('gr.games', games);
      setTimeout(() => {
        toast(`🎉 ${g.title} comes out today!`);
        say(`${g.title} is out! 🎉`, 4000);
        confetti();
      }, 4000);
      break; // one a day is plenty
    }
}

setTimeout(fillFacts, 9000);
let factsT = 0;
on('added', () => {
  clearTimeout(factsT);
  factsT = setTimeout(fillFacts, 3000);
});
cheerReleases();
renderRack();
