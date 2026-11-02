'use strict';
// SCAN A GAME CASE — the 📷 button in the + sheet opens the camera.
//   1. It looks for the barcode on the back. A barcode is just a number, so it's looked up to get the title:
//      first through your own helper (BARCODE_HELPER, see tools/barcode-helper.js), then Open Products Facts.
//   2. If no barcode is found (or it's unknown), it reads the title printed on the front cover (OCR).
// Either way, the title it finds goes into the search box and RAWG shows the matching games to pick from.

// Address of your Cloudflare helper for barcode lookups. Empty = only Open Products Facts (knows few games).
const BARCODE_HELPER = 'https://gameshelf-barcode.spendraxapp.workers.dev';

const BARCODE_LIB = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const OCR_LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const scan = {
  stream: null, // the camera
  timer: 0, // checks a camera frame every 300 ms
  busy: false, // true while a frame is being read
  tried: new Set(), // barcodes already looked up this time
  nextCover: 0, // when to try reading the cover by itself
  coverTries: 0,
};

const scanMsg = (t) => ($('#scanMsg').textContent = t);
const loadScript = (src) =>
  new Promise((ok, fail) =>
    document.head.append(Object.assign(document.createElement('script'), { src, onload: ok, onerror: fail })),
  );

/* ---------- Camera ---------- */

async function openScanner() {
  $('#dlgScan').showModal();
  scanMsg('Point at the barcode on the back, or the title on the front.');
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch {
    scanMsg('The camera isn’t available. Allow camera access, or search by name.');
    return;
  }
  const v = $('#scanVideo');
  v.srcObject = scan.stream;
  await v.play();
  scan.tried.clear();
  scan.coverTries = 0;
  scan.nextCover = Date.now() + 4500; // give the barcode a head start
  getOcr().catch(() => {}); // start downloading the cover reader in the background
  scan.timer = setInterval(tick, 300);
}

function closeScanner() {
  clearInterval(scan.timer);
  scan.stream?.getTracks().forEach((t) => t.stop());
  scan.stream = null;
  if ($('#dlgScan').open) $('#dlgScan').close();
}

// A still picture of what the camera sees, at most `max` pixels wide
function frame(max) {
  const v = $('#scanVideo');
  const s = Math.min(1, max / v.videoWidth);
  const c = document.createElement('canvas');
  c.width = v.videoWidth * s;
  c.height = v.videoHeight * s;
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c;
}

async function tick() {
  if (scan.busy || !scan.stream || !$('#scanVideo').videoWidth) return;
  scan.busy = true;
  try {
    const code = await readBarcode().catch(() => ''); // no barcode reader (offline?): the cover still works
    if (code && !scan.tried.has(code)) {
      scan.tried.add(code);
      scanMsg('Barcode found. Looking it up…');
      const title = await lookupBarcode(code);
      if (title) return scanFound(title, 'barcode');
      scanMsg('That barcode isn’t in the database. Show the front cover instead.');
      scan.nextCover = Date.now() + 1500;
    } else if (Date.now() > scan.nextCover && scan.coverTries < 3 && ocrWorker) {
      scan.coverTries++;
      await readCover(true).catch(() => {});
      scan.nextCover = Date.now() + 3000;
    }
  } finally {
    scan.busy = false;
  }
}

/* ---------- Barcode ---------- */

// Chrome on Android has a built-in barcode reader; other browsers use the ZXing library instead
let detector = null;
try {
  detector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e'] });
} catch {}
let zxing = null;
let zxingLoading = null; // the library is downloaded only once

async function readBarcode() {
  if (detector) {
    const [hit] = await detector.detect($('#scanVideo')).catch(() => []);
    return hit?.rawValue || '';
  }
  if (!zxing) {
    await (zxingLoading ??= loadScript(BARCODE_LIB));
    const hints = new Map([
      [
        ZXing.DecodeHintType.POSSIBLE_FORMATS,
        [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_E,
        ],
      ],
    ]);
    zxing = new ZXing.MultiFormatReader();
    zxing.setHints(hints);
  }
  try {
    const light = new ZXing.HTMLCanvasElementLuminanceSource(frame(800));
    return zxing.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(light))).getText();
  } catch {
    return '';
  }
}

// Barcode number → product name, e.g. "Elden Ring - PlayStation 5"
async function lookupBarcode(code) {
  if (BARCODE_HELPER) {
    try {
      const d = await (await fetch(`${BARCODE_HELPER}?upc=${code}`)).json();
      if (d.items?.[0]?.title) return d.items[0].title;
    } catch {}
  }
  try {
    const d = await (
      await fetch(`https://world.openproductsfacts.org/api/v2/product/${code}.json?fields=product_name`)
    ).json();
    if (d.product?.product_name) return d.product.product_name;
  } catch {}
  return '';
}

/* ---------- Reading the cover ---------- */

let ocrWorker = null;
let ocrLoading = null; // downloaded only once (a few MB the first time, then kept offline)
async function getOcr() {
  ocrLoading ??= loadScript(OCR_LIB).then(() => Tesseract.createWorker('eng'));
  try {
    ocrWorker = await ocrLoading;
  } catch (e) {
    ocrLoading = null; // allow another try later
    throw e;
  }
  return ocrWorker;
}

// auto = tried by itself: only accept a clearly read title
async function readCover(auto) {
  scanMsg(ocrWorker ? 'Reading the cover…' : 'Getting the cover reader ready…');
  const w = await getOcr();
  const { data } = await w.recognize(frame(1280));
  const r = coverTitle(data.lines || []);
  if (r && (!auto || r.conf >= 70)) return scanFound(r.q, 'cover');
  scanMsg(
    auto
      ? 'Still looking… hold the case steady, with the barcode or the front cover in the frame.'
      : 'Couldn’t read a title. Get closer, with the front cover flat and well lit.',
  );
}

// The title is usually the biggest text on the cover: keep the tallest clear line (plus the next one if it's
// nearly as big, for two-line titles), after removing platform names and age-rating words.
function coverTitle(lines) {
  const ok = lines.reduce((a, l) => {
    const q = cleanTitle(l.text)
      .q.replace(/[^\p{L}\p{N}' :&!.-]/gu, '')
      .trim();
    const h = l.bbox.y1 - l.bbox.y0;
    return (q.match(/\p{L}/gu) || []).length >= 3 && l.confidence >= 55
      ? a.concat({ q, h, y: l.bbox.y0, conf: l.confidence })
      : a;
  }, []);
  if (!ok.length) return null;
  const [top, next] = [...ok].sort((a, b) => b.h - a.h);
  const both = next && next.h >= top.h * 0.6 ? [top, next].sort((a, b) => a.y - b.y) : [top];
  return { q: both.map((l) => l.q).join(' '), conf: top.conf };
}

/* ---------- Turning what was read into a search ---------- */

const PLATFORM_WORDS = [
  [/play\s?station\s?5|\bps5\b/i, 'PlayStation 5'],
  [/play\s?station\s?4|\bps4\b/i, 'PlayStation 4'],
  [/xbox series/i, 'Xbox Series S/X'],
  [/xbox one/i, 'Xbox One'],
  [/switch\s?2/i, 'Nintendo Switch 2'],
  [/switch/i, 'Nintendo Switch'],
  [/\bpc\b|windows/i, 'PC'],
];
const NOT_TITLE =
  /\b(play\s?station\s?[45]?|ps[45]|xbox( series [xs](\s?\|\s?[xs])?| one)?|nintendo( switch( 2)?)?|switch( 2)?|sony|microsoft|pc|windows|video ?games?|game|standard|launch|deluxe|edition|day one|brand new|sealed|physical|ntsc|pal|region free|english|esrb|pegi|rated|rating|teen|mature|everyone|only on|content rated by|\d+\+)\b/gi;

// "Elden Ring - PlayStation 5 (Launch Edition)" → { q: "Elden Ring", platform: "PlayStation 5" }
function cleanTitle(text) {
  const platform = (PLATFORM_WORDS.find(([re]) => re.test(text)) || [])[1] || '';
  const parts = text
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .split(/\s[-–|]\s/)
    .map((p) => p.replace(NOT_TITLE, ' ').replace(/\s+/g, ' ').trim());
  return { q: parts.find((p) => p.length >= 2) || '', platform };
}

function scanFound(text, how) {
  const { q, platform } = cleanTitle(text);
  if (!q) return scanMsg('Couldn’t tell which game this is. Try the front cover, or search by name.');
  closeScanner();
  scanPlatform = platform;
  $('#addQ').value = q;
  search(q);
  toast(how === 'barcode' ? 'Found it! Tap the right game.' : `Read “${q}”`);
}

$('#scanBtn').onclick = openScanner;
$('#dlgScan').addEventListener('close', closeScanner);
$('#scanCover').onclick = async () => {
  if (scan.busy || !scan.stream) return;
  scan.busy = true;
  try {
    await readCover(false);
  } catch {
    scanMsg('The cover reader couldn’t load. Check your connection.');
  } finally {
    scan.busy = false;
  }
};
