import type { WorldPalette } from '../types';
import { DEFAULT_FLOOR, type FloorMaterialId } from './index';
import { mossShading } from './moss';
import { sandShading } from './sand';

// What a floor variant adds to the seabed's shader (Floor.tsx). 'lava-cracks' is Nox's: it adds no
// shading here and keeps the floor's glow, so a world without a `floor` draws as it always did.

/** The shader text `material` adds after the wet patches' roughness: nothing for the default floor. */
export function floorShading(material: FloorMaterialId | undefined, palette: WorldPalette): string {
  switch (material ?? DEFAULT_FLOOR) {
    case 'moss':
      return mossShading(String(palette.moss));
    case 'sand':
      return sandShading(String(palette.sand), String(palette.rock));
    default:
      return '';
  }
}

/** Whether `material` draws the floor's glow (the cracks, the lava and the sheen): Nox's does, no other floor does. */
export function floorGlows(material: FloorMaterialId | undefined): boolean {
  return (material ?? DEFAULT_FLOOR) === 'lava-cracks';
}
