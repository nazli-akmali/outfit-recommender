# Wardrobe Assistant (MVP)

Suggests up to three outfits from clothes you own, based on your plans for the day and the forecast for the hours you'll be out.

## Run it

No build step and no dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open http://localhost:5173. Works best at phone width.

## Structure

| File | Purpose |
|---|---|
| `js/catalog.js` | Garment types and their typical defaults, the colour palette, and the built-in SVG illustrations |
| `js/store.js` | Local storage: JSON in localStorage, photos in IndexedDB; upload validation and re-encoding |
| `js/weather.js` | Open-Meteo forecast and geocoding, the time-window summary, manual fallback |
| `js/archive.js` | Archive providers: Wikimedia Commons (live) and the built-in library (offline, labelled) |
| `js/plan.js` | Day-plan presets, remembered settings, free-text keyword hints |
| `js/recommender.js` | Rule-based scoring with a reason recorded for each adjustment; swap alternatives; gap suggestions |
| `js/app.js` | UI views, sheets and actions |

## How recommendations work

1. **Warmth needed** comes from the coldest and warmest feels-like temperatures in your time window. It is adjusted by your temperature preference, learned feedback, activity (walking warms you, cycling adds wind chill) and how much of the day is outdoors.
2. **Items** are filtered by availability and dressiness, with penalties for poor fits: sandals in rain, shoes marked as bad for walking on a long-walk day, mini skirts on a bike, bare legs in the cold.
3. **Combinations**: a top and bottoms (or a dress), an optional layer, an optional jacket or coat, and shoes. Each is scored on:
   - warmth at the coldest hour
   - whether the layers you can't take off will be too warm indoors or in the afternoon
   - rain protection
   - dressiness
   - colour and pattern harmony
   - learned pair feedback
   - items worn recently
4. **Up to three picks**, chosen to differ from each other in items and dressiness. They are labelled "More relaxed", "In between" or "More polished".
5. **No outfit** is forced if nothing passes. The app explains what's missing, and any purchase ideas are shown separately under "Not in your wardrobe".

## Data and privacy

- Everything is stored **only in this browser**: no account, no server, no sync.
- Photos are downscaled and re-encoded through a canvas, which also removes EXIF metadata such as GPS location. They are stored as blobs in IndexedDB.
- Network calls:
  - Open-Meteo receives your city's coordinates.
  - Wikimedia Commons receives your archive search terms.
  - Archive images are loaded directly from Wikimedia.
- No API keys are needed. A Content-Security-Policy limits connections to these hosts.
- "Export backup" downloads your data as JSON (without photos). "Delete all my data" erases everything.

## Swapping providers

- **Weather:** keep the `getForecastWindow()` interface.
- **Archive:** add an object with `search()` to `PROVIDERS` in `archive.js`. A licensed retail or catalogue API would slot in here.
