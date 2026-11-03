// CLOUDFLARE HELPER — a free Cloudflare Worker that does the lookups a web page isn't allowed to do itself.
//   /?upc=0123456789012     barcode → product name (UPCitemdb blocks calls straight from web pages)
//   /search?q=NAME&key=…   game search: RAWG from here (when the phone can't reach it), or the Steam store
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

    if (url.pathname === '/search') {
      const q = (url.searchParams.get('q') || '').slice(0, 100);
      const key = url.searchParams.get('key') || '';
      try {
        const r = await fetch(
          `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(q)}&page_size=10`,
          { cf: { cacheTtl: 86400, cacheEverything: true }, signal: AbortSignal.timeout(4000) }, // cached a day; 4 s max
        );
        if (r.ok) {
          const d = await r.json();
          if (d.results?.length) return reply({ source: 'rawg', results: d.results });
        }
      } catch {}
      // RAWG down: the Steam store's search (PC games only)
      const s = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&cc=CA&l=english`,
      )
        .then((r) => r.json())
        .catch(() => ({}));
      return reply({
        source: 'steam',
        results: (s.items || []).map((i) => ({
          name: i.name,
          steam: i.id,
          background_image: `https://cdn.akamai.steamstatic.com/steam/apps/${i.id}/header.jpg`,
          platforms: [{ platform: { name: 'PC' } }],
        })),
      });
    }

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
        games: list.map((g) => ({
          appid: g.appid,
          name: g.name,
          minutes: g.playtime_forever,
          last: g.rtime_last_played || 0,
        })),
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
