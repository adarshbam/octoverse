import { beforeAll, expect, test } from 'vitest';
import { resolveExpressions } from '../../../engine/behavior/expressions';
import { initialStage } from '../../../engine/behavior/stageMachine';
import { entranceSeenKey } from '../../../engine/behavior/useStage';
import { ARM_IDS } from '../../../engine/config/types';
import { strokeAt } from '../../../engine/motion/stroke';
import { type EntranceFrame, armHalfSpan, entranceClearance, entranceFrame, layoutClearance } from '../../../engine/sequences/entrance';
import { loadWorldSequences, type Sequences } from '../../../engine/sequences/theatre';
import { validateBundle } from '../../../engine/types/bundle';
import { FLUX_BUNDLE } from '../bundle';
import { FLUX } from '../character';
import { PIPELINE_WORLD } from '../place/config';
import { INLAY_NODES } from '../place/kit';
import { FLUX_POSES } from '../poses';
import { FLUX_SWIM_STRETCH, SWIM_POSES } from '../swim';
import { FLUX_ARM_HALF_SPAN, FLUX_ENTRANCE_FOOTPRINTS, FLUX_ENTRANCE_GEOMETRY, FLUX_INTRO_HALF_SPAN } from './clearance';
import { SEQUENCE_DEFAULTS } from './defaults';
import { FLUX_SEQUENCES } from './index';

// Flux's entrance (spec 7.9): he bursts in from the left already moving, five quick strokes with
// short glides, the portal's four arcs lighting one by one like a pipeline run going green and the
// disc flashing once, a small overshoot past his spot and a spring back, a quick turn of pi with a
// happy bounce, and the arms popping open into the intro pose on the big open smile by 5 s.

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(FLUX_SEQUENCES);
});
const at = (s: number): EntranceFrame => entranceFrame(seq, s, FLUX_ENTRANCE_GEOMETRY);
const times = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const LENGTH = 5;
const ARCS = ['portalArc1', 'portalArc2', 'portalArc3', 'portalArc4'] as const;
/** The membrane's cap on each drive (1 + its flash): the most its shader draws. */
const cap = (node: string) => 1 + (PIPELINE_WORLD.materials!.find(m => m.node === node)!.params as { flash: number }).flash;

test('the entrance key is octoverse.flux.entranceSeen, the sheet is 5 s, and the shape is a turn of pi with no spiral', () => {
  expect(entranceSeenKey(FLUX_BUNDLE.id)).toBe('octoverse.flux.entranceSeen');
  expect(seq.length('entrance')).toBe(LENGTH);
  expect(SEQUENCE_DEFAULTS.entrance.length).toBe(LENGTH);
  expect(FLUX_SEQUENCES.entrance).toEqual({ turn: Math.PI, spiral: false });
});

test('his arm reach for the checks is measured from the poses: the intro (open) and the trail bundle with the head (closed)', () => {
  const reach = (arms: Record<string, readonly (readonly [number, number])[]>, stretch = 1) =>
    Math.max(...Object.values(arms).flatMap(points => points.map(([x]) => Math.abs(x - SWIM_POSES.bodyX) * stretch)));
  const tip = FLUX.tipRadius;
  expect(reach(FLUX_POSES.intro.arms) + tip).toBeLessThanOrEqual(FLUX_INTRO_HALF_SPAN);
  expect(FLUX_INTRO_HALF_SPAN).toBeLessThan(FLUX_ARM_HALF_SPAN.open);
  expect(reach(SWIM_POSES.open.arms) + tip).toBeLessThanOrEqual(FLUX_ARM_HALF_SPAN.open);
  expect(Math.max(reach(SWIM_POSES.trail.arms, FLUX_SWIM_STRETCH) + tip, FLUX.head.halfWidth)).toBeLessThanOrEqual(FLUX_ARM_HALF_SPAN.closed);
  // Exactly eight arms in every pose the entrance draws.
  for (const pose of [FLUX_POSES.intro, SWIM_POSES.open, SWIM_POSES.trail]) expect(Object.keys(pose.arms).sort()).toEqual([...ARM_IDS]);
});

test('he bursts in from the left already moving, and ends exactly at the stage spot facing the visitor', () => {
  const start = at(0);
  // Off the left edge of the frame at 0 (16:9 shows x -4.3 at his depth; the stills show his head half in by 0.3 s).
  expect(start.position[0]).toBeLessThan(-5);
  // Already moving: fast at the start, faster than the average over the swim.
  const speed = (s: number) => {
    const a = at(s - 0.005).position;
    const b = at(s + 0.005).position;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.01;
  };
  expect(speed(0.01)).toBeGreaterThan(2.5);
  expect(at(0.3).reveal).toBe(1);
  const end = at(LENGTH);
  end.position.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-9));
  expect(end.yaw).toBe(0);
  expect(at(99)).toEqual(end);
  // Energetic, not frantic: never faster than 6 stage units a second.
  for (const s of times(0.01, LENGTH - 0.01, 0.02)) expect(speed(s), `${s} s`).toBeLessThan(6);
});

// The path keeps clear of the towers, the rack modules, the bridge's piers and deck, and the
// portal's plinth of his own layout, with his arms open and closed, by more than the width of an arm
// at its root (0.15). Held fully open the whole way is a worse case than he ever is. Two parts, as
// the arms are two things: while he swims (to 3 s) a stroke's open is the umbrella, whose widest arm
// reaches 2.3; from the brake on the stroke clock has stopped (a whole stroke, the trail) and the
// arms only open toward the intro pose, which reaches 2.05 (at the spot itself the rack module behind
// on the right stands 2.32 off: the umbrella would not fit there, the intro does).
test('the path clears the towers, piers and portal of layout.json with the arms as drawn, open and closed', () => {
  const layout = PIPELINE_WORLD.layout;
  expect(FLUX_BUNDLE.place.layout).toBe(layout);
  const SWIM_END = 3;
  const swimming = entranceClearance(seq, FLUX_ENTRANCE_GEOMETRY, layout, FLUX_ENTRANCE_FOOTPRINTS, { samples: 601, until: SWIM_END });
  const settling = { swim: FLUX_ENTRANCE_GEOMETRY.swim, armHalfSpan: { open: FLUX_INTRO_HALF_SPAN, closed: FLUX_ARM_HALF_SPAN.closed } };
  const after = (s: number) => at(SWIM_END + s);
  for (const reach of ['frame', 'open', 'closed'] as const) {
    const gap = swimming[reach];
    expect(gap.gap, `swimming, ${reach}: ${gap.piece} at ${gap.seconds} s`).toBeGreaterThan(0.15);
    const late = layoutClearance(after, layout, settling, FLUX_ENTRANCE_FOOTPRINTS, 401, LENGTH - SWIM_END, reach);
    expect(late.gap, `arriving, ${reach}: ${late.piece} at ${SWIM_END + late.seconds} s`).toBeGreaterThan(0.15);
  }
  expect(swimming.closed.gap - swimming.open.gap).toBeCloseTo(FLUX_ARM_HALF_SPAN.open - FLUX_ARM_HALF_SPAN.closed, 6);
  // From the brake on the stroke stays whole (the trail, no umbrella), so the intro's reach is the widest.
  for (const s of times(SWIM_END, LENGTH, 0.05)) expect(strokeAt(at(s).stroke, FLUX_ENTRANCE_GEOMETRY.swim).spread).toBe(0);
  // The footprints cover the towers, the piers and the portal: every one of them in the layout has one.
  const counted = new Set(Object.values(layout.groups).flat().filter(p => FLUX_ENTRANCE_FOOTPRINTS[p.piece]).map(p => p.piece));
  for (const piece of ['tower_a', 'tower_b', 'tower_c', 'rack_module', 'bridge_pier', 'portal_plinth']) expect(counted.has(piece), piece).toBe(true);
});

test('five quick strokes: every power stroke (the surge) starts and ends between 0.5 and 3.0 s, with short glides', () => {
  const timing = FLUX_ENTRANCE_GEOMETRY.swim;
  const surges: number[] = [];
  let last = strokeAt(at(0).stroke, timing).phase;
  for (const s of times(0, LENGTH, 0.002)) {
    const { phase } = strokeAt(at(s).stroke, timing);
    if (phase === 'power' && last !== 'power') surges.push(s);
    last = phase;
  }
  expect(surges.length).toBe(5);
  for (const s of surges) {
    expect(s).toBeGreaterThanOrEqual(0.5);
    expect(strokeAt(at(s + 0.08).stroke, timing).phase).toBe('power');
    expect(s + 0.1).toBeLessThanOrEqual(3.0);
  }
  // Quick and even: one surge every 0.45 to 0.6 s.
  for (let i = 1; i < surges.length; i++) {
    expect(surges[i] - surges[i - 1]).toBeGreaterThan(0.45);
    expect(surges[i] - surges[i - 1]).toBeLessThan(0.6);
  }
  // No stroke after the swim: the clock holds a whole number from 3 s.
  for (const s of times(3, LENGTH, 0.05)) expect(at(s).stroke).toBe(5);
});

test('the portal run: the four arcs peak in order 1 to 4 inside 2.2 to 3.0 s, at least 120 ms apart, each once, and stay lit', () => {
  const samples = times(0, LENGTH, 0.005);
  const peaks = ARCS.map((id, i) => {
    const values = samples.map(s => ({ s, v: at(s).kit![id] }));
    const peak = Math.max(...values.map(p => p.v));
    const top = values.filter(p => p.v > peak - 1e-9);
    // Once: one peak, rising to it and falling from it without a second rise.
    expect(top.length, id).toBe(1);
    const up = values.filter(p => p.s <= top[0].s);
    const down = values.filter(p => p.s >= top[0].s);
    up.forEach((p, k) => k > 0 && expect(p.v, `${id} ${p.s}`).toBeGreaterThanOrEqual(up[k - 1].v - 1e-12));
    down.forEach((p, k) => k > 0 && expect(p.v, `${id} ${p.s}`).toBeLessThanOrEqual(down[k - 1].v + 1e-12));
    // Dark before the run (under its resting light, 1), its peak within what the inlay's membrane draws, lit after.
    expect(values[0].v, id).toBeLessThan(0.5);
    for (const p of values) if (p.s < 2.2) expect(p.v, `${id} ${p.s}`).toBeCloseTo(values[0].v, 9);
    expect(peak).toBeLessThanOrEqual(cap(INLAY_NODES[i]) + 1e-9);
    expect(peak).toBeGreaterThan(4);
    expect(at(LENGTH).kit![id]).toBeGreaterThan(2);
    return top[0].s;
  });
  for (const s of peaks) {
    expect(s).toBeGreaterThanOrEqual(2.2);
    expect(s).toBeLessThanOrEqual(3.0);
  }
  for (let i = 1; i < peaks.length; i++) expect(peaks[i] - peaks[i - 1], ARCS[i]).toBeGreaterThanOrEqual(0.12 - 1e-9);
});

test('the disc flashes once, after arc 4 peaks, within what its membrane draws, and rests at 1 otherwise', () => {
  const samples = times(0, LENGTH, 0.005).map(s => ({ s, v: at(s).kit!.portalDisc }));
  const arc4 = times(0, LENGTH, 0.005).reduce((best, s) => (at(s).kit!.portalArc4 > at(best).kit!.portalArc4 ? s : best), 0);
  const peak = Math.max(...samples.map(p => p.v));
  const top = samples.filter(p => p.v > peak - 1e-9);
  expect(top.length).toBe(1);
  expect(top[0].s).toBeGreaterThan(arc4);
  expect(top[0].s).toBeLessThanOrEqual(3.2);
  expect(peak).toBeGreaterThan(1.2);
  expect(peak).toBeLessThanOrEqual(cap('portal_disc') + 1e-9);
  const up = samples.filter(p => p.s <= top[0].s);
  const down = samples.filter(p => p.s >= top[0].s);
  up.forEach((p, k) => k > 0 && expect(p.v).toBeGreaterThanOrEqual(up[k - 1].v - 1e-12));
  down.forEach((p, k) => k > 0 && expect(p.v).toBeLessThanOrEqual(down[k - 1].v + 1e-12));
  for (const p of samples) if (p.s <= arc4 || p.s >= 3.6) expect(p.v, `${p.s}`).toBeCloseTo(1, 9);
});

test('the overshoot: the body x passes the stage spot by 0.15 to 0.35 between 3.0 and 3.6 s and springs back to it', () => {
  for (const s of times(0, 3.0, 0.01)) expect(at(s).position[0], `${s} s`).toBeLessThanOrEqual(0.02);
  const window = times(3.0, 3.6, 0.005).map(s => ({ s, x: at(s).position[0] }));
  const most = window.reduce((a, b) => (b.x > a.x ? b : a));
  expect(most.x).toBeGreaterThanOrEqual(0.15);
  expect(most.x).toBeLessThanOrEqual(0.35);
  expect(most.s).toBeGreaterThan(3.05);
  expect(most.s).toBeLessThan(3.55);
  for (const s of times(3.6, LENGTH, 0.01)) expect(Math.abs(at(s).position[0]), `${s} s`).toBeLessThan(1e-9);
  // Brakes with the arms flared forward: they have come out of the trail by the overshoot's peak.
  expect(at(most.s).forward).toBeGreaterThan(0.8);
});

test('the turn: the yaw never decreases, is exactly -pi at 3.6 s and 0 at 4.2 s, a turn of pi in that window, with a happy bounce', () => {
  expect(at(3.6).yaw).toBeCloseTo(-Math.PI, 9);
  expect(at(4.2).yaw).toBe(0);
  let last = -Infinity;
  let rise = 0;
  let before = at(3.6).yaw;
  for (const s of times(0, LENGTH, 0.0025)) {
    const { yaw, spin } = at(s);
    expect(yaw, `${s} s`).toBeGreaterThanOrEqual(last - 1e-12);
    if (s > 3.6 && s <= 4.2 + 1e-9) {
      rise += yaw - before;
      before = yaw;
    }
    if (s <= 3.6) expect(spin).toBe(0);
    if (s >= 4.2) expect(spin).toBe(1);
    last = yaw;
  }
  expect(rise).toBeCloseTo(Math.PI, 6);
  // Swimming in he faces right and a little toward the visitor (P1's three-quarter view).
  const facing = (s: number) => [Math.sin(at(s).yaw), Math.cos(at(s).yaw)];
  for (const s of [0.5, 1.5, 2.5]) {
    const [x, z] = facing(s);
    expect(x, `${s} s`).toBeGreaterThan(0.8);
    expect(z, `${s} s`).toBeGreaterThan(0.2);
  }
  // The happy bounce: the body rises during the turn and is back down by its end... and settles to 0.
  const ys = times(3.6, 4.2, 0.01).map(s => at(s).position[1]);
  expect(Math.max(...ys)).toBeGreaterThan(0.08);
  expect(Math.abs(at(4.6).position[1])).toBeLessThan(1e-9);
});

test('the settle: the arms pop open into the intro pose and the face is the intro face by 5.0 s', () => {
  // Through the turn the arms are only part open; they pop open after it.
  expect(at(4.2).open).toBeLessThan(0.6);
  expect(at(4.7).open).toBe(1);
  for (const s of times(0, 4.2, 0.05)) expect(at(s).settle, `${s} s`).toBe(0);
  const end = at(LENGTH);
  expect([end.forward, end.open, end.settle, end.pitch]).toEqual([1, 1, 1, 0]);
  // The face he lands on is the one the intro wears (the big open smile): the engine's settle face
  // ('gentle') is Flux's intro face, so nothing changes as the entrance hands over to the intro.
  const faces = resolveExpressions(FLUX);
  expect(end.expression).toBe('gentle');
  expect(faces[end.expression]).toEqual(faces[FLUX_POSES.intro.expression]);
  // The swim face is the same smile.
  expect(faces[at(1).expression]).toEqual(faces[FLUX_POSES.intro.expression]);
  // The arms reach no further than the intro's while he settles.
  const intro = { swim: FLUX_ENTRANCE_GEOMETRY.swim, armHalfSpan: { open: FLUX_INTRO_HALF_SPAN, closed: FLUX_ARM_HALF_SPAN.closed } };
  for (const s of times(3.6, LENGTH, 0.05)) expect(armHalfSpan(at(s), intro)).toBeLessThanOrEqual(FLUX_INTRO_HALF_SPAN);
});

test('reduced motion: he is simply present in the intro pose, and the portal rests lit (all four arcs)', () => {
  expect(initialStage({ entranceSeen: false, reducedMotion: true })).toEqual(initialStage({ entranceSeen: true, reducedMotion: false }));
  expect(initialStage({ entranceSeen: false, reducedMotion: true }).stage).toBe('intro');
  // With no entrance played, the kit rests where the sheet ends (Octopus.tsx): the arcs lit, the disc at rest.
  const rest = at(LENGTH).kit!;
  for (const id of ARCS) expect(rest[id], id).toBeGreaterThan(2);
  expect(rest.portalDisc).toBe(1);
  const dark = at(0).kit!;
  for (const id of ARCS) expect(dark[id], id).toBeLessThan(0.5);
  expect(dark.portalDisc).toBe(1);
});

test("the bundle validates with the entrance's kit drives: the arcs' inlays and the disc, each on 'emissive'", () => {
  expect(() => validateBundle(FLUX_BUNDLE)).not.toThrow();
  expect(FLUX_SEQUENCES.kitDrives).toEqual({ portalArc1: 'portalArc1', portalArc2: 'portalArc2', portalArc3: 'portalArc3', portalArc4: 'portalArc4', portalDisc: 'portalDisc' });
  expect(PIPELINE_WORLD.props).toEqual([
    { id: 'portalArc1', node: 'portal_arc_1_inlay', drive: 'emissive' },
    { id: 'portalArc2', node: 'portal_arc_2_inlay', drive: 'emissive' },
    { id: 'portalArc3', node: 'portal_arc_3_inlay', drive: 'emissive' },
    { id: 'portalArc4', node: 'portal_arc_4_inlay', drive: 'emissive' },
    { id: 'portalDisc', node: 'portal_disc', drive: 'emissive' },
  ]);
});
