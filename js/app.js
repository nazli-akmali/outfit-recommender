import { html, raw, toString, esc } from './html.js';
import { SLOTS, TYPES, TYPE, COLORS, COLOR, PATTERNS, FORMALITY, WARMTH_LABELS, illustration, typesForSlot, colorLabel, nearestColor, defaultItemFields } from './catalog.js';
import { db, save, uid, createItem, getItem, updateItem, deleteItem, resetAll, putPhoto, deletePhoto, photoUrls, loadPhotos, processUpload, exportData, itemName } from './store.js';
import { geocode, getForecastWindow, manualWeather } from './weather.js';
import { PROVIDERS } from './archive.js';
import { PRESETS, MOVES, OUTDOOR, planFromPreset, rememberPlan, interpretNote } from './plan.js';
import { buildContext, recommend, alternatives, rescore, outfitItems, outfitKey, pairKey, FAIL_TEXT, wp } from './recommender.js';

// ---------------------------------------------------------------- state
const S = {
  tab: 'today',
  view: null, // sub-page: 'starter' | 'archive'
  starter: { idx: 0, mode: 'onboard' },
  onboardStep: 'welcome', // welcome | starter | prefs
  sheet: null,
  toast: null,
  today: freshToday(),
  wardrobeFilter: 'all',
  archive: { provider: 'commons', slot: '', type: '', cut: '', color: '', query: '', results: [], status: 'idle', error: null, nextOffset: null },
  loc: { q: '', results: [], status: 'idle', error: null },
};

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

function itemImg(item, cls = '') {
  if (!item) return '';
  const im = item.image || {};
  if (im.kind === 'photo' && photoUrls.get(im.photoId)) return html`<img class="item-img ${cls}" src="${photoUrls.get(im.photoId)}" alt="">`;
  if (im.kind === 'archive' && im.thumb) return html`<img class="item-img ${cls}" src="${im.thumb}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${item.id}">`;
  return illustration(item.type, item.color, item.cut, item.pattern, cls);
}

const sourceLabel = (item) => ({ photo: 'Your photo', archive: 'Archive image', illustration: 'Illustration' }[item.image?.kind] || 'Illustration');
const formalityRange = (f) => (f[0] === f[1] ? FORMALITY[f[0]].label : `${FORMALITY[f[0]].label} – ${FORMALITY[f[1]].label}`);

function seg(act, options, value, extra = '') {
  return html`<div class="seg" role="radiogroup">${options.map((o) => html`<button type="button" role="radio" aria-checked="${String(o.id === value)}" class="${o.id === value ? 'on' : ''}" data-act="${act}" data-v="${o.id}" ${raw(extra)}>${o.label}</button>`)}</div>`;
}

function chips(act, options, values) {
  return html`<div class="chips">${options.map((o) => html`<button type="button" class="chip ${values.includes(o.id) ? 'on' : ''}" aria-pressed="${String(values.includes(o.id))}" data-act="${act}" data-v="${o.id}">${o.label}</button>`)}</div>`;
}

function swatches(act, selected, { multi = false, highlight = [] } = {}) {
  const sel = multi ? selected : [selected];
  const order = [...COLORS].sort((a, b) => (highlight.includes(b.id) ? 1 : 0) - (highlight.includes(a.id) ? 1 : 0));
  return html`<div class="swatches">${order.map((c) => html`<button type="button" class="swatch ${sel.includes(c.id) ? 'on' : ''}" style="--c:${c.hex}" aria-pressed="${String(sel.includes(c.id))}" aria-label="${c.label}" title="${c.label}" data-act="${act}" data-v="${c.id}"><span></span></button>`)}</div>`;
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
  if (onboarding) body = viewOnboarding();
  else if (S.view === 'starter') body = viewStarter();
  else if (S.view === 'archive') body = viewArchive();
  else body = { today: viewToday, wardrobe: viewWardrobe, outfits: viewOutfits, profile: viewProfile }[S.tab]();
  const nav = onboarding || S.view ? '' : html`
    <nav class="tabbar" aria-label="Main">
      ${[['today', 'Today'], ['wardrobe', 'Wardrobe'], ['outfits', 'Outfits'], ['profile', 'You']].map(([id, label]) => html`
        <button type="button" class="${S.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}" aria-current="${S.tab === id ? 'page' : 'false'}">${icon(id)}<span>${label}</span></button>`)}
    </nav>`;
  $app.innerHTML = toString(html`<main class="screen ${S.view ? 'sub' : ''}">${body}</main>${nav}`);
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
      <div class="welcome-art">${illustration('shirt', 'white')}${illustration('jeans', 'denim', 'wide-leg')}${illustration('sneakers', 'white')}</div>
      <h1>Less time deciding what to wear</h1>
      <p class="lead">Tell me roughly what's in your wardrobe and where you're going. I'll check the weather for the hours you're out and suggest outfits from clothes you actually own.</p>
      <ul class="ticks">
        <li>${icon('check')} Start with a few basics — about two minutes</li>
        <li>${icon('check')} No photos needed to begin; add them later if you like</li>
        <li>${icon('check')} No account: everything stays on this device</li>
      </ul>
      <button type="button" class="btn primary block" data-act="startOnboard">Pick my basics</button>
    </section>`;
  }
  if (S.onboardStep === 'prefs') return viewOnboardPrefs();
  return viewStarter();
}

function viewOnboardPrefs() {
  const p = db.prefs;
  return html`<section class="pad">
    <p class="eyebrow">Almost done</p>
    <h1>A couple of preferences</h1>
    <p class="muted">Optional — you can change these any time under “You”.</p>
    <div class="card">
      <h3>Where are you usually?</h3>
      <p class="muted small">Used only to fetch the forecast.</p>
      ${locationPicker()}
    </div>
    <div class="card">
      <h3>Do you tend to feel…</h3>
      ${seg('setThermal', [{ id: 'cold', label: 'Cold easily' }, { id: 'neutral', label: 'About average' }, { id: 'warm', label: 'Warm easily' }], p.thermal)}
    </div>
    <div class="card">
      <h3>Your style, loosely</h3>
      <p class="muted small">A gentle nudge for suggestions, not a rule.</p>
      ${chips('toggleStyle', STYLE_OPTS, p.style)}
    </div>
    <div class="row gap">
      <button type="button" class="btn ghost" data-act="onboardBack">Back</button>
      <button type="button" class="btn primary grow" data-act="finishOnboard">Plan my day</button>
    </div>
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

// ---------------------------------------------------------------- starter catalogue
const STARTER_SLOTS = ['top', 'bottom', 'layer', 'outer', 'shoes', 'dress'];

function viewStarter() {
  const st = S.starter;
  const slotId = STARTER_SLOTS[st.idx];
  const slot = SLOTS.find((s) => s.id === slotId);
  const inSlot = owned().filter((i) => i.slot === slotId);
  const onboard = st.mode === 'onboard';
  const last = st.idx === STARTER_SLOTS.length - 1;
  return html`<section class="pad starter">
    <header class="subhead">
      ${onboard ? '' : html`<button type="button" class="icon-btn" data-act="closeView" aria-label="Back">${icon('back')}</button>`}
      <div>
        <p class="eyebrow">${onboard ? `Step ${st.idx + 1} of ${STARTER_SLOTS.length}` : 'Quick basics'}</p>
        <h1>${slot.step}</h1>
      </div>
    </header>
    ${onboard ? html`<div class="progress" aria-hidden="true">${STARTER_SLOTS.map((_, i) => html`<span class="${i <= st.idx ? 'on' : ''}"></span>`)}</div>` : html`
      <div class="chips scroll-x">${STARTER_SLOTS.map((s, i) => html`<button type="button" class="chip ${i === st.idx ? 'on' : ''}" data-act="starterGo" data-i="${i}">${SLOTS.find((x) => x.id === s).label}</button>`)}</div>`}
    <p class="muted">Tap what you own. Pick every colour you have — approximate is fine.</p>
    <div class="type-grid">
      ${typesForSlot(slotId).map((t) => {
        const n = inSlot.filter((i) => i.type === t.id).length;
        return html`<button type="button" class="type-tile" data-act="openQuick" data-type="${t.id}">
          ${illustration(t.id, t.starter[0], t.defaultCut)}
          <span>${t.label}</span>
          ${n ? html`<b class="badge" aria-label="${n} added">${n}</b>` : ''}
        </button>`;
      })}
    </div>
    ${inSlot.length ? html`<div class="added"><h3>Added (${inSlot.length})</h3><ul class="mini-list">${inSlot.map((i) => html`
      <li>${itemImg(i, 'xs')}<span>${cap(i.name)}</span><button type="button" class="icon-btn sm" data-act="removeItem" data-id="${i.id}" aria-label="Remove ${i.name}">${icon('close')}</button></li>`)}</ul></div>` : ''}
    <div class="sticky-actions">
      ${onboard ? html`
        <button type="button" class="btn ghost" data-act="starterPrev">${st.idx === 0 ? 'Back' : 'Back'}</button>
        <button type="button" class="btn ${inSlot.length ? 'primary' : ''} grow" data-act="starterNext">${last ? (inSlot.length ? 'Next' : 'Skip & continue') : inSlot.length ? 'Next' : 'Skip for now'}</button>`
      : html`<button type="button" class="btn primary grow" data-act="closeView">Done</button>`}
    </div>
  </section>`;
}

const SHEETS = {};

SHEETS.quick = (s) => {
  const t = TYPE[s.typeId];
  return html`${sheetHead(`Add ${t.label.toLowerCase()}`, 'Choose every colour you own — each becomes its own item.')}
  <div class="sheet-body">
    <div class="quick-preview">${(s.colors.length ? s.colors : [t.starter[0]]).slice(0, 4).map((c) => illustration(t.id, c, s.cut, s.pattern))}</div>
    ${t.cuts.length > 1 ? html`<h3>Cut / fit</h3>${seg('quickCut', t.cuts.map((c) => ({ id: c, label: cap(c) })), s.cut)}` : ''}
    <h3>Colours <span class="muted small">(${s.colors.length} selected)</span></h3>
    ${swatches('quickColor', s.colors, { multi: true, highlight: t.starter })}
    <h3>Pattern</h3>
    ${seg('quickPattern', PATTERNS, s.pattern)}
  </div>
  <footer class="sheet-foot">
    <button type="button" class="btn primary block" data-act="quickAdd" ${s.colors.length ? '' : 'disabled'}>${s.colors.length ? `Add ${s.colors.length} item${s.colors.length > 1 ? 's' : ''} I own` : 'Pick at least one colour'}</button>
  </footer>`;
};

// ---------------------------------------------------------------- today
function viewToday() {
  if (!owned().length) {
    return html`<section class="pad empty">
      ${illustration('tshirt', 'cream')}
      <h1>Your wardrobe is empty</h1>
      <p class="muted">Add a few basics and I can start suggesting outfits.</p>
      <button type="button" class="btn primary" data-act="openStarter">Add basics</button>
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
  if (R.problem.kind === 'incomplete') {
    return html`<div class="card problem"><h3>I can't build a full outfit yet</h3>
      <p>To suggest something wearable I still need:</p>
      <ul>${R.problem.gaps.map((g) => html`<li>${cap(g.text)}${g.unavailable ? html` <span class="muted small">— yours are all marked unavailable or in the laundry</span>` : ''}</li>`)}</ul>
      <div class="row gap wrap">${R.problem.gaps.map((g) => html`<button type="button" class="btn sm" data-act="openStarterSlot" data-v="${g.slot}">Add ${SLOTS.find((s) => s.id === g.slot).label.toLowerCase()}</button>`)}
      ${R.problem.gaps.some((g) => g.unavailable) ? html`<button type="button" class="btn sm ghost" data-act="tab" data-v="wardrobe">Check laundry</button>` : ''}</div></div>`;
  }
  return html`<div class="card problem"><h3>No outfit really works today</h3>
    ${R.problem.lines.map((l) => html`<p>${l}</p>`)}
    <p class="muted small">Rather than suggest something unsuitable, here's what's missing. You can also adjust your plan above.</p></div>`;
}

function suggestionsBox(list) {
  if (!list?.length) return '';
  return html`<aside class="card ideas" aria-label="Not in your wardrobe">
    <p class="eyebrow">Not in your wardrobe · ideas only</p>
    ${list.map((s) => html`<div class="idea">
      ${s.type ? illustration(s.type, 'charcoal') : ''}
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
  return [
    { id: 'basics', label: 'Everyday outfits', ok: (any((i) => i.slot === 'top') && any((i) => i.slot === 'bottom')) || any((i) => i.slot === 'dress') ? any((i) => i.slot === 'shoes') : false, fix: !any((i) => i.slot === 'shoes') ? 'shoes' : !any((i) => i.slot === 'top') ? 'top' : 'bottom', hint: 'Needs a top, bottoms and shoes' },
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
    <div class="add-row">
      <button type="button" class="add-opt" data-act="openStarter">${icon('grid')}<span><strong>Quick basics</strong><small>Pick type & colour</small></span></button>
      <button type="button" class="add-opt" data-act="openArchive">${icon('search')}<span><strong>Browse archive</strong><small>Find a closer image</small></span></button>
      <button type="button" class="add-opt" data-act="openUpload">${icon('camera')}<span><strong>Upload photo</strong><small>Of your own item</small></span></button>
    </div>
    <div class="chips scroll-x" role="toolbar" aria-label="Filter">
      <button type="button" class="chip ${f === 'all' ? 'on' : ''}" data-act="wFilter" data-v="all">All</button>
      ${SLOTS.filter((s) => counts[s.id]).map((s) => html`<button type="button" class="chip ${f === s.id ? 'on' : ''}" data-act="wFilter" data-v="${s.id}">${s.label} ${counts[s.id]}</button>`)}
      ${unavailable ? html`<button type="button" class="chip ${f === 'laundry' ? 'on' : ''}" data-act="wFilter" data-v="laundry">Unavailable ${unavailable}</button>` : ''}
    </div>
    ${shown.length ? html`<div class="item-grid">${shown.map((i) => html`<button type="button" class="item-card ${i.status !== 'available' ? 'dim' : ''}" data-act="openEdit" data-id="${i.id}">
      <div class="img-wrap">${itemImg(i)}${i.status !== 'available' ? html`<span class="status">${i.status === 'laundry' ? 'In laundry' : 'Unavailable'}</span>` : ''}</div>
      <span class="name">${cap(i.name)}</span><span class="muted tiny">${sourceLabel(i)}</span></button>`)}</div>`
    : html`<p class="muted empty-inline">${items.length ? 'Nothing here.' : 'No items yet — start with quick basics.'}</p>`}
    ${db.wishlist.length ? html`<section class="wishlist"><h2>Wishlist <span class="muted small">· not owned, never used in outfits</span></h2>
      <ul class="mini-list">${db.wishlist.map((w) => html`<li>${illustration(w.type, 'charcoal', null, 'solid', 'xs')}<span class="grow">${TYPE[w.type].label}<br><span class="muted tiny">${w.text}</span></span>
      <button type="button" class="link small" data-act="wishOwned" data-id="${w.id}">I got it</button>
      <button type="button" class="icon-btn sm" data-act="wishRemove" data-id="${w.id}" aria-label="Remove from wishlist">${icon('close')}</button></li>`)}</ul></section>` : ''}
  </section>`;
}

function typeSelect(act, value, { required = false } = {}) {
  return html`<select data-change="${act}" ${required ? 'required' : ''}>
    ${!value ? html`<option value="">Choose a type…</option>` : ''}
    ${SLOTS.map((s) => html`<optgroup label="${s.label}">${typesForSlot(s.id).map((t) => html`<option value="${t.id}" ${t.id === value ? 'selected' : ''}>${t.label}</option>`)}</optgroup>`)}
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
  return html`${sheetHead('Edit item', `${sourceLabel(d)}${d.image?.kind === 'archive' ? ` · ${d.image.license} · ${d.image.author}` : ''}`)}
  <div class="sheet-body edit">
    <div class="edit-photo">
      <div class="img-wrap lg">${itemImg(d)}</div>
      <div class="stack">
        <label class="btn sm">${icon('camera')} ${d.image?.kind === 'photo' ? 'Replace photo' : 'Use my own photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" class="sr-only" data-change="editPhoto"></label>
        ${d.image?.kind !== 'illustration' ? html`<button type="button" class="btn sm ghost" data-act="editRevertImg">Use illustration instead</button>` : ''}
        ${d.image?.kind === 'archive' && d.image.pageUrl ? html`<a class="link small" href="${d.image.pageUrl}" target="_blank" rel="noopener noreferrer">Image source</a>` : ''}
        ${s.photoError ? html`<p class="error small" role="alert">${s.photoError}</p>` : ''}
        ${s.photoBusy ? html`<p class="muted small" role="status">Processing photo…</p>` : ''}
      </div>
    </div>
    <label class="block-label">Name<input type="text" maxlength="60" value="${d.name}" data-input="editName"></label>
    <label class="block-label">Type${typeSelect('editType', d.type)}</label>
    ${t.cuts.length > 1 ? html`<h4>Cut / fit</h4>${seg('editCut', t.cuts.map((c) => ({ id: c, label: cap(c) })), d.cut)}` : ''}
    <h4>Colour</h4>${swatches('editColor', d.color)}
    <h4>Pattern</h4>${seg('editPattern', PATTERNS, d.pattern)}
    <h4>Availability</h4>${seg('editStatus', [{ id: 'available', label: 'Available' }, { id: 'laundry', label: 'In laundry' }, { id: 'unavailable', label: 'Unavailable' }], d.status)}
    ${['top', 'dress', 'layer', 'outer'].includes(d.slot) ? html`<h4>Warmth ${hint('warmth')}</h4>${seg('editWarmth', [1, 2, 3, 4, 5].map((v) => ({ id: String(v), label: WARMTH_LABELS[v] })), String(d.warmth))}` : ''}
    <h4>Dressiness ${hint('formality')}</h4>
    <div class="row gap"><label>From<select data-change="editFmin">${FORMALITY.slice(1).map((f) => html`<option value="${f.v}" ${f.v === d.formality[0] ? 'selected' : ''}>${f.label}</option>`)}</select></label>
    <label>To<select data-change="editFmax">${FORMALITY.slice(1).map((f) => html`<option value="${f.v}" ${f.v === d.formality[1] ? 'selected' : ''}>${f.label}</option>`)}</select></label></div>
    ${['outer', 'shoes'].includes(d.slot) ? html`<h4>Water-resistant? ${hint('water')}</h4>${triSelect('editWater', d.water)}` : ''}
    ${d.slot === 'shoes' ? html`<h4>Comfortable for long walks? ${hint('walk')}</h4>${triSelect('editWalk', d.walk)}<h4>OK for cycling? ${hint('cycle')}</h4>${triSelect('editCycle', d.cycle)}` : ''}
    <p class="muted tiny">Warmth and water resistance can't be judged reliably from a picture — correct them if you know better.</p>
  </div>
  <footer class="sheet-foot row gap">
    <button type="button" class="btn danger ghost" data-act="editDelete">${s.confirmDelete ? 'Tap again to delete' : 'Delete'}</button>
    <button type="button" class="btn primary grow" data-act="editSave" ${s.photoBusy ? 'disabled' : ''}>Save</button>
  </footer>`;
};

SHEETS.addMenu = () => html`${sheetHead('Add clothes')}
  <div class="sheet-body"><div class="add-row col">
    <button type="button" class="add-opt" data-act="openStarter">${icon('grid')}<span><strong>Quick basics</strong><small>Pick a type, cut and colours</small></span></button>
    <button type="button" class="add-opt" data-act="openArchive">${icon('search')}<span><strong>Browse the archive</strong><small>Find an image closer to your item</small></span></button>
    <button type="button" class="add-opt" data-act="openUpload">${icon('camera')}<span><strong>Upload a photo</strong><small>Of the actual garment</small></span></button>
  </div></div>`;

SHEETS.upload = (s) => html`${sheetHead('Add from a photo', 'A clear photo on a plain background works best. It stays on this device.')}
  <div class="sheet-body">
    ${s.preview ? html`<div class="upload-preview"><img src="${s.preview}" alt="Your photo preview"></div>
      <label class="link small">Choose a different photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" class="sr-only" data-change="uploadFile"></label>`
    : html`<label class="dropzone">${icon('camera')}<strong>Choose or take a photo</strong><span class="muted small">JPEG, PNG or WebP · up to 12 MB</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" class="sr-only" data-change="uploadFile"></label>`}
    ${s.busy ? html`<p class="muted small" role="status">Processing…</p>` : ''}
    ${s.error ? html`<p class="error small" role="alert">${s.error}</p>` : ''}
    ${s.preview ? html`
      <label class="block-label">What is it?${typeSelect('upType', s.itemType, { required: true })}</label>
      ${s.itemType && TYPE[s.itemType].cuts.length > 1 ? html`<h4>Cut / fit</h4>${seg('upCut', TYPE[s.itemType].cuts.map((c) => ({ id: c, label: cap(c) })), s.cut)}` : ''}
      <h4>Colour ${s.colorSuggested ? html`<span class="est">suggested from your photo — check it</span>` : ''}</h4>
      ${swatches('upColor', s.color)}
      <h4>Pattern</h4>${seg('upPattern', PATTERNS, s.pattern)}
      <p class="muted tiny">Warmth, dressiness and practical details are prefilled from the type. You can refine them after adding.</p>` : ''}
  </div>
  ${s.preview ? html`<footer class="sheet-foot"><button type="button" class="btn primary block" data-act="uploadAdd" ${s.itemType ? '' : 'disabled'}>${s.itemType ? 'Add to my wardrobe' : 'Choose a type first'}</button></footer>` : ''}`;

// ---------------------------------------------------------------- archive
function viewArchive() {
  const A = S.archive;
  const prov = PROVIDERS.find((p) => p.id === A.provider);
  const typeOpts = TYPES.filter((t) => !A.slot || t.slot === A.slot);
  const t = A.type ? TYPE[A.type] : null;
  return html`<section class="pad archive">
    <header class="subhead"><button type="button" class="icon-btn" data-act="closeView" aria-label="Back">${icon('back')}</button>
      <div><p class="eyebrow">Add something you own</p><h1>Browse the archive</h1></div></header>
    ${seg('archProvider', [{ id: 'commons', label: 'Online: Wikimedia Commons' }, { id: 'library', label: 'Built-in illustrations' }], A.provider)}
    <p class="muted small">${prov.live
      ? 'Openly licensed photos from Wikimedia Commons, searched live. Results vary — pick the closest stand-in for your item. Credits are kept with each image.'
      : 'Offline illustrations bundled with this app (every type, cut and colour). This is not an online archive.'}</p>
    <form class="card filters" data-submit="archSearch">
      <div class="row gap wrap">
        <label>Category<select data-change="archSlot"><option value="">All</option>${SLOTS.map((s) => html`<option value="${s.id}" ${A.slot === s.id ? 'selected' : ''}>${s.label}</option>`)}</select></label>
        <label>Type<select data-change="archType"><option value="">Any</option>${typeOpts.map((x) => html`<option value="${x.id}" ${A.type === x.id ? 'selected' : ''}>${x.label}</option>`)}</select></label>
        ${t && t.cuts.length > 1 ? html`<label>Cut<select data-change="archCut"><option value="">Any</option>${t.cuts.map((c) => html`<option value="${c}" ${A.cut === c ? 'selected' : ''}>${cap(c)}</option>`)}</select></label>` : ''}
      </div>
      <h4>Colour ${A.color ? html`<button type="button" class="link small" data-act="archColor" data-v="${A.color}">clear</button>` : ''}</h4>
      ${swatches('archColor', A.color)}
      <div class="row gap"><label class="sr-only" for="arch-q">Search</label><input id="arch-q" class="grow" type="search" placeholder="${prov.live ? 'Or search, e.g. “corduroy jacket”' : 'Filter by name…'}" value="${A.query}" data-input="archQuery"><button class="btn primary" type="submit">Search</button></div>
    </form>
    ${A.status === 'loading' && !A.results.length ? html`<div class="arch-grid" role="status" aria-label="Loading">${Array.from({ length: 6 }, () => html`<div class="arch-card skeleton-card"></div>`)}</div>` : ''}
    ${A.status === 'error' ? html`<div class="card error-card" role="alert"><p>${A.error}</p><div class="row gap"><button type="button" class="btn sm" data-act="archSearchBtn">Try again</button><button type="button" class="btn sm" data-act="archProvider" data-v="library">Use built-in illustrations</button></div></div>` : ''}
    ${A.status === 'done' && !A.results.length ? html`<p class="muted empty-inline">No matches. Try fewer filters or a simpler search.</p>` : ''}
    ${A.status === 'idle' ? html`<p class="muted empty-inline">Choose filters and tap Search.</p>` : ''}
    ${A.results.length ? html`<div class="arch-grid">${A.results.map((r, i) => html`<button type="button" class="arch-card" data-act="archPick" data-i="${i}">
      ${r.illustration ? illustration(r.typeId, r.colorId, r.cut) : html`<img src="${r.thumb}" alt="${r.title}" loading="lazy" referrerpolicy="no-referrer">`}
      <span class="tiny">${r.illustration ? cap(r.title) : r.license}</span></button>`)}</div>
      ${A.nextOffset != null ? html`<button type="button" class="btn ghost block" data-act="archMore" ${A.status === 'loading' ? 'disabled' : ''}>${A.status === 'loading' ? 'Loading…' : 'Load more'}</button>` : ''}` : ''}
  </section>`;
}

SHEETS.archConfirm = (s) => {
  const r = s.result;
  const t = s.itemType ? TYPE[s.itemType] : null;
  return html`${sheetHead('Confirm your item', 'This adds a garment you own. The image is just a stand-in — swap in your own photo any time.')}
  <div class="sheet-body">
    <div class="upload-preview">${r.illustration ? illustration(s.itemType || r.typeId || 'tshirt', s.color || r.colorId || 'grey', s.cut, s.pattern) : html`<img src="${r.thumb}" alt="${r.title}" referrerpolicy="no-referrer">`}</div>
    ${!r.illustration ? html`<p class="muted tiny">“${r.title}” · ${r.author} · ${r.license} · <a href="${r.pageUrl}" target="_blank" rel="noopener noreferrer">source</a></p>` : ''}
    <label class="block-label">Type${typeSelect('acType', s.itemType, { required: true })}</label>
    ${t && t.cuts.length > 1 ? html`<h4>Cut / fit</h4>${seg('acCut', t.cuts.map((c) => ({ id: c, label: cap(c) })), s.cut)}` : ''}
    <h4>Colour of <em>your</em> item</h4>${swatches('acColor', s.color)}
    <h4>Pattern</h4>${seg('acPattern', PATTERNS, s.pattern)}
    <p class="owned-note">${icon('check')} Adds to <strong>My wardrobe</strong> as something I own — not a wishlist item.</p>
  </div>
  <footer class="sheet-foot"><button type="button" class="btn primary block" data-act="archAdd" ${s.itemType && s.color ? '' : 'disabled'}>${s.itemType && s.color ? 'Add to my wardrobe' : 'Choose type and colour'}</button></footer>`;
};

async function runArchive(more = false) {
  const A = S.archive;
  const prov = PROVIDERS.find((p) => p.id === A.provider);
  if (!more) { A.results = []; A.nextOffset = null; }
  A.status = 'loading'; A.error = null;
  render();
  const reqId = (runArchive.seq = (runArchive.seq || 0) + 1);
  try {
    const res = await prov.search({ query: A.query.trim(), slot: A.slot, type: A.type, cut: A.cut, color: A.color, offset: more ? A.nextOffset : 0 });
    if (reqId !== runArchive.seq) return;
    A.results = more ? [...A.results, ...res.results] : res.results;
    A.nextOffset = res.nextOffset;
    A.status = 'done';
  } catch (e) {
    if (reqId !== runArchive.seq) return;
    A.status = 'error'; A.error = e.message;
  }
  render();
}

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
    <div class="card"><h3>Temperature</h3>
      ${seg('setThermal', [{ id: 'cold', label: 'I feel cold easily' }, { id: 'neutral', label: 'Average' }, { id: 'warm', label: 'I run warm' }], p.thermal)}
      <p class="small">${lt === 0 ? html`<span class="muted">No adjustment learned yet. “Too cold / too warm” feedback tunes this.</span>` : html`Learned from feedback: suggestions are <strong>${lt > 0 ? 'warmer' : 'lighter'}</strong> than average (${lt > 0 ? '+' : ''}${lt.toFixed(1)}). <button type="button" class="link" data-act="resetThermal">Reset</button>`}</p>
    </div>
    <div class="card"><h3>Style</h3><p class="muted small">Gentle nudges, not rules.</p>${chips('toggleStyle', STYLE_OPTS, p.style)}
      <h4>Colours you like wearing</h4>${swatches('toggleFavColor', p.favoriteColors, { multi: true })}
      <h4>Never suggest</h4>${chips('toggleAvoid', TYPES.map((t) => ({ id: t.id, label: t.label })), p.avoidTypes)}
    </div>
    <div class="card"><h3>What I've learned</h3>
      ${offs.length ? html`<ul class="small">${offs.map(([k, v]) => html`<li>${PRESETS.find((x) => x.id === k)?.label || k}: aim ${v > 0 ? 'dressier' : 'more relaxed'} (${v > 0 ? '+' : ''}${v})</li>`)}</ul>` : ''}
      <p class="small muted">${pairs ? `${pairs} item pairings adjusted from your feedback.` : 'No combination feedback yet.'}</p>
      ${offs.length || pairs ? html`<button type="button" class="btn sm ghost" data-act="resetLearning">Reset learned preferences</button>` : ''}
    </div>
    <div class="card"><h3>Your data</h3>
      <p class="small">Everything is stored <strong>only in this browser on this device</strong> (wardrobe and feedback in local storage, photos in IndexedDB). There's no account and no sync, so clearing site data or switching devices loses it — export a backup if needed. Weather requests send only the city coordinates to Open-Meteo; archive searches send your search terms to Wikimedia.</p>
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
    if (S.sheet?.type === 'upload' && S.sheet.preview) URL.revokeObjectURL(S.sheet.preview);
    S.sheet = null; render();
  },
  closeView() { S.view = null; if (S.today.weather.status === 'ok') computeResults(); render(); window.scrollTo(0, 0); },

  // onboarding
  startOnboard() { S.onboardStep = 'starter'; S.starter = { idx: 0, mode: 'onboard' }; render(); },
  onboardBack() { S.onboardStep = 'starter'; S.starter.idx = STARTER_SLOTS.length - 1; render(); },
  finishOnboard() { db.prefs.onboarded = true; save(); S.tab = 'today'; render(); window.scrollTo(0, 0); },
  starterNext() {
    if (S.starter.idx < STARTER_SLOTS.length - 1) S.starter.idx++;
    else S.onboardStep = 'prefs';
    render(); window.scrollTo(0, 0);
  },
  starterPrev() { if (S.starter.idx > 0) S.starter.idx--; else S.onboardStep = 'welcome'; render(); window.scrollTo(0, 0); },
  starterGo(el) { S.starter.idx = +el.dataset.i; render(); },
  openStarter() { S.sheet = null; S.view = 'starter'; S.starter = { idx: 0, mode: 'add' }; render(); window.scrollTo(0, 0); },
  openStarterSlot(el) {
    const i = STARTER_SLOTS.indexOf(el.dataset.v);
    S.sheet = null; S.view = 'starter'; S.starter = { idx: Math.max(0, i), mode: 'add' }; render(); window.scrollTo(0, 0);
  },
  openQuick(el) {
    const t = TYPE[el.dataset.type];
    if (!t) return;
    S.sheet = { type: 'quick', typeId: t.id, cut: t.defaultCut || t.cuts[0], colors: [], pattern: 'solid' }; render();
  },
  quickCut(el) { S.sheet.cut = el.dataset.v; render(); },
  quickPattern(el) { S.sheet.pattern = el.dataset.v; render(); },
  quickColor(el) { const c = S.sheet.colors; const v = el.dataset.v; S.sheet.colors = c.includes(v) ? c.filter((x) => x !== v) : [...c, v]; render(); },
  quickAdd() {
    const s = S.sheet;
    s.colors.forEach((c) => createItem({ type: s.typeId, color: c, cut: s.cut, pattern: s.pattern }));
    toast(`Added ${s.colors.length} ${TYPE[s.typeId].label.toLowerCase()}${s.colors.length > 1 ? 's' : ''} to your wardrobe`);
    S.sheet = null;
    if (S.today.weather.status === 'ok') computeResults();
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
  openEdit(el) {
    const it = getItem(el.dataset.id);
    S.sheet = { type: 'edit', id: it.id, draft: JSON.parse(JSON.stringify(it)), newPhotos: [] };
    render();
  },
  editType(el) {
    const d = S.sheet.draft;
    const t = TYPE[el.value];
    const defs = defaultItemFields(t.id);
    const est = d.estimated || {};
    d.type = t.id; d.slot = t.slot;
    if (!t.cuts.includes(d.cut)) d.cut = defs.cut;
    for (const k of ['warmth', 'formality', 'water', 'walk', 'cycle']) if (est[k] !== false) d[k] = defs[k];
    render();
  },
  editCut(el) { S.sheet.draft.cut = el.dataset.v; render(); },
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
      s.draft.image = { kind: 'photo', photoId };
    } catch (e) {
      s.photoError = e.message;
    }
    s.photoBusy = false;
    render();
  },
  editRevertImg() {
    const d = S.sheet.draft;
    d.image = d.image?.kind === 'photo' && d.prevImage?.kind === 'archive' ? d.prevImage : { kind: 'illustration' };
    render();
  },
  async editSave() {
    const s = S.sheet;
    const it = getItem(s.id);
    const d = s.draft;
    const oldPhoto = it.image?.kind === 'photo' ? it.image.photoId : null;
    const newPhoto = d.image?.kind === 'photo' ? d.image.photoId : null;
    // Remove photo blobs no longer referenced.
    for (const id of s.newPhotos) if (id !== newPhoto) await deletePhoto(id);
    if (oldPhoto && oldPhoto !== newPhoto) await deletePhoto(oldPhoto);
    if (!d.name.trim()) d.name = itemName(d.type, d.color, d.cut);
    if (d.image?.kind !== 'photo') delete d.prevImage;
    Object.assign(it, d, { name: d.name.trim().slice(0, 60) });
    save();
    S.sheet = null;
    toast('Saved');
    if (S.today.weather.status === 'ok') computeResults();
    render();
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

  // upload
  openUpload() { S.sheet = { type: 'upload', preview: null, blob: null, itemType: '', cut: '', color: 'grey', pattern: 'solid' }; render(); },
  async uploadFile(el) {
    const s = S.sheet;
    s.error = null; s.busy = true; render();
    try {
      const res = await processUpload(el.files?.[0]);
      if (s.preview) URL.revokeObjectURL(s.preview);
      s.preview = res.previewUrl; s.blob = res.blob;
      s.color = nearestColor(...res.avg).id; s.colorSuggested = true;
    } catch (e) { s.error = e.message; }
    s.busy = false;
    render();
  },
  upType(el) { const t = TYPE[el.value]; S.sheet.itemType = t ? t.id : ''; S.sheet.cut = t ? t.defaultCut || t.cuts[0] : ''; render(); },
  upCut(el) { S.sheet.cut = el.dataset.v; render(); },
  upColor(el) { S.sheet.color = el.dataset.v; S.sheet.colorSuggested = false; render(); },
  upPattern(el) { S.sheet.pattern = el.dataset.v; render(); },
  async uploadAdd() {
    const s = S.sheet;
    try {
      const photoId = await putPhoto(s.blob);
      const it = createItem({ type: s.itemType, color: s.color, cut: s.cut, pattern: s.pattern, image: { kind: 'photo', photoId } });
      URL.revokeObjectURL(s.preview);
      S.sheet = null;
      S.tab = 'wardrobe'; S.view = null;
      toast(`Added your ${it.name}. Tap it to refine details.`);
    } catch (e) {
      s.error = `Couldn't save the photo: ${e.message}`;
    }
    render();
  },

  // archive
  openArchive() { S.sheet = null; S.view = 'archive'; render(); window.scrollTo(0, 0); },
  archProvider(el) { S.archive.provider = el.dataset.v; S.archive.results = []; S.archive.status = 'idle'; S.archive.error = null; runArchive(); },
  archSlot(el) { const A = S.archive; A.slot = el.value; if (A.type && TYPE[A.type].slot !== A.slot && A.slot) { A.type = ''; A.cut = ''; } render(); },
  archType(el) { const A = S.archive; A.type = el.value; A.cut = ''; if (A.type) A.slot = TYPE[A.type].slot; render(); },
  archCut(el) { S.archive.cut = el.value; render(); },
  archColor(el) { S.archive.color = S.archive.color === el.dataset.v ? '' : el.dataset.v; render(); },
  archSearchBtn() { runArchive(); },
  archMore() { runArchive(true); },
  archPick(el) {
    const r = S.archive.results[+el.dataset.i];
    const type = r.typeId || S.archive.type || '';
    S.sheet = { type: 'archConfirm', result: r, itemType: type, cut: r.cut || (type ? TYPE[type].defaultCut || TYPE[type].cuts[0] : ''), color: r.colorId || S.archive.color || '', pattern: 'solid' };
    render();
  },
  acType(el) { const t = TYPE[el.value]; S.sheet.itemType = t ? t.id : ''; if (t && !t.cuts.includes(S.sheet.cut)) S.sheet.cut = t.defaultCut || t.cuts[0]; render(); },
  acCut(el) { S.sheet.cut = el.dataset.v; render(); },
  acColor(el) { S.sheet.color = el.dataset.v; render(); },
  acPattern(el) { S.sheet.pattern = el.dataset.v; render(); },
  archAdd() {
    const s = S.sheet;
    const r = s.result;
    const image = r.illustration ? { kind: 'illustration' } : { kind: 'archive', thumb: r.thumb, source: 'Wikimedia Commons', license: r.license, author: r.author, pageUrl: r.pageUrl, title: r.title };
    const it = createItem({ type: s.itemType, color: s.color, cut: s.cut, pattern: s.pattern, image });
    S.sheet = null;
    toast(`Added your ${it.name}`);
    render();
  },

  // wishlist
  addWish(el) {
    db.wishlist.push({ id: uid('wl'), type: el.dataset.type, text: el.dataset.text, createdAt: Date.now() });
    save(); toast('Saved to your wishlist (in Wardrobe). It won’t appear in outfits.'); render();
  },
  wishOwned(el) {
    const w = db.wishlist.find((x) => x.id === el.dataset.id);
    db.wishlist = db.wishlist.filter((x) => x.id !== w.id); save();
    S.sheet = { type: 'quick', typeId: w.type, cut: TYPE[w.type].defaultCut || TYPE[w.type].cuts[0], colors: [], pattern: 'solid' };
    render();
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
  archSearch() { runArchive(); },
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
  archQuery(el) { S.archive.query = el.value; },
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
// Archive images that fail to load (offline, removed) fall back to an illustration.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName === 'IMG' && el.dataset.fallback) {
    const it = getItem(el.dataset.fallback) || S.sheet?.draft;
    if (it) el.outerHTML = toString(illustration(it.type, it.color, it.cut, it.pattern, el.className.replace('item-img', '')));
  }
}, true);

// ---------------------------------------------------------------- boot
(async function boot() {
  try { await loadPhotos(); } catch (e) { console.warn('Photos unavailable', e); }
  render();
})();
