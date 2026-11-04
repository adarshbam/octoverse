/**
 * The boot veil: index.html's first screen (the entrance's water, "OCTOVERSE" and "Security Lab" for Nox, a neutral one for any other world, a
 * quiet loading cue), up from the first paint, before any script runs. It sits under the stage, never
 * takes a press or focus, and keeps the canvas clear until the world is drawn; hiding it fades the
 * canvas in over it (600 ms, in index.html's CSS) and then removes the node (once the stage has
 * drawn a frame, so the bare page never shows).
 *
 * While it is up the entrance's clock holds (`bootVeilHeld`), so the swim plays from its first
 * second on screen, not under the dark while the world's files load.
 */

export const BOOT_VEIL_ID = 'boot-veil';
/** How long the canvas takes to fade in over the veil (index.html's CSS has the same figure). */
export const BOOT_VEIL_FADE_MS = 600;

/** The slice of the document the veil needs (so a test can stand one in). */
export interface VeilDocument {
  getElementById(id: string): VeilNode | null;
}
export interface VeilNode {
  classList: { add(name: string): void; contains(name: string): boolean };
  remove(): void;
}

/** The world is ready (or the veil gave up waiting): the entrance's clock may run. */
let released = false;
/** The stage has drawn a frame (or has no canvas to draw): the veil may go without showing the page's bare background. */
let drawn = false;
/** A veil whose fade is over but whose stage has not drawn yet. */
let waiting: VeilNode | null = null;
let failsafe: ReturnType<typeof setTimeout> | undefined;

const defaultDocument = (): VeilDocument | null => (typeof document === 'undefined' ? null : document);

/**
 * Whether the entrance's clock holds: the veil is on the page and the world is not ready. A page
 * without the veil (a test harness, the review page) never holds.
 */
export function bootVeilHeld(doc: VeilDocument | null = defaultDocument()): boolean {
  return !released && !!doc?.getElementById(BOOT_VEIL_ID);
}

/**
 * Takes the veil away: the canvas fades in over it and the node goes after the fade, or at once
 * (`immediate`, for stills and pages with no entrance). Safe to call again.
 */
export function hideBootVeil({ immediate = false, doc = defaultDocument() }: { immediate?: boolean; doc?: VeilDocument | null } = {}) {
  released = true;
  clearTimeout(failsafe);
  const node = doc?.getElementById(BOOT_VEIL_ID);
  if (!node) return;
  if (node.classList.contains('is-fading') || node.classList.contains('is-instant')) return;
  if (immediate) {
    node.classList.add('is-instant');
    removeWhenDrawn(node);
    return;
  }
  node.classList.add('is-fading');
  setTimeout(() => removeWhenDrawn(node), BOOT_VEIL_FADE_MS);
}

function removeWhenDrawn(node: VeilNode) {
  if (drawn) node.remove();
  else waiting = node;
}

/** The stage has drawn its first frame (or has no canvas): a veil that has finished fading goes now. */
export function noteStageDrawn() {
  drawn = true;
  waiting?.remove();
  waiting = null;
}

/** Hides the veil after `ms` whatever happens (a world that never settles must not keep the page under it); returns the way to cancel. */
export function armBootVeilFailsafe(ms: number, doc: VeilDocument | null = defaultDocument()) {
  clearTimeout(failsafe);
  failsafe = setTimeout(() => hideBootVeil({ doc }), ms);
  return () => clearTimeout(failsafe);
}

/** What the page does with the veil once its first render is in. */
export type VeilPlan = 'wait' | 'fade' | 'now';

/**
 * 'wait': the entrance will play, so the veil stays until the world is ready (the ready flag hides it).
 * 'now': a still, a page with no WebGL (the poster shows) or motion off, where nothing plays under
 * it, so it goes without a fade and a capture is the same on every run.
 * 'fade': the entrance was skipped or the page opens past it; the veil has no more to wait for.
 */
export function veilPlan({ webgl, entering, freeze, reducedMotion, mask }: { webgl: boolean; entering: boolean; freeze: boolean; reducedMotion: boolean; mask: boolean }): VeilPlan {
  if (!webgl || mask || freeze || reducedMotion) return 'now';
  return entering ? 'wait' : 'fade';
}

/** Puts the module back as a fresh page has it (for tests). */
export function resetBootVeil() {
  released = false;
  drawn = false;
  waiting = null;
  clearTimeout(failsafe);
  failsafe = undefined;
}
