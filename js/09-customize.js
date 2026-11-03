'use strict';
// CUSTOMIZE — the 🎨 sheet: LED colour, wall, shelves, poster, neon sign, desk items, and the buddy's name, colour and hat.
const LOOK = {
  wall: 'night',
  shelf: 'glow',
  poster: 'synth',
  sign: 'PLAY',
  signColor: '#ff3fa4',
  petColor: '',
  hat: '',
  sky: 'auto', // the view out of the window
  dress: 'blinds', // blinds, curtains or nothing
  curtain: '#8a3a5c',
  shade: 'half', // blinds/curtains: closed, half or open (tap the window)
  hide: [],
};
set.look = Object.assign({}, LOOK, set.look);
set.look.hat =
  { '👑': 'crown', '🎧': 'headset', '🧢': 'cap', '🎀': 'bow', '🎩': 'tophat' }[set.look.hat] ?? set.look.hat;
const OPTS = {
  wall: [
    ['night', 'Night'],
    ['blue', 'Midnight'],
    ['charcoal', 'Charcoal'],
    ['synth', 'Synthwave'],
    ['forest', 'Forest'],
  ],
  shelf: [
    ['glow', 'LED'],
    ['wood', 'Wood'],
    ['metal', 'Metal'],
  ],
  poster: [
    ['synth', 'Sunset'],
    ['space', 'Space'],
    ['retro', '1UP'],
    ['none', 'None'],
  ],
  sky: [
    ['auto', '\u{1F552} Real time'],
    ['city', 'City night'],
    ['stars', 'Starry sky'],
    ['sunset', 'Sunset'],
    ['rain', 'Rain'],
    ['day', 'Sunny day'],
  ],
  dress: [
    ['blinds', 'Blinds'],
    ['curtains', 'Curtains'],
    ['none', 'Nothing'],
  ],
  hat: [
    ['', 'None'],
    ['crown', '👑 Crown'],
    ['headset', '🎧 Headset'],
    ['cap', '🧢 Cap'],
    ['bow', '🎀 Bow'],
    ['tophat', '🎩 Top hat'],
  ],
  desk: [
    ['mug', 'Mug'],
    ['plant', 'Plant'],
    ['pad', 'Controller'],
    ['console', 'Console'],
  ],
};

// "Real time": the window shows what the sky looks like right now
function windowView(sky) {
  if (sky !== 'auto') return sky;
  const h = new Date().getHours();
  return h >= 8 && h < 18 ? 'day' : h >= 6 && h < 20 ? 'sunset' : 'city';
}
setInterval(() => set.look.sky === 'auto' && (document.body.dataset.sky = windowView('auto')), 5 * 60e3);

function applyLook() {
  const l = set.look,
    b = document.body,
    r = document.documentElement.style;
  Object.assign(b.dataset, {
    wall: l.wall,
    shelf: l.shelf,
    poster: l.poster,
    sky: windowView(l.sky),
    dress: l.dress,
    shade: l.shade,
  });
  r.setProperty('--led', set.led);
  r.setProperty('--sign', l.signColor);
  r.setProperty('--curtain', l.curtain);
  if (l.petColor) r.setProperty('--pet', l.petColor);
  else r.removeProperty('--pet');
  const t = l.sign || 'PLAY';
  $('.sign').innerHTML = esc(t[0]) + `<span>${esc(t.slice(1, 2))}</span>` + esc(t.slice(2));
  $('#hat').className = 'hat ' + l.hat;
  OPTS.desk.forEach(([k]) => b.classList.toggle('no-' + k, l.hide.includes(k)));
}

const chips = (k, list, cur) =>
  `<div class="seg opt" data-k="${k}">${list.reduce((h, [v, n]) => h + `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${n}</button>`, '')}</div>`;
const swatches = (k, cur, first = '') =>
  `<div class="swatches" data-k="${k}">${first}` +
  LEDS.reduce(
    (h, c) =>
      h +
      `<button data-v="${c}" style="--c:${c}" class="${c === cur ? 'on' : ''}" aria-label="${c}"></button>`,
    '',
  ) +
  `<label class="pick" aria-label="Any colour"><input type="color" data-k="${k}" value="${cur || '#ffffff'}"></label></div>`;

function drawLook() {
  const l = set.look;
  $('#cBody').innerHTML = `
    <label>LED colour</label>${swatches('led', set.led)}
    <label>Wall</label>${chips('wall', OPTS.wall, l.wall)}
    <label>Shelves</label>${chips('shelf', OPTS.shelf, l.shelf)}
    <label>Window view</label>${chips('sky', OPTS.sky, l.sky)}
    <label>On the window</label>${chips('dress', OPTS.dress, l.dress)}
    ${l.dress === 'curtains' ? `<label>Curtain colour</label>${swatches('curtain', l.curtain)}` : ''}
    <label>Poster</label>${chips('poster', OPTS.poster, l.poster)}
    <label>Neon sign<input id="cSign" maxlength="8" value="${esc(l.sign)}"></label>
    ${swatches('signColor', l.signColor)}
    <label>On the desk</label><div class="seg opt" data-k="desk">${OPTS.desk.reduce((h, [v, n]) => h + `<button data-v="${v}" class="${l.hide.includes(v) ? '' : 'on'}">${n}</button>`, '')}</div>
    <h3>Your buddy</h3>
    <label>Name<input id="cPet" maxlength="16" value="${esc(set.pet)}"></label>
    <label>Colour</label>${swatches('petColor', l.petColor, `<button data-v="" class="match ${l.petColor ? '' : 'on'}">Same as LED</button>`)}
    <label>Hat</label>${chips('hat', OPTS.hat, l.hat)}
    <button class="btn ghost wide" id="cReset">Reset to default</button>`;
}

function pickLook(k, v) {
  if (k === 'led') set.led = v;
  else if (k === 'desk')
    set.look.hide = set.look.hide.includes(v)
      ? set.look.hide.filter((x) => x !== v)
      : set.look.hide.concat(v);
  else set.look[k] = v;
  saveSet();
  applyLook();
  showPart(k);
}
// Scroll the room above the sheet so you see what you're changing
function showPart(k) {
  const vis = innerHeight * 0.5 - 60;
  if (/^(petColor|hat|pet)$/.test(k)) {
    petHome(); // brings him to the room if he's on another wall
    $('#view-room').scrollTo({ top: pet.y - vis + 20, behavior: 'smooth' });
    return;
  }
  const d = $('#deskArea');
  const top =
    k === 'desk' ? d.offsetTop + d.offsetHeight - vis : k === 'shelf' ? $('#rack').offsetTop - 10 : 0;
  $('#view-room').scrollTo({ top, behavior: 'smooth' });
}

$('#btnLook').onclick = () => {
  go(0);
  drawLook();
  document.body.classList.add('looking');
  $('#dlgLook').showModal();
};
$('#dlgLook').addEventListener('close', () => document.body.classList.remove('looking'));
$('#cBody').addEventListener('click', (e) => {
  if (e.target.id === 'cReset') {
    set.look = { ...LOOK, hide: [] };
    set.led = LEDS[0];
    saveSet();
    applyLook();
    return drawLook();
  }
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  pickLook(b.closest('[data-k]').dataset.k, b.dataset.v);
  drawLook();
});
$('#cBody').addEventListener('input', (e) => {
  const t = e.target;
  if (t.type === 'color') pickLook(t.dataset.k, t.value);
  if (t.id === 'cSign') {
    set.look.sign = t.value.trim().toUpperCase() || 'PLAY';
    saveSet();
    applyLook();
  }
  if (t.id === 'cPet') {
    set.pet = t.value.trim() || 'Byte';
    saveSet();
    emit('pet');
    showPart('pet');
  }
});
$('#cBody').addEventListener('change', (e) => {
  if (e.target.type === 'color') drawLook();
});

// Tapping the window: closed → half → open → closed…
const NEXT_SHADE = { closed: 'half', half: 'open', open: 'closed' };
$('.window').addEventListener('click', () => {
  if (set.look.dress === 'none') return;
  set.look.shade = NEXT_SHADE[set.look.shade] || 'closed';
  saveSet();
  applyLook();
});

applyLook();
