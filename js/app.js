import { html, raw, toString, esc } from './html.js';
import { SLOTS, TYPES, TYPE, COLORS, COLOR, PATTERNS, FORMALITY, WARMTH_LABELS, STARTER_BASICS, COLLECTIONS, illustration, typesForSlot, colorLabel, nearestColor, defaultItemFields, orderTypes, typeRank, orderedCuts, defaultCut, defaultLength, cutLabel, lengthLabel, cutWarmth } from './catalog.js';
import { db, save, uid, createItem, getItem, updateItem, deleteItem, resetAll, putPhoto, deletePhoto, photoUrls, loadPhotos, processUpload, exportData, itemName } from './store.js';
import { geocode, getForecastWindow, manualWeather } from './weather.js';
import { curatedSearch, parseQuery, commonsProvider, SLOT_LABEL } from './archive.js';
import { EXAMPLE, EXAMPLES } from './starter-catalog.js';
import { garmentImg, hydrateGarments, imageSource } from './garments.js';
import { PRESETS, MOVES, OUTDOOR, planFromPreset, rememberPlan, interpretNote } from './plan.js';
import { buildContext, recommend, alternatives, rescore, outfitItems, outfitKey, pairKey, wardrobeGaps, FAIL_TEXT, wp } from './recommender.js';

// ---------------------------------------------------------------- state
const S = {
  tab: 'today',
  view: null, // sub-page: 'starter' | 'catalog'
  scrollTo: null, // element id to bring into view after the next render
  onboardStep: 'welcome', // welcome | collection | starter | next
  sheet: null,
  toast: null,
  today: freshToday(),
  wardrobeFilter: 'all',
  cat: freshCatalog(),
  moreColors: false, // "More colours" expanded in colour pickers
  loc: { q: '', results: [], status: 'idle', error: null },
};

// Catalogue search state. source: 'curated' (default) | 'online'.
function freshCatalog(over = {}) {
  return { source: 'curated', query: '', slot: '', type: '', types: [], cut: '', length: '', color: '', pattern: '', ignored: [], limit: 30, replaceId: null,
    online: { status: 'idle', results: [], hidden: null, error: null, nextOffset: null }, ...over };
}

function freshToday() {
  return { stage: 'pick', plan: null, editing: false, weather: { status: 'idle' }, manual: { low: 10, high: 16, rain: false, windy: false }, result: null, shown: [], locks: {}, exclude: new Set(), session: { thermal: 0, formality: 0 }, justWore: null };
}

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet');
const $toast = document.getElementById('toast');

// ---------------------------------------------------------------- helpers
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const r0 = (v) => Math.round(v);
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
const owned = () => db.items.filter((i) => i.ownership === 'owned');
const fmtDate = (iso) => new Date(iso + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function icon(name) {
  const p = {
    today: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4.2"/>',
    wardrobe: '<path d="M9 4.5a3 3 0 0 1 6 0c0 1.5-1.2 2.2-2.2 2.8-.5.3-.8.7-.8 1.2v.5M12 9l9 7.2c.8.7.3 1.8-.7 1.8H3.7c-1 0-1.5-1.1-.7-1.8z"/>',
    outfits: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
    profile: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.3v.2"/>',
    layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  }[name];
  return raw(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`);
}

// The catalogue ordering preference; never used to hide anything.
const coll = () => db.prefs.collection || 'all';
const gimg = (v, cls) => garmentImg(v, cls, coll());

// Every garment image sits in the same neutral frame. Images are contained
// (never stretched or cropped) unless the user zoomed in with the framing controls.
function framed(inner, frame, cls = '') {
  const f = frame || {};
  return html`<span class="frame ${cls}" style="--z:${f.zoom || 1};--x:${f.x ?? 50}%;--y:${f.y ?? 50}%">${inner}</span>`;
}

function itemImg(item, cls = '') {
  if (!item) return '';
  const im = item.image || {};
  if (im.kind === 'photo' && photoUrls.get(im.photoId)) return framed(html`<img src="${photoUrls.get(im.photoId)}" alt="">`, im.frame, cls);
  if (im.kind === 'archive' && im.thumb) return framed(html`<img src="${im.thumb}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${item.id}">`, im.frame, cls);
  return gimg(item, cls);
}

const CATALOG_SOURCE = { photo: 'Catalog photo', generated: 'Generated stand-in', illustration: 'Illustrated stand-in' };
const sourceLabel = (item) => ({ photo: 'Your photo', archive: 'Online archive photo' }[item.image?.kind] || CATALOG_SOURCE[imageSource(item, coll())]);
const APPROX_NOTE = 'Choose the closest match to your garment. You can replace it with your own photo later.';

// Cut and length choices as image tiles, so e.g. wide-leg and baggy look different.
function cutTiles(act, v) {
  const t = TYPE[v.type];
  if (t.cuts.length < 2) return '';
  return html`<h4>Cut / fit</h4><div class="cut-grid" role="radiogroup" aria-label="Cut / fit">${orderedCuts(t, coll()).map((c) => html`
    <button type="button" role="radio" aria-checked="${String(c === v.cut)}" class="cut-tile ${c === v.cut ? 'on' : ''}" data-act="${act}" data-v="${c}">
      ${gimg({ ...v, cut: c, color: v.color || t.starter[0] })}<span>${cutLabel(t, c)}</span></button>`)}</div>`;
}

function lengthTiles(act, v) {
  const t = TYPE[v.type];
  if (!t.lengths) return '';
  return html`<h4>Length</h4><div class="cut-grid" role="radiogroup" aria-label="Length">${t.lengths.map((l) => html`
    <button type="button" role="radio" aria-checked="${String(l === v.length)}" class="cut-tile ${l === v.length ? 'on' : ''}" data-act="${act}" data-v="${l}">
      ${gimg({ ...v, length: l, color: v.color || t.starter[0] })}<span>${lengthLabel(t, l)}</span></button>`)}</div>`;
}

// Named colour chips: a compact core palette, "More colours", and multicolour.
function colorPicker(act, selected, { multi = false } = {}) {
  const sel = multi ? selected : [selected];
  const chip = (c) => html`<button type="button" class="color-chip ${sel.includes(c.id) ? 'on' : ''}" aria-pressed="${String(sel.includes(c.id))}" data-act="${act}" data-v="${c.id}"><span class="dot" style="--c:${c.css || c.hex}"></span>${c.label}</button>`;
  const shown = COLORS.filter((c) => S.moreColors || c.core || sel.includes(c.id));
  return html`<div class="color-chips">${shown.map(chip)}
    <button type="button" class="color-chip more" data-act="toggleMoreColors" aria-expanded="${String(S.moreColors)}">${S.moreColors ? 'Fewer colours' : `More colours (${COLORS.length - shown.length})`}</button></div>`;
}

// Thickness maps onto the warmth scale around the type's typical value.
// "Not sure" keeps the typical value and leaves it marked as estimated.
const THICKNESS = [{ id: 'thin', label: 'Thin' }, { id: 'medium', label: 'Medium' }, { id: 'thick', label: 'Thick' }, { id: 'unsure', label: 'Not sure' }];
function warmthFor(t, cut, thickness) {
  const base = cutWarmth(t, cut);
  return Math.max(1, Math.min(5, base + ({ thin: -1, thick: 1 }[thickness] || 0)));
}

// Framing for photos: zoom and position only change how the image sits in
// its frame; the stored photo is untouched.
function frameControls(frame, prefix) {
  const f = frame || {};
  return html`<div class="frame-controls">
    <label>Zoom<input type="range" min="1" max="3" step="0.05" value="${f.zoom || 1}" data-input="${prefix}Zoom"></label>
    <label>Left / right<input type="range" min="0" max="100" value="${f.x ?? 50}" data-input="${prefix}X"></label>
    <label>Up / down<input type="range" min="0" max="100" value="${f.y ?? 50}" data-input="${prefix}Y"></label>
    <button type="button" class="link small" data-act="${prefix}Reset">Reset framing</button>
  </div>`;
}

// Short names for the categories an outfit still needs.
const GAP_SHORT = { top: 'a top', bottom: 'bottoms', shoes: 'shoes' };
const outfitGaps = () => wardrobeGaps(owned());

function gapsCard(gaps, title) {
  return html`<div class="card problem"><h3>${title}</h3>
    <p class="small">To build a complete outfit I still need:</p>
    <ul>${gaps.map((g) => html`<li>${cap(g.text)}${g.unavailable ? html` <span class="muted small">— yours are all marked unavailable or in the laundry</span>` : ''}</li>`)}</ul>
    <div class="row gap wrap">${gaps.map((g) => html`<button type="button" class="btn sm" data-act="openStarterSlot" data-v="${g.slot}">Add ${GAP_SHORT[g.slot]}</button>`)}
    ${gaps.some((g) => g.unavailable) ? html`<button type="button" class="btn sm ghost" data-act="tab" data-v="wardrobe">Check laundry</button>` : ''}</div></div>`;
}

function cantFind(slot = '') {
  return html`<div class="cant-find">
    <strong>Can't find your item?</strong>
    <div class="row gap wrap">
      <button type="button" class="btn sm" data-act="openCatalog" data-v="${slot}">${icon('search')} Search the larger catalog</button>
      <button type="button" class="btn sm" data-act="openUpload">${icon('camera')} Upload a photo</button>
    </div></div>`;
}
const formalityRange = (f) => (f[0] === f[1] ? FORMALITY[f[0]].label : `${FORMALITY[f[0]].label} – ${FORMALITY[f[1]].label}`);

function seg(act, options, value, extra = '') {
  return html`<div class="seg" role="radiogroup">${options.map((o) => html`<button type="button" role="radio" aria-checked="${String(o.id === value)}" class="${o.id === value ? 'on' : ''}" data-act="${act}" data-v="${o.id}" ${raw(extra)}>${o.label}</button>`)}</div>`;
}

function chips(act, options, values) {
  return html`<div class="chips">${options.map((o) => html`<button type="button" class="chip ${values.includes(o.id) ? 'on' : ''}" aria-pressed="${String(values.includes(o.id))}" data-act="${act}" data-v="${o.id}">${o.label}</button>`)}</div>`;
}

function toast(msg, ms = 3200) {
  S.toast = msg;
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $toast.classList.remove('show'); S.toast = null; }, ms);
}

// ---------------------------------------------------------------- render
// Re-rendering replaces DOM nodes, so remember which control had focus.
function focusKey() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const d = el.dataset || {};
  const key = d.act || d.change || d.input;
  return key ? `[data-${d.act ? 'act' : d.change ? 'change' : 'input'}="${key}"]${d.v ? `[data-v="${d.v}"]` : ''}${d.id ? `[data-id="${d.id}"]` : ''}${d.i ? `[data-i="${d.i}"]` : ''}` : null;
}

function render() {
  const fk = focusKey();
  renderInner();
  if (fk) {
    try {
      const el = document.querySelector(fk);
      if (el && (!S.sheet || $sheet.contains(el))) el.focus({ preventScroll: true });
    } catch { /* selector with odd characters — ignore */ }
  }
}

function renderInner() {
  const onboarding = !db.prefs.onboarded;
  let body;
  // The catalogue is reachable during onboarding too, so sub-views come first.
  if (S.view === 'starter') body = viewStarter();
  else if (S.view === 'catalog') body = viewCatalog();
  else if (onboarding) body = viewOnboarding();
  else body = { today: viewToday, wardrobe: viewWardrobe, outfits: viewOutfits, profile: viewProfile }[S.tab]();
  const nav = onboarding || S.view ? '' : html`
    <nav class="tabbar" aria-label="Main">
      ${[['today', 'Today'], ['wardrobe', 'Wardrobe'], ['outfits', 'Outfits'], ['profile', 'You']].map(([id, label]) => html`
        <button type="button" class="${S.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}" aria-current="${S.tab === id ? 'page' : 'false'}">${icon(id)}<span>${label}</span></button>`)}
    </nav>`;
  $app.innerHTML = toString(html`<main class="screen ${S.view ? 'sub' : ''}">${body}</main>${nav}`);
  hydrateGarments($app);
  // Keep the chosen chip visible in horizontally scrolling filter rows.
  $app.querySelectorAll('.chips.scroll-x').forEach((row) => {
    const on = row.querySelector('.on');
    if (on) row.scrollLeft = on.offsetLeft - row.offsetLeft - 16;
  });
  if (S.scrollTo) {
    document.getElementById(S.scrollTo)?.scrollIntoView({ block: 'start' });
    S.scrollTo = null;
  }
  renderSheet();
}

function renderSheet() {
  if (!S.sheet) {
    if ($sheet.innerHTML) { $sheet.innerHTML = ''; document.body.classList.remove('sheet-open'); }
    return;
  }
  const fn = SHEETS[S.sheet.type];
  const wasOpen = document.body.classList.contains('sheet-open');
  const scroll = $sheet.querySelector('.sheet-body')?.scrollTop || 0;
  const existing = $sheet.querySelector('.sheet');
  // Re-render inside the existing sheet so the open animation doesn't replay.
  if (existing && existing.dataset.kind === S.sheet.type) existing.innerHTML = toString(fn(S.sheet));
  else $sheet.innerHTML = toString(html`<div class="backdrop" data-act="closeSheet"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-kind="${S.sheet.type}">${fn(S.sheet)}</section>`);
  document.body.classList.add('sheet-open');
  hydrateGarments($sheet);
  const sb = $sheet.querySelector('.sheet-body');
  if (sb) sb.scrollTop = scroll;
  if (!wasOpen || !existing || existing.dataset.kind !== S.sheet.type) $sheet.querySelector('.sheet h2')?.focus();
}

function sheetHead(title, sub) {
  return html`<header class="sheet-head"><div><h2 id="sheet-title" tabindex="-1">${title}</h2>${sub ? html`<p class="muted small">${sub}</p>` : ''}</div>
    <button type="button" class="icon-btn" data-act="closeSheet" aria-label="Close">${icon('close')}</button></header>`;
}

// ---------------------------------------------------------------- onboarding
function viewOnboarding() {
  if (S.onboardStep === 'welcome') {
    return html`<section class="welcome">
      <div class="welcome-art">${illustration({ type: 'shirt', color: 'white' })}${illustration({ type: 'jeans', color: 'denim', cut: 'wide-leg' })}${illustration({ type: 'sneakers', color: 'white' })}</div>
      <h1>Less time deciding what to wear</h1>
      <p class="lead">Tell me roughly what's in your wardrobe and where you're going. I'll check the weather for the hours you're out and suggest outfits from clothes you actually own.</p>
      <ul class="ticks">
        <li>${icon('check')} Start with a few everyday pieces — no need to add everything</li>
        <li>${icon('check')} Can't find something? Search the larger catalog or upload a photo</li>
        <li>${icon('check')} No account: everything stays on this device</li>
      </ul>
      <button type="button" class="btn primary block" data-act="startOnboard">Get started</button>
    </section>`;
  }
  if (S.onboardStep === 'collection') return viewCollectionStep();
  if (S.onboardStep === 'next') return viewNextSteps();
  return viewStarter();
}

const COLLECTION_HINTS = {
  womenswear: 'Womenswear cuts and pieces like blouses, skirts and dresses first',
  menswear: 'Menswear cuts and pieces like shirts, chinos and oxfords first',
  all: 'Everything together, in a neutral order',
};

function viewCollectionStep() {
  return html`<section class="pad collection-step">
    <header class="subhead"><button type="button" class="icon-btn" data-act="onboardBack" aria-label="Back">${icon('back')}</button>
      <div><p class="eyebrow">Optional</p><h1>Which collection would you like to see first?</h1></div></header>
    <p class="muted">This only changes what's shown first. Every garment stays available, and you can switch any time.</p>
    <div class="coll-list">${COLLECTIONS.map((c) => html`<button type="button" class="preset ${db.prefs.collection === c.id ? 'on' : ''}" data-act="pickCollection" data-v="${c.id}">
      <span class="preset-title">${c.label}</span><span class="muted small">${COLLECTION_HINTS[c.id]}</span></button>`)}</div>
    <button type="button" class="btn ghost block" data-act="pickCollection" data-v="">Skip</button>
  </section>`;
}

function viewNextSteps() {
  const n = owned().length;
  const gaps = outfitGaps();
  return html`<section class="pad next-steps">
    <header class="subhead"><button type="button" class="icon-btn" data-act="onboardBack" aria-label="Back to basics">${icon('back')}</button>
      <div><p class="eyebrow">${n} item${n === 1 ? '' : 's'} added</p><h1>${gaps.length ? 'Almost there' : 'Ready for your first outfits'}</h1></div></header>
    <p class="muted">You don't need to add everything now — more items just means more variety. Add things whenever you like from the Wardrobe tab.</p>
    ${gaps.length ? gapsCard(gaps, 'One more step for outfit ideas') : ''}
    <button type="button" class="btn primary block" data-act="finishOnboard" ${gaps.length ? 'disabled' : ''}>Get my first outfit suggestions</button>
    <div class="add-row col next-opts">
      <button type="button" class="add-opt" data-act="openCatalog">${icon('search')}<span><strong>Add more from the catalog</strong><small>Every type, cut and colour, plus online photos</small></span></button>
      <button type="button" class="add-opt" data-act="openUpload">${icon('camera')}<span><strong>Upload a photo</strong><small>Of your own garment — it stays on this device</small></span></button>
    </div>
    <details class="card optional">
      <summary><strong>Optional:</strong> how do you usually feel the temperature?</summary>
      ${seg('setThermal', [{ id: 'cold', label: 'Cold easily' }, { id: 'neutral', label: 'About average' }, { id: 'warm', label: 'Warm easily' }], db.prefs.thermal)}
      <p class="muted small">Change this, your style and your city any time under “You”.</p>
    </details>
    ${gaps.length ? html`<button type="button" class="link small finish-later" data-act="finishLater">Finish later and look around</button>` : ''}
  </section>`;
}

const STYLE_OPTS = [
  { id: 'minimal', label: 'Minimal' }, { id: 'relaxed', label: 'Relaxed' }, { id: 'smart', label: 'Smart' },
  { id: 'sporty', label: 'Sporty' }, { id: 'colourful', label: 'Colourful' },
];

function locationPicker() {
  const loc = db.prefs.location;
  const L = S.loc;
  return html`<div class="loc">
    ${loc ? html`<p class="loc-current">${icon('pin')} <strong>${loc.name}</strong>${loc.region ? html` <span class="muted">${loc.region}</span>` : ''}</p>` : ''}
    <form class="row gap" data-submit="searchLoc">
      <label class="sr-only" for="loc-q">City</label>
      <input id="loc-q" class="grow" type="search" placeholder="${loc ? 'Change city…' : 'Search a city…'}" value="${L.q}" data-input="locQ" autocomplete="off">
      <button class="btn" type="submit">Search</button>
    </form>
    <button type="button" class="link small" data-act="geoLocate">Use my current location</button>
    ${L.status === 'loading' ? html`<p class="muted small" role="status">Searching…</p>` : ''}
    ${L.error ? html`<p class="error small" role="alert">${L.error}</p>` : ''}
    ${L.results.length ? html`<ul class="loc-results">${L.results.map((r, i) => html`<li><button type="button" data-act="pickLoc" data-i="${i}"><strong>${r.name}</strong> <span class="muted">${r.region}</span></button></li>`)}</ul>` : ''}
    ${L.status === 'empty' ? html`<p class="muted small">No places found.</p>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- starter basics
const STARTER_SLOTS = ['top', 'bottom', 'dress', 'layer', 'outer', 'shoes'];

function typeTile(t, inSlot) {
  const n = inSlot.filter((i) => i.type === t.id).length;
  return html`<button type="button" class="type-tile" data-act="openQuick" data-type="${t.id}">
    <span class="tile-img">${gimg({ type: t.id, color: t.starter[0], cut: defaultCut(t, coll()), length: defaultLength(t) })}</span>
    <span>${t.label}</span>
    ${n ? html`<b class="badge" aria-label="${n} added">${n}</b>` : ''}
  </button>`;
}

function viewStarter() {
  const onboard = !db.prefs.onboarded;
  const items = owned();
  const gaps = outfitGaps();
  // Categories with nothing from the preferred collection move to the end.
  const sections = STARTER_SLOTS.map((slotId) => {
    const types = orderTypes(STARTER_BASICS[slotId].map((id) => TYPE[id]), coll());
    return { slot: SLOTS.find((s) => s.id === slotId), main: types.filter((t) => !typeRank(t, coll())), more: types.filter((t) => typeRank(t, coll())) };
  }).sort((a, b) => (a.main.length ? 0 : 1) - (b.main.length ? 0 : 1));
  return html`<section class="pad starter">
    <header class="subhead">
      ${onboard ? html`<button type="button" class="icon-btn" data-act="onboardBack" aria-label="Back">${icon('back')}</button>` : html`<button type="button" class="icon-btn" data-act="closeView" aria-label="Back">${icon('back')}</button>`}
      <div><p class="eyebrow">${onboard ? 'Your wardrobe' : 'Starter basics'}</p><h1>Everyday basics</h1></div>
    </header>
    <p class="intro">Start with a few everyday pieces. If you don't see your item, search the larger catalog or upload your own photo.</p>
    ${cantFind()}
    <div class="coll-bar"><span class="muted small">Show first</span>${seg('setCollection', COLLECTIONS.map((c) => ({ id: c.id, label: c.id === 'all' ? 'All' : c.label })), coll())}</div>
    <p class="muted small approx">${APPROX_NOTE}</p>
    ${sections.map(({ slot, main, more }) => {
      const inSlot = items.filter((i) => i.slot === slot.id);
      return html`<section class="cat" id="cat-${slot.id}" aria-labelledby="cat-h-${slot.id}">
        <h2 id="cat-h-${slot.id}">${slot.step}${inSlot.length ? html` <span class="muted small">· ${inSlot.length} added</span>` : ''}</h2>
        <div class="type-grid">
          ${main.map((t) => typeTile(t, inSlot))}
          ${main.length ? '' : more.map((t) => typeTile(t, inSlot))}
          <button type="button" class="type-tile other" data-act="openCatalog" data-v="${slot.id}">${icon('search')}<span>Other ${slot.label.toLowerCase()}</span></button>
        </div>
        ${main.length && more.length ? html`<h4>More styles</h4><div class="type-grid">${more.map((t) => typeTile(t, inSlot))}</div>` : ''}
        ${inSlot.length ? html`<ul class="mini-list">${inSlot.map((i) => html`
          <li>${itemImg(i, 'xs')}<span>${cap(i.name)}</span><button type="button" class="icon-btn sm" data-act="removeItem" data-id="${i.id}" aria-label="Remove ${i.name}">${icon('close')}</button></li>`)}</ul>` : ''}
      </section>`;
    })}
    <div class="sticky-actions readiness-bar">
      <p class="small ready-status ${gaps.length ? '' : 'ok'}" role="status">${gaps.length
        ? html`Still needed for an outfit: ${gaps.map((g, i) => html`${i ? ', ' : ''}<button type="button" class="link" data-act="scrollSlot" data-v="${g.slot}">${GAP_SHORT[g.slot]}</button>`)}`
        : html`${icon('check')} Ready for outfit suggestions`}</p>
      <button type="button" class="btn ${gaps.length && onboard ? '' : 'primary'} block" data-act="${onboard ? 'starterDone' : 'closeView'}">${onboard ? 'Continue' : 'Done'}</button>
    </div>
  </section>`;
}

const SHEETS = {};

// ---------------------------------------------------------------- today
function viewToday() {
  if (!owned().length) {
    return html`<section class="pad empty">
      ${illustration({ type: 'tshirt', color: 'cream' })}
      <h1>Your wardrobe is empty</h1>
      <p class="muted">Add a few everyday pieces and I can start suggesting outfits.</p>
      <button type="button" class="btn primary" data-act="openAddMenu">${icon('plus')} Add clothing</button>
    </section>`;
  }
  const gaps = outfitGaps();
  if (gaps.length && S.today.stage === 'pick') {
    return html`<section class="pad today">
      ${feedbackPrompt()}
      <h1 class="big">Almost ready for outfit ideas</h1>
      ${gapsCard(gaps, 'A few more pieces needed')}
      <p class="muted small">You don't have to add your whole wardrobe — just enough for one complete outfit.</p>
    </section>`;
  }
  const T = S.today;
  return html`<section class="pad today">
    ${feedbackPrompt()}
    ${T.stage === 'pick' ? viewPick() : viewResults()}
  </section>`;
}

function pendingWears() {
  const today = localDate();
  return db.wears.filter((w) => !w.feedback && !w.dismissed && w.date < today);
}

function feedbackPrompt() {
  const p = pendingWears()[0];
  if (!p || S.today.stage !== 'pick') return '';
  const items = p.itemIds.map(getItem).filter(Boolean);
  return html`<div class="card prompt">
    <div class="row gap center"><div class="stack-imgs">${items.slice(0, 4).map((i) => itemImg(i, 'xs'))}</div>
    <div class="grow"><strong>How did ${fmtDate(p.date)}'s outfit work?</strong><p class="muted small">${p.planLabel}</p></div></div>
    <div class="row gap"><button type="button" class="btn sm primary" data-act="openFeedback" data-id="${p.id}">Give feedback</button><button type="button" class="btn sm ghost" data-act="dismissFeedback" data-id="${p.id}">Skip</button></div>
  </div>`;
}

function viewPick() {
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return html`
    <p class="eyebrow">${greeting}</p>
    <h1 class="big">Where are you going today?</h1>
    <div class="preset-list">
      ${PRESETS.filter((p) => p.id !== 'custom').map((p) => html`
        <button type="button" class="preset" data-act="pickPreset" data-v="${p.id}">
          <span class="preset-title">${p.label}</span>
          <span class="muted small">${presetSummary(planFromPreset(p.id))}</span>
        </button>`)}
    </div>
    <form class="card describe" data-submit="describePlan">
      <label for="plan-note"><strong>Or describe your plans</strong></label>
      <p class="muted small">e.g. “Cycling to a lecture, then drinks by the river”</p>
      <div class="row gap"><input id="plan-note" class="grow" type="text" maxlength="160" value="${S.today.draftNote || ''}" data-input="draftNote" placeholder="What are you up to?"><button class="btn primary" type="submit">Go</button></div>
    </form>
    ${!db.prefs.location ? html`<p class="muted small">${icon('pin')} You'll be asked for your city so I can check the forecast.</p>` : html`<p class="muted small">${icon('pin')} Forecast for ${db.prefs.location.name} · <button type="button" class="link" data-act="tab" data-v="profile">change</button></p>`}
  `;
}

function presetSummary(p) {
  const outdoor = OUTDOOR.find((o) => o.id === p.outdoor).label.toLowerCase();
  return `${p.start}–${p.end} · ${outdoor} · ${FORMALITY[p.formality].label.toLowerCase()}${p.remembered ? ' · your usual' : ''}`;
}

function viewResults() {
  const T = S.today;
  const p = T.plan;
  return html`
    <header class="subhead">
      <button type="button" class="icon-btn" data-act="backToPick" aria-label="Back to plans">${icon('back')}</button>
      <div class="grow"><p class="eyebrow">${p.day === 0 ? 'Today' : 'Tomorrow'}</p><h1>${p.label}</h1></div>
    </header>
    ${planCard()}
    ${weatherCard()}
    ${T.weather.status === 'ok' ? resultsBlock() : ''}
  `;
}

function planCard() {
  const p = S.today.plan;
  const moves = p.moves.map((m) => MOVES.find((x) => x.id === m)?.label.toLowerCase()).join(', ');
  if (!S.today.editing) {
    return html`<button type="button" class="card plan-summary" data-act="editPlan" aria-expanded="false">
      <span><strong>${p.start}–${p.end}</strong> · ${OUTDOOR.find((o) => o.id === p.outdoor).label.toLowerCase()} · ${moves || 'no travel set'} · ${FORMALITY[p.formality].label.toLowerCase()}</span>
      <span class="link small">Adjust</span>
    </button>`;
  }
  return html`<div class="card plan-edit">
    <div class="row between center"><h3>Your day</h3><button type="button" class="link small" data-act="editPlan" aria-expanded="true">Done</button></div>
    ${seg('planDay', [{ id: '0', label: 'Today' }, { id: '1', label: 'Tomorrow' }], String(p.day))}
    <div class="row gap times">
      <label>Leaving<input type="time" value="${p.start}" data-change="planStart"></label>
      <label>Back<input type="time" value="${p.end}" data-change="planEnd"></label>
    </div>
    <h4>Indoors or out?</h4>
    ${seg('planOutdoor', OUTDOOR, p.outdoor)}
    <h4>Getting around</h4>
    ${chips('planMove', MOVES, p.moves)}
    <h4>How dressed up?</h4>
    ${seg('planFormality', FORMALITY.slice(1).map((f) => ({ id: String(f.v), label: f.label.split(' / ')[0] })), String(p.formality))}
    <p class="muted small">I'll remember these settings for “${PRESETS.find((x) => x.id === p.preset)?.label || p.label}”.</p>
  </div>`;
}

function weatherCard() {
  const W = S.today.weather;
  if (W.status === 'needLocation') {
    return html`<div class="card"><h3>Where will you be?</h3><p class="muted small">I need a city to check the forecast for your hours out.</p>${locationPicker()}
      <button type="button" class="link small" data-act="manualWeatherOpen">Or enter the weather yourself</button></div>`;
  }
  if (W.status === 'loading') return html`<div class="card weather loading" role="status" aria-live="polite"><div class="skeleton w60"></div><div class="skeleton w40"></div><span class="sr-only">Checking the forecast…</span></div>`;
  if (W.status === 'error' || W.status === 'manualForm') {
    const M = S.today.manual;
    return html`<div class="card ${W.status === 'error' ? 'error-card' : ''}">
      ${W.status === 'error' ? html`<h3>${icon('warn')} Couldn't get the forecast</h3><p class="small" role="alert">${W.error}</p>
        <div class="row gap"><button type="button" class="btn sm" data-act="retryWeather">Try again</button></div>
        <p class="muted small">Or tell me roughly what it's like:</p>` : html`<h3>Enter the weather</h3>`}
      <form class="manual-weather" data-submit="useManual">
        <div class="row gap"><label>Low °C<input type="number" min="-30" max="45" value="${M.low}" data-change="manLow"></label>
        <label>High °C<input type="number" min="-30" max="45" value="${M.high}" data-change="manHigh"></label></div>
        <div class="row gap"><label class="check"><input type="checkbox" ${M.rain ? 'checked' : ''} data-change="manRain"> Rain likely</label>
        <label class="check"><input type="checkbox" ${M.windy ? 'checked' : ''} data-change="manWindy"> Windy</label></div>
        <button class="btn primary sm" type="submit">Use this weather</button>
      </form></div>`;
  }
  if (W.status !== 'ok') return '';
  const w = W.data;
  const rain = w.popMax != null ? `${w.popMax}% rain` : w.precipSum > 0 ? 'rain' : 'dry';
  return html`<div class="card weather">
    <div class="row between">
      <div>
        <p class="temp-range">${r0(w.tempMin)}° <span class="muted">→</span> ${r0(w.tempMax)}°</p>
        <p class="small">Feels ${r0(w.feelsMin)}° to ${r0(w.feelsMax)}° · ${rain} · wind up to ${r0(w.windMax)} km/h</p>
      </div>
      <p class="cond">${w.condition}</p>
    </div>
    ${w.source !== 'manual' ? html`<div class="hours" aria-label="Hourly forecast">${w.hours.map((h) => html`<div class="hour ${h.pop >= 50 ? 'wet' : ''}"><span class="muted">${h.time}</span><strong>${r0(h.temp)}°</strong><span class="small">${h.pop != null ? h.pop + '%' : ''}</span></div>`)}</div>` : ''}
    <p class="muted tiny">${w.source === 'manual' ? 'Weather you entered' : html`${w.locationName} · ${fmtDate(w.date)} · Open-Meteo forecast for your hours out`} · <button type="button" class="link" data-act="manualWeatherOpen">enter manually</button></p>
  </div>`;
}

function resultsBlock() {
  const T = S.today;
  const R = T.result;
  if (!R) return '';
  const lockIds = Object.entries(T.locks).filter(([, v]) => v && v !== 'none');
  const locksBar = lockIds.length || Object.values(T.locks).includes('none') ? html`<div class="locks">${icon('lock')} <span>Built around: ${Object.entries(T.locks).map(([slot, id]) => id === 'none' ? `no ${slot === 'outer' ? 'jacket' : 'layer'}` : getItem(id)?.name).filter(Boolean).join(', ')}</span>
      <button type="button" class="link small" data-act="clearLocks">Clear</button></div>` : '';
  let content;
  if (R.problem) {
    content = problemCard(R);
  } else {
    content = html`<div class="outfits">${T.shown.map((o, i) => outfitCard(o, i))}</div>
      <button type="button" class="btn ghost block" data-act="moreOptions">Show different options</button>`;
  }
  return html`${T.justWore ? justWoreCard() : ''}${locksBar}${content}${suggestionsBox(R.suggestions)}`;
}

function justWoreCard() {
  return html`<div class="card success" role="status">${icon('check')} <div class="grow"><strong>Have a good day!</strong><p class="small muted">I'll ask how it went next time. Back already?</p></div>
    <button type="button" class="btn sm" data-act="openFeedback" data-id="${S.today.justWore}">Feedback now</button></div>`;
}

function problemCard(R) {
  if (R.problem.kind === 'incomplete') return gapsCard(R.problem.gaps, "I can't build a full outfit yet");
  return html`<div class="card problem"><h3>No outfit really works today</h3>
    ${R.problem.lines.map((l) => html`<p>${l}</p>`)}
    <p class="muted small">Rather than suggest something unsuitable, here's what's missing. You can also adjust your plan above.</p></div>`;
}

function suggestionsBox(list) {
  if (!list?.length) return '';
  return html`<aside class="card ideas" aria-label="Not in your wardrobe">
    <p class="eyebrow">Not in your wardrobe · ideas only</p>
    ${list.map((s) => html`<div class="idea">
      ${s.type ? illustration({ type: s.type, color: 'charcoal' }) : ''}
      <div class="grow"><p class="small">${s.text}</p>
      <div class="row gap wrap"><button type="button" class="link small" data-act="openQuick" data-type="${s.type}">I own one — add it</button>
      <button type="button" class="link small" data-act="addWish" data-type="${s.type}" data-text="${s.text}">Save to wishlist</button></div></div></div>`)}
  </aside>`;
}

const SLOT_ORDER = ['outer', 'layer', 'top', 'dress', 'bottom', 'shoes'];

function outfitCard(o, idx) {
  const T = S.today;
  const tiles = SLOT_ORDER.filter((s) => o[s] && !(s === 'bottom' && o.dress)).map((slot) => {
    const it = o[slot];
    const locked = T.locks[slot] === it.id;
    return html`<button type="button" class="outfit-item slot-${slot}" data-act="openSwap" data-i="${idx}" data-slot="${slot}" aria-label="${it.name} — tap to swap or lock">
      ${itemImg(it)}<span class="name">${cap(it.name)}</span>${locked ? html`<span class="lock-badge" aria-label="Locked">${icon('lock')}</span>` : ''}</button>`;
  });
  const avail = owned().filter((i) => i.status === 'available');
  const addable = ['layer', 'outer'].filter((s) => !o[s] && avail.some((i) => i.slot === s));
  return html`<article class="card outfit" aria-label="${o.label}">
    <header class="row between center"><span class="tag">${o.label}</span><span class="muted tiny">Tap an item to swap or lock it</span></header>
    <div class="outfit-items">${tiles}${addable.map((s) => html`<button type="button" class="outfit-item add" data-act="openSwap" data-i="${idx}" data-slot="${s}">${icon('plus')}<span class="name">Add ${s === 'outer' ? 'jacket' : 'layer'}</span></button>`)}</div>
    ${o.why.length ? html`<ul class="why">${o.why.map((w) => html`<li>${icon('check')}${w}</li>`)}</ul>` : ''}
    ${o.advice.length ? html`<ul class="advice">${o.advice.map((a) => html`<li>${icon('layers')}${a}</li>`)}</ul>` : ''}
    ${o.issues.length ? html`<ul class="issues">${o.issues.map((a) => html`<li>${icon('warn')}${a}</li>`)}</ul>` : ''}
    ${o.asks.filter((a) => !S.today.skipAsk?.has(a.itemId + a.field)).map((a) => html`<div class="ask"><p class="small">${a.q}</p><div class="row gap">
      <button type="button" class="btn sm" data-act="answerAsk" data-id="${a.itemId}" data-field="${a.field}" data-v="yes">Yes</button>
      <button type="button" class="btn sm" data-act="answerAsk" data-id="${a.itemId}" data-field="${a.field}" data-v="no">No</button>
      <button type="button" class="btn sm ghost" data-act="answerAsk" data-id="${a.itemId}" data-field="${a.field}" data-v="skip">Not sure</button></div></div>`)}
    <footer class="outfit-actions">
      <button type="button" class="btn primary" data-act="wear" data-i="${idx}">Wear this</button>
      <button type="button" class="btn" data-act="saveOutfit" data-i="${idx}">${isSaved(o) ? 'Saved' : 'Save'}</button>
      <button type="button" class="btn ghost" data-act="openReject" data-i="${idx}">Not for me</button>
    </footer>
  </article>`;
}

function isSaved(o) {
  const k = outfitKey(o);
  return db.saved.some((s) => [...s.itemIds].sort().join('+') === k);
}

SHEETS.swap = (s) => {
  const T = S.today;
  const o = T.shown[s.i];
  const cur = o[s.slot];
  const slotLabel = { outer: 'jacket or coat', layer: 'layer', top: 'top', bottom: 'bottoms', dress: 'dress', shoes: 'shoes' }[s.slot];
  const alts = alternatives(o, s.slot, db.items, currentCtx());
  return html`${sheetHead(cur ? `Swap the ${slotLabel}` : `Add a ${slotLabel}`, 'The rest of the outfit stays the same.')}
  <div class="sheet-body">
    ${cur ? html`<div class="current row gap center">${itemImg(cur, 'sm')}<div class="grow"><strong>${cap(cur.name)}</strong><p class="muted small">Current choice</p></div></div>
    <button type="button" class="btn block" data-act="lockItem" data-slot="${s.slot}" data-id="${cur.id}">${icon('lock')} ${T.locks[s.slot] === cur.id ? 'Unlock' : 'Lock this and rebuild the other outfits around it'}</button>` : ''}
    <h3>Alternatives you own</h3>
    ${alts.length ? html`<ul class="alt-list">${alts.map((a, j) => html`<li><button type="button" class="alt ${a.fail ? 'weak' : ''}" data-act="pickAlt" data-j="${j}">
      ${a.item ? itemImg(a.item, 'sm') : html`<span class="none-tile">None</span>`}
      <span class="grow"><strong>${a.item ? cap(a.item.name) : `No ${slotLabel}`}</strong>
      <span class="small ${a.fail ? 'warn-text' : 'muted'}">${a.fail ? FAIL_TEXT[a.fail] : a.issues[0] || a.why[0] || 'Works for today'}</span></span></button></li>`)}</ul>`
    : html`<p class="muted">You don't have other available ${slotLabel} yet.</p>`}
    <button type="button" class="link small" data-act="openStarterSlot" data-v="${s.slot === 'dress' ? 'dress' : s.slot}">Add more ${slotLabel}</button>
  </div>`;
};

const REJECT_REASONS = [
  { id: 'style', label: "Not my style / don't like the combination" },
  { id: 'warm', label: 'Too warm for today' },
  { id: 'cold', label: 'Too cold for today' },
  { id: 'casual', label: 'Too casual for this' },
  { id: 'dressy', label: 'Too dressy for this' },
  { id: 'unavailable', label: "Something isn't available (laundry etc.)" },
];

SHEETS.reject = (s) => {
  const o = S.today.shown[s.i];
  return html`${sheetHead('What’s wrong with it?', 'This helps me suggest something better — it won’t count against individual items unless you say so.')}
  <div class="sheet-body">
    <div class="reason-list">${REJECT_REASONS.map((r) => html`<button type="button" class="reason ${s.reason === r.id ? 'on' : ''}" data-act="rejectReason" data-v="${r.id}" aria-pressed="${String(s.reason === r.id)}">${r.label}</button>`)}</div>
    ${s.reason === 'unavailable' ? html`<h3>Which item?</h3><div class="pick-items">${outfitItems(o).map((it) => html`<button type="button" class="pick-item ${s.items?.includes(it.id) ? 'on' : ''}" data-act="rejectItem" data-id="${it.id}" aria-pressed="${String(!!s.items?.includes(it.id))}">${itemImg(it, 'sm')}<span>${cap(it.name)}</span></button>`)}</div>
      <p class="muted small">I'll mark it as in the laundry. Change it back in your wardrobe.</p>` : ''}
  </div>
  <footer class="sheet-foot"><button type="button" class="btn primary block" data-act="confirmReject" ${s.reason && (s.reason !== 'unavailable' || s.items?.length) ? '' : 'disabled'}>Show me something else</button></footer>`;
};

// ---------------------------------------------------------------- feedback
const FB = [
  { id: 'good', label: 'Worked well' },
  { id: 'cold', label: 'Too cold' },
  { id: 'warm', label: 'Too warm' },
  { id: 'occasion', label: 'Wrong for the occasion' },
  { id: 'comfort', label: 'Uncomfortable for walking or cycling' },
  { id: 'combo', label: "Didn't like the combination" },
];

SHEETS.feedback = (s) => {
  const w = db.wears.find((x) => x.id === s.id);
  const items = w.itemIds.map(getItem).filter(Boolean);
  const r = s.reasons;
  return html`${sheetHead('How did it go?', `${w.planLabel} · ${fmtDate(w.date)}${w.weather ? ` · ${r0(w.weather.feelsMin)}–${r0(w.weather.feelsMax)}° feels-like` : ''}`)}
  <div class="sheet-body">
    <div class="stack-imgs lg">${items.map((i) => itemImg(i, 'sm'))}</div>
    <p class="muted small">Pick any that apply.</p>
    <div class="reason-list">${FB.map((f) => html`<button type="button" class="reason ${r.includes(f.id) ? 'on' : ''}" aria-pressed="${String(r.includes(f.id))}" data-act="fbToggle" data-v="${f.id}">${f.label}</button>`)}</div>
    ${r.includes('occasion') ? html`<h3>It was…</h3>${seg('fbOccasion', [{ id: 'casual', label: 'Too casual' }, { id: 'dressy', label: 'Too dressy' }], s.occasion)}` : ''}
    ${r.includes('comfort') ? html`<h3>Which item, and when?</h3>
      ${seg('fbActivity', [{ id: 'walk', label: 'Walking' }, { id: 'cycle', label: 'Cycling' }], s.activity)}
      <div class="pick-items">${items.map((it) => html`<button type="button" class="pick-item ${s.items.includes(it.id) ? 'on' : ''}" aria-pressed="${String(s.items.includes(it.id))}" data-act="fbItem" data-id="${it.id}">${itemImg(it, 'sm')}<span>${cap(it.name)}</span></button>`)}</div>` : ''}
    <label class="block-label">Anything else? <span class="muted small">(optional)</span><textarea rows="2" maxlength="300" data-input="fbNote">${s.note || ''}</textarea></label>
  </div>
  <footer class="sheet-foot"><button type="button" class="btn primary block" data-act="submitFeedback" ${r.length ? '' : 'disabled'}>Save feedback</button></footer>`;
};

function applyFeedback(w, s) {
  const learned = [];
  const p = db.prefs;
  const r = new Set(s.reasons);
  if (r.has('cold') && !r.has('warm')) { p.learnedThermal = Math.min(2.5, (p.learnedThermal || 0) + 0.4); learned.push("I'll suggest slightly warmer outfits for you"); }
  if (r.has('warm') && !r.has('cold')) { p.learnedThermal = Math.max(-2.5, (p.learnedThermal || 0) - 0.4); learned.push("I'll suggest slightly lighter outfits for you"); }
  if (r.has('occasion') && s.occasion) {
    const d = s.occasion === 'casual' ? 0.5 : -0.5;
    p.formalityOffsets[w.preset] = Math.max(-1.5, Math.min(1.5, (p.formalityOffsets[w.preset] || 0) + d));
    learned.push(`I'll aim ${s.occasion === 'casual' ? 'dressier' : 'more relaxed'} for “${w.planLabel}”`);
  }
  if (r.has('comfort') && s.items.length) {
    s.items.forEach((id) => {
      const it = getItem(id);
      if (!it) return;
      it[s.activity] = 'no';
      it.estimated = { ...it.estimated, [s.activity]: false };
    });
    learned.push(`Marked ${s.items.length > 1 ? 'those items' : 'that item'} as not good for ${s.activity === 'walk' ? 'long walks' : 'cycling'}`);
  }
  const ids = w.itemIds;
  const bump = (d, lo, hi) => { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = pairKey(ids[i], ids[j]); p.pairScores[k] = Math.max(lo, Math.min(hi, (p.pairScores[k] || 0) + d)); } };
  if (r.has('combo')) { bump(-1, -3, 2); learned.push("I'll pair these pieces together less often — the items themselves aren't penalised"); }
  if (r.has('good') && !r.has('combo')) { bump(0.5, -3, 2); learned.push("I'll favour this combination in similar conditions"); }
  w.feedback = { reasons: s.reasons, occasion: s.occasion || null, activity: r.has('comfort') ? s.activity : null, items: s.items, note: (s.note || '').trim(), at: Date.now(), learned };
  save();
  return learned;
}

// ---------------------------------------------------------------- today logic
function currentCtx() {
  const T = S.today;
  const ctx = buildContext(T.plan, T.weather.data, db.prefs, T.session);
  const since = localDate(new Date(Date.now() - 2 * 86400000));
  ctx.recentIds = new Set(db.wears.filter((w) => w.date >= since).flatMap((w) => w.itemIds));
  return ctx;
}

function computeResults() {
  const T = S.today;
  if (T.weather.status !== 'ok') return;
  T.result = recommend(db.items, currentCtx(), { locks: T.locks, exclude: T.exclude });
  T.shown = T.result.outfits;
}

async function loadWeather() {
  const T = S.today;
  const loc = db.prefs.location;
  if (!loc) { T.weather = { status: 'needLocation' }; render(); return; }
  T.weather = { status: 'loading' };
  render();
  try {
    const data = await getForecastWindow(loc, T.plan.day, T.plan.start, T.plan.end);
    T.weather = { status: 'ok', data };
    computeResults();
  } catch (e) {
    T.weather = { status: 'error', error: e.message || 'Unknown error' };
  }
  render();
}

function startPlan(plan) {
  const T = S.today;
  Object.assign(T, freshToday(), { plan, stage: 'results' });
  loadWeather();
}

// ---------------------------------------------------------------- wardrobe
function readiness() {
  const av = owned();
  const any = (f) => av.some(f);
  const gaps = outfitGaps();
  return [
    { id: 'basics', label: 'Everyday outfits', ok: !gaps.length, fix: gaps[0]?.slot, hint: `Still needs ${gaps.map((g) => GAP_SHORT[g.slot]).join(', ')}` },
    { id: 'cold', label: 'Cold days', ok: any((i) => i.slot === 'outer' && i.warmth >= 4) || (any((i) => i.slot === 'outer' && i.warmth >= 3) && any((i) => i.slot === 'layer' && i.warmth >= 3)), fix: 'outer', type: 'wool_coat', hint: 'A warm coat, or a jacket plus a thick layer' },
    { id: 'rain', label: 'Rainy days', ok: any((i) => i.slot === 'outer' && i.water === 'yes'), fix: 'outer', type: 'rain_jacket', hint: 'A water-resistant jacket (or mark one you own as water-resistant)' },
    { id: 'smart', label: 'Smarter plans', ok: ['top', 'bottom', 'shoes'].every((s) => any((i) => (i.slot === s || (s !== 'shoes' && i.slot === 'dress')) && i.formality[1] >= 4)), fix: 'bottom', type: 'trousers', hint: 'Smart top, bottoms and shoes' },
    { id: 'walk', label: 'Long walks', ok: any((i) => i.slot === 'shoes' && i.walk === 'yes'), fix: 'shoes', type: 'sneakers', hint: 'Shoes you can walk in all day' },
  ];
}

function viewWardrobe() {
  const items = owned();
  const f = S.wardrobeFilter;
  const shown = items.filter((i) => f === 'all' || (f === 'laundry' ? i.status !== 'available' : i.slot === f));
  const counts = Object.fromEntries(SLOTS.map((s) => [s.id, items.filter((i) => i.slot === s.id).length]));
  const unavailable = items.filter((i) => i.status !== 'available').length;
  const ready = readiness();
  return html`<section class="pad wardrobe">
    <div class="row between center"><h1>Wardrobe</h1><span class="muted small">${items.length} item${items.length === 1 ? '' : 's'}</span></div>
    <details class="card readiness" ${ready.some((r) => !r.ok) ? 'open' : ''}>
      <summary><strong>Ready for</strong> <span class="muted small">${ready.filter((r) => r.ok).length} of ${ready.length}</span></summary>
      <ul>${ready.map((r) => html`<li class="${r.ok ? 'ok' : 'todo'}">${r.ok ? icon('check') : html`<span class="dot"></span>`}<span class="grow">${r.label}${r.ok ? '' : html`<span class="muted small"> — ${r.hint}</span>`}</span>
        ${r.ok ? '' : html`<button type="button" class="link small" data-act="${r.type ? 'openQuick' : 'openStarterSlot'}" data-type="${r.type || ''}" data-v="${r.fix}">Add</button>`}</li>`)}</ul>
    </details>
    <div class="chips scroll-x" role="toolbar" aria-label="Filter">
      <button type="button" class="chip ${f === 'all' ? 'on' : ''}" data-act="wFilter" data-v="all">All</button>
      ${SLOTS.filter((s) => counts[s.id]).map((s) => html`<button type="button" class="chip ${f === s.id ? 'on' : ''}" data-act="wFilter" data-v="${s.id}">${s.label} ${counts[s.id]}</button>`)}
      ${unavailable ? html`<button type="button" class="chip ${f === 'laundry' ? 'on' : ''}" data-act="wFilter" data-v="laundry">Unavailable ${unavailable}</button>` : ''}
    </div>
    ${shown.length ? html`<div class="item-grid">${shown.map((i) => html`<button type="button" class="item-card ${i.status !== 'available' ? 'dim' : ''}" data-act="openEdit" data-id="${i.id}">
      <div class="img-wrap">${itemImg(i)}${i.status !== 'available' ? html`<span class="status">${i.status === 'laundry' ? 'In laundry' : 'Unavailable'}</span>` : ''}</div>
      <span class="name">${cap(i.name)}</span><span class="muted tiny">${sourceLabel(i)}</span></button>`)}</div>`
    : html`<p class="muted empty-inline">${items.length ? 'Nothing here.' : 'No items yet — tap “Add clothing” to start with a few basics.'}</p>`}
    ${db.wishlist.length ? html`<section class="wishlist"><h2>Wishlist <span class="muted small">· not owned, never used in outfits</span></h2>
      <ul class="mini-list">${db.wishlist.map((w) => html`<li>${illustration({ type: w.type, color: 'charcoal' }, 'xs')}<span class="grow">${TYPE[w.type].label}<br><span class="muted tiny">${w.text}</span></span>
      <button type="button" class="link small" data-act="wishOwned" data-id="${w.id}">I got it</button>
      <button type="button" class="icon-btn sm" data-act="wishRemove" data-id="${w.id}" aria-label="Remove from wishlist">${icon('close')}</button></li>`)}</ul></section>` : ''}
    <button type="button" class="btn primary fab" data-act="openAddMenu">${icon('plus')} Add clothing</button>
  </section>`;
}

function typeSelect(act, value, { required = false } = {}) {
  return html`<select data-change="${act}" ${required ? 'required' : ''}>
    ${!value ? html`<option value="">Choose a type…</option>` : ''}
    ${SLOTS.map((s) => html`<optgroup label="${s.label}">${orderTypes(typesForSlot(s.id), coll()).map((t) => html`<option value="${t.id}" ${t.id === value ? 'selected' : ''}>${t.label}</option>`)}</optgroup>`)}
  </select>`;
}

function triSelect(act, value) {
  return seg(act, [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unknown', label: 'Not sure' }], value || 'unknown');
}

SHEETS.edit = (s) => {
  const d = s.draft;
  const t = TYPE[d.type];
  const est = d.estimated || {};
  const hint = (k) => (est[k] ? html`<span class="est">estimated — typical for this type</span>` : '');
  const kind = d.image?.kind || 'catalog';
  return html`${sheetHead('Edit item', `${sourceLabel(d)}${kind === 'archive' ? ` · ${d.image.license} · ${d.image.author}` : ''}`)}
  <div class="sheet-body edit">
    <div class="edit-photo">
      <div class="img-wrap lg">${itemImg(d, kind === 'catalog' ? '' : 'editable')}</div>
      <div class="stack">
        <label class="btn sm">${icon('camera')} ${kind === 'photo' ? 'Replace photo' : 'Use my own photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" class="sr-only" data-change="editPhoto"></label>
        <button type="button" class="btn sm ghost" data-act="editFindImage">${icon('search')} Find in the catalog</button>
        ${kind !== 'catalog' ? html`<button type="button" class="link small" data-act="editRevertImg">Use the catalog image</button>` : ''}
        ${kind === 'archive' && d.image.pageUrl ? html`<a class="link small" href="${d.image.pageUrl}" target="_blank" rel="noopener noreferrer">Image source</a>` : ''}
        ${d.sourceUrl ? html`<a class="link small" href="${d.sourceUrl}" target="_blank" rel="noopener noreferrer">Product link</a>` : ''}
        ${s.photoError ? html`<p class="error small" role="alert">${s.photoError}</p>` : ''}
        ${s.photoBusy ? html`<p class="muted small" role="status">Processing photo…</p>` : ''}
      </div>
    </div>
    ${kind === 'catalog' ? '' : frameControls(d.image.frame, 'ed')}
    <p class="muted tiny">${kind === 'catalog' ? 'Catalog images are approximate — you can replace this with your own photo any time. ' : ''}Changing the image or details keeps this item's saved outfits, history and feedback.</p>
    <label class="block-label">Name<input type="text" maxlength="60" value="${d.name}" data-input="editName"></label>
    <label class="block-label">Type${typeSelect('editType', d.type)}</label>
    ${cutTiles('editCut', d)}
    ${lengthTiles('editLength', d)}
    <h4>Colour</h4>${colorPicker('editColor', d.color)}
    <h4>Pattern</h4>${seg('editPattern', PATTERNS, d.pattern)}
    <h4>Availability</h4>${seg('editStatus', [{ id: 'available', label: 'Available' }, { id: 'laundry', label: 'In laundry' }, { id: 'unavailable', label: 'Unavailable' }], d.status)}
    ${d.slot !== 'shoes' ? html`<h4>Warmth ${hint('warmth')}</h4>${seg('editWarmth', [1, 2, 3, 4, 5].map((v) => ({ id: String(v), label: WARMTH_LABELS[v] })), est.warmth ? '' : String(d.warmth))}
      ${est.warmth ? '' : html`<button type="button" class="link small" data-act="editWarmthUnsure">Not sure — use the typical value</button>`}` : ''}
    <h4>Dressiness ${hint('formality')}</h4>
    <div class="row gap"><label>From<select data-change="editFmin">${FORMALITY.slice(1).map((f) => html`<option value="${f.v}" ${f.v === d.formality[0] ? 'selected' : ''}>${f.label}</option>`)}</select></label>
    <label>To<select data-change="editFmax">${FORMALITY.slice(1).map((f) => html`<option value="${f.v}" ${f.v === d.formality[1] ? 'selected' : ''}>${f.label}</option>`)}</select></label></div>
    ${['outer', 'shoes'].includes(d.slot) ? html`<h4>Water-resistant? ${hint('water')}</h4>${triSelect('editWater', d.water)}` : ''}
    ${d.slot === 'shoes' ? html`<h4>Comfortable for long walks? ${hint('walk')}</h4>${triSelect('editWalk', d.walk)}<h4>OK for cycling? ${hint('cycle')}</h4>${triSelect('editCycle', d.cycle)}` : ''}
    <p class="muted tiny">Warmth, water resistance and comfort can't be judged reliably from a picture — correct them if you know better.</p>
  </div>
  <footer class="sheet-foot row gap">
    <button type="button" class="btn danger ghost" data-act="editDelete">${s.confirmDelete ? 'Tap again to delete' : 'Delete'}</button>
    <button type="button" class="btn primary grow" data-act="editSave" ${s.photoBusy ? 'disabled' : ''}>Save</button>
  </footer>`;
};

SHEETS.addMenu = () => html`${sheetHead('Add clothing', "Add a few pieces at a time — you don't need your whole wardrobe.")}
  <div class="sheet-body"><div class="add-row col">
    <button type="button" class="add-opt" data-act="openStarter">${icon('grid')}<span><strong>Starter basics</strong><small>Common everyday pieces — pick cut and colours</small></span></button>
    <button type="button" class="add-opt" data-act="openCatalog">${icon('search')}<span><strong>Search the catalog</strong><small>Filter by type, cut, length and colour</small></span></button>
    <button type="button" class="add-opt" data-act="openUpload">${icon('camera')}<span><strong>Upload a photo</strong><small>Of your own garment — it stays on this device</small></span></button>
    <button type="button" class="add-opt" data-act="openLink">${icon('pin')}<span><strong>Import from a product link</strong><small>Keep the link and add the product photo</small></span></button>
  </div></div>`;

const UPLOAD_INPUT = html`<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" class="sr-only" data-change="uploadFile">`;

SHEETS.upload = (s) => html`${sheetHead(s.link ? 'Import from a product link' : 'Add from a photo', s.link ? '' : 'A photo of the garment laid flat or on a hanger, against a plain background, works best. It stays on this device.')}
  <div class="sheet-body">
    ${s.link ? html`
      <label class="block-label">Product page link<input type="url" inputmode="url" placeholder="https://…" value="${s.url || ''}" data-input="linkUrl"></label>
      <div class="card limitation">
        <p class="small"><strong>Automatic import isn't available.</strong> Reading a shop's page needs a server-side integration with retailers that permit it, and this app runs only on your device.</p>
        <p class="small">Instead: save the product photo from the shop (or take a screenshot), then choose it below. The link is kept with the item so you can find it again.</p>
      </div>` : ''}
    <label class="dropzone">${icon('camera')}<strong>${s.link ? 'Choose the product photo' : 'Choose or take a photo'}</strong><span class="muted small">JPEG, PNG or WebP · up to 12 MB</span>${UPLOAD_INPUT}</label>
    <p class="muted tiny">Automatic background removal isn't available yet. You'll be able to adjust the framing on the next step.</p>
    ${s.busy ? html`<p class="muted small" role="status">Processing…</p>` : ''}
    ${s.error ? html`<p class="error small" role="alert">${s.error}</p>` : ''}
  </div>`;

// ---------------------------------------------------------------- catalogue
const CATEGORY_ICON = { top: 'tshirt', bottom: 'jeans', dress: 'dress', layer: 'sweater', outer: 'wool_coat', shoes: 'sneakers' };

function exampleTitle(e) {
  const t = TYPE[e.type];
  const cut = t.cuts.length > 1 && e.cut !== 'regular' ? `${cutLabel(t, e.cut)} ` : '';
  const name = cut ? t.label.split(' / ')[0].toLowerCase() : t.label.split(' / ')[0];
  return `${cut}${name}${e.length && t.lengths ? ` · ${lengthLabel(t, e.length).toLowerCase()}` : ''}`;
}

function diffText(d, t) {
  if (d.field === 'cut') return `Different cut: ${cutLabel(t, d.have).toLowerCase()}, not ${d.want}`;
  return `Different length: ${lengthLabel(t, d.have).toLowerCase()}, not ${t.lengths?.includes(d.want) ? lengthLabel(t, d.want).toLowerCase() : d.want}`;
}

function filterRow(label, act, options, value) {
  return html`<div class="filter-row"><span class="filter-label">${label}</span><div class="chips scroll-x">${options.map((o) => html`
    <button type="button" class="chip filter-chip ${o.id === value ? 'on' : ''}" aria-pressed="${String(o.id === value)}" data-act="${act}" data-v="${o.id}">${o.img ? html`<span class="chip-img">${o.img}</span>` : ''}${o.label}</button>`)}</div></div>`;
}

function viewCatalog() {
  const C = S.cat;
  const replacing = C.replaceId ? getItem(C.replaceId) : null;
  return html`<section class="pad catalog">
    <header class="subhead"><button type="button" class="icon-btn" data-act="closeView" aria-label="Back">${icon('back')}</button>
      <div><p class="eyebrow">${replacing ? `New image for your ${replacing.name}` : 'Add something you own'}</p><h1>${replacing ? 'Find a closer match' : 'Find your item'}</h1></div></header>
    ${seg('catSource', [{ id: 'curated', label: 'Curated catalog' }, { id: 'online', label: 'Online archive' }], C.source)}
    ${C.source === 'curated' ? curatedPanel() : onlinePanel()}
    <div class="more-ways"><strong class="small">Other ways to add it</strong>
      <div class="row gap wrap"><button type="button" class="btn sm" data-act="openUpload">${icon('camera')} Upload a photo</button>
      ${replacing ? '' : html`<button type="button" class="btn sm" data-act="openLink">${icon('pin')} Product link</button>`}</div></div>
  </section>`;
}

function curatedPanel() {
  const C = S.cat;
  const res = curatedSearch(catFilters(), coll());
  const ap = res.applied;
  const t = ap.type ? TYPE[ap.type] : null;
  const typeOpts = ap.slot ? orderTypes(typesForSlot(ap.slot), coll()) : [];
  const crumbs = [
    ap.slot && ['slot', SLOT_LABEL[ap.slot]], t && ['type', t.label], ap.cut && ['cut', t ? cutLabel(t, ap.cut) : cap(ap.cut)],
    ap.length && ['length', t?.lengths ? lengthLabel(t, ap.length) : cap(ap.length)], ap.color && ['color', colorLabel(ap.color)], ap.pattern && ['pattern', PATTERNS.find((p) => p.id === ap.pattern).label],
  ].filter(Boolean);
  const shown = res.close.slice(0, C.limit);
  return html`
    <form class="row gap cat-search" data-submit="catSearch"><label class="sr-only" for="cat-q">Search</label>
      <input id="cat-q" class="grow" type="search" placeholder="e.g. light blue wide-leg jeans" value="${C.query}" data-input="catQuery" autocomplete="off"><button class="btn primary" type="submit">Search</button></form>
    <div class="card filters">
      ${filterRow('Category', 'catSlot', SLOTS.map((s) => ({ id: s.id, label: s.label, img: illustration({ type: CATEGORY_ICON[s.id], color: 'grey' }) })), ap.slot)}
      ${ap.slot ? filterRow('Type', 'catType', typeOpts.map((x) => ({ id: x.id, label: x.label.split(' / ')[0], img: illustration({ type: x.id, color: 'grey' }) })), ap.type) : ''}
      ${t && t.cuts.length > 1 ? filterRow('Cut / fit', 'catCut', orderedCuts(t, coll()).map((c) => ({ id: c, label: cutLabel(t, c), img: illustration({ type: t.id, cut: c, color: 'grey' }) })), ap.cut) : ''}
      ${t?.lengths ? filterRow('Length', 'catLength', t.lengths.map((l) => ({ id: l, label: lengthLabel(t, l), img: illustration({ type: t.id, cut: ap.cut, length: l, color: 'grey' }) })), ap.length) : ''}
      <details class="filter-more" ${ap.color || ap.pattern ? 'open' : ''}><summary class="small">Colour &amp; pattern${ap.color || ap.pattern ? `: ${[ap.color && colorLabel(ap.color), ap.pattern && PATTERNS.find((p) => p.id === ap.pattern).label].filter(Boolean).join(', ')}` : ''}</summary>
        ${colorPicker('catColor', ap.color)}
        ${filterRow('Pattern', 'catPattern', PATTERNS, ap.pattern)}</details>
      <div class="coll-bar"><span class="muted small">Show first</span>${seg('setCollection', COLLECTIONS.map((c) => ({ id: c.id, label: c.id === 'all' ? 'All' : c.label })), coll())}</div>
    </div>
    ${crumbs.length ? html`<p class="crumbs small">${crumbs.map(([k, label], i) => html`${i ? html`<span class="muted" aria-hidden="true"> → </span>` : ''}<button type="button" class="crumb" data-act="catClear" data-v="${k}" aria-label="Remove ${label}">${label} ×</button>`)} <button type="button" class="link small" data-act="catClearAll">Clear all</button></p>` : ''}
    ${res.ignored.length ? html`<p class="muted small">Not used in the search: “${res.ignored.join(' ')}”. Materials and brands aren't in the curated catalog — try the <button type="button" class="link" data-act="catSource" data-v="online">online archive</button>.</p>` : ''}
    <p class="muted small approx">${APPROX_NOTE}</p>
    ${res.close.length ? html`<h3>${crumbs.length ? 'Closest matches' : 'Everyday examples'} <span class="muted small">(${res.close.length})</span></h3>
      <div class="arch-grid">${shown.map((r) => resultCard(r))}</div>
      ${res.close.length > shown.length ? html`<button type="button" class="btn ghost block" data-act="catMore">Show ${res.close.length - shown.length} more</button>` : ''}`
    : noMatchCard(res)}
    ${res.similar.length ? html`<h3>${res.close.length ? 'Similar, but a different shape' : 'Approximate stand-ins'} <span class="muted small">(${res.similar.length})</span></h3>
      <p class="muted tiny">These differ from what you asked for. If you pick one, set the cut and length to match your garment.</p>
      <div class="arch-grid">${res.similar.map((r) => resultCard(r))}</div>` : ''}`;
}

function resultCard(r) {
  const e = r.example;
  const t = TYPE[e.type];
  const v = { type: e.type, cut: e.cut, length: e.length, color: r.color, pattern: r.pattern };
  return html`<div class="result">
    <button type="button" class="arch-card" data-act="catPick" data-id="${e.id}" data-color="${r.color}" data-pattern="${r.pattern}">
      <span class="tile-img">${gimg(v)}</span>
      <span class="card-title">${cap(exampleTitle(e))}</span>
      <span class="tiny muted">${e.note}</span>
      ${r.diffs.map((d) => html`<span class="tiny warn-text">${diffText(d, t)}</span>`)}
      <span class="src-badge">${CATALOG_SOURCE[imageSource(v, coll())]}</span>
    </button>
    <button type="button" class="link tiny report" data-act="catReport" data-id="${e.id}">Not relevant</button>
  </div>`;
}

function noMatchCard(res) {
  return html`<div class="card no-match" role="status">
    <h3>We couldn't find a close match.</h3>
    <p class="small">Upload your own photo or continue with an approximate example.</p>
    <div class="row gap wrap">
      <button type="button" class="btn sm primary" data-act="openUpload">${icon('camera')} Upload a photo</button>
      <button type="button" class="btn sm" data-act="catBroaden">Broaden the filters</button>
      <button type="button" class="btn sm" data-act="catApprox">Use an approximate example</button>
    </div>
    <p class="muted tiny">An approximate example is a stand-in: you'll set the type, cut, length and colour to match your garment before saving.</p>
  </div>`;
}

function onlinePanel() {
  const C = S.cat;
  const O = C.online;
  const hiddenTotal = O.hidden ? O.hidden.metadata + O.hidden.pixels + O.hidden.reported : 0;
  return html`
    <div class="card limitation">
      <p class="small"><strong>Community photos from Wikimedia Commons — not a product catalog.</strong> Results are checked before they're shown (one garment, plain background, garment named in the description), but they can still be imperfect. Use one only as a stand-in and check the details.</p>
    </div>
    <form class="row gap cat-search" data-submit="onlineSearch"><label class="sr-only" for="online-q">Search the online archive</label>
      <input id="online-q" class="grow" type="search" placeholder="e.g. corduroy jacket" value="${C.query}" data-input="catQuery" autocomplete="off"><button class="btn primary" type="submit">Search</button></form>
    ${O.status === 'idle' ? html`<p class="muted empty-inline">Search for a garment to see checked community photos.</p>` : ''}
    ${O.status === 'loading' && !O.results.length ? html`<div class="arch-grid" role="status" aria-label="Loading">${Array.from({ length: 6 }, () => html`<div class="arch-card skeleton-card"></div>`)}</div><p class="muted small center-text">Checking images…</p>` : ''}
    ${O.status === 'error' ? html`<div class="card error-card" role="alert"><p>${O.error}</p><div class="row gap"><button type="button" class="btn sm" data-act="onlineRetry">Try again</button><button type="button" class="btn sm" data-act="catSource" data-v="curated">Use the curated catalog</button></div></div>` : ''}
    ${O.status === 'done' && !O.results.length ? noMatchCard({}) : ''}
    ${O.results.length ? html`<div class="arch-grid">${O.results.map((r, i) => html`<div class="result">
        <button type="button" class="arch-card" data-act="onlinePick" data-i="${i}">${framed(html`<img src="${r.thumb}" alt="${r.title}" loading="lazy" referrerpolicy="no-referrer">`)}
        <span class="tiny">${r.license}</span></button>
        <button type="button" class="link tiny report" data-act="onlineReport" data-i="${i}">Report</button></div>`)}</div>
      ${O.nextOffset != null ? html`<button type="button" class="btn ghost block" data-act="onlineMore" ${O.status === 'loading' ? 'disabled' : ''}>${O.status === 'loading' ? 'Checking…' : 'Load more'}</button>` : ''}` : ''}
    ${hiddenTotal ? html`<p class="muted tiny center-text">${hiddenTotal} result${hiddenTotal > 1 ? 's' : ''} hidden: ${[O.hidden.metadata && `${O.hidden.metadata} looked like people, scenes or artwork, or didn't name the garment`, O.hidden.pixels && `${O.hidden.pixels} failed the plain-background check`, O.hidden.reported && `${O.hidden.reported} you reported`].filter(Boolean).join('; ')}.</p>` : ''}`;
}

async function runOnline(more = false) {
  const C = S.cat;
  const O = C.online;
  if (!more) { O.results = []; O.nextOffset = null; O.hidden = null; }
  O.status = 'loading'; O.error = null;
  render();
  const reqId = (runOnline.seq = (runOnline.seq || 0) + 1);
  try {
    const res = await commonsProvider.search({ query: C.query.trim(), type: C.type, cut: C.cut, color: C.color, offset: more ? O.nextOffset : 0, reported: db.reports.map((r) => r.id) });
    if (reqId !== runOnline.seq) return;
    O.results = more ? [...O.results, ...res.results] : res.results;
    O.hidden = more && O.hidden ? Object.fromEntries(Object.keys(res.hidden).map((k) => [k, O.hidden[k] + res.hidden[k]])) : res.hidden;
    O.nextOffset = res.nextOffset;
    O.status = 'done';
  } catch (e) {
    if (reqId !== runOnline.seq) return;
    O.status = 'error'; O.error = e.message;
  }
  render();
}

// ---------------------------------------------------------------- confirm before saving
// One lightweight step for every way of adding: catalogue example, online
// photo, own photo or product link. Only the type's typical values are
// prefilled; nothing is inferred from how the picture looks except a
// suggested colour, which is labelled.
const CONFIRM_TITLE = { catalog: 'Add to your wardrobe', archive: 'Check this online photo', upload: 'Check your photo', link: 'Check the product photo' };

SHEETS.confirm = (s) => {
  const t = s.v.type ? TYPE[s.v.type] : null;
  const replacing = s.replaceId ? getItem(s.replaceId) : null;
  const multi = s.source === 'catalog' && !replacing;
  const v = { ...s.v, color: s.colors[0] || t?.starter[0] || 'grey' };
  const typical = t ? defaultItemFields(t.id, v.cut, v.length) : null;
  const est = (k) => (s.set[k] ? '' : html`<span class="est">typical for this type — not checked</span>`);
  const ready = t && s.colors.length;
  const n = multi ? s.colors.length : 1;
  const preview = s.source === 'catalog'
    ? html`<div class="confirm-preview">${t ? (s.colors.length > 1 ? s.colors.slice(0, 4).map((c) => gimg({ ...v, color: c })) : gimg(v)) : html`<span class="muted small">Choose a type below</span>`}</div>
      ${t ? html`<p class="muted tiny">${CATALOG_SOURCE[imageSource(v, coll())]} · ${APPROX_NOTE}</p>` : ''}`
    : html`<div class="confirm-photo">${framed(html`<img src="${s.source === 'archive' ? s.result.thumb : s.preview}" alt="Preview" referrerpolicy="no-referrer">`, s.frame, 'editable')}</div>
      ${frameControls(s.frame, 'cf')}
      ${s.source === 'archive' ? html`<p class="muted tiny">“${s.result.title}” · ${s.result.author} · ${s.result.license} · <a href="${s.result.pageUrl}" target="_blank" rel="noopener noreferrer">source</a></p>` : ''}`;
  return html`${sheetHead(replacing ? 'Confirm the new image' : CONFIRM_TITLE[s.source], replacing ? 'Check the details still describe your garment. Its outfits, history and feedback are kept.' : s.source === 'catalog' ? '' : 'The details below describe your garment, not the picture.')}
  <div class="sheet-body confirm">
    ${preview}
    ${s.diffs?.length || s.approx ? html`<p class="approx-warn small">${icon('warn')} Approximate stand-in${s.diffs?.length && t ? ` — ${s.diffs.map((d) => diffText(d, t).toLowerCase()).join('; ')}` : ''}. Set the details below to match your garment.</p>` : ''}
    <label class="block-label">Type${typeSelect('cfType', s.v.type, { required: true })}</label>
    ${t ? html`
      ${cutTiles('cfCut', v)}
      ${lengthTiles('cfLength', v)}
      <h4>${multi ? html`Colours you own <span class="muted small">— each becomes its own item</span>` : 'Colour'} ${s.colorSuggested ? html`<span class="est">suggested from your photo — check it</span>` : ''}</h4>
      ${colorPicker('cfColor', multi ? s.colors : s.colors[0] || '', { multi })}
      <h4>Pattern</h4>${seg('cfPattern', PATTERNS, s.v.pattern)}
      ${t.slot !== 'shoes' ? html`<h4>Thickness</h4>${seg('cfThickness', THICKNESS, s.thickness)}
        <p class="muted tiny">${s.thickness === 'unsure' ? `Not sure is fine — I'll assume ${WARMTH_LABELS[typical.warmth].toLowerCase()} warmth, typical for this type.` : `Saved as ${WARMTH_LABELS[warmthFor(t, v.cut, s.thickness)].toLowerCase()} warmth.`}</p>` : ''}
      ${['outer', 'shoes'].includes(t.slot) ? html`<h4>Water-resistant? ${est('water')}</h4>${triSelect('cfWater', s.water)}` : ''}
      ${t.slot === 'shoes' ? html`<h4>Comfortable for long walks? ${est('walk')}</h4>${triSelect('cfWalk', s.walk)}<h4>OK for cycling? ${est('cycle')}</h4>${triSelect('cfCycle', s.cycle)}` : ''}
      <p class="muted tiny">Warmth, water resistance and comfort can't be judged from a picture. Leave anything you're unsure about — you can edit every detail later.</p>` : ''}
    ${s.error ? html`<p class="error small" role="alert">${s.error}</p>` : ''}
  </div>
  <footer class="sheet-foot"><button type="button" class="btn primary block" data-act="confirmAdd" ${ready && !s.busy ? '' : 'disabled'}>${!t ? 'Choose a type' : !s.colors.length ? 'Choose a colour' : replacing ? 'Use this image' : n > 1 ? `Add ${n} items` : 'Add to my wardrobe'}</button></footer>`;
};

// ---------------------------------------------------------------- outfits tab
function viewOutfits() {
  const wears = [...db.wears].sort((a, b) => b.at - a.at);
  return html`<section class="pad">
    <h1>Outfits</h1>
    <h2>Saved combinations</h2>
    ${db.saved.length ? html`<div class="saved-list">${db.saved.map((s) => {
      const items = s.itemIds.map(getItem);
      const missing = items.filter((i) => !i).length;
      return html`<article class="card saved">
        <div class="stack-imgs lg">${items.filter(Boolean).map((i) => itemImg(i, 'sm'))}</div>
        <div class="row between center"><div><strong>${s.name}</strong><p class="muted tiny">${items.filter(Boolean).map((i) => i.name).join(' · ')}</p>
        ${missing ? html`<p class="warn-text tiny">${missing} item${missing > 1 ? 's were' : ' was'} deleted from your wardrobe</p>` : ''}</div></div>
        <div class="row gap"><button type="button" class="btn sm primary" data-act="useSaved" data-id="${s.id}" ${missing ? 'disabled' : ''}>Check for today</button>
        <button type="button" class="btn sm ghost" data-act="deleteSaved" data-id="${s.id}">Remove</button></div>
      </article>`;
    })}</div>` : html`<p class="muted empty-inline">Outfits you save will appear here.</p>`}
    <h2>Worn</h2>
    ${wears.length ? html`<ul class="history">${wears.map((w) => html`<li class="card">
      <div class="row between center"><div><strong>${fmtDate(w.date)}</strong> · ${w.planLabel}
        <p class="muted tiny">${w.weather ? `${r0(w.weather.feelsMin)}–${r0(w.weather.feelsMax)}° feels-like${w.weather.popMax != null ? ` · ${w.weather.popMax}% rain` : ''}` : ''}</p></div>
        <div class="stack-imgs">${w.itemIds.map(getItem).filter(Boolean).map((i) => itemImg(i, 'xs'))}</div></div>
      ${w.feedback ? html`<p class="small">${w.feedback.reasons.map((r) => FB.find((f) => f.id === r)?.label).join(', ')}${w.feedback.note ? html` — “${w.feedback.note}”` : ''}</p>
        ${w.feedback.learned?.length ? html`<p class="muted tiny">Learned: ${w.feedback.learned.join('; ')}</p>` : ''}`
      : html`<button type="button" class="link small" data-act="openFeedback" data-id="${w.id}">Add feedback</button>`}
    </li>`)}</ul>` : html`<p class="muted empty-inline">When you pick “Wear this”, it's logged here so you can say how it went.</p>`}
  </section>`;
}

// ---------------------------------------------------------------- profile
function viewProfile() {
  const p = db.prefs;
  const lt = p.learnedThermal || 0;
  const offs = Object.entries(p.formalityOffsets || {}).filter(([, v]) => v);
  const pairs = Object.values(p.pairScores || {}).filter((v) => v).length;
  return html`<section class="pad profile">
    <h1>You</h1>
    <div class="card"><h3>Location</h3>${locationPicker()}</div>
    <div class="card"><h3>Catalog</h3><p class="muted small">Which collection to show first when adding clothes. Everything stays available.</p>
      ${seg('setCollection', COLLECTIONS, coll())}</div>
    <div class="card"><h3>Temperature</h3>
      ${seg('setThermal', [{ id: 'cold', label: 'I feel cold easily' }, { id: 'neutral', label: 'Average' }, { id: 'warm', label: 'I run warm' }], p.thermal)}
      <p class="small">${lt === 0 ? html`<span class="muted">No adjustment learned yet. “Too cold / too warm” feedback tunes this.</span>` : html`Learned from feedback: suggestions are <strong>${lt > 0 ? 'warmer' : 'lighter'}</strong> than average (${lt > 0 ? '+' : ''}${lt.toFixed(1)}). <button type="button" class="link" data-act="resetThermal">Reset</button>`}</p>
    </div>
    <div class="card"><h3>Style</h3><p class="muted small">Gentle nudges, not rules.</p>${chips('toggleStyle', STYLE_OPTS, p.style)}
      <h4>Colours you like wearing</h4>${colorPicker('toggleFavColor', p.favoriteColors, { multi: true })}
      <h4>Never suggest</h4>${chips('toggleAvoid', TYPES.map((t) => ({ id: t.id, label: t.label })), p.avoidTypes)}
    </div>
    <div class="card"><h3>What I've learned</h3>
      ${offs.length ? html`<ul class="small">${offs.map(([k, v]) => html`<li>${PRESETS.find((x) => x.id === k)?.label || k}: aim ${v > 0 ? 'dressier' : 'more relaxed'} (${v > 0 ? '+' : ''}${v})</li>`)}</ul>` : ''}
      <p class="small muted">${pairs ? `${pairs} item pairings adjusted from your feedback.` : 'No combination feedback yet.'}</p>
      ${offs.length || pairs ? html`<button type="button" class="btn sm ghost" data-act="resetLearning">Reset learned preferences</button>` : ''}
    </div>
    <div class="card"><h3>Your data</h3>
      <p class="small">Everything is stored <strong>only in this browser on this device</strong> (wardrobe and feedback in local storage, photos in IndexedDB). There's no account and no sync, so clearing site data or switching devices loses it — export a backup if needed. Weather requests send only the city coordinates to Open-Meteo; online photo searches send your search terms to Wikimedia.</p>
      <div class="row gap wrap"><button type="button" class="btn sm" data-act="exportData">Export backup (JSON)</button>
      <button type="button" class="btn sm danger ghost" data-act="resetAll">${S.confirmReset ? 'Tap again to erase everything' : 'Delete all my data'}</button></div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- actions
const A = {
  tab(el) { S.tab = el.dataset.v; S.view = null; S.confirmReset = false; if (S.tab === 'today' && S.today.stage === 'results' && S.today.weather.status === 'ok') computeResults(); render(); window.scrollTo(0, 0); },
  closeSheet() {
    if (S.sheet?.type === 'edit') for (const id of S.sheet.newPhotos || []) deletePhoto(id);
    if (S.sheet?.type === 'confirm' && S.sheet.preview) URL.revokeObjectURL(S.sheet.preview);
    S.sheet = null; render();
  },
  closeView() { S.view = null; S.cat.replaceId = null; if (S.today.weather.status === 'ok') computeResults(); render(); window.scrollTo(0, 0); },

  // onboarding
  startOnboard() { S.onboardStep = 'collection'; render(); window.scrollTo(0, 0); },
  onboardBack() { S.onboardStep = { collection: 'welcome', starter: 'collection', next: 'starter' }[S.onboardStep] || 'welcome'; render(); window.scrollTo(0, 0); },
  pickCollection(el) { db.prefs.collection = el.dataset.v || null; save(); S.onboardStep = 'starter'; render(); window.scrollTo(0, 0); },
  setCollection(el) {
    db.prefs.collection = el.dataset.v; save(); render();
  },
  starterDone() { S.onboardStep = 'next'; render(); window.scrollTo(0, 0); },
  finishOnboard() { db.prefs.onboarded = true; save(); S.view = null; S.tab = 'today'; render(); window.scrollTo(0, 0); },
  finishLater() { db.prefs.onboarded = true; save(); S.view = null; S.tab = 'wardrobe'; render(); window.scrollTo(0, 0); },
  openStarter() { A.openStarterSlot({ dataset: {} }); },
  openStarterSlot(el) {
    S.sheet = null;
    if (db.prefs.onboarded) S.view = 'starter';
    else { S.view = null; S.onboardStep = 'starter'; }
    if (el.dataset.v) S.scrollTo = `cat-${el.dataset.v}`; else window.scrollTo(0, 0);
    render();
  },
  scrollSlot(el) { document.getElementById(`cat-${el.dataset.v}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  openQuick(el) {
    const t = TYPE[el.dataset.type];
    if (!t) return;
    const e = EXAMPLES.find((x) => x.type === t.id && x.cut === defaultCut(t, coll()) && (!t.lengths || x.length === defaultLength(t))) || EXAMPLES.find((x) => x.type === t.id);
    openConfirm({ source: 'catalog', v: { type: t.id, cut: e?.cut, length: e?.length } });
  },
  toggleMoreColors() { S.moreColors = !S.moreColors; render(); },

  // catalogue
  openCatalog(el) {
    S.sheet = null; S.view = 'catalog';
    S.cat = freshCatalog({ slot: el?.dataset?.v || '' });
    render(); window.scrollTo(0, 0);
  },
  catSource(el) {
    const C = S.cat;
    C.source = el.dataset.v;
    if (C.source === 'online' && C.online.status === 'idle' && (C.query.trim() || C.type)) runOnline(); else render();
  },
  catSlot(el) {
    const C = S.cat, v = el.dataset.v;
    if (C.slot === v) Object.assign(C, { slot: '', type: '', types: [], cut: '', length: '' });
    else { C.slot = v; C.types = []; if (C.type && TYPE[C.type].slot !== v) Object.assign(C, { type: '', cut: '', length: '' }); }
    C.limit = 30; render();
  },
  catType(el) {
    const C = S.cat, v = el.dataset.v;
    if (C.type === v) Object.assign(C, { type: '', cut: '', length: '' });
    else {
      const t = TYPE[v];
      Object.assign(C, { type: v, types: [], slot: t.slot });
      if (C.cut && !t.cuts.includes(C.cut)) C.cut = '';
      if (C.length && !t.lengths?.includes(C.length)) C.length = '';
    }
    C.limit = 30; render();
  },
  catCut(el) { toggleFilter('cut', el.dataset.v); },
  catLength(el) { toggleFilter('length', el.dataset.v); },
  catColor(el) { toggleFilter('color', el.dataset.v); },
  catPattern(el) { toggleFilter('pattern', el.dataset.v); },
  catClear(el) {
    const C = S.cat, k = el.dataset.v;
    if (k === 'slot') Object.assign(C, { slot: '', type: '', types: [], cut: '', length: '' });
    else if (k === 'type') Object.assign(C, { type: '', types: [], cut: '', length: '' });
    else C[k] = '';
    render();
  },
  catClearAll() { S.cat = freshCatalog({ source: S.cat.source, replaceId: S.cat.replaceId }); render(); },
  catMore() { S.cat.limit += 30; render(); },
  // Remove the most specific filter first.
  catBroaden() {
    const C = S.cat;
    const k = ['pattern', 'color', 'length', 'cut'].find((f) => C[f]);
    if (k) C[k] = '';
    else if (C.ignored?.length) { C.ignored = []; C.query = ''; }
    else if (C.type || C.types?.length) Object.assign(C, { type: '', types: [] });
    else C.slot = '';
    if (C.source === 'online') { C.source = 'curated'; }
    render();
  },
  catApprox() {
    const res = curatedSearch(catFilters(), coll());
    const r = res.similar[0];
    if (r) { pickExample(r.example, r, true); return; }
    const t = TYPE[res.applied.type || res.applied.types?.[0]];
    const e = t && EXAMPLES.find((x) => x.type === t.id);
    if (e) pickExample(e, null, true);
    else openConfirm({ source: 'catalog', approx: true, v: { type: res.applied.slot ? orderTypes(typesForSlot(res.applied.slot), coll())[0].id : '' } });
  },
  catPick(el) {
    const res = curatedSearch(catFilters(), coll());
    const r = [...res.close, ...res.similar].find((x) => x.example.id === el.dataset.id);
    pickExample(EXAMPLE[el.dataset.id], r, false, el.dataset.pattern);
  },
  catReport(el) {
    db.reports.push({ kind: 'curated', id: el.dataset.id, key: reportKey(), at: Date.now() });
    save();
    toast("Thanks — hidden for this search on this device. Reports aren't sent anywhere: the app has no server.", 4500);
    render();
  },
  onlineRetry() { runOnline(); },
  onlineMore() { runOnline(true); },
  onlinePick(el) {
    const C = S.cat;
    const r = C.online.results[+el.dataset.i];
    const it = C.replaceId ? getItem(C.replaceId) : null;
    const p = parseQuery(C.query);
    const type = C.type || p.types?.[0] || it?.type || '';
    openConfirm({ source: 'archive', result: r, v: { type, cut: C.cut || p.cut || (it?.type === type ? it.cut : ''), length: C.length || p.length || (it?.type === type ? it.length : '') }, colors: [C.color || p.color || it?.color].filter(Boolean) });
  },
  onlineReport(el) {
    const O = S.cat.online;
    const r = O.results[+el.dataset.i];
    db.reports.push({ kind: 'online', id: r.id, at: Date.now() });
    save();
    O.results.splice(+el.dataset.i, 1);
    if (O.hidden) O.hidden.reported++;
    toast("Reported — hidden on this device. Reports aren't sent anywhere: the app has no server.", 4500);
    render();
  },

  // confirm step
  cfType(el) {
    const s = S.sheet, t = TYPE[el.value];
    s.v.type = t ? t.id : '';
    if (t) {
      if (!t.cuts.includes(s.v.cut)) s.v.cut = defaultCut(t, coll());
      if (!t.lengths?.includes(s.v.length)) s.v.length = defaultLength(t);
      s.diffs = [];
    }
    applyTypical(s); render();
  },
  cfCut(el) { const s = S.sheet; s.v.cut = el.dataset.v; s.diffs = (s.diffs || []).filter((d) => d.field !== 'cut'); render(); },
  cfLength(el) { const s = S.sheet; s.v.length = el.dataset.v; s.diffs = (s.diffs || []).filter((d) => d.field !== 'length'); render(); },
  cfColor(el) {
    const s = S.sheet, v = el.dataset.v;
    const multi = s.source === 'catalog' && !s.replaceId;
    s.colors = multi ? (s.colors.includes(v) ? s.colors.filter((x) => x !== v) : [...s.colors, v]) : [v];
    s.colorSuggested = false; render();
  },
  cfPattern(el) { S.sheet.v.pattern = el.dataset.v; render(); },
  cfThickness(el) { S.sheet.thickness = el.dataset.v; render(); },
  cfWater(el) { setConfirmField('water', el.dataset.v); },
  cfWalk(el) { setConfirmField('walk', el.dataset.v); },
  cfCycle(el) { setConfirmField('cycle', el.dataset.v); },
  cfReset() { S.sheet.frame = { zoom: 1, x: 50, y: 50 }; render(); },
  async confirmAdd() {
    const s = S.sheet;
    const t = TYPE[s.v.type];
    s.busy = true; s.error = null; render();
    try {
      let image;
      if (s.source === 'catalog') image = { kind: 'catalog' };
      else if (s.source === 'archive') {
        const r = s.result;
        image = { kind: 'archive', thumb: r.thumb, source: 'Wikimedia Commons', license: r.license, author: r.author, pageUrl: r.pageUrl, title: r.title, frame: s.frame };
      } else image = { kind: 'photo', photoId: await putPhoto(s.blob), frame: s.frame };
      const attrs = confirmedAttrs(s);
      if (s.preview) URL.revokeObjectURL(s.preview);
      if (s.replaceId) {
        const it = await replaceImage(getItem(s.replaceId), { ...attrs, type: t.id, color: s.colors[0], image, sourceUrl: s.sourceUrl });
        S.cat.replaceId = null; S.view = null; S.tab = 'wardrobe';
        openEditSheet(it);
        toast('Updated — outfits, history and feedback are kept');
      } else {
        const extra = s.sourceUrl ? { sourceUrl: s.sourceUrl } : {};
        const items = s.colors.map((c) => createItem({ type: t.id, color: c, ...attrs, image: { ...image }, ...extra }));
        S.sheet = null;
        toast(items.length > 1 ? `Added ${items.length} ${t.label.toLowerCase()} items` : `Added your ${items[0].name}`);
      }
      if (S.today.weather.status === 'ok') computeResults();
    } catch (e) {
      s.busy = false; s.error = `Couldn't save: ${e.message}`;
    }
    render();
  },
  async removeItem(el) { await deleteItem(el.dataset.id); render(); },
  setThermal(el) { db.prefs.thermal = el.dataset.v; save(); render(); },
  toggleStyle(el) { toggleIn(db.prefs.style, el.dataset.v); save(); render(); },
  toggleFavColor(el) { toggleIn(db.prefs.favoriteColors, el.dataset.v); save(); render(); },
  toggleAvoid(el) { toggleIn(db.prefs.avoidTypes, el.dataset.v); save(); render(); },
  resetThermal() { db.prefs.learnedThermal = 0; save(); render(); },
  resetLearning() { db.prefs.formalityOffsets = {}; db.prefs.pairScores = {}; save(); toast('Learned preferences reset'); render(); },

  // location
  async geoLocate() {
    if (!navigator.geolocation) { S.loc.error = 'Location is not available in this browser.'; render(); return; }
    S.loc.status = 'loading'; S.loc.error = null; render();
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ name: 'Current location', region: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`, lat: pos.coords.latitude, lon: pos.coords.longitude });
    }, (err) => { S.loc.status = 'idle'; S.loc.error = err.code === 1 ? 'Location permission was declined. Search for your city instead.' : "Couldn't get your location. Search for your city instead."; render(); }, { timeout: 10000, maximumAge: 600000 });
  },
  pickLoc(el) { setLocation(S.loc.results[+el.dataset.i]); },

  // today
  pickPreset(el) { startPlan(planFromPreset(el.dataset.v)); window.scrollTo(0, 0); },
  backToPick() { S.today = freshToday(); render(); window.scrollTo(0, 0); },
  editPlan() { S.today.editing = !S.today.editing; render(); },
  planDay(el) { S.today.plan.day = +el.dataset.v; replan(true); },
  planOutdoor(el) { S.today.plan.outdoor = el.dataset.v; replan(false); },
  planMove(el) {
    const p = S.today.plan, v = el.dataset.v;
    toggleIn(p.moves, v);
    if (p.moves.includes(v) && (v === 'walk' || v === 'longwalk')) p.moves = p.moves.filter((m) => m !== (v === 'walk' ? 'longwalk' : 'walk'));
    replan(false);
  },
  planFormality(el) { S.today.plan.formality = +el.dataset.v; replan(false); },
  retryWeather() { loadWeather(); },
  manualWeatherOpen() { S.today.weather = { status: 'manualForm' }; render(); },
  clearLocks() { S.today.locks = {}; computeResults(); render(); },
  moreOptions() {
    const T = S.today;
    T.shown.forEach((o) => T.exclude.add(o.key));
    computeResults();
    if (!T.shown.length) { T.exclude.clear(); computeResults(); toast("That's all the strong options — starting over from the best."); }
    render();
  },
  openSwap(el) { S.sheet = { type: 'swap', i: +el.dataset.i, slot: el.dataset.slot }; render(); },
  pickAlt(el) {
    const s = S.sheet;
    const alts = alternatives(S.today.shown[s.i], s.slot, db.items, currentCtx());
    const a = alts[+el.dataset.j];
    const prev = S.today.shown[s.i];
    S.today.shown[s.i] = { ...rescore(a.outfit, currentCtx(), db.items), label: prev.label };
    if (S.today.locks[s.slot] && S.today.locks[s.slot] === prev[s.slot]?.id) delete S.today.locks[s.slot];
    S.sheet = null;
    toast(a.item ? `Swapped in the ${a.item.name}` : 'Removed');
    render();
  },
  lockItem(el) {
    const T = S.today;
    const { slot, id } = el.dataset;
    if (T.locks[slot] === id) delete T.locks[slot];
    else {
      T.locks[slot] = id;
      if (slot === 'dress') { delete T.locks.top; delete T.locks.bottom; }
      if (slot === 'top' || slot === 'bottom') delete T.locks.dress;
    }
    T.exclude.clear();
    S.sheet = null;
    computeResults();
    toast(T.locks[slot] ? `Building around the ${getItem(id).name}` : 'Unlocked');
    render();
  },
  answerAsk(el) {
    const { id, field, v } = el.dataset;
    const it = getItem(id);
    if (!it) return;
    if (v !== 'skip') { it[field] = v; it.estimated = { ...it.estimated, [field]: false }; save(); toast(`Noted — saved to your ${it.name}`); }
    else S.today.skipAsk = new Set([...(S.today.skipAsk || []), id + field]);
    computeResults();
    render();
  },
  wear(el) {
    const T = S.today;
    const o = T.shown[+el.dataset.i];
    const w = T.weather.data;
    const wear = {
      id: uid('w'), at: Date.now(), date: localDate(new Date(Date.now() + T.plan.day * 86400000)),
      preset: T.plan.preset, planLabel: T.plan.label, plan: { ...T.plan },
      weather: { feelsMin: w.feelsMin, feelsMax: w.feelsMax, tempMin: w.tempMin, tempMax: w.tempMax, popMax: w.popMax, windMax: w.windMax, source: w.source },
      itemIds: outfitItems(o).map((i) => i.id), feedback: null,
    };
    db.wears.push(wear);
    rememberPlan(T.plan);
    save();
    T.justWore = wear.id;
    toast('Outfit chosen. Enjoy your day!');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  saveOutfit(el) {
    const o = S.today.shown[+el.dataset.i];
    if (isSaved(o)) { toast('Already saved'); return; }
    db.saved.unshift({ id: uid('s'), itemIds: outfitItems(o).map((i) => i.id), name: `${S.today.plan.label} · ${o.label.toLowerCase()}`, createdAt: Date.now() });
    save();
    toast('Saved to Outfits');
    render();
  },
  openReject(el) { S.sheet = { type: 'reject', i: +el.dataset.i, reason: null, items: [] }; render(); },
  rejectReason(el) { S.sheet.reason = el.dataset.v; render(); },
  rejectItem(el) { toggleIn(S.sheet.items, el.dataset.id); render(); },
  confirmReject() {
    const T = S.today;
    const s = S.sheet;
    const o = T.shown[s.i];
    const ids = outfitItems(o).map((i) => i.id);
    db.rejections.push({ id: uid('r'), at: Date.now(), itemIds: ids, reason: s.reason, preset: T.plan.preset, items: s.items });
    let msg = 'Got it.';
    if (s.reason === 'style') {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = pairKey(ids[i], ids[j]); db.prefs.pairScores[k] = Math.max(-3, (db.prefs.pairScores[k] || 0) - 0.5); }
      msg = "Got it — I'll pair these pieces less often.";
    }
    if (s.reason === 'warm') { T.session.thermal -= 0.6; msg = 'Showing lighter options for today.'; }
    if (s.reason === 'cold') { T.session.thermal += 0.6; msg = 'Showing warmer options for today.'; }
    if (s.reason === 'casual') { T.session.formality += 0.5; msg = 'Showing dressier options.'; }
    if (s.reason === 'dressy') { T.session.formality -= 0.5; msg = 'Showing more relaxed options.'; }
    if (s.reason === 'unavailable') { s.items.forEach((id) => updateItem(id, { status: 'laundry' })); msg = 'Marked as in the laundry.'; }
    save();
    T.exclude.add(o.key);
    S.sheet = null;
    computeResults();
    toast(msg);
    render();
  },
  openFeedback(el) { S.sheet = { type: 'feedback', id: el.dataset.id, reasons: [], items: [], activity: 'walk', occasion: null, note: '' }; render(); },
  dismissFeedback(el) { const w = db.wears.find((x) => x.id === el.dataset.id); if (w) { w.dismissed = true; save(); } render(); },
  fbToggle(el) {
    const s = S.sheet;
    toggleIn(s.reasons, el.dataset.v);
    if (el.dataset.v === 'comfort' && !s.items.length) {
      const w = db.wears.find((x) => x.id === s.id);
      const shoes = w.itemIds.map(getItem).find((i) => i?.slot === 'shoes');
      if (shoes) s.items = [shoes.id];
      if (w.plan?.moves?.includes('cycle') && !w.plan.moves.some((m) => m.includes('walk'))) s.activity = 'cycle';
    }
    render();
  },
  fbOccasion(el) { S.sheet.occasion = el.dataset.v; render(); },
  fbActivity(el) { S.sheet.activity = el.dataset.v; render(); },
  fbItem(el) { toggleIn(S.sheet.items, el.dataset.id); render(); },
  submitFeedback() {
    const s = S.sheet;
    const w = db.wears.find((x) => x.id === s.id);
    const learned = applyFeedback(w, s);
    if (S.today.justWore === w.id) S.today.justWore = null;
    S.sheet = null;
    if (S.today.weather.status === 'ok') computeResults();
    toast(learned.length ? `Thanks! ${learned[0]}.` : 'Thanks — feedback saved.', 4500);
    render();
  },

  // wardrobe
  wFilter(el) { S.wardrobeFilter = el.dataset.v; render(); },
  openAddMenu() { S.sheet = { type: 'addMenu' }; render(); },
  openEdit(el) { openEditSheet(getItem(el.dataset.id)); render(); },
  editType(el) {
    const d = S.sheet.draft;
    const t = TYPE[el.value];
    if (!t.cuts.includes(d.cut)) d.cut = defaultCut(t, coll());
    d.length = t.lengths ? (t.lengths.includes(d.length) ? d.length : defaultLength(t)) : null;
    const defs = defaultItemFields(t.id, d.cut, d.length);
    const est = d.estimated || {};
    d.type = t.id; d.slot = t.slot;
    for (const k of ['warmth', 'formality', 'water', 'walk', 'cycle']) if (est[k] !== false) d[k] = defs[k];
    render();
  },
  editCut(el) {
    const d = S.sheet.draft;
    d.cut = el.dataset.v;
    if (d.estimated?.warmth !== false) d.warmth = cutWarmth(TYPE[d.type], d.cut);
    render();
  },
  editLength(el) { S.sheet.draft.length = el.dataset.v; render(); },
  editWarmthUnsure() { const d = S.sheet.draft; d.warmth = cutWarmth(TYPE[d.type], d.cut); d.estimated = { ...d.estimated, warmth: true }; render(); },
  edReset() { S.sheet.draft.image.frame = { zoom: 1, x: 50, y: 50 }; render(); },
  editColor(el) { S.sheet.draft.color = el.dataset.v; render(); },
  editPattern(el) { S.sheet.draft.pattern = el.dataset.v; render(); },
  editStatus(el) { S.sheet.draft.status = el.dataset.v; render(); },
  editWarmth(el) { setConfirmed('warmth', +el.dataset.v); },
  editFmin(el) { const f = S.sheet.draft.formality; f[0] = +el.value; if (f[1] < f[0]) f[1] = f[0]; setConfirmed('formality', f); },
  editFmax(el) { const f = S.sheet.draft.formality; f[1] = +el.value; if (f[0] > f[1]) f[0] = f[1]; setConfirmed('formality', f); },
  editWater(el) { setConfirmed('water', el.dataset.v); },
  editWalk(el) { setConfirmed('walk', el.dataset.v); },
  editCycle(el) { setConfirmed('cycle', el.dataset.v); },
  async editPhoto(el) {
    const s = S.sheet;
    const file = el.files?.[0];
    s.photoError = null; s.photoBusy = true; render();
    try {
      const { blob, previewUrl } = await processUpload(file);
      URL.revokeObjectURL(previewUrl);
      const photoId = await putPhoto(blob);
      s.newPhotos.push(photoId);
      if (s.draft.image?.kind !== 'photo') s.draft.prevImage = s.draft.image;
      s.draft.image = { kind: 'photo', photoId, frame: { zoom: 1, x: 50, y: 50 } };
    } catch (e) {
      s.photoError = e.message;
    }
    s.photoBusy = false;
    render();
  },
  editRevertImg() { S.sheet.draft.image = { kind: 'catalog' }; render(); },
  async editSave() {
    await commitDraft();
    S.sheet = null;
    toast('Saved');
    if (S.today.weather.status === 'ok') computeResults();
    render();
  },
  // Save what's in the editor, then pick a new image for the same item.
  async editFindImage() {
    const it = await commitDraft();
    S.sheet = null;
    S.cat = freshCatalog({ slot: it.slot, type: it.type, replaceId: it.id });
    S.view = 'catalog';
    render();
    window.scrollTo(0, 0);
  },
  async editDelete() {
    const s = S.sheet;
    if (!s.confirmDelete) { s.confirmDelete = true; render(); return; }
    for (const id of s.newPhotos) await deletePhoto(id);
    await deleteItem(s.id);
    S.sheet = null;
    toast('Item deleted');
    if (S.today.weather.status === 'ok') computeResults();
    render();
  },

  // upload & product link
  openUpload() { S.sheet = { type: 'upload', link: false, replaceId: S.view === 'catalog' ? S.cat.replaceId : null }; render(); },
  openLink() { S.sheet = { type: 'upload', link: true, url: '', replaceId: null }; render(); },
  async uploadFile(el) {
    const s = S.sheet;
    const url = (s.url || '').trim();
    if (s.link && url && !/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) { s.error = "That doesn't look like a web link. Check it, or leave it empty."; render(); return; }
    s.error = null; s.busy = true; render();
    try {
      const res = await processUpload(el.files?.[0]);
      const it = s.replaceId ? getItem(s.replaceId) : null;
      openConfirm({
        source: s.link ? 'link' : 'upload', preview: res.previewUrl, blob: res.blob, sourceUrl: s.link && url ? url : null, replaceId: s.replaceId,
        colors: [nearestColor(...res.avg).id], colorSuggested: true,
        v: it ? { type: it.type, cut: it.cut, length: it.length, pattern: it.pattern } : {},
      });
    } catch (e) { s.error = e.message; s.busy = false; render(); }
  },

  // wishlist
  addWish(el) {
    db.wishlist.push({ id: uid('wl'), type: el.dataset.type, text: el.dataset.text, createdAt: Date.now() });
    save(); toast('Saved to your wishlist (in Wardrobe). It won’t appear in outfits.'); render();
  },
  wishOwned(el) {
    const w = db.wishlist.find((x) => x.id === el.dataset.id);
    db.wishlist = db.wishlist.filter((x) => x.id !== w.id); save();
    A.openQuick({ dataset: { type: w.type } });
  },
  wishRemove(el) { db.wishlist = db.wishlist.filter((x) => x.id !== el.dataset.id); save(); render(); },

  // saved
  useSaved(el) {
    const s = db.saved.find((x) => x.id === el.dataset.id);
    const items = s.itemIds.map(getItem);
    const unavailable = items.filter((i) => i.status !== 'available');
    if (unavailable.length) { toast(`${cap(unavailable[0].name)} is marked unavailable — update it in your wardrobe first.`, 4500); return; }
    const locks = { layer: 'none', outer: 'none' };
    items.forEach((i) => { locks[i.slot] = i.id; });
    const plan = planFromPreset(db.prefs.lastPreset || 'uni');
    S.tab = 'today';
    startPlan(plan);
    S.today.locks = locks;
    toast('Checking this saved outfit against the forecast');
  },
  deleteSaved(el) { db.saved = db.saved.filter((x) => x.id !== el.dataset.id); save(); render(); },

  // data
  exportData() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wardrobe-backup-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded (photos are not included).');
  },
  async resetAll() {
    if (!S.confirmReset) { S.confirmReset = true; render(); return; }
    await resetAll();
    Object.assign(S, { tab: 'today', view: null, sheet: null, today: freshToday(), onboardStep: 'welcome', confirmReset: false });
    location.reload();
  },
};

function openEditSheet(it) {
  S.sheet = { type: 'edit', id: it.id, draft: JSON.parse(JSON.stringify(it)), newPhotos: [], autoName: it.name === itemName(it.type, it.color, it.cut, it.length) };
}

// The curated search takes structure, not raw text: a submitted query is parsed
// into filters (shown as removable crumbs), and only words it couldn't place
// are kept so the user is told about them.
function catFilters() {
  const { query, ...rest } = S.cat;
  const key = reportKey();
  return { ...rest, hidden: db.reports.filter((r) => r.kind === 'curated' && r.key === key).map((r) => r.id) };
}
const reportKey = () => ['slot', 'type', 'cut', 'length'].map((k) => S.cat[k] || '').join('|');

function toggleFilter(k, v) {
  S.cat[k] = S.cat[k] === v ? '' : v;
  S.cat.limit = 30;
  render();
}

function pickExample(e, r, approx, pattern) {
  const it = S.cat.replaceId ? getItem(S.cat.replaceId) : null;
  const color = S.cat.color || it?.color;
  openConfirm({ source: 'catalog', approx, diffs: r?.diffs || [], v: { type: e.type, cut: e.cut, length: e.length, pattern: pattern || S.cat.pattern || it?.pattern || 'solid' }, colors: color ? [color] : [] });
}

function openConfirm(over) {
  S.sheet = {
    type: 'confirm', source: 'catalog', colors: [], thickness: 'unsure', set: {}, frame: { zoom: 1, x: 50, y: 50 },
    replaceId: S.view === 'catalog' ? S.cat.replaceId : null, diffs: [],
    ...over, v: { type: '', cut: '', length: null, pattern: 'solid', ...over.v },
  };
  if (S.sheet.replaceId && !over.colors) S.sheet.colors = [getItem(S.sheet.replaceId)?.color].filter(Boolean);
  applyTypical(S.sheet);
  render();
}

// Untouched practical details follow the type's typical values.
function applyTypical(s) {
  const t = TYPE[s.v.type];
  if (!t) return;
  const d = defaultItemFields(t.id, s.v.cut, s.v.length);
  s.v.cut = d.cut; s.v.length = d.length;
  for (const k of ['water', 'walk', 'cycle']) if (!s.set[k]) s[k] = d[k] || 'unknown';
}

function setConfirmField(k, v) {
  S.sheet[k] = v;
  S.sheet.set[k] = true;
  render();
}

function confirmedAttrs(s) {
  const t = TYPE[s.v.type];
  const d = defaultItemFields(t.id, s.v.cut, s.v.length);
  return {
    cut: d.cut, length: d.length, pattern: s.v.pattern, formality: d.formality,
    warmth: s.thickness === 'unsure' ? d.warmth : warmthFor(t, d.cut, s.thickness),
    water: ['outer', 'shoes'].includes(t.slot) ? s.water : d.water,
    walk: t.slot === 'shoes' ? s.walk : d.walk,
    cycle: t.slot === 'shoes' ? s.cycle : d.cycle,
    estimated: { warmth: s.thickness === 'unsure', formality: true, water: !s.set.water, walk: !s.set.walk, cycle: !s.set.cycle },
  };
}

// Live framing updates without re-rendering, so sliders stay smooth.
function setFrame(frame, key, value) {
  frame[key] = +value;
  const el = $sheet.querySelector('.frame.editable');
  if (el) el.style.setProperty(key === 'zoom' ? '--z' : `--${key}`, key === 'zoom' ? frame.zoom : `${frame[key]}%`);
}
const draftFrame = () => (S.sheet.draft.image.frame ||= { zoom: 1, x: 50, y: 50 });

// Writes the edit sheet's draft to the item. The item keeps its id, so saved
// outfits, wear history, feedback and pair scores still refer to it.
async function commitDraft() {
  const s = S.sheet;
  const it = getItem(s.id);
  const d = s.draft;
  const oldPhoto = it.image?.kind === 'photo' ? it.image.photoId : null;
  const newPhoto = d.image?.kind === 'photo' ? d.image.photoId : null;
  // Remove photo blobs no longer referenced.
  for (const id of s.newPhotos) if (id !== newPhoto) await deletePhoto(id);
  if (oldPhoto && oldPhoto !== newPhoto) await deletePhoto(oldPhoto);
  s.newPhotos = [];
  // Names the user never changed follow corrections to type, cut and colour.
  if (!d.name.trim() || (s.autoName && d.name === it.name)) d.name = itemName(d.type, d.color, d.cut, d.length);
  Object.assign(it, d, { name: d.name.trim().slice(0, 60) });
  save();
  return it;
}

// Swap an item's image and apply the confirmed details in place. Values the
// user confirmed earlier on this item are kept unless confirmed again now.
async function replaceImage(it, f) {
  const autoName = it.name === itemName(it.type, it.color, it.cut, it.length);
  const est = { ...(it.estimated || {}) };
  const patch = { image: f.image, type: f.type, slot: TYPE[f.type].slot, cut: f.cut, length: f.length, color: f.color, pattern: f.pattern };
  for (const k of ['warmth', 'water', 'walk', 'cycle']) {
    if (!f.estimated[k]) { patch[k] = f[k]; est[k] = false; } else if (est[k] !== false || f.type !== it.type) { patch[k] = f[k]; est[k] = true; }
  }
  if (f.type !== it.type && est.formality !== false) patch.formality = f.formality;
  patch.estimated = est;
  if (f.sourceUrl) patch.sourceUrl = f.sourceUrl;
  if (it.image?.kind === 'photo' && it.image.photoId !== f.image.photoId) await deletePhoto(it.image.photoId);
  if (autoName) patch.name = itemName(f.type, f.color, f.cut, f.length);
  return updateItem(it.id, patch);
}

function setConfirmed(field, value) {
  const d = S.sheet.draft;
  d[field] = value;
  d.estimated = { ...d.estimated, [field]: false };
  render();
}

function toggleIn(arr, v) {
  const i = arr.indexOf(v);
  if (i >= 0) arr.splice(i, 1); else arr.push(v);
}

function setLocation(loc) {
  db.prefs.location = loc;
  save();
  S.loc = { q: '', results: [], status: 'idle', error: null };
  toast(`Forecasts for ${loc.name}`);
  if (S.today.stage === 'results' && S.today.weather.status !== 'ok') loadWeather();
  else render();
}

function replan(refetch) {
  const T = S.today;
  rememberPlan(T.plan);
  T.exclude.clear();
  if (refetch || T.weather.status !== 'ok') loadWeather();
  else { computeResults(); render(); }
}

const SUBMIT = {
  async searchLoc() {
    const q = S.loc.q.trim();
    if (!q) return;
    S.loc.status = 'loading'; S.loc.error = null; S.loc.results = []; render();
    try {
      const res = await geocode(q);
      S.loc.results = res; S.loc.status = res.length ? 'done' : 'empty';
    } catch (e) { S.loc.status = 'idle'; S.loc.error = e.message; }
    render();
  },
  describePlan() {
    const note = (S.today.draftNote || '').trim();
    if (!note) { document.getElementById('plan-note')?.focus(); return; }
    const plan = { ...planFromPreset('custom'), ...interpretNote(note), note, label: note.length > 42 ? note.slice(0, 40) + '…' : note, remembered: false };
    startPlan(plan);
    S.today.editing = true; // show what was understood so it can be corrected
    window.scrollTo(0, 0);
  },
  useManual() {
    const M = S.today.manual;
    const low = Math.min(M.low, M.high), high = Math.max(M.low, M.high);
    S.today.weather = { status: 'ok', data: manualWeather({ low, high, rain: M.rain, windy: M.windy }) };
    computeResults();
    render();
  },
  catSearch() {
    const C = S.cat;
    const p = parseQuery(C.query);
    const types = p.types || [];
    Object.assign(C, {
      slot: p.slot || (types.length && types.every((id) => TYPE[id].slot === TYPE[types[0]].slot) ? TYPE[types[0]].slot : ''),
      type: types.length === 1 ? types[0] : '', types: types.length > 1 ? types : [],
      cut: p.cut || '', length: p.length || '', color: p.color || '', pattern: p.pattern || '', ignored: p.ignored, limit: 30,
    });
    render();
  },
  onlineSearch() { runOnline(); },
};

const CHANGE = {
  planStart(el) { if (el.value) { S.today.plan.start = el.value; replan(true); } },
  planEnd(el) { if (el.value) { S.today.plan.end = el.value; replan(true); } },
  manLow(el) { S.today.manual.low = clampNum(el.value, -30, 45, 10); },
  manHigh(el) { S.today.manual.high = clampNum(el.value, -30, 45, 16); },
  manRain(el) { S.today.manual.rain = el.checked; },
  manWindy(el) { S.today.manual.windy = el.checked; },
};

const INPUT = {
  locQ(el) { S.loc.q = el.value; },
  draftNote(el) { S.today.draftNote = el.value; },
  fbNote(el) { S.sheet.note = el.value; },
  editName(el) { S.sheet.draft.name = el.value; },
  catQuery(el) { S.cat.query = el.value; },
  linkUrl(el) { S.sheet.url = el.value; },
  cfZoom(el) { setFrame(S.sheet.frame, 'zoom', el.value); },
  cfX(el) { setFrame(S.sheet.frame, 'x', el.value); },
  cfY(el) { setFrame(S.sheet.frame, 'y', el.value); },
  edZoom(el) { setFrame(draftFrame(), 'zoom', el.value); },
  edX(el) { setFrame(draftFrame(), 'x', el.value); },
  edY(el) { setFrame(draftFrame(), 'y', el.value); },
};

function clampNum(v, a, b, d) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d;
}

// ---------------------------------------------------------------- events
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  const key = el.dataset?.change;
  if (!key) return;
  if (CHANGE[key]) CHANGE[key](el);
  else if (A[key]) A[key](el);
});
document.addEventListener('input', (e) => {
  const key = e.target.dataset?.input;
  if (key && INPUT[key]) INPUT[key](e.target);
});
document.addEventListener('submit', (e) => {
  const key = e.target.dataset?.submit;
  if (!key) return;
  e.preventDefault();
  SUBMIT[key]?.(e.target);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.sheet) A.closeSheet();
});
// Images that fail to load (offline, removed, missing asset) fall back to an illustration.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName === 'IMG' && el.dataset.fallback) {
    const it = getItem(el.dataset.fallback) || S.sheet?.draft;
    const frame = el.closest('.frame');
    if (it) (frame || el).outerHTML = toString(illustration(it, frame ? frame.className.replace('frame', '') : ''));
  } else if (el.tagName === 'IMG' && el.dataset.fallbackType) {
    const { fallbackType, fallbackColor, fallbackCut, fallbackLength } = el.dataset;
    el.outerHTML = toString(illustration({ type: fallbackType, color: fallbackColor, cut: fallbackCut || undefined, length: fallbackLength || undefined }, el.className.replace(/\bgarment\b|\bpending\b/g, '')));
  }
}, true);

// ---------------------------------------------------------------- boot
(async function boot() {
  try { await loadPhotos(); } catch (e) { console.warn('Photos unavailable', e); }
  render();
})();
