'use strict';
// SALE ALERTS — once a day, the games on your Wishlist are checked for sales (Steam, PlayStation, Nintendo,
// Xbox, GOG and more, through IsThereAnyDeal). A game on sale gets a "-50%" tag on its case, the deal on
// its game card, and a toast when the sale is new. Needs the ITAD_KEY secret in your helper (HELPER/deals).

const dealCountry = () => (navigator.language.split('-')[1] || 'US').toUpperCase();

async function checkDeals(loud) {
  const wish = games.reduce((a, g) => (g.status === 'wishlist' ? a.concat(g) : a), []);
  if (!wish.length || !navigator.onLine) return;
  let r;
  try {
    r = await fetch(HELPER + '/deals', {
      method: 'POST',
      body: JSON.stringify({
        country: dealCountry(),
        games: wish.map((g) => ({ key: g.id, name: plainTitle(g.title), steam: g.steam || 0 })),
      }),
      signal: AbortSignal.timeout(20000),
    }).then((x) => x.json());
  } catch {
    return;
  }
  if (!r.deals) return; // no ITAD_KEY yet, or the helper is down: try tomorrow
  set.dealsAt = Date.now();
  saveSet();
  const fresh = [];
  for (const g of wish) {
    const d = r.deals[g.id];
    if (d && d.cut > (g.deal?.cut || 0)) fresh.push(g);
    if (d) g.deal = { ...d, at: Date.now() };
    else delete g.deal;
  }
  store('gr.games', games);
  emit('change');
  if (fresh.length) {
    const g = fresh[0];
    toast(
      fresh.length > 1
        ? `🏷 ${fresh.length} Wishlist games are on sale!`
        : `🏷 ${g.title} is ${g.deal.cut}% off at ${g.deal.shop}!`,
    );
  } else if (loud) toast('No sales on your Wishlist right now');
}

CASE_BADGES.push((g) =>
  g.status === 'wishlist' && g.deal ? `<span class="badge sale">-${g.deal.cut}%</span>` : '',
);
CARD_EXTRAS.push((g) => {
  const d = g.status === 'wishlist' && g.deal;
  if (!d) return '';
  const price =
    d.price != null
      ? (+d.price).toLocaleString(undefined, { style: 'currency', currency: d.currency || 'USD' })
      : '';
  return `<p class="g-facts">🏷 <b>-${d.cut}%</b> ${price} at ${esc(d.shop || '')}
    ${/^https:/.test(d.url || '') ? `· <a href="${esc(d.url)}" target="_blank" rel="noopener">See the deal</a>` : ''}</p>`;
});

if (Date.now() - (set.dealsAt || 0) > 864e5) setTimeout(checkDeals, 15e3);
renderRack();
