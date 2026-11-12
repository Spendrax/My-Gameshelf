'use strict';
// FIRST-RUN TOUR — five short tips the first time the app opens (set.toured), so new people know the
// room turns, games drag, and the buddy eats. Settings → Display → "Show the tips again" replays it.

const TOUR = [
  [
    '🎮',
    'Add your games',
    'Tap + to search for a game or scan its case. Or connect Steam, PlayStation, Xbox and Nintendo in Settings ⚙ to bring everything in at once.',
  ],
  [
    '👉',
    'Your room has four walls',
    'Swipe left or right: Achievements, Goals, your Room and Stats are all in the same bedroom.',
  ],
  [
    '✋',
    'Hold and drag',
    'Hold a game, then drop it on another section to change its status. Tap a section’s title to fold or open it.',
  ],
  [
    '⏱',
    'Track your play',
    'Open a game and tap Start playing. The timer adds your hours and keeps your daily streak going.',
  ],
  [
    '🐾',
    'Meet your buddy',
    'Tap to pet, drag to move, tap a bowl to feed. Dress up the room and your buddy with 🎨.',
  ],
];

const dlgTour = document.createElement('dialog');
dlgTour.id = 'dlgTour';
dlgTour.className = 'sheet';
dlgTour.innerHTML = `<div class="tour"><span id="tIcon"></span><h2 id="tTitle"></h2><p id="tText"></p><div class="tour-dots" id="tDots"></div></div>
  <div class="actions"><button class="btn" id="tSkip">Skip</button><button class="btn primary" id="tNext"></button></div>`;
document.body.append(dlgTour);

let tourAt = 0;
function drawTour() {
  const [icon, title, text] = TOUR[tourAt];
  $('#tIcon').textContent = icon;
  $('#tTitle').textContent = title;
  $('#tText').textContent = text;
  $('#tDots').innerHTML = TOUR.reduce((h, _, i) => h + `<i class="${i === tourAt ? 'on' : ''}"></i>`, '');
  $('#tNext').textContent = tourAt < TOUR.length - 1 ? 'Next' : 'Let’s play!';
  $('#tSkip').hidden = tourAt === TOUR.length - 1;
}
function startTour() {
  tourAt = 0;
  drawTour();
  dlgTour.showModal();
}
const endTour = () => {
  set.toured = true;
  saveSet();
  dlgTour.close();
};
$('#tNext').onclick = () => (tourAt < TOUR.length - 1 ? (tourAt++, drawTour()) : endTour());
$('#tSkip').onclick = endTour;
dlgTour.addEventListener('close', endTour);
$('#sTour').onclick = () => {
  $('#dlgSet').close();
  startTour();
};

// once, a moment after the first launch (after the What's new card, if it shows)
if (!set.toured) setTimeout(() => document.querySelector('dialog[open]') || startTour(), 1500);
