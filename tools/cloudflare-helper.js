// CLOUDFLARE HELPER — a free Cloudflare Worker that does the lookups a web page isn't allowed to do itself.
//   /?upc=0123456789012     barcode → product name (UPCitemdb blocks calls straight from web pages)
//   /steam?id=NAME_OR_ID    the Steam games someone owns, with playtime (needs the STEAM_KEY secret)
// Set up: Cloudflare → Workers & Pages → gameshelf-barcode → Edit code → paste this file → Deploy.
// Steam key: Settings → Variables and Secrets → Add → type "Secret", name STEAM_KEY, value = your key → Deploy.

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': 'https://spendrax.github.io', // only your app may use it
      'Content-Type': 'application/json',
    };
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    const url = new URL(request.url);

    if (url.pathname === '/steam') {
      if (!env.STEAM_KEY) return reply({ error: 'no-key' }, 500);
      let id = (url.searchParams.get('id') || '').trim();
      // A profile name ("spendrax") is turned into the 17-digit Steam ID first
      if (!/^\d{17}$/.test(id)) {
        const r = await fetch(
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${env.STEAM_KEY}&vanityurl=${encodeURIComponent(id)}`,
        );
        id = (await r.json().catch(() => ({}))).response?.steamid;
        if (!id) return reply({ error: 'not-found' }, 404);
      }
      const r = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${env.STEAM_KEY}&steamid=${id}&include_appinfo=1&include_played_free_games=1`,
      );
      const list = (await r.json().catch(() => ({}))).response?.games;
      if (!list) return reply({ error: 'private' }, 403); // "Game details" not public (or no games)
      return reply({
        steamid: id,
        games: list.map((g) => ({ appid: g.appid, name: g.name, minutes: g.playtime_forever, last: g.rtime_last_played || 0 })),
      });
    }

    const upc = url.searchParams.get('upc') || '';
    if (!/^\d{8,14}$/.test(upc)) return reply({ items: [] });
    // Barcode results are kept for 30 days, so scanning the same game again doesn't use up the daily lookups
    const answer = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      cf: { cacheTtl: 2592000, cacheEverything: true },
    });
    return new Response(await answer.text(), { status: answer.status, headers });
  },
};
