'use strict';
// STATS & GOALS — the two side walls. Stats: totals, ratings, platforms, genres, years.
// Goals: the yearly 'games finished' challenge and backlog roulette.
const bars = (obj, n = 6) => {
  const e = Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  const max = e[0]?.[1] || 1;
  return (
    e.reduce(
      (h, [k, v]) =>
        h +
        `<div class="bar"><span>${esc(k)}</span><i style="width:${(v / max) * 100}%"></i><span>${v}</span></div>`,
      '',
    ) || '<p class="dim">Nothing yet.</p>'
  );
};
const listRow = (g, val) =>
  `<div class="lrow" data-open="${g.id}">${caseHTML(g)}<span>${esc(g.title)}</span><em>${val}</em></div>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b && !e.target.closest('.case')) openGame(b.dataset.open);
});

function renderStats() {
  const s = games.reduce(
    (a, g) => {
      a.hours += +g.hours || 0;
      if (beaten(g)) {
        a.fin++;
        if (g.finished) {
          const y = g.finished.slice(0, 4);
          a.years[y] = (a.years[y] || 0) + 1;
        }
      }
      if (g.rating) {
        a.rs += g.rating;
        a.rn++;
        a.dist[g.rating - 1]++;
      }
      const p = g.platform || 'Unknown';
      a.plat[p] = (a.plat[p] || 0) + 1;
      (g.genres || []).forEach((x) => (a.gen[x] = (a.gen[x] || 0) + 1));
      return a;
    },
    { hours: 0, fin: 0, rs: 0, rn: 0, dist: Array(10).fill(0), plat: {}, gen: {}, years: {} },
  );
  const dmax = Math.max(1, ...s.dist);
  const top = [...games]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5)
    .reduce((h, g) => (g.rating ? h + listRow(g, g.rating + '/10') : h), '');
  // the same game on two consoles counts as one game, with the hours of both
  const once = Object.values(
    games.reduce((m, g) => {
      const k = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cur = m[k];
      m[k] = cur
        ? {
            ...((+g.hours || 0) > (+cur.hours || 0) ? g : cur),
            hours: Math.round(((+cur.hours || 0) + (+g.hours || 0)) * 10) / 10,
            both: true,
          }
        : g;
      return m;
    }, {}),
  );
  const most = once
    .sort((a, b) => (b.hours || 0) - (a.hours || 0))
    .slice(0, 5)
    .reduce((h, g) => (g.hours ? h + listRow(g, g.hours + ' h' + (g.both ? ' 🔗' : '')) : h), '');
  const yrs = Object.fromEntries(
    Object.entries(s.years)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 6),
  );

  $('#statsBody').innerHTML = `<h2>STATS</h2>
    <div class="trophies" title="One trophy per finished game">${'<i class="tro"></i>'.repeat(Math.min(s.fin, 10))}${
      s.fin > 10
        ? `<b>+${s.fin - 10}</b>`
        : s.fin
          ? ''
          : '<span class="dim">Finish a game to win a trophy</span>'
    }</div>
    <div class="kpis">
      <div class="kpi"><b>${games.length}</b><span>Games</span></div>
      <div class="kpi"><b>${s.fin}</b><span>Finished</span></div>
      <div class="kpi"><b>${Math.round(s.hours).toLocaleString()}</b><span>Hours played</span></div>
      <div class="kpi"><b>${s.rn ? (s.rs / s.rn).toFixed(1) : '—'}</b><span>Average rating</span></div>
    </div>
    <div class="card"><h3>Ratings</h3><div class="dist">${s.dist.reduce((h, v, i) => h + `<div><i style="height:${(v / dmax) * 60}px"></i>${i + 1}</div>`, '')}</div></div>
    <div class="card"><h3>Top rated</h3><div class="list">${top || '<p class="dim">Rate a game to see it here.</p>'}</div></div>
    <div class="card"><h3>Most played</h3><div class="list">${most || '<p class="dim">Log some hours to see it here.</p>'}</div></div>
    <div class="card"><h3>Platforms</h3>${bars(s.plat)}</div>
    <div class="card"><h3>Genres</h3>${bars(s.gen)}</div>
    <div class="card"><h3>Finished per year</h3>${bars(yrs)}</div>${extras(STATS_EXTRAS)}`;
}

function renderGoals() {
  const year = String(new Date().getFullYear());
  const done = games.reduce(
    (a, g) => (beaten(g) && (g.finished || '').startsWith(year) ? a.concat(g) : a),
    [],
  );
  const backlog = games.reduce((a, g) => (g.status === 'backlog' ? a.concat(g) : a), []);
  const goal = set.goal,
    pct = Math.min(1, done.length / goal),
    C = 2 * Math.PI * 52;
  const start = new Date(+year, 0, 1),
    dayFrac = (Date.now() - start) / (new Date(+year + 1, 0, 1) - start);
  const diff = done.length - Math.floor(goal * dayFrac);
  const pace =
    done.length >= goal
      ? 'Goal beaten! 🏆'
      : diff > 0
        ? `${diff} ahead of pace`
        : diff < 0
          ? `${-diff} behind pace`
          : 'Right on pace';

  $('#goalsBody').innerHTML = `<h2>GOALS</h2><div class="board">
    <div class="card"><h3>${year} challenge</h3>
      <div class="ring">
        <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true">
          <circle cx="62" cy="62" r="52" fill="none" stroke="#ffffff14" stroke-width="12"/>
          <circle cx="62" cy="62" r="52" fill="none" stroke="var(--led)" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 62 62)" style="filter:drop-shadow(0 0 6px var(--led));transition:stroke-dashoffset .8s"/>
        </svg>
        <div><b>${done.length}/${goal}</b><div class="dim">games finished</div><div>${pace}</div>
          <div class="stepper"><button data-g="-1" aria-label="Lower goal">−</button><span class="dim">Goal</span><button data-g="1" aria-label="Raise goal">+</button></div>
        </div>
      </div>
      ${done.length ? `<h3 style="margin-top:14px">Beaten this year</h3><div class="mini">${done.reduce((h, g) => h + caseHTML(g), '')}</div>` : ''}
    </div>
    <div class="card"><h3>Backlog roulette</h3>
      <p class="dim" style="margin:0">${backlog.length ? `${backlog.length} games waiting. Can't choose? Let ${esc(set.pet)} pick.` : 'Your backlog is empty. Nice!'}</p>
      ${backlog.length ? '<button class="btn primary wide" id="spin">🎲 Pick my next game</button><div id="picked"></div>' : ''}
    </div>${extras(GOALS_EXTRAS)}</div>`;
}

$('#view-goals').addEventListener('click', (e) => {
  const d = +e.target.dataset.g;
  if (d) {
    set.goal = Math.max(1, set.goal + d);
    saveSet();
    renderGoals();
    return;
  }
  if (e.target.id === 'spin') spinBacklog();
  const st = e.target.dataset.start;
  if (st) {
    const g = byId(st);
    g.status = 'playing';
    g.started ||= today();
    g.updated = Date.now();
    save();
    toast(`Now playing ${g.title}`);
  }
});

function spinBacklog() {
  const backlog = games.reduce((a, g) => (g.status === 'backlog' ? a.concat(g) : a), []);
  const box = $('#picked');
  let n = 0;
  const t = setInterval(() => {
    const g = rand(backlog);
    box.innerHTML = `<div class="pick">${caseHTML(g, 'big')}<div><h4>${esc(g.title)}</h4>${n >= 12 ? `<button class="btn primary" data-start="${g.id}">▶ Start playing</button>` : ''}</div></div>`;
    if (++n > 12) {
      clearInterval(t);
      say(`How about ${g.title}?`);
    }
  }, 90);
}

// both walls stay drawn so they're ready while you turn
const renderWalls = () => {
  renderStats();
  renderGoals();
};
on('change', renderWalls);
renderWalls();
