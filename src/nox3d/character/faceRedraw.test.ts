import { expect, test } from 'vitest';
import { FACE_REDRAW_MS, faceRedrawDue } from './faceRedraw';

test('the face texture is redrawn only when something changed, and at most about 30 times a second', () => {
  expect(faceRedrawDue('a', 'a', 1000, 0)).toBe(false);
  expect(faceRedrawDue('b', 'a', 1000, 1000 - FACE_REDRAW_MS + 1)).toBe(false);
  expect(faceRedrawDue('b', 'a', 1000, 1000 - FACE_REDRAW_MS)).toBe(true);
  expect(FACE_REDRAW_MS).toBeGreaterThanOrEqual(25);
  expect(FACE_REDRAW_MS).toBeLessThanOrEqual(34);
});
