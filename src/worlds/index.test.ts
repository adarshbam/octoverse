import { expect, test } from 'vitest';
import { WORLDS as SHIPPED_IDS } from '../engine/types/bundle';
import { validateBundle } from '../engine/types/bundle';
import { DEFAULT_WORLD, WORLDS, resolveWorld } from './index';
import { NOX_BUNDLE } from './nox/bundle';

test('no world, or an empty one, is Nox, with no warning', () => {
  for (const search of ['', '?', '?world=', '?stage=intro&freeze']) {
    const { bundle, warning } = resolveWorld(search);
    expect(bundle, search).toBe(NOX_BUNDLE);
    expect(warning, search).toBeUndefined();
  }
});

test('?world=nox is Nox', () => {
  const { bundle, warning } = resolveWorld('?world=nox');
  expect(bundle).toBe(NOX_BUNDLE);
  expect(warning).toBeUndefined();
  expect(resolveWorld('?stage=intro&world=nox&freeze').bundle).toBe(NOX_BUNDLE);
});

test('an unknown world falls back to Nox with a warning that names it', () => {
  const { bundle, warning } = resolveWorld('?world=nope');
  expect(bundle).toBe(NOX_BUNDLE);
  expect(warning).toContain('nope');
  // Ids that name something on the object, not a world, are unknown too.
  for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const result = resolveWorld(`?world=${id}`);
    expect(result.bundle, id).toBe(NOX_BUNDLE);
    expect(result.warning, id).toContain(id);
  }
});

test('the registry holds exactly the shipped worlds, each valid and under its own id', () => {
  expect(Object.keys(WORLDS).sort()).toEqual([...SHIPPED_IDS].sort());
  expect(Object.keys(WORLDS)).toEqual(['nox']);
  for (const [id, bundle] of Object.entries(WORLDS)) {
    expect(bundle.id).toBe(id);
    expect(() => validateBundle(bundle), id).not.toThrow();
  }
  expect(WORLDS[DEFAULT_WORLD]).toBe(NOX_BUNDLE);
});

test('the test world (development only) is a clone of Nox under its own id, and only behind ?testworld=1', () => {
  expect(import.meta.env.DEV).toBe(true);
  expect(resolveWorld('?world=nox-b').warning).toContain('nox-b');
  const { bundle, warning } = resolveWorld('?testworld=1&world=nox-b');
  expect(warning).toBeUndefined();
  expect(bundle.id).toBe('nox-b');
  expect(bundle).not.toBe(NOX_BUNDLE);
  expect({ ...bundle, id: 'nox' }).toEqual(NOX_BUNDLE);
  expect(() => validateBundle(bundle)).not.toThrow();
  // The same object every time: the host keys its instance on the bundle.
  expect(resolveWorld('?testworld=1&world=nox-b').bundle).toBe(bundle);
  // It is not a shipped world.
  expect(Object.keys(WORLDS)).not.toContain('nox-b');
});
