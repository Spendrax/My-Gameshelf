'use strict';
// CORE — loaded first. Everything the other files share:
//   • the game list and settings, and saving them on the phone (localStorage)
//   • a tiny event system: emit('change') after any edit, other files listen with on('change', …)
//   • small helpers ($, esc, today, …) and caseHTML(), which draws one game case
const VERSION = '4.9';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STATUS = {
  playing: { label: 'Playing', color: '#3ef08a' },
  onoff: { label: 'On & off', color: '#c08bff' }, // played now and then
  paused: { label: 'On hold', color: '#5fd4c4' }, // stopped for now, but coming back to it
  backlog: { label: 'Backlog', color: '#8a8fb0' },
  finished: { label: 'Finished', color: '#ffcf4a' },
  enough: { label: 'Played enough', color: '#ffa05c' }, // the "finished" of never-ending games
  dropped: { label: 'Dropped', color: '#ff5c7a' },
  wishlist: { label: 'Wishlist', color: '#6ac8ff' },
};
const PLATFORMS = [
  'PC',
  'PlayStation 5',
  'PlayStation 4',
  'Xbox Series S/X',
  'Xbox One',
  'Nintendo Switch',
  'Nintendo Switch 2',
  'Steam Deck',
  'iOS',
  'Android',
  'Retro',
];
// Your Cloudflare helper (tools/cloudflare-helper.js): barcode lookups and Steam sync go through it
const HELPER = 'https://gameshelf-barcode.spendraxapp.workers.dev';

// The app's shared RAWG key, so search works right after install. A key pasted in Settings overrides it.
const RAWG_KEY = '7f3923520cce4d189f06b7a59ab3c8c1';
const rawgKey = () => set.key || RAWG_KEY;
const LEDS = ['#b05cff', '#00e5ff', '#ff3fa4', '#39ff88', '#ffb020', '#ff4646'];

// Visiting someone's shared room (./?view=ID, opened by shelf.html): their games and room are read from
// this tab's memory, and nothing is saved, so the visitor's own shelf on this phone is never touched.
const VIEW = new URLSearchParams(location.search).get('view');
let viewData = null;
if (VIEW) {
  try {
    viewData = JSON.parse(sessionStorage.getItem('view:' + VIEW));
  } catch {}
  if (!viewData) location.replace('shelf.html?id=' + encodeURIComponent(VIEW));
  viewData ||= {};
  document.documentElement.classList.add('viewing');
}

// A shared room comes from someone else (anyone can store anything at the helper), so before a visitor's
// app uses it, every field is checked and rebuilt from scratch: known statuses, numbers as numbers, dates as
// dates, covers as plain https links, and text without characters that could become code. Nothing else.
const TXT = (s, n = 120) =>
  String(s ?? '')
    .replace(/[<>"`\\]/g, '')
    .slice(0, n);
const NUM = (x, max = 1e7) => (Number.isFinite(+x) ? Math.min(Math.max(+x, 0), max) : 0);
const DAY = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '');
const WORD = (s) => (/^[\w#.-]{0,30}$/.test(s) ? s : '');
const LIST = (a, f) => (Array.isArray(a) ? a.slice(0, 50).map(f) : []);
function cleanGames(list) {
  return (Array.isArray(list) ? list.slice(0, 5000) : []).map((g = {}) => ({
    id: /^[\w-]{1,40}$/.test(g.id) ? g.id : 'x' + Math.random().toString(36).slice(2),
    title: TXT(g.title) || '?',
    platform: TXT(g.platform, 40),
    status: Object.hasOwn(STATUS, g.status) ? g.status : 'backlog',
    rating: Math.round(NUM(g.rating, 10)),
    hours: NUM(g.hours, 1e5),
    year: Math.round(NUM(g.year, 3000)) || '',
    genres: LIST(g.genres, (x) => TXT(x, 30)),
    tags: LIST(g.tags, (x) => TXT(x, 30)),
    started: DAY(g.started),
    finished: DAY(g.finished),
    added: NUM(g.added, 1e14),
    cover: /^https:\/\/[^\s"'()\\<>]{1,500}$/.test(g.cover) ? g.cover : '',
    format: ['physical', 'digital'].includes(g.format) ? g.format : '',
    facts: g.facts && {
      beat: NUM(g.facts.beat, 1e4),
      rush: NUM(g.facts.rush, 1e4),
      full: NUM(g.facts.full, 1e4),
      release: DAY(g.facts.release),
      at: NUM(g.facts.at, 1e14),
    },
    tro: Array.isArray(g.tro)
      ? [NUM(g.tro[0]), NUM(g.tro[1]), g.tro[2] === 'G' ? 'G' : undefined]
      : undefined,
    merged: LIST(g.merged, (p = {}) => ({ platform: TXT(p.platform, 40), hours: NUM(p.hours, 1e5) })),
    beatenOn: LIST(g.beatenOn, (d) => DAY(d) || 'past'),
  }));
}
function cleanSet(s = {}) {
  const look = Object.entries(s.look || {}).reduce((a, [k, v]) => {
    if (k === 'loc' || !/^\w{1,20}$/.test(k)) return a; // never someone's location
    a[k] =
      k === 'sign' || k === 'fname' ? TXT(v, 24) : Array.isArray(v) ? LIST(v, WORD) : WORD(String(v ?? ''));
    return a;
  }, {});
  const ach = s.ach || {};
  return {
    pet: TXT(s.pet, 24) || 'Byte',
    led: /^#[0-9a-f]{3,8}$/i.test(s.led) ? s.led : '#b05cff',
    goal: Math.round(NUM(s.goal, 999)) || 12,
    look,
    rackOpen: Object.keys(s.rackOpen || {}).reduce(
      (a, k) => (Object.hasOwn(STATUS, k) ? ((a[k] = !!s.rackOpen[k]), a) : a),
      {},
    ),
    ach: {
      pets: NUM(ach.pets),
      feeds: NUM(ach.feeds),
      owl: !!ach.owl,
      done: LIST(ach.done, WORD),
      keep: LIST(ach.keep, (x) => (/^\w+:[\w-]*$/.test(x) ? x : '')),
    },
    log: Object.keys(s.log || {}).reduce((a, d) => (DAY(d) ? ((a[d] = NUM(s.log[d], 1440)), a) : a), {}),
    steamSynced: NUM(s.steamSynced, 1e14),
    psnSynced: NUM(s.psnSynced, 1e14),
    xboxSynced: NUM(s.xboxSynced, 1e14),
    nsSynced: NUM(s.nsSynced, 1e14),
    owner: TXT(s.owner, 30),
    toured: true,
    seen: VERSION,
    lang: 'auto',
  };
}

const load = (k, d) => {
  if (VIEW) return k === 'gr.games' ? cleanGames(viewData[k]) : k === 'gr.set' ? cleanSet(viewData[k]) : d; // nothing else from a shared copy is used
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const store = (k, v) => {
  if (VIEW) return ((viewData[k] = v), true); // visiting: kept for this visit only
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    toast('Storage is full: save a backup and use smaller pictures');
    return false;
  }
};

let games = load('gr.games', []);
const set = Object.assign({ pet: 'Byte', led: LEDS[0], key: '', goal: 12 }, load('gr.set', {}));

const listeners = {};
const on = (e, f) => (listeners[e] ??= []).push(f);
const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));
const save = () => {
  store('gr.games', games);
  emit('change');
};
const saveSet = () => store('gr.set', set);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const byId = (id) => games.find((g) => g.id === id);
const rand = (a) => a[Math.floor(Math.random() * a.length)];

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

// Platform colour band on top of each case
function platInfo(p = '') {
  const c = /ps|playstation/i.test(p)
    ? '#2f6bff'
    : /xbox/i.test(p)
      ? '#1f9e45'
      : /switch|nintendo|wii|3ds|gamecube|game ?boy/i.test(p)
        ? '#e60012'
        : /pc|steam|windows|mac|linux/i.test(p)
          ? '#4d5363'
          : '';
  const s =
    p
      .replace(/PlayStation\s*/i, 'PS')
      .replace(/Nintendo\s*/i, '')
      .replace(/Xbox Series S\/X/i, 'Xbox Series')
      .toUpperCase()
      .slice(0, 16) || 'GAME';
  return { c, s };
}

// Places later files can add to without editing these: each is a list of functions that return HTML.
//   CASE_BADGES(g): little tags on a game case · CARD_EXTRAS(g): lines on the game card
//   STATS_EXTRAS() / GOALS_EXTRAS(): cards on the Stats and Goals walls
// Finished, or finished before and playing it again (31-replay.js)
const beaten = (g) => g.status === 'finished' || !!g.beatenOn?.length;
const CASE_BADGES = [];
const CARD_EXTRAS = [];
const STATS_EXTRAS = [];
const GOALS_EXTRAS = [];
const GOALS_FIRST = []; // cards at the top of the Goals wall (the play timer)
const extras = (list, g) => list.reduce((h, f) => h + f(g), '');

function caseHTML(g, cls = '') {
  const p = platInfo(g.platform);
  return (
    `<button class="case ${cls}" data-id="${g.id}" style="${p.c ? `--pc:${p.c};` : ''}" aria-label="${esc(g.title)}">` +
    `<span class="pb">${esc(p.s)}</span><span class="fb" style="--h:${hue(g.title)}">${esc(g.title)}</span>` +
    (g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" onerror="this.remove()">` : '') +
    extras(CASE_BADGES, g) +
    `<i class="dot" style="--sc:${STATUS[g.status]?.color || '#888'}"></i></button>`
  );
}
// Any case anywhere opens its game
document.addEventListener('click', (e) => {
  const c = e.target.closest('.case[data-id]');
  if (c && !c.closest('#dlgGame')) openGame(c.dataset.id);
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
});
// Tapping the dark backdrop closes a sheet
$$('dialog').forEach((d) =>
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  }),
);
