import { describe, expect, test } from 'vitest';
import { blendAngles } from '../../engine/behavior/poseBlend';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { FACE_RECT } from '../../engine/character/FaceCanvas';
import { mantleRadius } from '../../engine/character/headGeometry';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS, STAGE_IDS, type ArmId } from '../../engine/config/types';
import { faceAnchor } from '../../engine/types/bundle';
import type { StagePose } from '../../engine/poses/types';
import { HOST_STAGE_FRAMES } from './bundle';
import { HOST, HOST_FACES } from './character';
import { HOST_POSES, HOW_IT_WORKS_CARDS, OVERVIEW_TRACED, SWIM_STRETCH } from './poses';
import { HOST_SWIM } from './swim';

// The host's entering and How It Works poses (platform spec 2.2, 7.4, 7.10), and the five cards'
// places in stage units. P3 native px (511 x 508) to stage units: x = (px - 255.5) / 100, y = (254 - py) / 100.

/** The neck the head turns and tilts about (Octopus.tsx NECK_Y), in the space the head is authored in. */
const NECK_Y = -1.05;
const deg = (a: number) => (a * 180) / Math.PI;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const { overview } = HOST_POSES;
const S = overview.body.scale;

/** A point in the space the head is authored in, tilted about the neck and placed by the overview's body (stage units). */
function headToStage([x, y]: readonly [number, number], pose: StagePose = overview): [number, number] {
  const t = pose.tilt ?? 0;
  const dx = x - HOST.head.centerX, dy = y - NECK_Y;
  const rx = HOST.head.centerX + dx * Math.cos(t) - dy * Math.sin(t);
  const ry = NECK_Y + dx * Math.sin(t) + dy * Math.cos(t);
  return [pose.body.x + pose.body.scale * rx, pose.body.y + pose.body.scale * ry];
}

/** The head's outline as the stage camera sees it in the overview (the mantle's lathe, tilted). */
function headOutline() {
  const { top, bottom } = HOST.head;
  const points: [number, number][] = [];
  for (let i = 0; i <= 1000; i++) {
    const y = bottom + ((top - bottom) * i) / 1000;
    const r = mantleRadius(HOST.head, y);
    points.push(headToStage([HOST.head.centerX - r, y]), headToStage([HOST.head.centerX + r, y]));
  }
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.max(...ys), centreX: (Math.min(...xs) + Math.max(...xs)) / 2, halfWidth: (Math.max(...xs) - Math.min(...xs)) / 2 };
}

/** An arm's centre line as the stage camera sees it (stage units), from its resampled chain: body placement, then perspective. */
function seenArm(pose: StagePose, id: ArmId) {
  const i = ARM_IDS.indexOf(id);
  const chain = new ArmChain(restFromCurve(pose.arms[id]), HOST.arms[i], i);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const { x, y, scale } = pose.body;
  return Array.from(chain.px, (px, k) => {
    const f = CAMERA_Z / (CAMERA_Z - scale * chain.pz[k]);
    return [(x + scale * px) * f, (y + scale * chain.py[k]) * f, k / chain.segments] as const;
  });
}

/** Distance from a point to a polyline. */
function distance(points: readonly (readonly number[])[], x: number, y: number) {
  let best = Infinity;
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k];
    const sx = points[k + 1][0] - ax, sy = points[k + 1][1] - ay;
    const t = Math.min(1, Math.max(0, ((x - ax) * sx + (y - ay) * sy) / (sx * sx + sy * sy || 1)));
    best = Math.min(best, Math.hypot(ax + sx * t - x, ay + sy * t - y));
  }
  return best;
}

type Box = (typeof HOW_IT_WORKS_CARDS)[number]['box'];
const intersects = (box: Box, r: { x0: number; y0: number; x1: number; y1: number }) => box.x0 < r.x1 && r.x0 < box.x1 && box.y1 < r.y0 && r.y1 < box.y0;
const card = (id: (typeof HOW_IT_WORKS_CARDS)[number]['id']) => HOW_IT_WORKS_CARDS.find(c => c.id === id)!.box;

/** Whether a convex polygon (corners in order) and a card box overlap: no separating axis among the box's two and the polygon's edges. */
function overlaps(polygon: readonly (readonly [number, number])[], box: Box) {
  const square: [number, number][] = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
  const axes = [[1, 0], [0, 1], ...polygon.map(([x, y], k) => {
    const [nx, ny] = polygon[(k + 1) % polygon.length];
    return [ny - y, x - nx];
  })];
  return axes.every(([ax, ay]) => {
    const along = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => x * ax + y * ay);
    const a = along(polygon), b = along(square);
    return Math.max(...a) > Math.min(...b) && Math.max(...b) > Math.min(...a);
  });
}

describe('the How It Works cards (spec 7.10)', () => {
  test('five cards in reading order: Veyra, Flux, Nox, Aether, yours', () => {
    expect(HOW_IT_WORKS_CARDS.map(c => c.id)).toEqual(['veyra', 'flux', 'nox', 'aether', 'yours']);
  });

  test("each box is spec 7.10's share of P3's panel in stage units (native px / 100 from the panel centre, +y up)", () => {
    const shares = {
      veyra: [0.12, 0.28, 0.31, 0.52],
      flux: [0.36, 0.21, 0.6, 0.51],
      nox: [0.65, 0.27, 0.84, 0.52],
      aether: [0.05, 0.57, 0.24, 0.82],
      yours: [0.68, 0.66, 0.91, 0.93],
    } as const;
    for (const { id, box } of HOW_IT_WORKS_CARDS) {
      const [sx0, sy0, sx1, sy1] = shares[id];
      expect(box.x0, id).toBeCloseTo((sx0 * 511 - 255.5) / 100, 9);
      expect(box.y0, id).toBeCloseTo((254 - sy0 * 508) / 100, 9);
      expect(box.x1, id).toBeCloseTo((sx1 * 511 - 255.5) / 100, 9);
      expect(box.y1, id).toBeCloseTo((254 - sy1 * 508) / 100, 9);
      // Left to right, top above bottom (+y up).
      expect(box.x0, id).toBeLessThan(box.x1);
      expect(box.y0, id).toBeGreaterThan(box.y1);
    }
  });

  test("Flux's box is the largest", () => {
    const area = ({ x0, y0, x1, y1 }: Box) => (x1 - x0) * (y0 - y1);
    for (const { id, box } of HOW_IT_WORKS_CARDS) if (id !== 'flux') expect(area(card('flux')), id).toBeGreaterThan(area(box));
  });

  test("every card lies inside the overview's frame (P3's panel, 5.11 x 5.08)", () => {
    expect(HOST_STAGE_FRAMES.overview).toEqual({ width: 5.11, height: 5.08 });
    for (const { id, box } of HOW_IT_WORKS_CARDS) {
      expect(Math.max(Math.abs(box.x0), Math.abs(box.x1)), id).toBeLessThan(5.11 / 2);
      expect(Math.max(Math.abs(box.y0), Math.abs(box.y1)), id).toBeLessThan(5.08 / 2);
    }
  });
});

describe('the overview pose (How It Works, P3)', () => {
  test('never swells the head, shows no orbs and presents (spec 7.3)', () => {
    expect(overview.headMorph).toBe(0);
    expect(overview.orbs).toBe(0);
    expect(overview.expression).toBe(HOST_FACES.presenting);
  });

  test('the technology focus and the detail are the overview, deep-equal (spec 7.4: both unreachable)', () => {
    expect(HOST_POSES.techFocus).toEqual(overview);
    expect(HOST_POSES.detail).toEqual(overview);
  });

  test('the head sits low and a little smaller (spec 2.2): centre x +0.03 ± 0.05, half-width 0.81 ± 0.05, top y -0.24 ± 0.05', () => {
    const head = headOutline();
    expect(Math.abs(head.centreX - 0.03)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(head.halfWidth - 0.81)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(head.top - -0.24)).toBeLessThanOrEqual(0.05);
    // The head's own half-width at the overview's scale says the same.
    expect(Math.abs(HOST.head.halfWidth * S - 0.81)).toBeLessThanOrEqual(0.05);
  });

  test("the head is turned 8 to 15 degrees to the viewer's right: P3's eye line falls to the right (the top leans right)", () => {
    // StagePose.tilt is positive when the top leans to screen left, so a turn to the right is negative.
    const turned = -deg(overview.tilt ?? 0);
    expect(turned).toBeGreaterThanOrEqual(8);
    expect(turned).toBeLessThanOrEqual(15);
    // The eyes as drawn: the right eye lower than the left by that angle.
    const [left, right] = HOST.face.eye.centers;
    const [lx, ly] = headToStage([HOST.head.faceOrigin[0] + left[0], HOST.head.faceOrigin[1] + left[1]]);
    const [rx, ry] = headToStage([HOST.head.faceOrigin[0] + right[0], HOST.head.faceOrigin[1] + right[1]]);
    expect(ry).toBeLessThan(ly);
    expect(deg(Math.atan2(ly - ry, rx - lx))).toBeCloseTo(turned, 6);
  });

  test("no card covers the face: FACE_RECT about the face anchor, untilted and as the tilted head draws it", () => {
    const [ax, ay] = faceAnchor({ character: HOST, poses: HOST_POSES }, 'overview');
    // faceAnchor sits 0.1 x scale under the face origin; FACE_RECT is head-local about the face origin.
    const oy = ay + 0.1 * S;
    const flat = { x0: ax + FACE_RECT.x * S, x1: ax + (FACE_RECT.x + FACE_RECT.z) * S, y1: oy + FACE_RECT.y * S, y0: oy + (FACE_RECT.y + FACE_RECT.w) * S };
    const [fx, fy] = HOST.head.faceOrigin;
    // The face rectangle as the tilted head draws it: a turned square, in order round its edge.
    const drawn = [[FACE_RECT.x, FACE_RECT.y], [FACE_RECT.x + FACE_RECT.z, FACE_RECT.y], [FACE_RECT.x + FACE_RECT.z, FACE_RECT.y + FACE_RECT.w], [FACE_RECT.x, FACE_RECT.y + FACE_RECT.w]].map(([x, y]) => headToStage([fx + x, fy + y]));
    for (const { id, box } of HOW_IT_WORKS_CARDS) {
      expect(intersects(box, flat), `${id} over the face rectangle`).toBe(false);
      expect(overlaps(drawn, box), `${id} over the tilted face rectangle`).toBe(false);
    }
  });

  test('the overview keeps the intro roots, so nothing pops under the mantle as the stage changes', () => {
    for (const id of ARM_IDS) {
      const [ix, iy] = HOST_POSES.intro.arms[id][0];
      const [ox, oy] = overview.arms[id][0];
      expect(ox, id).toBeCloseTo(ix, 9);
      expect(oy, id).toBeCloseTo(iy, 9);
    }
  });

  test('seen from the stage camera, every overview arm lies on its P3 trace (within 0.05)', () => {
    for (const id of ARM_IDS) {
      const seen = seenArm(overview, id);
      for (const [tx, ty] of OVERVIEW_TRACED[id]) expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.05);
    }
  });

  test('no arm tip lies inside a card box: the outer fifth of every arm, its tube radius included', () => {
    for (const id of ARM_IDS) {
      const i = ARM_IDS.indexOf(id);
      for (const [x, y, u] of seenArm(overview, id)) {
        if (u < 0.8) continue;
        const r = armRadius(u, HOST.arms[i], HOST) * S;
        for (const { id: cardId, box } of HOW_IT_WORKS_CARDS) {
          expect(x > box.x0 - r && x < box.x1 + r && y < box.y0 + r && y > box.y1 - r, `${id} at ${u.toFixed(2)} in ${cardId}`).toBe(false);
        }
      }
    }
  });

  test('T1 and T8 rise outward beside the head, their tips curling up near y -0.5 under the left and right card columns', () => {
    const head = headOutline();
    const rise = (id: 'T1' | 'T8') => {
      const seen = seenArm(overview, id);
      const tip = seen.at(-1)!;
      const top = Math.max(...seen.map(([, y]) => y));
      return { tip, top, start: OVERVIEW_TRACED[id][0] };
    };
    const t1 = rise('T1'), t8 = rise('T8');
    for (const [id, arm] of [['T1', t1], ['T8', t8]] as const) {
      expect(arm.tip[1], id).toBeGreaterThan(-0.75);
      expect(arm.tip[1], id).toBeLessThan(-0.3);
      expect(arm.top - arm.start[1], `${id} rises`).toBeGreaterThan(0.7);
    }
    // Outside the head, under the upper card of each column and above the lower one.
    expect(t1.tip[0]).toBeLessThan(head.left);
    expect(t8.tip[0]).toBeGreaterThan(head.right);
    expect(t1.tip[0]).toBeGreaterThan(card('veyra').x0);
    expect(t1.tip[0]).toBeLessThan(card('veyra').x1);
    expect(t8.tip[0]).toBeGreaterThan(card('nox').x0);
    expect(t8.tip[0]).toBeLessThan(card('nox').x1);
    expect(t1.top).toBeLessThan(card('veyra').y1);
    expect(t8.top).toBeLessThan(card('nox').y1);
    expect(t8.tip[1]).toBeGreaterThan(card('yours').y0);
  });

  test('the lower six spread out below the face, under the cards', () => {
    const tips = (['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const).map(id => seenArm(overview, id).at(-1)!);
    for (const [x, y] of tips) expect(y, `tip at ${x.toFixed(2)}`).toBeLessThan(-1.6);
    const xs = tips.map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.6);
    // Left to right in order, T2 the farthest left.
    for (let k = 1; k < xs.length; k++) expect(xs[k], `T${k + 2}`).toBeGreaterThan(xs[k - 1]);
  });

  test("each arm curls the way it does in the intro, so the blend between the stages never turns a tip inside out", () => {
    for (const id of ARM_IDS) expect(curlSign(overview, id), id).toBe(curlSign(HOST_POSES.intro, id));
  });
});

/** Which way the outer 40% of an arm turns: +1 counter-clockwise, -1 clockwise. */
function curlSign(pose: StagePose, id: ArmId) {
  const { angles } = restFromCurve(pose.arms[id]);
  let turn = 0;
  for (let k = Math.floor(angles.length * 0.6); k < angles.length - 1; k++) turn += wrap(angles[k + 1] - angles[k]);
  return Math.sign(turn);
}

/** The direction an arm leaves the body in: from its root to its middle, radians. */
function heading(pose: StagePose, id: ArmId) {
  const i = ARM_IDS.indexOf(id);
  const chain = new ArmChain(restFromCurve(pose.arms[id]), HOST.arms[i], i);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const mid = chain.segments / 2;
  return Math.atan2(chain.py[mid] - chain.py[0], chain.px[mid] - chain.px[0]);
}

describe('the entering pose and the swim (P1)', () => {
  test('every stage pose has exactly the eight arms, T1 to T8', () => {
    for (const stage of STAGE_IDS) expect(Object.keys(HOST_POSES[stage].arms), stage).toEqual([...ARM_IDS]);
    expect(Object.keys(HOST_SWIM.open.arms)).toEqual([...ARM_IDS]);
    expect(Object.keys(HOST_SWIM.trail.arms)).toEqual([...ARM_IDS]);
  });

  test("the entering pose is P1's trailing bundle (the swim's trail), on the intro's body with the welcome face", () => {
    const { entering } = HOST_POSES;
    expect(entering.arms).toEqual(HOST_SWIM.trail.arms);
    expect(entering.body).toEqual(HOST_POSES.intro.body);
    expect(entering.headMorph).toBe(0);
    expect(entering.orbs).toBe(0);
    expect(entering.expression).toBe(HOST_FACES.welcome);
    expect(HOST_STAGE_FRAMES.entering).toEqual({ width: 5.1, height: 5.08 });
  });

  test("the swim keeps the anatomy: each arm from its intro root, long (the stretch) and curling as in the intro, cups on the same side", () => {
    expect(HOST_SWIM.stretch).toBe(SWIM_STRETCH);
    for (const [name, pose] of [['open', HOST_SWIM.open], ['trail', HOST_SWIM.trail]] as const) {
      ARM_IDS.forEach((id, i) => {
        const swim = restFromCurve(pose.arms[id]);
        const intro = restFromCurve(HOST_POSES.intro.arms[id]);
        expect(swim.rootX, `${name} ${id}`).toBeCloseTo(intro.rootX, 6);
        expect(swim.rootY, `${name} ${id}`).toBeCloseTo(intro.rootY, 6);
        expect(swim.segmentLength / intro.segmentLength, `${name} ${id}`).toBeCloseTo(SWIM_STRETCH, 3);
        expect(curlSign(pose, id), `${name} ${id}`).toBe(curlSign(HOST_POSES.intro, id));
        expect(new ArmChain(swim, HOST.arms[i], i).side, `${name} ${id}`).toBe(new ArmChain(intro, HOST.arms[i], i).side);
      });
      expect(pose.body, name).toEqual(HOST_POSES.intro.body);
      expect(pose.headMorph, name).toBe(0);
    }
  });

  test('open spreads the arms round the body like an umbrella; trail gathers them in a long loose bundle below it', () => {
    const around = ARM_IDS.map(id => (deg(heading(HOST_SWIM.open, id)) - 90 + 720) % 360);
    for (let i = 1; i < around.length; i++) {
      expect(around[i] - around[i - 1], ARM_IDS[i]).toBeGreaterThan(22);
      expect(around[i] - around[i - 1], ARM_IDS[i]).toBeLessThan(50);
    }
    expect(around.at(-1)! - around[0]).toBeGreaterThan(200);
    const trail = ARM_IDS.map(id => (deg(heading(HOST_SWIM.trail, id)) + 360) % 360);
    for (const [i, a] of trail.entries()) expect(Math.abs(a - 270), ARM_IDS[i]).toBeLessThan(45);
    for (let i = 1; i < trail.length; i++) expect(trail[i], ARM_IDS[i]).toBeGreaterThan(trail[i - 1]);
    const extent = (pose: StagePose) => {
      const xs = ARM_IDS.flatMap(id => pose.arms[id].map(([x]) => x));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(extent(HOST_SWIM.trail)).toBeLessThan(0.5 * extent(HOST_SWIM.open));
    for (const id of ARM_IDS) expect(HOST_SWIM.trail.arms[id].at(-1)![1], id).toBeLessThan(HOST.head.bottom - 0.4);
  });

  test('blending between the swim poses and the intro never folds an arm', () => {
    const pairs: [string, StagePose, StagePose][] = [
      ['trail-open', HOST_SWIM.trail, HOST_SWIM.open],
      ['trail-intro', HOST_SWIM.trail, HOST_POSES.intro],
      ['open-intro', HOST_SWIM.open, HOST_POSES.intro],
      ['intro-overview', HOST_POSES.intro, overview],
    ];
    for (const [name, from, to] of pairs) {
      for (const id of ARM_IDS) {
        const a = restFromCurve(from.arms[id]).angles;
        const b = restFromCurve(to.arms[id]).angles;
        let prev = wrap(b[0] - a[0]);
        for (let k = 0; k < a.length; k++) {
          const d = wrap(b[k] - a[k]);
          expect(Math.abs(d), `${name} ${id} segment ${k}`).toBeLessThan(Math.PI - 0.25);
          expect(Math.abs(d - prev), `${name} ${id} segment ${k}`).toBeLessThan(1.5);
          prev = d;
        }
        const mid = blendAngles(a, b, 0.5, new Float32Array(a.length));
        const sharpest = (angles: Float32Array) => Math.max(...Array.from(angles.slice(1), (v, k) => Math.abs(wrap(v - angles[k]))));
        expect(sharpest(mid), `${name} ${id}`).toBeLessThan(Math.max(sharpest(a), sharpest(b)) + 0.02);
      }
    }
  });
});
