import type * as THREE from 'three';
import type { OrbitPlacement } from '../config/types';

/** One technology bubble's path: its shell, and where and how fast it is on it. */
export interface Orbit {
  shell: number;
  radius: number;
  tilt: number;
  phase: number;
  speed: number;
  /** The bubble's own radius, in world units. */
  size: number;
}

/**
 * A shell: a ring about Nox, `radius` wide, tipped by `tilt` about its horizontal axis (the top
 * swings behind him and the bottom before him for a negative tilt, the other way for a positive
 * one), its bubbles circling at `speed` radians a second.
 */
export interface Shell {
  radius: number;
  tilt: number;
  speed: number;
}

/** `count` bubbles over the placement's shells in turn, evenly spaced round the ring, sized for the stage's framing. */
export function layoutOrbits(count: number, placement: Pick<OrbitPlacement, 'shells' | 'sizes'>, stage: 'intro' | 'overview'): Orbit[] {
  const { shells, sizes } = placement;
  return Array.from({ length: count }, (_, i) => {
    const shell = i % shells.length;
    const { radius, tilt, speed } = shells[shell];
    return { shell, radius, tilt, phase: (i * 2 * Math.PI) / count, speed, size: sizes[stage] };
  });
}

const powSigned = (x: number, p: number) => Math.sign(x) * Math.abs(x) ** p;

/**
 * The bubble's centre in body space at orbit clock `t` (seconds); `swell` (0..1) pushes the ring
 * out about its centre to clear the swollen head. `placement` gives the ring's centre, height,
 * squareness and push. Written into `out`.
 */
export function orbitPoint(o: Orbit, t: number, swell: number, out: THREE.Vector3, placement: Pick<OrbitPlacement, 'centreY' | 'halfHeight' | 'squareness' | 'swellPush'>): THREE.Vector3 {
  const { centreY, halfHeight, squareness, swellPush } = placement;
  const a = o.phase + o.speed * t;
  const grow = 1 + swellPush * swell;
  const exponent = 2 / squareness;
  const x = o.radius * powSigned(Math.cos(a), exponent) * grow;
  // The ring's own height, stretched so that tipped by `tilt` it shows halfHeight.
  const up = ((halfHeight * powSigned(Math.sin(a), exponent)) / Math.cos(o.tilt)) * grow;
  return out.set(x, centreY + up * Math.cos(o.tilt), up * Math.sin(o.tilt));
}

/** How fast the orbit clock turns to settle (per second): within 0.4 s it has gone to under 1%. */
const SETTLE = 17;

/**
 * The orbit clock's speed factor (1 at full pace), eased to 0 within 0.4 s while any bubble is hot
 * (hovered or held) and back to 1 when it is not: a critically damped spring, exact for any step,
 * with no overshoot. `state` carries its position and velocity between frames.
 */
export function orbitSpeed(hot: boolean, dt: number, state: { x: number; v: number }): number {
  const target = hot ? 0 : 1;
  const d = state.x - target;
  const e = Math.exp(-SETTLE * dt);
  const k = state.v + SETTLE * d;
  state.x = target + (d + k * dt) * e;
  state.v = (state.v - SETTLE * k * dt) * e;
  state.x = Math.min(1, Math.max(0, state.x));
  return state.x;
}
