import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { assignPendants } from '../../engine/artifacts/pendant';
import { beadAngles, ringShown } from '../../engine/artifacts/satellite';
import { placementCapacity } from '../../engine/artifacts/strategies';
import { CHOOSING_STAGES, STAGE_IDS } from '../../engine/config/types';
import { createProjectModel } from '../../engine/host/instanceModel';
import { AETHER_ARTIFACTS } from './artifacts';
import { AETHER_INTRO_TITLE, AETHER_STAGE_FRAMES } from './bundle';
import { AETHER } from './character';
import { aetherProjectFor } from './content/aetherProject';
import { aetherTechnologies } from './content/aetherTechnologies';
import { AETHER_TECHNOLOGIES_15 } from './content/testSets';
import { AETHER_POSES, TECH_FOCUS_ORB } from './poses';
import { NECK_Y, PIVOT_Y, VIEWPORTS, type Disc, type Rect, type Size, beadDiscs, discClear, faceRect, hangingDiscs, headToStage, introHtml, phoneSheetAndTray, pixelsPerUnit, ringAndHeadHalfWidths, ringLinePoints, seen, toScreen } from './stageCriteria';

// Spec 2.5 and 7.11 (Task 13, Review Focus 4): no bead, orb or thread of hers covers her face, the
// intro's title or its nameplate in any frozen stage, on the review desktop and on the 390 x 844
// phone, where she is drawn smaller in the upper screen (the stage frames are fitted to the phone's
// width) and the ring shrinks with her. The frames are the bundle's stage frames, never hard-coded.

const { placement } = AETHER_ARTIFACTS;
const { ring } = placement;
const PHONE = VIEWPORTS.phone;
const VIEWS = Object.entries(VIEWPORTS) as [keyof typeof VIEWPORTS, Size][];
const fromCamera = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
/** A minute of the beads' sway at 30 frames a second, and the frozen still (every bead at its home). */
const MINUTE = Array.from({ length: 60 * 30 + 1 }, (_, i) => i / 30);
const STILL_AND_MINUTE = (pose: (typeof AETHER_POSES)['intro'], stage: 'intro' | 'detail', size: Size): Disc[][] => [
  beadDiscs(pose, AETHER_STAGE_FRAMES[stage], size, 0, true),
  ...MINUTE.map(t => beadDiscs(pose, AETHER_STAGE_FRAMES[stage], size, t, false)),
];

/**
 * Whether a disc behind her head's middle is hidden by her head: inside the head's outline as the
 * camera sees it (her head's box, about its middle, turned and tilted with her), by more than the
 * disc's own radius. Her beads are depth-tested (SatelliteRing), so her head covers them.
 */
function behindHead(d: Disc, pose: (typeof AETHER_POSES)['intro'], stage: 'intro' | 'detail', size: Size) {
  const { head } = AETHER;
  const frame = AETHER_STAGE_FRAMES[stage];
  const ppu = pixelsPerUnit(frame, size) * pose.body.scale;
  const midY = (head.top + head.bottom) / 2;
  const c = seen(headToStage(pose, [head.centerX, midY, 0]));
  const at = toScreen(c.x, c.y, frame, size);
  // Back into the head's tilted frame, in head units.
  const tilt = pose.tilt ?? 0;
  const dx = (d.x - at.x) / ppu, dy = -(d.y - at.y) / ppu;
  const u = dx * Math.cos(tilt) + dy * Math.sin(tilt), v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
  const r = d.r / ppu;
  return (Math.abs(u) + r) / head.halfWidth < 1 && (Math.abs(v) + r) / ((head.top - head.bottom) / 2) < 1;
}

test("the screen model's pivots are Octopus's own (the neck and the body's yaw pivot)", () => {
  const octopus = readFileSync('src/engine/character/Octopus.tsx', 'utf8');
  expect(octopus).toContain(`const NECK_Y = ${NECK_Y};`);
  expect(octopus).toContain(`const PIVOT_Y = ${PIVOT_Y};`);
  // The ring is drawn in the head's space, at the head's centre line (SatelliteRing), so it turns, tilts and scales with her.
  expect(readFileSync('src/engine/artifacts/SatelliteRing.tsx', 'utf8')).toContain('position={[head.centerX, 0, 0]}');
});

test('ringKeepOut at the 390 x 844 phone: over a minute, every bead angle stays outside the face sector; the ring shrinks with her', () => {
  for (const t of MINUTE) for (const a of beadAngles(t, ring, false)) expect(fromCamera(a), `t ${t}`).toBeGreaterThan(ring.keepOut);
  for (const a of beadAngles(0, ring, true)) expect(fromCamera(a)).toBeGreaterThan(ring.keepOut + ring.sway.amplitude);
  for (const stage of ['intro', 'detail'] as const) {
    const pose = AETHER_POSES[stage], frame = AETHER_STAGE_FRAMES[stage];
    const desk = ringAndHeadHalfWidths(pose, frame, VIEWPORTS.desktop);
    const phone = ringAndHeadHalfWidths(pose, frame, PHONE);
    // Smaller on the phone, and the same size against her head (it is drawn in her head's space).
    expect(phone.ring, stage).toBeLessThan(desk.ring);
    expect(phone.ring / phone.head, stage).toBeCloseTo(desk.ring / desk.head, 6);
    // Spec 2.2: the ring's projected half-width 1.25 +- 0.1 against her head's 0.745 (P2's).
    expect(phone.ring / phone.head, stage).toBeGreaterThan(1.15 / 0.745 - (stage === 'detail' ? 0.1 : 0));
  }
});

test('the ring keeps out of her face rect at the phone (and the desktop): no bead in front of her head ever touches it, and the ring line in front never crosses it, in the intro and the detail', () => {
  for (const [view, size] of VIEWS) {
    for (const stage of ['intro', 'detail'] as const) {
      const pose = AETHER_POSES[stage];
      const rect = faceRect(pose, AETHER_STAGE_FRAMES[stage], size);
      let least = Infinity;
      for (const discs of STILL_AND_MINUTE(pose, stage, size)) {
        for (const d of discs) {
          if (d.front) least = Math.min(least, discClear(d, rect));
          // A bead behind her head's middle that comes over the face rect is hidden there by her head.
          else if (discClear(d, rect) < 0) expect(behindHead(d, pose, stage, size), `${view} ${stage} ${d.name}`).toBe(true);
        }
      }
      expect(least, `${view} ${stage}`).toBeGreaterThan(2);
      for (const p of ringLinePoints(pose, AETHER_STAGE_FRAMES[stage], size)) {
        const inFace = p.x > rect.x0 && p.x < rect.x1 && p.y > rect.y0 && p.y < rect.y1;
        if (inFace) expect(p.front, `${view} ${stage} line at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).toBe(false);
        if (inFace) expect(behindHead({ ...p, r: 0, front: false, name: 'line' }, pose, stage, size), `${view} ${stage} line`).toBe(true);
      }
    }
  }
});

test("frozen intro at the phone: her beads clear the face rect, the title block and the nameplate (the intro's HTML on its square stage)", () => {
  const pose = AETHER_POSES.intro, frame = AETHER_STAGE_FRAMES.intro;
  for (const [view, size] of VIEWS) {
    const rect = faceRect(pose, frame, size);
    const { title, nameplate } = introHtml(size, AETHER_INTRO_TITLE.halfWidth, frame.width);
    for (const d of beadDiscs(pose, frame, size, 0, true)) {
      for (const [name, box] of [['face', rect], ['title', title], ['nameplate', nameplate]] as [string, Rect][]) {
        expect(discClear(d, box), `${view} ${d.name} against the ${name}`).toBeGreaterThan(name === 'face' ? 4 : 10);
      }
    }
  }
  // At the phone the margins (CSS px) are smaller than on the desktop, as she is.
  const phoneTitle = introHtml(PHONE, AETHER_INTRO_TITLE.halfWidth, frame.width).title;
  expect(Math.min(...beadDiscs(pose, frame, PHONE, 0, true).map(d => discClear(d, phoneTitle)))).toBeGreaterThan(20);
});

test('frozen overview and tech focus at the phone, for 1, 3, 10, 15, 16 and 20 technologies: no orb or thread on her face rect', () => {
  for (const [view, size] of VIEWS) {
    for (const stage of ['overview', 'techFocus'] as const) {
      // The engine shows a tech focus in the overview's pose (WorldHost); the tech focus pose is the arm lift's target, its other arms the overview's.
      const rect = faceRect(AETHER_POSES.overview, AETHER_STAGE_FRAMES[stage], size);
      for (const count of [1, 3, 10, 15, 16, 20]) {
        for (const pose of [AETHER_POSES.overview, AETHER_POSES[stage]]) {
          const discs = hangingDiscs(pose, count, AETHER_STAGE_FRAMES[stage], size);
          expect(discs.filter(d => d.name.endsWith('orb'))).toHaveLength(Math.min(count, 16));
          for (const d of discs) expect(discClear(d, rect), `${view} ${stage} ${count}: ${d.name}`).toBeGreaterThan(10);
        }
      }
      // The held orb (grown 1.3x, spec 7.5) at the tech focus's place, off her face and inside the frame.
      const frame = AETHER_STAGE_FRAMES[stage];
      const held = { ...toScreen(TECH_FOCUS_ORB[0], TECH_FOCUS_ORB[1], frame, size), r: 1.3 * placement.sizes!.overview * pixelsPerUnit(frame, size), front: true, name: 'held' };
      expect(discClear(held, rect), `${view} ${stage} held orb`).toBeGreaterThan(20);
    }
  }
});

test('at the phone her ten hanging orbs clear the bottom sheet and the tray above it; more than twelve (a third tray row) reach it: the known limit, as Veyra', () => {
  const frame = AETHER_STAGE_FRAMES.overview;
  const shown = aetherTechnologies.length;
  expect(Math.min(...hangingDiscs(AETHER_POSES.overview, shown, frame, PHONE).map(d => discClear(d, phoneSheetAndTray(PHONE, shown))))).toBeGreaterThan(10);
  // Thirteen to eighteen make a third row of six; its top reaches her lowest orbs (T3's tip and below).
  // Task 20 lifts this (the hanging orbs hide while the phone's tray lists them all), and this flips.
  for (const count of [15, 16]) expect(Math.min(...hangingDiscs(AETHER_POSES.overview, count, frame, PHONE).map(d => discClear(d, phoneSheetAndTray(PHONE, count)))), `${count}`).toBeLessThan(0);
});

test('the entrance draws no ring, no beads and no orbs; the ring is drawn in the intro and the detail only', () => {
  expect(AETHER_POSES.entering.orbs).toBe(0);
  expect(STAGE_IDS.filter(ringShown)).toEqual(['intro', 'detail']);
  expect(AETHER_POSES.detail.orbs).toBe(0);
});

test('the tray on the phone lists every technology, in the project order, for 1, 3, 10, 15, 16 and 20 technologies (the model that feeds it)', () => {
  const capacity = placementCapacity(placement);
  expect(capacity).toBe(16);
  const pool = [...AETHER_TECHNOLOGIES_15, ...Array.from({ length: 5 }, (_, i) => ({ id: `extra-${i}`, name: `Extra ${i}`, category: 'placeholder', iconKey: `extra-${i}` }))];
  for (const count of [1, 3, 10, 15, 16, 20]) {
    const technologies = pool.slice(0, count);
    const model = createProjectModel(aetherProjectFor(technologies), technologies, capacity);
    // A phone held upright lists `order` (WorldHost: trayAll); a wider screen lists only the overflow.
    expect(model.order.map(model.trayItem).map(t => t.name), `${count}`).toEqual(technologies.map(t => t.name));
    expect(model.overflow, `${count}`).toEqual(technologies.slice(16).map(t => t.id));
    expect(model.orbs, `${count}`).toHaveLength(Math.min(count, 16));
    expect(assignPendants(count, placement.slots!.overview).tray, `${count}`).toHaveLength(Math.max(0, count - 16));
  }
  // Her shipped ten: the phone's tray shows all ten by name.
  const shipped = createProjectModel(aetherProjectFor(aetherTechnologies), aetherTechnologies, capacity);
  expect(shipped.order.map(shipped.trayItem).map(t => t.name)).toEqual(['OpenAI', 'Python', 'TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Vector DB']);
  expect(CHOOSING_STAGES).toContain('overview');
});
