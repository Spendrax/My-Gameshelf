'use strict';
// PLAY TIMER, STREAK & BUDDY TIME
//   • Play timer: "⏱ Start playing" on a game card. A chip shows the time while you play; stop it and the
//     hours are added to the game. It keeps counting if you close the app (set.timer = { id, start }).
//   • Play log & streak: every day you play (timer, +1 h, more hours typed in, or hours from a sync) is
//     written in set.log ({ 'YYYY-MM-DD': minutes }). Days in a row = your streak, shown on the Goals wall.
//   • Your buddy cheers you on while the timer runs (and tells you when it's late).
//   • Daily treats: a 15-second mini-game on the Goals wall, once a day. Catch the falling treats!

set.log ||= {};
const dayKey = (n = 0) =>
  new Date(Date.now() - n * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

on('played', (minutes) => {
  if (!(minutes > 0)) return;
  const d = today();
  set.log[d] = Math.min(1440, (set.log[d] || 0) + Math.round(minutes));
  // keep about a year and a bit
  const old = dayKey(400);
  for (const k in set.log) if (k < old) delete set.log[k];
  saveSet();
  drawChip();
});

// Days in a row with some play, up to today (or yesterday, if you haven't played yet today)
function streak() {
  let n = 0;
  for (let i = set.log[today()] ? 0 : 1; set.log[dayKey(i)]; i++) n++;
  return n;
}
function bestStreak() {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of Object.keys(set.log).sort()) {
    if (!set.log[d]) continue;
    const next = prev && new Date(new Date(prev + 'T12:00').getTime() + 864e5).toISOString().slice(0, 10);
    run = d === next ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/* ---------- The timer ---------- */

const mins = () => (set.timer ? (Date.now() - set.timer.start) / 6e4 : 0);
const clock = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

function startTimer(g) {
  if (set.timer) stopTimer();
  set.timer = { id: g.id, start: Date.now() };
  if (g.status !== 'playing' && g.status !== 'onoff') {
    g.status = 'playing';
    g.started ||= today();
    g.updated = Date.now();
    save();
  }
  saveSet();
  drawChip();
  if (pet.sleeping) wake();
  petClass('cheer', 1200);
  say(`Have fun with ${g.title}! 🎮`);
}

function stopTimer() {
  const g = byId(set.timer?.id);
  let m = mins();
  set.timer = null;
  saveSet();
  drawChip();
  if (!g || m < 1) return toast('Timer stopped');
  if (m > 12 * 60 && !confirm(`The timer ran ${clock(m)}. Add it all?`)) m = 0;
  const h = Math.round(m / 6) / 10;
  if (!h) return;
  g.hours = Math.round(((+g.hours || 0) + h) * 10) / 10;
  g.updated = Date.now();
  emit('played', m);
  save();
  toast(`+${h} h on ${g.title}`);
}

// A chip at the bottom of the screen: the running timer, else your streak
const chip = document.createElement('button');
chip.id = 'playChip';
chip.className = 'play-chip';
document.body.append(chip);
function drawChip() {
  const g = byId(set.timer?.id);
  const s = streak();
  chip.hidden = !g && s < 2;
  chip.classList.toggle('on', !!g);
  chip.innerHTML = g
    ? `⏱ ${esc(g.title)} <b>${clock(mins())}</b> <span aria-label="Stop">■</span>`
    : `🔥 ${s} days`;
  chip.title = g ? 'Stop the timer' : 'Play streak';
}
chip.onclick = () => (set.timer ? stopTimer() : go(WALLS.goals));
setInterval(() => set.timer && drawChip(), 15e3);
if (set.timer && !byId(set.timer.id)) set.timer = null;
drawChip();

// On the game card
CARD_EXTRAS.push((g) =>
  set.timer?.id === g.id
    ? `<button class="btn primary wide" data-t="stop">■ Stop timer (${clock(mins())})</button>`
    : `<button class="btn wide" data-t="start">⏱ Start playing</button>`,
);
$('#gBody').addEventListener('click', (e) => {
  const t = e.target.closest('[data-t]')?.dataset.t;
  const g = byId(curId);
  if (!t || !g) return;
  t === 'start' ? startTimer(g) : stopTimer();
  openGame(g.id);
});

// The buddy keeps you company while you play
setInterval(() => {
  const g = byId(set.timer?.id);
  if (!g || pet.sleeping || document.hidden || Math.random() < 0.4) return;
  const h = new Date().getHours();
  const late = h >= 23 || h < 4;
  const lines = late
    ? ['It’s late… one more level? 😴', '*yawn* Still playing?', 'Bedtime soon, player one 🌙']
    : [
        `Go go go! 🎮`,
        `${g.title}! My favorite!`,
        'Is it hard? 👀',
        'You got this! 💪',
        `${clock(mins())} already!`,
      ];
  say(lines[Math.floor(Math.random() * lines.length)], 3200);
}, 60e3);

/* ---------- Goals wall: streak and daily treats ---------- */

GOALS_EXTRAS.push(() => {
  const s = streak();
  const week = Array.from({ length: 7 }, (_, i) => set.log[dayKey(6 - i)] || 0);
  const top = Math.max(60, ...week);
  const played = set.treatDay === today();
  return `<div class="card"><h3>🔥 Play streak</h3>
    <p class="streak"><b>${s}</b> ${s === 1 ? 'day' : 'days'} in a row<span class="dim"> · Best: ${bestStreak()}</span></p>
    <div class="week">${week.reduce((h, m, i) => h + `<div><i style="height:${Math.max(3, (m / top) * 46)}px"></i>${new Date(dayKey(6 - i) + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</div>`, '')}</div>
    <p class="dim small">Play a little every day: the timer, +1 h and syncs all count.</p>
    <h3 style="margin-top:12px">🍪 Daily treats</h3>
    ${played ? `<p class="dim">${esc(set.pet)} is full. Come back tomorrow!</p>` : `<button class="btn primary wide" id="treats">Catch treats for ${esc(set.pet)}</button>`}
  </div>`;
});
$('#view-goals').addEventListener('click', (e) => e.target.closest('#treats') && treatGame());

function treatGame() {
  if (set.treatDay === today()) return;
  const box = document.createElement('div');
  box.className = 'treats';
  box.innerHTML = '<p>Catch the treats! <b>0</b></p>';
  document.body.append(box);
  let score = 0;
  const drop = setInterval(() => {
    const t = document.createElement('span');
    t.textContent = ['🍪', '🍖', '🐟', '🦴', '🧁'][Math.floor(Math.random() * 5)];
    t.style.left = 8 + Math.random() * 80 + '%';
    t.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
    t.onpointerdown = () => {
      score++;
      box.querySelector('b').textContent = score;
      t.remove();
    };
    t.onanimationend = () => t.remove();
    box.append(t);
  }, 420);
  setTimeout(() => {
    clearInterval(drop);
    box.remove();
    set.treatDay = today();
    saveSet();
    emit('fed'); // counts for the "Best Friends" medal
    renderWalls();
    petClass('eat', 2000);
    say(
      score >= 20
        ? `${score} treats!! Best day ever! 🎉`
        : score
          ? `Yum! ${score} treats! 🍪`
          : 'Aww… next time? 🥺',
      4000,
    );
  }, 15e3);
}

// Treats are ready: the buddy says so once a day, when you open the app
if (set.treatDay !== today() && games.length)
  setTimeout(() => !pet.sleeping && say('🍪 Treat time! (Goals wall)', 3500), 12e3);
renderWalls();
