'use strict';
// GOOGLE DRIVE BACKUP & SYNC — Settings → Google Drive. After you connect once, the app keeps a copy of
// your games (photos included) in a hidden app folder in your Drive ("appDataFolder": only this app sees it):
//   • about a minute after you change something, and when you open the app if it's been a day
//   • on another phone or computer, connecting merges both: the newest version of each game wins, and a
//     game deleted on one device is deleted on the other (set.gone remembers deletions)
// Signing in uses Google's own window. Google gives a long-lasting "refresh token" so backups keep working
// without signing in again; turning it into a short-lived pass needs a secret, so that step goes through
// your Cloudflare helper (/gauth and /gtoken, with the GOOGLE_SECRET secret). The token stays on this phone.

// Your Google Cloud "OAuth client ID" (web application). Empty = Drive backup not set up yet.
const GOOGLE_CLIENT_ID = '';
const DRIVE_FILE = 'gameshelf-backup.json';

set.drive = Object.assign({ refresh: '', last: 0, file: '' }, set.drive);
set.device ||= uid(); // tells your devices apart
let driveToken = { value: '', until: 0 };

const driveOn = () => !!(GOOGLE_CLIENT_ID && set.drive.refresh);
const helperPost = (path, body) =>
  fetch(HELPER + path, { method: 'POST', body, signal: AbortSignal.timeout(15000) }).then((r) => r.json());

/* ---------- Signing in ---------- */

function loadGoogle() {
  return window.google?.accounts ? Promise.resolve() : loadScript('https://accounts.google.com/gsi/client');
}

// Opens Google's sign-in; the one-time code is traded by the helper for a refresh token
async function driveConnect() {
  if (!GOOGLE_CLIENT_ID) return toast('Google Drive backup isn’t set up yet');
  try {
    await loadGoogle();
  } catch {
    return toast('Couldn’t reach Google. Check your connection.');
  }
  google.accounts.oauth2
    .initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      ux_mode: 'popup',
      callback: async (r) => {
        if (!r.code) return toast('Google sign-in was cancelled');
        const t = await helperPost('/gauth', r.code).catch(() => ({}));
        if (!t.refresh_token) return toast('Google sign-in didn’t work. Check the helper is up to date.');
        set.drive.refresh = t.refresh_token;
        driveToken = { value: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
        saveSet();
        drawDrive();
        toast('Google Drive connected');
        driveSync(true);
      },
    })
    .requestCode();
}

// A short-lived pass to talk to Drive (renewed through the helper)
async function driveAccess() {
  if (Date.now() < driveToken.until) return driveToken.value;
  const t = await helperPost('/gtoken', set.drive.refresh);
  if (!t.access_token) {
    if (t.error === 'invalid_grant') {
      // access was removed in your Google account: connect again
      set.drive.refresh = '';
      saveSet();
      drawDrive();
    }
    throw new Error('no access');
  }
  driveToken = { value: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
  return driveToken.value;
}

/* ---------- Talking to Drive ---------- */

async function drive(path, init = {}) {
  const r = await fetch(`https://www.googleapis.com/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await driveAccess()}`, ...init.headers },
  });
  if (!r.ok) throw new Error('drive ' + r.status);
  return r;
}

// The backup file in your Drive's app folder: { id, modifiedTime } or null
async function driveFind() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}'`);
  const d = await (
    await drive(`drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`)
  ).json();
  return d.files?.[0] || null;
}

async function driveUpload(data) {
  const body = JSON.stringify(data);
  if (set.drive.file) {
    try {
      await drive(`upload/drive/v3/files/${set.drive.file}?uploadType=media`, { method: 'PATCH', body });
      return;
    } catch {} // the file was removed: make a new one
  }
  const b = 'gs' + Date.now();
  const meta = JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'] });
  const r = await drive('upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: `--${b}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
  });
  set.drive.file = (await r.json()).id;
}

/* ---------- Merging two copies ---------- */

// Both sides' games: the newest version of each wins; games deleted on either side stay deleted
function mergeFrom(remote) {
  const wasEmpty = !games.length;
  const gone = new Map((set.gone || []).concat(remote.settings?.gone || []).map((x) => [x.id, x.at]));
  const all = new Map();
  for (const g of (remote.games || []).concat(games)) {
    if (!g?.id || gone.has(g.id)) continue;
    const cur = all.get(g.id);
    if (!cur || (g.updated || g.added || 0) >= (cur.updated || cur.added || 0)) all.set(g.id, g);
  }
  games = [...all.values()].sort((a, b) => (b.added || 0) - (a.added || 0));
  set.gone = [...gone].map(([id, at]) => ({ id, at })).slice(-500);
  // a brand-new device also takes your room's look and goals
  if (wasEmpty && remote.settings) {
    const { look, pet: name, led, goal, rackOpen, ach } = remote.settings;
    Object.assign(set, {
      look: { ...set.look, ...look },
      pet: name || set.pet,
      led: led || set.led,
      goal: goal || set.goal,
    });
    if (rackOpen) set.rackOpen = rackOpen;
    if (ach) set.ach = { ...set.ach, ...ach };
    applyLook();
  }
  saveSet();
  save();
}

/* ---------- Backing up ---------- */

let syncing = false;
// Gets your other devices' changes first (if any), then saves this device's copy
async function driveSync(loud) {
  if (!driveOn() || syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const f = await driveFind();
    if (f) {
      set.drive.file = f.id;
      // changed since this device last saved it: someone else (another device) wrote it
      if (Date.parse(f.modifiedTime) > set.drive.last + 5000) {
        const remote = await (await drive(`drive/v3/files/${f.id}?alt=media`)).json();
        if (remote.device !== set.device) {
          mergeFrom(remote);
          if (loud || remote.games?.length) toast('Synced with your other device');
        }
      }
    }
    await driveUpload({ ...(await backupData()), device: set.device });
    set.drive.last = Date.now();
    saveSet();
    if (loud) toast('Backed up to Google Drive');
  } catch {
    if (loud) toast('Google Drive backup didn’t work. Try again later.');
  } finally {
    syncing = false;
    drawDrive();
  }
}

/* ---------- Settings ---------- */

function drawDrive() {
  const ago = set.drive.last ? Math.round((Date.now() - set.drive.last) / 60000) : -1;
  $('#gStatus').textContent = !GOOGLE_CLIENT_ID
    ? 'Not set up yet.'
    : !driveOn()
      ? 'Keeps a copy of your games in your Google Drive, automatically, and syncs your devices.'
      : ago < 0
        ? 'Connected. First backup coming up…'
        : `Connected. Last backup: ${ago < 1 ? 'just now' : ago < 60 ? ago + ' min ago' : Math.round(ago / 60) + ' h ago'}.`;
  $('#gConnect').hidden = driveOn() || !GOOGLE_CLIENT_ID;
  $('#gActions').hidden = !driveOn();
}
$('#btnSettings').addEventListener('click', drawDrive);
$('#gConnect').onclick = driveConnect;
$('#gNow').onclick = () => driveSync(true);
$('#gOff').onclick = () => {
  if (!confirm('Stop backing up to Google Drive on this device? Your copy in Drive stays.')) return;
  set.drive = { refresh: '', last: 0, file: '' };
  saveSet();
  drawDrive();
};

// Automatic: a minute after changes, and when you open the app (to pick up your other devices' changes)
let driveT = 0;
on('change', () => {
  clearTimeout(driveT);
  driveT = setTimeout(driveSync, 60e3);
});
if (driveOn()) setTimeout(() => driveSync(false), Date.now() - set.drive.last > 864e5 ? 5000 : 15000);
