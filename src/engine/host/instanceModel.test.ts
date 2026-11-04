import { expect, test, vi } from 'vitest';
import { noxProject } from '../../worlds/nox/content/noxProject';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { NOX_SEQUENCES, loadNoxSequences } from '../../worlds/nox/sequences/index';
import { pendantFixture } from '../artifacts/fixtures/pendant';
import { layoutPendants } from '../artifacts/pendant';
import { placementCapacity } from '../artifacts/strategies';
import type { Sequences } from '../sequences/theatre';
import { BUBBLE_COUNT, createProjectModel, createSheets, startSheetLoaders } from './instanceModel';

test('the project model puts the first technologies in bubbles and the rest in the tray, in the project order', () => {
  const model = createProjectModel(noxProject, noxTechnologies);
  const order = noxProject.primaryTechnologyIds ?? [];
  expect(model.order).toEqual(order);
  expect(model.orbs.map(o => o.techId)).toEqual(order.slice(0, BUBBLE_COUNT));
  expect(model.overflow).toEqual(order.slice(BUBBLE_COUNT));
  expect(model.orbs.every(o => o.name && o.iconKey)).toBe(true);
  expect(model.trayItem('nope')).toEqual({ techId: 'nope', name: 'nope', iconKey: 'nope' });
});

test('with unequal slot counts in the two stages every technology is placed in every stage or in the tray, none dropped', () => {
  const placement = pendantFixture();
  // 13 slots in the intro, 12 in the overview; 13 technologies.
  placement.slots.intro = [...placement.slots.intro, { arm: 'T5', at: 0.5, order: 12 }];
  expect([placement.slots.intro.length, placement.slots.overview.length]).toEqual([13, 12]);
  const ids = Array.from({ length: 13 }, (_, i) => `tech-${i}`);
  const model = createProjectModel({ ...noxProject, primaryTechnologyIds: ids }, noxTechnologies, placementCapacity(placement));
  expect([...model.orbs.map(o => o.techId), ...model.overflow]).toEqual(ids);
  for (const stage of ['intro', 'overview'] as const) {
    const places = layoutPendants(model.orbs.length, placement, stage);
    expect(places.every(place => place !== null), `${stage}: every orb has a place`).toBe(true);
  }
  expect(model.overflow).toEqual(['tech-12']);
});

test('two models and two sets of sheets share no object', () => {
  const [a, b] = [createProjectModel(noxProject, noxTechnologies), createProjectModel(noxProject, noxTechnologies)];
  expect(a.orbs).not.toBe(b.orbs);
  expect(a.tech).not.toBe(b.tech);
  const [s, t] = [createSheets(NOX_SEQUENCES, { blowAt: 0.5 }), createSheets(NOX_SEQUENCES)];
  expect(s.blow).not.toBe(t.blow);
  expect(s.blow.at).toBe(0.5);
  expect(t.blow.at).toBeUndefined();
  s.entrance.failed = true;
  expect(t.entrance.failed).toBe(false);
});

test('only the wanted sheets load; a call twice (StrictMode) and a second instance fill their own holders', async () => {
  const first = createSheets(NOX_SEQUENCES);
  startSheetLoaders(first, { entrance: false, blow: false, swell: false }, loadNoxSequences, () => {})();
  expect(first.blow.sequences).toBeNull();

  const seen = vi.fn();
  const [a, b] = [createSheets(NOX_SEQUENCES), createSheets(NOX_SEQUENCES)];
  const stop = startSheetLoaders(a, { entrance: true, blow: true, swell: false }, loadNoxSequences, seen);
  stop(); // StrictMode's first cleanup: nothing may be filled for it
  const stopA = startSheetLoaders(a, { entrance: true, blow: true, swell: false }, loadNoxSequences, seen);
  const stopB = startSheetLoaders(b, { entrance: false, blow: false, swell: true }, loadNoxSequences, seen);
  await vi.waitFor(() => expect(a.entrance.sequences).not.toBeNull(), { timeout: 20_000 });
  await vi.waitFor(() => expect(b.swell.sequences).not.toBeNull(), { timeout: 20_000 });
  expect(a.blow.sequences).toBe(a.entrance.sequences);
  expect(a.swell.sequences).toBeNull();
  expect(b.entrance.sequences).toBeNull();
  expect(seen).toHaveBeenCalledTimes(1);
  stopA();
  stopB();
}, 30_000);

test("the sheets are the world's: the swell runs for its set's sheet length, and the loader given is the one used", async () => {
  const set = { defaults: { ...NOX_SEQUENCES.defaults, headSwell: { ...NOX_SEQUENCES.defaults.headSwell!, length: 3 } } };
  expect(createSheets(set).swell.seconds).toBe(3);
  expect(createSheets(NOX_SEQUENCES).swell.seconds).toBe(NOX_SEQUENCES.defaults.headSwell!.length);
  expect(() => createSheets({ defaults: {} })).toThrow(/headSwell/);
  const fake = {} as Sequences;
  const load = vi.fn(() => Promise.resolve(fake));
  const sheets = createSheets(set);
  const stop = startSheetLoaders(sheets, { entrance: true, blow: true, swell: true }, load, () => {});
  await vi.waitFor(() => expect(sheets.swell.sequences).toBe(fake));
  expect(sheets.entrance.sequences).toBe(fake);
  expect(sheets.blow.sequences).toBe(fake);
  expect(load).toHaveBeenCalledTimes(3);
  stop();
});
