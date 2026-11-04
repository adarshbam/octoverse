import { afterEach, expect, test, vi } from 'vitest';
import { attachWindowListeners } from './listeners';
import { NOX_SEQUENCES } from '../../nox3d/sequences/nox.sequences';
import { loadWorldSequences } from '../sequences/theatre';
import { createSheets, startSheetLoaders } from './instanceModel';

/** The world's loader, as the host passes it (host/WorldHost.tsx). */
const load = () => loadWorldSequences(NOX_SEQUENCES);

// The effect order React's StrictMode gives every mount in development: set up, clean up, set up
// again. The real page under StrictMode is tests/e2e/isolation.spec.ts (f); this is the same order
// run on the real units an instance's effects call (listeners, sheet loaders, the Theatre project).
// The id of every Theatre project made, in the order made (hoisted: the mock factory runs before the imports).
const made = vi.hoisted(() => [] as string[]);
vi.mock('@theatre/core', async importOriginal => {
  const real = await importOriginal<typeof import('@theatre/core')>();
  return { ...real, getProject: ((id: string, config: never) => (made.push(id), real.getProject(id, config))) as typeof real.getProject };
});

const live = new Map<string, Set<unknown>>();
vi.stubGlobal('window', {
  addEventListener: (type: string, listener: unknown) => (live.get(type) ?? live.set(type, new Set()).get(type)!).add(listener),
  removeEventListener: (type: string, listener: unknown) => live.get(type)?.delete(listener),
});
afterEach(() => live.clear());
// (Only the instance's own types: the runner puts its own error handlers on the window too.)
const listening = () => ['keydown', 'pointerdown'].reduce((sum, type) => sum + (live.get(type)?.size ?? 0), 0);

/** One mount as StrictMode runs it: the effects, their clean-ups, the effects again. Returns the final clean-up. */
function strictMount(effect: () => () => void): () => void {
  effect()();
  return effect();
}

test('a page instance mounted under StrictMode registers its listeners once and loads its sheets and project once', async () => {
  const entranceSeen = vi.fn();
  const sheets = createSheets(NOX_SEQUENCES);
  const wants = { entrance: true, blow: true, swell: true };
  const stop = strictMount(() => {
    const off = attachWindowListeners('page', ['keydown', 'pointerdown'], () => {});
    const stopSheets = startSheetLoaders(sheets, wants, load, entranceSeen);
    return () => {
      off();
      stopSheets();
    };
  });
  // Set up, cleaned up, set up: the listeners are on once each, not twice and not none.
  expect(listening()).toBe(2);
  await vi.waitFor(() => expect(sheets.entrance.sequences).not.toBeNull(), { timeout: 20_000 });
  await vi.waitFor(() => expect(sheets.swell.sequences).not.toBeNull(), { timeout: 20_000 });
  expect(sheets.blow.sequences).toBe(sheets.entrance.sequences);
  expect(sheets.entrance.failed || sheets.blow.failed || sheets.swell.failed).toBe(false);
  // The first mount's cleaned-up loader filled nothing; the second's filled each once.
  expect(entranceSeen).toHaveBeenCalledTimes(1);
  // One Theatre project: getProject throws on a second one with the same id, and was called once.
  expect(made).toEqual(['OctoVerse']);

  // Unmounted, nothing stays; mounted again (the page navigates back), one set, and no new project.
  stop();
  expect(listening()).toBe(0);
  const again = createSheets(NOX_SEQUENCES);
  const stopAgain = strictMount(() => {
    const off = attachWindowListeners('page', ['keydown', 'pointerdown'], () => {});
    const stopSheets = startSheetLoaders(again, wants, load, () => {});
    return () => {
      off();
      stopSheets();
    };
  });
  expect(listening()).toBe(2);
  await vi.waitFor(() => expect(again.entrance.sequences).toBe(sheets.entrance.sequences));
  expect(made).toEqual(['OctoVerse']);
  stopAgain();
  expect(listening()).toBe(0);
}, 30_000);

test('a preview mounted under StrictMode registers no listener and still loads its sheets through the one project', async () => {
  const sheets = createSheets(NOX_SEQUENCES);
  const stop = strictMount(() => {
    const off = attachWindowListeners('preview', ['keydown', 'pointerdown'], () => {});
    const stopSheets = startSheetLoaders(sheets, { entrance: false, blow: true, swell: true }, load, () => {});
    return () => {
      off();
      stopSheets();
    };
  });
  expect(listening()).toBe(0);
  await vi.waitFor(() => expect(sheets.blow.sequences).not.toBeNull(), { timeout: 20_000 });
  expect(made).toEqual(['OctoVerse']);
  stop();
}, 30_000);
