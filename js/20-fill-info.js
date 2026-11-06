'use strict';
// FILLING IN MISSING INFO — games without a release year (from Steam/PlayStation/Xbox sync, or added by hand)
// get it looked up by themselves, one at a time in the background, through the normal game search
// (findGames in 02-search.js). Empty genres are filled at the same time. Each game is looked up only once
// (g.infoChecked), so the helper isn't asked again and again.

const sameName = (t) => plainTitle(t).toLowerCase().replace(/[^a-z0-9]/g, '');
let filling = false;

// loud = started from the Settings button: says how it's going and what it found
async function fillMissingInfo(loud) {
  if (filling || !navigator.onLine) return loud && toast(filling ? 'Already looking\u2026' : 'No connection right now');
  filling = true;
  const todo = games.reduce((n, g) => n + (!g.year && !g.infoChecked), 0);
  if (loud) toast(todo ? `Looking up ${todo} games\u2026` : 'Every game already has its year!');
  let found = 0;
  try {
    let changed = 0;
    for (const g of games) {
      if (g.year || g.infoChecked) continue;
      const d = await findGames(plainTitle(g.title));
      if (d.error) break; // search isn't answering: try again another time
      g.infoChecked = true;
      // the result with the same name, else the first one
      const r = (d.results || []).find((x) => sameName(x.name) === sameName(g.title)) || d.results?.[0];
      if (r && sameName(r.name).includes(sameName(g.title).slice(0, 12))) {
        if (r.released) {
          g.year = r.released.slice(0, 4);
          found++;
          if (loud && found % 5 === 0) toast(`Found ${found} of ${todo}\u2026`);
        }
        if (!g.genres?.length && r.genres?.length) g.genres = r.genres.map((x) => x.name);
        if (r.igdb && !g.igdb) g.igdb = r.igdb;
        changed++;
      }
      store('gr.games', games); // saved quietly as it goes
      await new Promise((ok) => setTimeout(ok, 1200)); // one lookup at a time, gently
    }
    if (changed) save(); // redraw the walls once at the end
  } finally {
    filling = false;
  }
  if (loud && todo) toast(`Found the year of ${found} of ${todo} games`);
}

// Settings → "Find missing years": look again for every game still without a year
$('#sYears').onclick = () => {
  games.forEach((g) => !g.year && delete g.infoChecked);
  fillMissingInfo(true);
};

// a few seconds after opening the app, and after games are added
setTimeout(fillMissingInfo, 6000);
let fillT = 0;
on('change', () => {
  clearTimeout(fillT);
  fillT = setTimeout(fillMissingInfo, 4000);
});
