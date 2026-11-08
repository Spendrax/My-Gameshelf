'use strict';
// LANGUAGES — Settings → Display → Language. "Automatic" follows the phone's language.
// Instead of touching every file, this layer swaps the app's English text for another language as it appears
// on screen (text, placeholders, button labels, toasts, the buddy's lines). Game titles and notes stay as they are.
// Each language is one file in js/lang/ (LANG.xx = { words, tpl }), loaded only when it's picked.
//   words: whole phrases. A phrase is looked up as-is, then without the emoji/punctuation around it ("🏆 Today!").
//   tpl: phrases with a changing part; {1}, {2}… stand for the changing parts (they're translated too).
// To add a phrase: add it to every file in js/lang/. To add a language: copy fr.js, translate it, add it below.

const LANGS = {
  fr: 'Français',
  es: 'Español',
  ht: 'Kreyòl ayisyen',
  pt: 'Português',
  de: 'Deutsch',
  it: 'Italiano',
};
const LANG = {};
set.lang ||= 'auto';

// "auto": the first of the phone's languages that the app speaks (English counts too)
function pickLang() {
  if (set.lang !== 'auto') return set.lang;
  for (const l of navigator.languages || [navigator.language]) {
    const c = l.slice(0, 2).toLowerCase();
    if (c === 'en' || LANGS[c]) return c;
  }
  return 'en';
}

let W = {}; // phrases of the picked language
let TPL = [];

// Emoji, spaces and end punctuation around a phrase ("🏆 Today", "Change…", "Nice!") are kept as they are
const EDGES =
  /^([\s\p{Extended_Pictographic}️‍…!?.:,·⟳∞✕✋▶—-]*)(.*?)([\s\p{Extended_Pictographic}️‍…!?.:,·⟳∞✕✋▶—-]*)$/su;
const trCache = new Map();

function tr(text) {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  if (trCache.has(text)) return trCache.get(text);
  const [, pre, core, post] = text.match(EDGES);
  let out = W[text] ?? (W[core] != null ? pre + W[core] + post : null);
  for (const s of out == null ? [core, text] : []) {
    const hit = TPL.find(([re]) => re.test(s));
    if (!hit) continue;
    const m = s.match(hit[0]);
    out = hit[1].replace(/\{(\d)\}/g, (_, i) => tr(m[i]));
    if (s === core) out = pre + out + post;
    break;
  }
  out ??= text;
  trCache.set(text, out);
  return out;
}

// Game titles, notes and anything typed by you stay as they are
const MINE = '.fb, .notes, .lrow span, .pick h4, textarea, script, style, code';
const ATTRS = ['placeholder', 'aria-label', 'title', 'label'];

function translate(root) {
  if (root.nodeType === 3) {
    if (!root.parentElement?.closest(MINE)) {
      const t = tr(root.nodeValue);
      if (t !== root.nodeValue) root.nodeValue = t;
    }
    return;
  }
  if (root.nodeType !== 1 || root.closest(MINE)) return;
  for (const el of [root, ...root.querySelectorAll('[placeholder],[aria-label],[title],optgroup[label]')])
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && tr(v) !== v) el.setAttribute(a, tr(v)); // only when it changes, or the observer would loop
    }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) translate(n);
}

function startLang(code) {
  ({ words: W } = LANG[code]);
  TPL = Object.entries(LANG[code].tpl)
    .map(([en, t]) => [en.replace(/[.!?]$/, ''), t.replace(/ ?[.!?]$/, '')]) // matched without end punctuation
    .map(([en, t]) => [
      new RegExp('^' + en.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '(.+?)') + '$'),
      t,
    ]);
  document.documentElement.lang = code;
  translate(document.body);
  new MutationObserver((list) => {
    for (const m of list)
      if (m.type === 'attributes') {
        const v = m.target.getAttribute(m.attributeName);
        if (v && tr(v) !== v && !m.target.closest(MINE)) m.target.setAttribute(m.attributeName, tr(v));
      } else m.addedNodes.forEach(translate);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  const ask = window.confirm.bind(window);
  window.confirm = (msg) => ask(tr(msg));
}

const langCode = pickLang();
if (LANGS[langCode])
  loadScript(`js/lang/${langCode}.js`).then(
    () => startLang(langCode),
    () => {},
  );

/* ---------- Settings ---------- */

$('#sLang').value = set.lang;
$('#sLang').onchange = (e) => {
  set.lang = e.target.value;
  saveSet();
  location.reload();
};
