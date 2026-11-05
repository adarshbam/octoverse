import { expect, test } from 'vitest';
import { ARM_IDS } from '../../engine/config/types';
import { fovFor } from '../../engine/stage/framing';
import { CAMERA_Z } from '../../engine/config/stage';
import { faceAnchor, faceOrigin } from '../../engine/types/bundle';
import { VEYRA_ARTIFACTS } from './artifacts';
import { VEYRA_BUNDLE, VEYRA_STAGE_FRAMES, VEYRA_STAGE_PANELS } from './bundle';
import { VEYRA } from './character';
import { TECH_FOCUS_ORB, VEYRA_POSES } from './poses';
import { drawnArms, veyraArmRadius } from './slotCriteria';

const { techFocus, overview, detail } = VEYRA_POSES;

test('the tech focus (P4) is the overview with one arm lifted: T1, the arm her first technology hangs from', () => {
  expect(VEYRA_ARTIFACTS.placement.slots.overview[0].arm).toBe('T1');
  for (const id of ARM_IDS.filter(id => id !== 'T1')) expect(techFocus.arms[id], id).toEqual(overview.arms[id]);
  expect(techFocus.arms.T1).not.toEqual(overview.arms.T1);
  expect(techFocus.body).toEqual(overview.body);
  expect(techFocus.headMorph).toBe(0);
  expect(techFocus.expression).toBe('focused');
});

test('the lifted arm rises from under the face past the eye line and holds its orb beside the eyes, clear of the closed head', () => {
  const { body } = techFocus;
  const lifted = drawnArms(techFocus).T1;
  const eyeLine = faceOrigin(VEYRA_BUNDLE, 'overview')[1] - 0.1 * body.scale;
  // Its curl's top is well above the eyes (P4: 0.76 above the eyes' midpoint at P4's size).
  expect(Math.max(...lifted.map(p => body.y + body.scale * p[1])) - eyeLine).toBeGreaterThan(0.6);
  // The held orb at the eyes' height (P4: 0.31 above them), outside the head's box by more than its grown radius (1.25x).
  expect(Math.abs(TECH_FOCUS_ORB[1] - eyeLine)).toBeLessThan(0.4);
  const { head } = VEYRA;
  const orbX = (TECH_FOCUS_ORB[0] - body.x) / body.scale;
  expect(head.centerX - head.halfWidth - orbX).toBeGreaterThan(1.25 * VEYRA_ARTIFACTS.placement.sizes.overview);
  // Above the head's waist (where the head is its full width) the arm keeps off the head's box, its thickness taken off.
  let least = Infinity;
  lifted.forEach(([x, y], k) => {
    if (y < head.waist) return;
    least = Math.min(least, Math.hypot(Math.max(head.centerX - head.halfWidth - x, 0, x - head.centerX - head.halfWidth), Math.max(head.waist - y, 0, y - head.top)) - veyraArmRadius('T1', k / (lifted.length - 1)));
  });
  expect(least).toBeGreaterThan(0.02);
});

/** Where a stage point lands in a viewport, in CSS px from the top left (the stage camera, unleaned). */
function onScreen([x, y]: readonly number[], frame: { width: number; height: number }, size: { width: number; height: number }) {
  const halfHeight = Math.tan((fovFor(frame, size) * Math.PI) / 360) * CAMERA_Z;
  const perUnit = size.height / 2 / halfHeight;
  return { x: size.width / 2 + x * perUnit, y: size.height / 2 - y * perUnit };
}

test('the detail (P5) keeps the face on screen, left of the panel, at P5 and at the phone; the eyes where P5 paints them', () => {
  const anchor = faceAnchor(VEYRA_BUNDLE, 'detail');
  for (const size of [{ width: 2601, height: 1584 }, { width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
    const p = onScreen(anchor, VEYRA_STAGE_FRAMES.detail, size);
    expect(p.x, `${size.width}`).toBeGreaterThan(0.05 * size.width);
    expect(p.x, `${size.width}`).toBeLessThan(0.95 * size.width);
    expect(p.y, `${size.width}`).toBeGreaterThan(0.05 * size.height);
    expect(p.y, `${size.width}`).toBeLessThan(0.95 * size.height);
  }
  // Left of the panel by more than half her face (on a desktop the panel stands beside her).
  expect(VEYRA_STAGE_PANELS.detail[0] - anchor[0]).toBeGreaterThan(0.5 * detail.body.scale);
  // P5's eyes' midpoint (-2.85, 0.15): the face anchor's x and y (the eyes' line) within 0.1.
  expect(Math.abs(anchor[0] + 2.85)).toBeLessThan(0.1);
  expect(Math.abs(anchor[1] - 0.15)).toBeLessThan(0.1);
  expect(detail.expression).toBe('attentive');
  expect(detail.body.yaw).toBeGreaterThan(0.3);
});
