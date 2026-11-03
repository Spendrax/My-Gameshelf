'use strict';
// CORE — loaded first. Everything the other files share:
//   • the game list and settings, and saving them on the phone (localStorage)
//   • a tiny event system: emit('change') after any edit, other files listen with on('change', …)
//   • small helpers ($, esc, today, …) and caseHTML(), which draws one game case
const VERSION = '2.7.1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STATUS = {
  playing: { label: 'Playing', color: '#3ef08a' },
  backlog: { label: 'Backlog', color: '#8a8fb0' },
  finished: { label: 'Finished', color: '#ffcf4a' },
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

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const store = (k, v) => {
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

function caseHTML(g, cls = '') {
  const p = platInfo(g.platform);
  return (
    `<button class="case ${cls}" data-id="${g.id}" style="${p.c ? `--pc:${p.c};` : ''}" aria-label="${esc(g.title)}">` +
    `<span class="pb">${esc(p.s)}</span><span class="fb" style="--h:${hue(g.title)}">${esc(g.title)}</span>` +
    (g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" onerror="this.remove()">` : '') +
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
