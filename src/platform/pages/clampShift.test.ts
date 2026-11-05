import { describe, expect, it } from 'vitest';
import { clampShift } from './geometry';

// The hover drift carries the landing's text and cards sideways with the face; on a narrow window it would carry them off the edge
// (platform Task 21a). clampShift holds the shift so the content stays inside the box.
describe('clampShift', () => {
  const natural = { left: 40, right: 700 }; // a 660 px wide block resting in a 768 px window

  it('leaves a shift that fits alone', () => {
    expect(clampShift(natural, 10, 768, 12)).toBe(10);
    expect(clampShift(natural, -20, 768, 12)).toBe(-20);
  });

  it('stops a shift to the left at the margin', () => {
    expect(clampShift(natural, -127, 768, 12)).toBe(-28); // left edge 40 - 28 = 12
  });

  it('stops a shift to the right at the margin', () => {
    expect(clampShift(natural, 90, 768, 12)).toBe(56); // right edge 700 + 56 = 756 = 768 - 12
  });

  it('moves content that rests outside the margin back in, whatever the shift', () => {
    expect(clampShift({ left: 4, right: 600 }, 0, 768, 12)).toBe(8);
  });

  it('gives content wider than the box no shift at all', () => {
    expect(clampShift({ left: 0, right: 800 }, 50, 768, 12)).toBe(0);
  });

  it('is the identity in a box wide enough for anything', () => {
    expect(clampShift(natural, -300, Infinity, 12)).toBe(-28);
    expect(clampShift({ left: 400, right: 900 }, -300, 1536, 12)).toBe(-300);
  });
});
