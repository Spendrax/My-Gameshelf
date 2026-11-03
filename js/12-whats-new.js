'use strict';
// WHAT'S NEW — after an important update, a card lists what changed (newest first).
// To announce an update: add an entry at the top of NEWS with the new VERSION.
// Small fixes don't need an entry. The card is also in Settings → "What's new".

const NEWS = [
  { v: '2.1', items: ['The room is a real bedroom now: a window, a floor, a trophy shelf on the Stats wall, a bed and a corkboard on the Goals wall'] },
  {
    v: '2.0',
    items: ['Steam sync: bring in your Steam games and their hours (Settings \u2192 Steam)', 'Barcode scanning now recognises most games'],
  },
  {
    v: '1.9',
    items: [
      '\u{1F4F7} Scan a game case to add it: the barcode on the back, or the title on the front cover',
      'Bigger close button on the game card that stays at the top',
    ],
  },
  { v: '1.4', items: ['Hats now fit the buddy’s head and turn with him'] },
  {
    v: '1.3',
    items: [
      '\u{1F3A8} Customize: LED colour, wall, shelves, poster, neon sign, desk items, the buddy’s colour and hat',
    ],
  },
  { v: '1.2', items: ['An “Update now” button shows up when a new version is ready'] },
  { v: '1.1', items: ['Swipe round the room: Goals ← Room → Stats'] },
];

// Compares versions number by number, so 1.10 comes after 1.9
const newer = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};

function showNews(since) {
  const list = NEWS.reduce(
    (h, n) =>
      !since || newer(n.v, since)
        ? h + `<h3>Version ${n.v}</h3><ul>${n.items.reduce((li, t) => li + `<li>${esc(t)}</li>`, '')}</ul>`
        : h,
    '',
  );
  if (!list) return;
  $('#newsBody').innerHTML = list;
  $('#dlgNews').showModal();
}

// Brand-new installs (no games, never saw a version) skip the card
if (!set.seen && games.length) set.seen = '1.0';
const lastSeen = set.seen; // read before it's updated below
if (lastSeen && newer(VERSION, lastSeen)) setTimeout(() => showNews(lastSeen), 900);
set.seen = VERSION;
saveSet();

$('#sNews').onclick = () => {
  $('#dlgSet').close();
  showNews();
};
