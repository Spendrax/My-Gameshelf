'use strict';
// SHARING YOUR ROOM — Settings → Share your room gives you a link. A friend who opens it visits your room:
// the same app, in a look-only mode (walls to swipe, your rack, game cards, your buddy), with your games.
//   • What's shared: games (title, platform, status, rating, hours, cover, dates, tags, trophies) and the
//     room's look, buddy, goal and medals. NOT shared: notes, prices and stores, account tokens, your
//     location, cover photos kept only on this phone.
//   • The copy is kept by your helper (HELPER/share → KV storage) and updated a few minutes after you
//     change something. "Stop sharing" deletes it; the link then stops working.
//   • The visitor's side: shelf.html fetches the copy, then opens ./?view=ID (VIEW in 01-core.js), where
//     nothing is saved.

const SHARE_GAME = [
  'id',
  'title',
  'platform',
  'status',
  'rating',
  'hours',
  'year',
  'genres',
  'tags',
  'started',
  'finished',
  'added',
  'facts',
  'tro',
  'merged',
  'beatenOn',
  'format',
];
const SHARE_SET = [
  'pet',
  'led',
  'goal',
  'look',
  'rackOpen',
  'ach',
  'log',
  'steamSynced',
  'psnSynced',
  'xboxSynced',
  'nsSynced',
];

function sharedCopy() {
  const pick = (o, keys) => keys.reduce((a, k) => (o[k] != null ? ((a[k] = o[k]), a) : a), {});
  return {
    'gr.games': games.map((g) => ({
      ...pick(g, SHARE_GAME),
      cover: /^https:/.test(g.cover || '') ? g.cover : '', // photos kept on this phone can't be shown elsewhere
      merged: (g.merged || []).map((p) => ({ platform: p.platform, hours: p.hours })),
    })),
    'gr.set': {
      ...pick(set, SHARE_SET),
      toured: true,
      seen: VERSION,
      lang: 'auto',
      owner: set.share?.name || '',
    },
  };
}

let sharing = false;
async function shareUpload(off) {
  if (sharing || !navigator.onLine) return null;
  sharing = true;
  try {
    const r = await fetch(HELPER + '/share', {
      method: 'POST',
      body: JSON.stringify({ id: set.share?.id, key: set.share?.key, off, data: off ? null : sharedCopy() }),
      signal: AbortSignal.timeout(20000),
    }).then((x) => x.json());
    return r;
  } catch {
    return null;
  } finally {
    sharing = false;
  }
}

const shareLink = () =>
  `${location.origin}${location.pathname.replace(/[^/]*$/, '')}shelf.html?id=${set.share.id}`;
function drawShare() {
  $('#shOn').hidden = !!set.share;
  $('#shBox').hidden = !set.share;
  if (set.share) $('#shLink').value = shareLink();
}

if (!VIEW) {
  $('#btnSettings').addEventListener('click', drawShare);
  $('#shOn').onclick = async () => {
    const name = prompt('Your name, shown to visitors:', '');
    if (name === null) return;
    set.share = { name: name.trim().slice(0, 30) };
    toast('Making your link…');
    const r = await shareUpload();
    if (!r?.id) {
      delete set.share;
      return toast(
        r?.error === 'no-kv'
          ? 'Sharing isn’t set up in the helper yet.'
          : 'Couldn’t make the link. Check the helper is up to date.',
      );
    }
    Object.assign(set.share, { id: r.id, key: r.key });
    saveSet();
    drawShare();
    toast('Your room is shared. Send the link to a friend!');
  };
  $('#shCopy').onclick = async () => {
    const url = shareLink();
    try {
      if (navigator.share) return await navigator.share({ title: 'My Gameshelf', url });
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {}
  };
  $('#shOff').onclick = async () => {
    if (!confirm('Stop sharing? The link will stop working.')) return;
    const r = await shareUpload(true);
    if (!r) return toast('No connection. Try again later.');
    delete set.share;
    saveSet();
    drawShare();
  };
  // the shared copy follows your changes, a few minutes later
  let shareT = 0;
  on('change', () => {
    if (!set.share?.id) return;
    clearTimeout(shareT);
    shareT = setTimeout(shareUpload, 5 * 60e3);
  });
} else {
  // Visiting: a banner with whose room this is, and a way to your own shelf
  const bar = document.createElement('div');
  bar.className = 'visit-bar';
  bar.innerHTML = `<span>👀 ${set.owner ? `<b>${esc(set.owner)}</b>’s room` : 'Visiting a room'}</span><a class="btn" href="./">My own shelf</a>`;
  document.body.append(bar);
}
