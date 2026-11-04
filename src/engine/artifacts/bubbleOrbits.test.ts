import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../config/stage';
import { NOX_ARTIFACTS } from '../../nox3d/config/nox.artifacts';
import { NOX } from '../../nox3d/config/nox.character';
import { NOX_POSES } from '../../nox3d/poses/nox.poses';
import { NOX_STAGE_FRAMES as STAGE_FRAMES } from '../../nox3d/bundle.nox';
import { fovFor } from '../stage/framing';
import { DOME_PANEL_BOX } from '../ui/OverviewPanel';
import { stageBoxFor } from '../ui/useStageBox';
import { FOCUS_GROW } from './TechBubbles';
import { layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { SWELL_PUSH_PEAK } from '../../nox3d/sequences/defaults';
import { SWELL_PUSH_SETTLED } from '../sequences/keys';

type Stage = 'intro' | 'overview';
/** Nox's orbit placement: the shells and constants the bubbles run on. */
const PLACEMENT = NOX_ARTIFACTS.placement;
const NOX_SHELLS = PLACEMENT.shells;
type Box = readonly [number, number, number, number];
const STAGES: Stage[] = ['intro', 'overview'];
const VIEWPORTS = [{ width: 1536, height: 1024 }, { width: 1280, height: 720 }];
const ORIGIN = new THREE.Vector3();
/** How far the orbits are pushed out in each stage: the overview's head swell pushes them (sequences/headSwell.ts), settled and at its peak. */
const SWELLS: Record<Stage, number[]> = { intro: [0], overview: [0, SWELL_PUSH_SETTLED, SWELL_PUSH_PEAK] };

test('fifteen bubbles on two or three shells', () => {
  expect(NOX_SHELLS.length).toBeGreaterThanOrEqual(2);
  expect(NOX_SHELLS.length).toBeLessThanOrEqual(3);
  for (const stage of STAGES) {
    const orbits = layoutOrbits(15, PLACEMENT, stage);
    expect(orbits).toHaveLength(15);
    expect(new Set(orbits.map(o => o.shell)).size).toBe(NOX_SHELLS.length);
    for (const o of orbits) expect(o.radius).toBe(NOX_SHELLS[o.shell].radius);
  }
});

test('the bubbles are smaller in the intro framing', () => {
  expect(layoutOrbits(15, PLACEMENT, 'intro')[0].size).toBeLessThan(layoutOrbits(15, PLACEMENT, 'overview')[0].size);
});

test('bubbles never overlap each other', () => {
  const out = Array.from({ length: 15 }, () => new THREE.Vector3());
  for (const stage of STAGES) {
    const orbits = layoutOrbits(15, PLACEMENT, stage);
    let least = Infinity;
    // 60 s sampled at 10 Hz, as the orbit clock runs.
    for (let t = 0; t <= 60; t += 0.1) {
      orbits.forEach((o, i) => orbitPoint(o, t, 0, out[i], PLACEMENT));
      for (let i = 0; i < orbits.length; i++) {
        for (let j = i + 1; j < orbits.length; j++) least = Math.min(least, out[i].distanceTo(out[j]) / (orbits[i].size + orbits[j].size));
      }
    }
    expect(least).toBeGreaterThanOrEqual(1.2);
  }
});

// The page's boxes the bubbles keep clear of, in world units on the z = 0 plane, as each stage lays
// them out: the intro's title lines and nameplate are measured from its capture (200 px a unit), the
// face is as the overview's face spot protects it, and the overview's panel is the dome's inner box.
const FACE = (stage: Stage): Box => {
  const { body } = NOX_POSES[stage];
  const [ox, oy] = NOX.head.faceOrigin;
  return [body.x + ox - 1.05, body.y + oy + 0.45, body.x + ox + 1.05, body.y + oy - 0.55];
};
const BOXES: Record<Stage, Record<string, Box>> = {
  intro: {
    face: FACE('intro'),
    kicker: [-0.54, 1.53, 0.56, 1.39],
    title: [-1.15, 1.35, 1.15, 0.96],
    tagline: [-0.81, 0.9, 0.81, 0.72],
    description: [-1.37, 0.75, 1.37, 0.44],
    nameplate: [-0.69, -1.89, 0.69, -2.34],
  },
  overview: { face: FACE('overview'), panel: DOME_PANEL_BOX },
};

test('bubbles never cover the face, the title or the nameplate', () => {
  for (const size of VIEWPORTS) {
    for (const stage of STAGES) {
      const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES[stage], size), size.width / size.height, 0.1, 60);
      camera.position.set(0, 0, CAMERA_Z);
      camera.updateMatrixWorld();
      const { body } = NOX_POSES[stage];
      const boxes = Object.entries(BOXES[stage]).map(([name, box]) => [name, stageBoxFor(STAGE_FRAMES[stage], box, size)] as const);
      const orbits = layoutOrbits(15, PLACEMENT, stage);
      const at = new THREE.Vector3();
      const edge = new THREE.Vector3();
      const px = (v: THREE.Vector3) => ({ x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });
      // A full lap of the slowest shell; the least gap between a bubble's edge and a box is checked once.
      let least = { gap: Infinity, at: '' };
      for (const swell of SWELLS[stage]) for (let t = 0; t < 32; t += 0.1) {
        for (const o of orbits) {
          orbitPoint(o, t, swell, at, PLACEMENT);
          at.x += body.x;
          at.y += body.y;
          // The grown bubble in focus is the widest it gets.
          edge.set(at.x + o.size * FOCUS_GROW[stage], at.y, at.z);
          const c = px(at.clone().project(camera));
          const radius = Math.abs(px(edge.project(camera)).x - c.x);
          for (const [name, box] of boxes) {
            const dx = Math.max(box.left - c.x, 0, c.x - (box.left + box.width));
            const dy = Math.max(box.top - c.y, 0, c.y - (box.top + box.height));
            const gap = Math.hypot(dx, dy) - radius;
            if (gap < least.gap) least = { gap, at: `${stage} ${size.width}x${size.height} swell=${swell} t=${t.toFixed(2)} ${name}` };
          }
        }
      }
      expect(least.gap, least.at).toBeGreaterThan(0);
    }
  }
});

test('the bubbles stay inside the stage frame', () => {
  const at = new THREE.Vector3();
  for (const stage of STAGES) {
    const { body } = NOX_POSES[stage];
    const frame = STAGE_FRAMES[stage];
    for (const o of layoutOrbits(15, PLACEMENT, stage)) {
      for (const swell of SWELLS[stage]) for (let t = 0; t < 32; t += 0.1) {
        orbitPoint(o, t, swell, at, PLACEMENT);
        const scale = CAMERA_Z / (CAMERA_Z - at.z);
        expect(Math.abs((at.x + body.x) * scale) + o.size).toBeLessThan(frame.width / 2);
        expect(Math.abs((at.y + body.y) * scale) + o.size).toBeLessThan(frame.height / 2);
      }
    }
  }
});

test('swell pushes the orbits outward', () => {
  const calm = new THREE.Vector3();
  const swollen = new THREE.Vector3();
  const middle = new THREE.Vector3();
  for (const o of layoutOrbits(15, PLACEMENT, 'overview')) {
    for (let t = 0; t < 30; t += 3) {
      orbitPoint(o, t, 0, calm, PLACEMENT);
      orbitPoint(o, t, 0.5, middle, PLACEMENT);
      orbitPoint(o, t, 1, swollen, PLACEMENT);
      expect(swollen.distanceTo(ORIGIN)).toBeGreaterThan(middle.distanceTo(ORIGIN));
      expect(middle.distanceTo(ORIGIN)).toBeGreaterThan(calm.distanceTo(ORIGIN));
    }
  }
});

test('an orbit is a function of the clock alone, and closes after one lap', () => {
  const o = layoutOrbits(15, PLACEMENT, 'intro')[4];
  const a = orbitPoint(o, 7.3, 0, new THREE.Vector3(), PLACEMENT);
  expect(orbitPoint(o, 7.3, 0, new THREE.Vector3(), PLACEMENT).equals(a)).toBe(true);
  expect(orbitPoint(o, 7.3 + (2 * Math.PI) / o.speed, 0, new THREE.Vector3(), PLACEMENT).distanceTo(a)).toBeLessThan(1e-9);
});

test('orbits ease to still while a bubble is hot', () => {
  const state = { x: 1, v: 0 };
  let last = 1;
  for (let t = 0; t < 0.4 - 1e-9; t += 1 / 60) {
    const x = orbitSpeed(true, 1 / 60, state);
    expect(x).toBeLessThanOrEqual(last + 1e-9);
    last = x;
  }
  expect(last).toBeLessThan(0.02);
  for (let t = 0; t < 1; t += 1 / 60) orbitSpeed(true, 1 / 60, state);
  expect(state.x).toBeLessThan(0.001);
  // Letting go brings them back to full pace, smoothly and without overshoot.
  let peak = 0;
  for (let t = 0; t < 1.2; t += 1 / 60) peak = Math.max(peak, orbitSpeed(false, 1 / 60, state));
  expect(peak).toBeLessThanOrEqual(1);
  expect(state.x).toBeGreaterThan(0.99);
});

test('the speed factor does not depend on the frame length', () => {
  const slow = { x: 1, v: 0 };
  const fast = { x: 1, v: 0 };
  orbitSpeed(true, 0.2, slow);
  for (let i = 0; i < 20; i++) orbitSpeed(true, 0.01, fast);
  expect(Math.abs(slow.x - fast.x)).toBeLessThan(0.01);
});
