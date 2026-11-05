# Wardrobe Assistant — MVP requirements

Status: updated 2026-10-29. Sections 1–4 restate the agreed scope; sections 5–11 are additions (8–10 from the catalogue and item-adding update). Everything earlier still applies unless a later section says otherwise.

## 1. Goal

Help someone spend less time deciding what to wear. The app suggests up to three outfits built only from clothes they own, based on their plans for the day and the forecast for the hours they will be out. Setup stays lightweight and mobile-first, and gets the user to a first useful suggestion quickly.

## 2. Existing scope (unchanged)

- **Day planning:** presets (university, office, long walk, dinner) and a free-text description. Keyword hints fill in times, indoor/outdoor share, travel and dressiness, and the user can correct every value. Settings are remembered per preset.
- **Weather:** Open-Meteo forecast for the hours out, using the feels-like range, rain, and wind. If the forecast fails, the user can enter the weather manually.
- **Recommendations:** rule-based scoring for warmth, layers that are too warm indoors, rain, activity (walking or cycling), dressiness, colour and pattern harmony, learned feedback and recent wear. Each pick records why it was chosen. The app returns up to three picks that differ from each other. Items can be swapped and locked. If nothing suitable exists, the app explains what is missing rather than forcing an outfit. Purchase ideas are kept separate, under "Not in your wardrobe".
- **Feedback & learning:** feedback on worn outfits (too cold or warm, the occasion, comfort, the combination) and "Not for me" reasons. These adjust temperature bias, dressiness per plan type, pair scores and item flags.
- **Wardrobe management:** edit every attribute, with typical values marked "estimated" until confirmed. Items can be marked in the laundry or unavailable. There is also a wishlist, which is never used in outfits.
- **Privacy:** no account and local storage only. Photos are re-encoded, which strips EXIF data, and stay on the device. The user can export their data and delete all of it.

## 3. One shared experience

- R3.1 There is **one** onboarding, wardrobe, day-planning and weather flow for everyone. There are no separate men's and women's apps, tabs, or recommendation rules.
- R3.2 The app **never asks for gender**, and nothing the user can access depends on it.

## 4. Optional collection preference

- R4.1 At the start of wardrobe setup, ask once, optionally: **"Which collection would you like to see first?"** The options are *Womenswear*, *Menswear* and *All clothing*. Skipping counts as *All clothing*.
- R4.2 The preference only **orders** things. It never hides anything:
  - In the starter selection and the catalogue, garments from the preferred collection appear first. Those mainly from the other collection appear in a "More styles" group in the same list, one tap away at most.
  - The cut options and default cut follow the preference. For example, heels come before oxfords for Womenswear, and the reverse for Menswear.
  - Photo variants for a cut prefer the matching collection's fit when both exist.
- R4.3 The user can change the preference **at any time**: from the starter screen, from the catalogue, and from "You". The catalogue also has a one-tap *All* filter.
- R4.4 The preference is never used in recommendation scoring. Weather handling, day planning and the wardrobe are identical for every setting.

## 5. Adding clothing: starter basics, catalogue and uploads visible from the start

- R5.1 Setup opens with a **curated selection of common basics** on a single scrollable screen, grouped by category. It does not use a step-by-step wizard.
- R5.2 At the top: *"Start with a few everyday pieces. If you don't see your item, search the larger catalog or upload your own photo."*
- R5.3 A clearly visible **"Can't find your item?"** action sits next to the starter selection. It offers **Search the larger catalog** and **Upload a photo**. Each category also ends with an "Other …" tile, which opens the catalogue filtered to that category.
- R5.4 A footer stays visible during setup and shows **outfit readiness**. It reads either "Ready for outfit suggestions", or "Still needed: …", listing the missing categories.
- R5.5 After the starter selection there is a **next-steps screen** with three options:
  - Add more from the catalog.
  - Upload a photo.
  - **Get my first outfit suggestions** (the primary action).
- R5.6 Users never have to add their whole wardrobe. Suggestions are enabled as soon as a complete outfit is possible: a top and bottoms, or a dress, plus shoes, all available. Otherwise, the app names the missing categories and links straight to adding each one. Readiness uses the same rule as the recommender, so the two can't disagree. Users may also leave setup early ("Finish later"). In that case, Today repeats the missing-category message before asking about plans.
- R5.7 The wardrobe has a persistent **"Add clothing"** button that stays visible while scrolling. It offers all three methods: starter basics, the larger catalogue, and uploading a photo.
- R5.8 The larger catalogue has two sources, each clearly labelled. See section 8.
  - The **curated starter catalogue** is the primary source. It loads instantly and works offline.
  - **Online archive** (Wikimedia Commons) is a secondary source. It is openly licensed, searched live, quality-filtered and labelled as unverified.

## 6. Garment imagery

- R6.1 Selectable items (starter tiles, cut choices, catalogue results, wardrobe items) use **realistic garment photographs**. These are product-style shots on a removed or neutral background, with no model wearing the garment.
- R6.2 Consistent framing: the canvas has a 4:5 ratio and the garment is centred with about 8% padding. Each category is shot at the same scale, so a cropped cardigan really looks shorter than a long one. See `assets/garments/README.md` for the full specification.
- R6.3 The images must make meaningful differences visible:
  - Wide-leg versus baggy jeans.
  - A fine-knit cardigan versus a chunky one or a thick sweater.
  - Mini, midi and maxi lengths, and cropped, regular and long cuts.

  Cut choices are shown as **image tiles**, not text-only buttons.
- R6.4 **Rights:** every photo in the manifest records its source, licence and credit. The app refuses to display entries that lack them. Acceptable sources are our own photography, licensed stock, or a supplier feed whose licence covers this use.
- R6.5 **Colour variants:** an accurate photo for each colour is preferred. Otherwise, a neutral base photo with a transparent background is recoloured on the device. This keeps luminance detail, so fabric texture, shading, seams and buttons remain visible. Recoloured images are flagged in the manifest.
- R6.6 Illustrations are used for category icons, instructions and empty states. They also act as the **fallback** for any type, cut or colour that has no photo yet.
- R6.7 Wherever users pick from the catalogue, the app shows: *"Choose the closest match to your garment. You can replace it with your own photo later."*
- R6.8 **Correcting and replacing:** from the item editor, users can correct the type, cut, colour, pattern and attributes. They can also replace the image with their own photo, a different catalogue match, or an online photo. The item keeps its ID, so saved outfits, wear history, feedback and learned pairings are all kept. Catalogue images follow the item's current type, cut and colour automatically.
- R6.9 Thin and thick knits differ in warmth as well as appearance. A chunky cardigan starts with a higher estimated warmth than a fine one, and the recommender uses that value.

## 7. Image sources and integrations (status)

| Source / integration | Status | Notes |
|---|---|---|
| Curated starter catalogue (83 examples) | **Working** | Offline. Images are currently **illustrated stand-ins**, each labelled as such. |
| Real product photos / generated stand-ins | **Deferred** | The manifest pipeline, rights checks, recolouring and "Generated stand-in" labelling are built, but `MANIFEST` is empty. A licensed shoot, stock licence or supplier feed is needed. |
| Personal photo upload | **Working** | On-device only, EXIF stripped, framed with zoom and position controls. |
| Online archive (Wikimedia Commons) | **Working**, limited | No key needed. Metadata and pixel quality checks hide most results (in a "denim jacket" test, 29 of 30 were hidden), so it is a complement only. |
| Licensed retail product-image API or affiliate feed | **Needs credentials and a licence** | Plugs into the provider interface in `js/archive.js`. |
| Import from a product link | **Needs a server** | Retail pages block cross-origin fetches and their images aren't licensed for reuse. The app stores the link on the item and asks for a photo or a catalogue example instead (a labelled fallback). |
| Background removal | **Deferred** | Not available. Users are advised to use a plain background. The frame controls make up for some of this. |
| "Not relevant" reports | **Working, local only** | Reports hide the result on this device. Collecting them on a server is deferred. |

## 8. Curated catalogue and guided search

- R8.1 The primary catalogue is a **curated starter collection** of 83 examples (`js/starter-catalog.js`). There is one example per meaningful type × cut × length, and each has a short description and a list of typical colours. Colours are options on an example rather than separate entries, so there are no near-duplicates.
- R8.2 Search combines **free text** and **structured filters**: category → type → cut / fit → length → colour → pattern, plus the collection preference. The free text is parsed into those filters (for example, "light blue wide-leg jeans" sets jeans, wide-leg and light blue). Every filter shows as a removable chip, and words the app couldn't use are listed.
- R8.3 All filters are optional, and results appear immediately after any choice. There is no required sequence.
- R8.4 **Ranking** puts type first, then cut, then length, and colour last. A wrong colour costs less than a wrong shape, because the colour can be set on the item. Results are grouped into **"Closest matches"** and **"Similar, but a different shape"**, and each similar result says how it differs (for example, "Different cut: straight instead of wide-leg").
- R8.5 The app never claims an exact match. Catalogue images are described as examples, and approximate picks show a warning in the confirmation step.

## 9. Confirmation step

- R9.1 Picking an example, uploading a photo or using a stand-in opens a short **confirmation sheet**. It shows the preview and the editable details: type, cut, length, colours (several can be chosen for the catalogue), pattern, thickness, water resistance, walking comfort and cycling.
- R9.2 Warmth, waterproofing and walking comfort are **never inferred from the image**. They start as typical values for the type, tagged "typical for this type — not checked". Every field allows **"Not sure"**, which leaves the estimate in place.
- R9.3 Adding takes three taps from a search: search, pick, add. Everything can be edited later from the item editor.

## 10. Colour, presentation and missing matches

- R10.1 The **compact palette** shows named swatches: white, off-white, cream, beige; light blue, medium blue, navy; light grey, mid grey, dark grey, black; and three denim washes. **"More colours"** opens the full set (camel, brown, olive, red, burgundy, pink, green, and others). **Multicolour** and patterns (stripes, checks, print / floral) are supported separately.
- R10.2 Colour is stored as an attribute separate from the image. Changing it never needs a new photo.
- R10.3 **No match:** the app shows *"We couldn't find a close match. Upload your own photo or continue with an approximate example."* It offers three ways forward: Upload a photo, Broaden filters (removes the narrowest filter) and Use an approximate example.
- R10.4 Users can mark any result as **"Not relevant"**. The result is hidden on that device and the count is shown.
- R10.5 **Online archive quality checks:**
  - Metadata check: image type, a minimum size of 300 px, an aspect ratio of 0.45–1.7, no person or scene words, and the garment named in the title or description.
  - On-device pixel check: a plain border and a centred subject.

  Hidden counts are shown with their reasons.
- R10.6 **Frames:** every image sits in the same 4:5 frame with its proportions kept (contain, never stretched). Personal and archive images have **zoom and position controls** plus a reset. Framing is stored as settings, so the original image is never changed.
- R10.7 Replacing an image (from a catalogue example, an upload or the archive) keeps the item's ID, attributes, outfit references and history. Values the user confirmed stay as they are unless the confirmation sheet changes them.

## 11. Open items

- **Photo assets:** choose a source: a studio shoot, licensed stock, a supplier feed, or clearly labelled photorealistic generated stand-ins. The priority set is the 83 curated examples × one neutral base each.
- **Larger online source:** a licensed retail product API would replace Wikimedia as the main online source. It needs credentials and a licence agreement.
- **Product-link import:** needs a server-side fetcher, plus image rights from the retailer.
- **Background removal** with review and restore: deferred.
- **Report collection:** server-side aggregation is deferred. Reports currently stay local.
