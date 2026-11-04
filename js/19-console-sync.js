'use strict';
// PLAYSTATION & XBOX SYNC — Settings → PlayStation / Xbox bring in the games you played, with their hours.
// Both go through your Cloudflare helper (HELPER/psn and HELPER/xbox), which keeps nothing.
//   PlayStation: unofficial (the way the PlayStation app signs in). Each person pastes their own sign-in token
//                ("npsso", from playstation.com). It lasts about 2 months, then they paste a new one.
//   Xbox: through OpenXBL (xbl.io). Each person signs in there with Microsoft and pastes their own free key.
// The token and key stay on this phone only, and are left out of backups. Same rules as Steam (importGames).

const CONSOLE = {
  psn: {
    name: 'PlayStation',
    setting: 'psnToken',
    url: (v) => `${HELPER}/psn?npsso=${encodeURIComponent(v)}`,
    field: 'psn',
    sameKind: /play\s?station|ps\d/i,
    errors: {
      npsso: 'Your PlayStation token is wrong or expired. Get a new one (steps below) and paste it.',
    },
  },
  xbox: {
    name: 'Xbox',
    setting: 'xboxKey',
    url: (v) => `${HELPER}/xbox?key=${encodeURIComponent(v)}`,
    field: 'xbox',
    sameKind: /xbox/i,
    errors: { key: 'That OpenXBL key doesn’t work. Copy it again from xbl.io and paste it.' },
  },
};

async function consoleSync(which, quiet) {
  const c = CONSOLE[which];
  const secret = set[c.setting];
  if (!secret) return;
  if (!quiet) toast(`Syncing with ${c.name}…`);
  let data;
  try {
    data = await (await fetch(c.url(secret), { signal: AbortSignal.timeout(30000) })).json();
  } catch {
    if (!quiet) toast(`Couldn’t reach ${c.name}. Try again later.`);
    return;
  }
  if (data.error || !data.games) {
    if (!quiet)
      toast(
        c.errors[data.error] ||
          `${c.name} sync didn’t work. Check your helper code is the newest, or try later.`,
      );
    return;
  }
  const { added, updated } = importGames(data.games, {
    field: c.field,
    sameKind: c.sameKind,
    all: set.steamAll,
  });
  set[which + 'Synced'] = Date.now();
  saveSet();
  if (!quiet || added || updated) toast(`${c.name}: ${added} games added, ${updated} hours updated`);
}

/* ---------- Settings ---------- */

$('#btnSettings').addEventListener('click', () => {
  $('#sPsn').value = set.psnToken || '';
  $('#sXbox').value = set.xboxKey || '';
});
for (const [which, c] of Object.entries(CONSOLE)) {
  const input = $(which === 'psn' ? '#sPsn' : '#sXbox');
  input.onchange = () => {
    // the PlayStation page shows {"npsso":"…"}: accept the whole line too
    set[c.setting] = input.value.trim().replace(/^.*"npsso"\s*:\s*"([^"]+)".*$/, '$1');
    saveSet();
  };
  $(which === 'psn' ? '#sPsnSync' : '#sXboxSync').onclick = () => {
    input.onchange();
    if (!set[c.setting]) return toast(`Paste your ${c.name} ${which === 'psn' ? 'token' : 'key'} first`);
    consoleSync(which, false);
  };
  // quiet top-up of the hours, at most twice a day
  if (set[c.setting] && Date.now() - (set[which + 'Synced'] || 0) > 12 * 3600e3)
    setTimeout(() => consoleSync(which, true), 5000);
}
