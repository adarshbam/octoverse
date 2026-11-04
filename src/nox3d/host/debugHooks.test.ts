import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { type DebugWindow, debugWindow, entranceDebug, markReady, report, reportNew, reportObject, reportWorld, unreport } from './debugHooks';
import { createInstanceState } from './instance';
import { NOX_BUNDLE } from '../bundle.nox';

/** A world with this id: Nox's data under another name (the instance reads only the id and mode here). */
const world = (id: string) => ({ ...NOX_BUNDLE, id });

let win: DebugWindow;
beforeEach(() => {
  win = {};
  vi.stubGlobal('window', win);
});
afterEach(() => vi.unstubAllGlobals());

test('the Nox page instance writes the new hook and both legacy names', () => {
  const nox = createInstanceState(world('nox'), 'page');
  expect(win.__noxReady).toBeUndefined();
  markReady(nox);
  expect(win.__octoverse?.ready).toBe(true);
  expect(win.__noxReady).toBe(true);
  const report = entranceDebug(nox);
  expect(report).toEqual({ loaded: false, t: 0, spin: 0, settle: 0 });
  expect(win.__noxEntrance).toBe(report);
  expect(win.__octoverse?.entrance).toBe(report);
  expect(entranceDebug(nox)).toBe(report);
});

test('the entrance report does not exist until it is first asked for, as __noxEntrance did not', () => {
  markReady(createInstanceState(world('nox'), 'page'));
  expect(win.__noxEntrance).toBeUndefined();
  expect(win.__octoverse?.entrance).toBeUndefined();
});

test("another world's page instance writes only the new hook", () => {
  const veyra = createInstanceState(world('veyra'), 'page');
  markReady(veyra);
  entranceDebug(veyra).loaded = true;
  expect(win.__octoverse).toEqual({ ready: true, entrance: { loaded: true, t: 0, spin: 0, settle: 0 } });
  expect(win.__noxReady).toBeUndefined();
  expect(win.__noxEntrance).toBeUndefined();
});

test('the page instance reports which of the world files really loaded', () => {
  reportWorld(createInstanceState(world('nox'), 'page'), { kit: true, plate: false });
  expect(win.__noxWorld).toEqual({ kit: true, plate: false });
});

test('a preview instance writes nothing on the window', () => {
  const preview = createInstanceState(world('nox'), 'preview');
  markReady(preview);
  reportWorld(preview, { kit: true, plate: true });
  entranceDebug(preview).loaded = true;
  expect(debugWindow(preview)).toBeNull();
  expect(win).toEqual({});
});

/** Every probe with a legacy name, and that name (the end-to-end specs and scripts read them). */
const LEGACY_NAMES = {
  ready: '__noxReady',
  entrance: '__noxEntrance',
  camera: '__noxCamera',
  worldTier: '__noxWorldTier',
  world: '__noxWorld',
  swell: '__noxSwell',
  hold: '__noxHold',
  setTier: '__noxSetTier',
} as const;

test('every probe the Nox page writes goes under __octoverse and its legacy __nox* name, the same value', () => {
  const nox = createInstanceState(world('nox'), 'page');
  for (const [key, legacy] of Object.entries(LEGACY_NAMES) as [keyof typeof LEGACY_NAMES, string][]) {
    const value = key === 'ready' ? true : key === 'setTier' ? () => {} : key === 'hold' ? [] : { probe: key };
    report(nox, key, value as never);
    expect(win.__octoverse?.[key], key).toBe(value);
    expect((win as Record<string, unknown>)[legacy], legacy).toBe(value);
  }
});

test("another world's page writes every probe under __octoverse only", () => {
  const veyra = createInstanceState(world('veyra'), 'page');
  for (const key of Object.keys(LEGACY_NAMES) as (keyof typeof LEGACY_NAMES)[]) report(veyra, key, (key === 'ready' ? true : { probe: key }) as never);
  expect(Object.keys(win)).toEqual(['__octoverse']);
  expect(Object.keys(win.__octoverse ?? {}).sort()).toEqual(Object.keys(LEGACY_NAMES).sort());
});

test('a probe with no legacy name (the sequence loader) is written under __octoverse alone, for Nox too', () => {
  const nox = createInstanceState(world('nox'), 'page');
  const load = () => Promise.resolve(null);
  reportNew(nox, 'sequences', load);
  expect(win.__octoverse?.sequences).toBe(load);
  expect(Object.keys(win)).toEqual(['__octoverse']);
});

test('unreport removes a probe and its legacy name; a probe object is made once and kept', () => {
  const nox = createInstanceState(world('nox'), 'page');
  const tier = () => {};
  report(nox, 'setTier', tier);
  unreport(nox, 'setTier');
  expect(win.__octoverse?.setTier).toBeUndefined();
  expect(win.__noxSetTier).toBeUndefined();
  const swell = reportObject(nox, 'swell', () => ({ n: 1 }));
  expect(reportObject(nox, 'swell', () => ({ n: 2 }))).toBe(swell);
  expect(win.__noxSwell).toBe(swell);
  // A preview gets a throwaway object and writes nothing.
  const preview = createInstanceState(world('nox'), 'preview');
  expect(reportObject(preview, 'swell', () => ({ n: 3 }))).toEqual({ n: 3 });
  expect(win.__octoverse?.swell).toBe(swell);
});
