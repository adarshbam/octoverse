import { expect, test } from 'vitest';
import { FOCUS_BEATS, FocusChoreography, focusReaction } from './focusChoreography';

const FRAME = 1000 / 60;

/** Runs the choreography frame by frame through `steps` of [untilMs, selected], recording each frame. */
function run(count: number, steps: [number, number][], instant = false) {
  const c = new FocusChoreography(count);
  const frames: { t: number; arm: number[]; face: number[] }[] = [];
  let t = 0;
  for (const [until, selected] of steps) {
    for (; t <= until; t += FRAME) {
      c.update(selected, t, FRAME, instant);
      frames.push({ t, arm: Array.from({ length: count }, (_, i) => c.arm(i)), face: Array.from({ length: count }, (_, i) => c.face(i)) });
    }
  }
  return frames;
}
const at = (frames: ReturnType<typeof run>, ms: number) => frames.reduce((best, f) => (Math.abs(f.t - ms) < Math.abs(best.t - ms) ? f : best));

test('the eyes lead: the face follows a beat later and the arm after that', () => {
  const frames = run(3, [[2000, 1]]);
  expect(at(frames, FOCUS_BEATS.face.delay - 30).face[1]).toBe(0);
  expect(at(frames, FOCUS_BEATS.face.delay + 120).face[1]).toBeGreaterThan(0);
  expect(at(frames, FOCUS_BEATS.arm.delay - 30).arm[1]).toBe(0);
  expect(at(frames, FOCUS_BEATS.arm.delay + 150).arm[1]).toBeGreaterThan(0);
  expect(FOCUS_BEATS.face.delay).toBeLessThan(FOCUS_BEATS.arm.delay);
  expect(FOCUS_BEATS.arm.delay).toBeLessThan(FOCUS_BEATS.tooltip);
  // The arm has presented the orb, and settled, once its beat is over.
  expect(at(frames, FOCUS_BEATS.arm.delay + FOCUS_BEATS.arm.ms + 40).arm[1]).toBe(1);
  expect(frames.at(-1)!.arm).toEqual([0, 1, 0]);
});

test('switching technologies lets go of the old arm at once and lifts the new one a beat later', () => {
  const frames = run(3, [[1500, 0], [3500, 2]]);
  const switched = frames.findIndex(f => f.t > 1500);
  // The old arm starts letting go on the very next frame; the new one waits for its beat.
  expect(frames[switched + 1].arm[0]).toBeLessThan(1);
  expect(at(frames, 1500 + FOCUS_BEATS.arm.delay - 30).arm[2]).toBe(0);
  expect(at(frames, 1500 + FOCUS_BEATS.release.ms + 20).arm[0]).toBe(0);
  expect(frames.at(-1)!.arm).toEqual([0, 0, 1]);
});

test('rapid repeated choices never jump and end with only the last one presented', () => {
  const frames = run(4, [[300, 0], [380, 1], [450, 2], [520, 3], [600, 1], [2600, 1]]);
  for (let k = 1; k < frames.length; k++) {
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(frames[k].arm[i] - frames[k - 1].arm[i]), `orb ${i} at ${frames[k].t.toFixed(0)} ms`).toBeLessThan(0.07);
      expect(Math.abs(frames[k].face[i] - frames[k - 1].face[i])).toBeLessThan(0.08);
    }
  }
  expect(frames.at(-1)!.arm).toEqual([0, 1, 0, 0]);
});

test('letting go returns everything to rest', () => {
  const frames = run(2, [[1500, 1], [2600, -1]]);
  expect(frames.at(-1)!.arm).toEqual([0, 0]);
  expect(frames.at(-1)!.face).toEqual([0, 0]);
});

test('with reduced motion nothing travels: the emphasis switches at once', () => {
  const frames = run(2, [[50, 1]], true);
  expect(frames[0].arm[1]).toBe(1);
  expect(frames[0].face[1]).toBe(1);
});

test('Kali gets the focused face from panel 4; other technologies a subtle curiosity unless their project says otherwise', () => {
  expect(focusReaction({ reaction: 'focused' })).toBe('focused');
  expect(focusReaction({})).toBe('curious');
  expect(focusReaction(undefined)).toBe('curious');
});
