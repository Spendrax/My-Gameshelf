'use strict';
// THE SECOND BUDDY — unlocked by the "Best Friends" medal (17-achievements.js). It lives on the room floor:
// it wanders, naps (more at night), and says hi when you tap it. Chosen in Customize: on/off, animal,
// name and colour (set.look.fon, fkind, fname, fcolor). It reuses the main buddy's look (.pet, css/buddy.css).

const friend = { el: null, x: 0, y: 0, sleeping: false };

const friendOn = () => unlocked('friend') && set.look.fon !== 'off';

// Where it walks: the room's floor
const roomFloor = () => surfaces().find((s) => s.wall === 'room' && s.floor);

function friendPut(x, y, ms = 0) {
  friend.el.style.transition = ms ? `transform ${ms}ms linear` : 'none';
  friend.x = x;
  friend.y = y;
  friend.el.style.transform = `translate(${x - 27}px, ${y - 50}px)`;
}

function friendSay(text, ms = 3000) {
  const b = friend.el.querySelector('.bubble');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(friendSay.t);
  friendSay.t = setTimeout(() => b.classList.remove('show'), ms);
}

function friendApply() {
  if (!friendOn()) {
    friend.el?.remove();
    friend.el = null;
    return;
  }
  if (!friend.el) {
    // a copy of the main buddy's parts, without his ids
    friend.el = document.createElement('div');
    friend.el.className = 'pet friend';
    friend.el.setAttribute('role', 'button');
    friend.el.innerHTML = pet.el.innerHTML.replace(/ id="[^"]*"/g, '');
    friend.el.querySelector('.hat').className = 'hat';
    friend.el.querySelector('.bubble').classList.remove('show');
    friend.el.addEventListener('click', friendTap);
    $('#view-room').append(friend.el);
    const f = roomFloor();
    friendPut(f.x0 + (f.x1 - f.x0) * 0.7, f.y);
  }
  const kind = set.look.fkind || 'cat';
  friend.el.dataset.kind = kind;
  friend.el.style.setProperty('--pk', set.look.fcolor || KIND_COLOR[kind] || set.led);
  friend.el.setAttribute('aria-label', set.look.fname || 'Pixel');
}

function friendTap(e) {
  e.stopPropagation();
  heart(e);
  if (friend.sleeping) {
    friend.sleeping = false;
    friend.el.classList.remove('sleep');
    return friendSay('*yawn*… hi!');
  }
  friend.el.classList.add('hop');
  setTimeout(() => friend.el?.classList.remove('hop'), 500);
  friendSay(
    rand([`I'm ${set.look.fname || 'Pixel'}!`, `${set.pet} is my best friend!`, 'Play with me! 🎮', '💜']),
  );
}

// Every few seconds: wander, nap or blink
setInterval(() => {
  if (!friend.el || document.hidden) return;
  const f = roomFloor();
  if (Math.abs(f.y - friend.y) > 1) friendPut(friend.x, f.y); // the floor moved (shelves folded, games added)
  if (friend.sleeping) {
    if (Math.random() < 0.08) {
      friend.sleeping = false;
      friend.el.classList.remove('sleep');
    }
    return;
  }
  const r = Math.random();
  if (r < 0.12 || (night() && r < 0.3)) {
    friend.sleeping = true;
    friend.el.classList.add('sleep');
  } else if (r < 0.5) {
    const x = f.x0 + 30 + Math.random() * (f.x1 - f.x0 - 60);
    const ms = (Math.abs(x - friend.x) / 60) * 1000;
    friend.el.classList.toggle('flip', x < friend.x);
    friend.el.classList.add('walk');
    friendPut(x, f.y, ms);
    setTimeout(() => friend.el?.classList.remove('walk'), ms);
  } else if (r < 0.6) {
    friend.el.classList.add('blink');
    setTimeout(() => friend.el?.classList.remove('blink'), 140);
  }
}, 4000);

on('look', friendApply);
friendApply();
