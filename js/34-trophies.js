'use strict';
// TROPHIES & ACHIEVEMENTS — how many you've earned in a game, on its card: "🏆 34 / 50".
//   • PlayStation trophies and Xbox gamerscore arrive with each sync (g.tro = [earned, possible, unit])
//   • Steam achievements are looked up when you open a Steam game's card (HELPER/steam-ach), once a day

CARD_EXTRAS.push((g) => {
  if (g.steam && set.steamId) steamTrophies(g);
  const [done, total, unit] = g.tro || [];
  if (!total) return '';
  const pct = Math.round((done / total) * 100);
  return `<p class="g-facts tro">🏆 <b>${done} / ${total}${unit ? ' ' + unit : ''}</b> · ${pct}%${pct === 100 ? ' 🎉' : ''}
    <i class="prog"><i style="width:${pct}%"></i></i></p>`;
});

const troBusy = new Set();
async function steamTrophies(g) {
  if (troBusy.has(g.id) || Date.now() - (g.troAt || 0) < 864e5 || !navigator.onLine) return;
  troBusy.add(g.id);
  try {
    const r = await fetch(`${HELPER}/steam-ach?id=${set.steamId}&app=${g.steam}`, {
      signal: AbortSignal.timeout(10000),
    }).then((x) => x.json());
    if (r.total == null) return; // helper too old or down
    const changed = r.total && (g.tro?.[0] !== r.done || g.tro?.[1] !== r.total);
    g.troAt = Date.now();
    if (r.total) g.tro = [r.done, r.total];
    store('gr.games', games);
    if (changed && curId === g.id && $('#dlgGame').open) openGame(g.id);
  } catch {
  } finally {
    troBusy.delete(g.id);
  }
}
