import { expect, test } from 'vitest';
import type { StageId } from '../config/types';
import { type StageEvent, type StageState, initialStage, isRestful, stageReducer } from './stageMachine';

const known = new Set(['kali', 'burp', 'docker']);
const at = (stage: StageId, techId: string | null = null): StageState => ({ stage, techId });
const run = (state: StageState, ...events: StageEvent[]) => events.reduce((s, e) => stageReducer(s, e, known), state);

test('initial stage: a requested stage wins', () => {
  expect(initialStage({ entranceSeen: false, requested: 'detail', reducedMotion: false })).toEqual(at('detail'));
});

test('initial stage: first visit enters, a returning visit or reduced motion starts at the intro', () => {
  expect(initialStage({ entranceSeen: false, reducedMotion: false })).toEqual(at('entering'));
  expect(initialStage({ entranceSeen: true, reducedMotion: false })).toEqual(at('intro'));
  expect(initialStage({ entranceSeen: false, reducedMotion: true })).toEqual(at('intro'));
});

test('entering: ENTRANCE_DONE goes to the intro', () => {
  expect(run(at('entering'), { type: 'ENTRANCE_DONE' })).toEqual(at('intro'));
});

test('entering: SKIP goes to the intro', () => {
  expect(run(at('entering'), { type: 'SKIP' })).toEqual(at('intro'));
});

test('intro: OPEN_OVERVIEW goes to the overview', () => {
  expect(run(at('intro'), { type: 'OPEN_OVERVIEW' })).toEqual(at('overview'));
});

test('overview: FOCUS_TECH with a known id focuses it', () => {
  expect(run(at('overview'), { type: 'FOCUS_TECH', id: 'kali' })).toEqual(at('techFocus', 'kali'));
});

test('overview: OPEN_DETAIL goes to the detail', () => {
  expect(run(at('overview'), { type: 'OPEN_DETAIL' })).toEqual(at('detail'));
});

test('overview: CLOSE goes back to the intro', () => {
  expect(run(at('overview'), { type: 'CLOSE' })).toEqual(at('intro'));
});

test('techFocus: FOCUS_TECH with another known id moves the focus', () => {
  expect(run(at('techFocus', 'kali'), { type: 'FOCUS_TECH', id: 'burp' })).toEqual(at('techFocus', 'burp'));
});

test('techFocus: BLUR_TECH goes back to the overview', () => {
  expect(run(at('techFocus', 'kali'), { type: 'BLUR_TECH' })).toEqual(at('overview'));
});

test('techFocus: CLOSE goes back to the overview', () => {
  expect(run(at('techFocus', 'kali'), { type: 'CLOSE' })).toEqual(at('overview'));
});

test('techFocus: OPEN_DETAIL goes to the detail', () => {
  expect(run(at('techFocus', 'kali'), { type: 'OPEN_DETAIL' })).toEqual(at('detail'));
});

test('detail: CLOSE goes back to the overview', () => {
  expect(run(at('detail'), { type: 'CLOSE' })).toEqual(at('overview'));
});

test('anything else leaves the state unchanged', () => {
  const states = [at('entering'), at('intro'), at('overview'), at('techFocus', 'kali'), at('detail')];
  expect(run(states[0], { type: 'OPEN_OVERVIEW' }, { type: 'CLOSE' })).toBe(states[0]);
  expect(run(states[1], { type: 'CLOSE' }, { type: 'OPEN_DETAIL' }, { type: 'BLUR_TECH' })).toBe(states[1]);
  expect(run(states[4], { type: 'OPEN_DETAIL' }, { type: 'SKIP' })).toBe(states[4]);
});

test('unknown tech ids are ignored', () => {
  const overview = at('overview');
  expect(run(overview, { type: 'FOCUS_TECH', id: 'nope' })).toBe(overview);
  const focus = at('techFocus', 'kali');
  expect(run(focus, { type: 'FOCUS_TECH', id: 'nope' })).toBe(focus);
});

test('rapid sequence Explore, View Project, Escape ends in overview', () => {
  expect(run(at('intro'), { type: 'OPEN_OVERVIEW' }, { type: 'OPEN_DETAIL' }, { type: 'CLOSE' })).toEqual(at('overview'));
});

test('restful only after 40 s idle in intro with no panel open', () => {
  expect(isRestful('intro', 40000, false)).toBe(true);
  expect(isRestful('intro', 39999, false)).toBe(false);
  expect(isRestful('intro', 60000, true)).toBe(false);
  expect(isRestful('overview', 60000, false)).toBe(false);
});
