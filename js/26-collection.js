'use strict';
// YOUR COLLECTION — tags (your own shelves: "Co-op", "Cozy"…) and what you own: physical or digital,
// price paid and where you bought it. All typed in the edit form (03-edit-form.js).
//   • tags show on the game card, and in the platform filter above the rack ("🏷 Co-op")
//   • the Stats wall adds up your collection: how much you paid, physical vs digital, favourite store
//   • "💰 What's it worth?" looks up today's store price of each game you own (IsThereAnyDeal, through
//     HELPER/deals with all: true; mostly PC stores, so many console games have no price). Kept in g.worth.

CARD_EXTRAS.push((g) => {
  const own = [
    g.format === 'physical' ? '💿 Physical' : g.format === 'digital' ? '☁️ Digital' : '',
    g.price ? money(+g.price) : '',
    g.store ? esc(g.store) : '',
  ].filter(Boolean);
  return (
    (g.tags?.length
      ? `<div class="tags mine">${g.tags.reduce((h, t) => h + `<span>🏷 ${esc(t)}</span>`, '')}</div>`
      : '') + (own.length ? `<p class="dim small">${own.join(' · ')}</p>` : '')
  );
});

const money = (n) =>
  n.toLocaleString(undefined, { style: 'currency', currency: set.currency || guessCurrency() });
// The currency of the phone's country (CA → CAD, FR → EUR…), US dollars if unknown
function guessCurrency() {
  const c = (navigator.language.split('-')[1] || '').toUpperCase();
  const map = { CA: 'CAD', GB: 'GBP', AU: 'AUD', JP: 'JPY', BR: 'BRL', MX: 'MXN', CH: 'CHF', HT: 'HTG' };
  return (
    map[c] || (['FR', 'DE', 'IT', 'ES', 'PT', 'BE', 'NL', 'AT', 'IE', 'FI', 'LU'].includes(c) ? 'EUR' : 'USD')
  );
}

STATS_EXTRAS.push(() => {
  const s = games.reduce(
    (a, g) => {
      if (g.status === 'wishlist') return a;
      if (+g.price) {
        a.paid += +g.price;
        a.priced++;
      }
      if (g.format) a[g.format]++;
      if (g.store) a.stores[g.store] = (a.stores[g.store] || 0) + 1;
      return a;
    },
    { paid: 0, priced: 0, physical: 0, digital: 0, stores: {} },
  );
  const fav = Object.keys(s.stores).sort((a, b) => s.stores[b] - s.stores[a])[0];
  const w = games.reduce(
    (a, g) =>
      g.worth && g.status !== 'wishlist'
        ? {
            n: a.n + 1,
            now: a.now + g.worth.price,
            full: a.full + (g.worth.regular || g.worth.price),
            cur: g.worth.currency,
          }
        : a,
    { n: 0, now: 0, full: 0, cur: '' },
  );
  const cash = (n) =>
    n.toLocaleString(undefined, { style: 'currency', currency: w.cur || 'USD', maximumFractionDigits: 0 });
  return `<div class="card"><h3>Collection</h3>
    <div class="facts">
      ${w.n ? `<div><b>${cash(w.now)}</b><span>Worth today (${w.n} games)</span></div><div><b>${cash(w.full)}</b><span>At full price</span></div>` : ''}
      ${s.priced ? `<div><b>${money(s.paid)}</b><span>Paid (${s.priced} games)</span></div>` : ''}
      ${s.physical || s.digital ? `<div><b>${s.physical} / ${s.digital}</b><span>💿 Physical / ☁️ Digital</span></div>` : ''}
      ${fav ? `<div><b>${esc(fav)}</b><span>Favourite store</span></div>` : ''}
    </div>
    <button class="btn wide" id="worthBtn" style="margin-top:10px">💰 ${w.n ? 'Update what it’s worth' : 'What’s my library worth?'}</button>
    <p class="dim small">Store prices today, mostly from PC stores: many console games have no price.</p></div>`;
});
renderWalls();

async function checkWorth() {
  const owned = games.reduce((a, g) => (g.status !== 'wishlist' ? a.concat(g) : a), []);
  if (!owned.length) return toast('Add some games first');
  toast(`Looking up prices for ${owned.length} games…`);
  let found = 0;
  for (let i = 0; i < owned.length; i += 100) {
    const part = owned.slice(i, i + 100);
    let r;
    try {
      r = await fetch(HELPER + '/deals', {
        method: 'POST',
        body: JSON.stringify({
          all: true,
          country: dealCountry(),
          games: part.map((g) => ({ key: g.id, name: plainTitle(g.title), steam: g.steam || 0 })),
        }),
        signal: AbortSignal.timeout(30000),
      }).then((x) => x.json());
    } catch {
      return toast('No connection. Try again later.');
    }
    if (r.error === 'no-key')
      return toast('Prices need the ITAD_KEY secret in your helper (like sale alerts).');
    if (!r.deals) return toast('Prices aren’t answering right now. Try again later.');
    for (const g of part) {
      const d = r.deals[g.id];
      if (d?.price != null) {
        g.worth = { price: +d.price, regular: +d.regular || +d.price, currency: d.currency, at: Date.now() };
        found++;
      }
    }
  }
  store('gr.games', games);
  renderWalls();
  toast(`Found prices for ${found} of ${owned.length} games`);
}
$('#view-stats').addEventListener('click', (e) => e.target.closest('#worthBtn') && checkWorth());
