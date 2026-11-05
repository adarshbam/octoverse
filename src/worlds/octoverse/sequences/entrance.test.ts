import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { initialStage, stageReducer } from '../../../engine/behavior/stageMachine';
import { entranceSeenKey } from '../../../engine/behavior/useStage';
import { CAMERA_Z } from '../../../engine/config/stage';
import { strokeAt, strokeTiming } from '../../../engine/motion/stroke';
import { type EntranceFrame, armHalfSpan, entranceClearance, entranceFrame } from '../../../engine/sequences/entrance';
import { loadWorldSequences, type Sequences } from '../../../engine/sequences/theatre';
import { validateBundle } from '../../../engine/types/bundle';
import { HOST_BUNDLE, HOST_SEQUENCES } from '../bundle';
import { HOST } from '../character';
import { REEF_WORLD } from '../place/config';
import { HOST_POSES } from '../poses';
import { HOST_SWIM } from '../swim';
import { HOST_ARM_HALF_SPAN, HOST_ENTRANCE_FOOTPRINTS, HOST_ENTRANCE_GEOMETRY } from './clearance';
import { ENTRANCE_BEATS as B, GLYPH_PEAK, HOST_ENTRANCE, HOST_SEQUENCE_DEFAULTS, MEMBRANE_PEAK } from './defaults';

// The host's entrance (platform spec 7.6): its glow appears out of the haze on the left (0 to 1 s),
// two long strokes and glides toward the portal on the right, in profile (1 to 3.4 s); at about 3 s the
// portal's octopus glyph brightens and the membrane ripples once (the gate greets its keeper); a
// graceful turn of about 200 degrees to face the visitor, gliding to the stage spot (3.4 to 4.4 s);
// the settle into the intro pose (4.4 to 5.4 s), then the arrival wave (the arrival sheet, Task 11).

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(HOST_SEQUENCES);
});
const at = (s: number): EntranceFrame => entranceFrame(seq, s, HOST_ENTRANCE_GEOMETRY);
const times = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const deg = (r: number) => (r * 180) / Math.PI;
const LENGTH = 5.4;
/** Where a world point lands on the stage plane (z = 0) as the unmoved stage camera sees it: P1's frame is that plane. */
const onPlane = ([x, y, z]: readonly number[]) => [(x * CAMERA_Z) / (CAMERA_Z - z), (y * CAMERA_Z) / (CAMERA_Z - z)] as const;

test('the key is octoverse.octoverse.entranceSeen; the sheet is 5.4 s, a 200 degree glide-turn with no spiral', () => {
  expect(entranceSeenKey(HOST_BUNDLE.id)).toBe('octoverse.octoverse.entranceSeen');
  expect(seq.length('entrance')).toBe(LENGTH);
  expect(HOST_SEQUENCE_DEFAULTS.entrance.length).toBe(LENGTH);
  expect(HOST_ENTRANCE).toEqual({ turn: (200 * Math.PI) / 180, spiral: false });
  expect(HOST_SEQUENCES.entrance).toBe(HOST_ENTRANCE);
});

test('with reduced motion (or the entrance seen this session) the stage opens on the intro; a skip lands there too', () => {
  expect(initialStage({ entranceSeen: false, reducedMotion: true }).stage).toBe('intro');
  expect(initialStage({ entranceSeen: true, reducedMotion: false }).stage).toBe('intro');
  const entering = initialStage({ entranceSeen: false, reducedMotion: false });
  expect(entering.stage).toBe('entering');
  expect(stageReducer(entering, { type: 'SKIP' }, new Set()).stage).toBe('intro');
  // The end frame (written on a skip as on the finish) is the intro's place, upright, facing the visitor, the gate at rest.
  const end = at(LENGTH);
  end.position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(end.yaw).toBe(0);
  expect(end.pitch).toBeCloseTo(0, 9);
  expect([end.spin, end.forward, end.open, end.settle, end.reveal]).toEqual([1, 1, 1, 1, 1]);
  expect(end.kit).toEqual({ glyph: 1, membraneRipple: 1 });
  expect(HOST_POSES.intro.body).toMatchObject({ x: 0, y: 0, yaw: 0 });
  expect(at(99)).toEqual(end);
});

test('the stroke it swims is strokeTiming(personality) (0.58 / 0.24 / 0.8), and its reach is measured off its own poses', () => {
  expect(HOST_ENTRANCE_GEOMETRY.swim).toEqual(strokeTiming(HOST.personality));
  // The widest the arms ever open: the swim's open umbrella (wider than the intro's welcome) and the intro itself.
  const widest = (arms: Record<string, readonly (readonly number[])[]>) => Math.max(...Object.values(arms).flatMap(pts => pts.map(([x]) => Math.abs(x))));
  expect(HOST_ARM_HALF_SPAN.open).toBeGreaterThanOrEqual(widest(HOST_SWIM.open.arms));
  expect(HOST_ARM_HALF_SPAN.open).toBeGreaterThanOrEqual(widest(HOST_POSES.intro.arms));
  expect(HOST_ARM_HALF_SPAN.intro).toBeGreaterThanOrEqual(widest(HOST_POSES.intro.arms));
  // Drawn in: the trail bundle's width, and never inside the head.
  expect(HOST_ARM_HALF_SPAN.closed).toBeGreaterThanOrEqual(widest(HOST_SWIM.trail.arms));
  expect(HOST_ARM_HALF_SPAN.closed).toBeGreaterThan(HOST.head.halfWidth + 0.4);
});

test("the footprints cover the reef kit's gate and rocks as built (kit.nodes.json bounds), every one the layout places", () => {
  const nodes = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'public', 'octoverse', 'world', 'reef', 'kit.nodes.json'), 'utf8')) as {
    info: Record<string, { bounds: { min: number[]; max: number[] } }>;
  };
  for (const [piece, f] of Object.entries(HOST_ENTRANCE_FOOTPRINTS)) {
    const { min, max } = nodes.info[piece].bounds;
    expect(f.x, piece).toBeGreaterThanOrEqual(Math.max(-min[0], max[0]));
    expect(f.z, piece).toBeGreaterThanOrEqual(Math.max(-min[2], max[2]));
  }
  const layout = REEF_WORLD.layout;
  const counted = [...(layout.groups.gate ?? []), ...(layout.groups.rocks ?? [])].map(p => p.piece);
  for (const piece of counted) expect(HOST_ENTRANCE_FOOTPRINTS[piece], piece).toBeDefined();
});

// The path keeps clear of the gateway and the rocks of the reef's layout (every one, as a box on the
// floor plane however low it is) until it reaches the stage spot at the turn's end; from there it
// settles into the intro, the arms opening where the intro pose has them. A gap of 0.3 is about the
// width of one of its arms. The arms open wide only as a stroke's recovery opens them, so the strokes
// are placed in the open water: the frame's reach (umbrella open at each recovery) clears too.
test('the path clears layout.json with the arms closed and as drawn by 0.3, and held open as wide as the intro the whole way', () => {
  const layout = REEF_WORLD.layout;
  expect(HOST_BUNDLE.place.layout).toBe(layout);
  const gaps = entranceClearance(seq, HOST_ENTRANCE_GEOMETRY, layout, HOST_ENTRANCE_FOOTPRINTS, { samples: 651, until: B.turnEnd });
  expect(gaps.closed.gap, `closed: ${gaps.closed.piece} at ${gaps.closed.seconds} s`).toBeGreaterThan(0.3);
  expect(gaps.frame.gap, `frame: ${gaps.frame.piece} at ${gaps.frame.seconds} s`).toBeGreaterThan(0.3);
  // Held open as wide as the intro's welcome (the settle's arms) the whole swim, to the turn: clear by 0.2.
  const intro = { ...HOST_ENTRANCE_GEOMETRY, armHalfSpan: { open: HOST_ARM_HALF_SPAN.intro, closed: HOST_ARM_HALF_SPAN.closed } };
  const held = entranceClearance(seq, intro, layout, HOST_ENTRANCE_FOOTPRINTS, { samples: 651, until: B.turnStart });
  expect(held.open.gap, `open: ${held.open.piece} at ${held.open.seconds} s`).toBeGreaterThan(0.2);
  // Recorded, not hidden (two limits of the reef's layout, Task 4, not of the path):
  // - the umbrella held open (3.0 either side) the whole swim does not fit between the left rocks (the
  //   open water there is narrower than 6 units plus the stone): it overlaps the back-left rock's floor
  //   box by under 0.35. Its arms open that wide only at a recovery, which the frame's check clears.
  // - at the stage spot itself the intro's arms (2.45) reach 0.2 over the low front-right rock's floor
  //   box (rock_b, 2.25 away on the floor plane, its top 1.4 below the host's centre): the intro pose's place.
  const swim = entranceClearance(seq, HOST_ENTRANCE_GEOMETRY, layout, HOST_ENTRANCE_FOOTPRINTS, { samples: 651, until: B.turnStart });
  expect(swim.open.gap).toBeGreaterThan(-0.35);
  expect(gaps.open.piece).toBe('rocks[3] rock_b');
  expect(gaps.open.seconds).toBeCloseTo(B.turnEnd, 6);
  expect(gaps.open.gap + HOST_ARM_HALF_SPAN.open - HOST_ARM_HALF_SPAN.intro).toBeGreaterThan(-0.25);
}, 30000);

test('two strokes: each power stroke (the surge) starts between 1 and 3.4 s, and the clock is still after', () => {
  const timing = HOST_ENTRANCE_GEOMETRY.swim;
  const surges: number[] = [];
  let last = strokeAt(at(0).stroke, timing).phase;
  for (const s of times(0, LENGTH, 0.001)) {
    const { phase } = strokeAt(at(s).stroke, timing);
    if (phase === 'power' && last !== 'power') surges.push(s);
    last = phase;
  }
  expect(surges.length).toBe(2);
  for (const s of surges) {
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThan(3.4);
    // The whole power stroke is inside the window.
    expect(strokeAt(at(s + 0.15).stroke, timing).phase).toBe('power');
  }
  expect(at(B.strokeEnd).stroke).toBeCloseTo(2, 9);
  for (const s of times(B.strokeEnd, LENGTH, 0.1)) expect(at(s).stroke).toBeCloseTo(2, 9);
  // Long glides: never faster than 7 stage units a second (Veyra's bound; the surges are the fastest).
  for (const s of times(0.05, B.turnEnd, 0.05)) {
    const h = 0.005;
    const a = at(s - h).position;
    const b = at(s + h).position;
    expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * h), `${s} s`).toBeLessThan(7);
  }
}, 30000);

test('the glow first: out of the haze on the left from 0 to 1 s, and in view (the stage plane) by then', () => {
  expect(at(0).reveal).toBe(0);
  expect(at(1).reveal).toBe(1);
  expect(at(0.5).reveal).toBeGreaterThan(0);
  expect(at(0.5).reveal).toBeLessThan(1);
  expect(at(0).position[0]).toBeLessThan(-5);
  expect(at(0).position[2]).toBeLessThan(-4);
  // Swims right, toward the portal: x rises the whole swim.
  for (const s of times(0.1, B.strokeEnd, 0.1)) expect(at(s).position[0]).toBeGreaterThan(at(s - 0.1).position[0]);
});

test("in profile facing right at about 3 s, its head where P1 paints it (x -0.36, y -0.36 +- 0.08 in P1's frame), the arms trailing", () => {
  const f = at(3);
  // Facing (sin yaw, 0, cos yaw): right (+x), a little toward the camera, as P1.
  expect(Math.sin(f.yaw)).toBeGreaterThan(0.95);
  expect(Math.cos(f.yaw)).toBeGreaterThan(0);
  // The head's middle, between its top and its bottom, below the body's centre.
  const head = onPlane([f.position[0], f.position[1] + (HOST.head.top + HOST.head.bottom) / 2, f.position[2]]);
  expect(Math.abs(head[0] + 0.36)).toBeLessThanOrEqual(0.08);
  expect(Math.abs(head[1] + 0.36)).toBeLessThanOrEqual(0.08);
  // The arms in the trail (a glide after the second power stroke), nowhere near open.
  expect(strokeAt(f.stroke, HOST_ENTRANCE_GEOMETRY.swim).phase).toBe('glide');
  expect(armHalfSpan(f, HOST_ENTRANCE_GEOMETRY)).toBeLessThan(HOST_ARM_HALF_SPAN.closed + 0.2 * (HOST_ARM_HALF_SPAN.open - HOST_ARM_HALF_SPAN.closed));
  expect([f.forward, f.open, f.settle]).toEqual([0, 0, 0]);
});

/** The moment a kit value peaks, and how many separate peaks reach within 1e-6 of it. */
function peakOf(read: (s: number) => number) {
  const samples = times(0, LENGTH, 0.005).map(s => ({ s, v: read(s) }));
  const top = Math.max(...samples.map(p => p.v));
  const tops = samples.filter(p => p.v > top - 1e-6);
  const runs = tops.filter((p, i) => i === 0 || p.s - tops[i - 1].s > 0.006).length;
  return { top, s: tops[0].s, runs, samples };
}

test('the glyph brightens once, peaking between 2.8 and 3.2 s, and the membrane ripples once just after; both at rest (1) otherwise', () => {
  for (const [name, peakValue, from, to] of [['glyph', GLYPH_PEAK, 2.8, 3.2], ['membraneRipple', MEMBRANE_PEAK, 2.8, 3.4]] as const) {
    const p = peakOf(s => at(s).kit![name]);
    expect(p.runs, name).toBe(1);
    expect(p.s, name).toBeGreaterThanOrEqual(from);
    expect(p.s, name).toBeLessThanOrEqual(to);
    expect(p.top, name).toBeCloseTo(peakValue, 9);
    // Rises to the peak and falls, never back up on the way.
    const up = p.samples.filter(q => q.s <= p.s);
    const down = p.samples.filter(q => q.s >= p.s);
    up.forEach((q, i) => i > 0 && expect(q.v, `${name} ${q.s}`).toBeGreaterThanOrEqual(up[i - 1].v - 1e-12));
    down.forEach((q, i) => i > 0 && expect(q.v, `${name} ${q.s}`).toBeLessThanOrEqual(down[i - 1].v + 1e-12));
    for (const q of p.samples) if (q.s <= 2.5 || q.s >= 3.9) expect(q.v, `${name} ${q.s}`).toBeCloseTo(1, 9);
  }
  expect(GLYPH_PEAK).toBeGreaterThan(1.5);
  // The membrane's flash is its shader's: never above 1 + its `flash`, the most it draws.
  const params = REEF_WORLD.materials!.find(m => m.node === 'gate_membrane')!.params as { flash: number };
  expect(MEMBRANE_PEAK).toBeLessThanOrEqual(1 + params.flash + 1e-9);
  expect(MEMBRANE_PEAK).toBeGreaterThan(1.05);
});

test('the yaw never decreases: profile facing right while swimming, -200 at 3.4 s, the 200 degree turn to exactly 0 by 4.4 s', () => {
  expect(deg(at(0).yaw)).toBeCloseTo(-280, 6);
  expect(deg(at(3).yaw)).toBeCloseTo(-280, 6);
  expect(deg(at(B.turnStart).yaw)).toBeCloseTo(-200, 6);
  expect(at(B.turnEnd).yaw).toBe(0);
  let last = -Infinity;
  for (const s of times(0, LENGTH, 0.001)) {
    const { yaw } = at(s);
    expect(yaw, `${s} s`).toBeGreaterThanOrEqual(last);
    last = yaw;
  }
  const turn = deg(at(4.4).yaw - at(3.4).yaw);
  expect(Math.abs(turn - 200)).toBeLessThanOrEqual(5);
  // Graceful: eases in and out, never faster than 400 degrees a second.
  const rate = (s: number) => deg(at(s + 0.005).yaw - at(s - 0.005).yaw) / 0.01;
  for (const s of times(3.41, 4.39, 0.01)) expect(rate(s)).toBeLessThan(400);
  expect(rate(3.45)).toBeLessThan(rate(3.9));
  expect(rate(4.35)).toBeLessThan(rate(3.9));
  // It reaches the stage spot as the turn ends, upright.
  at(B.turnEnd).position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(at(B.turnEnd).pitch).toBeCloseTo(0, 9);
});

test('the settle: the arms swing forward and open into the intro pose, the face lands, all from 4.4 s and done by 5.4 s', () => {
  for (const s of times(0, B.turnEnd, 0.05)) {
    const f = at(s);
    expect([f.forward, f.open, f.settle], `${s} s`).toEqual([0, 0, 0]);
  }
  for (const s of times(B.turnEnd, LENGTH, 0.02)) expect(at(s).forward).toBeGreaterThanOrEqual(at(s).open);
  const mid = at(4.9);
  expect(mid.open).toBeGreaterThan(0);
  expect(mid.open).toBeLessThan(1);
  expect(mid.settle).toBeGreaterThan(0);
  expect(B.settleEnd).toBeLessThanOrEqual(5.4);
  expect(at(B.settleEnd).settle).toBe(1);
  expect(at(B.settleEnd).open).toBe(1);
  // The arms stay drawn in through the turn.
  for (const s of times(B.turnStart, B.turnEnd, 0.05)) expect(armHalfSpan(at(s), HOST_ENTRANCE_GEOMETRY)).toBeLessThan(HOST_ARM_HALF_SPAN.closed + 1e-9);
});

test("the bundle validates with the entrance's kit drives: the glyph and the membrane on 'emissive', the cards still on 'bob'", () => {
  expect(() => validateBundle(HOST_BUNDLE)).not.toThrow();
  expect(HOST_SEQUENCES.kitDrives).toEqual({ glyph: 'glyph', membraneRipple: 'membraneRipple' });
  const props = REEF_WORLD.props!;
  expect(props.filter(p => p.drive === 'emissive')).toEqual([
    { id: 'glyph', node: 'gate_glyph', drive: 'emissive' },
    { id: 'membraneRipple', node: 'gate_membrane', drive: 'emissive' },
  ]);
  expect(props.filter(p => p.drive === 'bob').length).toBe(8);
  // The saved state holds the authored entrance (seeded from defaults.ts).
  expect(HOST_SEQUENCE_DEFAULTS.entrance.objects.main.keys.glyph).toBeDefined();
});
