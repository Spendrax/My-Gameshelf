// CLOUDFLARE HELPER — a free Cloudflare Worker that does the lookups a web page isn't allowed to do itself.
//   /?upc=0123456789012     barcode → product name (UPCitemdb blocks calls straight from web pages)
//   /search?q=NAME&key=…   game search: IGDB (every platform), then RAWG, then the Steam store (PC only)
//   /pictures?igdb=ID or ?q=NAME   box art, artwork and screenshots of one game (IGDB)
//   /steam?id=NAME_OR_ID    the Steam games someone owns, with playtime (needs the STEAM_KEY secret)
// Set up: Cloudflare → Workers & Pages → gameshelf-barcode → Edit code → paste this file → Deploy.
// Steam key: Settings → Variables and Secrets → Add → type "Secret", name STEAM_KEY, value = your key → Deploy.
// IGDB (Twitch): two more secrets the same way, TWITCH_ID (Client ID) and TWITCH_SECRET (Client Secret).

// IGDB needs a Twitch access token; it lasts about two months, so it's kept between requests
let igdbToken = { value: '', until: 0 };

// Asks IGDB (body = IGDB's query language). Needs the TWITCH_ID and TWITCH_SECRET secrets.
async function igdb(body, env) {
  if (!env.TWITCH_ID || !env.TWITCH_SECRET) return [];
  // the Twitch access token lasts about two months, so it's kept between requests
  if (Date.now() > igdbToken.until) {
    const t = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_ID}&client_secret=${env.TWITCH_SECRET}&grant_type=client_credentials`,
      { method: 'POST' },
    ).then((r) => r.json());
    igdbToken = { value: t.access_token, until: Date.now() + (t.expires_in - 3600) * 1000 };
  }
  const list = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': env.TWITCH_ID, Authorization: `Bearer ${igdbToken.value}` },
    body,
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
  return Array.isArray(list) ? list : [];
}
const igdbImg = (size, id) => `https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg`;
const quoted = (q) => JSON.stringify(q); // the name in quotes, safely

// Search results, shaped like RAWG's answer so the app reads both the same way
async function igdbSearch(q, env) {
  const list = await igdb(
    // only real games: no DLC, expansions, seasons or special editions (those have a parent game)
    `search ${quoted(q)}; fields name,first_release_date,cover.image_id,platforms.name,genres.name,total_rating_count; where parent_game = null & version_parent = null; limit 30;`,
    env,
  );
  // the best-known games first (most ratings), then keep 10
  list.sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0));
  return list.slice(0, 10).map((g) => ({
    name: g.name,
    igdb: g.id,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : '',
    background_image: g.cover ? igdbImg('t_cover_big', g.cover.image_id) : '',
    platforms: (g.platforms || []).map((p) => ({ platform: { name: p.name } })),
    genres: (g.genres || []).map((x) => ({ name: x.name })),
  }));
}

// Every picture of one game: box art, artwork, screenshots
async function igdbPictures(id, title, env) {
  const fields = 'fields cover.image_id,artworks.image_id,screenshots.image_id;';
  const [g] = await igdb(
    id ? `${fields} where id = ${+id};` : `search ${quoted(title)}; ${fields} limit 1;`,
    env,
  );
  if (!g) return [];
  return [
    ...(g.cover ? [igdbImg('t_cover_big', g.cover.image_id)] : []),
    ...(g.artworks || []).map((a) => igdbImg('t_screenshot_big', a.image_id)),
    ...(g.screenshots || []).map((a) => igdbImg('t_screenshot_big', a.image_id)),
  ];
}

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
      // 1. IGDB: every platform, real box art
      try {
        const results = await igdbSearch(q, env);
        if (results.length) return reply({ source: 'igdb', results });
      } catch {}
      // 2. RAWG
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
      // 3. the Steam store's search (PC games only)
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

    if (url.pathname === '/pictures') {
      try {
        return reply({
          pictures: await igdbPictures(url.searchParams.get('igdb'), url.searchParams.get('q') || '', env),
        });
      } catch {
        return reply({ pictures: [] });
      }
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
