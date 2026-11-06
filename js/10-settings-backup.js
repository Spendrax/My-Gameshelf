'use strict';
// SETTINGS — your own RAWG key, saving a backup file and loading one back.

$('#btnSettings').onclick = () => {
  $('#sKey').value = set.key;
  $('#ver').textContent = VERSION;
  $('#dlgSet').showModal();
};
$('#sKey').onchange = (e) => {
  set.key = e.target.value.trim();
  saveSet();
};
// Everything worth keeping, with your photos put back inside (also used by the Google Drive backup)
async function backupData() {
  return {
    app: 'my-gameshelf',
    version: VERSION,
    saved: new Date().toISOString(),
    settings: {
      ...set,
      key: '',
      psnToken: '',
      xboxKey: '',
      drive: undefined,
    } /* sign-ins stay on this phone */,
    games: await Promise.all(
      games.map(async (g) =>
        g.cover?.startsWith('photos/') ? { ...g, cover: await photoData(g.cover) } : g,
      ),
    ),
  };
}

$('#sExport').onclick = async () => {
  const blob = new Blob([JSON.stringify(await backupData(), null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `gameshelf-backup-${today()}.json`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e4);
  toast('Backup saved');
};
$('#sImport').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const list = Array.isArray(data) ? data : data.games;
    if (!Array.isArray(list)) throw 0;
    const map = new Map(games.map((g) => [g.id, g]));
    const n = list.reduce((n, g) => {
      if (!g || !g.title) return n;
      const id = g.id || uid();
      map.set(id, { status: 'backlog', rating: 0, genres: [], ...g, id });
      return n + 1;
    }, 0);
    games = [...map.values()];
    save();
    toast(`${n} games loaded`);
  } catch {
    toast("That file isn't a Gameshelf backup");
  }
};

// Calm mode: the decorative animations stop (the buddy still moves)
$('#btnSettings').addEventListener('click', () => ($('#sCalm').checked = !!set.calm));
$('#sCalm').onchange = (e) => {
  set.calm = e.target.checked;
  saveSet();
  applyLook();
};
