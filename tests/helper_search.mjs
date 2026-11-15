// Searching must find remakes and brand-new games (not only the best-known ones).
let asked = '';
const now = Date.now() / 1000;
globalThis.fetch = async (u, i) => {
  if (String(u).includes('id.twitch.tv')) return new Response(JSON.stringify({ access_token: 't', expires_in: 9999 }));
  asked = i.body;
  const old = (n) => ({ id: n, name: 'Some Zelda ' + n, total_rating_count: 1000 + n, first_release_date: 9e8 });
  return new Response(JSON.stringify([
    ...Array.from({ length: 14 }, (_, n) => old(n)),
    { id: 99, name: 'The Legend of Zelda: Ocarina of Time', total_rating_count: 3, first_release_date: now - 9 * 86400 },
  ]));
};
const w = (await import('../tools/cloudflare-helper.js')).default;
const r = await w.fetch(new Request('https://x/search?q=ocarina', { headers: { Origin: 'https://spendrax.github.io' } }), { TWITCH_ID: 'a', TWITCH_SECRET: 'b' });
const out = await r.json();
const list = out.results || out.items || out;
const found = JSON.stringify(list).includes('"igdb":99');
console.log('asks by game type:', /game_type = \(0,4,8,9,10,11\)/.test(asked), '| no parent filter:', !asked.includes('parent_game = null'), '| new remake in results:', found);
if (!found || asked.includes('parent_game = null')) process.exit(1);
