import { beforeAll, expect, test } from 'vitest';
import { PIPELINE_NODES, RUN_END, RUN_START, nodeArrival, pipelineRunState } from '../../engine/character/headEffects/pipelineRun';
import { swellFrame } from '../../engine/sequences/headSwell';
import { loadWorldSequences, type Sequences } from '../../engine/sequences/theatre';
import { validateBundle } from '../../engine/types/bundle';
import { FLUX_BUNDLE } from './bundle';
import { FLUX } from './character';
import { SEQUENCE_DEFAULTS } from './sequences/defaults';
import { FLUX_SEQUENCES } from './sequences/index';
import state from './sequences/state.theatre.json';

// Flux's head swell (spec 7.6): the shared swell with the pipeline run inside the dome. The run's
// progress is the sheet's `effect`, a straight line from 0.5 s to the sheet's end.

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(FLUX_SEQUENCES);
});
const effectAt = (seconds: number) => swellFrame(seq, seconds, true).effect;

test('Flux names the pipelineRun effect, and its three colours are the cup pulse\'s: cyan, lavender, pink', () => {
  expect(FLUX.headEffect).toBe('pipelineRun');
  const [cyan, lavender, pink] = FLUX.suckers.pulse!.colours;
  expect(FLUX.palette.effect).toEqual({ stroke: cyan, halo: lavender, core: pink });
  expect(() => validateBundle(FLUX_BUNDLE)).not.toThrow();
});

test('the saved Theatre state holds the head swell sheet, seeded from the defaults (no code-only sheet)', () => {
  expect(Object.keys(state.sheetsById)).toContain('headSwell');
  expect(state.sheetsById.headSwell.sequence.length).toBe(SEQUENCE_DEFAULTS.headSwell.length);
  expect(seq.length('headSwell')).toBe(1.5);
});

test('the swell keeps the shared mechanics: it opens past full and settles, and the effect is in at the end', () => {
  const morphs = Array.from({ length: 31 }, (_, k) => swellFrame(seq, k * 0.05, true).morph);
  expect(morphs[0]).toBe(0);
  expect(Math.max(...morphs)).toBeCloseTo(1.07, 2);
  expect(morphs[30]).toBeCloseTo(1, 3);
  expect(swellFrame(seq, 1.5, true).effect).toBe(1);
});

test('the pipeline run\'s progress is a straight line over the second half of the sheet, so the spec\'s phases land where it says', () => {
  expect(effectAt(0.4)).toBe(0);
  expect(effectAt(0.5)).toBe(0);
  expect(effectAt(1.0)).toBeCloseTo(0.5, 3);
  expect(effectAt(1.5)).toBe(1);
  // The rings are in as the glass overshoots, the bead starts as it settles, the fade is the sheet's last moments.
  expect(effectAt(0.8)).toBeCloseTo(0.3, 3);
  expect(effectAt(0.5 + RUN_START)).toBeCloseTo(RUN_START, 3);
  expect(effectAt(0.5 + RUN_END)).toBeCloseTo(RUN_END, 3);
  // Each node's fill peaks at a time inside the sheet, in order, and each flash is long enough to see (more than 0.04 s).
  const arrivals = Array.from({ length: PIPELINE_NODES }, (_, i) => 0.5 + nodeArrival(i));
  expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
  for (let i = 0; i < PIPELINE_NODES - 1; i++) expect(arrivals[i + 1] - arrivals[i]).toBeGreaterThan(0.1);
  expect(pipelineRunState(effectAt(1.5)).fade).toBe(1);
});

test('closing plays the run backwards: the nodes empty and fade out as the head closes', () => {
  expect(swellFrame(seq, 0, false).effect).toBe(1);
  expect(swellFrame(seq, 1.5, false).effect).toBe(0);
  const mid = swellFrame(seq, 0.5, false).effect;
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
});
