# Garment photos

Catalogue items use realistic product photos when one is listed in `MANIFEST` in `js/garments.js`. Anything without a photo falls back to the built-in illustration, so assets can be added a few at a time.

## What to shoot or license

- **Content:** a single garment as a flat lay or on a ghost mannequin. No model and no props.
- **Background:** removed (transparent PNG or WebP). Base photos used for recolouring **must** be transparent, because recolouring affects every non-transparent pixel.
- **Canvas:** 4:5 portrait at 1200 × 1500 px, with the garment centred and about 8% padding on the longest side.
- **Scale:** one fixed scale per category, so length differences show. A cropped cardigan should look shorter than a long one, and a mini skirt shorter than a maxi.
- **Lighting:** soft and even, from the same direction across the set. Keep the natural shadows inside the garment, because they carry the texture.
- **Must be distinguishable:**
  - Every cut in `TYPES[].cuts`. Priorities: wide-leg vs baggy vs straight jeans, fine-knit vs chunky cardigans, and mini, midi and maxi lengths.
  - Knit weight: a chunky cardigan or sweater should look thick.
- **Colour:** an accurate photo of each colour variant is preferred. Otherwise, add one **base** photo per type and cut in a light, neutral colour (light grey or off-white works best). The app recolours it on the device and keeps the luminance detail.
- **Length:** types with lengths (jeans, skirts, dresses, cardigans, coats) need one photo per length. Tag them with `length` (see `TYPES[].lengths`).
- **Fit variants:** if Womenswear and Menswear fits of a cut look meaningfully different, add both and tag them with `coll: 'w'` or `coll: 'm'`. The user's collection preference picks which one to show first.

## Rights

Only use images we are allowed to use: our own photography, licensed stock, or a supplier feed whose licence covers display in this app. Photorealistic generated stand-ins are allowed if they are marked `generated: true`. The app then labels them "Generated stand-in" so they're never presented as real products. Every manifest entry needs `license`, `credit` and `source`. Entries missing any of these are skipped, and the app logs a console warning.

## Manifest entry

```js
// js/garments.js
export const MANIFEST = [
  // Base photo, recoloured for every colour without its own photo.
  { type: 'jeans', cut: 'wide-leg', src: 'assets/garments/jeans-wide-leg-base.png',
    license: 'Studio shoot, all rights owned', credit: 'In-house', source: 'shoot-2026-11' },
  // Exact colour variant (preferred over recolouring).
  { type: 'jeans', cut: 'wide-leg', color: 'denim', src: 'assets/garments/jeans-wide-leg-denim.png',
    license: 'Studio shoot, all rights owned', credit: 'In-house', source: 'shoot-2026-11' },
  // A length variant, as a clearly labelled generated stand-in.
  { type: 'skirt', cut: 'a-line', length: 'midi', src: 'assets/garments/skirt-a-line-midi-base.png',
    license: 'Generated, owned', credit: 'Image model', source: 'gen-2026-11', generated: true },
];
```

Patterned items (striped, checked, printed) use the illustration until the user uploads their own photo, because a plain photo would misrepresent them.

## First batch

Start with the curated catalogue (`EXAMPLES` in `js/starter-catalog.js`): one neutral base photo for each of its 83 type × cut × length examples.
