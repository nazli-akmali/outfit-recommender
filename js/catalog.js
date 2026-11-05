// Garment types, colours and the built-in illustration library.
// Defaults here are *typical* values for a type; items mark them as
// estimated until the user confirms or edits them.
import { raw } from './html.js';

export const SLOTS = [
  { id: 'top', label: 'Tops', step: 'Tops & shirts' },
  { id: 'bottom', label: 'Bottoms', step: 'Jeans, trousers & skirts' },
  { id: 'dress', label: 'Dresses', step: 'Dresses' },
  { id: 'layer', label: 'Layers', step: 'Knitwear & layers' },
  { id: 'outer', label: 'Outerwear', step: 'Jackets & coats' },
  { id: 'shoes', label: 'Shoes', step: 'Shoes' },
];

export const FORMALITY = [
  null,
  { v: 1, label: 'Relaxed / sporty' },
  { v: 2, label: 'Casual' },
  { v: 3, label: 'Smart casual' },
  { v: 4, label: 'Smart / business' },
  { v: 5, label: 'Formal' },
];

export const WARMTH_LABELS = [null, 'Very light', 'Light', 'Medium', 'Warm', 'Very warm'];

// warmth: 1-5 level. legs: leg coverage/warmth 1-3 for bottoms, dresses & shoes.
// water/walk/cycle: 'yes' | 'no' | 'unknown' typical defaults.
// cuts: shape or fit. lengths (optional): hem length, kept separate from the cut
// so "wide-leg" and "cropped" can be chosen independently.
// q: search term for the online archive. aka: extra words for text search.
// coll: 'w' | 'm' when a type is mainly from one collection (used only for
// ordering, never to hide anything). cutColl does the same per cut.
// cutLabels/lengthLabels: display names. cutWarmth: typical warmth per cut.
export const TYPES = [
  // Tops
  { id: 'tshirt', slot: 'top', label: 'T-shirt', warmth: 2, f: [1, 3], cuts: ['regular', 'oversized', 'fitted'], q: 't-shirt', aka: 'tee tshirt', starter: ['white', 'black', 'grey'] },
  { id: 'longsleeve', slot: 'top', label: 'Long-sleeve top', warmth: 3, f: [1, 3], cuts: ['regular', 'fitted'], q: 'long sleeve shirt', aka: 'longsleeve long-sleeve', starter: ['white', 'black'] },
  { id: 'shirt', slot: 'top', label: 'Button-up shirt', warmth: 3, f: [2, 5], cuts: ['regular', 'oversized', 'fitted'], q: 'dress shirt', aka: 'oxford button-down', starter: ['white', 'lightblue'] },
  { id: 'blouse', slot: 'top', coll: 'w', label: 'Simple top / blouse', warmth: 2, f: [2, 4], cuts: ['regular', 'fitted'], q: 'blouse', aka: 'top', starter: ['white', 'cream', 'black'] },
  { id: 'tank', slot: 'top', coll: 'w', label: 'Tank / camisole', warmth: 1, f: [1, 3], cuts: ['regular', 'fitted'], q: 'tank top', aka: 'vest cami sleeveless', starter: ['white', 'black'] },
  { id: 'polo', slot: 'top', label: 'Polo shirt', warmth: 2, f: [1, 3], cuts: ['regular'], q: 'polo shirt', starter: ['navy', 'white'] },
  // Bottoms
  { id: 'jeans', slot: 'bottom', label: 'Jeans', warmth: 3, legs: 3, f: [1, 3], cuts: ['skinny', 'slim', 'straight', 'bootcut', 'wide-leg', 'baggy'], lengths: ['full', 'cropped'], q: 'jeans', aka: 'denim trousers pants', starter: ['denim', 'lightdenim', 'black'], defaultCut: 'straight' },
  { id: 'trousers', slot: 'bottom', label: 'Tailored trousers', warmth: 3, legs: 3, f: [3, 5], cuts: ['slim', 'straight', 'wide-leg'], lengths: ['full', 'cropped'], q: 'trousers', aka: 'pants slacks suit', starter: ['black', 'charcoal', 'beige'], defaultCut: 'straight' },
  { id: 'chinos', slot: 'bottom', label: 'Chinos / casual trousers', warmth: 3, legs: 3, f: [2, 4], cuts: ['slim', 'straight', 'wide-leg'], lengths: ['full', 'cropped'], q: 'chino trousers', aka: 'pants khakis', starter: ['beige', 'navy', 'olive'], defaultCut: 'straight' },
  { id: 'joggers', slot: 'bottom', label: 'Joggers', warmth: 3, legs: 3, f: [1, 1], cuts: ['regular'], q: 'sweatpants', aka: 'sweatpants tracksuit trousers', starter: ['grey', 'black'] },
  { id: 'shorts', slot: 'bottom', label: 'Shorts', warmth: 1, legs: 1, f: [1, 2], cuts: ['regular'], lengths: ['short', 'knee'], lengthLabels: { knee: 'Knee-length' }, q: 'shorts', aka: 'bermuda', starter: ['denim', 'beige'] },
  { id: 'skirt', slot: 'bottom', coll: 'w', label: 'Skirt', warmth: 2, legs: 1, f: [1, 4], cuts: ['a-line', 'pencil', 'pleated'], lengths: ['mini', 'midi', 'maxi'], defaultLength: 'midi', q: 'skirt', starter: ['black', 'denim'] },
  { id: 'leggings', slot: 'bottom', coll: 'w', label: 'Leggings', warmth: 2, legs: 2, f: [1, 1], cuts: ['regular'], q: 'leggings', aka: 'tights', starter: ['black'] },
  // Dresses
  { id: 'dress', slot: 'dress', coll: 'w', label: 'Dress', warmth: 2, legs: 1, f: [2, 4], cuts: ['shift', 'a-line', 'wrap', 'slip'], lengths: ['mini', 'midi', 'maxi'], defaultLength: 'midi', defaultCut: 'a-line', q: 'dress', aka: 'frock', starter: ['black', 'navy'] },
  // Layers
  { id: 'hoodie', slot: 'layer', label: 'Hoodie', warmth: 3, f: [1, 1], cuts: ['regular', 'oversized'], q: 'hoodie', aka: 'hooded sweatshirt', starter: ['grey', 'black'] },
  { id: 'sweatshirt', slot: 'layer', label: 'Sweatshirt', warmth: 3, f: [1, 2], cuts: ['regular', 'oversized'], q: 'sweatshirt', aka: 'crewneck', starter: ['grey', 'navy'] },
  { id: 'sweater', slot: 'layer', label: 'Sweater / jumper', warmth: 4, f: [1, 4], cuts: ['crew', 'v-neck', 'turtleneck'], cutLabels: { crew: 'Crew neck' }, q: 'sweater', aka: 'jumper pullover knit knitwear', starter: ['cream', 'navy', 'black'], defaultCut: 'crew' },
  { id: 'cardigan', slot: 'layer', label: 'Cardigan', warmth: 2, f: [1, 4], cuts: ['fine-knit', 'chunky'], cutLabels: { 'fine-knit': 'Fine knit', chunky: 'Chunky knit' }, cutWarmth: { chunky: 3 }, lengths: ['cropped', 'regular', 'long'], lengthLabels: { regular: 'Hip length' }, defaultLength: 'regular', q: 'cardigan', aka: 'knit knitwear', starter: ['beige', 'black', 'grey'] },
  { id: 'blazer', slot: 'layer', label: 'Blazer', warmth: 2, f: [3, 5], cuts: ['regular', 'oversized'], q: 'blazer', aka: 'suit jacket sport coat', starter: ['black', 'navy', 'beige'] },
  // Outerwear
  { id: 'denim_jacket', slot: 'outer', label: 'Denim jacket', warmth: 2, f: [1, 2], cuts: ['regular', 'oversized'], q: 'denim jacket', aka: 'jean jacket trucker', starter: ['denim'] },
  { id: 'light_jacket', slot: 'outer', label: 'Light jacket / bomber', warmth: 2, f: [1, 3], cuts: ['regular'], q: 'bomber jacket', aka: 'bomber windbreaker', starter: ['black', 'olive'], water: 'unknown' },
  { id: 'leather_jacket', slot: 'outer', label: 'Leather jacket', warmth: 3, f: [1, 3], cuts: ['regular'], q: 'leather jacket', aka: 'biker', starter: ['black'], water: 'unknown' },
  { id: 'rain_jacket', slot: 'outer', label: 'Rain jacket', warmth: 1, f: [1, 2], cuts: ['regular'], q: 'raincoat', aka: 'raincoat waterproof anorak', starter: ['navy', 'yellow', 'black'], water: 'yes' },
  { id: 'trench', slot: 'outer', label: 'Trench coat', warmth: 3, f: [2, 5], cuts: ['regular', 'oversized'], lengths: ['short', 'long'], lengthLabels: { short: 'Thigh length', long: 'Knee length or longer' }, defaultLength: 'long', q: 'trench coat', aka: 'mac', starter: ['beige'], water: 'unknown' },
  { id: 'wool_coat', slot: 'outer', label: 'Wool coat', warmth: 4, f: [2, 5], cuts: ['regular', 'oversized'], lengths: ['short', 'long'], lengthLabels: { short: 'Thigh length', long: 'Knee length or longer' }, defaultLength: 'long', q: 'overcoat', aka: 'overcoat winter coat', starter: ['camel', 'black', 'charcoal'] },
  { id: 'puffer', slot: 'outer', label: 'Puffer jacket', warmth: 5, f: [1, 2], cuts: ['regular'], lengths: ['cropped', 'regular', 'long'], lengthLabels: { regular: 'Hip length' }, defaultLength: 'regular', q: 'down jacket', aka: 'down padded quilted winter', starter: ['black'], water: 'unknown' },
  // Shoes
  { id: 'sneakers', slot: 'shoes', label: 'Sneakers', warmth: 3, legs: 3, f: [1, 3], cuts: ['low-top', 'chunky'], q: 'sneakers', aka: 'trainers', starter: ['white', 'black'], walk: 'yes', cycle: 'yes' },
  { id: 'running', slot: 'shoes', label: 'Trainers / running shoes', warmth: 3, legs: 3, f: [1, 1], cuts: ['regular'], q: 'running shoes', aka: 'trainers runners', starter: ['grey'], walk: 'yes', cycle: 'yes' },
  { id: 'loafers', slot: 'shoes', label: 'Loafers', warmth: 3, legs: 2, f: [2, 5], cuts: ['regular', 'chunky'], q: 'loafers', starter: ['black', 'brown'], walk: 'unknown', cycle: 'yes' },
  { id: 'boots', slot: 'shoes', label: 'Ankle boots', warmth: 4, legs: 3, f: [1, 4], cuts: ['chelsea', 'lace-up', 'heeled'], cutColl: { heeled: 'w' }, q: 'ankle boots', aka: 'boot', starter: ['black', 'brown'], walk: 'yes', cycle: 'yes', water: 'unknown' },
  { id: 'dress_shoes', slot: 'shoes', label: 'Dress shoes / heels', warmth: 2, legs: 2, f: [4, 5], cuts: ['heels', 'oxford', 'flat'], cutColl: { heels: 'w', oxford: 'm' }, q: 'pumps shoes', aka: 'pumps formal shoes brogues', starter: ['black'], walk: 'no', cycle: 'no' },
  { id: 'flats', slot: 'shoes', coll: 'w', label: 'Ballet flats', warmth: 2, legs: 1, f: [2, 4], cuts: ['regular'], q: 'ballet flats', aka: 'ballerinas pumps', starter: ['black', 'beige'], walk: 'unknown', cycle: 'yes' },
  { id: 'sandals', slot: 'shoes', label: 'Sandals', warmth: 1, legs: 1, f: [1, 3], cuts: ['flat', 'heeled'], cutColl: { heeled: 'w' }, q: 'sandals', aka: 'sliders slides', starter: ['brown', 'black'], walk: 'unknown', cycle: 'unknown' },
];

export const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));

// Curated starter basics, in display order per category. Everything else is
// one tap away in the full catalogue.
export const STARTER_BASICS = {
  top: ['tshirt', 'longsleeve', 'shirt', 'blouse', 'polo'],
  bottom: ['jeans', 'chinos', 'trousers', 'skirt', 'shorts'],
  dress: ['dress'],
  layer: ['sweater', 'cardigan', 'hoodie', 'blazer'],
  outer: ['denim_jacket', 'rain_jacket', 'wool_coat', 'puffer'],
  shoes: ['sneakers', 'boots', 'loafers', 'flats', 'dress_shoes'],
};

// ---------- Collections ----------
// An optional "show me this first" preference. It only orders types and cuts.
export const COLLECTIONS = [
  { id: 'womenswear', label: 'Womenswear' },
  { id: 'menswear', label: 'Menswear' },
  { id: 'all', label: 'All clothing' },
];
const COLL_CODE = { womenswear: 'w', menswear: 'm' };

// 0 = preferred or shared, 1 = mainly from the other collection.
function rankFor(code, collection) {
  const c = COLL_CODE[collection];
  return !c || !code || code === c ? 0 : 1;
}

export function typeRank(t, collection) {
  return rankFor(t.coll, collection);
}

export function orderTypes(types, collection) {
  return types.map((t, i) => [t, i]).sort((a, b) => typeRank(a[0], collection) - typeRank(b[0], collection) || a[1] - b[1]).map(([t]) => t);
}

export function orderedCuts(t, collection) {
  const c = COLL_CODE[collection];
  const r = (cut) => (!c || !t.cutColl?.[cut] ? 1 : t.cutColl[cut] === c ? 0 : 2);
  return t.cuts.map((cut, i) => [cut, i]).sort((a, b) => r(a[0]) - r(b[0]) || a[1] - b[1]).map(([cut]) => cut);
}

export function defaultCut(t, collection) {
  const base = t.defaultCut || t.cuts[0];
  const c = COLL_CODE[collection];
  if (!c || !t.cutColl?.[base] || t.cutColl[base] === c) return base;
  return orderedCuts(t, collection)[0];
}

export function cutLabel(t, cut) {
  const s = t.cutLabels?.[cut] || cut;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function lengthLabel(t, length) {
  const s = t.lengthLabels?.[length] || { full: 'Full length', cropped: 'Cropped / ankle' }[length] || length;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function defaultLength(t) {
  return t.lengths ? t.defaultLength || t.lengths[0] : null;
}

export function cutWarmth(t, cut) {
  return t.cutWarmth?.[cut] ?? t.warmth;
}

// A compact core palette that separates the shades people actually confuse
// (white / off-white / cream / beige, light / medium blue / navy, light /
// dark grey / black), plus "More colours" and a multicolour option.
export const COLORS = [
  { id: 'white', label: 'White', hex: '#F7F7F5', neutral: true, core: true },
  { id: 'offwhite', label: 'Off-white', hex: '#F1EEE6', neutral: true, core: true },
  { id: 'cream', label: 'Cream', hex: '#ECE2CC', neutral: true, core: true },
  { id: 'beige', label: 'Beige', hex: '#D5BF9C', neutral: true, core: true },
  { id: 'camel', label: 'Camel', hex: '#B48356', neutral: true, core: true },
  { id: 'brown', label: 'Brown', hex: '#6B4A33', neutral: true, core: true },
  { id: 'lightgrey', label: 'Light grey', hex: '#C9C9C7', neutral: true, core: true },
  { id: 'grey', label: 'Mid grey', hex: '#9A9A9A', neutral: true, core: true },
  { id: 'charcoal', label: 'Dark grey', hex: '#4A4C50', neutral: true, core: true },
  { id: 'black', label: 'Black', hex: '#232325', neutral: true, core: true },
  { id: 'lightblue', label: 'Light blue', hex: '#B9D3EA', core: true },
  { id: 'blue', label: 'Medium blue', hex: '#3F6AB0', core: true },
  { id: 'navy', label: 'Navy', hex: '#26355A', neutral: true, core: true },
  { id: 'lightdenim', label: 'Light denim', hex: '#93AECB', neutral: true, core: true },
  { id: 'denim', label: 'Mid denim', hex: '#4F6F9B', neutral: true, core: true },
  { id: 'darkdenim', label: 'Dark denim', hex: '#2C3D5C', neutral: true, core: true },
  { id: 'olive', label: 'Olive', hex: '#6C6C3C', neutral: true, core: true },
  { id: 'khaki', label: 'Khaki', hex: '#A99C6E', neutral: true },
  { id: 'red', label: 'Red', hex: '#B3342F' },
  { id: 'burgundy', label: 'Burgundy', hex: '#6D2230' },
  { id: 'rust', label: 'Rust', hex: '#A4532E' },
  { id: 'orange', label: 'Orange', hex: '#D7772E' },
  { id: 'mustard', label: 'Mustard', hex: '#C99A2E' },
  { id: 'yellow', label: 'Yellow', hex: '#E3BE4C' },
  { id: 'pink', label: 'Pink', hex: '#E7A9B6' },
  { id: 'blush', label: 'Blush', hex: '#EBCFC6' },
  { id: 'green', label: 'Green', hex: '#3E7A4F' },
  { id: 'sage', label: 'Sage', hex: '#A4B89B' },
  { id: 'teal', label: 'Teal', hex: '#2D7375' },
  { id: 'lilac', label: 'Lilac', hex: '#BBA8D4' },
  { id: 'purple', label: 'Purple', hex: '#5F3E80' },
  // Shown as a gradient swatch; illustrations draw it as a print.
  { id: 'multi', label: 'Multicolour', hex: '#9B7E9E', css: 'conic-gradient(#C9483F, #E3BE4C, #3E7A4F, #3F6AB0, #8D5FB0, #C9483F)' },
];

export const COLOR = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export const PATTERNS = [
  { id: 'solid', label: 'Plain' },
  { id: 'striped', label: 'Striped' },
  { id: 'checked', label: 'Checked' },
  { id: 'printed', label: 'Print / floral' },
];

export function nearestColor(r, g, b) {
  let best = COLORS[0], bestD = Infinity;
  for (const c of COLORS) {
    const [cr, cg, cb] = hexToRgb(c.hex);
    // Weighted RGB distance — good enough for a "suggested" colour.
    const d = 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt)))));
  return `rgb(${r},${g},${b})`;
}

function isDark(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

// ---------- Illustrations ----------
// Each shape: body (filled outline paths) + detail (stroke-only lines).
const LS = 'M35 15 L25 18 L14 30 L6 75 L16 77 L27 42 L27 88 L73 88 L73 42 L84 77 L94 75 L86 30 L75 18 L65 15 Q50 25 35 15 Z';
function longSleeve(bottom = 88) {
  return `M35 15 L25 18 L14 30 L6 75 L16 77 L27 42 L27 ${bottom} L73 ${bottom} L73 42 L84 77 L94 75 L86 30 L75 18 L65 15 Q50 25 35 15 Z`;
}
const hemFor = (len) => (len === 'cropped' ? 84 : 95);
function pants(cut, hem = 95) {
  const c = { skinny: [-5, 5], slim: [-3, 4], straight: [0, 3], 'wide-leg': [9, 1.5], baggy: [7, 1], bootcut: [4, 2.5], regular: [0, 3] }[cut] || [0, 3];
  const [ox, ix] = c;
  return `M30 8 L70 8 L${70 + ox} ${hem} L${50 + ix} ${hem} L50 38 L${50 - ix} ${hem} L${30 - ox} ${hem} Z`;
}

const SHAPES = {
  tshirt: () => ({ body: ['M35 15 L25 18 L9 33 L18 44 L27 37 L27 88 L73 88 L73 37 L82 44 L91 33 L75 18 L65 15 Q50 25 35 15 Z'], detail: ['M36 16 Q50 26 64 16'] }),
  longsleeve: () => ({ body: [LS], detail: ['M36 16 Q50 26 64 16'] }),
  shirt: () => ({ body: [LS], detail: ['M35 15 L44 27 L50 19 L56 27 L65 15', 'M50 20 L50 88'], dots: [[53, 36], [53, 50], [53, 64], [53, 78]] }),
  blouse: () => ({ body: ['M36 14 L26 18 L18 31 L27 36 L30 31 L29 88 L71 88 L70 31 L73 36 L82 31 L74 18 L64 14 Q50 24 36 14 Z'], detail: ['M37 15 Q50 25 63 15'] }),
  tank: () => ({ body: ['M35 10 L40 10 Q42 30 50 30 Q58 30 60 10 L65 10 Q66 28 73 34 L73 88 L27 88 L27 34 Q34 28 35 10 Z'], detail: [] }),
  polo: () => ({ body: ['M35 15 L25 18 L9 33 L18 44 L27 37 L27 88 L73 88 L73 37 L82 44 L91 33 L75 18 L65 15 Q50 25 35 15 Z'], detail: ['M36 15 L44 24 L50 19 L56 24 L64 15', 'M50 20 L50 36'], dots: [[52, 26], [52, 32]] }),
  jeans: (cut, len) => ({ body: [pants(cut, hemFor(len))], detail: ['M30 14 L70 14', 'M35 14 Q38 24 46 22', 'M65 14 Q62 24 54 22', 'M50 14 L50 30'] }),
  trousers: (cut, len) => ({ body: [pants(cut, hemFor(len))], detail: ['M30 13 L70 13', `M40 18 L38 ${hemFor(len) - 3}`, `M60 18 L62 ${hemFor(len) - 3}`] }),
  chinos: (cut, len) => ({ body: [pants(cut, hemFor(len))], detail: ['M30 13 L70 13', 'M34 14 L40 22', 'M66 14 L60 22'] }),
  joggers: () => ({ body: ['M30 8 L70 8 L68 88 L54 88 L50 38 L46 88 L32 88 Z', 'M32 86 L46 86 L46 95 L32 95 Z', 'M54 86 L68 86 L68 95 L54 95 Z'], detail: ['M30 14 L70 14', 'M48 14 L46 22', 'M52 14 L54 22'] }),
  shorts: (cut, len) => {
    const h = len === 'knee' ? 72 : 58;
    return { body: [`M30 18 L70 18 L76 ${h} L54 ${h} L50 40 L46 ${h} L24 ${h} Z`], detail: ['M30 24 L70 24'] };
  },
  leggings: () => ({ body: [pants('skinny')], detail: ['M30 12 L70 12'] }),
  skirt: (cut, len) => {
    const h = { mini: 50, midi: 74, maxi: 94 }[len] || 74;
    const w = Math.round(({ 'a-line': 0.2, pencil: 0.02, pleated: 0.25 }[cut] ?? 0.2) * (h - 12));
    const pleats = cut === 'pleated' ? [-2, -1, 1, 2].map((k) => `M${50 + k * 7} 18 L${50 + k * (7 + w / 3)} ${h - 1}`) : [];
    return { body: [`M34 12 L66 12 L${66 + w} ${h} Q50 ${h + 3} ${34 - w} ${h} Z`], detail: ['M34 18 L66 18', ...pleats] };
  },
  dress: (cut, len) => {
    const h = { mini: 66, midi: 82, maxi: 96 }[len] || 82;
    const flare = { shift: 4, slip: 6, wrap: 14, 'a-line': 18 }[cut] ?? 18;
    const top = cut === 'slip' ? 'M40 6 L42 6 L44 22 L56 22 L58 6 L60 6 L62 24' : 'M38 6 L43 6 Q50 14 57 6 L62 6 L64 22';
    const extra = cut === 'wrap' ? [`M39 12 L60 ${Math.min(h - 6, 58)}`] : [];
    return { body: [`${top} L62 40 Q${62 + flare / 2} ${h - 20} ${62 + flare} ${h} Q50 ${h + 4} ${38 - flare} ${h} Q${38 - flare / 2} ${h - 20} 38 40 L36 22 Z`], detail: ['M38 40 Q50 43 62 40', ...extra] };
  },
  hoodie: () => ({ body: ['M36 18 Q32 2 50 2 Q68 2 64 18 Z', LS], detail: ['M40 18 Q50 30 60 18', 'M46 26 L45 40', 'M54 26 L55 40', 'M36 64 L64 64 L67 80 L33 80 Z', 'M28 84 L72 84', 'M8 70 L16 72', 'M92 70 L84 72'] }),
  sweatshirt: () => ({ body: [LS], detail: ['M36 16 Q50 26 64 16', 'M27 82 L73 82', 'M8 69 L17 71', 'M92 69 L83 71'] }),
  sweater: (cut) => ({
    body: cut === 'turtleneck' ? ['M40 6 L60 6 L61 18 L39 18 Z', LS] : [LS],
    detail: [cut === 'v-neck' ? 'M36 16 L50 34 L64 16' : 'M36 16 Q50 26 64 16', 'M27 82 L73 82', 'M8 69 L17 71', 'M92 69 L83 71', 'M38 32 L38 80', 'M50 34 L50 80', 'M62 32 L62 80'],
  }),
  cardigan: (cut, len) => {
    const b = len === 'cropped' ? 70 : len === 'long' ? 96 : 88;
    const knit = cut === 'chunky' ? ['M36 40 Q39 46 36 52 Q33 58 36 64 Q39 70 36 76', 'M64 40 Q61 46 64 52 Q67 58 64 64 Q61 70 64 76', 'M27 82 L73 82', 'M27 85 L73 85', 'M8 69 L17 71', 'M92 69 L83 71'] : [];
    return { body: [longSleeve(b)], detail: ['M36 16 L50 46 L64 16', `M50 46 L50 ${b}`, ...knit], dots: [[47, 54], [47, 64]] };
  },
  blazer: () => ({ body: [longSleeve(90)], detail: ['M36 15 L42 40 L50 58 L58 40 L64 15', 'M50 58 L50 90', 'M33 72 L42 72', 'M58 72 L67 72'], dots: [[47, 66]] }),
  denim_jacket: () => ({ body: [longSleeve(76)], detail: ['M35 15 L42 26 L50 20 L58 26 L65 15', 'M50 22 L50 76', 'M33 36 L45 36 L45 46 L33 46 Z', 'M55 36 L67 36 L67 46 L55 46 Z', 'M27 70 L73 70'], dots: [[47, 52], [47, 62]] }),
  light_jacket: () => ({ body: [longSleeve(80)], detail: ['M38 14 Q50 22 62 14', 'M50 20 L50 80', 'M27 74 L73 74', 'M8 69 L17 71', 'M92 69 L83 71'] }),
  leather_jacket: () => ({ body: [longSleeve(80)], detail: ['M35 15 L46 30 L44 50', 'M65 15 L56 28', 'M58 22 L46 80', 'M27 74 L73 74'] }),
  rain_jacket: () => ({ body: ['M36 18 Q32 2 50 2 Q68 2 64 18 Z', longSleeve(84)], detail: ['M50 20 L50 84', 'M32 58 L42 56', 'M68 58 L58 56'] }),
  trench: (cut, len) => { const b = len === 'short' ? 84 : 97; return { body: [longSleeve(b)], detail: ['M35 15 L43 34 L50 44 L57 34 L65 15', `M50 44 L50 ${b}`, 'M27 58 L73 58', 'M48 54 L52 62'], dots: [[43, 48], [57, 48], [43, 70], [57, 70]] }; },
  wool_coat: (cut, len) => { const b = len === 'short' ? 84 : 97; return { body: [longSleeve(b)], detail: ['M35 15 L42 36 L50 50 L58 36 L65 15', `M50 50 L50 ${b}`, 'M33 70 L42 70', 'M58 70 L67 70'], dots: [[46, 58], [46, 72]] }; },
  puffer: (cut, len) => {
    const b = len === 'cropped' ? 72 : len === 'long' ? 97 : 86;
    const lines = [];
    for (let y = 30; y < b; y += 12) lines.push(`M27 ${y} L73 ${y}`);
    return { body: ['M38 8 L62 8 L64 18 L36 18 Z', longSleeve(b)], detail: [...lines, 'M50 8 L50 ' + b, 'M12 46 L22 48', 'M88 46 L78 48', 'M9 60 L19 62', 'M91 60 L81 62'] };
  },
  sneakers: () => ({ body: ['M8 64 Q10 46 26 44 L40 40 Q50 52 70 54 Q90 56 92 66 L92 76 L8 76 Z'], detail: ['M8 68 L92 68', 'M44 46 L50 44', 'M48 50 L55 48', 'M53 53 L60 51'] }),
  running: () => ({ body: ['M8 64 Q10 46 26 44 L40 40 Q50 52 70 54 Q90 56 92 66 L92 76 L8 76 Z'], detail: ['M8 68 Q50 74 92 68', 'M30 58 Q50 52 70 62', 'M44 46 L50 44', 'M48 50 L55 48'] }),
  loafers: () => ({ body: ['M8 66 Q10 52 30 52 Q55 50 75 56 Q92 60 92 70 L92 76 L8 76 Z'], detail: ['M8 72 L92 72', 'M50 54 Q60 60 70 57'] }),
  boots: (cut) => ({ body: [cut === 'heeled' ? 'M16 18 L42 18 L44 52 Q62 54 80 58 Q92 62 92 70 L92 74 L30 74 L28 82 L18 82 Z' : 'M14 18 L42 18 L44 52 Q62 54 80 58 Q92 62 92 70 L92 78 L12 78 Z'], detail: cut === 'lace-up' ? ['M12 72 L92 72', 'M40 26 L46 24', 'M40 34 L46 32', 'M41 42 L47 40'] : ['M12 72 L92 72', 'M34 24 L34 48'] }),
  dress_shoes: (cut) => cut === 'heels'
    ? { body: ['M14 46 L20 46 Q40 60 70 62 Q90 63 92 72 L92 74 L60 74 Q40 70 28 64 L24 80 L17 80 L15 60 Z'], detail: [] }
    : { body: ['M8 66 Q10 52 30 52 Q55 50 75 56 Q92 60 92 70 L92 76 L8 76 Z'], detail: ['M8 72 L92 72', 'M46 54 L58 60', 'M30 55 Q44 52 46 54'] },
  flats: () => ({ body: ['M8 64 Q12 56 26 58 Q50 62 76 58 Q92 58 92 68 L92 76 L8 76 Z'], detail: ['M8 72 L92 72', 'M70 60 Q74 64 78 60'] }),
  sandals: () => ({ body: ['M8 70 Q8 64 20 64 L84 64 Q94 64 94 70 L94 76 L8 76 Z'], detail: ['M20 64 Q30 46 40 64', 'M50 64 Q62 44 74 64', 'M44 54 Q56 50 66 56'] }),
};

let patternSeq = 0;
function patternDef(pattern, color, id) {
  const line = isDark(color) ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.22)';
  if (pattern === 'striped') return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${color}"/><rect width="8" height="3" fill="${line}"/></pattern>`;
  if (pattern === 'checked') return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${color}"/><rect width="10" height="3" fill="${line}"/><rect width="3" height="10" fill="${line}"/></pattern>`;
  if (pattern === 'multi') return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="12" height="3" fill="#C9483F"/><rect y="3" width="12" height="3" fill="#E3BE4C"/><rect y="6" width="12" height="3" fill="#3F6AB0"/><rect y="9" width="12" height="3" fill="#3E7A4F"/></pattern>`;
  if (pattern === 'printed') return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${color}"/><circle cx="3" cy="3" r="1.8" fill="${line}"/><circle cx="9" cy="9" r="1.8" fill="${line}"/></pattern>`;
  return '';
}

// v: { type, color, cut, length, pattern } — an item or any item-like object.
export function illustration(v, extraClass = '') {
  const t = TYPE[v.type] || TYPE.tshirt;
  const shapeFn = SHAPES[t.id] || SHAPES.tshirt;
  const s = shapeFn(v.cut || t.defaultCut || t.cuts[0], v.length || defaultLength(t));
  const color = (COLOR[v.color] || COLOR.grey).hex;
  const pattern = v.color === 'multi' ? 'multi' : v.pattern || 'solid';
  const stroke = isDark(color) ? shade(color, 0.35) : shade(color, -0.38);
  const detailStroke = isDark(color) ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.28)';
  let fill = color, defs = '';
  if (pattern && pattern !== 'solid') {
    const id = `pt${++patternSeq}`;
    defs = `<defs>${patternDef(pattern, color, id)}</defs>`;
    fill = `url(#${id})`;
  }
  const body = s.body.map((d) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`).join('');
  const detail = (s.detail || []).map((d) => `<path d="${d}" fill="none" stroke="${detailStroke}" stroke-width="1.3" stroke-linecap="round"/>`).join('');
  const dots = (s.dots || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="${detailStroke}"/>`).join('');
  return raw(`<svg class="illo ${extraClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${defs}${body}${detail}${dots}</svg>`);
}

export function typesForSlot(slot) {
  return TYPES.filter((t) => t.slot === slot);
}

export function colorLabel(id) {
  return (COLOR[id] || { label: id }).label;
}

export function defaultItemFields(typeId, cut, length) {
  const t = TYPE[typeId];
  const c = cut && t.cuts.includes(cut) ? cut : t.defaultCut || t.cuts[0];
  return {
    type: t.id,
    slot: t.slot,
    cut: c,
    length: t.lengths ? (t.lengths.includes(length) ? length : defaultLength(t)) : null,
    warmth: cutWarmth(t, c),
    formality: [...t.f],
    water: t.water || 'no',
    walk: t.walk || (t.slot === 'shoes' ? 'unknown' : null),
    cycle: t.cycle || (t.slot === 'shoes' ? 'unknown' : null),
    estimated: { warmth: true, formality: true, water: true, walk: true, cycle: true },
  };
}
