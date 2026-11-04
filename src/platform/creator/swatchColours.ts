import type { PaletteId } from './types';

/**
 * The eight swatch colours of the creator (spec 7.13), SAMPLED from the native P4 panel
 * ("04 - Octoverse Create Your Own Portfolio.png", 767 x 515, the eight round swatches of the left panel
 * "Choose Your Octopus"). Each is the per-channel median of the 5 x 5 pixels around the swatch's centre
 * (the centre found as the centroid of the swatch's bright disc, which is about 18 px across).
 * Task 17 re-records these in palettes.ts; until then they live here.
 *
 *   palette    pixel (x, y)   colour     centre pixel (r, g, b)
 *   lavender   (66, 219)      #9295fa    147, 149, 252
 *   teal       (94, 219)      #55aac4     83, 167, 191
 *   mauve      (122, 219)     #ac84c3    172, 132, 195
 *   rose       (150, 219)     #d466a1    213, 105, 163
 *   coral      (179, 219)     #f8926f    246, 146, 112
 *   peach      (66, 244)      #fcad92    254, 173, 146
 *   violet     (94, 244)      #6a63ee    104,  98, 246
 *   lilacGrey  (122, 244)     #7979c2    122, 122, 196
 *
 * Row one is lavender, teal, mauve, rose, coral; row two is peach, violet, lilac grey (the panel's own order is the
 * order of the spec's list, which this table keeps).
 */
export const SWATCH_COLOURS: Readonly<Record<Exclude<PaletteId, 'original'>, { hex: string; at: { x: number; y: number } }>> = {
  lavender: { hex: '#9295fa', at: { x: 66, y: 219 } },
  teal: { hex: '#55aac4', at: { x: 94, y: 219 } },
  mauve: { hex: '#ac84c3', at: { x: 122, y: 219 } },
  rose: { hex: '#d466a1', at: { x: 150, y: 219 } },
  coral: { hex: '#f8926f', at: { x: 179, y: 219 } },
  peach: { hex: '#fcad92', at: { x: 66, y: 244 } },
  violet: { hex: '#6a63ee', at: { x: 94, y: 244 } },
  lilacGrey: { hex: '#7979c2', at: { x: 122, y: 244 } },
};
