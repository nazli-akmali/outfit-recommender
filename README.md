# Wardrobe Assistant (MVP)

Suggests up to three outfits from clothes you own, based on your plans for the day and the forecast for the hours you'll be out.

## Run it

No build step and no dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open http://localhost:5173. Works best at phone width.

The product requirements are in [REQUIREMENTS.md](REQUIREMENTS.md).

## Structure

| File | Purpose |
|---|---|
| `js/catalog.js` | Garment types (cuts, lengths, typical defaults), starter basics, collection ordering, the colour palette, and the SVG illustrations (fallbacks and icons) |
| `js/starter-catalog.js` | The curated starter catalogue: 83 examples, one per meaningful type × cut × length |
| `js/garments.js` | Garment photo manifest, on-device recolouring, and photo-or-illustration rendering. See [assets/garments/README.md](assets/garments/README.md) |
| `js/store.js` | Local storage: JSON in localStorage, photos in IndexedDB; upload validation and re-encoding |
| `js/weather.js` | Open-Meteo forecast and geocoding, the time-window summary, manual fallback |
| `js/archive.js` | Search: free-text parsing into filters, ranking of curated results (type → cut → length → colour), and the quality-filtered Wikimedia Commons provider |
| `js/plan.js` | Day-plan presets, remembered settings, free-text keyword hints |
| `js/recommender.js` | Rule-based scoring with a reason recorded for each adjustment; swap alternatives; gap suggestions |
| `js/app.js` | UI views, sheets and actions |

## Adding clothes

Setup is one shared flow for everyone:

1. An optional question: which collection to show first (Womenswear, Menswear or All clothing). It only changes the order; nothing is hidden, and it can be changed at any time.
2. One screen of everyday basics. "Can't find your item?" links to the larger catalogue and to photo upload.
3. A next-steps screen. "Get my first outfit suggestions" unlocks once a complete outfit is possible.

Afterwards, "Add clothing" in the wardrobe offers four options:
- starter basics;
- the catalogue, which has guided search and optional filters for category, type, cut, length, colour and pattern;
- a photo upload;
- importing from a product link.

Every route ends in a short confirmation step. It shows a preview and editable details. Warmth and water resistance start as typical values and are never guessed from the picture, and each one offers "Not sure". Editing an item later lets you correct its details or replace its image. The item keeps its ID, so outfits, history and feedback are preserved.

### Image sources

| Source | Status |
|---|---|
| Curated starter catalogue | Working, offline. Images are illustrated stand-ins (labelled) until photos are added to `MANIFEST`. |
| Your own photos | Working, on-device only. |
| Wikimedia Commons archive | Working, no key needed. Results are quality-filtered and labelled unverified. |
| Licensed retail API, product-link import | Need credentials or a server; not built. |
| Background removal | Deferred. |

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
  - Wikimedia Commons receives your online photo search terms.
  - Online photos are loaded directly from Wikimedia.
- No API keys are needed. A Content-Security-Policy limits connections to these hosts.
- "Export backup" downloads your data as JSON (without photos). "Delete all my data" erases everything.

## Swapping providers

- **Weather:** keep the `getForecastWindow()` interface.
- **Online catalogue:** implement the same `search({query, type, cut, color, offset, reported})` interface as `commonsProvider` in `archive.js`. A licensed retail or catalogue API would slot in here.
- **Garment photos:** add entries to `MANIFEST` in `garments.js`, including licence, credit and source. Mark generated images with `generated: true`.
