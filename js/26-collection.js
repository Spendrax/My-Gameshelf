'use strict';
// YOUR COLLECTION — tags (your own shelves: "Co-op", "Cozy"…) and what you own: physical or digital,
// price paid and where you bought it. All typed in the edit form (03-edit-form.js).
//   • tags show on the game card, and in the platform filter above the rack ("🏷 Co-op")
//   • the Stats wall adds up your collection: how much you paid, physical vs digital, favourite store

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
  if (!s.priced && !s.physical && !s.digital) return '';
  const fav = Object.keys(s.stores).sort((a, b) => s.stores[b] - s.stores[a])[0];
  return `<div class="card"><h3>Collection</h3>
    <div class="facts">
      <div><b>${money(s.paid)}</b><span>Paid (${s.priced} games)</span></div>
      <div><b>${s.physical} / ${s.digital}</b><span>💿 Physical / ☁️ Digital</span></div>
      ${fav ? `<div><b>${esc(fav)}</b><span>Favourite store</span></div>` : ''}
    </div></div>`;
});
renderWalls();
