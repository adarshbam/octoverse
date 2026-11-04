import * as THREE from 'three';

// Colours a world config names as text. Most are `#rrggbb`, which three reads as sRGB and turns
// into its linear working space. A few values are amounts of light that 8-bit hex cannot say
// exactly (the skin accent is 0.052, 0.0252, 0.06: small linear components, where one hex step is
// a large share), so a colour may also be written `color(srgb-linear r g b)`, components taken as
// they are.

const LINEAR = /^color\(srgb-linear\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\)$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Whether `text` is a colour `setWorldColour` can read. */
export function isWorldColour(text: unknown): text is string {
  return typeof text === 'string' && (HEX.test(text) || LINEAR.test(text));
}

// What three's `Color.set` (setStyle) reads, written out so a value can be checked without a
// renderer or a canvas, in Node as in the browser: #rgb and #rrggbb; rgb() and rgba() with whole
// 0-255 numbers or whole percentages, comma separated; hsl() and hsla() as hue, saturation %,
// lightness %; and the CSS colour names three knows (`THREE.Color.NAMES`). The alpha is read and
// ignored by three, kept by a canvas or a stylesheet. The canvas reads more (#rrggbbaa, space
// separated rgb(), hsl(deg), oklch()): those are refused here, loudly, by `validateBundle`, since
// three would draw them black and leave a warning.
const STYLE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const STYLE_RGB = /^rgba?\(\s*(?:\d+\s*,\s*\d+\s*,\s*\d+|\d+%\s*,\s*\d+%\s*,\s*\d+%)\s*(?:,\s*\d*\.?\d+\s*)?\)$/;
const STYLE_HSL = /^hsla?\(\s*\d*\.?\d+\s*,\s*\d*\.?\d+%\s*,\s*\d*\.?\d+%\s*(?:,\s*\d*\.?\d+\s*)?\)$/;

/** Whether `text` is a colour three's `Color.set` reads (see above): the colours a character's config, a world's palette or a UI theme may hold. */
export function isColour(text: unknown): text is string {
  return typeof text === 'string' && (STYLE_HEX.test(text) || STYLE_RGB.test(text) || STYLE_HSL.test(text) || Object.hasOwn(THREE.Color.NAMES, text.toLowerCase()));
}

/** Sets `target` to the colour `text` names (see above); `text` must pass `isWorldColour`. */
export function setWorldColour(target: THREE.Color, text: string): THREE.Color {
  const linear = LINEAR.exec(text);
  if (linear) return target.setRGB(Number(linear[1]), Number(linear[2]), Number(linear[3]), THREE.LinearSRGBColorSpace);
  return target.set(text);
}

/** A number as a GLSL float literal: `1` is `1.0`, `0.85` stays `0.85` (never an exponent). */
export function glslFloat(n: number): string {
  if (Number.isInteger(n)) return n.toFixed(1);
  const text = String(n);
  return text.includes('e') ? n.toFixed(12).replace(/0+$/, '') : text;
}

/**
 * The colour `text` names (it must pass `isWorldColour`) as a GLSL `vec3(r, g, b)` of linear
 * components, for a shader that compiles its colour in rather than reading a uniform. A
 * `color(srgb-linear r g b)` value is written component for component, so `color(srgb-linear 1
 * 0.09 0.05)` is `vec3(1.0, 0.09, 0.05)`, the very text a shader held before its colour was data;
 * a hex colour is turned into its linear components as three does.
 */
export function glslColour(text: string): string {
  const c = setWorldColour(new THREE.Color(), text);
  return `vec3(${glslFloat(c.r)}, ${glslFloat(c.g)}, ${glslFloat(c.b)})`;
}
