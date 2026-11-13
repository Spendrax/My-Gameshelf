// CLOUDFLARE HELPER — a free Cloudflare Worker that does the lookups a web page isn't allowed to do itself.
//   /?upc=0123456789012     barcode → product name (UPCitemdb blocks calls straight from web pages)
//   /search?q=NAME&key=…   game search: IGDB (every platform), then RAWG, then the Steam store (PC only)
//   /pictures?igdb=ID or ?q=NAME   box art, artwork and screenshots of one game (IGDB)
//   /steam?id=NAME_OR_ID    the Steam games someone owns, with playtime (needs the STEAM_KEY secret)
//   POST /psn  (token in the body)   the PlayStation games someone played, with playtime (unofficial: each
//                           person's own sign-in token from playstation.com; nothing is kept here)
//   POST /xbox (key in the body)     the Xbox games someone played, with playtime when available (each
//                           person's own free OpenXBL key from xbl.io; nothing is kept here)
//   POST /nintendo (JSON body)   the Switch and Switch 2 games someone played, with playtime (unofficial: the
//                           way Nintendo's Store app signs in; nothing is kept here)
//   POST /gauth, /gtoken    Google Drive backup: trades Google's one-time code for a lasting token, and that
//                           token for a short pass (needs the GOOGLE_ID and GOOGLE_SECRET secrets)
//   POST /facts (JSON body)  how long games take to beat, and their release dates (IGDB)
//   POST /deals (JSON body)  current sales on wishlist games (IsThereAnyDeal; needs the ITAD_KEY secret)
//   /steam-ach?id=&app=     Steam achievements earned in one game
//   POST /share, /shelf?id=  a shared room: saved in the KV storage, read by the visitor's page
//   /img?u=…                a cover picture, passed through so the app may draw it (Share my shelf)
//   /ping                   "are you there?": open it in a browser to check the helper's version
// Only the app's own site may use it, at most 60 requests a minute per connection.
// Set up: Cloudflare → Workers & Pages → gameshelf-barcode → Edit code → paste this file → Deploy.
// Steam key: Settings → Variables and Secrets → Add → type "Secret", name STEAM_KEY, value = your key → Deploy.
// IGDB (Twitch): two more secrets the same way, TWITCH_ID (Client ID) and TWITCH_SECRET (Client Secret).
// Sale alerts: ITAD_KEY (free API key from isthereanydeal.com/apps/my/), the same way.
// Google Drive backup: GOOGLE_ID (OAuth client ID) and GOOGLE_SECRET (client secret), the same way.

// IGDB needs a Twitch access token; it lasts about two months, so it's kept between requests
let igdbToken = { value: '', until: 0 };

// Asks IGDB (body = IGDB's query language; endpoint = which list, games by default).
// Needs the TWITCH_ID and TWITCH_SECRET secrets.
async function igdb(body, env, endpoint = 'games') {
  if (!env.TWITCH_ID || !env.TWITCH_SECRET) return [];
  // the Twitch access token lasts about two months, so it's kept between requests
  if (Date.now() > igdbToken.until) {
    const t = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_ID}&client_secret=${env.TWITCH_SECRET}&grant_type=client_credentials`,
      { method: 'POST' },
    ).then((r) => r.json());
    igdbToken = { value: t.access_token, until: Date.now() + (t.expires_in - 3600) * 1000 };
  }
  const list = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
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
  // 4. trophies per game (matched by name; skipped quietly if Sony doesn't answer)
  try {
    const tr = await fetch('https://m.np.playstation.com/api/trophy/v1/users/me/trophyTitles?limit=800', {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then((r) => r.json());
    const sum = (o = {}) => (o.bronze || 0) + (o.silver || 0) + (o.gold || 0) + (o.platinum || 0);
    const plain = (s) =>
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const byName = (tr.trophyTitles || []).reduce(
      (m, x) => ((m[plain(x.trophyTitleName)] = [sum(x.earnedTrophies), sum(x.definedTrophies)]), m),
      {},
    );
    for (const g of games) if (byName[plain(g.name)]) g.tro = byName[plain(g.name)];
  } catch {}
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
      // gamerscore earned / possible
      tro: g.achievement?.totalGamerscore
        ? [g.achievement.currentGamerscore || 0, g.achievement.totalGamerscore, 'G']
        : undefined,
      platform: XBOX_PLATFORMS[(g.devices || []).find((d) => XBOX_PLATFORMS[d])] || 'Xbox Series S/X',
    })),
  };
}

// ---------- Nintendo (unofficial, the way the Nintendo Store app signs in) ----------
// The app opens Nintendo's sign-in page; the person copies the "npf5c38e31cd085304b://auth#…" link and the app
// sends it here once with its secret check code (PKCE verifier). That's traded for a sign-in that lasts about
// 2 years ("session"), which the app keeps and sends again on each sync. Nothing is kept here.
const NS_CLIENT = '5c38e31cd085304b';
const NS_AGENT = 'com.nintendo.znej/3.0.3 (iOS/26.0.1)';
const nsPost = (path, body, type) =>
  fetch('https://accounts.nintendo.com/connect/1.0.0/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': type, Accept: 'application/json', 'User-Agent': NS_AGENT },
    body,
  }).then((r) => r.json().catch(() => ({})));

// Which system: from Nintendo's platform name or code, else from the title id (3DS ids start 00040…, Wii U 00050…)
function nsPlatform({ platform = '', titleId = '' }) {
  const p = String(platform);
  if (/3ds|2ds|ctr/i.test(p) || /^00040/.test(titleId)) return 'Nintendo 3DS';
  if (/wii ?u|wup/i.test(p) || /^00050/.test(titleId)) return 'Wii U';
  if (/switch ?2|ounce|bee/i.test(p)) return 'Nintendo Switch 2';
  return 'Nintendo Switch';
}

async function nintendoGames({ link, verifier, session }) {
  if (link) {
    const code = new URLSearchParams(String(link).split('#')[1] || '').get('session_token_code');
    const t = await nsPost(
      'session_token',
      new URLSearchParams({
        client_id: NS_CLIENT,
        session_token_code: code || '',
        session_token_code_verifier: verifier || '',
      }),
      'application/x-www-form-urlencoded',
    );
    if (!t.session_token) return { error: 'link' };
    session = t.session_token;
  }
  const a = await nsPost(
    'token',
    JSON.stringify({
      client_id: NS_CLIENT,
      session_token: session,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
    }),
    'application/json; charset=utf-8',
  );
  if (!a.access_token) return { error: 'session' };
  const r = await fetch('https://app-api.znej.nintendo.com/api/v2.0/users/me/play_histories', {
    headers: {
      Authorization: 'Bearer ' + a.access_token,
      Accept: 'application/json',
      'gentry-locale': 'en-US',
      'User-Agent': NS_AGENT,
    },
  });
  if (!r.ok) return { error: 'down' };
  // a game played on Switch and on Switch 2 comes twice: added together
  const byId = {};
  for (const h of (await r.json()).playHistories || []) {
    const platform = nsPlatform(h);
    const key = h.titleId + (platform.includes('Switch') ? '' : platform);
    const g = (byId[key] ||= {
      id: h.titleId,
      name: h.titleName,
      minutes: 0,
      last: 0,
      cover: h.imageUrl || '',
      platform,
    });
    g.minutes += +h.totalPlayedMinutes || 0;
    g.last = Math.max(g.last, Date.parse(h.lastPlayedAt) / 1000 || 0);
    if (platform === 'Nintendo Switch 2') g.platform = platform;
  }
  return { session, games: Object.values(byId) };
}

// ---------- Game facts: time to beat and release date (IGDB) ----------
// body: { games: [{ key, igdb, name }] } (up to 40). Games without an IGDB id are found by name first.
// Answer: { facts: { key: { beat, rush, full (hours), release (YYYY-MM-DD), igdb } } }
async function gameFacts({ games = [] }, env) {
  const list = games.slice(0, 40);
  await Promise.all(
    list.map(async (g) => {
      if (g.igdb || !g.name) return;
      const r = await igdb(
        `search ${quoted(g.name)}; fields id; where parent_game = null & version_parent = null; limit 1;`,
        env,
      );
      g.igdb = r[0]?.id;
    }),
  );
  const ids = list.reduce((a, g) => (+g.igdb ? a.concat(+g.igdb) : a), []);
  if (!ids.length) return { facts: {} };
  const [times, dates] = await Promise.all([
    igdb(
      `fields game_id,hastily,normally,completely; where game_id = (${ids}); limit 50;`,
      env,
      'game_time_to_beats',
    ),
    igdb(`fields first_release_date; where id = (${ids}); limit 50;`, env),
  ]);
  const h = (s) => (s ? Math.round(s / 360) / 10 : 0); // seconds → hours with one decimal
  const facts = {};
  for (const g of list) {
    if (!+g.igdb) continue;
    const t = times.find((x) => x.game_id === +g.igdb) || {};
    const d = dates.find((x) => x.id === +g.igdb)?.first_release_date;
    facts[g.key] = {
      igdb: +g.igdb,
      beat: h(t.normally),
      rush: h(t.hastily),
      full: h(t.completely),
      release: d ? new Date(d * 1000).toISOString().slice(0, 10) : '',
    };
  }
  return { facts };
}

// ---------- Sales on wishlist games (IsThereAnyDeal) ----------
// body: { games: [{ key, name, steam }], country: 'CA' }. Answer: { deals: { key: { cut, price, currency, shop, url } } }
// With all: true, every game's lowest price today, on sale or not (what your library is worth): { price, regular }
async function gameDeals({ games = [], country = 'US', all = false }, env) {
  if (!env.ITAD_KEY) return { error: 'no-key' };
  const itad = (path, body) =>
    fetch(`https://api.isthereanydeal.com/${path}${path.includes('?') ? '&' : '?'}key=${env.ITAD_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : {}));
  const list = games.slice(0, 100);
  // IsThereAnyDeal's id for each game: by Steam app when there is one, else by name
  const bySteam = await itad(
    'lookup/id/shop/61/v1',
    list.reduce((a, g) => (g.steam ? a.concat(`app/${g.steam}`) : a), []),
  );
  const byName = await itad(
    'lookup/id/title/v1',
    list.reduce((a, g) => (!g.steam ? a.concat(g.name) : a), []),
  );
  // console names often differ from the PC one ("… – Remastered", "… PS4 & PS5"): a second try, cleaned up
  const clean = (t) =>
    t
      .replace(/[™®©]/g, '')
      .replace(
        /\s*[-–—:]?\s*\b(ps4|ps5|ps4 (&|and) ps5|xbox( series x\|s| one)?|nintendo switch( 2)?( edition)?|remastered|definitive edition|complete edition|deluxe edition|game of the year edition|goty)\b.*$/i,
        '',
      )
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
  const missed = list.reduce(
    (a, g) => (!g.steam && !byName[g.name] && clean(g.name) !== g.name ? a.concat(g) : a),
    [],
  );
  const byClean = missed.length
    ? await itad(
        'lookup/id/title/v1',
        missed.map((g) => clean(g.name)),
      )
    : {};
  const idOf = list.reduce((m, g) => {
    const id = g.steam ? bySteam[`app/${g.steam}`] : byName[g.name] || byClean[clean(g.name)];
    if (id) m[id] = g.key;
    return m;
  }, {});
  const ids = Object.keys(idOf);
  if (!ids.length) return { deals: {} };
  const prices = await itad(
    `games/prices/v3?country=${encodeURIComponent(country)}${all ? '' : '&deals=true'}`,
    ids,
  );
  const deals = {};
  for (const p of Array.isArray(prices) ? prices : []) {
    if (all) {
      // Steam's price when Steam sells it, else the lowest store price
      const low =
        (p.deals || []).find((d) => d.shop?.id === 61) ||
        (p.deals || []).reduce((b, d) => (!b || d.price?.amount < b.price?.amount ? d : b), null);
      if (low)
        deals[idOf[p.id]] = {
          price: low.price?.amount,
          regular: low.regular?.amount,
          currency: low.price?.currency,
        };
      continue;
    }
    const best = (p.deals || []).reduce((b, d) => (d.cut > (b?.cut || 0) ? d : b), null);
    if (best)
      deals[idOf[p.id]] = {
        cut: best.cut,
        price: best.price?.amount,
        currency: best.price?.currency,
        shop: best.shop?.name,
        url: best.url,
      };
  }
  return { deals };
}

const HELPER_VERSION = 12;

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
    // a cover from a known picture site, passed through with permission for the app to draw it
    if (url.pathname === '/img') {
      let u;
      try {
        u = new URL(url.searchParams.get('u'));
      } catch {
        return reply({ error: 'bad' }, 400);
      }
      const ok =
        /(^|\.)(igdb\.com|steamstatic\.com|steampowered\.com|playstation\.(com|net)|s-microsoft\.com|xboxlive\.com|nintendo\.(com|net)|rawg\.io)$/;
      if (u.protocol !== 'https:' || !ok.test(u.hostname)) return reply({ error: 'bad' }, 400);
      const r = await fetch(u, { cf: { cacheTtl: 86400 } });
      if (!r.ok || !/^image\//.test(r.headers.get('Content-Type') || '')) return reply({ error: 'bad' }, 404);
      return new Response(r.body, {
        headers: {
          'Content-Type': r.headers.get('Content-Type'),
          'Access-Control-Allow-Origin': 'https://spendrax.github.io',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

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

    // A shared room (35-share-room.js). POST /share saves or updates it (only with its secret key), or
    // removes it; /shelf?id= reads it for a visitor. Kept in the KV storage named in wrangler.toml.
    if (url.pathname === '/share' || url.pathname === '/shelf') {
      if (!env.KV) return reply({ error: 'no-kv' }, 500);
      if (url.pathname === '/shelf') {
        const d = await env.KV.get('shelf:' + (url.searchParams.get('id') || ''), 'json');
        return d ? reply({ data: d.data, at: d.at }) : reply({ error: 'gone' }, 404);
      }
      const text = await request.text();
      if (text.length > 900000) return reply({ error: 'too-big' }, 413);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return reply({ error: 'bad' }, 400);
      }
      const code = (n) =>
        [...crypto.getRandomValues(new Uint8Array(n))].map((b) => (b % 36).toString(36)).join('');
      let { id, key } = body;
      if (id) {
        const cur = await env.KV.get('shelf:' + id, 'json');
        if (!cur || cur.key !== key) return reply({ error: 'forbidden' }, 403);
        if (body.off) {
          await env.KV.delete('shelf:' + id);
          return reply({ ok: true });
        }
      } else {
        id = code(10);
        key = code(24);
      }
      await env.KV.put('shelf:' + id, JSON.stringify({ key, data: body.data, at: Date.now() }));
      return reply({ id, key });
    }

    if (url.pathname === '/facts' || url.pathname === '/deals') {
      try {
        const body = await request.json().catch(() => ({}));
        return reply(await (url.pathname === '/facts' ? gameFacts : gameDeals)(body, env));
      } catch {
        return reply({ error: 'down' }, 502);
      }
    }

    if (url.pathname === '/nintendo') {
      try {
        return reply(await nintendoGames(await request.json().catch(() => ({}))));
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

    // Steam achievements of one game: /steam-ach?id=<17-digit Steam ID>&app=<app id> → { done, total }
    if (url.pathname === '/steam-ach') {
      if (!env.STEAM_KEY) return reply({ error: 'no-key' }, 500);
      const id = url.searchParams.get('id') || '';
      const app = url.searchParams.get('app') || '';
      if (!/^\d{17}$/.test(id) || !/^\d+$/.test(app)) return reply({ error: 'bad' }, 400);
      const r = await fetch(
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${env.STEAM_KEY}&steamid=${id}&appid=${app}`,
      );
      const list = (await r.json().catch(() => ({}))).playerstats?.achievements || [];
      return reply({ done: list.reduce((n, a) => n + (a.achieved ? 1 : 0), 0), total: list.length });
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
