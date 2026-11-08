'use strict';
// STEAM SYNC — Settings → Steam brings in the games you own on Steam, with their playtime.
// importGames() here is also used by PlayStation and Xbox sync (19-console-sync.js).
// It asks your Cloudflare helper (HELPER/steam), which holds the Steam key as a secret.
// Rules: it never lowers hours you typed yourself and never changes the status of a game you already have.
// It syncs again by itself, quietly, when you open the app and the last sync is over 12 hours old.

// Steam's tall "library" picture of a game (some games don't have one; the case then shows the title)
const steamCover = (appid) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

// Lets "Hollow Knight" on the rack match "Hollow Knight" from Steam, ignoring case and punctuation
const sameTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

// Accepts a profile link (…/id/name or …/profiles/7656…), a profile name, or a 17-digit Steam ID
const steamIdFrom = (text) =>
  (text.match(/steamcommunity\.com\/(?:id|profiles)\/([^/?#]+)/i)?.[1] || text).trim();

const STEAM_ERRORS = {
  private: 'Your Steam “Game details” are private. Set them to Public in your Steam privacy settings.',
  'not-found': 'Steam profile not found. Check the name, or paste your profile link.',
  'no-key': 'The helper is missing its Steam key (STEAM_KEY in Cloudflare).',
};

// System apps and tools that accounts list like games: never added by a sync
const NOT_A_GAME = new RegExp(
  [
    'e ?shop',
    'pok[eé]mon bank',
    'pok[eé] ?transporter',
    'pok[eé]mon home',
    'system settings',
    'system transfer',
    'data (transfer|management)',
    'mii maker',
    'nintendo 3ds (camera|sound)',
    'internet browser',
    'nintendo video',
    'activity log',
    'health (and|&) safety',
    'parental controls',
    'nintendo network id',
    'wii u (chat|menu)',
    'tvii',
    'theme shop',
    'download play',
    'miiverse',
    'youtube',
    'netflix',
    'hulu',
    'disney\\+',
    'crunchyroll',
    'twitch',
    'spotify',
    'prime video',
    'plex',
    'steamvr',
    'proton \\d',
    'steam linux runtime',
    'steamworks',
    'wallpaper engine',
    'soundtrack',
    'dedicated server',
    'benchmark',
    'media player',
    'web browser',
  ].join('|'),
  'i',
);

// Adds games from an account (Steam, PlayStation, Xbox) and tops up their hours. Shared by every sync.
//   items: [{ id, name, minutes, last (seconds since 1970), cover, platform }]
//   field: where the account's id is kept on a game (g.steam / g.psn / g.xbox)
//   platform: the platform for new games when the item has none; sameKind: platforms that count as a match
//   all: also add games with no playtime
// Never lowers hours you typed yourself and never changes the status of a game you already have.
function importGames(items, { field, platform, sameKind, all }) {
  // games already on the rack: linked to this account before, or the same title on a matching platform.
  // A merged game (28-merge.js) keeps the other copy's link in g.merged: its hours are topped up there.
  const linked = new Map(
    games.reduce((a, g) => {
      if (g[field]) a.push([g[field], [g, null]]);
      for (const part of g.merged || []) if (part[field]) a.push([part[field], [g, part]]);
      return a;
    }, []),
  );
  const byTitle = new Map(
    games.reduce(
      (a, g) =>
        !g[field] && (!g.platform || sameKind.test(g.platform)) ? a.concat([[sameTitle(g.title), g]]) : a,
      [],
    ),
  );
  const twoWeeksAgo = Date.now() / 1000 - 14 * 86400;
  let added = 0;
  let updated = 0;
  let played = 0;
  for (const s of items) {
    if (NOT_A_GAME.test(s.name || '')) continue;
    const hours = Math.round(s.minutes / 6) / 10; // minutes → hours with one decimal
    const [g, part] = linked.get(s.id) || [byTitle.get(sameTitle(s.name)), null];
    if (g) {
      // the hours that come from this account: the merged copy's, or the game's own (without merged copies)
      const others = (g.merged || []).reduce((n, p) => n + (+p.hours || 0), 0);
      const mine = part ? +part.hours || 0 : (+g.hours || 0) - others;
      if ((part || g[field]) && hours > mine) played += (hours - mine) * 60; // played since last sync
      // a game first brought in as "Switch" that the account now says is from another system (3DS, Wii U)
      if (
        !part &&
        g[field] === s.id &&
        s.platform &&
        /switch/i.test(g.platform || '') &&
        !/switch/i.test(s.platform)
      )
        g.platform = s.platform;
      if (!part) g[field] = s.id;
      if (s.last) g.lastPlayed = Math.max(g.lastPlayed || 0, s.last * 1000);
      if (hours > mine) {
        if (part) part.hours = hours;
        g.hours = Math.round(((+g.hours || 0) + hours - mine) * 10) / 10;
        g.updated = Date.now();
        updated++;
      }
    } else if (s.minutes > 0 || all) {
      games.push({
        id: uid(),
        title: s.name,
        platform: s.platform || platform,
        status: s.last > twoWeeksAgo ? 'playing' : 'backlog', // played in the last 2 weeks = playing
        rating: 0,
        hours,
        genres: [],
        notes: '',
        cover: s.cover || '',
        [field]: s.id,
        lastPlayed: s.last ? s.last * 1000 : 0,
        added: Date.now(),
        updated: Date.now(),
      });
      added++;
    }
  }
  // system apps a sync brought in before this filter existed (left alone if you rated them or wrote notes)
  const junk = games.reduce(
    (a, g) => (g[field] && NOT_A_GAME.test(g.title) && !g.rating && !g.notes ? a.concat(g.id) : a),
    [],
  );
  if (junk.length) {
    games = games.filter((g) => !junk.includes(g.id));
    set.gone = (set.gone || []).concat(junk.map((id) => ({ id, at: Date.now() }))).slice(-500);
    saveSet();
    updated++;
  }
  if (played) emit('played', played);
  if (added || updated) save();
  return { added, updated };
}

async function steamSync(quiet) {
  if (!set.steam) return;
  if (!quiet) toast('Syncing with Steam…');
  let data;
  try {
    data = await (await fetch(`${HELPER}/steam?id=${encodeURIComponent(steamIdFrom(set.steam))}`)).json();
  } catch {
    if (!quiet) toast('Couldn’t reach Steam. Check your connection.');
    return;
  }
  if (data.error || !data.games) {
    if (!quiet) toast(STEAM_ERRORS[data.error] || 'Steam sync didn’t work. Try again later.');
    return;
  }

  const { added, updated } = importGames(
    data.games.map((g) => ({
      id: g.appid,
      name: g.name,
      minutes: g.minutes,
      last: g.last,
      cover: steamCover(g.appid),
    })),
    { field: 'steam', platform: 'PC', sameKind: /pc|steam/i, all: set.steamAll },
  );

  set.steamSynced = Date.now();
  saveSet();
  if (!quiet || added || updated) toast(`Steam: ${added} games added, ${updated} hours updated`);
}

/* ---------- Settings ---------- */

$('#btnSettings').addEventListener('click', () => {
  $('#sSteam').value = set.steam || '';
  $('#sSteamAll').checked = !!set.steamAll;
});
$('#sSteam').onchange = (e) => {
  set.steam = e.target.value.trim();
  saveSet();
};
$('#sSteamAll').onchange = (e) => {
  set.steamAll = e.target.checked;
  saveSet();
};
$('#sSteamSync').onclick = () => {
  set.steam = $('#sSteam').value.trim();
  saveSet();
  if (!set.steam) return toast('Type your Steam profile name first');
  steamSync(false);
};

// Quiet daily top-up of the hours
if (set.steam && Date.now() - (set.steamSynced || 0) > 12 * 3600e3) setTimeout(() => steamSync(true), 3000);
