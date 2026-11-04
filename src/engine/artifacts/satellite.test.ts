import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX_ARTIFACTS } from '../../worlds/nox/artifacts';
import { CAMERA_Z } from '../config/stage';
import { type OrbitPlacement, STAGE_IDS } from '../config/types';
import { layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { type RingStyle, beadAngles, beadAnglesInto, ringLineVisible, ringLineWidth, ringPoint, ringShown } from './satellite';
import { PLACEMENTS, SELECTS } from './strategies';

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
  expect(Object.keys(PLACEMENTS)).toEqual(['orbit', 'satellite']);
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
