// Day-plan presets and lightweight free-text interpretation.
import { db, save } from './store.js';

export const PRESETS = [
  { id: 'uni', label: 'University, then a café', start: '09:00', end: '18:00', outdoor: 'mixed', moves: ['walk', 'transit'], formality: 2 },
  { id: 'office', label: 'A day at the office', start: '08:30', end: '18:30', outdoor: 'in', moves: ['transit'], formality: 3 },
  { id: 'walk', label: 'Shopping & a long walk', start: '11:00', end: '17:00', outdoor: 'out', moves: ['longwalk'], formality: 2 },
  { id: 'dinner', label: 'Dinner or a social event', start: '19:00', end: '23:00', outdoor: 'in', moves: ['transit'], formality: 4 },
  { id: 'custom', label: 'Something else', start: '10:00', end: '18:00', outdoor: 'mixed', moves: ['walk'], formality: 2 },
];

export const MOVES = [
  { id: 'walk', label: 'Some walking' },
  { id: 'longwalk', label: 'Long walk' },
  { id: 'cycle', label: 'Cycling' },
  { id: 'transit', label: 'Public transport' },
  { id: 'car', label: 'Car / taxi' },
];

export const OUTDOOR = [
  { id: 'in', label: 'Mostly indoors', share: 0.15 },
  { id: 'mixed', label: 'Mixed', share: 0.45 },
  { id: 'out', label: 'Mostly outdoors', share: 0.85 },
];

export function planFromPreset(id) {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  const mem = db.prefs.presetMemory[id] || {};
  return { preset: p.id, label: p.label, note: '', day: 0, start: p.start, end: p.end, outdoor: p.outdoor, moves: [...p.moves], formality: p.formality, ...mem, remembered: !!db.prefs.presetMemory[id] };
}

export function rememberPlan(plan) {
  const { start, end, outdoor, moves, formality } = plan;
  db.prefs.presetMemory[plan.preset] = { start, end, outdoor, moves, formality };
  db.prefs.lastPreset = plan.preset;
  save();
}

// Keyword hints from a free-text description. Returns only fields it is
// reasonably confident about; the user sees and can override every value.
export function interpretNote(text) {
  const t = text.toLowerCase();
  const out = {};
  const moves = new Set();
  if (/\b(bike|cycl|biking)/.test(t)) moves.add('cycle');
  if (/\b(hike|hiking|long walk|walking tour|explor|sightsee)/.test(t)) moves.add('longwalk');
  else if (/\bwalk/.test(t)) moves.add('walk');
  if (/\b(train|bus|tram|metro|subway|tube)/.test(t)) moves.add('transit');
  if (/\b(drive|driving|car|taxi|uber)/.test(t)) moves.add('car');
  if (moves.size) out.moves = [...moves];
  if (/\b(wedding|gala|formal|black tie)/.test(t)) out.formality = 5;
  else if (/\b(interview|presentation|client|meeting|dinner|date|theatre|theater|party)/.test(t)) out.formality = 4;
  else if (/\b(office|work|lecture|class|museum|brunch)/.test(t)) out.formality = 3;
  else if (/\b(gym|run|sport|yoga|hike|errand|home)/.test(t)) out.formality = 1;
  if (/\b(picnic|park|market|outdoor|festival|hike|beach|garden|stadium)/.test(t)) out.outdoor = 'out';
  else if (/\b(office|cinema|museum|restaurant|library|mall)/.test(t)) out.outdoor = 'in';
  return out;
}
