'use strict';
// Offline copy and the "Install the app" button.
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#sInstall').hidden = false; });
$('#sInstall').onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt(); await installEvt.userChoice;
  installEvt = null; $('#sInstall').hidden = true;
};
