import { expect, test } from 'vitest';
import { parseUrlState } from './urlState';

test('parses stage, freeze and view', () => {
  expect(parseUrlState('?stage=overview&freeze&view=-1,0.5,1,-1.5')).toEqual({ stage: 'overview', freeze: true, orbit: false, noWebgl: false, view: [-1, 0.5, 1, -1.5] });
});

test('ignores unknown stages and malformed views', () => {
  expect(parseUrlState('?stage=nope&view=1,2')).toEqual({ freeze: false, orbit: false, noWebgl: false });
});

test('parses expression', () => {
  expect(parseUrlState('?expression=focused').expression).toBe('focused');
  expect(parseUrlState('?expression=grumpy').expression).toBeUndefined();
});

test('parses tech, orbit and nowebgl flags', () => {
  expect(parseUrlState('?tech=kali&orbit&nowebgl')).toEqual({ tech: 'kali', freeze: false, orbit: true, noWebgl: true });
});
