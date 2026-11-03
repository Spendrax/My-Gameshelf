'use strict';
// EDIT FORM — add or change a game: title, platform, status, rating, hours, dates, genres, notes, picture.
// `draft` holds the game being edited until Save.

let draft = null;
const form = $('#fEdit');

function openEdit(g) {
  draft = Object.assign({ status: 'backlog', rating: 0, genres: [] }, g);
  const isNew = !draft.id;
  $('#editH').textContent = isNew ? 'New game' : 'Edit game';
  $('#eDel').hidden = isNew;
  for (const k of ['title', 'platform', 'hours', 'year', 'started', 'finished', 'notes'])
    form.elements[k].value = draft[k] ?? '';
  form.elements.genres.value = (draft.genres || []).join(', ');
  $('#platList').innerHTML = [...new Set([...(draft.platforms || []), ...PLATFORMS])].reduce(
    (h, p) => h + `<option value="${esc(p)}">`,
    '',
  );
  form.elements.endless.checked = !!draft.endless;
  drawEditBits();
  $('#eArt').hidden = true;
  $('#dlgEdit').showModal();
}

function drawCover() {
  $('#eCover').innerHTML = caseHTML(
    {
      ...draft,
      title: form.elements.title.value || draft.title || '?',
      platform: form.elements.platform.value,
      id: '',
    },
    'big',
  );
}
function drawEditBits() {
  drawCover();
  // a never-ending game can't be finished
  $('#eFinished').hidden = !!draft.endless;
  $('#eStatus').innerHTML = Object.entries(STATUS).reduce(
    (h, [k, s]) =>
      draft.endless && k === 'finished'
        ? h
        : h +
          `<button type="button" data-s="${k}" style="--sc:${s.color}" class="${draft.status === k ? 'on' : ''}">${s.label}</button>`,
    '',
  );
  $('#eRate').innerHTML = Array.from(
    { length: 10 },
    (_, i) =>
      `<button type="button" data-r="${i + 1}" aria-label="${i + 1} out of 10" class="${i < draft.rating ? 'on' : ''}"></button>`,
  ).join('');
  $('#eRateTxt').textContent = draft.rating ? `${draft.rating}/10` : '';
}
form.elements.endless.onchange = (e) => {
  draft.endless = e.target.checked;
  if (draft.endless && draft.status === 'finished') draft.status = 'playing';
  drawEditBits();
};
$('#eStatus').onclick = (e) => {
  const s = e.target.dataset.s;
  if (!s) return;
  draft.status = s;
  if (s === 'playing' && !form.elements.started.value) form.elements.started.value = today();
  if (s === 'finished' && !form.elements.finished.value) form.elements.finished.value = today();
  drawEditBits();
};
$('#eRate').onclick = (e) => {
  const r = +e.target.dataset.r;
  if (!r) return;
  draft.rating = draft.rating === r ? 0 : r;
  drawEditBits();
};
form.elements.title.addEventListener('change', drawCover);
form.elements.platform.addEventListener('change', drawCover);
// "Find cover art": the game's cover, artwork, screenshots and Steam art; tap one to use it
$('#eArtBtn').onclick = async () => {
  const box = $('#eArt');
  box.hidden = false;
  box.innerHTML = '<p class="dim small">Finding pictures\u2026</p>';
  const list = await gamePictures({ ...draft, title: form.elements.title.value.trim() || draft.title });
  box.innerHTML = list.length
    ? list.reduce(
        (h, u) =>
          h +
          `<button type="button" data-art="${esc(u)}" class="${u === draft.cover ? 'on' : ''}" style="background-image:url('${esc(u).replace(/'/g, '%27')}')" aria-label="Use this picture"></button>`,
        '',
      )
    : '<p class="dim small">No pictures found. Check the title, or use one of your photos.</p>';
  // pictures that don't exist (some games have no Steam art) quietly disappear
  $$('#eArt [data-art]').forEach((b) => {
    const test = new Image();
    test.onerror = () => b.remove();
    test.src = b.dataset.art;
  });
};
$('#eArt').onclick = (e) => {
  const b = e.target.closest('[data-art]');
  if (!b) return;
  draft.cover = b.dataset.art;
  drawCover();
  $$('#eArt button').forEach((x) => x.classList.toggle('on', x === b));
};
$('#eNoCover').onclick = () => {
  draft.cover = '';
  drawCover();
};
$('#eFile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  draft.cover = await shrinkImage(f);
  drawCover();
};

// Crops a picture to the case shape and keeps it small enough for the phone's storage
function shrinkImage(file) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const W = 360,
        H = 430,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const s = Math.max(W / img.width, H / img.height);
      c.getContext('2d').drawImage(
        img,
        (W - img.width * s) / 2,
        (H - img.height * s) / 2,
        img.width * s,
        img.height * s,
      );
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.78));
    };
    img.src = URL.createObjectURL(file);
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = (k) => form.elements[k].value.trim();
  const wasFinished = draft.id && byId(draft.id)?.status === 'finished';
  const g = {
    ...draft,
    title: v('title'),
    platform: v('platform'),
    hours: Math.max(0, +v('hours') || 0),
    year: v('year'),
    started: v('started'),
    finished: form.elements.endless.checked ? '' : v('finished'),
    endless: form.elements.endless.checked,
    notes: v('notes'),
    genres: v('genres')
      .split(',')
      .reduce((a, x) => ((x = x.trim()) ? a.concat(x) : a), []),
    updated: Date.now(),
  };
  delete g.platforms;
  if (byId(g.id)?.cover !== g.cover) delete g.screen; // new cover: find a new wide picture
  if (!g.title) return;
  const isNew = !g.id;
  if (isNew) {
    g.id = uid();
    g.added = Date.now();
    games.unshift(g);
  } else games[games.findIndex((x) => x.id === g.id)] = g;
  save();
  $('#dlgEdit').close();
  if (isNew) emit('added', g);
  if (g.status === 'finished' && !wasFinished) emit('finished', g);
  if (!isNew && $('#dlgGame').open) openGame(g.id);
  toast(isNew ? 'On the rack!' : 'Saved');
});
$('#eDel').onclick = () => {
  if (!confirm(`Delete "${draft.title}"?`)) return;
  games = games.filter((g) => g.id !== draft.id);
  save();
  $('#dlgEdit').close();
  $('#dlgGame').close();
  toast('Deleted');
};
