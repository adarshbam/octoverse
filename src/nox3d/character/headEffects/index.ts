import type * as THREE from 'three';
import type { DomeShape, Palette } from '../../config/types';
import type { HeadDraw } from '../../sequences/headSwell';
import { glyphsEffect } from './glyphs';

// The head effects a character's swell can carry (design 9.9, spec 9.1): a closed table inside the
// engine. Adding one is a module, an entry below and a test; the id union follows the table, and
// no other shared code changes. Nothing registers at run time.

/** The dome as the swell places it this frame: its size, its rise, its opacity (`headDraw`). */
export type DomeFrame = HeadDraw;

export interface HeadEffectRuntime {
  /** What the character mounts in the head's space, seated for its dome; null for an effect that draws nothing. */
  readonly root: THREE.Object3D | null;
  /** `swell`: 0 to 1, how far the effect has come in (0 hides it); `clockSeconds`: its own clock, held at 0 with motion off. */
  update(swell: number, frame: DomeFrame, clockSeconds: number): void;
  /** Frees the GPU objects; calling it again does nothing. */
  dispose(): void;
}

export interface HeadEffectModule {
  /** Builds the effect's meshes once per character config. */
  create(dome: DomeShape, palette: Palette): HeadEffectRuntime;
}

/** `'none'`: the dome alone, as approved. */
const noneEffect: HeadEffectModule = {
  create: () => ({ root: null, update() {}, dispose() {} }),
};

export const HEAD_EFFECTS = { none: noneEffect, glyphs: glyphsEffect } as const;

/** The head effects a config can name: `'none'` and Nox's `'glyphs'`. */
export type HeadEffectId = keyof typeof HEAD_EFFECTS;
