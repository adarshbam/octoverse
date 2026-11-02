import { useContext } from 'react';
import { MotionContext } from './worldTime';

// The live motion the world's own geometry carries: the floor lava's slow pulse and the coral's
// sway. Each is a vertex or emissive term scaled by one uniform, `uMotion`: 1 while the world
// moves, 0 under `?freeze` and with reduced motion, so a held or reduced world is exactly its
// resting look. The JS functions mirror the shader terms (the tests read them).

/** Whether the world's own motion runs: 0 under `?freeze` and with reduced motion, else 1. */
export function motionAmount({ freeze, reducedMotion }: { freeze: boolean; reducedMotion: boolean }): 0 | 1 {
  return freeze || reducedMotion ? 0 : 1;
}

/** The lava's glow swings between `mean - depth` and `mean + depth` of its full strength, once every `periodSeconds`. */
export const LAVA_PULSE = { mean: 0.72, depth: 0.28, speed: 0.9, periodSeconds: (2 * Math.PI) / 0.9 };

/** The floor lava's strength factor at time `t` and floor point (x, z). */
export function lavaPulse(t: number, x: number, z: number, motion: number) {
  return LAVA_PULSE.mean + LAVA_PULSE.depth * motion * Math.sin(t * LAVA_PULSE.speed + x * 1.7 + z * 0.9);
}

export const LAVA_PULSE_GLSL = `LAVA_MEAN + LAVA_DEPTH * uMotion * sin(uTime * LAVA_SPEED + wp.x * 1.7 + wp.y * 0.9)`.replace('LAVA_MEAN', LAVA_PULSE.mean.toFixed(2))
  .replace('LAVA_DEPTH', LAVA_PULSE.depth.toFixed(2))
  .replace('LAVA_SPEED', LAVA_PULSE.speed.toFixed(2));

/** The coral's sway: how far (stage units, at the tip of a clump of height 1) it leans along x and z. */
export const CORAL_SWAY = { x: 0.05, z: 0.03 };

/** The sideways sway of a coral vertex `h` above its base, for a clump at (cx, cz), at time `t`: along x and along z. */
export function coralSway(t: number, cx: number, cz: number, y: number, motion: number) {
  const phase = cx * 1.7 + cz * 0.9;
  const h = Math.max(y, 0);
  return {
    x: Math.sin(t * 1.1 + phase + y * 2.5) * CORAL_SWAY.x * h * h * motion + 0,
    z: Math.cos(t * 0.8 + phase * 1.3) * CORAL_SWAY.z * h * h * motion + 0,
  };
}

export const CORAL_SWAY_GLSL = `
  float phase = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 0.9;
  float h = max(position.y, 0.0);
  transformed.x += sin(uTime * 1.1 + phase + position.y * 2.5) * ${CORAL_SWAY.x} * h * h * uMotion;
  transformed.z += cos(uTime * 0.8 + phase * 1.3) * ${CORAL_SWAY.z} * h * h * uMotion;`;

/** 1 while the world's own motion runs, 0 when it holds still: for `useFrame` callbacks inside a `WorldScene`. */
export function useMotionAmount() {
  return motionAmount(useContext(MotionContext));
}
