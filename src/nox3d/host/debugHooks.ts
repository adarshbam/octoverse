import type { InstanceState } from './instance';

/** The entrance as the development build reports it, for the end-to-end tests. */
export interface EntranceDebug {
  loaded: boolean;
  t: number;
  spin: number;
  settle: number;
}

/** `window.__octoverse`: what the page instance reports about itself. */
export interface OctoverseDebug {
  ready: boolean;
  /** Created with the first report of the entrance (development builds only). */
  entrance?: EntranceDebug;
}

/** Whether the world's files really arrived (development builds only), as opposed to `ready`, which is also set once a wait was given up. */
export interface WorldLoaded {
  /** The full kit (kit.glb and the baked near.glb: level 0) loaded, and the world did not step down. */
  kit: boolean;
  /** Every layer of the far plate loaded (a world with no far plate has none to wait for: true). */
  plate: boolean;
}

/**
 * The globals the end-to-end specs and scripts/perf.mjs read. `__noxReady` and `__noxEntrance` are the
 * legacy names of `__octoverse.ready` and `.entrance`, kept for the Nox world. The rest are
 * development-build probes that keep their names until the specs move.
 */
export interface DebugWindow {
  __octoverse?: OctoverseDebug;
  __noxReady?: boolean;
  __noxEntrance?: EntranceDebug;
  __noxCamera?: unknown;
  __noxWorldTier?: unknown;
  __noxWorld?: WorldLoaded;
  __noxSwell?: object;
  __noxHold?: { techId: string; pull: number; release: number }[];
  __noxSetTier?: (tier: 'high' | 'medium' | 'low') => void;
}

/**
 * The window to write a debug hook on, or null: only the page instance reports. A preview shares
 * the page with it and would overwrite its numbers.
 */
export function debugWindow(instance: InstanceState): DebugWindow | null {
  return instance.mode === 'page' ? (window as unknown as DebugWindow) : null;
}

/** Reports which of the world's files really loaded: `window.__noxWorld` (the page instance only; the caller guards it with `import.meta.env.DEV`). */
export function reportWorld(instance: InstanceState, loaded: WorldLoaded) {
  const w = debugWindow(instance);
  if (w) w.__noxWorld = loaded;
}

/** The world is drawn and settled (the ready flag). */
export function markReady(instance: InstanceState) {
  const w = debugWindow(instance);
  if (!w) return;
  (w.__octoverse ??= { ready: false }).ready = true;
  if (instance.id === 'nox') w.__noxReady = true;
}

/**
 * The entrance's report, made on first use. A preview gets a throwaway object, so the code that
 * writes to it needs no check.
 */
export function entranceDebug(instance: InstanceState): EntranceDebug {
  const w = debugWindow(instance);
  if (!w) return { loaded: false, t: 0, spin: 0, settle: 0 };
  const root = (w.__octoverse ??= { ready: false });
  if (!root.entrance) {
    root.entrance = { loaded: false, t: 0, spin: 0, settle: 0 };
    if (instance.id === 'nox') w.__noxEntrance = root.entrance;
  }
  return root.entrance;
}
