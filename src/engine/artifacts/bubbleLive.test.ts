import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { sideOfFace } from './bubbleLive';

test("a bubble's side is taken about the character's own face origin, not the body's centre line", () => {
  // A face set right of the centre line (0.3): a bubble at 0.2 is left of the face though right of the body.
  expect(sideOfFace(0.2, [0.3, 0])).toBe(-1);
  expect(sideOfFace(0.4, [0.3, 0])).toBe(1);
  expect(sideOfFace(0.2, [0, 0])).toBe(1);
  // On the face: the right, as before.
  expect(sideOfFace(0.3, [0.3, 0.5])).toBe(1);
  expect(sideOfFace(-0.5, [-0.6, 0])).toBe(1);
});

test("TechBubbles writes each bubble's side with sideOfFace about its faceOrigin prop, and names no world", () => {
  const source = readFileSync(new URL('./TechBubbles.tsx', import.meta.url), 'utf8');
  expect(source).toMatch(/bubbleLive\.sides\[i\] = sideOfFace\(node\.position\.x, faceOrigin\);/);
  expect(source).toMatch(/faceOrigin: Point2;/);
  expect(source).not.toMatch(/nox\.character|NOX\b|NOX_/);
});
