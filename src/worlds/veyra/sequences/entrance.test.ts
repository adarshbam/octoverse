import { beforeAll, expect, test } from 'vitest';
import { entranceSeenKey } from '../../../engine/behavior/useStage';
import { strokeAt, strokeTiming } from '../../../engine/motion/stroke';
import { type EntranceFrame, armHalfSpan, entranceClearance, entranceFrame } from '../../../engine/sequences/entrance';
import { loadWorldSequences, type Sequences } from '../../../engine/sequences/theatre';
import { validateBundle } from '../../../engine/types/bundle';
import { VEYRA_BUNDLE } from '../bundle';
import { VEYRA } from '../character';
import { VAULT_WORLD } from '../place/config';
import { VEYRA_ARM_HALF_SPAN, VEYRA_ENTRANCE_FOOTPRINTS, VEYRA_ENTRANCE_GEOMETRY } from './clearance';
import { SEQUENCE_DEFAULTS } from './defaults';
import { VEYRA_SEQUENCES } from './index';

// Veyra's entrance (spec 7.9): appears out of the haze, three long strokes down the vault, the
// padlock's ring turning a quarter turn with a soft flash at about 3.5 s, a slow 200 degree turn
// from 4.5 to 5.5 s, the settle with the sparkle shimmer from 5.5 to 6.5 s.

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(VEYRA_SEQUENCES);
});
const at = (s: number): EntranceFrame => entranceFrame(seq, s, VEYRA_ENTRANCE_GEOMETRY);
const times = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const deg = (r: number) => (r * 180) / Math.PI;
const LENGTH = 6.5;

test('the entrance key is octoverse.veyra.entranceSeen, and the sheet is 6.5 s with the turn Veyra states', () => {
  expect(entranceSeenKey(VEYRA_BUNDLE.id)).toBe('octoverse.veyra.entranceSeen');
  expect(seq.length('entrance')).toBe(LENGTH);
  expect(SEQUENCE_DEFAULTS.entrance.length).toBe(LENGTH);
  // The shape: a 200 degree glide-turn, no spiral.
  expect(VEYRA_SEQUENCES.entrance).toEqual({ turn: (200 * Math.PI) / 180, spiral: false });
});

test('the stroke she swims for the checks is strokeTiming(personality): the glide 1.0 s, not the raw 0.625', () => {
  expect(VEYRA_ENTRANCE_GEOMETRY.swim).toEqual(strokeTiming(VEYRA.personality));
  expect(VEYRA_ENTRANCE_GEOMETRY.swim.glide).toBeCloseTo(1.0, 9);
  expect(VEYRA.personality.swim.glide).toBeCloseTo(0.625, 9);
  // Her reach: the intro's arms (1.86) and the open swim pose (2.05) fit in `open`; the trail bundle and the head in `closed`.
  expect(VEYRA_ARM_HALF_SPAN.open).toBeGreaterThanOrEqual(2.05);
  expect(VEYRA_ARM_HALF_SPAN.closed).toBeGreaterThan(VEYRA.head.halfWidth + 0.4);
});

test('she appears out of the haze far down the vault on the left, glow first, and ends exactly at the stage spot facing the visitor', () => {
  const start = at(0);
  expect(start.position[0]).toBeLessThan(-3);
  expect(start.position[2]).toBeLessThan(-18);
  expect(start.reveal).toBe(0);
  expect(at(1).reveal).toBe(1);
  expect(start.stroke).toBe(0);
  const end = at(LENGTH);
  end.position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(end.yaw).toBe(0);
  expect(end.pitch).toBeCloseTo(0, 9);
  expect(end.spin).toBe(1);
  expect(end.open).toBe(1);
  expect(end.settle).toBe(1);
  expect(end.expression).toBe('gentle');
  expect(at(99)).toEqual(end);
});

// The path keeps clear of the arch, the walls, the blocks and the steps of her own layout with her
// arms open and closed. A gap of 0.3 stage units (about the width of one of her arms, which are
// 0.1 to 0.15 thick at the root, with the cups' flare and the breath's swell on top): clear to see,
// not a graze. Held open the whole way is a worse case than she ever is (her arms open only as a
// stroke opens them), and she clears it too: the path is routed through the open water for that.
test('the path clears the arch, the walls and the blocks of layout.json with her arms as drawn, open and closed, by at least 0.3', () => {
  const layout = VAULT_WORLD.layout;
  expect(VEYRA_BUNDLE.place.layout).toBe(layout);
  const gaps = entranceClearance(seq, VEYRA_ENTRANCE_GEOMETRY, layout, VEYRA_ENTRANCE_FOOTPRINTS, { samples: 1301 });
  for (const reach of ['frame', 'open', 'closed'] as const) expect(gaps[reach].gap, `${reach}: ${gaps[reach].piece} at ${gaps[reach].seconds} s`).toBeGreaterThan(0.3);
  expect(gaps.open.gap).toBeLessThan(gaps.closed.gap);
  expect(gaps.closed.gap - gaps.open.gap).toBeCloseTo(VEYRA_ARM_HALF_SPAN.open - VEYRA_ARM_HALF_SPAN.closed, 6);
  // The footprints cover the pieces a path could hit: every arch, wall, block and step of the layout has one.
  const counted = Object.values(layout.groups).flat().filter(p => VEYRA_ENTRANCE_FOOTPRINTS[p.piece]).map(p => p.piece);
  expect(new Set(counted)).toEqual(new Set(['arch', 'wall_broken', 'block_a', 'block_b', 'block_c', 'block_d', 'steps']));
});

test('three strokes: the clock runs three whole strokes, and each power stroke (the surge) starts between 1 and 4.5 s', () => {
  const timing = VEYRA_ENTRANCE_GEOMETRY.swim;
  expect(at(0).stroke).toBe(0);
  expect(at(5.6).stroke).toBeCloseTo(3, 9);
  const surges: number[] = [];
  let last = strokeAt(at(0).stroke, timing).phase;
  for (const s of times(0, LENGTH, 0.001)) {
    const { phase } = strokeAt(at(s).stroke, timing);
    if (phase === 'power' && last !== 'power') surges.push(s);
    last = phase;
  }
  expect(surges.length).toBe(3);
  for (const s of surges) {
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThan(4.5);
  }
  // The whole power strokes are inside the window too (they last 0.26 s of a 1.91 s stroke, scaled to the clock).
  const stroke = (s: number) => strokeAt(at(s).stroke, timing);
  for (const s of surges) expect(stroke(s + 0.2).phase).toBe('power');
  // An even rate (one stroke per 1.7 s), a calm glide (0.88 s, against Nox's 0.6) between the surges.
  expect(surges[1] - surges[0]).toBeCloseTo(1.7, 2);
  expect(surges[2] - surges[1]).toBeCloseTo(1.7, 2);
  const period = timing.recovery + timing.power + timing.glide;
  expect((1.7 * timing.glide) / period).toBeGreaterThan(0.8);
  // Long glides: the path's speed between surges stays steady and calm, never above 7 stage units a second.
  for (const s of times(0.5, 5.5, 0.05)) {
    const h = 0.005;
    const a = at(s - h).position;
    const b = at(s + h).position;
    expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * h), `${s} s`).toBeLessThan(7);
  }
});

test('the padlock ring turns a quarter turn between 3.3 and 3.7 s, monotonically, and is still before and after', () => {
  const ring = (s: number) => at(s).kit!.lockRing;
  expect(ring(0)).toBe(0);
  expect(ring(3.3)).toBeCloseTo(0, 9);
  expect(ring(3.7)).toBeCloseTo(Math.PI / 2, 9);
  expect(ring(LENGTH)).toBeCloseTo(Math.PI / 2, 9);
  let last = -Infinity;
  for (const s of times(0, LENGTH, 0.01)) {
    expect(ring(s)).toBeGreaterThanOrEqual(last - 1e-12);
    last = ring(s);
    if (s <= 3.3) expect(ring(s)).toBeCloseTo(0, 9);
    if (s >= 3.7) expect(ring(s)).toBeCloseTo(Math.PI / 2, 9);
  }
  // The turn is a quarter turn and no more at its fastest: it takes the whole 0.4 s, no jump.
  expect(ring(3.5)).toBeGreaterThan(0.2);
  expect(ring(3.5)).toBeLessThan(Math.PI / 2 - 0.2);
});

test('the membrane flashes once, peaking inside 3.3 to 3.7 s at the most its shader draws, and rests at 1 otherwise', () => {
  const flash = (s: number) => at(s).kit!.membraneFlash;
  const samples = times(0, LENGTH, 0.01).map(s => ({ s, v: flash(s) }));
  const peak = Math.max(...samples.map(p => p.v));
  const peaks = samples.filter(p => p.v > peak - 1e-6);
  expect(peaks.length).toBe(1);
  expect(peaks[0].s).toBeGreaterThanOrEqual(3.3);
  expect(peaks[0].s).toBeLessThanOrEqual(3.7);
  // Its emissive intensity is 1 at rest and the peak is within what the membrane's shader draws (1 + flash).
  const params = VAULT_WORLD.materials!.find(m => m.node === 'membrane')!.params as { flash: number };
  expect(peak).toBeGreaterThan(1.05);
  expect(peak).toBeLessThanOrEqual(1 + params.flash + 1e-9);
  // Once: it rises to the peak and falls, never dipping back up on the way.
  const up = samples.filter(p => p.s <= peaks[0].s);
  const down = samples.filter(p => p.s >= peaks[0].s);
  up.forEach((p, i) => i > 0 && expect(p.v).toBeGreaterThanOrEqual(up[i - 1].v - 1e-12));
  down.forEach((p, i) => i > 0 && expect(p.v).toBeLessThanOrEqual(down[i - 1].v + 1e-12));
  for (const p of samples) if (p.s <= 3.3 || p.s >= 4.0) expect(p.v).toBeCloseTo(1, 9);
});

test('the yaw never decreases: a keyed side view while swimming, exactly -200 at 4.5 s, then the 200 degree turn to exactly 0 at 5.5 s', () => {
  // She swims in a right-facing side view (-280 degrees in all, as P1 has her), not with her back to the visitor.
  expect(deg(at(0).yaw)).toBeCloseTo(-280, 9);
  expect(deg(at(3).yaw)).toBeCloseTo(-280, 9);
  expect(deg(at(4.5).yaw)).toBeCloseTo(-200, 9);
  expect(at(5.5).yaw).toBe(0);
  expect(at(LENGTH).yaw).toBe(0);
  let last = -Infinity;
  let before = at(4.5).yaw;
  let rise = 0;
  for (const s of times(0, LENGTH, 0.001)) {
    const { yaw } = at(s);
    expect(yaw).toBeGreaterThanOrEqual(last);
    if (s >= 4.5) {
      rise += yaw - before;
      before = yaw;
    }
    if (s >= 5.5) expect(yaw).toBe(0);
    last = yaw;
  }
  // The shape's turn: 200 degrees between 4.5 and 5.5 s.
  expect(deg(rise)).toBeCloseTo(200, 6);
  // Slow and graceful, not Nox's quick spin: no part of it turns faster than 400 degrees a second (Nox's spin peaks near 560), and it eases in and out.
  const rate = (s: number) => deg(at(s + 0.005).yaw - at(s - 0.005).yaw) / 0.01;
  for (const s of times(4.51, 5.49, 0.01)) expect(rate(s)).toBeLessThan(400);
  expect(rate(4.55)).toBeLessThan(rate(5));
  expect(rate(5.45)).toBeLessThan(rate(5));
});

test('the sparkle shimmer runs through the settle, 5.5 to 6.5 s, from nothing to the end of its sweep, and never before', () => {
  const shimmer = (s: number) => at(s).shimmer!;
  for (const s of times(0, 5.5, 0.05)) expect(shimmer(s), `${s} s`).toBe(0);
  expect(shimmer(LENGTH)).toBe(1);
  let last = 0;
  for (const s of times(5.5, LENGTH, 0.01)) {
    expect(shimmer(s)).toBeGreaterThanOrEqual(last);
    last = shimmer(s);
  }
  // It is under way through the middle of the window: well past 0 and short of 1.
  expect(shimmer(5.8)).toBeGreaterThan(0.05);
  expect(shimmer(6.2)).toBeLessThan(0.95);
});

test('the settle: the arms swing forward and open into the intro pose, the face lands, all within 5.5 to 6.5 s, the title as she settles', () => {
  for (const s of times(0, 5.5, 0.05)) {
    const f = at(s);
    expect([f.forward, f.open, f.settle], `${s} s`).toEqual([0, 0, 0]);
    expect(f.expression).toBe('happy');
  }
  const mid = at(6);
  expect(mid.forward).toBeGreaterThan(0.5);
  expect(mid.open).toBeGreaterThan(0);
  expect(mid.open).toBeLessThan(1);
  expect(mid.expression).toBe('gentle');
  // The arms lead: forward is never behind open.
  for (const s of times(5.5, LENGTH, 0.02)) expect(at(s).forward).toBeGreaterThanOrEqual(at(s).open);
  // Her arms drawn in (the stroke's trail) through the turn: they open only in the settle.
  for (const s of times(4.5, 5.5, 0.05)) expect(armHalfSpan(at(s), VEYRA_ENTRANCE_GEOMETRY)).toBeLessThan(VEYRA_ARM_HALF_SPAN.open);
});

test("the bundle validates with the entrance's kit drives: the place's props, the sheet's own props", () => {
  expect(() => validateBundle(VEYRA_BUNDLE)).not.toThrow();
  expect(VEYRA_SEQUENCES.kitDrives).toEqual({ lockRing: 'lockRing', membraneFlash: 'membraneFlash' });
  expect(VAULT_WORLD.props).toEqual([
    { id: 'lockRing', node: 'padlock_ring', drive: 'rotateZ' },
    { id: 'membraneFlash', node: 'membrane', drive: 'emissive' },
  ]);
});
