import { clampCharacterConfig } from '../../engine/config/validate';
import { fromOklch, toOklch } from './oklch';
import { SWATCH_COLOURS } from './swatchColours';
import type { CharacterConfig, ColourSlot, CreatorTemplate, PaletteId } from './types';

// The creator's palettes (platform spec 7.13, contract amendment A2 P4/P6): pure maths over a template's colour slots.
//
// A palette is never hand-authored per template. It moves each of the template's body slots (crown, depth, rim, arm top, halo)
// to a swatch's OKLCH hue, keeping that slot's own lightness and chroma, so the template's light stays authored. The face glow,
// eyes, mouth, blush and cups are never slots and never change. Where a swatch hue would break the face rule for a template
// (a pink body round a pink face), the slots' lightness is lowered, 0.02 a step, at most 15 steps, until the rule holds.

/**
 * The eight swatch colours of P4, with the pixel each was sampled at on the native panel (767 x 515). The colours and pixels are
 * the ones recorded in swatchColours.ts (Task 10: a per-channel median of the 5 x 5 pixels round each swatch's centre); not resampled.
 */
export const SWATCHES: Readonly<Record<Exclude<PaletteId, 'original'>, { hex: string; p4: { x: number; y: number } }>> = {
  lavender: { hex: SWATCH_COLOURS.lavender.hex, p4: SWATCH_COLOURS.lavender.at },
  teal: { hex: SWATCH_COLOURS.teal.hex, p4: SWATCH_COLOURS.teal.at },
  mauve: { hex: SWATCH_COLOURS.mauve.hex, p4: SWATCH_COLOURS.mauve.at },
  rose: { hex: SWATCH_COLOURS.rose.hex, p4: SWATCH_COLOURS.rose.at },
  coral: { hex: SWATCH_COLOURS.coral.hex, p4: SWATCH_COLOURS.coral.at },
  peach: { hex: SWATCH_COLOURS.peach.hex, p4: SWATCH_COLOURS.peach.at },
  violet: { hex: SWATCH_COLOURS.violet.hex, p4: SWATCH_COLOURS.violet.at },
  lilacGrey: { hex: SWATCH_COLOURS.lilacGrey.hex, p4: SWATCH_COLOURS.lilacGrey.at },
};

/** The face rule's two floors (spec 7.13): CIE76 delta E, and OKLCH lightness x 100. */
export const FACE_MIN_DELTA_E = 40;
export const FACE_MIN_LIGHTNESS_GAP = 30;
/** How a palette lowers a body's lightness when the face rule fails: this much a step, at most this many steps. */
export const LIGHTNESS_STEP = 0.02;
export const MAX_LIGHTNESS_STEPS = 15;

// ---------------------------------------------------------------------------------------------
// Colour fields by dotted path
// ---------------------------------------------------------------------------------------------

const keysOf = (path: ColourSlot) => path.split('.');

/** The colour at a dotted path of the character (a list index is a number in the path). Throws when the path holds no string. */
export function getColour(config: CharacterConfig, path: ColourSlot): string {
  let node: unknown = config;
  for (const key of keysOf(path)) {
    if (node === null || typeof node !== 'object') throw new Error(`colour slot "${path}" is not on the character`);
    node = (node as Record<string, unknown>)[key];
  }
  if (typeof node !== 'string') throw new Error(`colour slot "${path}" is not on the character`);
  return node;
}

/** A copy of the character with the colour at `path` replaced; the path must exist (a slot is never invented). */
export function setColour(config: CharacterConfig, path: ColourSlot, hex: string): CharacterConfig {
  getColour(config, path);
  const keys = keysOf(path);
  const copy = (node: unknown, depth: number): unknown => {
    if (depth === keys.length) return hex;
    const key = keys[depth];
    if (Array.isArray(node)) {
      const next = node.slice();
      next[Number(key)] = copy(node[Number(key)], depth + 1);
      return next;
    }
    const record = node as Record<string, unknown>;
    return { ...record, [key]: copy(record[key], depth + 1) };
  };
  return copy(config, 0) as CharacterConfig;
}

// ---------------------------------------------------------------------------------------------
// CIE76 delta E
// ---------------------------------------------------------------------------------------------

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** CIE L*a*b* (D65) of a `#rrggbb` colour. */
function toLab(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference (the Euclidean distance in CIE L*a*b*) between two `#rrggbb` colours. */
export function deltaE76(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// ---------------------------------------------------------------------------------------------
// The face rule
// ---------------------------------------------------------------------------------------------

/**
 * Whether the face stands out from the body (spec 7.13): the face glow is exactly the template's approved face glow (the colour at
 * `faceGlowAt`), its CIE76 delta E from the upper-head colour is at least 40, and its OKLCH lightness (x 100) is at least 30
 * above the upper head's.
 */
export function faceRuleHolds(config: CharacterConfig, template: CreatorTemplate): boolean {
  if (getColour(config, template.faceGlowAt).toLowerCase() !== template.faceGlow.toLowerCase()) return false;
  const head = getColour(config, template.upperHead);
  if (deltaE76(template.faceGlow, head) < FACE_MIN_DELTA_E) return false;
  return toOklch(template.faceGlow).l * 100 >= toOklch(head).l * 100 + FACE_MIN_LIGHTNESS_GAP;
}

// ---------------------------------------------------------------------------------------------
// applyPalette
// ---------------------------------------------------------------------------------------------

/** Every slot moved to `hue`, keeping its own chroma and its own lightness less `lowered`. */
function moved(config: CharacterConfig, template: CreatorTemplate, hue: number, lowered: number): CharacterConfig {
  let out = config;
  for (const slot of template.slots) {
    const { l, c } = toOklch(getColour(config, slot));
    out = setColour(out, slot, fromOklch(Math.max(0, l - lowered), c, hue));
  }
  return out;
}

/** The slots moved to the swatch's hue and lowered, step by step, until the face rule holds: the result and the steps taken (16 when 15 were not enough). */
function solve(config: CharacterConfig, template: CreatorTemplate, palette: Exclude<PaletteId, 'original'>): { result: CharacterConfig; steps: number } {
  const hue = toOklch(SWATCHES[palette].hex).h;
  let result = moved(config, template, hue, 0);
  let steps = 0;
  while (steps < MAX_LIGHTNESS_STEPS && !faceRuleHolds(result, template)) {
    steps += 1;
    result = moved(config, template, hue, steps * LIGHTNESS_STEP);
  }
  return { result, steps: faceRuleHolds(result, template) ? steps : MAX_LIGHTNESS_STEPS + 1 };
}

/**
 * The character in a palette: each of the template's slots moved to the swatch's OKLCH hue keeping its own lightness and chroma; then,
 * while the face rule fails, every slot's lightness lowered by 0.02 (at most 15 steps). `'original'` is the character as it is.
 * Pure: the input is never changed. The result is clamped (`clampCharacterConfig`, contract 19 P6).
 *
 * When 15 steps are not enough the result does not pretend otherwise: it is the 15th step and `faceRuleHolds` says false (the unit
 * test over every combination proves this never happens for the four templates).
 */
export function applyPalette(config: CharacterConfig, template: CreatorTemplate, palette: PaletteId): CharacterConfig {
  if (palette === 'original') return config;
  return clampCharacterConfig(solve(config, template, palette).result);
}

/** How many lightness steps `applyPalette` takes for a template and a palette: 0 when the swatch's hue already satisfies the rule, 16 when 15 steps are not enough. */
export function lightnessSteps(config: CharacterConfig, template: CreatorTemplate, palette: PaletteId): number {
  return palette === 'original' ? 0 : solve(config, template, palette).steps;
}
