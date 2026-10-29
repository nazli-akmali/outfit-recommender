// Weather via Open-Meteo (https://open-meteo.com): free, no API key, CORS-enabled.
// Free tier is for non-commercial use; a commercial launch needs their paid plan
// or another provider behind the same getForecastWindow() interface.

const cache = new Map();

export async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Location search failed (${res.status}).`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

async function fetchWithTimeout(url, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'The weather service took too long to respond.' : "Couldn't reach the weather service. Check your connection.");
  } finally {
    clearTimeout(t);
  }
}

async function forecast(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,weather_code' +
    '&timezone=auto&forecast_days=3';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`The weather service returned an error (${res.status}).`);
  const data = await res.json();
  if (!data.hourly?.time) throw new Error('The weather service returned incomplete data.');
  cache.set(key, { at: Date.now(), data });
  return data;
}

// Returns hourly data for the hours the user is out, plus a summary.
// day: 0 = today, 1 = tomorrow (in the location's own timezone).
export async function getForecastWindow(location, day, start, end) {
  const data = await forecast(location.lat, location.lon);
  const nowLocal = new Date(Date.now() + data.utc_offset_seconds * 1000);
  const base = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate() + day));
  const dateStr = base.toISOString().slice(0, 10);
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startIdx = data.hourly.time.indexOf(`${dateStr}T${String(sh).padStart(2, '0')}:00`);
  if (startIdx < 0) throw new Error('No forecast is available for that time yet.');
  let span = (eh + (em > 0 ? 1 : 0)) - sh;
  if (span <= 0) span += 24; // returning after midnight
  const H = data.hourly;
  const hours = [];
  for (let i = startIdx; i <= Math.min(startIdx + span, H.time.length - 1); i++) {
    hours.push({
      time: H.time[i].slice(11, 16),
      temp: H.temperature_2m[i],
      feels: H.apparent_temperature[i],
      pop: H.precipitation_probability?.[i] ?? null,
      precip: H.precipitation?.[i] ?? 0,
      wind: H.wind_speed_10m?.[i] ?? 0,
      code: H.weather_code?.[i] ?? null,
    });
  }
  if (!hours.length) throw new Error('No forecast is available for that time window.');
  return summarize(hours, { source: 'Open-Meteo', date: dateStr, locationName: location.name });
}

export function summarize(hours, meta) {
  const min = (k) => Math.min(...hours.map((h) => h[k]));
  const max = (k) => Math.max(...hours.map((h) => h[k]));
  const coldest = hours.reduce((a, b) => (b.feels < a.feels ? b : a));
  const warmest = hours.reduce((a, b) => (b.feels > a.feels ? b : a));
  const pops = hours.map((h) => h.pop).filter((p) => p != null);
  return {
    ...meta,
    hours,
    tempMin: min('temp'), tempMax: max('temp'),
    feelsMin: min('feels'), feelsMax: max('feels'),
    coldestAt: coldest.time, warmestAt: warmest.time,
    popMax: pops.length ? Math.max(...pops) : null,
    precipSum: hours.reduce((s, h) => s + (h.precip || 0), 0),
    windMax: max('wind'),
    condition: describeCode(mode(hours.map((h) => h.code))),
  };
}

// Manual fallback when the forecast is unavailable.
export function manualWeather({ low, high, rain, windy }) {
  const hours = [
    { time: 'start', temp: low, feels: low - (windy ? 3 : 0), pop: rain ? 80 : 0, precip: rain ? 1 : 0, wind: windy ? 35 : 10, code: rain ? 61 : 2 },
    { time: 'later', temp: high, feels: high - (windy ? 3 : 0), pop: rain ? 80 : 0, precip: rain ? 1 : 0, wind: windy ? 35 : 10, code: rain ? 61 : 2 },
  ];
  const s = summarize(hours, { source: 'manual', locationName: 'Entered manually' });
  s.coldestAt = null; s.warmestAt = null;
  return s;
}

function mode(arr) {
  const c = {};
  let best = null;
  for (const v of arr) { c[v] = (c[v] || 0) + 1; if (best == null || c[v] > c[best]) best = v; }
  return best;
}

export function describeCode(code) {
  if (code == null) return '';
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorms';
}
