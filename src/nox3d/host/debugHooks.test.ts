import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { type DebugWindow, debugWindow, entranceDebug, markReady, reportWorld } from './debugHooks';
import { createInstanceState } from './instance';

let win: DebugWindow;
beforeEach(() => {
  win = {};
  vi.stubGlobal('window', win);
});
afterEach(() => vi.unstubAllGlobals());

test('the Nox page instance writes the new hook and both legacy names', () => {
  const nox = createInstanceState('nox', 'page');
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
  markReady(createInstanceState('nox', 'page'));
  expect(win.__noxEntrance).toBeUndefined();
  expect(win.__octoverse?.entrance).toBeUndefined();
});

test("another world's page instance writes only the new hook", () => {
  const veyra = createInstanceState('veyra', 'page');
  markReady(veyra);
  entranceDebug(veyra).loaded = true;
  expect(win.__octoverse).toEqual({ ready: true, entrance: { loaded: true, t: 0, spin: 0, settle: 0 } });
  expect(win.__noxReady).toBeUndefined();
  expect(win.__noxEntrance).toBeUndefined();
});

test('the page instance reports which of the world files really loaded', () => {
  reportWorld(createInstanceState('nox', 'page'), { kit: true, plate: false });
  expect(win.__noxWorld).toEqual({ kit: true, plate: false });
});

test('a preview instance writes nothing on the window', () => {
  const preview = createInstanceState('nox', 'preview');
  markReady(preview);
  reportWorld(preview, { kit: true, plate: true });
  entranceDebug(preview).loaded = true;
  expect(debugWindow(preview)).toBeNull();
  expect(win).toEqual({});
});
