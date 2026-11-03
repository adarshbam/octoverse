import type * as THREE from 'three';

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

/**
 * Nox's three shells. Each is a rounded ring, as wide as `radius` and as tall as one height (the
 * tilt is made up for, so the three show the same height on the page), round the title lines above
 * Nox and the nameplate below, outside his face and the overview's panel. The tilts set the shells
 * at different depths where their rings run together, which is what keeps the bubbles of one shell
 * clear of the next; all three circle at one pace, so a bubble keeps its distance from the rest.
 */
export const NOX_SHELLS: readonly Shell[] = [
  { radius: 1.8, tilt: -0.3, speed: 0.21 },
  { radius: 1.95, tilt: 0, speed: 0.21 },
  { radius: 2.1, tilt: 0.3, speed: 0.21 },
];

/** Where the rings are centred, in body space (a little above the arms' root), and the height they show. */
const CENTRE_Y = 0.25;
const HALF_HEIGHT = 1.55;
/** How square the rings are: 2 is an ellipse, more is a rounder rectangle. */
const SQUARENESS = 3;
/** How far a full swell pushes the rings out, as a fraction of their size. */
const SWELL_PUSH = 0.3;
/** A bubble's radius in each stage's framing (the intro frames Nox smaller, and its bubbles are smaller with it). */
const SIZE = { intro: 0.16, overview: 0.2 } as const;

/** `count` bubbles over the shells in turn, evenly spaced round the ring, sized for the stage's framing. */
export function layoutOrbits(count: number, shells: readonly Shell[], stage: 'intro' | 'overview'): Orbit[] {
  return Array.from({ length: count }, (_, i) => {
    const shell = i % shells.length;
    const { radius, tilt, speed } = shells[shell];
    return { shell, radius, tilt, phase: (i * 2 * Math.PI) / count, speed, size: SIZE[stage] };
  });
}

const powSigned = (x: number, p: number) => Math.sign(x) * Math.abs(x) ** p;

/**
 * The bubble's centre in body space at orbit clock `t` (seconds); `swell` (0..1) pushes the ring
 * out about its centre to clear the swollen head. Written into `out`.
 */
export function orbitPoint(o: Orbit, t: number, swell: number, out: THREE.Vector3): THREE.Vector3 {
  const a = o.phase + o.speed * t;
  const grow = 1 + SWELL_PUSH * swell;
  const exponent = 2 / SQUARENESS;
  const x = o.radius * powSigned(Math.cos(a), exponent) * grow;
  // The ring's own height, stretched so that tipped by `tilt` it shows HALF_HEIGHT.
  const up = ((HALF_HEIGHT * powSigned(Math.sin(a), exponent)) / Math.cos(o.tilt)) * grow;
  return out.set(x, CENTRE_Y + up * Math.cos(o.tilt), up * Math.sin(o.tilt));
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
