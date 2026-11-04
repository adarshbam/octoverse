import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOT_VEIL_FADE_MS, BOOT_VEIL_ID, type VeilDocument, armBootVeilFailsafe, bootVeilHeld, hideBootVeil, noteStageDrawn, resetBootVeil, veilPlan } from './bootVeil';

/** A stand-in page holding the veil (or not). */
function page(withVeil = true) {
  const classes = new Set<string>();
  const state = { present: withVeil, removed: 0 };
  const node = {
    classList: { add: (name: string) => void classes.add(name), contains: (name: string) => classes.has(name) },
    remove: () => {
      state.present = false;
      state.removed++;
    },
  };
  const doc: VeilDocument = { getElementById: id => (id === BOOT_VEIL_ID && state.present ? node : null) };
  return { doc, classes, state };
}

beforeEach(() => {
  vi.useFakeTimers();
  resetBootVeil();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the entrance clock hold', () => {
  it('holds while the veil is up and the world is not ready', () => {
    const { doc } = page();
    expect(bootVeilHeld(doc)).toBe(true);
  });

  it('lets go the moment the veil is told to hide, and stays let go', () => {
    const { doc } = page();
    hideBootVeil({ doc });
    expect(bootVeilHeld(doc)).toBe(false);
    hideBootVeil({ doc });
    expect(bootVeilHeld(doc)).toBe(false);
  });

  it('never holds a page that has no veil', () => {
    expect(bootVeilHeld(page(false).doc)).toBe(false);
    expect(bootVeilHeld(null)).toBe(false);
  });
});

describe('hiding the veil', () => {
  it('fades for 600 ms, then removes the node once the stage has drawn', () => {
    const { doc, classes, state } = page();
    noteStageDrawn();
    hideBootVeil({ doc });
    expect(classes.has('is-fading')).toBe(true);
    vi.advanceTimersByTime(BOOT_VEIL_FADE_MS - 1);
    expect(state.present).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.present).toBe(false);
  });

  it('keeps a faded veil until the stage has drawn a frame, then removes it', () => {
    const { doc, state } = page();
    hideBootVeil({ doc });
    vi.advanceTimersByTime(BOOT_VEIL_FADE_MS * 3);
    expect(state.present).toBe(true);
    noteStageDrawn();
    expect(state.present).toBe(false);
  });

  it('removes at once, without a fade, when asked (stills, no WebGL), once the stage has drawn', () => {
    const { doc, classes, state } = page();
    noteStageDrawn();
    hideBootVeil({ doc, immediate: true });
    expect(state.present).toBe(false);
    expect(classes.has('is-fading')).toBe(false);
  });

  it('removes the node once only, however often it is told', () => {
    const { doc, state } = page();
    noteStageDrawn();
    hideBootVeil({ doc });
    hideBootVeil({ doc });
    hideBootVeil({ doc, immediate: true });
    vi.advanceTimersByTime(BOOT_VEIL_FADE_MS * 2);
    expect(state.removed).toBe(1);
  });

  it('copes with a page that has no veil', () => {
    expect(() => hideBootVeil({ doc: page(false).doc })).not.toThrow();
    expect(() => hideBootVeil({ doc: null })).not.toThrow();
  });
});

describe('the failsafe', () => {
  it('hides the veil when the time is up, and the ready path cancels it', () => {
    const a = page();
    armBootVeilFailsafe(1000, a.doc);
    vi.advanceTimersByTime(999);
    expect(a.classes.has('is-fading')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(a.classes.has('is-fading')).toBe(true);
    expect(bootVeilHeld(a.doc)).toBe(false);

    resetBootVeil();
    const b = page();
    armBootVeilFailsafe(1000, b.doc);
    hideBootVeil({ doc: b.doc });
    const fading = b.classes.has('is-fading');
    expect(fading).toBe(true);
    b.classes.clear();
    vi.advanceTimersByTime(5000);
    expect(b.classes.has('is-fading')).toBe(false);
  });

  it('can be cancelled', () => {
    const { doc, classes } = page();
    const cancel = armBootVeilFailsafe(1000, doc);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(classes.has('is-fading')).toBe(false);
  });
});

describe('what the page does with the veil at its first render', () => {
  const base = { webgl: true, entering: true, freeze: false, reducedMotion: false, mask: false };
  it('waits for the world when the entrance will play', () => {
    expect(veilPlan(base)).toBe('wait');
  });
  it('fades at once when the page is past the entrance or it was skipped', () => {
    expect(veilPlan({ ...base, entering: false })).toBe('fade');
  });
  it('goes now for stills, motion off, no WebGL and the mask page', () => {
    expect(veilPlan({ ...base, freeze: true })).toBe('now');
    expect(veilPlan({ ...base, reducedMotion: true })).toBe('now');
    expect(veilPlan({ ...base, webgl: false })).toBe('now');
    expect(veilPlan({ ...base, mask: true })).toBe('now');
    expect(veilPlan({ ...base, entering: false, freeze: true })).toBe('now');
  });
});

// index.html's inline script gives a page that will not show Nox a neutral veil and title (spec 8.3 and the
// platform's boot rule: no Nox words or flame for another world). It runs here against a stand-in document.
describe('the boot script of the page', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];

  function boot(search: string) {
    const attributes: Record<string, string> = {};
    const listeners: (() => void)[] = [];
    let titleRemoved = false;
    const document = {
      title: 'Nox · Security Lab',
      documentElement: { setAttribute: (name: string, value: string) => void (attributes[name] = value) },
      addEventListener: (_type: string, listener: () => void) => void listeners.push(listener),
      querySelector: (selector: string) => (selector === '#boot-veil .bv-title' ? { remove: () => void (titleRemoved = true) } : null),
    };
    new Function('document', 'location', script)(document, { search });
    listeners.forEach(listener => listener());
    return { attributes, title: document.title, titleRemoved };
  }

  it('leaves the page as it is for Nox: no ?world=, an empty one, or nox', () => {
    for (const search of ['', '?stage=intro', '?world=', '?world=nox', '?x=1&world=nox']) {
      expect(boot(search), search).toEqual({ attributes: {}, title: 'Nox · Security Lab', titleRemoved: false });
    }
  });

  it('makes the veil and the title neutral for any other world', () => {
    for (const search of ['?world=veyra', '?world=nox-b&testworld=1', '?world=NOX', '?world=nope']) {
      expect(boot(search), search).toEqual({ attributes: { 'data-boot-world': 'other' }, title: 'OctoVerse', titleRemoved: true });
    }
  });

  it('carries no Nox word in the neutral rules, and the default veil still has its title and flame', () => {
    const neutral = [...html.matchAll(/html\[data-boot-world='other'\][^{]*\{[^}]*\}/g)].map(m => m[0]).join(' ');
    expect(neutral).not.toMatch(/#071535|#ff|Security Lab/i);
    expect(html).toContain('<span>Security Lab</span>');
    expect(html).toContain('bv-flame');
    expect(html).toContain('<title>Nox · Security Lab</title>');
  });
});
