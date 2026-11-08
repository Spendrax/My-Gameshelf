'use strict';
// YEAR IN REVIEW & SHARING — two buttons on the Stats wall:
//   • 🎁 Year in review: your year in games (finished, hours, most played, best month, streak…), which you
//     can save or share as a picture
//   • 📸 Share my shelf: a picture of your covers to post or send to friends
// Pictures are drawn on a canvas; covers from other sites are only used when they allow it (others are
// drawn as a coloured case with the title).

STATS_EXTRAS.push(
  () => `<div class="card"><h3>Share</h3>
    <button class="btn primary wide" id="yearBtn">🎁 Year in review</button>
    <button class="btn wide" id="shelfBtn" style="margin-top:8px">📸 Share my shelf</button></div>`,
);
$('#view-stats').addEventListener('click', (e) => {
  if (e.target.closest('#yearBtn'))
    openYear(new Date().getMonth() < 1 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  if (e.target.closest('#shelfBtn')) shareShelf();
});

const dlgYear = document.createElement('dialog');
dlgYear.id = 'dlgYear';
dlgYear.innerHTML = `<div class="sheet-h"><button class="x yr" data-y="-1" aria-label="Year before">‹</button><h2 id="yrH"></h2>
  <button class="x yr" data-y="1" aria-label="Year after">›</button><button class="x" data-close aria-label="Close">✕</button></div>
  <div id="yrBody"></div><div class="actions"><button class="btn primary" id="yrSave">📸 Save picture</button></div>`;
document.body.append(dlgYear);
dlgYear.addEventListener('click', (e) => e.target === dlgYear && dlgYear.close());

/* ---------- Your year, in numbers ---------- */

function yearRecap(y) {
  const Y = String(y);
  const inYear = (t) => t && new Date(t).getFullYear() === y;
  const fin = games.reduce(
    (a, g) => (beaten(g) && (g.finished || '').startsWith(Y) ? a.concat(g) : a),
    [],
  );
  const played = games.reduce(
    (a, g) =>
      (g.started || '').startsWith(Y) ||
      (g.finished || '').startsWith(Y) ||
      (inYear(g.updated) && g.hours > 0)
        ? a.concat(g)
        : a,
    [],
  );
  const logged = Object.keys(set.log || {}).reduce((m, d) => (d.startsWith(Y) ? m + set.log[d] : m), 0);
  const count = (list, key) =>
    list.reduce((m, g) => (g[key] ? ((m[g[key]] = (m[g[key]] || 0) + 1), m) : m), {});
  const top = (m) => Object.keys(m).sort((a, b) => m[b] - m[a])[0];
  const months = fin.reduce(
    (m, g) => (g.finished ? ((m[g.finished.slice(5, 7)] = (m[g.finished.slice(5, 7)] || 0) + 1), m) : m),
    {},
  );
  const bestM = top(months);
  let run = 0;
  let best = 0;
  for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
    const k = `${Y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    run = set.log?.[k] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const most = played.slice().sort((a, b) => (b.hours || 0) - (a.hours || 0))[0];
  return {
    y,
    rows: [
      ['🏆', 'Games finished', fin.length],
      ['➕', 'Games added', games.reduce((n, g) => n + !!inYear(g.added), 0)],
      ['⏱', 'Hours logged', logged ? Math.round(logged / 6) / 10 : ''],
      ['🔥', 'Longest streak', best > 1 ? `${best} days` : ''],
      ['🎮', 'Most played', most?.hours ? `${most.title} (${most.hours} h)` : ''],
      ['🕹', 'Top platform', top(count(played, 'platform')) || ''],
      [
        '📅',
        'Best month',
        bestM ? new Date(y, +bestM - 1, 1).toLocaleDateString(undefined, { month: 'long' }) : '',
      ],
    ].filter((r) => r[2] !== '' && r[2] !== 0),
    best: fin
      .slice()
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6),
  };
}

let yearShown = 0;
function openYear(y) {
  yearShown = y;
  const r = yearRecap(y);
  $('#yrH').textContent = `${y} in games`;
  $('#yrBody').innerHTML = r.rows.length
    ? `<div class="recap">${r.rows.reduce((h, [i, l, v]) => h + `<div><span>${i}</span><b>${esc(String(v))}</b><small>${l}</small></div>`, '')}</div>
       ${r.best.length ? `<h3>Your best this year</h3><div class="mini">${r.best.reduce((h, g) => h + caseHTML(g), '')}</div>` : ''}`
    : '<p class="dim">Nothing for this year yet.</p>';
  $('#yrSave').hidden = !r.rows.length;
  if (!dlgYear.open) dlgYear.showModal();
}
dlgYear.addEventListener('click', (e) => {
  const d = +e.target.closest('.yr')?.dataset.y;
  if (d && yearShown + d <= new Date().getFullYear()) openYear(yearShown + d);
});
$('#yrSave').onclick = async () => {
  const r = yearRecap(yearShown);
  const c = canvasCard(1080, 1350, `${r.y} in games`);
  const x = c.getContext('2d');
  r.rows.forEach(([i, l, v], n) => {
    const top = 250 + n * 118;
    x.font = '64px sans-serif';
    x.fillText(i, 90, top + 40);
    x.font = 'bold 54px sans-serif';
    x.fillStyle = '#fff';
    x.fillText(fit(x, String(v), 780), 190, top + 30);
    x.font = '30px sans-serif';
    x.fillStyle = '#ffffffaa';
    x.fillText(tr(l), 190, top + 72);
  });
  await drawCovers(x, r.best, 90, 1110, 6, 140);
  saveImage(c, `gameshelf-${r.y}.png`);
};

/* ---------- Share my shelf ---------- */

async function shareShelf() {
  const order = { playing: 0, onoff: 1, finished: 2 };
  const list = games
    .slice()
    .sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 30);
  if (!list.length) return toast('Add some games first');
  toast('Making the picture…');
  const rows = Math.ceil(list.length / 5);
  const c = canvasCard(1080, 330 + rows * 290, tr('My Gameshelf'));
  const x = c.getContext('2d');
  const fin = games.reduce((n, g) => n + beaten(g), 0);
  const hours = Math.round(games.reduce((n, g) => n + (+g.hours || 0), 0));
  x.font = '34px sans-serif';
  x.fillStyle = '#ffffffcc';
  x.fillText(`${games.length} ${tr('Games').toLowerCase()} · ${fin} 🏆 · ${hours} h`, 90, 220);
  await drawCovers(x, list, 90, 280, 5, 168);
  saveImage(c, 'my-gameshelf.png');
}

/* ---------- Drawing ---------- */

// A dark card with a glow in your LED colour and a title
function canvasCard(w, h, title) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const led = getComputedStyle(document.body).getPropertyValue('--led').trim() || '#a970ff';
  const bg = x.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#16121f');
  bg.addColorStop(1, '#0b0a10');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  const glow = x.createRadialGradient(w * 0.8, 0, 0, w * 0.8, 0, w);
  glow.addColorStop(0, led + '66');
  glow.addColorStop(1, 'transparent');
  x.fillStyle = glow;
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff';
  x.font = 'bold 76px sans-serif';
  x.fillText(tr(title), 90, 150);
  x.fillStyle = led;
  x.fillRect(90, 175, 120, 8);
  x.font = '28px sans-serif';
  x.fillStyle = '#ffffff66';
  x.fillText('My Gameshelf', w - 300, h - 40);
  return c;
}

// Cuts text that doesn't fit with "…"
function fit(x, text, w) {
  let t = text;
  while (t.length > 3 && x.measureText(t).width > w) t = t.slice(0, -2);
  return t === text ? t : t + '…';
}

const loadImg = (src) =>
  new Promise((res) => {
    if (!src) return res(null);
    const i = new Image();
    i.crossOrigin = 'anonymous'; // sites that don't allow it fail here (instead of spoiling the picture)
    i.onload = () => res(i);
    i.onerror = () => res(null);
    setTimeout(() => res(null), 6000);
    i.src = src;
  });

async function drawCovers(x, list, left, top, perRow, w) {
  const h = w * 1.4;
  const gap = (900 - perRow * w) / Math.max(1, perRow - 1);
  const imgs = await Promise.all(list.map((g) => loadImg(g.cover)));
  list.forEach((g, i) => {
    const cx = left + (i % perRow) * (w + gap);
    const cy = top + Math.floor(i / perRow) * (h + 40);
    x.fillStyle = `hsl(${hue(g.title)} 45% 30%)`;
    x.fillRect(cx, cy, w, h);
    if (imgs[i]) {
      const s = Math.max(w / imgs[i].width, h / imgs[i].height);
      x.save();
      x.beginPath();
      x.rect(cx, cy, w, h);
      x.clip();
      x.drawImage(
        imgs[i],
        cx + (w - imgs[i].width * s) / 2,
        cy + (h - imgs[i].height * s) / 2,
        imgs[i].width * s,
        imgs[i].height * s,
      );
      x.restore();
    } else {
      x.fillStyle = '#fff';
      x.font = 'bold 22px sans-serif';
      x.fillText(fit(x, g.title, w - 16), cx + 8, cy + h / 2);
    }
  });
}

// Shares the picture (phone share sheet), or downloads it
function saveImage(c, name) {
  c.toBlob(async (blob) => {
    const file = new File([blob], name, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] });
    } catch {
      return; // share sheet closed
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
renderWalls();
