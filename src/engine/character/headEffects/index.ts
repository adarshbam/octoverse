import type * as THREE from 'three';
import type { DomeShape, Palette } from '../../config/types';
import type { HeadDraw } from '../../sequences/headSwell';
import { glyphsEffect } from './glyphs';
import { synapseEffect } from './synapse';

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
  /**
   * Frees the GPU objects. Safe to call again, and the runtime may be drawn again after it (three
   * uploads what it draws anew): React's StrictMode cleans an effect up and remounts with the same
   * memoised runtime, so each call must free what is uploaded then, not only the first.
   */
  dispose(): void;
}

/** What the caller tells an effect when it builds it. */
export interface HeadEffectOptions {
  /** Reduced motion: an effect that moves (Aether's synapse wave) becomes a plain crossfade. */
  reducedMotion?: boolean;
}

export interface HeadEffectModule {
  /** Builds the effect's meshes once per character config (and per motion setting). */
  create(dome: DomeShape, palette: Palette, options?: HeadEffectOptions): HeadEffectRuntime;
}

/** `'none'`: the dome alone, as approved. */
const noneEffect: HeadEffectModule = {
  create: () => ({ root: null, update() {}, dispose() {} }),
};

export const HEAD_EFFECTS = { none: noneEffect, glyphs: glyphsEffect, synapse: synapseEffect } as const;

/** The head effects a config can name: `'none'`, Nox's `'glyphs'` and Aether's `'synapse'`. */
export type HeadEffectId = keyof typeof HEAD_EFFECTS;
