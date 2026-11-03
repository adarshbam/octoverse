import { expect, test, vi } from 'vitest';
import { noxProject } from '../content/noxProject';
import { noxTechnologies } from '../content/noxTechnologies';
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

test('two models and two sets of sheets share no object', () => {
  const [a, b] = [createProjectModel(noxProject, noxTechnologies), createProjectModel(noxProject, noxTechnologies)];
  expect(a.orbs).not.toBe(b.orbs);
  expect(a.tech).not.toBe(b.tech);
  const [s, t] = [createSheets({ blowAt: 0.5 }), createSheets()];
  expect(s.blow).not.toBe(t.blow);
  expect(s.blow.at).toBe(0.5);
  expect(t.blow.at).toBeUndefined();
  s.entrance.failed = true;
  expect(t.entrance.failed).toBe(false);
});

test('only the wanted sheets load; a call twice (StrictMode) and a second instance fill their own holders', async () => {
  const first = createSheets();
  startSheetLoaders(first, { entrance: false, blow: false, swell: false }, () => {})();
  expect(first.blow.sequences).toBeNull();

  const seen = vi.fn();
  const [a, b] = [createSheets(), createSheets()];
  const stop = startSheetLoaders(a, { entrance: true, blow: true, swell: false }, seen);
  stop(); // StrictMode's first cleanup: nothing may be filled for it
  const stopA = startSheetLoaders(a, { entrance: true, blow: true, swell: false }, seen);
  const stopB = startSheetLoaders(b, { entrance: false, blow: false, swell: true }, seen);
  await vi.waitFor(() => expect(a.entrance.sequences).not.toBeNull(), { timeout: 20_000 });
  await vi.waitFor(() => expect(b.swell.sequences).not.toBeNull(), { timeout: 20_000 });
  expect(a.blow.sequences).toBe(a.entrance.sequences);
  expect(a.swell.sequences).toBeNull();
  expect(b.entrance.sequences).toBeNull();
  expect(seen).toHaveBeenCalledTimes(1);
  stopA();
  stopB();
}, 30_000);
