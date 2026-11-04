import { afterEach, expect, test, vi } from 'vitest';
import { EXPRESSION_IDS } from './expressions';
import { defaultReviewOptions, parseUrlState } from './urlState';

test('parses stage, freeze and view', () => {
  expect(parseUrlState('?stage=overview&freeze&view=-1,0.5,1,-1.5')).toEqual({ stage: 'overview', freeze: true, orbit: false, noWebgl: false, solo: false, studio: false, view: [-1, 0.5, 1, -1.5] });
});

test('ignores unknown stages and malformed views', () => {
  expect(parseUrlState('?stage=nope&view=1,2')).toEqual({ freeze: false, orbit: false, noWebgl: false, solo: false, studio: false });
});

test('accepts every base expression id', () => {
  for (const id of EXPRESSION_IDS) expect(parseUrlState(`?expression=${id}`).expression).toBe(id);
});

test('parses expression', () => {
  expect(parseUrlState('?expression=focused').expression).toBe('focused');
  expect(parseUrlState('?expression=grumpy').expression).toBeUndefined();
});

test('parses tech, orbit and nowebgl flags', () => {
  expect(parseUrlState('?tech=kali&orbit&nowebgl')).toEqual({ tech: 'kali', freeze: false, orbit: true, noWebgl: true, solo: false, studio: false });
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

test('parses t, and ignores the retired world switch', () => {
  expect(parseUrlState('?world&t=4.8')).toMatchObject({ t: 4.8 });
  expect(parseUrlState('?world')).toEqual({ freeze: false, orbit: false, noWebgl: false, solo: false, studio: false });
  expect(parseUrlState('?stage=intro').t).toBeUndefined();
});

test('ignores a bad t', () => {
  for (const bad of ['?t=abc', '?t=', '?t=Infinity', '?t=NaN', '?t=1,2']) expect(parseUrlState(bad).t, bad).toBeUndefined();
});

test('parses solo, for measurement captures', () => {
  expect(parseUrlState('?stage=techFocus&tech=kali&solo')).toMatchObject({ stage: 'techFocus', tech: 'kali', solo: true });
  expect(parseUrlState('?stage=intro').solo).toBe(false);
});

test('parses a pinned camera hover and ignores a malformed one', () => {
  expect(parseUrlState('?hover=0.9,0.3,1.2').hover).toEqual([0.9, 0.3, 1.2]);
  expect(parseUrlState('?hover=-0.9,0,0').hover).toEqual([-0.9, 0, 0]);
  for (const bad of ['?hover=1,2', '?hover=a,b,c', '?hover=', '?hover=1,2,3,4']) expect(parseUrlState(bad).hover, bad).toBeUndefined();
});

test('parses a tilt override, clamps it to 0..0.7 and ignores a bad one', () => {
  expect(parseUrlState('?tilt=0.2').tilt).toBe(0.2);
  expect(parseUrlState('?tilt=0').tilt).toBe(0);
  expect(parseUrlState('?tilt=-1').tilt).toBe(0);
  expect(parseUrlState('?tilt=3').tilt).toBe(0.7);
  for (const bad of ['?tilt=abc', '?tilt=', '?tilt=NaN', '?tilt=Infinity', '?tilt=0.1,0.2']) expect(parseUrlState(bad).tilt, bad).toBeUndefined();
  expect(parseUrlState('').tilt).toBeUndefined();
});

test('parses yaw', () => {
  expect(parseUrlState('?yaw=180').yaw).toBe(180);
  expect(parseUrlState('?yaw=-45').yaw).toBe(-45);
  expect(parseUrlState('?yaw=0').yaw).toBe(0);
  for (const bad of ['?yaw=abc', '?yaw=', '?yaw=NaN', '?yaw=Infinity', '?yaw=1,2']) expect(parseUrlState(bad).yaw, bad).toBeUndefined();
  expect(parseUrlState('?stage=intro').yaw).toBeUndefined();
});

test('parses a swim pose for review stills and ignores unknown ones', () => {
  expect(parseUrlState('?pose=swim-open').pose).toBe('swim-open');
  expect(parseUrlState('?pose=swim-trail&yaw=35').pose).toBe('swim-trail');
  for (const bad of ['?pose=swim', '?pose=', '?pose=intro', '?stage=intro']) expect(parseUrlState(bad).pose, bad).toBeUndefined();
});

test('parses kitwait as a positive number of milliseconds', () => {
  expect(parseUrlState('?kitwait=2500').kitWait).toBe(2500);
  expect(parseUrlState('?kitwait=0').kitWait).toBeUndefined();
  expect(parseUrlState('?kitwait=-5').kitWait).toBeUndefined();
  expect(parseUrlState('?kitwait=soon').kitWait).toBeUndefined();
  expect(parseUrlState('').kitWait).toBeUndefined();
});

afterEach(() => vi.unstubAllEnvs());

test('a production build ignores every review switch', () => {
  vi.stubEnv('DEV', false);
  const off = parseUrlState('');
  expect(parseUrlState('?freeze&stage=detail&orbit&nowebgl&solo&mask&tech=kali&tier=low&variant=dummy&studio&view=1,2,3,4')).toEqual(off);
  expect(off).toEqual({ freeze: false, orbit: false, noWebgl: false, solo: false, studio: false });
});

test('parsing reads only the string it is given, never the page location', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Reflect.deleteProperty(globalThis, 'location');
  try {
    expect(typeof (globalThis as { location?: unknown }).location).toBe('undefined');
    expect(parseUrlState('?stage=intro&freeze&mask&blow=0.5&swell=0.4&hold=500')).toMatchObject({ stage: 'intro', freeze: true, mask: true, blow: 0.5, swell: 0.4, hold: 500 });
    expect(defaultReviewOptions()).toEqual(parseUrlState(''));
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had);
  }
});

test('the still switches (mask, blow, swell, hold) are read as the page used to', () => {
  expect(parseUrlState('?mask').mask).toBe(true);
  expect(parseUrlState('').mask).toBeUndefined();
  expect(parseUrlState('?blow=0.25').blow).toBe(0.25);
  // As before: a bare or unreadable value is 0, absent is undefined.
  expect(parseUrlState('?blow').blow).toBe(0);
  expect(parseUrlState('?swell=abc').swell).toBe(0);
  expect(parseUrlState('?stage=intro').hold).toBeUndefined();
});
