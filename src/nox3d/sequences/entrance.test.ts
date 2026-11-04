import { beforeAll, expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { ArmChain } from '../../engine/character/armChain';
import { ARM_IDS } from '../../engine/config/types';
import { strokeAt } from '../../engine/motion/stroke';
import { createSwimRests, swimShapes as shapesFor } from '../../engine/motion/swimArms';
import { NOX_POSES } from '../poses/nox.poses';
import { SWIM_POSES } from '../poses/nox.swim';
import { SECURITY_WORLD } from '../world/security/config';
import { ARM_HALF_SPAN, ENTRANCE_SECONDS, type EntranceFrame, armHalfSpan, entranceDrive, entranceFrame, entranceRests, pathClearance, revealParts, spiralOffset } from './entrance';
import { ENTRANCE_FORWARD, ENTRANCE_HOLD, ENTRANCE_OPEN, ENTRANCE_SPREAD_FROM, ENTRANCE_SPIRAL, NOX_STROKE_SECONDS, SEQUENCE_DEFAULTS } from './defaults';
import { NOX_ENTRANCE_GEOMETRY } from '../bundle.nox';
import { loadNoxSequences } from './nox.sequences';
import type { Sequences } from './theatre';

/** Nox's swim shapes at `segments`. */
const swimShapes = (segments: number) => shapesFor(SWIM_POSES, NOX_POSES.intro, segments);

let seq: Sequences;
beforeAll(async () => {
  seq = await loadNoxSequences();
});
const at = (s: number) => entranceFrame(seq, s, NOX_ENTRANCE_GEOMETRY);
const times = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const speed = (s: number, h = 0.005) => dist(at(s + h).position, at(s - h).position) / (2 * h);
const timing = NOX.personality.swim;

test('lasts 8.4 s and ends exactly at the intro spot facing the visitor', () => {
  expect(ENTRANCE_SECONDS).toBe(8.4);
  expect(SEQUENCE_DEFAULTS.entrance.length).toBe(ENTRANCE_SECONDS);
  const end = at(ENTRANCE_SECONDS);
  end.position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(end.yaw).toBe(0);
  expect(end.pitch).toBeCloseTo(0, 9);
  expect(end.spin).toBe(1);
  expect(end.open).toBe(1);
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

// Ruling (defaults.ts): the spec's four or five strokes in 1 to 4.5 s cannot be swum at its own stroke
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
}, 30_000);

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

test('one full turn between 6.4 and 7.4 s along the spiral', () => {
  const { r0 } = ENTRANCE_SPIRAL;
  const radius = (spin: number) => Math.hypot(...spiralOffset(spin, ENTRANCE_SPIRAL));
  expect(radius(0)).toBeCloseTo(r0, 12);
  expect(spiralOffset(1, ENTRANCE_SPIRAL)).toEqual([0, 0, 0]);
  let last = Infinity;
  for (const spin of times(0, 1, 0.001)) {
    expect(radius(spin)).toBeLessThan(last);
    last = radius(spin);
    expect(spiralOffset(spin, ENTRANCE_SPIRAL)[1]).toBe(0);
  }
  expect(at(6.4).spin).toBe(0);
  expect(at(7.4).spin).toBe(1);
  // The swim ends where the arc starts, and the arc ends on the spot.
  expect(dist(at(6.4).position, spiralOffset(0, ENTRANCE_SPIRAL))).toBeLessThan(1e-9);
  expect(dist(at(7.4).position, [0, 0, 0])).toBeLessThan(1e-9);
  // Facing turns once round, the way the arc curls: on the arc Nox faces along his way.
  let turned = 0;
  let yaw = at(6.4).yaw;
  for (const s of times(6.4, 7.4, 0.002)) {
    const f = at(s);
    turned += Math.atan2(Math.sin(f.yaw - yaw), Math.cos(f.yaw - yaw));
    yaw = f.yaw;
    expect(Math.cos(f.yaw - 2 * Math.PI * f.spin)).toBeCloseTo(1, 9);
  }
  // Exactly so for a pure log spiral; this one closes on the spot (the - phi^-4), so it turns in
  // toward it at the end, inside the last quarter of r0.
  for (const spin of times(0.001, 0.999, 0.001).filter(spin => radius(spin) > 0.25 * r0)) {
    const a = spiralOffset(spin - 1e-6, ENTRANCE_SPIRAL);
    const b = spiralOffset(spin + 1e-6, ENTRANCE_SPIRAL);
    const way = [b[0] - a[0], b[2] - a[2]];
    const facing = [Math.sin(2 * Math.PI * spin), Math.cos(2 * Math.PI * spin)];
    expect((facing[0] * way[0] + facing[1] * way[1]) / Math.hypot(way[0], way[1])).toBeGreaterThan(Math.cos((8 * Math.PI) / 180));
  }
  expect(turned).toBeCloseTo(2 * Math.PI, 6);
});

// Owner request (Task 19b): the last stroke plays out (power and glide), Nox holds a second, then
// the arms open and the spin starts. The stroke clock reaches 3 when the last glide ends.
test('a second of hold between the end of the last stroke and the opening of the arms', () => {
  const strokeEnd = times(0, ENTRANCE_SECONDS, 0.001).find(s => at(s).stroke >= 3 - 1e-9) as number;
  const spinStart = times(0, ENTRANCE_SECONDS, 0.001).find(s => at(s).spin > 0) as number;
  expect(strokeEnd).toBeCloseTo(4.5, 2);
  expect(ENTRANCE_HOLD).toBeGreaterThanOrEqual(1);
  expect(spinStart - strokeEnd).toBeGreaterThanOrEqual(ENTRANCE_HOLD + ENTRANCE_OPEN - 0.002);
  // The glide has played to its end by then, and nothing else moves in the hold: still, lean
  // held, face unchanged, arms in the trail. After it only the arms and the lean move, in place.
  expect(strokeAt(at(strokeEnd - 0.001).stroke, timing).phase).toBe('glide');
  for (const s of times(strokeEnd, spinStart, 0.01)) {
    const f = at(s);
    expect(f.stroke).toBeCloseTo(3, 9);
    expect(f.yaw).toBe(0);
    expect(f.settle).toBe(0);
    if (s < strokeEnd + ENTRANCE_HOLD - 0.002) {
      expect(f.pitch).toBeCloseTo(0.45, 9);
      expect(f.forward).toBe(0);
      expect(f.open).toBe(0);
    }
    expect(dist(f.position, at(strokeEnd).position)).toBeLessThan(1e-9);
  }
}, 30_000);

// Owner request (live review): the spin waits for the arms. After the hold they come forward out of
// the trail as he rights himself, then spread to the intro pose's full reach, and only then does he
// turn, fully open all the way round. Checked on what the stage draws: the arm rests and the arm
// drive Octopus makes from the frame (entranceRests, entranceDrive).
test('the arms open fully after the hold, before the spin, and stay fully open through it', () => {
  const rests = swimShapes(ArmChain.SEGMENTS).rest;
  const spinStart = 4.5 + ENTRANCE_HOLD + ENTRANCE_OPEN;
  const spinEnd = spinStart + 1;
  expect(at(spinStart).spin).toBe(0);
  expect(at(spinStart + 0.001).spin).toBeGreaterThan(0);
  expect(at(spinEnd).spin).toBe(1);
  // In the hold, and right up to the opening, the arms trail as the last stroke left them.
  for (const s of [4.5, 5, 4.5 + ENTRANCE_HOLD - 0.001]) {
    expect(at(s).forward, `${s} s`).toBe(0);
    expect(at(s).open, `${s} s`).toBe(0);
    expect(armHalfSpan(at(s), NOX_ENTRANCE_GEOMETRY), `${s} s`).toBeLessThan(ARM_HALF_SPAN.open - 0.5);
  }
  // They come forward first: they spread only once the swing back has mostly gone, and they are
  // forward and upright before they are fully spread.
  const openStart = 4.5 + ENTRANCE_HOLD;
  for (const s of times(openStart, spinStart, 0.01)) expect(at(s).forward, `${s} s`).toBeGreaterThanOrEqual(at(s).open);
  expect(at(openStart + ENTRANCE_SPREAD_FROM).open).toBe(0);
  expect(at(openStart + ENTRANCE_FORWARD).forward).toBe(1);
  expect(at(openStart + ENTRANCE_FORWARD).pitch).toBeCloseTo(0, 9);
  expect(at(openStart + ENTRANCE_FORWARD).open).toBeLessThan(0.8);
  // Mid-opening they are on their way, not yet there.
  const half = at(openStart + ENTRANCE_OPEN / 2).open;
  expect(half).toBeGreaterThan(0.1);
  expect(half).toBeLessThan(0.8);
  for (const s of [spinStart, ...times(spinStart + 0.001, spinEnd, 0.005)]) {
    const f = at(s);
    expect(f.open, `${s} s`).toBe(1);
    expect(Math.abs(armHalfSpan(f, NOX_ENTRANCE_GEOMETRY) - ARM_HALF_SPAN.open), `${s} s`).toBeLessThan(1e-9);
    const stroke = strokeAt(f.stroke, timing);
    const drawn = entranceRests(f, stroke, swimShapes(ArmChain.SEGMENTS), createSwimRests(ArmChain.SEGMENTS));
    for (const id of ARM_IDS) expect(Array.from(drawn[id].angles), `${id} at ${s} s`).toEqual(Array.from(rests[id].angles));
    // No swing back left either: the arms stand out as the intro pose has them.
    expect(entranceDrive(f, stroke).pitch, `${s} s`).toBe(0);
    expect(f.pitch, `${s} s`).toBeCloseTo(0, 9);
  }
  // The rest of the settle comes after the spin, as before: the face and the intro's words.
  expect(at(spinEnd).settle).toBe(0);
  expect(at(spinEnd).expression).toBe('happy');
  expect(at(spinEnd + 0.1).settle).toBeGreaterThan(0);
});

// The swim and the hold, arms closed but for the strokes. From the opening on the real arms are
// checked against the pillars instead (armClearance.test.ts): the circle of reach cannot see that
// the open intro pose is flat, side to side, and would count it reaching back into the near left
// pillar as far as it reaches sideways.
test('the swim clears every pillar', () => {
  expect(pathClearance(at, SECURITY_WORLD.layout, NOX_ENTRANCE_GEOMETRY, 651, 4.5 + ENTRANCE_HOLD)).toBeGreaterThan(0.1);
});

test('murk first: reveal is 0 at the start', () => {
  expect(at(0).reveal).toBe(0);
  expect(at(0.5).reveal).toBeGreaterThan(0);
  expect(at(0.5).reveal).toBeLessThan(1);
  expect(at(1).reveal).toBe(1);
});

test('leans head first while swimming and in the hold, upright as the arms open; the face lands on gentle as he settles', () => {
  for (const s of [0, 2, 4.5, 5.5]) expect(at(s).pitch).toBeCloseTo(0.45, 6);
  for (const s of [6.0, 6.4, 6.9, 7.4]) expect(at(s).pitch).toBeCloseTo(0, 9);
  expect(at(7.3).expression).toBe('happy');
  expect(at(7.5).expression).toBe('gentle');
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

// Fixtures hard-coded from the implementation before the entrance took its stroke timing and turn
// as data (Task 5): Nox's frames must not move by a bit.
const NOX_FRAMES: Record<number, Pick<EntranceFrame, 'position' | 'yaw' | 'pitch' | 'stroke' | 'spin' | 'forward' | 'open' | 'settle' | 'reveal' | 'expression'>> = {
  0: { position: [-1, 1.3, -34], yaw: 0, pitch: 0.45, stroke: 0, spin: 0, forward: 0, open: 0, settle: 0, reveal: 0, expression: 'happy' },
  2: { position: [-0.39899962943466727, 0.6302685719771122, -10.080096640597288], yaw: 0, pitch: 0.45, stroke: 1.1203007518796992, spin: 0, forward: 0, open: 0, settle: 0, reveal: 1, expression: 'happy' },
  4: { position: [-0.7733164847853181, 0.036884449382877604, -0.5777967102000803], yaw: 0, pitch: 0.45, stroke: 2.6240601503759398, spin: 0, forward: 0, open: 0, settle: 0, reveal: 1, expression: 'happy' },
  5: { position: [-0.8471545771301882, 0, -0.30385707569081233], yaw: 0, pitch: 0.45, stroke: 3, spin: 0, forward: 0, open: 0, settle: 0, reveal: 1, expression: 'happy' },
  5.5: { position: [-0.8471545771301882, 0, -0.30385707569081233], yaw: 0, pitch: 0.45, stroke: 3, spin: 0, forward: 0, open: 0, settle: 0, reveal: 1, expression: 'happy' },
  6.5: { position: [-0.843142256351925, 0, -0.21755048929299703], yaw: 0.09187040040147344, pitch: 0, stroke: 3, spin: 0.014621628347726144, forward: 1, open: 1, settle: 0, reveal: 1, expression: 'happy' },
  7: { position: [0.08178893750396721, 0, -0.09434244540051717], yaw: -1.9406550764402604, pitch: 0, stroke: 3, spin: 0.6911351517481525, forward: 1, open: 1, settle: 0, reveal: 1, expression: 'happy' },
};

test('Nox\'s entrance frames equal the ones the fixed-Nox implementation gave', () => {
  for (const [s, want] of Object.entries(NOX_FRAMES)) {
    const got = at(Number(s));
    expect(got.position, `${s} s position`).toEqual(want.position.map(v => expect.closeTo(v, 12)));
    for (const key of ['yaw', 'pitch', 'stroke', 'spin', 'forward', 'open', 'settle', 'reveal'] as const) expect(got[key], `${s} s ${key}`).toBeCloseTo(want[key], 12);
    expect(got.expression, `${s} s`).toBe(want.expression);
  }
  // The end is the intro spot, facing the visitor.
  expect(at(ENTRANCE_SECONDS).position).toEqual([0, 0, 0]);
  expect(at(ENTRANCE_SECONDS).yaw).toBe(0);
});

test('the stroke timing comes in as an argument: another timing carries the swimmer a different distance ahead', () => {
  const slower = { swim: { ...timing, glide: timing.glide * 2 } };
  // Mid-surge (2 s): the lead along the keyed path differs; the sheet's own stroke clock does not.
  const mine = entranceFrame(seq, 2, NOX_ENTRANCE_GEOMETRY);
  const other = entranceFrame(seq, 2, slower);
  expect(other.stroke).toBe(mine.stroke);
  expect(dist(other.position, mine.position)).toBeGreaterThan(1e-3);
  // At a whole stroke the lead is zero for any timing: both stand on the keyed path.
  expect(dist(entranceFrame(seq, 5, slower).position, entranceFrame(seq, 5, NOX_ENTRANCE_GEOMETRY).position)).toBeLessThan(1e-9);
});

test('the clearance check takes the arm reach and pillar footprint as arguments', () => {
  const swim = (s: number) => entranceFrame(seq, s, NOX_ENTRANCE_GEOMETRY);
  const base = pathClearance(swim, SECURITY_WORLD.layout, NOX_ENTRANCE_GEOMETRY, 101, 4.5 + ENTRANCE_HOLD);
  const wider = pathClearance(swim, SECURITY_WORLD.layout, { ...NOX_ENTRANCE_GEOMETRY, armHalfSpan: { open: 3.15, closed: 2.2 } }, 101, 4.5 + ENTRANCE_HOLD);
  expect(wider).toBeCloseTo(base - 1, 9);
  const fatter = pathClearance(swim, SECURITY_WORLD.layout, { ...NOX_ENTRANCE_GEOMETRY, pillarHalf: { x: 1.55, z: 1.5 } }, 101, 4.5 + ENTRANCE_HOLD);
  expect(fatter).toBeLessThan(base);
});

test('the entrance turn is data: a half turn has half the yaw all the way round', () => {
  const half: Sequences = { ...seq, entrance: { ...seq.entrance, turn: Math.PI } };
  for (const s of [6.6, 6.9, 7.1, 7.3]) {
    const full = entranceFrame(seq, s, NOX_ENTRANCE_GEOMETRY).yaw;
    expect(full, `${s} s`).not.toBe(0);
    expect(entranceFrame(half, s, NOX_ENTRANCE_GEOMETRY).yaw, `${s} s`).toBeCloseTo(full / 2, 12);
  }
  // It still ends on the spot, facing the visitor, and starts where the swim ends.
  expect(entranceFrame(half, ENTRANCE_SECONDS, NOX_ENTRANCE_GEOMETRY).position).toEqual([0, 0, 0]);
  expect(entranceFrame(half, ENTRANCE_SECONDS, NOX_ENTRANCE_GEOMETRY).yaw).toBe(0);
  expect(entranceFrame(half, 6.4, NOX_ENTRANCE_GEOMETRY).position).toEqual(entranceFrame(seq, 6.4, NOX_ENTRANCE_GEOMETRY).position);
});
