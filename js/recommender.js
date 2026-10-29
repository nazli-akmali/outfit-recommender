// Explainable, rule-based outfit recommender.
//
// 1. Build a context from the day plan + weather + learned preferences.
// 2. Score each available owned item for the day; drop clear mismatches.
// 3. Enumerate combinations (base + optional layer + optional outer + shoes),
//    score them on warmth, rain, activity, formality, colour and feedback.
// 4. Pick up to three that are good AND different from each other.
// Every score adjustment records a human-readable reason.
import { TYPE, COLOR, FORMALITY } from './catalog.js';
import { OUTDOOR } from './plan.js';

const WARMTH_POINTS = {
  top: [0.5, 1, 1.5, 2, 2.5],
  dress: [0.5, 1, 1.5, 2, 2.5],
  layer: [1.5, 2, 2.5, 3, 4],
  outer: [1.5, 2.5, 3.5, 5, 6.5],
};
const INDOOR_C = 21;

export const wp = (item) => (item && WARMTH_POINTS[item.slot] ? WARMTH_POINTS[item.slot][item.warmth - 1] : 0);
const need = (feels) => clamp((24 - feels) * 0.33 + 1, 1, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r0 = (v) => Math.round(v);
const lower = (it) => it.name.toLowerCase();
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function thermalBias(prefs) {
  return ({ cold: 0.8, warm: -0.8 }[prefs.thermal] || 0) + (prefs.learnedThermal || 0);
}

export function buildContext(plan, weather, prefs, session = {}) {
  const share = OUTDOOR.find((o) => o.id === plan.outdoor)?.share ?? 0.45;
  const moves = new Set(plan.moves);
  const bias = thermalBias(prefs) + (session.thermal || 0);
  // Movement keeps you warmer; cycling adds wind chill which cancels most of it.
  const activityHeat = moves.has('longwalk') ? 0.6 : moves.has('walk') ? 0.3 : 0;
  const cycleChill = moves.has('cycle') ? 0.5 : 0;
  const indoor = need(INDOOR_C) + bias;
  let outCold = need(weather.feelsMin) + bias - activityHeat + cycleChill;
  let outWarm = need(weather.feelsMax) + bias - activityHeat + cycleChill;
  // Short outdoor exposure (mostly indoors / by car) tolerates slightly less insulation.
  const exposure = moves.has('car') && share < 0.3 ? 0.7 : 0.75 + 0.25 * share;
  if (outCold > indoor) outCold = indoor + (outCold - indoor) * exposure;
  if (outWarm > indoor) outWarm = indoor + (outWarm - indoor) * exposure;
  const formality = clamp(plan.formality + (prefs.formalityOffsets?.[plan.preset] || 0) + (session.formality || 0), 1, 5);
  const rainExposure = share >= 0.15 || moves.has('walk') || moves.has('longwalk') || moves.has('cycle');
  const popMax = weather.popMax ?? (weather.precipSum > 0.5 ? 70 : 0);
  return {
    plan, weather, prefs, share, moves, bias,
    indoor, outCold, outWarm, formality,
    rainy: rainExposure && (popMax >= 50 || weather.precipSum >= 1),
    showers: rainExposure && popMax >= 25 && popMax < 50 && weather.precipSum < 1,
    windy: weather.windMax >= 30,
    hot: weather.feelsMax >= 25,
    cold: weather.feelsMin <= 8,
    popMax,
  };
}

function formalityDistance(item, F) {
  const [a, b] = item.formality;
  return F < a ? a - F : F > b ? F - b : 0;
}

// Per-item suitability. Returns { score, hard, notes }.
export function scoreItem(item, ctx) {
  let score = 0;
  const notes = [];
  const t = TYPE[item.type];
  if (ctx.prefs.avoidTypes?.includes(item.type)) return { score: -99, hard: 'avoided' };
  const fd = formalityDistance(item, ctx.formality);
  if (fd > 1.5) return { score: -99, hard: ctx.formality > item.formality[1] ? 'too_casual' : 'too_dressy' };
  score -= fd * 1.2;
  if (item.slot === 'shoes') {
    if (ctx.moves.has('longwalk') && item.walk === 'no') { score -= 3; notes.push(`${cap(item.name)} aren't great for a long walk`); }
    if (ctx.moves.has('longwalk') && item.walk === 'yes') score += 0.8;
    if (ctx.moves.has('cycle') && item.cycle === 'no') { score -= 2.5; notes.push(`${cap(item.name)} are awkward for cycling`); }
    if (ctx.rainy && item.type === 'sandals') { score -= 2.5; notes.push('Sandals in the rain'); }
    if (ctx.rainy && item.water === 'yes') score += 0.6;
    if (ctx.weather.feelsMin < 14 && item.type === 'sandals') score -= 2;
    if (ctx.weather.feelsMin < 6 && (t.legs || 3) <= 2) score -= 1;
    if (ctx.hot && item.type === 'boots') score -= 0.8;
  }
  if (item.slot === 'bottom' || item.slot === 'dress') {
    const legs = t.legs === 1 && item.cut === 'maxi' ? 3 : t.legs === 1 && item.cut === 'midi' ? 2 : t.legs;
    if (ctx.weather.feelsMin < 10 && legs <= 1) { score -= 1.5; notes.push(`Bare legs at ${r0(ctx.weather.feelsMin)}° — tights would help`); }
    if (ctx.hot && legs >= 3 && ctx.formality <= 3) score -= 0.6;
    if (ctx.hot && legs <= 1) score += 0.4;
    if (ctx.moves.has('cycle') && ['mini', 'maxi'].includes(item.cut)) { score -= 1.5; notes.push(`A ${item.cut} ${t.label.toLowerCase()} can be tricky on a bike`); }
    if (ctx.windy && item.cut === 'mini') { score -= 0.5; notes.push(`Windy (${r0(ctx.weather.windMax)} km/h) — a mini may be fiddly`); }
  }
  if (item.slot === 'outer' && ctx.moves.has('cycle') && ['trench', 'wool_coat'].includes(item.type) && item.cut !== 'cropped') score -= 0.4;
  // Style preferences: gentle nudges, never rules.
  const st = new Set(ctx.prefs.style || []);
  if (st.has('relaxed') && ['oversized', 'wide-leg', 'baggy', 'chunky'].includes(item.cut)) score += 0.4;
  if (st.has('sporty') && ['hoodie', 'sweatshirt', 'sneakers', 'running', 'joggers'].includes(item.type)) score += 0.4;
  if (st.has('smart') && ['blazer', 'loafers', 'trousers', 'shirt', 'wool_coat', 'trench'].includes(item.type)) score += 0.4;
  if (st.has('minimal') && COLOR[item.color]?.neutral && item.pattern === 'solid') score += 0.3;
  if (st.has('colourful') && !COLOR[item.color]?.neutral) score += 0.4;
  if (ctx.prefs.favoriteColors?.includes(item.color)) score += 0.3;
  if (ctx.recentIds?.has(item.id)) score -= 0.4;
  return { score, hard: null, notes };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Find the first hour after `fromTime` when feels-like reaches `feels`.
function timeWhenFeels(weather, feels, after) {
  if (!weather.hours || weather.source === 'manual') return null;
  let passed = !after;
  for (const h of weather.hours) {
    if (h.time === after) passed = true;
    if (passed && h.feels >= feels) return h.time;
  }
  return null;
}

// Score a full outfit. o = { base: item|null (top), bottom, dress, layer, outer, shoes }
export function scoreOutfit(o, ctx, itemScores) {
  const items = outfitItems(o);
  let score = items.reduce((s, it) => s + (itemScores.get(it.id)?.score ?? scoreItem(it, ctx).score), 0);
  const why = [], issues = [], advice = [], asks = [];
  items.forEach((it) => (itemScores.get(it.id)?.notes || scoreItem(it, ctx).notes).forEach((n) => issues.push(n)));
  const w = ctx.weather;
  const coreTop = o.dress || o.top;
  const core = wp(coreTop) + wp(o.layer);
  const full = core + wp(o.outer);

  // Warmth at the coldest point.
  const deficit = ctx.outCold - full;
  if (deficit > 2.5) return { fail: 'too_cold', score: -99, full, need: ctx.outCold };
  if (deficit > 1) { score -= deficit * 1.3; issues.push(`May feel chilly around ${r0(w.feelsMin)}° feels-like${w.coldestAt ? ` (${w.coldestAt})` : ''}`); }
  else if (deficit > 0) score -= deficit * 0.5;
  const excess = full - ctx.outCold;
  if (excess > 4.5) return { fail: 'too_warm', score: -99 };
  if (excess > 2.5) { score -= (excess - 2.5) * 1.1; issues.push('Probably warmer than you need'); }
  // Core layers you can't take off must suit indoors and the warmest part of the day.
  const coreComfort = Math.max(ctx.indoor, ctx.outWarm) + 1.3;
  if (core > coreComfort + 1.5) return { fail: 'too_warm', score: -99 };
  if (core > coreComfort) { score -= (core - coreComfort) * 1.2; issues.push(o.layer ? `The ${lower(o.layer)} may feel warm indoors` : 'Heavy for the warmer hours'); }
  if (o.outer && ctx.outCold <= core + 0.2 && !(ctx.rainy && o.outer.water === 'yes')) { score -= 1; }
  if (o.layer && !o.outer && ctx.outCold <= wp(coreTop) && !ctx.prefs.style?.includes('smart')) score -= 0.4;

  if (deficit <= 1) {
    if (ctx.hot) why.push(`Light enough for up to ${r0(w.feelsMax)}° feels-like`);
    else why.push(`Warm enough for ${r0(w.feelsMin)}° feels-like${o.outer ? ` with the ${lower(o.outer)}` : ''}`);
  }

  // Layering advice when the day changes or you move between indoors and out.
  if (o.outer && full - core >= 1.5) {
    const comfyFeels = 24 - ((core - ctx.bias - 1) / 0.33);
    const off = timeWhenFeels(w, comfyFeels, w.coldestAt);
    if (off && off !== w.hours[0].time && ctx.outWarm < ctx.outCold - 0.8) advice.push(`Wear the ${lower(o.outer)} early on (${r0(w.feelsMin)}° feels-like); from about ${off} you can carry it.`);
    else if (ctx.share < 0.6) advice.push(`Take the ${lower(o.outer)} off indoors — the ${lower(coreTop)}${o.layer ? ` and ${lower(o.layer)} are` : ' is'} right for inside.`);
  }
  if (o.layer && w.feelsMax - w.feelsMin >= 5 && ctx.outWarm + 0.5 < core) {
    const hot = w.warmestAt ? ` around ${w.warmestAt}` : '';
    advice.push(`The ${lower(o.layer)} can come off if it warms up to ${r0(w.feelsMax)}°${hot}.`);
  }

  // Rain.
  if (ctx.rainy) {
    if (o.outer?.water === 'yes') { score += 1.5; why.push(`The ${lower(o.outer)} handles the ${ctx.popMax}% rain chance`); }
    else if (o.outer?.water === 'unknown') { score += 0.2; asks.push({ itemId: o.outer.id, field: 'water', q: `Rain is likely. Is your ${lower(o.outer)} water-resistant?` }); }
    else { score -= 1.5; issues.push(`Rain likely (${ctx.popMax}%) and nothing here is water-resistant — take an umbrella`); }
    if (o.shoes.water === 'unknown' && o.shoes.type === 'boots') asks.push({ itemId: o.shoes.id, field: 'water', q: `Are your ${lower(o.shoes)} OK in the rain?` });
  } else if (ctx.showers) {
    advice.push(`${ctx.popMax}% chance of a shower — a compact umbrella is enough.`);
  }
  if (ctx.windy && !issues.some((i) => i.startsWith('Windy'))) advice.push(`Windy, up to ${r0(w.windMax)} km/h — it will feel cooler than the temperature.`);

  // Activity.
  if (ctx.moves.has('longwalk') && o.shoes.walk === 'yes') why.push(`${cap(o.shoes.name)} are comfortable for a long walk`);
  if (ctx.moves.has('longwalk') && o.shoes.walk === 'unknown') asks.push({ itemId: o.shoes.id, field: 'walk', q: `Are your ${lower(o.shoes)} comfortable for a long walk?` });
  if (ctx.moves.has('cycle') && o.shoes.cycle === 'unknown') asks.push({ itemId: o.shoes.id, field: 'cycle', q: `Can you cycle comfortably in your ${lower(o.shoes)}?` });

  // Formality.
  const level = items.reduce((s, it) => s + (it.formality[0] + it.formality[1]) / 2, 0) / items.length;
  const maxDist = Math.max(...items.map((it) => formalityDistance(it, ctx.formality)));
  if (maxDist === 0) why.push(`${FORMALITY[Math.round(ctx.formality)].label} — right for ${ctx.plan.label.toLowerCase()}`);
  else if (maxDist >= 1) {
    const off = items.find((it) => formalityDistance(it, ctx.formality) >= 1);
    issues.push(`The ${lower(off)} is ${ctx.formality > off.formality[1] ? 'more casual' : 'dressier'} than the occasion`);
  }

  // Colour & pattern harmony (soft).
  const colorIds = items.map((i) => i.color);
  const accents = [...new Set(colorIds.filter((c) => !COLOR[c]?.neutral))];
  if (accents.length === 0) { score += 0.4; if (why.length < 3) why.push('Calm, neutral palette'); }
  else if (accents.length === 1) { score += 0.7; if (why.length < 3) why.push(`${COLOR[accents[0]].label} as the single accent`); }
  else if (accents.length >= 3) score -= 1.4;
  const patterned = items.filter((i) => i.pattern && i.pattern !== 'solid');
  if (patterned.length > 1) score -= 1.2;
  if (o.top && o.bottom && o.top.color === o.bottom.color && !COLOR[o.top.color]?.neutral) score -= 0.4;

  // Learned combination feedback (pairs only, so one bad combo doesn't sink an item).
  const ps = ctx.prefs.pairScores || {};
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) score += (ps[pairKey(items[i].id, items[j].id)] || 0) * 0.6;

  return { score, why: why.slice(0, 3), issues: [...new Set(issues)], advice, asks: dedupeAsks(asks), level, full, core };
}

function dedupeAsks(asks) {
  const seen = new Set();
  return asks.filter((a) => { const k = a.itemId + a.field; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function outfitItems(o) {
  return [o.outer, o.layer, o.dress || o.top, o.dress ? null : o.bottom, o.shoes].filter(Boolean);
}

export function outfitKey(o) {
  return outfitItems(o).map((i) => i.id).sort().join('+');
}

export function wardrobeGaps(items) {
  const avail = items.filter((i) => i.status === 'available');
  const has = (slot) => avail.some((i) => i.slot === slot);
  const owns = (slot) => items.some((i) => i.slot === slot && i.ownership === 'owned');
  const missing = [];
  const add = (slot, text, alt) => missing.push({ slot, text, unavailable: owns(slot) || (alt && owns(alt)) });
  if (!has('top') && !has('dress')) add('top', 'a top', 'dress');
  if (!has('bottom') && !has('dress')) add('bottom', 'something for your legs (jeans, trousers or a skirt)', 'dress');
  if (!has('shoes')) add('shoes', 'a pair of shoes');
  return missing;
}

// Main entry. locks: { slot: itemId | 'none' }, exclude: Set of outfit keys.
export function recommend(items, ctx, { locks = {}, exclude = new Set(), max = 3 } = {}) {
  const avail = items.filter((i) => i.status === 'available' && i.ownership === 'owned');
  const gaps = wardrobeGaps(items);
  if (gaps.length) return { outfits: [], problem: { kind: 'incomplete', gaps }, suggestions: [] };

  const itemScores = new Map();
  const fails = {};
  for (const it of avail) {
    const s = scoreItem(it, ctx);
    itemScores.set(it.id, s);
    if (s.hard) fails[`${it.slot}:${s.hard}`] = (fails[`${it.slot}:${s.hard}`] || 0) + 1;
  }
  const pool = (slot, n = 8) => {
    if (locks[slot] && locks[slot] !== 'none') return avail.filter((i) => i.id === locks[slot]);
    return avail.filter((i) => i.slot === slot && !itemScores.get(i.id).hard)
      .sort((a, b) => itemScores.get(b.id).score - itemScores.get(a.id).score).slice(0, n);
  };
  const lockedBase = locks.dress ? 'dress' : (locks.top || locks.bottom) ? 'separates' : null;
  const tops = lockedBase === 'dress' ? [] : pool('top');
  const bottoms = lockedBase === 'dress' ? [] : pool('bottom');
  const dresses = lockedBase === 'separates' ? [] : pool('dress', 4);
  const layers = locks.layer === 'none' ? [null] : locks.layer ? pool('layer') : [null, ...pool('layer', 6)];
  const outers = locks.outer === 'none' ? [null] : locks.outer ? pool('outer') : [null, ...pool('outer', 6)];
  const shoes = pool('shoes', 6);

  const bases = [];
  for (const t of tops) for (const b of bottoms) bases.push({ top: t, bottom: b });
  for (const d of dresses) bases.push({ dress: d });

  const scored = [];
  const failCount = { too_cold: 0, too_warm: 0 };
  let warmestFull = 0;
  for (const base of bases) for (const l of layers) for (const ou of outers) for (const sh of shoes) {
    const o = { ...base, layer: l, outer: ou, shoes: sh };
    const s = scoreOutfit(o, ctx, itemScores);
    if (s.fail) { failCount[s.fail]++; if (s.full) warmestFull = Math.max(warmestFull, s.full); continue; }
    const key = outfitKey(o);
    if (exclude.has(key)) continue;
    scored.push({ ...o, ...s, key });
  }
  scored.sort((a, b) => b.score - a.score);

  const suggestions = gapSuggestions(avail, ctx, scored, fails, failCount);

  if (!scored.length) {
    return { outfits: [], problem: explainNoOutfit(ctx, fails, failCount, warmestFull, { tops, bottoms, dresses, shoes }, locks), suggestions };
  }

  // Diverse picks: trade a little score for difference in items and formality.
  const picks = [scored[0]];
  const candidates = scored.slice(0, 400);
  while (picks.length < max) {
    let best = null, bestVal = -Infinity;
    for (const c of candidates) {
      if (picks.includes(c)) continue;
      const ids = new Set(outfitItems(c).map((i) => i.id));
      let maxShared = 0, minLevelDiff = 9;
      for (const p of picks) {
        const shared = outfitItems(p).filter((i) => ids.has(i.id)).length;
        maxShared = Math.max(maxShared, shared);
        minLevelDiff = Math.min(minLevelDiff, Math.abs(p.level - c.level));
      }
      const n = ids.size;
      let val = c.score - 1.1 * maxShared + 0.9 * Math.min(minLevelDiff, 1.2);
      if (maxShared >= n - 1) val -= 2.5; // differs by only one item
      if (val > bestVal) { bestVal = val; best = c; }
    }
    if (!best || best.score < scored[0].score - 6) break;
    picks.push(best);
  }
  labelPicks(picks);
  return { outfits: picks, problem: null, suggestions };
}

function labelPicks(picks) {
  if (picks.length === 1) { picks[0].label = 'Best match'; return; }
  const sorted = [...picks].sort((a, b) => a.level - b.level);
  if (sorted[sorted.length - 1].level - sorted[0].level < 0.35) {
    picks.forEach((p, i) => (p.label = ['Best match', 'Alternative', 'Another option'][i]));
    return;
  }
  sorted[0].label = 'More relaxed';
  sorted[sorted.length - 1].label = 'More polished';
  if (sorted.length === 3) sorted[1].label = 'In between';
}

function explainNoOutfit(ctx, fails, failCount, warmestFull, pools, locks) {
  const lines = [];
  const cnt = (slot, kind) => fails[`${slot}:${kind}`] || 0;
  const level = FORMALITY[Math.round(ctx.formality)].label.toLowerCase();
  for (const slot of ['top', 'bottom', 'shoes']) {
    const pl = slot === 'top' ? pools.tops.length + pools.dresses.length : slot === 'bottom' ? pools.bottoms.length + pools.dresses.length : pools.shoes.length;
    if (pl === 0) {
      const label = { top: 'tops', bottom: 'bottoms', shoes: 'shoes' }[slot];
      if (cnt(slot, 'too_casual')) lines.push(`None of your available ${label} are dressy enough for ${level}.`);
      else if (cnt(slot, 'too_dressy')) lines.push(`All your available ${label} are dressier than ${level}.`);
      else if (cnt(slot, 'avoided')) lines.push(`Your available ${label} are all types you've chosen to avoid.`);
      else lines.push(`You have no available ${label} right now (check items marked as in the laundry).`);
    }
  }
  if (!lines.length && failCount.too_cold) lines.push(`Nothing you own is warm enough for ${r0(ctx.weather.feelsMin)}° feels-like. Your warmest combination gets to about ${Math.round((warmestFull / ctx.outCold) * 100)}% of what's needed.`);
  if (!lines.length && failCount.too_warm) lines.push(`Every combination is too warm for ${r0(ctx.weather.feelsMax)}°. Lighter tops or shoes would help.`);
  if (!lines.length && Object.keys(locks).length) lines.push('Nothing works with the locked item for today. Try unlocking it.');
  if (!lines.length) lines.push('No combination passed the checks for today.');
  return { kind: 'none', lines };
}

// Optional items that would help — never mixed into the owned outfit.
function gapSuggestions(avail, ctx, scored, fails, failCount) {
  const s = [];
  const best = scored[0];
  if (ctx.rainy && !avail.some((i) => i.slot === 'outer' && i.water === 'yes')) s.push({ type: 'rain_jacket', text: 'A water-resistant jacket would cover rainy days like this one.' });
  if (failCount.too_cold > 0 && (!best || best.full < ctx.outCold - 1)) s.push({ type: ctx.weather.feelsMin < 4 ? 'puffer' : 'wool_coat', text: `A warmer coat would help at ${r0(ctx.weather.feelsMin)}° feels-like.` });
  if (ctx.moves.has('longwalk') && !avail.some((i) => i.slot === 'shoes' && i.walk === 'yes')) s.push({ type: 'sneakers', text: 'Comfortable walking shoes for long days on your feet.' });
  if ((fails['top:too_casual'] || fails['bottom:too_casual'] || fails['shoes:too_casual']) && ctx.formality >= 4) {
    if (!avail.some((i) => i.slot === 'bottom' && i.formality[1] >= 4)) s.push({ type: 'trousers', text: 'Tailored trousers would cover smarter occasions.' });
    if (!avail.some((i) => i.slot === 'shoes' && i.formality[1] >= 4)) s.push({ type: 'loafers', text: 'Smarter shoes, such as loafers, would cover dressier plans.' });
  }
  if (ctx.hot && !avail.some((i) => (i.slot === 'bottom' || i.slot === 'dress') && TYPE[i.type].legs <= 1)) s.push({ type: 'shorts', text: 'Something lighter for your legs on hot days.' });
  return s.slice(0, 3);
}

// Alternatives for one slot, keeping the rest of the outfit.
export function alternatives(outfit, slot, items, ctx) {
  const avail = items.filter((i) => i.status === 'available' && i.ownership === 'owned');
  const itemScores = new Map(avail.map((i) => [i.id, scoreItem(i, ctx)]));
  const cands = avail.filter((i) => i.slot === slot && i.id !== outfit[slot]?.id);
  const res = cands.map((it) => {
    const o = { ...outfit, [slot]: it };
    const s = itemScores.get(it.id).hard ? { fail: itemScores.get(it.id).hard } : scoreOutfit(o, ctx, itemScores);
    return { item: it, outfit: o, ...s };
  });
  if ((slot === 'layer' || slot === 'outer') && outfit[slot]) {
    const o = { ...outfit, [slot]: null };
    res.push({ item: null, outfit: o, ...scoreOutfit(o, ctx, itemScores) });
  }
  return res.sort((a, b) => (a.fail ? 1 : 0) - (b.fail ? 1 : 0) || b.score - a.score);
}

export function rescore(outfit, ctx, items) {
  const avail = items.filter((i) => i.status === 'available');
  const itemScores = new Map(avail.map((i) => [i.id, scoreItem(i, ctx)]));
  const s = scoreOutfit(outfit, ctx, itemScores);
  return { ...outfit, ...s, key: outfitKey(outfit), label: outfit.label };
}

export const FAIL_TEXT = {
  too_cold: 'Too light for today',
  too_warm: 'Too warm for today',
  too_casual: 'Too casual for this plan',
  too_dressy: 'Dressier than this plan',
  avoided: "A type you've chosen to avoid",
};
