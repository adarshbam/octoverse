import type { HostProps } from '../../engine/host/WorldHost';
import type { ShowcaseProfile } from '../fixtures/showcase';
import type { Route, View } from '../router/routes';

// A world visit's history (platform spec 7.9), as pure functions: which stage changes make an entry, what Back and Forward ask the
// engine for, and where the world's exit control goes. WorldPage.tsx wires them to the router and the host.

/** A stage as the engine reports it (`onStageChange`). */
export type StageId = Parameters<NonNullable<HostProps['onStageChange']>>[0];

/** The stages that are a view (an address of their own); the order is how far into the world each is. */
const DEPTH: Record<View, number> = { intro: 0, overview: 1, detail: 2 };

/**
 * What a stage change does to the history. The overview and the detail are `?view=` entries, each pushed once; the entrance, the
 * intro and a technology focus are never in the address. The engine's own Escape (the detail closing to the overview, the overview
 * to the intro) pushes nothing either: "Escape inside a world is the engine's and never changes the platform route" (spec 7.9).
 * `current` is the view the address shows now. Null: leave the history alone.
 */
export function worldHistoryStep(current: { view: View }, next: StageId): { push?: View } | null {
  if (next !== 'overview' && next !== 'detail') return null;
  return DEPTH[next] > DEPTH[current.view] ? { push: next } : null;
}

/** A browser Back or Forward landed on this view: the stage request that takes the engine there (a new `id` is a new request). */
export function viewToRequest(view: View, id: number): { id: number; stage: View } {
  return { id, stage: view };
}

/**
 * What the platform knows of the engine's stage while it is steering it. The engine answers a stage request a render or two later
 * (seconds, while its world loads), so the stage it reports next may be the answer to a request, not the visitor's own move: pushed as
 * one it would write an entry the visitor never made, or after the route has moved on (a quick Back, Back, Back) a stage that is no
 * longer anyone's. `engine` is the view the engine last reported (or opened on); `pending` is that a report answering a request is due.
 */
export interface EngineSync {
  engine: View;
  pending: boolean;
}

/** A stage request for `view` was made. It is answered by a report only when it changes the stage (or when one is already due: the burst is waited out). */
export function requested(sync: EngineSync, view: View): EngineSync {
  return { engine: sync.engine, pending: sync.pending || view !== sync.engine };
}

/**
 * The engine reported `stage`. `echo` is true when the report answers a request (it is not the visitor's own move and the history must
 * not follow it). A technology focus is no view: it neither answers a request nor moves the engine, and the entrance is the intro.
 */
export function reported(sync: EngineSync, stage: StageId): { sync: EngineSync; echo: boolean } {
  if (stage === 'techFocus') return { sync, echo: false };
  const view: View = stage === 'entering' ? 'intro' : stage;
  return { sync: { engine: view, pending: false }, echo: sync.pending };
}

/** Where one Back from a view lands: the view before it in the world, or out of the world from its intro entry. */
export function routeAfterBack(view: View): View | 'leave' {
  return view === 'detail' ? 'overview' : view === 'overview' ? 'intro' : 'leave';
}

/**
 * The world's exit control (spec 7.9): "Back to <name>'s profile" when that profile opened the world, otherwise "Back to
 * OctoVerse" (Explore, the landing or no opener at all: a pasted link, a reload).
 */
export function exitFor(opener: Route | null, profile: ShowcaseProfile): { label: string; href: string } {
  if (opener?.name === 'profile' && opener.handle === profile.handle) return { label: `Back to ${profile.name}'s profile`, href: `/@${profile.handle}` };
  return { label: 'Back to OctoVerse', href: '/' };
}

/**
 * What pressing the exit control does: the same as Back when the entry before is the page it names (the world's own first entry,
 * entered from that page), otherwise it pushes the href (from the overview or detail the page is several entries back, and
 * going home is a move forward, not a rewind).
 */
export function exitMove(exit: { href: string }, entry: { opener?: string; depth?: number } | null): 'back' | 'push' {
  return entry !== null && (entry.depth ?? 0) === 0 && entry.opener === exit.href ? 'back' : 'push';
}
