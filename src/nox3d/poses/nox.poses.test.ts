import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS } from '../../engine/config/types';
import { BODY_X, INTRO_TRACED, NOX_POSES, OVERVIEW_TRACED, SWIM_STRETCH } from './nox.poses';
import { projectToScreen } from '../stage/anchors';
import { NOX_STAGE_FRAMES as STAGE_FRAMES } from '../bundle.nox';
import { fovFor } from '../stage/framing';
import { DETAIL_PANEL_BOX } from '../ui/detailContent';

/** Distance from a point to a polyline, projecting onto its segments. */
function distance(points: number[][], x: number, y: number) {
  let best = Infinity;
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k];
    const sx = points[k + 1][0] - ax;
    const sy = points[k + 1][1] - ay;
    const t = Math.min(1, Math.max(0, ((x - ax) * sx + (y - ay) * sy) / (sx * sx + sy * sy || 1)));
    best = Math.min(best, Math.hypot(ax + sx * t - x, ay + sy * t - y));
  }
  return best;
}

test('seen from the stage camera, every arm at rest lies on its traced curve', () => {
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f, chain.py[k] * f];
    });
    for (const [tx, ty] of INTRO_TRACED[id].slice(1)) {
      expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.02);
    }
  });
});

test('with the character rest bend, every arm still follows its traced curve closely', () => {
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: NOX.armBend });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f, chain.py[k] * f];
    });
    for (const [tx, ty] of INTRO_TRACED[id].slice(1)) {
      expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.06);
    }
  });
});

test('overview: seen from the stage camera, every arm lies on its panel 3 trace', () => {
  const { body } = NOX_POSES.overview;
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[id]), NOX.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f + body.x, chain.py[k] * f + body.y];
    });
    for (const [tx, ty] of OVERVIEW_TRACED[id]) {
      expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.03);
    }
  });
});

test('entering (panel 1): the arms trail behind the head in a bundle, T1 on top down to T8', () => {
  const still = { time: 0, sway: 0, curl: 0, droop: 0 };
  // Where each arm leaves the back of the head: Nox faces right as it swims in.
  const leaving = ARM_IDS.map((id, i) => {
    const chain = new ArmChain(restFromCurve(NOX_POSES.entering.arms[id]), NOX.arms[i], i);
    chain.solve(still);
    expect(chain.tipX, id).toBeLessThan(NOX.head.centerX - NOX.head.halfWidth);
    const k = chain.px.findIndex(x => x < -0.7);
    return chain.py[k];
  });
  for (let i = 1; i < leaving.length; i++) expect(leaving[i], ARM_IDS[i]).toBeLessThan(leaving[i - 1]);
});

test('entering: the arms stretch out a fifth for the swim, each from its intro root and curling the same way, toward its cups', () => {
  expect(SWIM_STRETCH).toBeCloseTo(1.2, 9);
  ARM_IDS.forEach((id, i) => {
    const entering = restFromCurve(NOX_POSES.entering.arms[id]);
    const intro = restFromCurve(NOX_POSES.intro.arms[id]);
    expect(entering.segmentLength / intro.segmentLength, id).toBeCloseTo(SWIM_STRETCH, 4);
    expect(entering.rootX, id).toBeCloseTo(intro.rootX, 6);
    expect(entering.rootY, id).toBeCloseTo(intro.rootY, 6);
    expect(new ArmChain(entering, NOX.arms[i], i).side, id).toBe(new ArmChain(intro, NOX.arms[i], i).side);
  });
});

test('overview: the head opens into the dome and Nox smiles', () => {
  expect(NOX_POSES.overview.headMorph).toBe(1);
  expect(NOX_POSES.overview.expression).toBe('happy');
  expect(NOX_POSES.intro.headMorph).toBe(0);
});

test('tech focus (panel 4): the head closes again and the orbs stay out round the same arms', () => {
  const focus = NOX_POSES.techFocus;
  expect(focus.headMorph).toBe(0);
  expect(focus.orbs).toBe(1);
  // The face's reaction comes from the technology in focus, not from the stage.
  expect(focus.expression).toBe(NOX_POSES.overview.expression);
  expect(focus.arms).toBe(NOX_POSES.overview.arms);
  expect(focus.body).toEqual(NOX_POSES.overview.body);
  expect(NOX_POSES.overview.orbs).toBe(1);
  expect(NOX_POSES.intro.orbs).toBe(0);
});

test('detail (panel 5): Nox at the left edge, turned toward the panel with its head tilted, attentive, head closed, no orbs', () => {
  const detail = NOX_POSES.detail;
  expect(detail.headMorph).toBe(0);
  expect(detail.orbs).toBe(0);
  expect(detail.expression).toBe('attentive');
  expect(detail.body.yaw).toBeGreaterThan(0.15);
  // Panel 5 tilts the head away from the panel, so the far eye sits higher.
  expect(detail.tilt).toBeGreaterThan(0.1);
  // The eyes land where the high-quality panel 5 paints them: midway at (478.5, 488.5) of
  // 1672 x 941. Their midpoint on the face (face-relative, at the face origin) tilts with the head
  // about the neck (Octopus's NECK_Y), then turns with the body about its upright axis at BODY_X.
  const size = { width: 1672, height: 941 };
  const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES.detail, size), size.width / size.height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  const NECK_Y = -1.05;
  const { centerX, depth, faceOrigin, halfWidth } = NOX.head;
  const [eyeX, eyeY] = NOX.face.eye.centers[1];
  const ez = depth * halfWidth * Math.sqrt(1 - (eyeX / halfWidth) ** 2);
  const { x, y, scale, yaw } = detail.body;
  const eyes = new THREE.Vector3(faceOrigin[0] - centerX, faceOrigin[1] + eyeY - NECK_Y, ez)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), detail.tilt ?? 0)
    .add(new THREE.Vector3(centerX - BODY_X, NECK_Y, 0))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .add(new THREE.Vector3(BODY_X, 0, 0))
    .multiplyScalar(scale)
    .add(new THREE.Vector3(x, y, 0));
  const p = projectToScreen(eyes, camera, size);
  expect(Math.abs(p.x - 478.5)).toBeLessThan(15);
  expect(Math.abs(p.y - 488.5)).toBeLessThan(15);
});

test('detail: the eyes rest on the panel, by its section list, when nothing else holds them', () => {
  const [lx, ly] = NOX_POSES.detail.look!;
  const [x0, y0, x1, y1] = DETAIL_PANEL_BOX;
  expect(lx).toBeGreaterThan(x0);
  expect(lx).toBeLessThan(x0 + (x1 - x0) * 0.25);
  expect(ly).toBeLessThan(y0);
  expect(ly).toBeGreaterThan(y1);
  expect(NOX_POSES.intro.look).toBeUndefined();
  expect(NOX_POSES.overview.look).toBeUndefined();
});
