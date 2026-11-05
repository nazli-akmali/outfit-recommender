// Curated starter catalogue: one example per meaningful garment type × cut ×
// length, chosen for coverage rather than volume. Colours are offered per
// example instead of being separate entries, so there are no near-duplicates.
// Images come from the photo manifest (js/garments.js) when one exists, and
// otherwise from the labelled illustration stand-in.
import { TYPE } from './catalog.js';

const ex = (type, cut, length, colors, note) => ({ id: `${type}:${cut}${length ? ':' + length : ''}`, type, cut, length, colors, note });

export const EXAMPLES = [
  // Tops
  ex('tshirt', 'regular', null, ['white', 'black', 'grey', 'navy', 'offwhite'], 'Classic crew neck, straight body'),
  ex('tshirt', 'oversized', null, ['white', 'black', 'grey'], 'Boxy and longer, dropped shoulders'),
  ex('tshirt', 'fitted', null, ['white', 'black'], 'Sits close to the body'),
  ex('longsleeve', 'regular', null, ['white', 'black', 'grey', 'navy'], 'Plain jersey, straight body'),
  ex('longsleeve', 'fitted', null, ['black', 'white'], 'Close-fitting, good for layering'),
  ex('shirt', 'regular', null, ['white', 'lightblue', 'blue'], 'Collared, straight body'),
  ex('shirt', 'oversized', null, ['white', 'lightblue'], 'Roomy with dropped shoulders'),
  ex('shirt', 'fitted', null, ['white', 'lightblue', 'black'], 'Shaped through the waist'),
  ex('blouse', 'regular', null, ['white', 'cream', 'black'], 'Light woven top, relaxed'),
  ex('blouse', 'fitted', null, ['black', 'white'], 'Light woven top, closer fit'),
  ex('tank', 'regular', null, ['white', 'black'], 'Wider straps, relaxed'),
  ex('tank', 'fitted', null, ['white', 'black', 'offwhite'], 'Thin straps, close fit'),
  ex('polo', 'regular', null, ['navy', 'white', 'black'], 'Knit collar and short placket'),
  // Bottoms
  ex('jeans', 'skinny', 'full', ['darkdenim', 'black', 'denim'], 'Tight from hip to ankle'),
  ex('jeans', 'slim', 'full', ['denim', 'darkdenim', 'black'], 'Narrow but not tight'),
  ex('jeans', 'straight', 'full', ['denim', 'lightdenim', 'darkdenim', 'black'], 'Same width from knee to hem'),
  ex('jeans', 'straight', 'cropped', ['lightdenim', 'denim'], 'Straight leg ending above the ankle'),
  ex('jeans', 'bootcut', 'full', ['denim', 'darkdenim'], 'Slim thigh, slight flare from the knee'),
  ex('jeans', 'wide-leg', 'full', ['lightdenim', 'denim', 'darkdenim'], 'Fitted at the hip, wide from thigh to hem'),
  ex('jeans', 'wide-leg', 'cropped', ['lightdenim', 'white'], 'Wide leg ending above the ankle'),
  ex('jeans', 'baggy', 'full', ['lightdenim', 'denim', 'black'], 'Loose everywhere, including the seat'),
  ex('trousers', 'slim', 'full', ['black', 'charcoal', 'navy'], 'Narrow tailored leg'),
  ex('trousers', 'straight', 'full', ['black', 'charcoal', 'beige', 'navy'], 'Pressed crease, straight leg'),
  ex('trousers', 'wide-leg', 'full', ['black', 'cream', 'charcoal'], 'High waist, wide fluid leg'),
  ex('trousers', 'wide-leg', 'cropped', ['black', 'beige'], 'Wide leg ending above the ankle'),
  ex('chinos', 'slim', 'full', ['beige', 'navy', 'olive'], 'Cotton twill, narrow leg'),
  ex('chinos', 'straight', 'full', ['beige', 'navy', 'olive', 'khaki'], 'Cotton twill, straight leg'),
  ex('chinos', 'wide-leg', 'full', ['beige', 'olive'], 'Cotton twill, relaxed wide leg'),
  ex('joggers', 'regular', null, ['grey', 'black', 'navy'], 'Elastic waist and cuffs'),
  ex('shorts', 'regular', 'short', ['denim', 'beige', 'black'], 'Mid-thigh length'),
  ex('shorts', 'regular', 'knee', ['beige', 'navy', 'olive'], 'Just above the knee'),
  ex('skirt', 'a-line', 'mini', ['black', 'denim'], 'Flares slightly, above mid-thigh'),
  ex('skirt', 'a-line', 'midi', ['black', 'beige', 'denim'], 'Flares slightly, below the knee'),
  ex('skirt', 'a-line', 'maxi', ['black', 'beige'], 'Flares slightly, to the ankle'),
  ex('skirt', 'pencil', 'midi', ['black', 'charcoal', 'camel'], 'Straight and close-fitting'),
  ex('skirt', 'pleated', 'midi', ['black', 'beige', 'navy'], 'Pleats from waist to hem'),
  ex('leggings', 'regular', null, ['black', 'charcoal'], 'Stretch, full length'),
  // Dresses
  ex('dress', 'shift', 'mini', ['black', 'navy'], 'Straight, no waist seam, above the knee'),
  ex('dress', 'shift', 'midi', ['black', 'navy'], 'Straight, no waist seam, below the knee'),
  ex('dress', 'a-line', 'midi', ['black', 'navy', 'green'], 'Fitted top, flared skirt'),
  ex('dress', 'a-line', 'maxi', ['black', 'navy'], 'Fitted top, flared to the ankle'),
  ex('dress', 'wrap', 'midi', ['black', 'green', 'burgundy'], 'Crosses over at the front, tie waist'),
  ex('dress', 'slip', 'midi', ['black', 'cream', 'burgundy'], 'Thin straps, bias cut'),
  ex('dress', 'slip', 'maxi', ['black'], 'Thin straps, to the ankle'),
  // Knitwear & layers
  ex('hoodie', 'regular', null, ['grey', 'black', 'navy'], 'Pullover with hood and pocket'),
  ex('hoodie', 'oversized', null, ['grey', 'black', 'cream'], 'Roomy, dropped shoulders'),
  ex('sweatshirt', 'regular', null, ['grey', 'navy', 'black'], 'Crew neck, ribbed cuffs'),
  ex('sweater', 'crew', null, ['cream', 'navy', 'black', 'grey', 'camel'], 'Round-neck knit'),
  ex('sweater', 'v-neck', null, ['navy', 'grey', 'black'], 'V-neck knit, good over shirts'),
  ex('sweater', 'turtleneck', null, ['black', 'cream', 'camel'], 'Folded high neck'),
  ex('cardigan', 'fine-knit', 'regular', ['beige', 'black', 'grey', 'navy'], 'Thin knit, buttons, hip length'),
  ex('cardigan', 'fine-knit', 'cropped', ['cream', 'black'], 'Thin knit, ends at the waist'),
  ex('cardigan', 'chunky', 'regular', ['cream', 'grey', 'brown'], 'Thick, textured knit'),
  ex('cardigan', 'chunky', 'long', ['beige', 'grey'], 'Thick knit to mid-thigh or longer'),
  ex('blazer', 'regular', null, ['black', 'navy', 'beige'], 'Tailored, structured shoulders'),
  ex('blazer', 'oversized', null, ['black', 'beige', 'charcoal'], 'Longer and roomier'),
  // Jackets & coats
  ex('denim_jacket', 'regular', null, ['denim', 'lightdenim'], 'Classic trucker, hip length'),
  ex('denim_jacket', 'oversized', null, ['lightdenim'], 'Boxy and longer'),
  ex('light_jacket', 'regular', null, ['black', 'olive', 'navy'], 'Light bomber with ribbed hem'),
  ex('leather_jacket', 'regular', null, ['black', 'brown'], 'Biker style, zip front'),
  ex('rain_jacket', 'regular', null, ['navy', 'yellow', 'black', 'olive'], 'Hooded shell'),
  ex('trench', 'regular', 'long', ['beige', 'black'], 'Belted, double-breasted, knee length'),
  ex('trench', 'regular', 'short', ['beige'], 'Belted, thigh length'),
  ex('wool_coat', 'regular', 'long', ['camel', 'black', 'charcoal', 'navy'], 'Tailored, knee length'),
  ex('wool_coat', 'oversized', 'long', ['camel', 'grey'], 'Relaxed and roomy, knee length'),
  ex('wool_coat', 'regular', 'short', ['navy', 'black'], 'Tailored, thigh length'),
  ex('puffer', 'regular', 'cropped', ['black', 'cream'], 'Quilted, ends at the waist'),
  ex('puffer', 'regular', 'regular', ['black', 'navy', 'olive'], 'Quilted, hip length'),
  ex('puffer', 'regular', 'long', ['black'], 'Quilted, knee length or longer'),
  // Shoes
  ex('sneakers', 'low-top', null, ['white', 'black'], 'Slim, flat sole'),
  ex('sneakers', 'chunky', null, ['white', 'grey'], 'Thick, built-up sole'),
  ex('running', 'regular', null, ['grey', 'black'], 'Cushioned sports shoe'),
  ex('loafers', 'regular', null, ['black', 'brown'], 'Slip-on, slim sole'),
  ex('loafers', 'chunky', null, ['black'], 'Slip-on, thick lug sole'),
  ex('boots', 'chelsea', null, ['black', 'brown'], 'Elastic side panels, flat'),
  ex('boots', 'lace-up', null, ['black', 'brown'], 'Laced, flat or low heel'),
  ex('boots', 'heeled', null, ['black'], 'Ankle boot with a heel'),
  ex('dress_shoes', 'heels', null, ['black', 'beige'], 'Closed-toe pumps'),
  ex('dress_shoes', 'oxford', null, ['black', 'brown'], 'Laced leather dress shoe'),
  ex('dress_shoes', 'flat', null, ['black'], 'Smart flat dress shoe'),
  ex('flats', 'regular', null, ['black', 'beige'], 'Thin sole, rounded toe'),
  ex('sandals', 'flat', null, ['brown', 'black'], 'Straps, flat sole'),
  ex('sandals', 'heeled', null, ['black'], 'Straps, with a heel'),
];

// Guard against typos in the list above.
for (const e of EXAMPLES) {
  const t = TYPE[e.type];
  if (!t || !t.cuts.includes(e.cut) || (e.length && !t.lengths?.includes(e.length)) || (!e.length && t.lengths)) console.warn('Bad starter example', e.id);
}

export const EXAMPLE = Object.fromEntries(EXAMPLES.map((e) => [e.id, e]));
