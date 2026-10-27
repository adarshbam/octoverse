import { expect, test } from 'vitest';
import { parseUrlState } from './urlState';

test('parses stage, freeze and view', () => {
  expect(parseUrlState('?stage=overview&freeze&view=-1,0.5,1,-1.5')).toEqual({ stage: 'overview', freeze: true, orbit: false, noWebgl: false, world: false, solo: false, view: [-1, 0.5, 1, -1.5] });
});

test('ignores unknown stages and malformed views', () => {
  expect(parseUrlState('?stage=nope&view=1,2')).toEqual({ freeze: false, orbit: false, noWebgl: false, world: false, solo: false });
});

test('parses expression', () => {
  expect(parseUrlState('?expression=focused').expression).toBe('focused');
  expect(parseUrlState('?expression=grumpy').expression).toBeUndefined();
});

test('parses tech, orbit and nowebgl flags', () => {
  expect(parseUrlState('?tech=kali&orbit&nowebgl')).toEqual({ tech: 'kali', freeze: false, orbit: true, noWebgl: true, world: false, solo: false });
});

test('parses a forced quality tier and ignores unknown ones', () => {
  expect(parseUrlState('?tier=low').tier).toBe('low');
  expect(parseUrlState('?tier=ultra').tier).toBeUndefined();
});

test('parses fixture', () => {
  expect(parseUrlState('?fixture=nosections').fixture).toBe('nosections');
  expect(parseUrlState('?fixture=anything').fixture).toBeUndefined();
  expect(parseUrlState('').fixture).toBeUndefined();
});

test('parses world and t', () => {
  expect(parseUrlState('?world&t=4.8')).toMatchObject({ world: true, t: 4.8 });
  expect(parseUrlState('').world).toBe(false);
  expect(parseUrlState('?stage=intro').t).toBeUndefined();
});

test('ignores a bad t', () => {
  for (const bad of ['?t=abc', '?t=', '?t=Infinity', '?t=NaN', '?t=1,2']) expect(parseUrlState(bad).t, bad).toBeUndefined();
  expect(parseUrlState('?t=abc').world).toBe(false);
});

test('parses solo, for measurement captures', () => {
  expect(parseUrlState('?world&stage=techFocus&tech=kali&solo')).toMatchObject({ world: true, stage: 'techFocus', tech: 'kali', solo: true });
  expect(parseUrlState('?world').solo).toBe(false);
});

test('parses the palette candidate and ignores other palettes', () => {
  expect(parseUrlState('?world&palette=candidate').palette).toBe('candidate');
  for (const other of ['', '?palette', '?palette=approved', '?palette=Candidate']) expect(parseUrlState(other).palette, other).toBeUndefined();
});
