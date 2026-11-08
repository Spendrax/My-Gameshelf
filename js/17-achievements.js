'use strict';
// ACHIEVEMENTS — the wall left of Goals (Achievements ← Goals ← Room → Stats): medals on cabinet shelves.
// Each medal unlocks something in Customize (a hat, an animal, a wall, a window scene) or the second buddy.
// Earned medals stay earned (set.ach.done), even if you delete games later. Whatever you were already using
// when this arrived stays unlocked (set.ach.keep), so nothing you picked disappears.

const ACH = [
  {
    id: 'first',
    icon: '🎮',
    name: 'Player One',
    desc: 'Add your first game',
    test: (s) => s.games >= 1,
    unlock: ['hat:cap'],
  },
  {
    id: 'ten',
    icon: '📚',
    name: 'Collector',
    desc: 'Have 10 games on your rack',
    test: (s) => s.games >= 10,
    goal: (s) => [s.games, 10],
    unlock: ['wall:synth'],
  },
  {
    id: 'fifty',
    icon: '🏛',
    name: 'Archivist',
    desc: 'Have 50 games on your rack',
    test: (s) => s.games >= 50,
    goal: (s) => [s.games, 50],
    unlock: ['scene:space'],
  },
  {
    id: 'win',
    icon: '🏆',
    name: 'GG',
    desc: 'Finish a game',
    test: (s) => s.fin >= 1,
    unlock: ['hat:crown'],
  },
  {
    id: 'win10',
    icon: '👑',
    name: 'Completionist',
    desc: 'Finish 10 games',
    test: (s) => s.fin >= 10,
    goal: (s) => [s.fin, 10],
    unlock: ['kind:fox'],
  },
  {
    id: 'goal',
    icon: '🎯',
    name: 'Goal Getter',
    desc: 'Reach this year’s challenge',
    test: (s) => s.goalDone,
    unlock: ['wall:charcoal'],
  },
  {
    id: 'critic',
    icon: '⭐',
    name: 'Critic',
    desc: 'Rate 10 games',
    test: (s) => s.rated >= 10,
    goal: (s) => [s.rated, 10],
    unlock: ['hat:tophat'],
  },
  {
    id: 'hours100',
    icon: '⏱',
    name: 'Dedicated',
    desc: 'Play 100 hours in total',
    test: (s) => s.hours >= 100,
    goal: (s) => [s.hours, 100],
    unlock: ['scene:beach'],
  },
  {
    id: 'hours1000',
    icon: '🔥',
    name: 'No-Lifer',
    desc: 'Play 1,000 hours in total',
    test: (s) => s.hours >= 1000,
    goal: (s) => [s.hours, 1000],
    unlock: ['scene:forest', 'wall:forest'],
  },
  {
    id: 'plat3',
    icon: '🕹',
    name: 'Multi-platform',
    desc: 'Games on 3 different platforms',
    test: (s) => s.plats >= 3,
    goal: (s) => [s.plats, 3],
    unlock: ['kind:penguin'],
  },
  {
    id: 'steam',
    icon: '🔗',
    name: 'Connected',
    desc: 'Sync with Steam, PlayStation, Xbox or Nintendo',
    test: (s) => s.steam,
    unlock: ['hat:headset'],
  },
  {
    id: 'owl',
    icon: '🌙',
    name: 'Night Owl',
    desc: 'Visit your room after midnight',
    test: (s) => s.owl,
    unlock: ['kind:frog'],
  },
  {
    id: 'pets',
    icon: '💜',
    name: 'Good Buddy',
    desc: 'Pet your buddy 50 times',
    test: (s) => s.pets >= 50,
    goal: (s) => [s.pets, 50],
    unlock: ['kind:bunny', 'hat:bow'],
  },
  {
    id: 'feed',
    icon: '🍖',
    name: 'Best Friends',
    desc: 'Feed your buddy 10 times',
    test: (s) => s.feeds >= 10,
    goal: (s) => [s.feeds, 10],
    unlock: ['friend'],
  },
];

set.ach = Object.assign({ pets: 0, feeds: 0, owl: false, done: null, keep: [] }, set.ach);

// Everything the medals look at
function achStats() {
  const year = String(new Date().getFullYear());
  const s = games.reduce(
    (a, g) => {
      a.hours += +g.hours || 0;
      if (beaten(g)) {
        a.fin++;
        if ((g.finished || '').startsWith(year)) a.year++;
      }
      if (g.rating) a.rated++;
      if (g.platform) a.plats.add(g.platform.toLowerCase());
      return a;
    },
    { hours: 0, fin: 0, year: 0, rated: 0, plats: new Set() },
  );
  return {
    ...s,
    games: games.length,
    hours: Math.floor(s.hours),
    plats: s.plats.size,
    goalDone: s.year >= set.goal,
    steam: !!(set.steamSynced || set.psnSynced || set.xboxSynced || set.nsSynced),
    owl: set.ach.owl,
    pets: set.ach.pets,
    feeds: set.ach.feeds,
  };
}

// Which medal unlocks each item ("hat:crown", "kind:fox", "friend"…)
const LOCKS = ACH.reduce((m, a) => (a.unlock.forEach((u) => (m[u] = a)), m), {});
const unlocked = (item) =>
  !LOCKS[item] || set.ach.done?.includes(LOCKS[item].id) || set.ach.keep.includes(item);
// For Customize: the medal still needed for this choice, or null
const lockedBy = (k, v) => (unlocked(`${k}:${v}`) ? null : LOCKS[`${k}:${v}`]);

// What a medal gives, in words
function rewardText(a) {
  const kinds = { hat: ' hat', kind: '', scene: ' window', wall: ' wall' };
  return a.unlock
    .map((u) => {
      if (u === 'friend') return '🐾 A second buddy';
      const [k, v] = u.split(':');
      return (OPTS[k].find(([x]) => x === v)?.[1] || v) + kinds[k];
    })
    .join(' + ');
}

// Looks for newly earned medals: celebrates each one
function checkAch() {
  const s = achStats();
  const earned = ACH.reduce((a, x) => (x.test(s) ? a.concat(x.id) : a), []);
  if (set.ach.done === null) {
    // first time: medals already earned count, without a celebration each; keep what's in use
    const l = set.look;
    set.ach.keep = [`hat:${l.hat}`, `kind:${l.kind}`, `scene:${l.scene}`, `wall:${l.wall}`];
    set.ach.done = earned;
    saveSet();
    if (earned.length)
      setTimeout(() => toast(`🏆 You already have ${earned.length} achievements! Swipe to see them.`), 2500);
  } else {
    const fresh = earned.reduce(
      (a, id) => (set.ach.done.includes(id) ? a : a.concat(ACH.find((x) => x.id === id))),
      [],
    );
    if (fresh.length) {
      set.ach.done = set.ach.done.concat(fresh.map((a) => a.id));
      saveSet();
      fresh.forEach((a, i) =>
        setTimeout(() => {
          toast(`${a.icon} Achievement: ${a.name}! Unlocked ${rewardText(a)}`);
          if (pet.sleeping) wake();
          petClass('cheer', 1500);
          say(`${a.name}! 🏆`, 3500);
          confetti();
          emit('look'); // the second buddy may have just arrived
        }, i * 3200),
      );
    }
  }
  renderAch();
}

/* ---------- The wall ---------- */

function renderAch() {
  const s = achStats();
  const got = set.ach.done || [];
  const medal = (a) => {
    const has = got.includes(a.id);
    const [cur, need] = a.goal ? a.goal(s) : [0, 0];
    return `<button class="medal ${has ? 'got' : ''}" data-ach="${a.id}">
      <span class="m">${has ? a.icon : '🔒'}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
      ${!has && need ? `<i class="prog"><i style="width:${Math.min(100, (cur / need) * 100)}%"></i></i><small>${Math.min(cur, need).toLocaleString()} / ${need.toLocaleString()}</small>` : ''}
    </button>`;
  };
  let shelves = '';
  for (let i = 0; i < ACH.length; i += 3)
    shelves += `<div class="ach-shelf">${ACH.slice(i, i + 3).reduce((h, a) => h + medal(a), '')}</div>`;
  $('#achBody').innerHTML =
    `<h2>ACHIEVEMENTS</h2><p class="ach-sum">${got.length} / ${ACH.length} unlocked</p>${shelves}`;
}
// Tap a medal: what it's for and what it gives
$('#achBody').addEventListener('click', (e) => {
  const a = ACH.find((x) => x.id === e.target.closest('[data-ach]')?.dataset.ach);
  if (a) toast(`${set.ach.done?.includes(a.id) ? '✅' : '🔒'} ${a.desc} → ${rewardText(a)}`);
});

on('petted', () => {
  set.ach.pets++;
  saveSet();
  checkAch();
});
on('fed', () => {
  set.ach.feeds++;
  saveSet();
  checkAch();
});
on('change', checkAch);
if (new Date().getHours() < 5) set.ach.owl = true; // between midnight and 5 am
checkAch();
