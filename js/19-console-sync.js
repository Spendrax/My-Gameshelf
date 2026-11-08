'use strict';
// PLAYSTATION, XBOX & NINTENDO SYNC — Settings → PlayStation / Xbox / Nintendo bring in the games you played, with their hours.
// Both go through your Cloudflare helper (HELPER/psn and HELPER/xbox), which keeps nothing.
//   PlayStation: unofficial (the way the PlayStation app signs in). Each person pastes their own sign-in token
//                ("npsso", from playstation.com). It lasts about 2 months, then they paste a new one.
//   Xbox: through OpenXBL (xbl.io). Each person signs in there with Microsoft and pastes their own free key.
//   Nintendo: unofficial (the way the Nintendo Store app signs in). The app opens Nintendo's sign-in page, the
//             person copies the link of the "Select this person" button; the helper trades it for a sign-in
//             that lasts about 2 years.
// The token and key stay on this phone only, and are left out of backups. Same rules as Steam (importGames).

const CONSOLE = {
  psn: {
    name: 'PlayStation',
    setting: 'psnToken',
    input: '#sPsn',
    button: '#sPsnSync',
    path: '/psn',
    field: 'psn',
    sameKind: /play\s?station|ps\d/i,
    errors: {
      npsso: 'Your PlayStation token is wrong or expired. Get a new one (steps below) and paste it.',
    },
  },
  xbox: {
    name: 'Xbox',
    setting: 'xboxKey',
    input: '#sXbox',
    button: '#sXboxSync',
    path: '/xbox',
    field: 'xbox',
    sameKind: /xbox/i,
    errors: { key: 'That OpenXBL key doesn’t work. Copy it again from xbl.io and paste it.' },
  },
  ns: {
    name: 'Nintendo',
    setting: 'nsToken',
    path: '/nintendo',
    field: 'ns',
    sameKind: /switch|nintendo|3ds|wii/i,
    // a freshly pasted link is sent once with its check code; after that, the lasting sign-in
    body: () => JSON.stringify(nsLink ? { link: nsLink, verifier: loadNsCheck() } : { session: set.nsToken }),
    errors: {
      link: 'That Nintendo link didn’t work. A link works once, for a few minutes: sign in again and copy a new one.',
      session: 'Your Nintendo sign-in expired. Sign in again (steps below).',
    },
  },
};

/* ---------- Nintendo sign-in ---------- */

const NS_CLIENT = '5c38e31cd085304b';
let nsLink = '';
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const loadNsCheck = () => localStorage.getItem('gr.nsCheck') || '';

// Opens Nintendo's sign-in page with a secret check code (PKCE) only this phone knows
async function nintendoSignIn() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  localStorage.setItem('gr.nsCheck', verifier);
  const q = new URLSearchParams({
    client_id: NS_CLIENT,
    redirect_uri: `npf${NS_CLIENT}://auth`,
    response_type: 'session_token_code',
    scope: 'openid user user.mii user.email user.links[].id',
    session_token_code_challenge: challenge,
    session_token_code_challenge_method: 'S256',
    state: b64url(crypto.getRandomValues(new Uint8Array(16))),
  });
  open('https://accounts.nintendo.com/connect/1.0.0/authorize?' + q, '_blank', 'noopener');
}

async function consoleSync(which, quiet) {
  const c = CONSOLE[which];
  const secret = set[c.setting];
  if (!secret && !(which === 'ns' && nsLink)) return;
  if (!quiet) toast(`Syncing with ${c.name}…`);
  let data;
  try {
    // the token goes in the body of the request, never in the web address (addresses can end up in logs)
    data = await (
      await fetch(HELPER + c.path, {
        method: 'POST',
        body: c.body ? c.body() : secret,
        signal: AbortSignal.timeout(30000),
      })
    ).json();
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
  if (data.session) {
    set[c.setting] = data.session; // Nintendo: the lasting sign-in, from now on
    nsLink = '';
    localStorage.removeItem('gr.nsCheck');
    $('#sNs').value = '';
    $('#sNs').placeholder = '✓';
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
  $('#sNs').placeholder = set.nsToken ? '✓' : 'npf5c38e31cd085304b://auth#…';
});
$('#sNsIn').onclick = nintendoSignIn;
$('#sNs').onchange = () => (nsLink = /^npf/.test($('#sNs').value.trim()) ? $('#sNs').value.trim() : '');
$('#sNsSync').onclick = () => {
  $('#sNs').onchange();
  if (!nsLink && !set.nsToken) return toast('Tap “Sign in to Nintendo” first');
  consoleSync('ns', false);
};
if (set.nsToken && Date.now() - (set.nsSynced || 0) > 12 * 3600e3)
  setTimeout(() => consoleSync('ns', true), 6000);

for (const [which, c] of Object.entries(CONSOLE)) {
  if (!c.input) continue; // Nintendo has its own buttons, above
  const input = $(c.input);
  input.onchange = () => {
    // the PlayStation page shows {"npsso":"…"}: accept the whole line too
    set[c.setting] = input.value.trim().replace(/^.*"npsso"\s*:\s*"([^"]+)".*$/, '$1');
    saveSet();
  };
  $(c.button).onclick = () => {
    input.onchange();
    if (!set[c.setting]) return toast(`Paste your ${c.name} ${which === 'psn' ? 'token' : 'key'} first`);
    consoleSync(which, false);
  };
  // quiet top-up of the hours, at most twice a day
  if (set[c.setting] && Date.now() - (set[which + 'Synced'] || 0) > 12 * 3600e3)
    setTimeout(() => consoleSync(which, true), 5000);
}
