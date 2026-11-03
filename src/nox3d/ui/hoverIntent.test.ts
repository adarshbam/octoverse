import { expect, test } from 'vitest';
import { HoverIntent } from './hoverIntent';

/** Feeds a straight glide at `speed` px/ms for `ms`, sampling every 16 ms; returns when it first became due. */
function glide(intent: HoverIntent, from: number, speed: number, ms: number, t0 = 0) {
  let due: number | null = null;
  for (let t = 0; t <= ms; t += 16) {
    intent.move(from + speed * t, 100, t0 + t);
    if (due === null && intent.due(t0 + t)) due = t0 + t;
  }
  return due;
}

test('a pointer passing across an orb, even slowly, does not choose it', () => {
  // 0.3 px/ms is a slow hand: 300 px a second, crossing a 70 px orb in about 230 ms.
  expect(glide(new HoverIntent(), 0, 0.3, 230)).toBeNull();
  expect(glide(new HoverIntent(), 0, 1.2, 60)).toBeNull();
});

test('a pointer that comes to rest on an orb chooses it a beat after it stops', () => {
  const intent = new HoverIntent();
  glide(intent, 0, 0.5, 200);
  // Now still.
  let due: number | null = null;
  for (let t = 216; t <= 600; t += 16) if (due === null && intent.due(t)) due = t;
  expect(due).not.toBeNull();
  expect(due! - 200).toBeGreaterThanOrEqual(100);
  expect(due! - 200).toBeLessThanOrEqual(180);
});

test('a hand that is resting but not perfectly still still counts as resting', () => {
  const intent = new HoverIntent();
  let due: number | null = null;
  for (let t = 0; t <= 400; t += 16) {
    intent.move(100 + (t % 32 === 0 ? 2 : -2), 100 + (t % 48 === 0 ? 1 : 0), t);
    if (due === null && intent.due(t)) due = t;
  }
  expect(due).not.toBeNull();
  expect(due!).toBeLessThanOrEqual(200);
});

// A bubble drifts under a pointer that has not moved: the browser reports the same spot again, and
// the visitor chose nothing.
test('hover intent ignores a bubble moving under a still pointer', () => {
  const intent = new HoverIntent();
  // The pointer has sat at (100, 100) for a second.
  for (let t = 0; t <= 1000; t += 16) intent.track(100, 100, t);
  // A bubble slides under it; the page reports the pointer on the bubble, still at the same spot.
  intent.enter(100, 100, 1000);
  let due: number | null = null;
  for (let t = 1000; t <= 2000; t += 16) {
    intent.move(100, 100, t);
    if (due === null && intent.due(t)) due = t;
  }
  expect(due).toBeNull();
  expect(intent.engaged).toBe(false);
});

test('a pointer that moved onto a bubble and rests there still chooses it', () => {
  const intent = new HoverIntent();
  for (let t = 0; t <= 200; t += 16) intent.track(40 + t * 0.3, 100, t);
  intent.enter(100, 100, 200);
  expect(intent.engaged).toBe(true);
  let due: number | null = null;
  for (let t = 216; t <= 600; t += 16) {
    intent.move(100, 100, t);
    if (due === null && intent.due(t)) due = t;
  }
  expect(due).not.toBeNull();
  expect(due! - 200).toBeLessThanOrEqual(180);
});

test('a pointer that moves on a bubble it drifted under takes it from then', () => {
  const intent = new HoverIntent();
  for (let t = 0; t <= 1000; t += 16) intent.track(100, 100, t);
  intent.enter(100, 100, 1000);
  expect(intent.engaged).toBe(false);
  // The hand moves, then rests.
  intent.move(112, 100, 1100);
  expect(intent.engaged).toBe(true);
  expect(intent.due(1100)).toBe(false);
  expect(intent.due(1100 + 140)).toBe(true);
});
