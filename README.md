# Wardrobe Assistant

**Choose an outfit for your day, using the clothes you already own.**

A browser-based MVP that combines your wardrobe, plans, and weather during the hours you are out to suggest up to three explained outfits.

**Status:** Functional MVP; user validation pending.  
**Built with:** Vanilla JavaScript, Open-Meteo, localStorage, and IndexedDB.  
**Project focus:** Product discovery, UX iteration, and AI-assisted implementation.

## The problem

Choosing an outfit takes more than finding clothes that look good together. It also means accounting for a cold morning, a warm indoor space, a walking commute, and a different occasion later in the day.

Wardrobe Assistant explores whether a day-first flow and a quick starter wardrobe can reduce the effort of reaching an outfit someone would actually wear.

**[Read the product case study →](docs/PRODUCT_CASE_STUDY.md)** for the competitor exploration, scope decisions, iterations, and validation plan. Detailed requirements are in [REQUIREMENTS.md](REQUIREMENTS.md).

## What it does

- **Build a starter wardrobe:** Choose from 83 curated garment examples, upload personal photos, or use a secondary online image search. Edit colors, cuts, warmth, and other attributes.
- **Plan a specific day:** Enter your occasion, departure and return times, activity, and indoor/outdoor needs. Presets and lightweight text parsing help fill editable fields.
- **Use the relevant weather:** Check feels-like temperature, rain, and wind within the selected time window. Enter conditions manually if the forecast is unavailable.
- **Compare explained outfits:** Receive up to three options—more relaxed, in between, and more polished—when suitable combinations exist.
- **Adjust the result:** Lock an item, swap another, save outfits, and exclude clothes in the laundry or otherwise unavailable.
- **Give feedback after wear:** Record comfort and occasion-fit feedback, which adjusts local rule-based preferences.

Recommendations use only available, owned clothes. Wishlist items remain separate. If an important garment is missing, the app explains the gap instead of forcing an outfit.

## Try the main flow

1. Add a small, balanced selection of clothes. The readiness indicator shows which categories are still needed.
2. Describe where you are going, when you will be out, and how you will travel.
3. Check the forecast and compare the suggested outfits and explanations.
4. Swap or lock items, then record feedback after wearing an outfit.

No account is required. An optional Womenswear / Menswear / All clothing preference changes catalog ordering only; it does not restrict clothes or affect recommendations.

## Run locally

**Requirements:** A modern browser and a local HTTP server. Python 3 is one option; no package installation or build step is required.

From the project root:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Open [http://localhost:5173](http://localhost:5173). It works best at phone width. Serve the files over HTTP rather than opening the HTML file directly so JavaScript modules load correctly.

Forecast retrieval and optional online image search require an internet connection. The curated catalog is bundled locally.

## How it works

### Recommendations

The recommender uses explicit rules and scoring rather than a trained AI styling model.

1. **Warmth needed** comes from the coldest and warmest feels-like temperatures in your time window, adjusted by temperature preference, learned feedback, activity (walking warms you, cycling adds wind chill), and time spent outdoors.
2. **Items** are filtered by availability and formality, with penalties for poor fits: sandals in rain, shoes marked as bad for walking on a long-walk day, mini skirts on a bike, bare legs in the cold.
3. **Combinations** (a top and bottoms or a dress, an optional layer, an optional jacket or coat, and shoes) are scored on warmth at the coldest hour, overheating from layers you can't remove, rain protection, formality, color and pattern compatibility, learned pair feedback, and recent wear.
4. **Up to three varied picks** are labeled More relaxed, In between, or More polished. Each records why it was chosen.

### Adding clothes

Every route — starter basics, catalog search, photo upload, or a saved product link — ends in a short confirmation step with a preview and editable details. Warmth, water resistance, and walking comfort start as labeled typical values for the garment type and are never inferred from the image; each offers "Not sure".

Catalog search parses free text ("light blue wide-leg jeans") into removable type, cut, length, color, and pattern filters, and lists any words it couldn't use. Results are ranked by garment structure before color — type, then cut, then length — and split into close matches and different-shape alternatives. Replacing an item's image keeps its ID, so saved outfits, wear history, and feedback are preserved.

### Image sources

| Source | Status |
| --- | --- |
| Curated catalog (83 examples) | Working, offline. Images are labeled illustrations until licensed photos are added to `MANIFEST` |
| Personal photos | Working, stored on the device only |
| Wikimedia Commons archive | Working, no API key. Results are quality-filtered and labeled unverified |
| Licensed retail API, product-link extraction | Not built; need credentials, a server, and image rights |
| Background removal | Deferred; users can adjust framing instead |

### Modules

| Module | Responsibility |
| --- | --- |
| `catalog.js` | Garment types (cuts, lengths, typical defaults), colors, collection ordering, and SVG illustrations |
| `starter-catalog.js` | The 83 curated garment examples |
| `garments.js` | Photo manifest with license metadata, on-device recoloring, and photo-or-illustration rendering. See [assets/garments/README.md](assets/garments/README.md) |
| `archive.js` | Search parsing, curated-result ranking, and the filtered Wikimedia Commons provider |
| `store.js` | Browser-local records, photo storage, and upload re-encoding |
| `weather.js` | Open-Meteo forecast retrieval, time-window summary, and manual fallback |
| `plan.js` | Day-plan presets and parsing |
| `recommender.js` | Outfit constraints, scoring, and preference adjustments |
| `html.js` | Text-escaping template helper |
| `app.js` | Screens and interactions |

### Extending

- **Weather:** keep the `getForecastWindow()` interface.
- **Online catalog:** implement the same `search({query, type, cut, color, offset, reported})` interface as `commonsProvider` in `archive.js`. A licensed retail API would slot in here.
- **Garment photos:** add entries to `MANIFEST` in `garments.js` with license, credit, and source. Mark generated images with `generated: true` so the app labels them.

## Data and privacy

Wardrobe records and preferences are stored in localStorage; uploaded photos are stored in IndexedDB. There is no application backend, account, or cross-device sync.

External services receive requests only when those features are used: Open-Meteo receives your city's coordinates, and Wikimedia Commons receives online search terms and serves the result images. No API keys are needed, and a Content Security Policy restricts connections to these hosts.

Uploads are downscaled and re-encoded to strip metadata such as GPS location. The app provides a JSON export (without photos) and local deletion. Clearing browser site data can remove the wardrobe, so keep an export before doing so.

## Current limitations

- **Illustrations, not a photographic catalog:** All 83 curated examples currently use labeled illustrations. Licensed garment photography is the main outstanding visual improvement.
- **Limited online sourcing:** Filtered Wikimedia results are a secondary, unverified source, and the quality filters hide most results. A licensed retail catalog is not integrated.
- **No automatic product-link extraction or background removal:** Links can be saved; users supply photos and adjust framing.
- **Early recommendation logic:** Comfort and style judgments use simplified rules. Larger wardrobes and the effectiveness of preference adjustments need further evaluation.

The main journeys were manually checked in a browser at phone width. Time saved, recommendation quality, and user retention have not yet been established through structured user research.

## My contribution

I shaped the problem, explored competing apps, defined and prioritized requirements, and guided iterations in wardrobe setup, catalog search, and the day-planning experience. AI assistants supported research synthesis, prototyping, implementation, and debugging.

The [product case study](docs/PRODUCT_CASE_STUDY.md) documents these decisions, the tradeoffs behind them, and what I would validate next.

## Next steps

1. Introduce consistent, licensed garment photography.
2. Test starter-wardrobe setup and time to the first useful outfit with new users.
3. Evaluate recommendations and feedback adjustments across several days of actual wear.

A later purchase helper could evaluate how a candidate item complements the existing wardrobe. It is outside the current MVP.

---

Created by **Seyedeh Nazli Akmali** as a personal product management portfolio project, with AI-assisted implementation.
