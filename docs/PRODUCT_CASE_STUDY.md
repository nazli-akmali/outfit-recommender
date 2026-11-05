# Wardrobe Assistant — Product Case Study

[← Project overview and setup](../README.md)

How a personal outfit-selection problem became a day-first wardrobe MVP, and what changed during discovery and implementation.

**Role:** Product discovery, requirements, prioritization, and iteration · **Approach:** AI-assisted design and implementation · **Stage:** Functional MVP; user validation pending

## Why I built it

The starting point was a personal frustration: I generally enjoy putting outfits together, but deciding what to wear still takes time. The harder part is making the outfit work for the entire day—walking to university, spending hours indoors, going to a café afterwards, and coming home when it is colder.

A visually appealing outfit does not necessarily solve that problem. It also needs to suit the weather, the activity, the occasion, and the clothes that are actually available.

My goal was to reduce the effort between **“Here is my day”** and **“Here are a few outfits I could realistically wear.”** Whether the MVP achieves that goal remains a question for user testing.

## My role and how I used AI

I developed the product direction, defined and refined requirements, tested competing apps, and used feedback from implementation to make scope and UX decisions. I used AI assistants for brainstorming, requirements refinement, prototyping, coding, and debugging.

This project demonstrates my product thinking through an implemented MVP. The code was developed with AI assistance; the portfolio contribution is the problem framing, prioritization, iteration, and evaluation of the resulting experience.

## From a broad idea to a focused MVP

The original concept included personal styling, body-shape guidance, color analysis, inspiration images, and suggestions for versatile purchases. I narrowed the MVP around two connected problems:

1. Choosing a suitable outfit for a specific day.
2. Building enough of a digital wardrobe to make that recommendation useful.

Shopping support remains a future direction. Social features, virtual try-on, and body-shape analysis were excluded from the initial scope.

### What competitor testing changed

I explored Cladwell and Acloset to understand their existing solutions. In my own testing, Cladwell’s style-discovery experience was more prominent than the day-planning features I was looking for. Acloset covered much more of the core need: relatively easy wardrobe setup, weather and location, occasion inputs, and rejection feedback with reasons such as unsuitable weather or occasion.

That challenged my initial assumption that combining weather, occasion, and a personal wardrobe would be a meaningful differentiator on its own.

I reframed the opportunity as a hypothesis about the experience:

> Can a day-first flow and a faster starter wardrobe help users reach their first useful outfit with less effort?

This is a hypothesis to test, not a claim that the product outperforms those alternatives. The observations above reflect my exploratory use, not an exhaustive audit of either app.

## The main user journey

### 1. Start small: build a usable wardrobe

Users can select common basics, search the catalog, or upload personal garment photos. They can begin with a small selection and add more over time.

An optional **Womenswear / Menswear / All clothing** preference changes the order in which items appear. It does not ask for gender, restrict access to clothes, or influence recommendations.

“Can’t find your item?” is visible from the start. A sticky readiness indicator identifies missing categories and signals when a complete outfit is possible, using the same completeness rule as the recommender. This signals structural readiness, not a guarantee that the wardrobe is suitable for every weather condition or occasion.

### 2. Describe the day

Users select presets such as university, office, long walk, or dinner, or describe their plans in their own words. The app extracts supported details into editable fields, including times, travel, and formality. This is lightweight parsing rather than unrestricted natural-language understanding.

### 3. Check the weather during that time

The app retrieves an Open-Meteo forecast for the selected location and hours outside. It considers the lowest and highest feels-like temperatures, rain, and wind during that window. If retrieval fails, users can enter conditions manually.

### 4. Compare a few explained options

The app returns up to three suggestions labeled **More relaxed**, **In between**, and **More polished**, when suitable combinations exist. Users can lock a garment, swap another, and save outfits.

If the wardrobe cannot meet important conditions, the app explains what is missing rather than forcing a suggestion.

### 5. Feed back the experience

After wearing an outfit, users can report that it was too cold, too warm, too casual, or uncomfortable. Feedback adjusts a local temperature preference, occasion-specific formality preferences, and item-pair preferences.

These are rule-based adjustments, not a trained machine-learning model. Their usefulness still needs validation over repeated wear.

## The biggest iteration: making wardrobe setup useful

The first implementation allowed live Wikimedia Commons image search. In practice, many results were unsuitable: people wearing clothes, street scenes, inconsistent framing, or poor-quality garment images.

This exposed an important product problem: a large image source is not necessarily a useful wardrobe catalog. If people cannot recognize something close to their own clothes, quick setup loses its value.

| Initial approach | Final MVP decision | Reason |
| --- | --- | --- |
| Live image search as a main source | An offline catalog of 83 curated garment examples; filtered Wikimedia results as a secondary source | Prioritize recognizable, relevant examples over result volume |
| A six-step setup wizard | One browsable basics screen with category access and a sticky readiness indicator | Let users move directly to the garments they own |
| General text search | Supported search terms populate removable type, cut, and color filters; unrecognized words are shown | Make search interpretation visible and correctable |
| Treating visual similarity too broadly | Rank garment structure before color; separate close matches from different-shape alternatives | Wrong-cut jeans are a poor stand-in even when the color matches |
| Implicit garment assumptions | A confirmation step with editable attributes, labeled typical values, and “Not sure” options | Avoid treating appearance as evidence of warmth or waterproofing |
| Inconsistent image presentation | Shared 4:5 frames, with zoom and positioning for personal photos | Make the wardrobe easier to scan and compare |

The supported search → select → confirm flow aims to keep adding an item short. Replacing an item’s image preserves its identity, saved outfit references, wear history, and feedback.

### Photography: an unresolved constraint

The intended experience uses clean garment photographs. However, suitable licensed photography was not secured for this version. **All 83 curated catalog examples currently use labeled illustrations.** The catalog should not be mistaken for a completed photographic product database.

The image pipeline supports source and license metadata, consistent presentation, and on-device recoloring of compatible neutral images. It is prepared for licensed photography, but the assets and their visual quality still need to be supplied and reviewed.

## How recommendations work

The recommender uses explicit rules and scoring rather than a black-box styling model. It evaluates candidate combinations from available, owned garments against:

- Warmth at the coldest relevant hour.
- Indoor overheating risk from layers that cannot easily be removed.
- Rain protection and wind-related needs.
- Activity requirements, including walking, cycling, and freedom of movement.
- Occasion and formality.
- Color and pattern compatibility.
- Recent wear and learned preferences.

It aims to return suitable, varied options and explain their tradeoffs. Items marked as unavailable or in the laundry are excluded, and wishlist items never enter the recommendation pool.

The rules make decisions inspectable and easier to debug. They also have limits: incomplete garment attributes, simplified thermal assumptions, and subjective style preferences can all affect suggestion quality.

## Testing and evidence

Manual browser checks at phone width covered setup, day planning, recommendations, swapping and locking, feedback, catalog search, photo uploads, image replacement, and no-match recovery.

Iteration addressed UI state collisions, repeated animations, search-field focus loss during rerendering, blocked online thumbnails, and confusing color labels.

These checks establish that the main journeys were exercised and implementation issues were fixed. They do **not** establish recommendation accuracy, time saved, retention, or improvement over competing products. This project has not yet undergone a structured multi-user usability study or longitudinal wear test.

## Current limitations

| Area | Current state |
| --- | --- |
| Catalog photography | Curated examples are illustrations; licensed garment photography remains the main visual gap |
| Broader online catalog | Wikimedia is a filtered, unverified supplement; a suitable licensed product feed is not integrated |
| Product-link import | Saves the link and asks for a photo; automatic extraction is not implemented. Reliable extraction and image reuse require separate technical and source-permission decisions |
| Background removal | Deferred; users can adjust image framing instead |
| Storage | Browser-local only, with no account sync |
| Relevance reports | Hide results locally; there is no shared moderation or reporting backend |
| Personalization | Lightweight local preference updates; effectiveness has not yet been validated |
| Recommendation scale | Candidate-combination evaluation needs performance testing with larger wardrobes |

## What I would validate next

| Question | Proposed evaluation |
| --- | --- |
| Is wardrobe setup genuinely easier? | Observe new users building a balanced starter wardrobe; record time, corrections, and abandonment |
| Do users reach a useful first suggestion? | Measure time to the first outfit they would actually wear, separating setup from repeat use |
| Do outfits work for the whole day? | Collect post-wear comfort and occasion-fit feedback over several days |
| Does feedback improve recommendations? | Track repeated mismatches and whether the preference adjustments reduce them |
| Is this flow preferable to existing options? | Compare equivalent tasks using the same wardrobe and day scenarios |

No target results or improvements are claimed yet. These evaluations would determine whether to refine the current flow before expanding the feature set.

## Future direction

The next product step is stronger garment imagery and evidence from real use. After that, a purchase helper could assess a candidate item against the existing wardrobe: which useful outfits it adds, which situations it supports, and whether it duplicates something already owned.

Inspiration-image support and a licensed retail catalog are possible extensions. They should build on a reliable wardrobe and recommendation experience rather than distract from it.

## What I learned

- **Competitor testing changed the opportunity.** Weather-aware recommendations already existed; the more useful question became how quickly someone could reach a satisfactory result.
- **Onboarding is part of the recommendation system.** Faster setup only helps when the recorded clothes are accurate enough to support useful suggestions.
- **Image sourcing is a product dependency.** Availability, relevance, consistency, and usage rights influence the experience as much as the interface does.
- **An honest fallback is a feature.** Missing-clothing guidance, manual weather entry, and approximate-item labels help users understand what the system can and cannot do.
- **A working MVP is the beginning of validation.** Implementing the journey makes the product testable; it does not prove the original hypothesis.

---

Created by **Seyedeh Nazli Akmali** as a personal product management portfolio project, with AI-assisted design and implementation.
