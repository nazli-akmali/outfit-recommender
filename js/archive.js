// Garment archive providers. Each provider implements:
//   search({ query, slot, type, cut, color, offset }) -> { results: [...], nextOffset, provider }
// Results: { id, title, thumb, url, license, author, pageUrl, typeId?, colorId?, cut? }
// Swapping in a licensed retail/catalogue API later only needs a new provider.
import { TYPES, TYPE, COLOR, COLORS } from './catalog.js';

// 1) Live online archive: Wikimedia Commons (openly licensed media, public API,
// no key, anonymous CORS via origin=*). Images are hot-linked with attribution.
export const commonsProvider = {
  id: 'commons',
  label: 'Wikimedia Commons',
  live: true,
  async search({ query, type, cut, color, offset = 0 }) {
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
      generator: 'search', gsrnamespace: '6', gsrsearch: term, gsrlimit: '24', gsroffset: String(offset),
      prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '360',
      iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription',
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res;
    try {
      res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: ctrl.signal });
    } catch {
      throw new Error("Couldn't reach Wikimedia Commons. You can use the built-in library instead.");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`Wikimedia Commons returned an error (${res.status}).`);
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
    const results = pages
      .filter((p) => p.imageinfo?.[0]?.thumburl && /image\/(jpeg|png|webp)/.test(p.imageinfo[0].mime))
      .map((p) => {
        const ii = p.imageinfo[0];
        const md = ii.extmetadata || {};
        return {
          id: `commons:${p.pageid}`,
          title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' '),
          thumb: ii.thumburl,
          url: ii.thumburl,
          license: md.LicenseShortName?.value || 'See source',
          author: stripTags(md.Artist?.value || 'Unknown'),
          pageUrl: ii.descriptionurl,
          typeId: type || null,
          colorId: color || null,
          cut: cut || null,
        };
      });
    return { results, nextOffset: data.continue?.gsroffset ?? null, provider: this.id };
  },
};

function stripTags(s) {
  const d = new DOMParser().parseFromString(s, 'text/html');
  return (d.body.textContent || '').trim().slice(0, 80);
}

// 2) Curated fallback: the built-in illustration library (offline, every
// type x cut x colour). This is NOT an online archive and is labelled as such.
export const libraryProvider = {
  id: 'library',
  label: 'Built-in illustration library',
  live: false,
  async search({ slot, type, cut, color, query, offset = 0 }) {
    const q = (query || '').toLowerCase();
    let types = TYPES.filter((t) => (!slot || t.slot === slot) && (!type || t.id === type));
    if (q) types = types.filter((t) => t.label.toLowerCase().includes(q) || t.q.includes(q) || COLORS.some((c) => q.includes(c.label.toLowerCase())));
    const qColor = COLORS.find((c) => q.includes(c.label.toLowerCase()));
    const colors = color ? [COLOR[color]] : qColor ? [qColor] : COLORS;
    const all = [];
    for (const t of types) {
      const cuts = cut && t.cuts.includes(cut) ? [cut] : t.cuts;
      for (const c of cuts) for (const col of colors) {
        all.push({ id: `lib:${t.id}:${c}:${col.id}`, title: `${col.label} ${c !== 'regular' ? c + ' ' : ''}${t.label.toLowerCase()}`, typeId: t.id, colorId: col.id, cut: c, illustration: true });
      }
    }
    const page = all.slice(offset, offset + 36);
    return { results: page, nextOffset: offset + 36 < all.length ? offset + 36 : null, provider: this.id, total: all.length };
  },
};

export const PROVIDERS = [commonsProvider, libraryProvider];
