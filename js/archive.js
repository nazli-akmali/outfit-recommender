// Catalogue search.
//  1) curatedSearch: the curated starter catalogue (js/starter-catalog.js),
//     matched on garment structure — type, then cut, then length — before
//     colour. Results are never called exact; differences are spelled out.
//  2) commonsProvider: a supplementary online archive (Wikimedia Commons).
//     Community photos, not a product catalogue, so every result passes
//     metadata and pixel quality checks before it is shown.
// A licensed retail/catalogue API would be another provider beside these.
import { TYPES, TYPE, COLOR, COLORS, SLOTS, typeRank } from './catalog.js';
import { EXAMPLES } from './starter-catalog.js';

// ---------------------------------------------------------------- query parsing
const singular = (w) => (w.length > 3 && !/(ss|us|is|jeans|shorts|chinos|leggings|joggers|trousers|sneakers|loafers|flats|sandals|boots)$/.test(w) ? w.replace(/s$/, '') : w);

// Multi-word phrases are joined first so "wide leg" and "light blue" read as one word.
const PHRASES = [
  ['wide leg', 'wide-leg'], ['v neck', 'v-neck'], ['lace up', 'lace-up'], ['low top', 'low-top'], ['a line', 'a-line'],
  ['fine knit', 'fine-knit'], ['turtle neck', 'turtleneck'], ['crew neck', 'crew'], ['polo neck', 'turtleneck'],
  ['t shirt', 'tshirt'], ['t-shirt', 'tshirt'], ['long sleeve', 'longsleeve'], ['long-sleeve', 'longsleeve'], ['button up', 'shirt'], ['button down', 'shirt'],
  ['rain jacket', 'raincoat'], ['denim jacket', 'denim_jacket'], ['jean jacket', 'denim_jacket'], ['leather jacket', 'leather_jacket'],
  ['trench coat', 'trench'], ['wool coat', 'wool_coat'], ['puffer jacket', 'puffer'], ['running shoe', 'running'], ['dress shoe', 'dress_shoes'],
  ['ankle boot', 'boots'], ['ballet flat', 'flats'], ['knee length', 'knee'], ['ankle length', 'cropped'],
];
const COLOR_WORDS = { blue: 'blue', grey: 'grey', gray: 'grey', 'mid grey': 'grey', 'light gray': 'lightgrey', 'dark gray': 'charcoal', ivory: 'offwhite', 'off white': 'offwhite', 'off-white': 'offwhite', tan: 'camel', maroon: 'burgundy', multicolor: 'multi', multicolour: 'multi', 'multi-colour': 'multi', 'medium blue': 'blue', 'mid blue': 'blue', 'dark blue': 'navy', 'light wash': 'lightdenim', 'mid wash': 'denim', 'dark wash': 'darkdenim', 'dark grey': 'charcoal' };
const PATTERN_WORDS = { striped: 'striped', stripe: 'striped', stripy: 'striped', checked: 'checked', check: 'checked', plaid: 'checked', tartan: 'checked', gingham: 'checked', floral: 'printed', print: 'printed', printed: 'printed', patterned: 'printed' };
const CUT_WORDS = { tight: 'skinny', flared: 'bootcut', flare: 'bootcut', loose: 'baggy', boxy: 'oversized', heel: 'heels', 'v-neck': 'v-neck', crewneck: 'crew' };
const LENGTH_WORDS = { mini: 'mini', midi: 'midi', maxi: 'maxi', cropped: 'cropped', ankle: 'cropped', knee: 'knee', long: 'long', short: 'short' };
const SLOT_WORDS = { top: 'top', tops: 'top', bottom: 'bottom', trouser: 'bottom', pant: 'bottom', knitwear: 'layer', knit: 'layer', jacket: 'outer', coat: 'outer', outerwear: 'outer', shoe: 'shoes', shoes: 'shoes', footwear: 'shoes', dress: 'dress' };

const ALL_CUTS = new Set(TYPES.flatMap((t) => t.cuts));
// Generic words (shoe, jacket, top…) point to a category, not one type.
const GENERIC = new Set(['shoe', 'shoes', 'top', 'jacket', 'coat', 'simple', 'casual', 'light', 'long', 'sleeve', 'shirt-', 'running']);
const typeWords = (t) => new Set(`${t.id} ${t.label} ${t.aka || ''}`.toLowerCase().replace(/[^a-z_\- ]/g, ' ').split(/\s+/).filter((w) => w && !GENERIC.has(w)));
const TYPE_WORDS = Object.fromEntries(TYPES.map((t) => [t.id, typeWords(t)]));
const typeHas = (id, w) => { const s = TYPE_WORDS[id]; return s.has(w) || s.has(`${w}s`) || s.has(w.replace(/s$/, '')); };

// Returns the structure found in free text plus any words it couldn't place.
export function parseQuery(q) {
  let text = ` ${(q || '').toLowerCase().replace(/[^a-z0-9\- ]/g, ' ').replace(/\s+/g, ' ')} `;
  const out = {};
  const colorPhrases = [...COLORS.map((c) => [c.label.toLowerCase(), c.id]), ...Object.entries(COLOR_WORDS)].sort((a, b) => b[0].length - a[0].length);
  for (const [w, id] of colorPhrases) {
    if (text.includes(` ${w} `)) { out.color = id; text = text.replace(` ${w} `, ' '); break; }
  }
  for (const [a, b] of PHRASES) text = text.replaceAll(` ${a} `, ` ${b} `).replaceAll(` ${a}s `, ` ${b} `);
  const words = text.trim().split(' ').filter(Boolean);
  const rest = [];
  for (const raw of words) {
    const w = singular(raw);
    if (TYPE[raw] && raw.includes('_')) { (out.types ||= new Set()).add(raw); continue; }
    if (PATTERN_WORDS[w]) { out.pattern = PATTERN_WORDS[w]; continue; }
    if (ALL_CUTS.has(w) && w !== 'regular') { out.cut = w; continue; }
    if (CUT_WORDS[w]) { out.cut = CUT_WORDS[w]; continue; }
    if (LENGTH_WORDS[w] && !(w === 'long' && words.includes('longsleeve'))) { out.length = LENGTH_WORDS[w]; continue; }
    rest.push(w);
  }
  // Type: the types whose vocabulary covers the most remaining words.
  const ignored = [];
  let best = 0, types = out.types ? [...out.types] : [];
  if (!types.length) {
    // A word that is the type's own id ("dress", "shirt") outranks a shared word.
    const scores = TYPES.map((t) => [t.id, rest.reduce((n, w) => n + (typeHas(t.id, w) ? (w === t.id ? 1.5 : 1) : 0), 0)]);
    best = Math.max(0, ...scores.map((s) => s[1]));
    if (best) types = scores.filter((s) => s[1] === best).map((s) => s[0]);
  }
  for (const w of rest) {
    if (types.some((id) => typeHas(id, w))) continue;
    if (SLOT_WORDS[w]) { out.slot = SLOT_WORDS[w]; continue; }
    ignored.push(w);
  }
  if (types.length) out.types = types;
  out.ignored = ignored;
  return out;
}

// ---------------------------------------------------------------- curated catalogue
// filters: { slot, type, types, cut, length, color, pattern, ignored, query,
// hidden }. Explicit filters win over words in the query. Returns:
//   close   — type, cut and length all fit what was asked
//   similar — right type, but a different cut or length (labelled)
export function curatedSearch(filters, collection) {
  const parsed = parseQuery(filters.query);
  const slot = filters.slot || parsed.slot || '';
  const types = filters.type ? [filters.type] : filters.types?.length ? filters.types : parsed.types || [];
  const ignored = [...(filters.ignored || []), ...parsed.ignored];
  const cut = filters.cut || parsed.cut || '';
  const length = filters.length || parsed.length || '';
  const color = filters.color || parsed.color || '';
  const pattern = filters.pattern || parsed.pattern || '';
  // Words that matched nothing, and no structure at all: say so rather than show everything.
  const unplaced = ignored.length && !types.length && !cut && !slot;
  const hidden = new Set(filters.hidden || []);
  const close = [], similar = [];
  if (!unplaced) {
    for (const e of EXAMPLES) {
      if (hidden.has(e.id)) continue;
      const t = TYPE[e.type];
      if (slot && t.slot !== slot) continue;
      if (types.length && !types.includes(e.type)) continue;
      // A cut with no type only makes sense for types that have that cut.
      if (!types.length && cut && !t.cuts.includes(cut)) continue;
      const diffs = [];
      if (cut && e.cut !== cut) diffs.push({ field: 'cut', want: cut, have: e.cut });
      if (length && t.lengths && e.length !== length) diffs.push({ field: 'length', want: length, have: e.length });
      // Cuts and lengths are listed narrow-to-wide / short-to-long, so the index
      // distance ranks "baggy" nearer to "wide-leg" than "skinny" is.
      const dist = (list, a, b) => (list?.includes(a) && list.includes(b) ? Math.abs(list.indexOf(a) - list.indexOf(b)) * 0.2 : 0.6);
      const score = -typeRank(t, collection) * 0.5 + (color && e.colors.includes(color) ? 0.3 : 0)
        - diffs.reduce((s, d) => s + (d.field === 'cut' ? 3 + dist(t.cuts, d.want, d.have) : 2 + dist(t.lengths, d.want, d.have)), 0);
      const r = { example: e, diffs, score, color: color || e.colors[0], pattern: pattern || 'solid' };
      (diffs.length ? similar : close).push(r);
    }
  }
  const byScore = (a, b) => b.score - a.score;
  return {
    close: close.sort(byScore),
    similar: similar.sort(byScore).slice(0, 8),
    applied: { slot, type: types.length === 1 ? types[0] : '', types, cut, length, color, pattern },
    ignored,
  };
}

// ---------------------------------------------------------------- online archive
function stripTags(s) {
  const d = new DOMParser().parseFromString(s, 'text/html');
  return (d.body.textContent || '').trim().slice(0, 80);
}

// Titles that usually mean a person, a scene, artwork or advertising rather
// than one garment on its own.
const UNSUITABLE = /\b(collage|logo|advert|advertisement|poster|catwalk|runway|fashion show|street|crowd|people|portrait|wearing|wears|worn by|model|festival|parade|map|diagram|drawing|painting|illustration|engraving|sketch|pattern book|shop window|store|market|cartoon|icon)\b/i;

// Pixel check on a small copy: the border must be close to one plain colour,
// and the centre must differ from it (something is actually there).
function pixelCheck(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const done = (v) => { clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => done({ ok: false, reason: 'timeout' }), 8000);
    img.onerror = () => done({ ok: false, reason: 'unreadable' });
    img.onload = () => {
      try {
        const n = 48;
        const c = document.createElement('canvas');
        c.width = n; c.height = n;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        const border = [], center = [];
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const i = (y * n + x) * 4;
          const px = [d[i], d[i + 1], d[i + 2]];
          if (x < 3 || y < 3 || x >= n - 3 || y >= n - 3) border.push(px);
          else if (x > n / 4 && x < (3 * n) / 4 && y > n / 4 && y < (3 * n) / 4) center.push(px);
        }
        const mean = [0, 1, 2].map((k) => border.reduce((s, p) => s + p[k], 0) / border.length);
        const dist = (p) => Math.hypot(p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]);
        const spread = Math.sqrt(border.reduce((s, p) => s + dist(p) ** 2, 0) / border.length);
        const filled = center.filter((p) => dist(p) > 40).length / center.length;
        if (spread > 30) return done({ ok: false, reason: 'busy background' });
        if (filled < 0.25) return done({ ok: false, reason: 'garment not clearly visible' });
        done({ ok: true });
      } catch {
        done({ ok: false, reason: 'unreadable' });
      }
    };
    img.src = url;
  });
}

export const commonsProvider = {
  id: 'commons',
  label: 'Online archive (Wikimedia Commons)',
  live: true,
  async search({ query, type, cut, color, offset = 0, reported = [] }) {
    const parts = [];
    if (query) parts.push(query);
    else {
      if (color) parts.push(COLOR[color].label.toLowerCase());
      if (cut && !['regular', 'crew'].includes(cut)) parts.push(cut);
      parts.push(type ? TYPE[type].q : 'clothing');
    }
    const term = `${parts.join(' ')} filetype:bitmap`;
    const params = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrnamespace: '6', gsrsearch: term, gsrlimit: '30', gsroffset: String(offset),
      prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '360',
      iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription',
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res;
    try {
      res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: ctrl.signal });
    } catch {
      throw new Error("Couldn't reach Wikimedia Commons. The curated catalog still works offline.");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`Wikimedia Commons returned an error (${res.status}).`);
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
    // The garment word must appear in the title or description.
    const needWords = type ? [...TYPE_WORDS[type], ...TYPE[type].q.split(' ')].filter((w) => w.length > 3) : (query || '').toLowerCase().split(/\s+/).map(singular).filter((w) => w.length > 3 && !COLORS.some((c) => c.label.toLowerCase() === w));
    const hidden = { metadata: 0, pixels: 0, reported: 0 };
    const candidates = [];
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl || !/image\/(jpeg|png|webp)/.test(ii.mime)) { hidden.metadata++; continue; }
      const md = ii.extmetadata || {};
      const title = p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ');
      const desc = stripTags(md.ImageDescription?.value || '');
      const id = `commons:${p.pageid}`;
      if (reported.includes(id)) { hidden.reported++; continue; }
      const ratio = ii.width / ii.height;
      const text = `${title} ${desc}`.toLowerCase();
      if (Math.min(ii.width, ii.height) < 300 || ratio < 0.45 || ratio > 1.7 || UNSUITABLE.test(text) || (needWords.length && !needWords.some((w) => text.includes(w)))) { hidden.metadata++; continue; }
      candidates.push({
        id, title, thumb: ii.thumburl, url: ii.thumburl,
        license: md.LicenseShortName?.value || 'See source',
        author: stripTags(md.Artist?.value || 'Unknown'),
        pageUrl: ii.descriptionurl,
        typeId: type || null, colorId: color || null, cut: cut || null,
      });
    }
    const checks = await Promise.all(candidates.map((r) => pixelCheck(r.thumb)));
    const results = candidates.filter((r, i) => checks[i].ok || (hidden.pixels++, false));
    return { results, hidden, nextOffset: data.continue?.gsroffset ?? null, provider: this.id };
  },
};

export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.step]));
