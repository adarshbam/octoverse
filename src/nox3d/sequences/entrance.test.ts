import { beforeAll, expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { strokeAt } from '../motion/stroke';
import { SECURITY_WORLD } from '../world/security/config';
import { ENTRANCE_SECONDS, type EntranceFrame, entranceFrame, pathClearance, revealParts, spiralOffset } from './entrance';
import { ENTRANCE_SPIRAL, NOX_STROKE_SECONDS, SEQUENCE_DEFAULTS } from './keys';
import { type Sequences, loadSequences } from './theatre';

let seq: Sequences;
beforeAll(async () => {
  seq = await loadSequences();
});
const at = (s: number) => entranceFrame(seq, s);
const times = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const speed = (s: number, h = 0.005) => dist(at(s + h).position, at(s - h).position) / (2 * h);
const timing = NOX.personality.swim;

test('lasts 6.5 s and ends exactly at the intro spot facing the visitor', () => {
  expect(ENTRANCE_SECONDS).toBe(6.5);
  expect(SEQUENCE_DEFAULTS.entrance.length).toBe(ENTRANCE_SECONDS);
  const end = at(ENTRANCE_SECONDS);
  end.position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(end.yaw).toBe(0);
  expect(end.pitch).toBeCloseTo(0, 9);
  expect(end.spin).toBe(1);
  expect(end.settle).toBe(1);
  expect(end.reveal).toBe(1);
  expect(end.expression).toBe('gentle');
  // Past the end, and before the start, it holds.
  expect(at(99)).toEqual(end);
  expect(at(-3)).toEqual(at(0));
});

test('starts left of centre, deep in the corridor', () => {
  const { position, expression, yaw, pitch } = at(0);
  expect(position[0]).toBeLessThan(-0.5);
  expect(position[2]).toBeLessThan(-30);
  // Swimming toward the visitor, head first, with the determined, happy face.
  expect(yaw).toBe(0);
  expect(pitch).toBeCloseTo(0.45, 6);
  expect(expression).toBe('happy');
});

// Ruling (keys.ts): the spec's four or five strokes in 1 to 4.5 s cannot be swum at its own stroke
// timing, so the stroke runs at Nox's own rate: three whole strokes from 0.51 to 4.5 s, every
// surge between 1 and 4.5 s.
test("three whole strokes at Nox's own stroke timing, every surge between 1 and 4.5 s", () => {
  expect(NOX_STROKE_SECONDS).toBeCloseTo(timing.recovery + timing.power + timing.glide, 9);
  expect(at(0).stroke).toBe(0);
  expect(at(4.5).stroke).toBeCloseTo(3, 9);
  expect(at(ENTRANCE_SECONDS).stroke).toBeCloseTo(3, 9);
  // One stroke per 1.33 s, so each phase lasts what Nox's timing says, inside the spec's ranges.
  expect(at(3).stroke - at(2).stroke).toBeCloseTo(1 / NOX_STROKE_SECONDS, 6);
  const step = 0.001;
  const starts: number[] = [];
  const phases: Record<string, number> = { recovery: 0, power: 0, glide: 0 };
  let last = strokeAt(at(0).stroke, timing).phase;
  for (const s of times(0, ENTRANCE_SECONDS, step)) {
    const { stroke } = at(s);
    const { phase } = strokeAt(stroke, timing);
    if (phase === 'power' && last !== 'power') starts.push(s);
    if (stroke > 0 && stroke < 3) phases[phase] += step / 3;
    last = phase;
  }
  expect(starts).toHaveLength(3);
  for (const s of starts) {
    expect(s).toBeGreaterThan(1);
    expect(s).toBeLessThan(4.5);
  }
  expect(phases.recovery).toBeGreaterThanOrEqual(0.45 - 0.002);
  expect(phases.recovery).toBeLessThanOrEqual(0.6);
  expect(phases.power).toBeGreaterThanOrEqual(0.18 - 0.002);
  expect(phases.power).toBeLessThanOrEqual(0.25);
  expect(phases.glide).toBeGreaterThanOrEqual(0.4);
  expect(phases.glide).toBeLessThanOrEqual(0.8 + 0.002);
});

test('each stroke is a surge: Nox slows as the arms open and speeds up after the power stroke', () => {
  for (let k = 0; k < 3; k++) {
    const start = 4.5 - (3 - k) * NOX_STROKE_SECONDS;
    const recovery = times(start + 0.1, start + timing.recovery, 0.01).map(s => speed(s));
    const after = times(start + timing.recovery, start + timing.recovery + timing.power + 0.3, 0.01).map(s => speed(s));
    expect(Math.max(...after), `stroke ${k + 1}`).toBeGreaterThan(1.5 * Math.min(...recovery));
  }
  // Never backwards: the swim only ever comes on toward the visitor.
  let z = -Infinity;
  for (const s of times(0, 4.5, 0.005)) {
    const { position } = at(s);
    expect(position[2]).toBeGreaterThanOrEqual(z - 1e-9);
    z = position[2];
  }
});

test('one full turn between 4.5 and 5.5 s along the spiral', () => {
  const { r0 } = ENTRANCE_SPIRAL;
  const radius = (spin: number) => Math.hypot(...spiralOffset(spin, r0));
  expect(radius(0)).toBeCloseTo(r0, 12);
  expect(spiralOffset(1, r0)).toEqual([0, 0, 0]);
  let last = Infinity;
  for (const spin of times(0, 1, 0.001)) {
    expect(radius(spin)).toBeLessThan(last);
    last = radius(spin);
    expect(spiralOffset(spin, r0)[1]).toBe(0);
  }
  expect(at(4.5).spin).toBe(0);
  expect(at(5.5).spin).toBe(1);
  // The swim ends where the arc starts, and the arc ends on the spot.
  expect(dist(at(4.5).position, spiralOffset(0, r0))).toBeLessThan(1e-9);
  expect(dist(at(5.5).position, [0, 0, 0])).toBeLessThan(1e-9);
  // Facing turns once round, the way the arc curls: on the arc Nox faces along his way.
  let turned = 0;
  let yaw = at(4.5).yaw;
  for (const s of times(4.5, 5.5, 0.002)) {
    const f = at(s);
    turned += Math.atan2(Math.sin(f.yaw - yaw), Math.cos(f.yaw - yaw));
    yaw = f.yaw;
    expect(Math.cos(f.yaw - 2 * Math.PI * f.spin)).toBeCloseTo(1, 9);
  }
  // Exactly so for a pure log spiral; this one closes on the spot (the - phi^-4), so it turns in
  // toward it at the end, inside the last quarter of r0.
  for (const spin of times(0.001, 0.999, 0.001).filter(spin => radius(spin) > 0.25 * r0)) {
    const a = spiralOffset(spin - 1e-6, r0);
    const b = spiralOffset(spin + 1e-6, r0);
    const way = [b[0] - a[0], b[2] - a[2]];
    const facing = [Math.sin(2 * Math.PI * spin), Math.cos(2 * Math.PI * spin)];
    expect((facing[0] * way[0] + facing[1] * way[1]) / Math.hypot(way[0], way[1])).toBeGreaterThan(Math.cos((8 * Math.PI) / 180));
  }
  expect(turned).toBeCloseTo(2 * Math.PI, 6);
});

test('the path clears every pillar', () => {
  expect(pathClearance(at, SECURITY_WORLD.layout)).toBeGreaterThan(0.1);
});

test('murk first: reveal is 0 at the start', () => {
  expect(at(0).reveal).toBe(0);
  expect(at(0.5).reveal).toBeGreaterThan(0);
  expect(at(0.5).reveal).toBeLessThan(1);
  expect(at(1).reveal).toBe(1);
});

test('leans head first while swimming, upright by the end of the spin; the face lands on gentle as he settles', () => {
  for (const s of [0, 2, 4.5]) expect(at(s).pitch).toBeCloseTo(0.45, 6);
  expect(at(5.5).pitch).toBeCloseTo(0, 9);
  expect(at(5.4).expression).toBe('happy');
  expect(at(5.6).expression).toBe('gentle');
});

test('no jumps: the body moves smoothly all the way', () => {
  let prev: EntranceFrame = at(0);
  for (const s of times(0.001, ENTRANCE_SECONDS, 0.001)) {
    const f = at(s);
    expect(dist(f.position, prev.position)).toBeLessThan(0.03);
    prev = f;
  }
});

test('out of the murk: the glow and aura first, then the shape', () => {
  expect(revealParts(0)).toEqual({ glow: 0, shape: 0 });
  expect(revealParts(1)).toEqual({ glow: 1, shape: 1 });
  // Early on the glow is well in while the shape has not begun.
  expect(revealParts(0.3).glow).toBeGreaterThanOrEqual(0.5);
  expect(revealParts(0.3).shape).toBe(0);
  for (let r = 0; r <= 1; r += 0.05) expect(revealParts(r).glow).toBeGreaterThanOrEqual(revealParts(r).shape);
  // The sheet reveals him over the first second.
  expect(at(0).reveal).toBe(0);
  expect(at(1).reveal).toBe(1);
});
