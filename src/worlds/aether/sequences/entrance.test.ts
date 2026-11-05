import { beforeAll, expect, test } from 'vitest';
import { ringShown } from '../../../engine/artifacts/satellite';
import { entranceSeenKey } from '../../../engine/behavior/useStage';
import { initialStage, stageReducer } from '../../../engine/behavior/stageMachine';
import { strokeAt, strokeTiming } from '../../../engine/motion/stroke';
import { type EntranceFrame, armHalfSpan, entranceClearance, entranceFrame } from '../../../engine/sequences/entrance';
import { loadWorldSequences, type Sequences } from '../../../engine/sequences/theatre';
import { validateBundle } from '../../../engine/types/bundle';
import { AETHER_BUNDLE } from '../bundle';
import { AETHER } from '../character';
import { OBSERVATORY_WORLD, PORTAL_FLASH, WORLD_MATERIALS } from '../place/config';
import { AETHER_POSES } from '../poses';
import { AETHER_ARM_HALF_SPAN, AETHER_ENTRANCE_FOOTPRINTS, AETHER_ENTRANCE_GEOMETRY } from './clearance';
import { ENTRANCE_BEATS as B, ENTRANCE_TILT, GLYPH_FIRE_PEAK, SEQUENCE_DEFAULTS } from './defaults';
import { AETHER_SEQUENCES } from './index';

// Aether's entrance (spec 7.9): out of the haze on the left (0 to 1 s), two soft strokes along the
// path toward the portal (1 to 4.2 s), the brain glyph firing as she passes its left side (~3.2 s)
// and her look back at it (3.0 to 3.8 s), the curve away and the quarter turn with a 12 degree head
// tilt (4.2 to 5.3 s), the settle: arms open, then she looks at you, blinks, and smiles (5.3 to 6.3 s).
// The ring forming (6.3 to 7.7 s) is the `twinkle` appear (Task 18), not this sheet.

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(AETHER_SEQUENCES);
});
const at = (s: number): EntranceFrame => entranceFrame(seq, s, AETHER_ENTRANCE_GEOMETRY);
/** One of the sheet's own props (the world's extras the frame does not pass on). */
const prop = (name: string, s: number) => seq.sample<Record<string, number>>('entrance', 'main', s)[name];
const times = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const deg = (r: number) => (r * 180) / Math.PI;
const LENGTH = 6.3;
/** The moment a prop is at its largest over the sheet, and how many separate peaks reach within 1e-6 of it. */
function peakOf(read: (s: number) => number) {
  const samples = times(0, LENGTH, 0.005).map(s => ({ s, v: read(s) }));
  const top = Math.max(...samples.map(p => p.v));
  const at = samples.filter(p => p.v > top - 1e-6);
  const runs = at.filter((p, i) => i === 0 || p.s - at[i - 1].s > 0.006).length;
  return { top, s: at[0].s, runs, samples };
}

test('the session flag is octoverse.aether.entranceSeen, and the sheet is 6.3 s with a quarter glide-turn, no spiral', () => {
  expect(entranceSeenKey(AETHER_BUNDLE.id)).toBe('octoverse.aether.entranceSeen');
  expect(seq.length('entrance')).toBe(LENGTH);
  expect(SEQUENCE_DEFAULTS.entrance.length).toBe(LENGTH);
  expect(AETHER_SEQUENCES.entrance).toEqual({ turn: Math.PI / 2, spiral: false });
});

test('the stroke she swims for the checks is strokeTiming(personality), the glide 0.85 s; her reach covers the swim poses', () => {
  expect(AETHER_ENTRANCE_GEOMETRY.swim).toEqual(strokeTiming(AETHER.personality));
  expect(AETHER_ENTRANCE_GEOMETRY.swim.glide).toBeCloseTo(0.85, 9);
  expect(AETHER_ARM_HALF_SPAN.closed).toBeGreaterThan(AETHER.head.halfWidth + 0.4);
});

test('a glimmer in the haze on the left becomes Aether, glow first, and she ends exactly at the stage spot facing the visitor', () => {
  const start = at(0);
  expect(start.position[0]).toBeLessThan(-3);
  expect(start.position[2]).toBeLessThan(-8);
  expect(start.reveal).toBe(0);
  expect(at(0.5).reveal).toBeGreaterThan(0);
  expect(at(0.5).reveal).toBeLessThan(1);
  expect(at(B.appearEnd).reveal).toBe(1);
  const end = at(LENGTH);
  end.position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(end.yaw).toBe(0);
  expect(end.pitch).toBeCloseTo(0, 9);
  expect([end.spin, end.forward, end.open, end.settle]).toEqual([1, 1, 1, 1]);
  expect(end.expression).toBe('gentle');
  expect(at(99)).toEqual(end);
});

test('two soft strokes: two whole strokes at her own rate, each power stroke (the surge) between 1 and 4.2 s', () => {
  const timing = AETHER_ENTRANCE_GEOMETRY.swim;
  expect(at(0).stroke).toBe(0);
  expect(at(B.strokeEnd).stroke).toBeCloseTo(2, 9);
  expect(at(LENGTH).stroke).toBeCloseTo(2, 9);
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
    expect(s).toBeLessThan(4.2);
  }
  expect(surges[1] - surges[0]).toBeCloseTo(1.69, 2);
  // A glide, not a dash: the path's speed stays under 7 stage units a second the whole way.
  for (const s of times(0.05, LENGTH - 0.05, 0.05)) {
    const h = 0.005;
    const a = at(s - h).position;
    const b = at(s + h).position;
    expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * h), `${s} s`).toBeLessThan(7);
  }
});

// The path clears the arch and its steps, the towers, the walls and the floating stones of her own
// layout with her arms as drawn, held open and held closed, by at least 0.3 stage units (about the
// width of one of her arms at the root, with the cups' flare and the breath on top).
test('the path clears the arch, the towers, the walls and the floating rubble of layout.json with her arms as drawn, open and closed, by at least 0.3', () => {
  const layout = OBSERVATORY_WORLD.layout;
  expect(AETHER_BUNDLE.place.layout).toBe(layout);
  const gaps = entranceClearance(seq, AETHER_ENTRANCE_GEOMETRY, layout, AETHER_ENTRANCE_FOOTPRINTS, { samples: 1261 });
  for (const reach of ['frame', 'open', 'closed'] as const) expect(gaps[reach].gap, `${reach}: ${gaps[reach].piece} at ${gaps[reach].seconds} s`).toBeGreaterThan(0.3);
  expect(gaps.closed.gap - gaps.open.gap).toBeCloseTo(AETHER_ARM_HALF_SPAN.open - AETHER_ARM_HALF_SPAN.closed, 6);
  // The footprints cover every arch, step, tower, wall and floating stone the layout places.
  const counted = new Set(Object.values(layout.groups).flat().filter(p => AETHER_ENTRANCE_FOOTPRINTS[p.piece]).map(p => p.piece));
  const stone = new Set(Object.values(layout.groups).flat().map(p => p.piece).filter(piece => /^(portal_arch|portal_steps|tower_|wall_|rubble_float_)/.test(piece)));
  expect(counted).toEqual(stone);
  expect(stone.size).toBe(14);
});

test('she passes in front of the portal, on its left, as the glyph fires: nearer the camera than the arch and left of it', () => {
  const arch = OBSERVATORY_WORLD.layout.groups.portal.find(p => p.piece === 'portal_arch')!;
  const pass = at(B.glyphFire).position;
  expect(pass[0]).toBeLessThan(arch.position[0] - 4);
  expect(pass[0]).toBeGreaterThan(5);
  expect(pass[2]).toBeGreaterThan(arch.position[2] + 4);
  // Heading toward the portal (right) up to the pass, then curving toward the camera (+z).
  const v = (s: number) => [at(s + 0.01).position[0] - at(s - 0.01).position[0], at(s + 0.01).position[2] - at(s - 0.01).position[2]];
  expect(v(2)[0]).toBeGreaterThan(0);
  expect(v(4)[1]).toBeGreaterThan(0);
});

test('the brain glyph fires once, peaking in [3.0, 3.4] s, at the most the membrane draws, and rests at 1 otherwise', () => {
  const fire = (s: number) => at(s).kit!.portalFlash;
  const { top, s, runs, samples } = peakOf(fire);
  expect(runs).toBe(1);
  expect(s).toBeGreaterThanOrEqual(3.0);
  expect(s).toBeLessThanOrEqual(3.4);
  const membrane = WORLD_MATERIALS.find(m => m.node === 'portal_membrane')!.params as { flash: number };
  expect(top).toBeCloseTo(GLYPH_FIRE_PEAK, 9);
  expect(GLYPH_FIRE_PEAK).toBeCloseTo(1 + membrane.flash, 9);
  // Once: up to the peak and down, never back up on the way.
  const up = samples.filter(p => p.s <= s);
  const down = samples.filter(p => p.s >= s);
  up.forEach((p, i) => i > 0 && expect(p.v).toBeGreaterThanOrEqual(up[i - 1].v - 1e-12));
  down.forEach((p, i) => i > 0 && expect(p.v).toBeLessThanOrEqual(down[i - 1].v + 1e-12));
  for (const p of samples) if (p.s <= B.lookBackStart || p.s >= 3.7) expect(p.v).toBeCloseTo(1, 9);
});

test('her head looks back at the portal from 3.0 to 3.8 s and only then (the sheet authors it; the engine does not draw it yet)', () => {
  for (const s of times(0, LENGTH, 0.01)) if (s <= B.lookBackStart || s >= B.lookBackEnd) expect(prop('headYaw', s), `${s} s`).toBeCloseTo(0, 9);
  const { top, s } = peakOf(t => prop('headYaw', t));
  expect(s).toBeGreaterThan(B.lookBackStart);
  expect(s).toBeLessThan(B.lookBackEnd);
  // Toward the portal: +yaw turns her head to her right, the way the portal lies behind her as she curves to the camera.
  expect(deg(top)).toBeGreaterThan(30);
  expect(deg(top)).toBeLessThan(50);
  // The glyph fires inside the look-back.
  expect(B.glyphFire).toBeGreaterThan(B.lookBackStart);
  expect(B.glyphFire).toBeLessThan(B.lookBackEnd);
});

test('the yaw path is monotonic, from +90 degrees (facing right, head leading) to exactly 0, the turn taking it from the pass to 0 in 4.2 to 5.3 s', () => {
  expect(deg(at(0).yaw)).toBeCloseTo(90, 9);
  expect(at(B.turnEnd).yaw).toBe(0);
  expect(at(LENGTH).yaw).toBe(0);
  let last = Infinity;
  for (const s of times(0, LENGTH, 0.001)) {
    const { yaw } = at(s);
    expect(yaw, `${s} s`).toBeLessThanOrEqual(last + 1e-12);
    if (s >= B.turnEnd) expect(yaw).toBe(0);
    last = yaw;
  }
  // The turn itself is the bulk: from 50 degrees to 0, no faster than 150 degrees a second, easing in and out.
  expect(deg(at(B.turnStart).yaw)).toBeCloseTo(50, 6);
  const rate = (s: number) => -deg(at(s + 0.005).yaw - at(s - 0.005).yaw) / 0.01;
  for (const s of times(B.turnStart + 0.01, B.turnEnd - 0.01, 0.01)) expect(rate(s)).toBeLessThan(150);
  expect(rate(4.25)).toBeLessThan(rate(4.75));
  expect(rate(5.25)).toBeLessThan(rate(4.75));
});

test('the head tilts about 12 degrees as she first sees the visitor and straightens, all inside the turn', () => {
  const { top, s } = peakOf(t => prop('headTilt', t));
  expect(deg(top)).toBeCloseTo(12, 9);
  expect(top).toBe(ENTRANCE_TILT);
  expect(s).toBeGreaterThan(B.turnStart);
  expect(s).toBeLessThan(B.turnEnd);
  for (const t of times(0, LENGTH, 0.01)) if (t <= B.turnStart || t >= B.turnEnd) expect(prop('headTilt', t), `${t} s`).toBeCloseTo(0, 9);
});

test('inside the settle, 5.3 to 6.3 s, she looks at you, then blinks, then smiles, in that order; her arms open first', () => {
  // When each beat lands: the look complete, the blink closed, the smile landed (the face's settle at 1).
  const first = (read: (s: number) => number, level: number) => times(0, LENGTH, 0.005).find(s => read(s) >= level)!;
  const look = first(s => prop('look', s), 1 - 1e-9);
  const blink = peakOf(s => prop('blink', s));
  const smile = first(s => at(s).settle, 1 - 1e-9);
  expect(blink.runs).toBe(1);
  expect(blink.top).toBe(1);
  expect(look).toBeGreaterThanOrEqual(B.turnEnd);
  expect(look).toBeLessThan(blink.s);
  // The blink is over before the smile begins, and the smile lands at the settle's end.
  expect(times(0, blink.s, 0.01).every(s => at(s).settle === 0)).toBe(true);
  expect(blink.s).toBeLessThan(smile);
  expect(smile).toBeLessThanOrEqual(B.settleEnd);
  // She faces the visitor before she looks at them: the turn is done.
  expect(at(look).yaw).toBe(0);
  // Nothing of the settle starts before 5.3 s: the arms trail and the face is the swim's happy one.
  for (const s of times(0, B.turnEnd, 0.05)) {
    const f = at(s);
    for (const v of [f.forward, f.open, f.settle]) expect(v, `${s} s`).toBeLessThan(1e-9);
    expect(f.expression).toBe('happy');
    expect(prop('look', s)).toBeCloseTo(0, 9);
  }
  // The arms lead (forward never behind open), and they are opening before she smiles.
  for (const s of times(B.turnEnd, LENGTH, 0.02)) expect(at(s).forward).toBeGreaterThanOrEqual(at(s).open);
  expect(at(blink.s).open).toBeGreaterThan(0.3);
  // Her arms are drawn in (the trail) through the turn: they open only in the settle.
  for (const s of times(B.turnStart, B.turnEnd, 0.05)) expect(armHalfSpan(at(s), AETHER_ENTRANCE_GEOMETRY)).toBeLessThan(AETHER_ARM_HALF_SPAN.open);
});

test('skipping at any moment lands in the intro, in the intro pose, with the ring shown and the membrane at rest', () => {
  const known = new Set<string>();
  const entering = initialStage({ entranceSeen: false, reducedMotion: false });
  expect(entering.stage).toBe('entering');
  for (const s of times(0, LENGTH, 0.35)) {
    // The stage takes no time from the sheet: a skip at any second is the same event.
    expect(at(s).position.every(Number.isFinite), `${s} s`).toBe(true);
    const after = stageReducer(entering, { type: 'SKIP' }, known);
    expect(after.stage, `${s} s`).toBe('intro');
  }
  expect(stageReducer(entering, { type: 'ENTRANCE_DONE' }, known).stage).toBe('intro');
  expect(ringShown('intro')).toBe(true);
  expect(ringShown('entering')).toBe(false);
  // The kit rests where the entrance ends (Octopus writes the end frame's kit when the entrance is over or skipped).
  expect(at(LENGTH).kit).toEqual({ portalFlash: 1 });
  // And the entrance's end is the intro pose's body place, so a finished entrance and a skip land in the same spot.
  at(LENGTH).position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(AETHER_POSES.intro.body).toMatchObject({ x: 0, y: 0, yaw: 0 });
});

test('with reduced motion she starts in the intro pose with the ring shown (no entrance)', () => {
  const start = initialStage({ entranceSeen: false, reducedMotion: true });
  expect(start.stage).toBe('intro');
  expect(ringShown(start.stage)).toBe(true);
  // Seen once this session: the intro too.
  expect(initialStage({ entranceSeen: true, reducedMotion: false }).stage).toBe('intro');
});

test("the bundle validates with the entrance's kit drive: the membrane's emissive flash, the sheet's glyphFire", () => {
  expect(() => validateBundle(AETHER_BUNDLE, ['nox', 'aether'])).not.toThrow();
  expect(AETHER_SEQUENCES.kitDrives).toEqual({ portalFlash: 'glyphFire' });
  expect(OBSERVATORY_WORLD.props).toContainEqual(PORTAL_FLASH);
  expect(PORTAL_FLASH).toEqual({ id: 'portalFlash', node: 'portal_membrane', drive: 'emissive' });
  // The glyph keeps its glow (its own pulse) and has no emissive prop: the engine allows none beside a glow.
  expect(OBSERVATORY_WORLD.props!.some(p => p.node === 'portal_glyph')).toBe(false);
});
