import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX_ARTIFACTS } from '../../worlds/nox/artifacts';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS, type OrbitPlacement, type PendantSlot, STAGE_IDS, type SatellitePlacement, type SwingLimits } from '../config/types';
import { SWELL_PUSH_SETTLED } from '../sequences/keys';
import type { Vec3 } from '../world/types';
import { layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { assignPendants, pendantSwing, restSwing } from './pendant';
import { type RingStyle, BOB, FLIGHT, SATELLITE_SWING, beadAngles, beadAnglesInto, dealToBeads, satellitePlaces, flightPoint, flightProgress, holdProgress, orbBob, ringFlight, ringLineVisible, ringLineWidth, ringPoint, ringShown } from './satellite';
import { PLACEMENTS, SELECTS, placementCapacity, placementDriver, placementOf } from './strategies';

// The `satellite` placement's rest form (amendment A1; Aether spec 2.2, 7.5): a ring round the head,
// nearly edge-on, whose beads librate about their homes in the rear 270 degrees and never enter the
// face's sector. The fixture is a ring like Aether's (the engine's tests name no other world's data).

const deg = (d: number) => (d * Math.PI) / 180;
const RING: RingStyle = {
  radius: 1.25,
  tilt: 1.36,
  roll: 0.14,
  centreY: -0.28,
  beadCount: 5,
  beadSize: 0.075,
  homes: [deg(72), deg(126), deg(180), deg(234), deg(288)],
  sway: { amplitude: 0.21, period: [6, 9] },
  keepOut: Math.PI / 4,
  line: { color: '#d99982', width: 1.5, constellation: '#d99982', flicker: 0.5 },
  beads: { glass: '#93699a', rim: '#d99982', lit: [1, 3] },
};

/** The angle's distance from the camera direction (angle 0), 0 to pi. */
const fromCamera = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
/** Where a ring angle is on the way round from the camera direction, 0 to 2 pi. */
const round = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const STEPS = Array.from({ length: 60 * 60 + 1 }, (_, i) => i / 60);

test('ringKeepOut: over a minute at 60 frames a second, no bead is ever within the keep-out of the camera direction', () => {
  for (const t of STEPS) {
    for (const a of beadAngles(t, RING, false)) expect(fromCamera(a), `t ${t}`).toBeGreaterThan(RING.keepOut);
  }
});

test('the beads librate about their homes and never pass each other', () => {
  let swayed = 0;
  for (const t of STEPS) {
    const angles = beadAngles(t, RING, false).map(round);
    for (let i = 1; i < angles.length; i++) expect(angles[i], `t ${t}`).toBeGreaterThan(angles[i - 1]);
    angles.forEach((a, i) => {
      expect(Math.abs(a - RING.homes[i])).toBeLessThanOrEqual(RING.sway.amplitude + 1e-12);
      swayed = Math.max(swayed, Math.abs(a - RING.homes[i]));
    });
  }
  // They do sway, nearly the full amplitude within the minute.
  expect(swayed).toBeGreaterThan(RING.sway.amplitude * 0.95);
});

test('each bead keeps its own period, within the sway range, out of phase with the others', () => {
  // Sampled at 10 Hz for 60 s: a bead's swing repeats after its period, and the beads differ.
  const at = (t: number) => beadAngles(t, RING, false);
  const offsets = at(0).map((a, i) => a - RING.homes[i]);
  expect(new Set(offsets.map(o => o.toFixed(6))).size).toBe(RING.beadCount);
  const periods = RING.homes.map((_, i) => {
    // The first time after the start the bead's offset returns to its starting value going the same way.
    const series = Array.from({ length: 1201 }, (_, k) => at(k / 20)[i] - RING.homes[i]);
    let best = 0;
    let bestError = Infinity;
    for (let k = 20 * 5; k <= 20 * 10; k++) {
      const error = Math.abs(series[k] - series[0]) + Math.abs(series[k + 1] - series[1]);
      if (error < bestError) [best, bestError] = [k / 20, error];
    }
    return best;
  });
  for (const p of periods) {
    expect(p).toBeGreaterThanOrEqual(6 - 0.05);
    expect(p).toBeLessThanOrEqual(9 + 0.05);
  }
});

test('reduced motion: the beads stand at their homes at every moment', () => {
  for (const t of [0, 0.5, 1.7, 13, 59.99]) expect(beadAngles(t, RING, true)).toEqual([...RING.homes]);
});

test('the per-frame form writes into the array it is given (no allocation)', () => {
  const out = new Array<number>(RING.beadCount).fill(0);
  expect(beadAnglesInto(out, 3.2, RING, false)).toBe(out);
  expect(out).toEqual(beadAngles(3.2, RING, false));
});

test('the ring line fades to nothing across the face and is full behind it, over 10 degrees', () => {
  expect(ringLineVisible(0, RING)).toBe(0);
  expect(ringLineVisible(Math.PI, RING)).toBe(1);
  expect(ringLineVisible(RING.keepOut, RING)).toBe(0);
  expect(ringLineVisible(-RING.keepOut + 1e-9, RING)).toBe(0);
  expect(ringLineVisible(RING.keepOut + deg(10.001), RING)).toBe(1);
  expect(ringLineVisible(-(RING.keepOut + deg(10.001)), RING)).toBe(1);
  expect(ringLineVisible(RING.keepOut + deg(9.9), RING)).toBeLessThan(1);
  const mid = ringLineVisible(RING.keepOut + deg(5), RING);
  expect(mid).toBeGreaterThan(0.2);
  expect(mid).toBeLessThan(0.8);
  // Symmetric, and the same one turn on.
  for (const a of [0.3, 0.9, 1.2, 2.5]) {
    expect(ringLineVisible(-a, RING)).toBeCloseTo(ringLineVisible(a, RING), 12);
    expect(ringLineVisible(a + 2 * Math.PI, RING)).toBeCloseTo(ringLineVisible(a, RING), 12);
  }
});

test("seen from the stage camera (panel 2's), the ring is 1.25 wide either side, centred at brow height, its right side higher", () => {
  const seen = Array.from({ length: 720 }, (_, i) => {
    const [x, y, z] = ringPoint((i / 720) * 2 * Math.PI, RING);
    const f = CAMERA_Z / (CAMERA_Z - z);
    return [x * f, y * f] as const;
  });
  const xs = seen.map(([x]) => x);
  const ys = seen.map(([, y]) => y);
  const halfWidth = (Math.max(...xs) - Math.min(...xs)) / 2;
  expect(halfWidth).toBeGreaterThanOrEqual(1.15);
  expect(halfWidth).toBeLessThanOrEqual(1.35);
  expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(-0.28, 1);
  // Almost edge-on: far flatter than wide.
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.3 * (Math.max(...xs) - Math.min(...xs)));
  // The roll lifts the right side (about 8 degrees, spec 2.2).
  const right = ringPoint(Math.PI / 2, RING);
  const left = ringPoint(-Math.PI / 2, RING);
  expect(right[1] - left[1]).toBeCloseTo(2 * RING.radius * Math.sin(RING.roll), 9);
  // Angle 0 is toward the camera, in front of the head, and the front of the ring is the lower arc (seen from above).
  const front = ringPoint(0, RING);
  const back = ringPoint(Math.PI, RING);
  expect(front[2]).toBeGreaterThan(1);
  expect(back[2]).toBeLessThan(-1);
  expect(front[1]).toBeLessThan(back[1]);
});

test('the ring point is the orbit maths: a round orbit pitched by the tilt, then rolled and raised', () => {
  // Composed from Nox's orbitPoint (A1 build rule), not copied: check it against the orbit directly.
  const angle = 2.1;
  const [x, y, z] = ringPoint(angle, { ...RING, roll: 0, centreY: 0 });
  const orbit = orbitPoint({ shell: 0, radius: RING.radius, tilt: -RING.tilt, phase: angle - Math.PI / 2, speed: 0, size: 0 }, 0, 0, new THREE.Vector3(), { centreY: 0, halfHeight: RING.radius * Math.cos(RING.tilt), squareness: 2, swellPush: 0 });
  expect(x).toBeCloseTo(orbit.x, 12);
  expect(y).toBeCloseTo(orbit.y, 12);
  expect(z).toBeCloseTo(orbit.z, 12);
  // Every point lies on a circle of the ring's radius about its centre.
  for (const a of [0, 1, 2, 3, 4, 5]) {
    const [px, py, pz] = ringPoint(a, RING);
    expect(Math.hypot(px, py - RING.centreY, pz)).toBeCloseTo(RING.radius, 12);
  }
});

test('the line is at most its width in pixels at the stage size (100 px to a unit), and scales with the view', () => {
  expect(ringLineWidth(RING, 100)).toBeCloseTo(1.5, 12);
  expect(ringLineWidth(RING, 300)).toBeCloseTo(4.5, 12);
});

test('the ring is drawn in the intro and the detail only (the active form is Task 12)', () => {
  expect(STAGE_IDS.filter(ringShown)).toEqual(['intro', 'detail']);
});

test('tables: satellite is a placement; it lays out no artifacts yet, and the orbit placement is untouched', () => {
  expect(Object.keys(PLACEMENTS)).toContain('satellite');
  expect(Object.keys(PLACEMENTS)).toEqual(['orbit', 'pendant', 'satellite']);
  const config = { kind: 'satellite', ring: RING } as const;
  // The ring's beads are not artifacts: no bubble, button or bubbleLive spot comes from them.
  for (const stage of ['intro', 'overview'] as const) expect(PLACEMENTS.satellite.layout(10, config, stage)).toEqual([]);
  expect(PLACEMENTS.satellite.pace).toBe(orbitSpeed);
  expect(typeof PLACEMENTS.satellite.Form).toBe('function');
  // Nox's orbit entry is the very functions it was, with no form of its own.
  expect(PLACEMENTS.orbit.layout).toBe(layoutOrbits);
  expect(PLACEMENTS.orbit.point).toBe(orbitPoint);
  expect(PLACEMENTS.orbit.pace).toBe(orbitSpeed);
  expect('Form' in PLACEMENTS.orbit).toBe(false);
  expect(PLACEMENTS.orbit.layout(5, NOX_ARTIFACTS.placement as OrbitPlacement, 'intro')[1]).toEqual({ shell: 1, radius: 1.95, tilt: 0, phase: 1.2566370614359172, speed: 0.21, size: 0.16 });
  // A held artifact swings round the ring's centre (the satellite's select centre).
  expect(SELECTS.suctionHold.centre(config)).toEqual({ x: 0, y: -0.28 });
  expect(SELECTS.suctionHold.centre(NOX_ARTIFACTS.placement)).toEqual({ x: 0, y: 0.25 });
});

test("ring only (no active form given): the satellite places no artifact and has no capacity; it keeps its Form", () => {
  const config = { kind: 'satellite', ring: RING } as const;
  expect(placementCapacity(config)).toBe(0);
  const driver = placementDriver(config, 10);
  for (const still of [false, true]) driver.step({ stage: 'overview', swell: 0.5, dt: 1 / 60, hot: false, still }, []);
  for (const stage of ['intro', 'overview'] as const) for (let i = 0; i < 10; i++) expect(driver.size(stage, i)).toBeNull();
  expect(placementOf(config).Form).toBe(PLACEMENTS.satellite.Form);
  expect(placementOf(NOX_ARTIFACTS.placement).Form).toBeUndefined();
});

// --- The active form: the flight from the ring to the arms (spec 7.5) ------------------------------

/** Sixteen slots, two an arm (a tip and a mid-arm point), the upper arms' first: a fixture, not a world's. */
const TOP_DOWN = ['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5'] as const;
const SLOTS: PendantSlot[] = TOP_DOWN.flatMap((arm, k) => [{ arm, at: 0.9, order: 2 * k }, { arm, at: 0.55, order: 2 * k + 1 }]);
const ACTIVE: SatellitePlacement = {
  kind: 'satellite',
  ring: RING,
  slots: { overview: SLOTS },
  sizes: { overview: 0.3 },
  tether: { length: 0.16, color: '#d99982', width: 0.012, sag: 0.2, cap: '#d99982' },
};

/** A still arm hanging straight down from (x, 0): its point at arc fraction u. */
const armAt = (x: number) => ({ pointAt: (u: number, out: { x: number; y: number; z: number }) => { out.x = x; out.y = -2 * u; out.z = 0; } });
const ARMS = ARM_IDS.map((_, i) => armAt(-2 + (4 * i) / 7));
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const FAR: [Vec3, Vec3] = [[1.26, -0.3, -0.39], [-1.9, 0.6, 0.1]];

test('dealToBeads: placed technologies, in slot order, dealt round the beads', () => {
  const tally = (deal: number[], beads: number) => Array.from({ length: beads }, (_, b) => deal.filter(d => d === b).length);
  expect(tally(dealToBeads(15, 5), 5)).toEqual([3, 3, 3, 3, 3]);
  expect(tally(dealToBeads(10, 5), 5)).toEqual([2, 2, 2, 2, 2]);
  // Three technologies use beads 0 to 2 once each, and beads 3 and 4 not at all.
  expect(dealToBeads(3, 5)).toEqual([0, 1, 2]);
  expect(dealToBeads(7, 5)).toEqual([0, 1, 2, 3, 4, 0, 1]);
  expect(dealToBeads(0, 5)).toEqual([]);
  expect(dealToBeads(4, 0)).toEqual([]);
});

test('the flight keeps clear of the head: it comes down a lane at least keep.half out from the centre line, over the top from a bead across it, outward and down from a bead already out on its side', () => {
  const keep = { x: 0.1, half: 1 };
  // Across the centre line to a low slot: once below the bead, it is out in the lane.
  const across = flightPoint([-0.9, -0.3, -0.6], [1.0, -2.2, 0], 0, 0, 1, false, keep);
  expect(across.p).toEqual([-0.9, -0.3, -0.6]);
  // Down its own side to a slot under the head's edge: it swings outward, and comes in low.
  for (const [from, to] of [[[-0.9, -0.3, -0.6], [1.0, -2.2, 0]], [[-1.1, -0.5, 0.4], [-0.3, -2.2, 0]]] as [Vec3, Vec3][]) {
    for (let s = 0; s <= 1; s += 0.005) {
      const { p, scale } = flightPoint(from, to, s, 0, 1, false, keep);
      if (scale > 0 && p[1] < -0.6 && p[1] > -1.6) expect(Math.abs(p[0] - keep.x), `${from} at ${s.toFixed(3)}: ${p}`).toBeGreaterThan(0.75);
    }
    expect(flightPoint(from, to, 1, 0, 1, false, keep).p).toEqual(to);
  }
});

test('flightPoint: at swell 0 the orb is at the bead (not yet split, so not drawn); at 1 it is at its slot, full size, logo lit, no trail', () => {
  const [from, to] = FAR;
  for (const [index, count] of [[0, 1], [0, 16], [15, 16], [7, 10]]) {
    const start = flightPoint(from, to, 0, index, count);
    expect(dist(start.p, from)).toBeLessThan(1e-9);
    expect(start.scale).toBe(0);
    const end = flightPoint(from, to, 1, index, count);
    expect(dist(end.p, to)).toBeLessThan(1e-9);
    expect(end.scale).toBe(1);
    expect(end.logo).toBe(1);
    expect(end.trail).toBe(0);
  }
});

test('the timing (spec 7.5): no orb before the beads split (0.2); every orb travels inside 0.35 to 0.9; the logo comes in on arrival', () => {
  const [from, to] = FAR;
  for (const count of [1, 3, 10, 16]) {
    for (let index = 0; index < count; index++) {
      for (let s = 0; s <= 1.0001; s += 0.005) {
        const f = flightPoint(from, to, s, index, count);
        if (s < FLIGHT.split[0]) expect(f.scale, `s ${s}`).toBe(0);
        if (s <= FLIGHT.travel[0]) expect(dist(f.p, from), `s ${s}`).toBeLessThan(0.2);
        if (s >= FLIGHT.travel[1]) expect(dist(f.p, to), `s ${s}`).toBeLessThan(1e-9);
        if (s < FLIGHT.travel[0]) expect(f.logo).toBe(0);
        if (f.trail > 0) {
          expect(s).toBeGreaterThan(FLIGHT.travel[0]);
          expect(s).toBeLessThan(FLIGHT.travel[1]);
        }
      }
    }
  }
});

test('continuity: the flight is a pure function of swell with no jump, so a close mid-flight reverses smoothly (|p(s + 0.01) - p(s)| < 0.15)', () => {
  const pairs: [Vec3, Vec3][] = [FAR, [[-1.2, -0.3, -0.4], [2.1, -1.4, 0.1]], [[0, -0.3, -1.25], [0.3, -2.2, 0]], [[0.5, 0, 0], [0.5, 0, 0]]];
  for (const [from, to] of pairs) {
    for (const count of [1, 3, 10, 15, 16]) {
      for (let index = 0; index < count; index++) {
        for (let k = 0; k < 100; k++) {
          const a = flightPoint(from, to, k / 100, index, count);
          const b = flightPoint(from, to, (k + 1) / 100, index, count);
          expect(dist(a.p, b.p), `index ${index}/${count} s ${k / 100}`).toBeLessThan(0.15);
          expect(Math.abs(a.scale - b.scale)).toBeLessThan(0.15);
        }
        // The same swell gives the same place: nothing is kept between calls.
        expect(flightPoint(from, to, 0.6, index, count)).toEqual(flightPoint(from, to, 0.6, index, count));
      }
    }
  }
});

test('order: the first orb (upper arms) arrives before the last; the arc bows outward and up', () => {
  const [from, to] = FAR;
  const arrival = (index: number, count: number) => {
    for (let s = 0; s <= 1; s += 0.001) if (dist(flightPoint(from, to, s, index, count).p, to) < 1e-9) return s;
    return 1;
  };
  for (const count of [3, 10, 15, 16]) {
    expect(arrival(0, count)).toBeLessThan(arrival(count - 1, count));
    for (let i = 1; i < count; i++) expect(arrival(i, count)).toBeGreaterThanOrEqual(arrival(i - 1, count));
  }
  // Halfway along its travel the orb is above the straight line between bead and slot.
  const [t0, t1] = [FLIGHT.travel[0], FLIGHT.travel[1]];
  let lifted = 0;
  for (let s = t0; s <= t1; s += 0.01) {
    const { p } = flightPoint(from, to, s, 0, 1);
    const u = (p[0] - from[0]) / (to[0] - from[0]);
    if (u > 0.3 && u < 0.7) lifted = Math.max(lifted, p[1] - (from[1] + u * (to[1] - from[1])));
  }
  expect(lifted).toBeGreaterThan(0.2);
});

test('reduced motion: the flight is a crossfade, at the bead before 0.5 and at the slot after, with a scale dip and no place between', () => {
  const [from, to] = FAR;
  for (const count of [1, 10, 16]) {
    for (let index = 0; index < count; index++) {
      for (let s = 0; s <= 1.0001; s += 0.01) {
        const f = flightPoint(from, to, s, index, count, true);
        const at = s < 0.5 ? from : to;
        expect(dist(f.p, at), `s ${s}`).toBeLessThan(1e-9);
        expect(f.trail).toBe(0);
      }
      expect(flightPoint(from, to, 1, index, count, true).scale).toBe(1);
      expect(flightPoint(from, to, 0.5, index, count, true).scale).toBeLessThan(0.2);
      expect(flightPoint(from, to, 0.45, index, count, true).scale).toBeLessThan(0.2);
    }
  }
});

test('the ring through the flight: the beads brighten over 0 to 0.2, flare and go as they split over 0.2 to 0.35, as the line fades; at 0 it is as at rest', () => {
  expect(ringFlight(0, false)).toEqual({ bright: 0, flare: 0, bead: 1, line: 1, sway: 1 });
  expect(ringFlight(0.2, false).bright).toBe(1);
  expect(ringFlight(0.2, false).line).toBe(1);
  expect(ringFlight(0.2, false).sway).toBe(0);
  expect(ringFlight(0.3, false).flare).toBeGreaterThan(0.5);
  expect(ringFlight(0.35, false).bead).toBe(0);
  expect(ringFlight(0.35, false).line).toBe(0);
  expect(ringFlight(1, false).line).toBe(0);
  // Reduced motion: no flare, the ring fades out by the crossfade's middle.
  expect(ringFlight(0.3, true).flare).toBe(0);
  expect(ringFlight(0.5, true).line).toBe(0);
  expect(ringFlight(0.5, true).bead).toBe(0);
});

test("swell progress is the head swell's push, as the orbit placement reads it, scaled to its settled value", () => {
  expect(flightProgress(0)).toBe(0);
  expect(flightProgress(SWELL_PUSH_SETTLED)).toBe(1);
  expect(flightProgress(SWELL_PUSH_SETTLED / 2)).toBeCloseTo(0.5, 12);
  // The overshoot past settled holds at 1.
  expect(flightProgress(SWELL_PUSH_SETTLED * 1.4)).toBe(1);
});

test('in the overview the orbs follow the swell; once landed, a technology focus (which closes the head) keeps them; leaving releases them', () => {
  const latch = { landed: false };
  expect(holdProgress(latch, 'overview', 0.4, false)).toBe(0.4);
  expect(holdProgress(latch, 'overview', 1, false)).toBe(1);
  // In the overview itself the swell rules (a still seeking an early moment of the swell shows that moment).
  expect(holdProgress(latch, 'overview', 0.2, false)).toBe(0.2);
  expect(holdProgress(latch, 'overview', 1, false)).toBe(1);
  expect(holdProgress(latch, 'focus', 0.2, false)).toBe(1);
  expect(holdProgress(latch, 'free', 0.7, false)).toBe(0.7);
  expect(holdProgress(latch, 'focus', 0.3, false)).toBe(0.3);
  // A still of a focus (no live landing before it) shows them landed.
  expect(holdProgress({ landed: false }, 'focus', 0, true)).toBe(1);
});

test("the float: Aether's swing stays within 15 degrees and settles within 1.4 s; each orb bobs 0.03 over 3 to 5 s, out of phase", () => {
  const limits: SwingLimits = SATELLITE_SWING;
  expect(limits.maxAngle).toBeLessThanOrEqual((15 * Math.PI) / 180 + 1e-12);
  expect(limits.settle).toBeLessThanOrEqual(1.4);
  let state = restSwing(0);
  let worst = 0;
  const dt = 1 / 60;
  let t = 0;
  // The arm sweeps sideways hard for half a second, then stops.
  for (; t < 0.5; t += dt) {
    const r = pendantSwing([3, 0, 0], t, state, limits, false);
    state = r.state;
    worst = Math.max(worst, Math.abs(r.angle));
  }
  const stopped = t;
  for (; t < stopped + 3; t += dt) {
    const r = pendantSwing([0, 0, 0], t, state, limits, false);
    state = r.state;
    worst = Math.max(worst, Math.abs(r.angle));
    if (t > stopped + limits.settle) expect(Math.abs(state.x)).toBeLessThan((1 * Math.PI) / 180);
  }
  expect(worst).toBeLessThanOrEqual(limits.maxAngle + 1e-12);
  expect(BOB.amplitude).toBe(0.03);
  const phases = new Set<string>();
  for (let i = 0; i < 16; i++) {
    const period = BOB.period(i);
    expect(period).toBeGreaterThanOrEqual(3);
    expect(period).toBeLessThanOrEqual(5);
    const samples = Array.from({ length: 600 }, (_, k) => orbBob(i, k / 60));
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.03 + 1e-12);
    expect(Math.max(...samples)).toBeGreaterThan(0.025);
    phases.add(orbBob(i, 0).toFixed(4));
  }
  expect(phases.size).toBeGreaterThan(12);
});

test('the active form under the driver: 16 slots hold 16 (at most two an arm, the rest to the tray), the orbs fly from their beads to their pendants and follow the swell', () => {
  expect(placementCapacity(ACTIVE)).toBe(16);
  const crowded = { ...ACTIVE, slots: { overview: [...SLOTS, { arm: 'T1' as const, at: 0.3, order: 16 }] } };
  expect(placementCapacity(crowded)).toBe(16);
  expect(assignPendants(20, SLOTS).placed).toHaveLength(16);
  expect(assignPendants(20, SLOTS).tray).toEqual([16, 17, 18, 19]);

  const driver = placementDriver(ACTIVE, 10, { headCentreX: 0.07 });
  const out = new THREE.Vector3();
  // Closed (intro, swell 0): the beads are the ring's; no orb is drawn or offered.
  driver.step({ stage: 'intro', swell: 0, dt: 1 / 60, hot: false, still: true }, ARMS);
  for (let i = 0; i < 10; i++) expect(driver.size('intro', i)).toBeNull();
  // Mid-flight: drawn, between bead and slot.
  driver.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED * 0.6, dt: 1 / 60, hot: false, still: true }, ARMS);
  expect(driver.size('overview', 0)).toBe(0.3);
  const look = driver.flight!(0);
  expect(look.scale).toBeGreaterThan(0);
  expect(look.landed).toBe(false);
  // Settled open: every orb on its pendant.
  driver.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED, dt: 1 / 60, hot: false, still: true }, ARMS);
  for (let i = 0; i < 10; i++) {
    expect(driver.size('overview', i)).toBe(0.3);
    driver.point('overview', i, SWELL_PUSH_SETTLED, out);
    const live = driver.pendants![i];
    expect(out.distanceTo(new THREE.Vector3(...live.orbCentre))).toBeLessThan(1e-9);
    expect(driver.flight!(i)).toMatchObject({ scale: 1, logo: 1, trail: 0, landed: true });
  }
  // Technology 0 hangs on the first slot (T1's tip), technology 2 on T8's.
  expect(driver.pendants![0].arm).toBe('T1');
  expect(driver.pendants![1].arm).toBe('T1');
  expect(driver.pendants![2].arm).toBe('T8');
  // The flight starts at the dealt bead's home on the ring (beside the head's centre line).
  const early = placementDriver(ACTIVE, 10, { headCentreX: 0.07 });
  early.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED * 0.25, dt: 1 / 60, hot: false, still: true }, ARMS);
  early.point('overview', 3, 0, out);
  const [bx, by, bz] = ringPoint(RING.homes[dealToBeads(10, 5)[3]], RING);
  expect(out.distanceTo(new THREE.Vector3(bx + 0.07, by, bz))).toBeLessThan(0.2);
});

test("the arm lift's hang moves a landed orb along its arm, and its places name the arm a chosen one hangs from (Task 19)", () => {
  // The places the arm lift reads: the driver's own slots, the same in every stage, the tray's past them.
  const places = satellitePlaces(ACTIVE, 18);
  expect(places.slice(0, 3).map(p => p?.slot.arm)).toEqual(['T1', 'T1', 'T8']);
  expect(places[16]).toBeNull();
  expect(satellitePlaces({ kind: 'satellite', ring: RING }, 4)).toEqual([]);
  const driver = placementDriver(ACTIVE, 10, { headCentreX: 0 });
  const out = new THREE.Vector3();
  driver.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED, dt: 1 / 60, hot: false, still: true }, ARMS);
  const hung = new THREE.Vector3(...driver.pendants![0].orbCentre);
  // Technology 0 lifted all the way, its hang at the arm's middle (u 0.5): its pendant now hangs from there, a stretch up its arm.
  const at = new Float32Array(10).fill(Number.NaN);
  const weight = new Float32Array(10);
  at[0] = 0.5;
  weight[0] = 1;
  driver.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED, dt: 1 / 60, hot: true, still: true, focused: true, hang: { at, weight } }, ARMS);
  driver.point('overview', 0, SWELL_PUSH_SETTLED, out);
  expect(out.y - hung.y).toBeGreaterThan(0.5);
  expect(driver.pendants![0].attach[1]).toBeCloseTo(-1, 6);
  // The others stay where they hung.
  expect(new THREE.Vector3(...driver.pendants![1].orbCentre).y).toBeLessThan(out.y);
});

test('the trail is a fixed pool: the same points every frame, sampled back along the arc', () => {
  const driver = placementDriver(ACTIVE, 10, { headCentreX: 0 });
  driver.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED * 0.55, dt: 1 / 60, hot: false, still: true }, ARMS);
  const first = driver.flight!(0);
  const points = first.trailPoints;
  expect(points.length).toBeGreaterThanOrEqual(4);
  driver.step({ stage: 'overview', swell: SWELL_PUSH_SETTLED * 0.6, dt: 1 / 60, hot: false, still: true }, ARMS);
  expect(driver.flight!(0)).toBe(first);
  expect(driver.flight!(0).trailPoints).toBe(points);
  expect(driver.flight!(0).trailPoints[0]).toBe(points[0]);
  // The newest point is the orb's own place.
  const out = new THREE.Vector3();
  driver.point('overview', 0, 0, out);
  expect(points[0].distanceTo(out)).toBeLessThan(1e-9);
});
