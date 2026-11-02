'use strict';
// INSTALL & UPDATES — registers the offline copy (sw.js), shows 'Update now' when a new version is ready,
// and the 'Install the app' button in Settings.
// When a new version is downloaded, show "Update now"; tapping it switches over and reloads.
if ('serviceWorker' in navigator)
  addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('sw.js').catch(() => null);
    if (!reg) return;
    const ready = (w) => {
      if (w && navigator.serviceWorker.controller) {
        $('#updBtn').hidden = false;
        $('#updBtn').onclick = () => w.postMessage('skip');
      }
    };
    ready(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => w.state === 'installed' && ready(w));
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    });
    document.addEventListener('visibilitychange', () => document.hidden || reg.update());
  });
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  $('#sInstall').hidden = false;
});
$('#sInstall').onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  $('#sInstall').hidden = true;
};
