// Realistic garment photos for catalogue items, with an illustration fallback.
// Photos live in assets/garments/ and are listed in MANIFEST; see
// assets/garments/README.md for the framing spec and rights requirements.
import { html } from './html.js';
import { TYPE, COLOR, illustration, defaultLength } from './catalog.js';

// Entry: { type, cut, length?, color?, coll?, src, license, credit, source, generated? }
//  - generated: true for photorealistic generated stand-ins; the UI labels them.
//  - color set: an accurate photo of that colour variant (preferred).
//  - color omitted: a neutral base photo on a transparent background, recoloured
//    on device for colours that have no photo of their own.
//  - coll: 'w' | 'm' when the photo shows that collection's fit of the cut.
// Entries without rights metadata (license, credit, source) are never shown.
export const MANIFEST = [];

const usable = MANIFEST.filter((p) => {
  const ok = TYPE[p.type] && p.src && p.license && p.credit && p.source;
  if (!ok) console.warn('Garment photo skipped — missing type or rights metadata:', p.src);
  return ok;
});

const COLL_CODE = { womenswear: 'w', menswear: 'm' };

export function findPhoto({ type, cut, length, color }, collection) {
  const t = TYPE[type];
  if (!t) return null;
  const c = cut || t.defaultCut || t.cuts[0];
  const len = length || defaultLength(t);
  const code = COLL_CODE[collection];
  const cands = usable.filter((p) => p.type === type && (p.cut || t.cuts[0]) === c && (p.length || defaultLength(t)) === len);
  const pick = (list) => list.find((p) => code && p.coll === code) || list.find((p) => !p.coll) || list[0];
  const exact = cands.filter((p) => p.color === color);
  if (exact.length) return { photo: pick(exact), recolor: false };
  const base = cands.filter((p) => !p.color);
  if (base.length) return { photo: pick(base), recolor: true };
  return null;
}

// ---------- Recolouring ----------
// Keeps each pixel's luminance deviation from the garment's mean (texture,
// folds, seams, buttons) and re-centres it on the target colour, so the
// fabric still reads as fabric rather than a flat fill.
const cache = new Map(); // `${src}|${color}` -> object URL | Promise

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

export async function recolor(src, colorId) {
  const key = `${src}|${colorId}`;
  if (cache.has(key)) return cache.get(key);
  const job = (async () => {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = im.data;
    let sum = 0, weight = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a > 8) { sum += lum(d[i], d[i + 1], d[i + 2]) * a; weight += a; }
    }
    const mean = weight ? sum / weight : 128;
    const n = parseInt((COLOR[colorId] || COLOR.grey).hex.slice(1), 16);
    const target = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    // Very light or very dark targets clip one side of the range, so lift
    // contrast a little there to keep the detail visible.
    const tl = lum(...target);
    const k = 0.85 + 0.35 * Math.abs(tl - 128) / 128;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 8) continue;
      const dev = (lum(d[i], d[i + 1], d[i + 2]) - mean) * k;
      d[i] = target[0] + dev; d[i + 1] = target[1] + dev; d[i + 2] = target[2] + dev;
    }
    ctx.putImageData(im, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const url = URL.createObjectURL(blob);
    cache.set(key, url);
    return url;
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}

// Garment image for a catalogue item ({ type, color, cut, length, pattern }):
// a matching photo, a recoloured base photo, or the illustration stand-in.
// Patterned and multicolour items use the illustration because a plain photo
// would misrepresent them.
export function garmentImg(v, cls = '', collection) {
  const found = (v.pattern || 'solid') === 'solid' && v.color !== 'multi' ? findPhoto(v, collection) : null;
  if (!found) return illustration(v, cls);
  const { photo, recolor: needs } = found;
  const fb = html`data-fallback-type="${v.type}" data-fallback-color="${v.color}" data-fallback-cut="${v.cut || ''}" data-fallback-length="${v.length || ''}"`;
  if (!needs) return html`<img class="garment ${cls}" src="${photo.src}" alt="" loading="lazy" ${fb}>`;
  const done = cache.get(`${photo.src}|${v.color}`);
  if (typeof done === 'string') return html`<img class="garment ${cls}" src="${done}" alt="">`;
  return html`<img class="garment pending ${cls}" src="${photo.src}" alt="" data-recolor="${v.color}" ${fb}>`;
}

// How a catalogue image is produced, so the UI can label stand-ins honestly.
export function imageSource(v, collection) {
  const found = (v.pattern || 'solid') === 'solid' && v.color !== 'multi' ? findPhoto(v, collection) : null;
  if (!found) return 'illustration';
  return found.photo.generated ? 'generated' : 'photo';
}

// After each render, recolour any base photos still waiting.
export function hydrateGarments(root) {
  root.querySelectorAll('img[data-recolor]').forEach((el) => {
    const color = el.dataset.recolor;
    const src = el.getAttribute('src');
    el.removeAttribute('data-recolor');
    recolor(src, color)
      .then((url) => { el.src = url; el.classList.remove('pending'); })
      .catch(() => el.dispatchEvent(new Event('error')));
  });
}

export const hasPhotos = () => usable.length > 0;
