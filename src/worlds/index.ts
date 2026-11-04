import type { WorldBundle, WorldId } from '../engine/types/bundle';
import { NOX_BUNDLE } from './nox/bundle';
import { HOST_BUNDLE } from './octoverse/bundle';
import { VEYRA_BUNDLE } from './veyra/bundle';

// The worlds that ship, by id, and how a page address picks one (`?world=<id>`, spec 8.3). The
// engine never imports this file: the page (src/app/main.tsx) reads the address once, resolves a
// bundle here and hands it to the host.

/** The world a page shows when the address names none, or one that is not here. */
export const DEFAULT_WORLD = 'nox';

/** The bundles of the worlds that ship with the engine, by id. The engine's own list of shipped ids (`WORLDS` in engine/types/bundle.ts) must name exactly these. */
export const WORLDS: Record<WorldId, WorldBundle> = { nox: NOX_BUNDLE, veyra: VEYRA_BUNDLE, octoverse: HOST_BUNDLE };

/**
 * Development only: a second world for the world-switch spec (`?testworld=1`), Nox's bundle cloned
 * under another id (so it has its own entrance flag, `octoverse.nox-b.entranceSeen`) and its own
 * page title (so a spec can tell it from Nox's). The literal
 * DEV check lets the bundler drop it from the production build; a stable object, since the host
 * keys its instance on the bundle (`instanceKey`).
 */
const TEST_WORLDS: Record<WorldId, WorldBundle> = import.meta.env.DEV ? { 'nox-b': { ...NOX_BUNDLE, id: 'nox-b', theme: { ...NOX_BUNDLE.theme, pageTitle: 'OctoVerse test world' } } } : {};

/**
 * The world an address asks for: `?world=<id>`. No `world` (or an empty one) is the default world;
 * an id that is not a world here falls back to it with a `warning` that names the id (a visitor
 * following an old or mistyped link gets a world, never a blank page). `?world=` is a feature of
 * the page, so the production build honours it too; only the test world (`?testworld=1`) is
 * development-only.
 */
export function resolveWorld(search: string): { bundle: WorldBundle; warning?: string } {
  const params = new URLSearchParams(search);
  const known = import.meta.env.DEV && params.get('testworld') === '1' ? { ...WORLDS, ...TEST_WORLDS } : WORLDS;
  const id = params.get('world');
  if (id === null || id === '') return { bundle: WORLDS[DEFAULT_WORLD] };
  if (Object.hasOwn(known, id)) return { bundle: known[id] };
  return { bundle: WORLDS[DEFAULT_WORLD], warning: `Unknown world "${id}": showing "${DEFAULT_WORLD}" instead (the worlds are ${Object.keys(known).join(', ')}).` };
}
