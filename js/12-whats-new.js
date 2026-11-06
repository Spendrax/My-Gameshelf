'use strict';
// WHAT'S NEW — after an important update, a card lists what changed (newest first).
// To announce an update: add an entry at the top of NEWS with the new VERSION.
// Small fixes don't need an entry. The card is also in Settings → "What's new".

const NEWS = [
  { v: '4.1', items: ['Filter your rack by platform', 'Calm mode in Settings: fewer animations, less battery'] },
  {
    v: '4.0',
    items: ['\u2601 Automatic Google Drive backup that also syncs your devices (Settings)', 'Safer: sign-in tokens never travel in web addresses'],
  },
  { v: '3.9', items: ['Release years (and genres) now fill in by themselves for synced games'] },
  { v: '3.8', items: ['\u{1F3AE} Sync your PlayStation and Xbox games and hours (Settings)'] },
  { v: '3.7', items: ['New status: On hold, for games you stopped but want to get back to'] },
  {
    v: '3.6',
    items: [
      '\u{1F3C6} New Achievements wall (left of Goals): earn medals to unlock hats, animals, walls and window scenes',
      '\u{1F43E} Feed your buddy 10 times to get a second buddy',
    ],
  },
  { v: '3.5', items: ['\u270B \u201cPlayed enough\u201d: the finish line for never-ending games'] },
  { v: '3.4', items: ['\u{1F3C6} Finished an old game? Pick the day you finished it, or \u201ca long time ago\u201d'] },
  { v: '3.3', items: ['Your rack is sorted into sections (Playing, Backlog, Finished\u2026). Tap a section to fold it into one shelf you scroll sideways.'] },
  { v: '3.2', items: ['The Goals wall matches the night room: a dark board with glowing pins'] },
  { v: '3.1', items: ['\u{1F3A8} New buddies: cat, dog, fox, bunny, frog and penguin (Customize \u2192 Your buddy \u2192 Animal)'] },
  {
    v: '3.0',
    items: ['New status: On & off', '\u221E Never-ending games (battle royale, MMO\u2026) in the edit form', 'The monitor shows a wide screenshot of what you\u2019re playing'],
  },
  { v: '2.9', items: ['Game search now uses IGDB: every console, with real box art', 'More cover art and poster pictures to choose from'] },
  { v: '2.7', items: ['\u{1F5BC} Find cover art when you edit a game: pick from its covers, artwork, screenshots and Steam art'] },
  { v: '2.6', items: ['\u{1F3AE} Put one of your games on the poster (Customize \u2192 Poster \u2192 My game). Tap it to open the game.'] },
  {
    v: '2.5',
    items: [
      'New window scenes: city, mountains, beach, forest and space',
      'Pick the time of day and the weather, or go \u{1F30D} Live: your real sunrise, sunset, weather and temperature',
    ],
  },
  {
    v: '2.4',
    items: ['A real window with a sill your buddy can sit on', '\u{1F3A8} Choose the view (real time, city night, stars, sunset, rain, sunny day) and blinds or curtains'],
  },
  {
    v: '2.3',
    items: ['Carry your buddy to another wall: hold him at the edge of the screen', 'At night he goes to bed and sleeps under the blanket \u{1F319}'],
  },
  {
    v: '2.2',
    items: [
      'Your buddy roams the whole bedroom: shelves, desk, monitor, bed, beanbag\u2026 and visits the other walls',
      'Drag him to put him anywhere',
      'Tap a food bowl on the floor to call him for a snack \u{1F356}',
    ],
  },
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
