import { beforeAll, expect, test } from 'vitest';
import { APPEARS } from '../../../engine/artifacts/strategies';
import { twinkleState } from '../../../engine/artifacts/twinkle';
import { initialStage, stageReducer } from '../../../engine/behavior/stageMachine';
import { bubblesExist } from '../../../engine/sequences/bubbleBlow';
import { loadWorldSequences, type Sequences } from '../../../engine/sequences/theatre';
import { validateBundle } from '../../../engine/types/bundle';
import { AETHER_BUNDLE } from '../bundle';
import { AETHER_ARTIFACTS } from '../artifacts';
import { ENTRANCE_BEATS, SEQUENCE_DEFAULTS } from './defaults';
import { AETHER_SEQUENCES } from './index';

// The ring forming (spec 7.5; Task 18): after the entrance settles the gold line draws round her head
// (about 0.6 s), then the five beads light one after another (to 1.4 s). Aether's `appear` is the
// engine's `twinkle`; the sheet is the clock it plays. What the engine does with it (the line, the
// beads' swell) is the engine's own tests; these pin her values, her sheet and when it starts.

const ring = AETHER_ARTIFACTS.placement.ring;
let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(AETHER_SEQUENCES);
});
const at = (s: number) => APPEARS.twinkle.ring(seq, s, AETHER_ARTIFACTS);
const grid = Array.from({ length: 141 }, (_, i) => i / 100);

test('her appear is the twinkle, 1.4 s, and her bundle validates with it', () => {
  expect(AETHER_ARTIFACTS.appear).toEqual({ kind: 'twinkle', duration: 1.4 });
  expect(() => validateBundle(AETHER_BUNDLE)).not.toThrow();
  expect(APPEARS[AETHER_ARTIFACTS.appear.kind].sheet).toBe('twinkle');
});

test('the twinkle sheet is in her code defaults and her saved state, and its clock runs straight 0 to 1 over 1.4 s', async () => {
  expect(SEQUENCE_DEFAULTS.twinkle.length).toBe(1.4);
  expect(SEQUENCE_DEFAULTS.twinkle.objects.main.keys.clock.map(([s, v]) => [s, v])).toEqual([[0, 0], [1.4, 1]]);
  const state = (await AETHER_SEQUENCES.state()) as { sheetsById: Record<string, { sequence: { length: number } }> };
  expect(state.sheetsById.twinkle.sequence.length).toBe(1.4);
  // The other sheets are as they were (reseeding the one sheet touched no other).
  expect(Object.keys(state.sheetsById).sort()).toEqual(['arrival', 'bubbleBlow', 'entrance', 'headSwell', 'twinkle']);
  expect(seq.length('twinkle')).toBe(1.4);
  const clock = grid.map(s => seq.sample<{ clock: number }>('twinkle', 'main', s).clock);
  expect(clock[0]).toBe(0);
  expect(clock[clock.length - 1]).toBeCloseTo(1, 9);
  clock.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(clock[i]));
});

test('on her sheet the line is whole by 0.6 s, the five beads light in order after it, and the ring is complete by 1.4 s', () => {
  expect(ring.beadCount).toBe(5);
  expect(at(0)).toEqual({ line: 0, beads: [0, 0, 0, 0, 0] });
  const line = grid.map(s => at(s).line);
  line.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(line[i]));
  expect(at(0.6).line).toBeCloseTo(1, 6);
  // No bead is lit until the line is whole.
  for (const s of grid.filter(s => s < 0.6)) expect(Math.max(...at(s).beads), `${s} s`).toBe(0);
  for (const s of grid) {
    const { beads } = at(s);
    for (let i = 0; i + 1 < beads.length; i++) expect(beads[i], `${s} s`).toBeGreaterThanOrEqual(beads[i + 1]);
  }
  const done = at(1.4);
  expect(done.line).toBeCloseTo(1, 6);
  done.beads.forEach(b => expect(b).toBeCloseTo(1, 6));
  // The sheet's clock is straight, so her sheet plays the engine's own timing (the same as twinkleState at that moment).
  for (const s of [0.2, 0.7, 1.0]) expect(at(s).line).toBeCloseTo(twinkleState(s, 5, false).line, 6);
});

test('it runs after the entrance settles: the run waits through the entrance and starts when the bubbles exist, then lasts 1.4 s', () => {
  // The entrance sheet ends at 6.3 s; the stage moves to the intro there, and the bubbles (the twinkle's trigger) exist from it.
  expect(SEQUENCE_DEFAULTS.entrance.length).toBe(ENTRANCE_BEATS.settleEnd);
  expect(bubblesExist('entering')).toBe(false);
  expect(bubblesExist('intro')).toBe(true);
  const run = APPEARS.twinkle.createRun(AETHER_ARTIFACTS);
  const step = (exist: boolean, dt: number) => run.step({ exist, still: false, ready: true, dt, count: 10, length: 1.4 });
  // The whole entrance (6.3 s of it) and beyond: it has not started, and it is not given up.
  for (let s = 0; s < 7; s += 0.1) step(false, 0.1);
  expect(run.seconds).toBeNull();
  expect(run.done).toBe(false);
  // The first frame of the intro starts it at 0, and it plays 1.4 s.
  step(true, 0.1);
  expect(run.seconds).toBe(0);
  for (let k = 0; k < 13; k++) step(true, 0.1);
  expect(run.done).toBe(false);
  step(true, 0.1);
  step(true, 0.1);
  expect(run.done).toBe(true);
});

test('after a skip the ring still forms and is whole by 1.4 s; under reduced motion it is whole at once', () => {
  // SKIP from the entrance is the intro (stageReducer has no clock, so this is the one fact it can show), where the bubbles exist and the twinkle starts: the first time her ring is drawn.
  const skipped = stageReducer(initialStage({ entranceSeen: false, reducedMotion: false }), { type: 'SKIP' }, new Set<string>());
  expect(skipped.stage).toBe('intro');
  expect(bubblesExist(skipped.stage)).toBe(true);
  const run = APPEARS.twinkle.createRun(AETHER_ARTIFACTS);
  run.step({ exist: true, still: false, ready: true, dt: 0.016, count: 10, length: 1.4 });
  expect(run.blowing).toBe(true);
  // The ring is not whole at the skip, and is at the end of the run.
  expect(at(0).line).toBe(0);
  expect(at(1.4).beads).toEqual([1, 1, 1, 1, 1]);
  // Reduced motion (a still): the run is done at once, and the ring state is whole at t 0.
  const quiet = APPEARS.twinkle.createRun(AETHER_ARTIFACTS);
  quiet.step({ exist: true, still: true, ready: true, dt: 0.016, count: 10, length: 1.4 });
  expect(quiet.done).toBe(true);
  expect(twinkleState(0, ring.beadCount, true)).toEqual({ line: 1, beads: [1, 1, 1, 1, 1] });
  expect(initialStage({ entranceSeen: false, reducedMotion: true }).stage).toBe('intro');
});
