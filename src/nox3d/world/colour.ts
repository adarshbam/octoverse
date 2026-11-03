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

/** Sets `target` to the colour `text` names (see above); `text` must pass `isWorldColour`. */
export function setWorldColour(target: THREE.Color, text: string): THREE.Color {
  const linear = LINEAR.exec(text);
  if (linear) return target.setRGB(Number(linear[1]), Number(linear[2]), Number(linear[3]), THREE.LinearSRGBColorSpace);
  return target.set(text);
}
