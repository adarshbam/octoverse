import * as THREE from 'three';
import { ARM_IDS, type SatellitePlacement, type StageId, type SwingLimits } from '../config/types';
import { SWELL_PUSH_SETTLED } from '../sequences/keys';
import type { Vec3 } from '../world/types';
import { type Orbit, orbitPoint } from './bubbleOrbits';
import { assignPendants, createPendantRun, layoutPendants, resetPendants, stepPendants } from './pendant';
import type { PlacementDriver } from './strategies';

// The `satellite` placement (amendment A1; Aether spec 7.5): at rest, a thin ring round the head,
// nearly edge-on, carrying a few glass beads that librate about their homes in the ring's rear arc
// and never enter the face's sector (SatelliteRing.tsx draws it). Its active form hangs the beads'
// technologies as pendants on the arms (Veyra's slot, tether and swing code, artifacts/pendant.ts),
// and the flight between the two is a pure function of the head swell's progress (below): the beads
// brighten, flare and split into orbs that fly along gold arcs to their slots.

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

/** Over how much angle the head of the line, drawing round the ring, fades in. */
const DRAW_HEAD = (24 * Math.PI) / 180;

/**
 * How much of the ring line shows at `angle` while it forms (the twinkle, spec 7.5), when `drawn` (0 to
 * 1) of it is drawn: the line draws round the head from one side of the keep-out, the beads' first home
 * end, through the rear to the other, its leading edge fading in over about 24 degrees. At `drawn` 1 it
 * is whole (1 everywhere), as the ring was before it formed; this multiplies `ringLineVisible`.
 */
export function ringDrawn(angle: number, drawn: number, ring: Pick<RingStyle, 'keepOut'>): number {
  if (drawn >= 1) return 1;
  const turn = 2 * Math.PI;
  const at = ((angle % turn) + turn) % turn;
  const from = ring.keepOut;
  // Before the line's start (the keep-out's far side, never shown) nothing is drawn yet.
  if (at < from) return 0;
  const head = from + Math.max(0, drawn) * (turn - 2 * ring.keepOut + DRAW_HEAD);
  return THREE.MathUtils.clamp((head - at) / DRAW_HEAD, 0, 1);
}

/** The stages the ring is drawn in: the intro, and the detail (the beads are home again). */
export function ringShown(stage: StageId): boolean {
  return stage === 'intro' || stage === 'detail';
}

/** The artifacts' orbit paths: none (they rest on the ring as beads and hang from the arms as pendants; the driver places them). */
export function layoutSatellite(_count: number, _config: SatellitePlacement, _stage: 'intro' | 'overview'): Orbit[] {
  return [];
}

/** An artifact's place on an orbit path: the ring's centre (never asked for: the layout has no paths). */
export function satellitePoint(_orbit: Orbit, _t: number, _swell: number, out: THREE.Vector3, config: SatellitePlacement): THREE.Vector3 {
  return out.set(0, config.ring.centreY, 0);
}

// --- The active form: the flight (spec 7.5) --------------------------------------------------------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (from: number, to: number, x: number) => THREE.MathUtils.smoothstep(x, from, to);

/**
 * The flight's beats, in swell progress (0 the ring, 1 the slots): the beads brighten and the ring
 * line glows; each bead flares and splits into its share of orbs as the line fades; the orbs fly out,
 * each inside `travel`, upper arms first; the threads settle and the float begins.
 */
export const FLIGHT = { brighten: [0, 0.2], split: [0.2, 0.35], travel: [0.35, 0.9], settle: [0.9, 1] } as const;

/** How much of the swell one orb's travel takes: the rest of the travel beat is the ripple between the first orb and the last. */
const TRAVEL = 0.5;
/** How far an orb moves off its bead as the bead splits (world units), each its own way round. */
const FAN = 0.12;
/** What the flight keeps clear of: the head's centre line across the body (`x`) and how far out from it the arc comes down (`half`; the driver uses the ring's radius, which circles the head). */
export interface FlightKeep {
  x: number;
  half: number;
}
const NO_KEEP: FlightKeep = { x: 0, half: 0 };

/** Over the top, the orb gets across ahead of coming down: its sideways travel leads its height by this much (so it is out in the lane before it drops past the face). */
const LEAD = 0.6;

/** A point on a cubic curve, ends p0 and p3 and handles p1 and p2, at e (0 to 1). */
function cubic(p0: number, p1: number, p2: number, p3: number, e: number): number {
  const u = 1 - e;
  return u * u * u * p0 + 3 * u * u * e * p1 + 3 * u * e * e * p2 + e * e * e * p3;
}

/** A bead this share of `half` or more out on its slot's side swings outward and down to a slot below it, not over the top. */
const OUT_SIDE = 0.7;

/** How high the arc rises above the higher of its bead and its slot (world units), and how much higher for each unit its bead is across the head's centre line from its slot (less what a slot above the bead already gives). */
const RISE = 0.5;
const CROSS_RISE = 0.4;
/** How big an orb is once split, of its full size: it grows the rest of the way as it flies. */
const SPLIT_SIZE = 0.3;
/** The golden angle: each orb fans off its bead this much further round than the one before. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Swell progress as the placement reads it: the head swell's push (what the orbit placement reads), as a share of its settled value, so the overshoot holds at 1. */
export function flightProgress(push: number): number {
  return clamp01(Number.isFinite(push) ? push / SWELL_PUSH_SETTLED : 0);
}

/** Where the flight is held: `free` outside the overview, `overview` in it, `focus` while a technology chosen there is in focus (which closes the head). */
export type FlightHold = 'free' | 'overview' | 'focus';

/**
 * The progress the flight shows. In the overview, and outside it, `progress` itself: the orbs follow
 * the swell out and home (a still seeking a moment of the swell shows that moment). Once they have
 * landed in the overview, a technology focus keeps them landed although it closes the head; a still
 * of a focus shows them landed. Leaving the overview releases them.
 */
export function holdProgress(latch: { landed: boolean }, hold: FlightHold, progress: number, still: boolean): number {
  if (hold === 'focus') return latch.landed || still ? 1 : progress;
  latch.landed = hold === 'overview' && (latch.landed || progress >= 1);
  return progress;
}

/** Which bead each placed technology leaves from: placed technologies in slot order, dealt round-robin over the beads. */
export function dealToBeads(placedCount: number, beadCount: number): number[] {
  const beads = Math.max(0, Math.floor(beadCount));
  if (beads === 0) return [];
  return Array.from({ length: Math.max(0, Math.floor(placedCount)) }, (_, i) => i % beads);
}

/** Orb `index` of `count`'s own travel, in swell progress: the first leaves at the travel beat's start, the last arrives at its end. */
export function travelWindow(index: number, count: number): [number, number] {
  const [start, end] = FLIGHT.travel;
  const ripple = end - start - TRAVEL;
  const at = start + (count > 1 ? (ripple * Math.min(index, count - 1)) / (count - 1) : 0);
  return [at, at + TRAVEL];
}

/** The travel's ease: soft at both ends, never faster than 1.2 times its average (so the arc has no jump). */
const ease = (t: number) => 0.6 * t + 0.4 * t * t * (3 - 2 * t);

/** One orb's flight now: where it is (body space), its scale of its full size, its logo's strength and its trail's (0..1). */
export interface FlightState {
  p: THREE.Vector3;
  scale: number;
  logo: number;
  trail: number;
}

/**
 * The flight of orb `index` of `count` (its rank in slot order) from its bead `from` to its slot `to`
 * at swell progress `swell`, written into `out` (nothing allocated). A pure function of swell, so a
 * close part-way flies back the way it came. With `reducedMotion` it is a crossfade: at the bead
 * before 0.5 and at the slot after, the orb shrunk to nothing between, with no place in between.
 */
export function flightInto(out: FlightState, from: Vec3, to: Vec3, swell: number, index: number, count: number, reducedMotion = false, keep: FlightKeep = NO_KEEP): FlightState {
  const s = clamp01(swell);
  if (reducedMotion) {
    const at = s < 0.5 ? from : to;
    out.p.set(at[0], at[1], at[2]);
    out.scale = s < 0.5 ? 0 : smooth(0.5, 0.8, s);
    out.logo = out.scale;
    out.trail = 0;
    return out;
  }
  const split = smooth(FLIGHT.split[0], FLIGHT.split[1], s);
  const [t0, t1] = travelWindow(index, count);
  const t = clamp01((s - t0) / (t1 - t0));
  const e = ease(t);
  // Where it leaves from: its bead, fanned a little off it as the bead splits.
  const fan = GOLDEN * index;
  const ax = from[0] + FAN * split * Math.cos(fan);
  const ay = from[1] + FAN * split * Math.sin(fan);
  const az = from[2];
  // The arc keeps clear of the head: it reaches the slot down the head's side (a lane at least
  // `keep.half` out from the head's centre line on the slot's side), never across the face. An orb
  // whose bead is already out on that side and above its slot swings outward and down to it, coming
  // in from outside (a curve whose handles stand in the lane level with each end). Any other rises
  // off its bead, crosses above the higher of bead and slot (higher still when its bead is across the
  // centre line), and comes down the lane onto the slot.
  const side = Math.sign(to[0] - keep.x) || 1;
  const beadOut = (ax - keep.x) * side;
  const lane = keep.x + side * Math.max(Math.abs(to[0] - keep.x), keep.half);
  const over = !(beadOut >= OUT_SIDE * keep.half && to[1] < ay);
  let h1x: number;
  let h1y: number;
  let h2y: number;
  if (!over) {
    h1x = keep.x + side * Math.max(beadOut, keep.half);
    h1y = ay;
    h2y = to[1];
  } else {
    h1x = ax;
    h1y = Math.max(ay, to[1]) + RISE + Math.max(0, CROSS_RISE * Math.max(0, -beadOut) - Math.max(0, to[1] - ay));
    h2y = h1y;
  }
  out.p.set(cubic(ax, h1x, lane, to[0], over ? e + LEAD * e * (1 - e) : e), cubic(ay, h1y, h2y, to[1], e), cubic(az, az, to[2], to[2], e));
  out.scale = SPLIT_SIZE * split + (1 - SPLIT_SIZE) * e;
  out.logo = smooth(0.7, 1, t);
  out.trail = t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0;
  return out;
}

/** Position of one orb during the flight, a pure function of swell (0 ring, 1 slot). (A new value; per frame, use flightInto.) */
export function flightPoint(from: Vec3, to: Vec3, swell: number, index: number, count: number, reducedMotion = false, keep: FlightKeep = NO_KEEP): { p: Vec3; scale: number; logo: number; trail: number } {
  const f = flightInto({ p: new THREE.Vector3(), scale: 0, logo: 0, trail: 0 }, from, to, swell, index, count, reducedMotion, keep);
  return { p: [f.p.x, f.p.y, f.p.z], scale: f.scale, logo: f.logo, trail: f.trail };
}

/**
 * The ring's part in the flight at progress `p`: how far the beads have brightened (and stopped
 * swaying, `sway` the share of their sway left), how far they have flared, how much of each bead is
 * left as it splits into orbs, and how much of the ring line shows. At 0 the ring is as at rest.
 * With reduced motion the ring simply fades out by the crossfade's middle.
 */
export function ringFlight(p: number, reducedMotion: boolean): { bright: number; flare: number; bead: number; line: number; sway: number } {
  if (reducedMotion) {
    const left = 1 - smooth(0.3, 0.5, p);
    return { bright: 0, flare: 0, bead: left, line: left, sway: 1 };
  }
  const bright = smooth(FLIGHT.brighten[0], FLIGHT.brighten[1], p);
  return {
    bright,
    flare: smooth(FLIGHT.split[0], 0.3, p),
    bead: 1 - smooth(0.27, FLIGHT.split[1], p),
    line: 1 - smooth(FLIGHT.split[0], FLIGHT.split[1], p),
    sway: 1 - bright,
  };
}

/** The pendants' float (spec 7.5): their swing's limits, unless the config gives its own: at most 15 degrees, settled 1.4 s after the arm stops. */
export const SATELLITE_SWING: SwingLimits = { maxAngle: (15 * Math.PI) / 180, settle: 1.4 };

/** The orbs' buoyant bob: 0.03 units up and down, each orb with its own period of 3 to 5 s. */
export const BOB = {
  amplitude: 0.03,
  /** Orb `i`'s period (seconds): spread over 3 to 5 s by the golden ratio, so no two keep step. */
  period: (i: number) => 3 + 2 * ((i * 0.6180339887) % 1),
} as const;

/** How far orb `i` has bobbed above its hanging place at clock `t` (seconds). */
export function orbBob(i: number, t: number): number {
  return BOB.amplitude * Math.sin((2 * Math.PI * t) / BOB.period(i) + i * GOLDEN);
}

// --- The active form under the driver ---------------------------------------------------------------

/** How many points a flying orb's trail has (the orb's own place first), and how far back along the flight each is, in swell progress. */
export const TRAIL_POINTS = 7;
const TRAIL_STEP = 0.02;

/** One orb's flight as the page draws it: its flight now, whether it hangs on its thread yet, and its trail's points (body space, newest first; made once, rewritten each frame). */
export interface FlightLook extends FlightState {
  landed: boolean;
  readonly trailPoints: readonly THREE.Vector3[];
}

/** The satellite's active form, if its config gives one: its slots, the orbs' size there and their thread. */
function activeForm(config: SatellitePlacement) {
  const { slots, sizes, tether } = config;
  return slots && sizes && tether ? { slots: slots.overview, size: sizes.overview, tether } : null;
}

/** How many technologies the satellite hangs on the arms (the rest go to the tray): its slots, at most two an arm; none without an active form. */
export function satelliteCapacity(config: SatellitePlacement): number {
  const form = activeForm(config);
  return form ? assignPendants(form.slots.length, form.slots).placed.length : 0;
}

/**
 * The satellite's driver for `count` technologies: each placed one (in slot order, at most two an
 * arm) hangs as a pendant from its slot (Veyra's pendant code, with the satellite's swing and a bob),
 * and flies there from the ring bead it is dealt to as the head swells (flightInto), back as it
 * closes. `headCentreX` is where the ring's centre sits across the body (the Form draws it round the
 * head's axis). Without an active form it places nothing.
 */
export function satelliteDriver(config: SatellitePlacement, count: number, { headCentreX = 0 }: { headCentreX?: number } = {}): PlacementDriver {
  const form = activeForm(config);
  if (!form) return { step: () => {}, size: () => null, point: (_stage, _i, _swell, out) => out.set(0, config.ring.centreY, 0) };
  const places = layoutPendants(count, { slots: { intro: form.slots, overview: form.slots }, sizes: { intro: form.size, overview: form.size } }, 'overview');
  const placed = places.filter(place => place !== null).length;
  // Each placed technology leaves from its dealt bead, at the bead's home (the beads stop swaying as they brighten, before they split).
  const homes = config.ring.homes;
  const from: Vec3[] = dealToBeads(placed, config.ring.beadCount).map(bead => {
    const [x, y, z] = ringPoint(homes[bead % Math.max(1, homes.length)] ?? 0, config.ring);
    return [x + headCentreX, y, z];
  });
  // The flight keeps clear of the head the ring circles: it comes down at least the ring's radius out from its centre line.
  const keep: FlightKeep = { x: headCentreX, half: config.ring.radius };
  const run = createPendantRun(count);
  const hanging = { tether: form.tether, swing: config.swing ?? SATELLITE_SWING };
  const latch = { landed: false };
  const looks: FlightLook[] = Array.from({ length: count }, () => ({ p: new THREE.Vector3(), scale: 0, logo: 0, trail: 0, landed: false, trailPoints: Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector3()) }));
  const back: FlightState = { p: new THREE.Vector3(), scale: 0, logo: 0, trail: 0 };
  const arrive = places.map((_, i) => travelWindow(i, placed)[1]);
  let clock = 0;
  return {
    step({ stage, swell, dt, still, reducedMotion = false, focused = false }, arms) {
      // The overview holds its orbs once they have landed (a technology focus closes the head); the intro lets them follow the swell home.
      const progress = holdProgress(latch, stage !== 'overview' ? 'free' : focused ? 'focus' : 'overview', flightProgress(swell), still);
      if (!still) clock += dt;
      if (arms.length >= ARM_IDS.length) {
        stepPendants(run, places, { stage: 'overview', swell, dt, reducedMotion: still }, arms, hanging);
        // The float's bob: each orb rises and sinks on its own slow beat, its thread taking up the slack along its length.
        for (let i = 0; i < placed; i++) {
          const lift = still ? 0 : orbBob(i, clock);
          const live = run.live[i];
          live.orbCentre[1] += lift;
          const last = live.points.length - 1;
          if (lift === 0) continue;
          // (The thread's points are the frame's own, new from tetherCurve each step.)
          for (let k = 1; k <= last; k++) {
            const [x, y, z] = live.points[k];
            live.points[k] = [x, y + (lift * k) / last, z];
          }
        }
      }
      for (let i = 0; i < placed; i++) {
        const look = looks[i];
        const to = run.live[i].orbCentre;
        flightInto(look, from[i], to, progress, i, placed, reducedMotion, keep);
        look.landed = reducedMotion ? progress >= 0.5 : progress >= arrive[i];
        // The trail: the flight's own path just behind the orb (a pure function of swell, so nothing is remembered).
        look.trailPoints[0].copy(look.p);
        for (let k = 1; k < TRAIL_POINTS; k++) look.trailPoints[k].copy(flightInto(back, from[i], to, progress - k * TRAIL_STEP, i, placed, reducedMotion, keep).p);
      }
    },
    size: (_stage, i) => (i < placed && looks[i].scale > 0 ? form.size : null),
    point: (_stage, i, _swell, out) => out.copy(looks[i].p),
    reset: () => {
      resetPendants(run);
      latch.landed = false;
    },
    flight: i => looks[i],
    pendants: run.live,
  };
}
