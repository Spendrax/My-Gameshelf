'use strict';
// THE BUDDY — a little glowing creature that lives on the desk. It wanders, blinks, naps, talks, and cheers when you finish a game.
const pet = { el: $('#pet'), x: 18, sleeping: false, lastTouch: Date.now(), taps: [], busy: 0 };

function petClass(c, ms) {
  pet.el.classList.add(c);
  pet.busy = Date.now() + ms;
  setTimeout(() => pet.el.classList.remove(c), ms);
}
function say(text, ms = 3600) {
  const b = $('#bubble');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(say.t);
  say.t = setTimeout(() => b.classList.remove('show'), ms);
}
function moveTo(x) {
  x = Math.max(2, Math.min(80, x));
  pet.el.classList.toggle('flip', x < pet.x);
  pet.x = x;
  pet.el.style.setProperty('--x', x + '%');
  petClass('walk', 1800);
}
function sleep() {
  pet.sleeping = true;
  pet.el.classList.add('sleep');
  $('#bubble').classList.remove('show');
}
function wake() {
  pet.sleeping = false;
  pet.el.classList.remove('sleep');
  petClass('wake', 900);
  pet.lastTouch = Date.now();
}

function chatter() {
  const n = (s) => games.reduce((c, g) => c + (g.status === s), 0);
  const playing = games.reduce((a, g) => (g.status === 'playing' ? a.concat(g) : a), []);
  const lines = ['Ready, player one?', 'GG!', 'One more game?', `${set.pet} is here!`, 'Hydrate, gamer. 💧'];
  if (!games.length) lines.push('Tap + to add your first game!', 'This rack looks lonely…');
  if (playing.length)
    lines.push(`Still playing ${rand(playing).title}?`, `How's ${rand(playing).title} going?`);
  if (n('backlog') > 4) lines.push(`${n('backlog')} games in the backlog… 👀`);
  if (n('finished')) lines.push(`${n('finished')} games beaten. Nice!`);
  const h = new Date().getHours();
  if (h >= 23 || h < 5) lines.push('Just one more level… then bed?');
  say(rand(lines));
}

function confetti() {
  const colors = [set.led, '#ffcf4a', '#3ef08a', '#ff3fa4', '#00e5ff', '#fff'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('i');
    c.className = 'cf';
    c.style.cssText = `left:${Math.random() * 100}vw;background:${rand(colors)};animation-duration:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.4}s`;
    document.body.append(c);
    setTimeout(() => c.remove(), 3800);
  }
}
function heart(e) {
  const h = document.createElement('span');
  h.className = 'heart';
  h.textContent = rand(['💜', '💖', '✨', '🎮']);
  h.style.cssText = `left:${e.clientX - 9}px;top:${e.clientY - 20}px`;
  document.body.append(h);
  setTimeout(() => h.remove(), 1000);
}

pet.el.addEventListener('click', (e) => {
  e.stopPropagation();
  pet.lastTouch = Date.now();
  if (pet.sleeping) {
    wake();
    say(rand(['Huh? I was napping…', '*yawn* Hi!', 'Five more minutes…']));
    return;
  }
  heart(e);
  pet.taps = pet.taps.reduce((a, t) => (Date.now() - t < 2500 ? a.concat(t) : a), [Date.now()]);
  if (pet.taps.length >= 5) {
    pet.taps = [];
    petClass('spin', 800);
    say('COMBO x5! 🔥');
  } else petClass('hop', 500);
});

// A small tick decides what the buddy does next
let nextAct = Date.now() + 4000;
setInterval(() => {
  if (document.hidden || view !== 'room') return;
  const now = Date.now(),
    h = new Date().getHours();
  const napAfter = h >= 23 || h < 6 ? 20e3 : 50e3;
  if (!pet.sleeping && now - pet.lastTouch > napAfter && now > pet.busy) return sleep();
  if (pet.sleeping) return;
  if (Math.random() < 0.25) {
    pet.el.classList.add('blink');
    setTimeout(() => pet.el.classList.remove('blink'), 140);
  }
  if (now < nextAct || now < pet.busy) return;
  nextAct = now + 5000 + Math.random() * 6000;
  const r = Math.random();
  if (r < 0.5) moveTo(pet.x + (Math.random() - 0.5) * 60);
  else if (r < 0.68) chatter();
  else if (r < 0.8) petClass('hop', 500);
}, 1000);

on('added', (g) => {
  if (pet.sleeping) wake();
  petClass('hop', 500);
  say(`New game! ${g.title} 🎮`);
});
on('finished', (g) => {
  if (pet.sleeping) wake();
  setTimeout(() => {
    petClass('cheer', 1500);
    say(`Achievement unlocked: ${g.title}! 🏆`, 4500);
    confetti();
  }, 350);
});
on('pet', () => pet.el.setAttribute('aria-label', set.pet));
pet.el.setAttribute('aria-label', set.pet);
pet.el.style.setProperty('--x', pet.x + '%');
setTimeout(
  () => say(games.length ? `Hey! ${set.pet} missed you.` : `Hi, I'm ${set.pet}! Tap + to add a game.`),
  1200,
);
