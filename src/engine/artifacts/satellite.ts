import * as THREE from 'three';
import type { SatellitePlacement, StageId } from '../config/types';
import type { Vec3 } from '../world/types';
import { type Orbit, orbitPoint } from './bubbleOrbits';

// The `satellite` placement (amendment A1; Aether spec 7.5): at rest, a thin ring round the head,
// nearly edge-on, carrying a few glass beads that librate about their homes in the ring's rear arc
// and never enter the face's sector. Its active form (the beads' technologies as pendants on the
// arms, and the swell-driven flight between the two) is built later, with the pendant code; until
// then the placement lays out no artifacts, and the ring is all it draws (SatelliteRing.tsx).

/**
 * The ring. Lengths are in the head's space (body space; x about the head's own axis). `tilt` is its
 * pitch from facing the camera (radians: toward pi/2 it lies edge-on, its front arc lower, seen from
 * above), `roll` lifts its right side. Angles round it are radians from the camera direction (0, the
 * front of the ring), increasing to the character's left as seen (the viewer's right).
 */
export interface RingStyle {
  radius: number;
  tilt: number;
  roll: number;
  /** The ring's centre height, in the head's space. */
  centreY: number;
  beadCount: number;
  /** A bead's radius, in world units. */
  beadSize: number;
  /** Each bead's home angle, in order round the ring, all outside the keep-out. */
  homes: readonly number[];
  /** How far each bead sways about its home (radians), and the range its own period is drawn from (seconds). */
  sway: { amplitude: number; period: readonly [number, number] };
  /** Half-angle of the face's sector (radians): no bead enters it, and the line fades out across it. */
  keepOut: number;
  /**
   * The ring line's colour and width (pixels at the stage's authored size, 100 px to a world unit),
   * the constellation lines' colour, and how deep their slow flicker dips (0 to 1).
   */
  line: { color: string; width: number; constellation: string; flicker: number };
  /** The beads' glass colour, their rim's, and which of them glow (by index). */
  beads: { glass: string; rim: string; lit: readonly number[] };
}

/** The golden angle: each bead's sway starts this much further round its cycle than the one before. */
const PHASE_STEP = Math.PI * (3 - Math.sqrt(5));

/** Bead `i`'s own sway period (seconds): spread evenly over the range, so no two beads keep step. */
export function beadPeriod(i: number, ring: Pick<RingStyle, 'beadCount' | 'sway'>): number {
  const [low, high] = ring.sway.period;
  return ring.beadCount > 1 ? low + ((high - low) * i) / (ring.beadCount - 1) : low;
}

/**
 * Each bead's angle on the ring at time `t` (seconds), written into `out`: its home plus its own
 * sway. With reduced motion every bead stands at its home.
 */
export function beadAnglesInto(out: number[], t: number, ring: RingStyle, reducedMotion: boolean): number[] {
  const { homes, sway } = ring;
  for (let i = 0; i < homes.length; i++) {
    out[i] = reducedMotion ? homes[i] : homes[i] + sway.amplitude * Math.sin((2 * Math.PI * t) / beadPeriod(i, ring) + i * PHASE_STEP);
  }
  out.length = homes.length;
  return out;
}

/** Each bead's angle on the ring at time `t` (a new array; per frame, use beadAnglesInto). */
export function beadAngles(t: number, ring: RingStyle, reducedMotion: boolean): number[] {
  return beadAnglesInto([], t, ring, reducedMotion);
}

// A ring is a round orbit (squareness 2) of the ring's radius, its height the radius pitched by the
// tilt. Composed from Nox's orbit maths (A1 build rule), not copied.
const ROUND = { centreY: 0, halfHeight: 0, squareness: 2, swellPush: 0 };
const PATH: Orbit = { shell: 0, radius: 0, tilt: 0, phase: 0, speed: 0, size: 0 };

/** The point at `angle` on the ring, in the head's space, written into `out`. */
export function ringPointInto(out: THREE.Vector3, angle: number, ring: Pick<RingStyle, 'radius' | 'tilt' | 'roll' | 'centreY'>): THREE.Vector3 {
  // The orbit's phase runs from its right-hand side, ours from the camera; its tilt the other way.
  PATH.radius = ring.radius;
  PATH.tilt = -ring.tilt;
  PATH.phase = angle - Math.PI / 2;
  ROUND.halfHeight = ring.radius * Math.cos(ring.tilt);
  orbitPoint(PATH, 0, 0, out, ROUND);
  const c = Math.cos(ring.roll);
  const s = Math.sin(ring.roll);
  return out.set(out.x * c - out.y * s, out.x * s + out.y * c + ring.centreY, out.z);
}

/** The point at `angle` on the ring, in the head's space. */
export function ringPoint(angle: number, ring: Pick<RingStyle, 'radius' | 'tilt' | 'roll' | 'centreY'>): Vec3 {
  const p = ringPointInto(new THREE.Vector3(), angle, ring);
  return [p.x, p.y, p.z];
}

/** Over how much angle the ring line comes in beyond the keep-out. */
const LINE_RAMP = (10 * Math.PI) / 180;

/** How much of the ring line shows at `angle`: none inside the keep-out, full 10 degrees beyond it. */
export function ringLineVisible(angle: number, ring: Pick<RingStyle, 'keepOut'>): number {
  const away = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  return THREE.MathUtils.smoothstep(away, ring.keepOut, ring.keepOut + LINE_RAMP);
}

/** The storyboard's scale, in which a line width is given: 100 px to a world unit. */
const AUTHORED_PX_PER_UNIT = 100;

/** The ring line's width in pixels where a world unit spans `pxPerUnit` pixels. */
export function ringLineWidth(ring: Pick<RingStyle, 'line'>, pxPerUnit: number): number {
  return (ring.line.width * pxPerUnit) / AUTHORED_PX_PER_UNIT;
}

/** The stages the ring is drawn in: the intro, and the detail (the beads are home again). */
export function ringShown(stage: StageId): boolean {
  return stage === 'intro' || stage === 'detail';
}

/** The artifacts' places: none yet (the active form, pendants on the arms, comes with the pendant code). */
export function layoutSatellite(_count: number, _config: SatellitePlacement, _stage: 'intro' | 'overview'): Orbit[] {
  return [];
}

/** An artifact's place: the ring's centre (never asked for while the layout has no places). */
export function satellitePoint(_orbit: Orbit, _t: number, _swell: number, out: THREE.Vector3, config: SatellitePlacement): THREE.Vector3 {
  return out.set(0, config.ring.centreY, 0);
}
