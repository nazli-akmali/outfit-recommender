// Local-only persistence. Structured data lives in localStorage;
// photo blobs live in IndexedDB. Nothing is sent to a server.
import { defaultItemFields, defaultLength, TYPE, colorLabel } from './catalog.js';

const KEY = 'wardrobe-assistant.v1';

const EMPTY = () => ({
  version: 1,
  items: [],
  wishlist: [],
  saved: [],     // saved outfit combinations
  wears: [],     // outfits chosen for a day (+ optional feedback)
  rejections: [], // suggestions rejected with a reason
  reports: [],    // online archive images reported as irrelevant (hidden on this device)
  prefs: {
    onboarded: false,
    collection: null,     // 'womenswear' | 'menswear' | 'all' — ordering only; null = not asked
    location: null,
    thermal: 'neutral',   // user's self-description
    learnedThermal: 0,    // learned from feedback, in warmth points (+ = needs warmer)
    style: [],
    favoriteColors: [],
    avoidTypes: [],
    formalityOffsets: {}, // per day-plan preset, learned from feedback
    pairScores: {},       // "idA|idB" -> score from combination feedback
    presetMemory: {},     // remembered day-plan settings per preset
  },
});

export let db = load();

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return EMPTY();
    const data = JSON.parse(s);
    const base = EMPTY();
    for (const it of data.items || []) migrateItem(it);
    return { ...base, ...data, prefs: { ...base.prefs, ...(data.prefs || {}) } };
  } catch (e) {
    console.warn('Could not read saved data', e);
    return EMPTY();
  }
}

// Older items: catalogue images were called illustrations, and lengths
// (mini/midi/maxi, cropped/long) were stored as cuts.
function migrateItem(it) {
  if (!it.image || it.image.kind === 'illustration') it.image = { kind: 'catalog' };
  const t = TYPE[it.type];
  if (!t) return;
  if (t.lengths && !it.length) {
    it.length = t.lengths.includes(it.cut) ? it.cut : defaultLength(t);
  }
  if (it.type === 'cardigan' && !t.cuts.includes(it.cut)) it.cut = it.cut === 'chunky' ? 'chunky' : 'fine-knit';
  if (!t.cuts.includes(it.cut)) it.cut = t.defaultCut || t.cuts[0];
  if (it.length === undefined) it.length = null;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export function uid(prefix = 'i') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function itemName(typeId, colorId, cut, length) {
  const t = TYPE[typeId];
  const showCut = cut && t.cuts.length > 1 && cut !== 'regular' && cut !== (t.defaultCut || t.cuts[0]);
  const showLen = length && t.lengths && length !== defaultLength(t) && !['regular', 'full'].includes(length);
  const colorWord = { denim: 'Mid-wash', lightdenim: 'Light-wash', darkdenim: 'Dark-wash' }[colorId] || colorLabel(colorId);
  const lenWord = showLen ? `${length === 'knee' ? 'knee-length' : length} ` : '';
  return `${colorWord} ${lenWord}${showCut ? cut + ' ' : ''}${t.label.split(' / ')[0].toLowerCase()}`;
}

// image: { kind: 'catalog' } (follows type/cut/colour) | { kind: 'archive', url, thumb, source, license, author, pageUrl } | { kind: 'photo', photoId }
export function createItem({ type, color, cut, length, pattern = 'solid', image = { kind: 'catalog' }, ...rest }) {
  const base = defaultItemFields(type, cut, length);
  const item = {
    id: uid('it'),
    ownership: 'owned',
    ...base,
    color,
    pattern,
    name: itemName(type, color, base.cut, base.length),
    image,
    status: 'available', // available | laundry | unavailable
    createdAt: Date.now(),
    ...rest,
  };
  db.items.push(item);
  save();
  return item;
}

export function getItem(id) {
  return db.items.find((i) => i.id === id);
}

export function updateItem(id, patch) {
  const it = getItem(id);
  if (!it) return;
  Object.assign(it, patch);
  save();
  return it;
}

export async function deleteItem(id) {
  const it = getItem(id);
  if (!it) return;
  if (it.image?.kind === 'photo') await deletePhoto(it.image.photoId);
  db.items = db.items.filter((i) => i.id !== id);
  save();
}

export function resetAll() {
  db = EMPTY();
  save();
  return clearPhotos();
}

// ---------- IndexedDB photos ----------
let idbPromise;
function idb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('wardrobe-photos', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return idbPromise;
}

function tx(mode, fn) {
  return idb().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('photos', mode);
    const r = fn(t.objectStore('photos'));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  }));
}

export const photoUrls = new Map(); // photoId -> object URL

export async function putPhoto(blob) {
  const id = uid('ph');
  await tx('readwrite', (s) => s.put(blob, id));
  photoUrls.set(id, URL.createObjectURL(blob));
  return id;
}

export async function deletePhoto(id) {
  await tx('readwrite', (s) => s.delete(id));
  const u = photoUrls.get(id);
  if (u) URL.revokeObjectURL(u);
  photoUrls.delete(id);
}

async function clearPhotos() {
  await tx('readwrite', (s) => s.clear());
  photoUrls.forEach((u) => URL.revokeObjectURL(u));
  photoUrls.clear();
}

export async function loadPhotos() {
  const ids = db.items.filter((i) => i.image?.kind === 'photo').map((i) => i.image.photoId);
  for (const id of ids) {
    try {
      const blob = await tx('readonly', (s) => s.get(id));
      if (blob) photoUrls.set(id, URL.createObjectURL(blob));
    } catch (e) {
      console.warn('Missing photo', id, e);
    }
  }
}

// Validate, downscale and re-encode an uploaded photo. Re-encoding through a
// canvas also strips EXIF metadata such as GPS location.
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function processUpload(file) {
  if (!file) throw new Error('No file selected.');
  if (file.type && !ALLOWED.includes(file.type)) throw new Error('Please choose a JPEG, PNG or WebP image.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That image is larger than 12 MB. Please choose a smaller one.');
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("This file couldn't be read as an image. HEIC photos may need converting to JPEG first.");
  }
  const max = 900;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  // Suggested colour: average of the central region (where the garment usually is).
  const cw = Math.max(1, Math.round(w * 0.3)), ch = Math.max(1, Math.round(h * 0.3));
  const data = ctx.getImageData(Math.round((w - cw) / 2), Math.round((h - ch) / 2), cw, ch).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not process this image.');
  return { blob, avg: [r / n, g / n, b / n], previewUrl: URL.createObjectURL(blob) };
}

export function exportData() {
  return JSON.stringify(db, null, 2);
}
