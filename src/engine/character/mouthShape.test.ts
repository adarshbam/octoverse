import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { mouthShape } from './mouthShape';

const mouth = NOX.face.mouth;
const gentle = 0.3;

test('a smile curves up at both ends', () => {
  const s = mouthShape(mouth, gentle, 0);
  expect(s.start[1]).toBeGreaterThan(s.smileBottom);
  expect(s.end[1]).toBeGreaterThan(s.smileBottom);
  expect(s.start[0]).toBeLessThan(mouth.center[0]);
  expect(s.end[0]).toBeGreaterThan(mouth.center[0]);
});

test('a closed smile has no lower lip; an open one drops it below the smile line', () => {
  expect(mouthShape(mouth, gentle, 0).lower).toBeNull();
  const open = mouthShape(mouth, gentle, 0.5);
  expect(open.lower).not.toBeNull();
  expect(open.lower!.bottom).toBeLessThan(open.smileBottom - 0.02);
  expect(mouthShape(mouth, gentle, 1).lower!.bottom).toBeLessThan(open.lower!.bottom);
});

test('the tongue fills the bottom third of an open mouth', () => {
  const { smileBottom, lower } = mouthShape(mouth, gentle, 0.6);
  const opening = smileBottom - lower!.bottom;
  expect(lower!.tongueTop - lower!.bottom).toBeCloseTo(opening / 3, 6);
});
