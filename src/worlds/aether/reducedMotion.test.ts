import { expect, test } from 'vitest';
import { dealToBeads, beadAngles, flightPoint, ringFlight, ringPoint } from '../../engine/artifacts/satellite';
import { twinkleState } from '../../engine/artifacts/twinkle';
import { HEAD_EFFECTS } from '../../engine/character/headEffects';
import { createSynapse } from '../../engine/character/headEffects/synapse';
import { headDraw, restingSwell, SwellRun, type HeadDraw, type SwellFrame } from '../../engine/sequences/headSwell';
import { AETHER_ARTIFACTS } from './artifacts';
import { AETHER } from './character';

// Spec 7.11, reduced motion, on Aether's own data (Task 21). No float, drift, swim, tilt or wander; the ring static;
// the flight a crossfade from beads to orbs; the synapse a crossfade. The engine's own tests cover each module
// (satellite.test.ts, twinkle.test.ts, headEffects/synapse.test.ts); these pin it for her ring, her bead count and
// her head, and say exactly what is and is not reachable live (the e2e, tests/e2e/aetherAccess.spec.ts, measures the page).

const { ring } = AETHER_ARTIFACTS.placement;

test('her ring is static: every bead stands at its home at any time, while with motion they sway', () => {
  for (const t of [0, 0.4, 3.1, 7.7, 41]) expect(beadAngles(t, ring, true)).toEqual(ring.homes);
  const swaying = [0.4, 3.1, 7.7].map(t => beadAngles(t, ring, false).map((a, i) => Math.abs(a - ring.homes[i])));
  expect(Math.max(...swaying.flat())).toBeGreaterThan(0.01);
  // Positions follow the angles: the ring's drawn places are the same each time.
  const at = (t: number) => beadAngles(t, ring, true).map(a => ringPoint(a, ring));
  expect(at(0)).toEqual(at(19.5));
});

test('her ring is whole at once: the twinkle is complete at its first moment (five beads, the line drawn), and the ring fades by the crossfade', () => {
  expect(ring.beadCount).toBe(5);
  for (const t of [0, 0.3, 1.4]) {
    const s = twinkleState(t, ring.beadCount, true);
    expect(s.line).toBe(1);
    expect(s.beads).toEqual([1, 1, 1, 1, 1]);
  }
  // With motion the same moment is not: the ring forms.
  expect(twinkleState(0, ring.beadCount, false).line).toBe(0);
  expect(AETHER_ARTIFACTS.appear).toEqual({ kind: 'twinkle', duration: 1.4 });
  // Through the flight the ring simply fades by its middle: no flare, no bright flash.
  for (const p of [0, 0.15, 0.3, 0.5, 1]) {
    const r = ringFlight(p, true);
    expect(r.flare).toBe(0);
    expect(r.bright).toBe(0);
  }
  expect(ringFlight(0, true)).toMatchObject({ bead: 1, line: 1 });
  expect(ringFlight(0.5, true)).toMatchObject({ bead: 0, line: 0 });
});

test('her flight is a crossfade: each orb is at its bead before the middle and at its slot after, never between, no trail', () => {
  const beads = dealToBeads(10, ring.beadCount);
  const slot: [number, number, number] = [-1.6, 0.4, 0];
  for (let i = 0; i < 10; i++) {
    const bead = ringPoint(ring.homes[beads[i]], ring);
    for (let s = 0; s <= 1.0001; s += 0.02) {
      const f = flightPoint(bead, slot, s, i, 10, true);
      const target = s < 0.5 ? bead : slot;
      expect(Math.hypot(f.p[0] - target[0], f.p[1] - target[1], f.p[2] - target[2]), `orb ${i} at ${s}`).toBeLessThan(1e-9);
      expect(f.trail).toBe(0);
    }
    expect(flightPoint(bead, slot, 0.5, i, 10, true).scale).toBeLessThan(0.2);
    expect(flightPoint(bead, slot, 1, i, 10, true).scale).toBe(1);
  }
});

test('her head under reduced motion opens at once and is only ever at an end: no opening is played, so the flight and the synapse cannot be seen part-way live', () => {
  const run = new SwellRun(1.5);
  const frame: SwellFrame = { morph: 0, squeeze: 0, push: 0, effect: 0 };
  // Closed, then asked open: with motion off it is at its end the same step, whatever dt is.
  run.step({ open: false, still: true, dt: 0.016 });
  expect(run.frame(null, 0, frame)).toMatchObject({ morph: 0, effect: 0 });
  for (const dt of [0.016, 0.2, 5]) {
    run.step({ open: true, still: true, dt });
    expect(run.moving).toBe(false);
    expect(run.frame(null, 0.3, frame)).toEqual(restingSwell(true));
    expect(frame.effect).toBe(1);
  }
  // Only a review still (`?freeze&swell=<s>`, `at` given) can hold a moment inside the opening: the one way to see a part-way crossfade.
  run.step({ open: true, still: true, dt: 0.016, at: 0.5 });
  expect(run.moving).toBe(true);
  // Honest gap (engine request in the Task 21a report): the synapse's crossfade form is therefore unreachable with a visitor's reduced motion.
});

test('her synapse under reduced motion is a crossfade in her colours: every node on together, no wave, no pulse; at the settled overview it draws nothing', () => {
  const synapse = createSynapse(AETHER.dome, AETHER.palette, { reducedMotion: true });
  expect(HEAD_EFFECTS.synapse.create).toBeTypeOf('function');
  const draw = headDraw({ morph: 1, squeeze: 0, push: 0, effect: 0.5 }, {} as HeadDraw);
  for (const effect of [0.1, 0.35, 0.5, 0.7, 0.9]) {
    synapse.update(effect, draw, 0);
    expect(new Set(Array.from(synapse.nodeAlpha)).size, `effect ${effect}`).toBe(1);
    expect(synapse.pulse).toBe(0);
  }
  synapse.update(1, draw, 0);
  expect(synapse.root.visible).toBe(false);
  synapse.update(0, draw, 0);
  expect(synapse.root.visible).toBe(false);
  synapse.dispose();
});
