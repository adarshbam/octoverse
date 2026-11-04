import type { InstanceState } from './instance';

/** The entrance as the development build reports it, for the end-to-end tests. */
export interface EntranceDebug {
  loaded: boolean;
  t: number;
  spin: number;
  settle: number;
}

/** Whether the world's files really arrived (development builds only), as opposed to `ready`, which is also set once a wait was given up. */
export interface WorldLoaded {
  /**
   * The world's full kit loaded and the world did not step down: its level 0, in full (the kit and,
   * when the world has one, its baked near world, `place.near`; a world without one has only the kit).
   */
  kit: boolean;
  /** Every layer of the far plate loaded (a world with no far plate has none to wait for: true). */
  plate: boolean;
}

/** One suction hold as the development build reports it. */
export interface HoldDebug {
  techId: string;
  pull: number;
  release: number;
}

/**
 * `window.__octoverse`: what the page instance reports about itself, whatever its world. `ready` is
 * the ready flag (the world drawn and settled); the rest are development-build probes, each made on
 * first report.
 */
export interface OctoverseDebug {
  ready: boolean;
  /** The entrance's clock and beats (created with its first report). */
  entrance?: EntranceDebug;
  /** The stage camera: place, facing, field of view, lens shift and the hover drift. */
  camera?: unknown;
  /** The world tier's settings in use. */
  worldTier?: unknown;
  /** Which of the world's files really loaded. */
  world?: WorldLoaded;
  /** The head swell's state (one object, written in place each frame). */
  swell?: object;
  /** The suction holds in progress. */
  hold?: HoldDebug[];
  /** Forces a quality tier (the frame probe's step, on demand). */
  setTier?: (tier: 'high' | 'medium' | 'low') => void;
  /** Loads the world's sequences (the page's own loader: the capture scripts wait on it). */
  sequences?: () => Promise<unknown>;
}

/** The probes the Nox world also writes under their legacy `__nox*` names, which the end-to-end specs and scripts read. */
const LEGACY = {
  ready: '__noxReady',
  entrance: '__noxEntrance',
  camera: '__noxCamera',
  worldTier: '__noxWorldTier',
  world: '__noxWorld',
  swell: '__noxSwell',
  hold: '__noxHold',
  setTier: '__noxSetTier',
} as const satisfies Partial<Record<keyof OctoverseDebug, `__nox${string}`>>;

type Legacy = { -readonly [K in keyof typeof LEGACY as (typeof LEGACY)[K]]?: OctoverseDebug[K] };

/**
 * The globals the end-to-end specs and scripts/perf.mjs read. `window.__octoverse` is written for
 * the page instance of any world. The `__nox*` names are the legacy names of the same values,
 * written only for the Nox world (spec 8.2), so the specs pass unchanged; they move to the new
 * names in their own change.
 */
export type DebugWindow = { __octoverse?: OctoverseDebug } & Legacy;

/**
 * The window to write a debug hook on, or null: only the page instance reports. A preview shares
 * the page with it and would overwrite its numbers.
 */
export function debugWindow(instance: InstanceState): DebugWindow | null {
  return instance.mode === 'page' ? (window as unknown as DebugWindow) : null;
}

/** The page instance's report object (`window.__octoverse`), made on first use; null for a preview. */
function rootOf(instance: InstanceState): { w: DebugWindow; root: OctoverseDebug } | null {
  const w = debugWindow(instance);
  return w ? { w, root: (w.__octoverse ??= { ready: false }) } : null;
}

/**
 * Writes probe `key` for the page instance: `window.__octoverse[key]`, and for the Nox world its
 * legacy `__nox*` name too (the same value). A preview writes nothing.
 */
export function report<K extends keyof typeof LEGACY>(instance: InstanceState, key: K, value: OctoverseDebug[K]) {
  const at = rootOf(instance);
  if (!at) return;
  at.root[key] = value;
  if (instance.id === 'nox') (at.w as Record<string, unknown>)[LEGACY[key]] = value;
}

/** Writes a probe that has no legacy name (`window.__octoverse[key]` only). */
export function reportNew<K extends Exclude<keyof OctoverseDebug, keyof typeof LEGACY>>(instance: InstanceState, key: K, value: OctoverseDebug[K]) {
  const at = rootOf(instance);
  if (at) at.root[key] = value;
}

/** Removes probe `key` (and its legacy name): the instance that wrote it is gone. */
export function unreport(instance: InstanceState, key: keyof typeof LEGACY | Exclude<keyof OctoverseDebug, 'ready'>) {
  const w = debugWindow(instance);
  if (!w) return;
  if (w.__octoverse) delete w.__octoverse[key];
  if (instance.id === 'nox' && key in LEGACY) delete (w as Record<string, unknown>)[LEGACY[key as keyof typeof LEGACY]];
}

/**
 * Probe `key`'s object for the page instance, made with `make` on first use and kept, so a caller
 * can write into it each frame without allocating; a preview gets a throwaway one.
 */
export function reportObject<K extends 'swell' | 'entrance'>(instance: InstanceState, key: K, make: () => NonNullable<OctoverseDebug[K]>): NonNullable<OctoverseDebug[K]> {
  const at = rootOf(instance);
  if (!at) return make();
  const known = at.root[key];
  if (known) return known as NonNullable<OctoverseDebug[K]>;
  const made = make();
  report(instance, key, made);
  return made;
}

/** Reports which of the world's files really loaded: `window.__octoverse.world`, and `__noxWorld` for Nox (the page instance only; the caller guards it with `import.meta.env.DEV`). */
export function reportWorld(instance: InstanceState, loaded: WorldLoaded) {
  report(instance, 'world', loaded);
}

/** The world is drawn and settled (the ready flag): `window.__octoverse.ready`, and `__noxReady` for Nox. */
export function markReady(instance: InstanceState) {
  report(instance, 'ready', true);
}

/**
 * The entrance's report, made on first use. A preview gets a throwaway object, so the code that
 * writes to it needs no check.
 */
export function entranceDebug(instance: InstanceState): EntranceDebug {
  return reportObject(instance, 'entrance', () => ({ loaded: false, t: 0, spin: 0, settle: 0 }));
}
