// CLOUDFLARE HELPER — a free Cloudflare Worker that does the lookups a web page isn't allowed to do itself.
//   /?upc=0123456789012     barcode → product name (UPCitemdb blocks calls straight from web pages)
//   /search?q=NAME&key=…   game search: IGDB (every platform), then RAWG, then the Steam store (PC only)
//   /pictures?igdb=ID or ?q=NAME   box art, artwork and screenshots of one game (IGDB)
//   /steam?id=NAME_OR_ID    the Steam games someone owns, with playtime (needs the STEAM_KEY secret)
//   POST /psn  (token in the body)   the PlayStation games someone played, with playtime (unofficial: each
//                           person's own sign-in token from playstation.com; nothing is kept here)
//   POST /xbox (key in the body)     the Xbox games someone played, with playtime when available (each
//                           person's own free OpenXBL key from xbl.io; nothing is kept here)
//   POST /gauth, /gtoken    Google Drive backup: trades Google's one-time code for a lasting token, and that
//                           token for a short pass (needs the GOOGLE_ID and GOOGLE_SECRET secrets)
//   /ping                   "are you there?": open it in a browser to check the helper's version
// Only the app's own site may use it, at most 60 requests a minute per connection.
// Set up: Cloudflare → Workers & Pages → gameshelf-barcode → Edit code → paste this file → Deploy.
// Steam key: Settings → Variables and Secrets → Add → type "Secret", name STEAM_KEY, value = your key → Deploy.
// IGDB (Twitch): two more secrets the same way, TWITCH_ID (Client ID) and TWITCH_SECRET (Client Secret).
// Google Drive backup: GOOGLE_ID (OAuth client ID) and GOOGLE_SECRET (client secret), the same way.

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

// ---------- PlayStation (unofficial, the way the PlayStation app signs in) ----------
const PSN_AUTH = 'https://ca.account.sony.com/api/authz/v3/oauth';
const PSN_APP = {
  client_id: '09515159-7237-4370-9b40-3806e67c0891',
  redirect_uri: 'com.scee.psxandroid.scecompcall://redirect',
  scope: 'psn:mobile.v2.core psn:clientapp',
};
// "PT228H56M33S" → minutes
const isoMinutes = (d) => {
  const [, h = 0, m = 0] = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(d || '') || [];
  return +h * 60 + +m;
};
async function psnGames(npsso) {
  // 1. the sign-in token → a one-time code (Sony answers with a redirect that carries it)
  const a = await fetch(
    `${PSN_AUTH}/authorize?${new URLSearchParams({ ...PSN_APP, access_type: 'offline', response_type: 'code' })}`,
    {
      headers: { Cookie: `npsso=${npsso}` },
      redirect: 'manual',
    },
  );
  const code = /[?&]code=([^&]+)/.exec(a.headers.get('location') || '')?.[1];
  if (!code) return { error: 'npsso' }; // the token is wrong or expired
  // 2. the code → an access token
  const t = await fetch(`${PSN_AUTH}/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      redirect_uri: PSN_APP.redirect_uri,
      grant_type: 'authorization_code',
      token_format: 'jwt',
    }),
  }).then((r) => r.json());
  if (!t.access_token) return { error: 'npsso' };
  // 3. the played games, 200 at a time
  const games = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const d = await fetch(
      `https://m.np.playstation.com/api/gamelist/v2/users/me/titles?categories=ps4_game,ps5_native_game&limit=200&offset=${offset}`,
      { headers: { Authorization: `Bearer ${t.access_token}` } },
    ).then((r) => r.json());
    for (const g of d.titles || [])
      games.push({
        id: String(g.concept?.id || g.titleId),
        name: g.name,
        minutes: isoMinutes(g.playDuration),
        last: Date.parse(g.lastPlayedDateTime) / 1000 || 0,
        cover: g.imageUrl || '',
        platform: g.category === 'ps5_native_game' ? 'PlayStation 5' : 'PlayStation 4',
      });
    if (!d.nextOffset) break;
  }
  return { games };
}

// ---------- Xbox (through OpenXBL, with the person's own key) ----------
const XBOX_PLATFORMS = { XboxSeries: 'Xbox Series S/X', XboxOne: 'Xbox One', PC: 'PC', Xbox360: 'Xbox 360' };
async function xboxGames(key) {
  // OpenXBL's address is api.xbl.io/v2 (the older xbl.io/api/v2 is tried if it fails)
  const xbl = async (path, init = {}) => {
    for (const base of ['https://api.xbl.io/v2/', 'https://xbl.io/api/v2/']) {
      try {
        const r = await fetch(base + path, {
          ...init,
          headers: {
            'X-Authorization': key,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...init.headers,
          },
        });
        if (r.status === 401 || r.status === 403) return { error: 'key' };
        if (r.ok) return await r.json();
      } catch {}
    }
    return {};
  };
  const acc = await xbl('account');
  if (acc.error) return acc;
  const xuid = (acc.content || acc).profileUsers?.[0]?.id;
  // the games played: /titles, or /titles/{xuid} on some versions of OpenXBL
  let t = await xbl('titles');
  if (!(t.content || t).titles && xuid) t = await xbl(`titles/${xuid}`);
  const titles = (t.content || t).titles || [];
  if (!xuid && !titles.length) return { error: 'key' };
  // hours played: the "MinutesPlayed" stat of each game (not every game reports it)
  const minutes = {};
  try {
    const ids = titles.reduce((a, g) => (g.titleId ? a.concat(g.titleId) : a), []).slice(0, 100);
    const st = await xbl('player/stats', {
      method: 'POST',
      body: JSON.stringify({
        xuids: [xuid],
        stats: ids.map((titleId) => ({ name: 'MinutesPlayed', titleId })),
      }),
    });
    for (const s of (st.content || st).statlistscollection?.[0]?.stats || [])
      minutes[s.titleid] = +s.value || 0;
  } catch {}
  return {
    games: titles.map((g) => ({
      id: String(g.titleId),
      name: g.name,
      minutes: minutes[g.titleId] || 0,
      last: Date.parse(g.titleHistory?.lastTimePlayed) / 1000 || 0,
      cover: g.displayImage || '',
      platform: XBOX_PLATFORMS[(g.devices || []).find((d) => XBOX_PLATFORMS[d])] || 'Xbox Series S/X',
    })),
  };
}

const HELPER_VERSION = 5;

// Counts requests per connection over the last minute (kept in this server's memory, so it's a soft limit)
const recent = new Map();
function tooMany(ip) {
  const now = Date.now();
  const r = recent.get(ip);
  if (!r || now - r.since > 60e3) {
    if (recent.size > 5000) recent.clear();
    recent.set(ip, { since: now, n: 1 });
    return false;
  }
  return ++r.n > 60;
}

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': 'https://spendrax.github.io', // only your app may use it
      'Content-Type': 'application/json',
    };
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    const url = new URL(request.url);

    // a quick "are you there?" you can open in a browser: shows the helper's version
    if (url.pathname === '/ping') return reply({ ok: true, version: HELPER_VERSION });
    // only the app may use the helper (browsers always say which site is asking)
    if (request.headers.get('Origin') !== 'https://spendrax.github.io')
      return reply({ error: 'forbidden' }, 403);
    // at most 60 requests a minute from one connection
    if (tooMany(request.headers.get('CF-Connecting-IP') || '')) return reply({ error: 'busy' }, 429);

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

    if (url.pathname === '/gauth' || url.pathname === '/gtoken') {
      const v = request.method === 'POST' ? (await request.text()).trim() : '';
      const google = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GOOGLE_ID || '',
          client_secret: env.GOOGLE_SECRET || '',
          ...(url.pathname === '/gauth'
            ? { code: v, grant_type: 'authorization_code', redirect_uri: 'postmessage' }
            : { refresh_token: v, grant_type: 'refresh_token' }),
        }),
      }).then((r) => r.json());
      // only what the app needs
      return reply({
        access_token: google.access_token,
        expires_in: google.expires_in,
        refresh_token: google.refresh_token,
        error: google.error,
      });
    }

    if (url.pathname === '/psn') {
      try {
        return reply(await psnGames(request.method === 'POST' ? (await request.text()).trim() : ''));
      } catch {
        return reply({ error: 'down' }, 502);
      }
    }

    if (url.pathname === '/xbox') {
      try {
        return reply(await xboxGames(request.method === 'POST' ? (await request.text()).trim() : ''));
      } catch {
        return reply({ error: 'down' }, 502);
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
