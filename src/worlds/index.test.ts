import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BundleError, validateBundle } from '../engine/types/bundle';
import { DEFAULT_WORLD, WORLDS, resolveWorld } from './index';
import { FLUX_BUNDLE } from './flux/bundle';
import { NOX_BUNDLE } from './nox/bundle';
import { VEYRA_BUNDLE } from './veyra/bundle';

/** The ids of the worlds that ship: the registry's own keys. */
const SHIPPED_IDS = Object.keys(WORLDS);

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

// Beside the Nox cases because a world's own tests may not import the registry (boundary.test.ts: a world imports nothing from another world, and the registry imports them all).
test('?world=aether is Aether, with no warning', () => {
  const { bundle, warning } = resolveWorld('?world=aether');
  expect(bundle.id).toBe('aether');
  expect(bundle).toBe(WORLDS.aether);
  expect(warning).toBeUndefined();
});

test('?world=veyra is Veyra, with no warning', () => {
  const { bundle, warning } = resolveWorld('?world=veyra');
  expect(bundle).toBe(VEYRA_BUNDLE);
  expect(warning).toBeUndefined();
});

test('?world=flux is Flux, with no warning', () => {
  const { bundle, warning } = resolveWorld('?world=flux');
  expect(bundle).toBe(FLUX_BUNDLE);
  expect(bundle.id).toBe('flux');
  expect(warning).toBeUndefined();
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
  expect(Object.keys(WORLDS)).toEqual(['nox', 'veyra', 'flux', 'aether']);
  for (const [id, bundle] of Object.entries(WORLDS)) {
    expect(bundle.id).toBe(id);
    expect(() => validateBundle(bundle, SHIPPED_IDS), id).not.toThrow();
  }
  expect(WORLDS[DEFAULT_WORLD]).toBe(NOX_BUNDLE);
});

test('no shipped world takes the creator prefix, and validateBundle refuses a creator bundle that claims a shipped id', () => {
  expect(SHIPPED_IDS.filter(id => id.startsWith('u-'))).toEqual([]);
  // The rule works through the registry's ids: were one ever to carry the prefix, a bundle claiming it is refused.
  expect(() => validateBundle({ ...NOX_BUNDLE, id: 'u-nox' }, [...SHIPPED_IDS, 'u-nox'])).toThrow(BundleError);
  expect(() => validateBundle({ ...NOX_BUNDLE, id: 'u-nox' }, SHIPPED_IDS)).not.toThrow();
});

test("every shipped world's Theatre project id is its own: two worlds sharing a project would share one sheet store", () => {
  const projects = Object.values(WORLDS).map(bundle => bundle.sequences.projectId);
  expect(projects.every(id => typeof id === 'string' && id !== '')).toBe(true);
  expect(new Set(projects).size).toBe(projects.length);
});

test("every shipped world has its review reference: an image that exists, its registration, and a view box that frames it", () => {
  const root = join(import.meta.dirname, '..', '..');
  for (const id of SHIPPED_IDS) {
    const path = join(import.meta.dirname, id, 'review', 'world_reference.json');
    expect(existsSync(path), `${id}: ${path}`).toBe(true);
    const ref = JSON.parse(readFileSync(path, 'utf8')) as { image: string; origin: [number, number]; pxPerUnit: number; size: [number, number]; view: string };
    expect(existsSync(join(root, ref.image)), `${id}: ${ref.image}`).toBe(true);
    expect(ref.pxPerUnit).toBeGreaterThan(0);
    // The view box (left, top, right, bottom in world units) is the image's own corners under the registration.
    const [left, top, right, bottom] = ref.view.split(',').map(Number);
    const [ox, oy] = ref.origin;
    const [w, h] = ref.size;
    expect(left).toBeCloseTo(-ox / ref.pxPerUnit, 3);
    expect(top).toBeCloseTo(oy / ref.pxPerUnit, 3);
    expect(right).toBeCloseTo((w - ox) / ref.pxPerUnit, 3);
    expect(bottom).toBeCloseTo((oy - h) / ref.pxPerUnit, 3);
  }
});

test('the test world (development only) is a clone of Nox under its own id and page title, and only behind ?testworld=1', () => {
  expect(import.meta.env.DEV).toBe(true);
  expect(resolveWorld('?world=nox-b').warning).toContain('nox-b');
  const { bundle, warning } = resolveWorld('?testworld=1&world=nox-b');
  expect(warning).toBeUndefined();
  expect(bundle.id).toBe('nox-b');
  expect(bundle).not.toBe(NOX_BUNDLE);
  expect({ ...bundle, id: 'nox', theme: NOX_BUNDLE.theme }).toEqual(NOX_BUNDLE);
  expect(bundle.theme).toEqual({ ...NOX_BUNDLE.theme, pageTitle: 'OctoVerse test world' });
  expect(() => validateBundle(bundle)).not.toThrow();
  // The same object every time: the host keys its instance on the bundle.
  expect(resolveWorld('?testworld=1&world=nox-b').bundle).toBe(bundle);
  // It is not a shipped world.
  expect(Object.keys(WORLDS)).not.toContain('nox-b');
});

// Veyra's face beside Nox's (spec 7.3): her brows are thin dark arcs, thinner than his. Here, since
// a world's own tests may not import another world.
test("Veyra's brows are thinner than Nox's", () => {
  expect(VEYRA_BUNDLE.character.face.brow.thickness).toBeLessThan(NOX_BUNDLE.character.face.brow.thickness);
});
