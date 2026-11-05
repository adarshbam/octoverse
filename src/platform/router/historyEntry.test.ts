import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESTORE_WAIT_MS, elementForFocusKey, entryState, focusKeyOf, insertOpener, navigate, restoreArrival, subscribe } from './history';

// What a history entry remembers (spec 7.9): where the page was scrolled and which control had focus (restored when Back lands on it),
// and which page opened the world it holds. Kept in `history.state.platform`, so it survives a reload and goes with the entry.

interface FakeLink {
  tagName: string;
  id: string;
  href: string;
  focused: boolean;
  /** `data-focus-id`, or null. */
  focusId: string | null;
  /** True while the control cannot take focus (inside an `inert` part of the page). */
  inert: boolean;
  focus: ReturnType<typeof vi.fn>;
  getAttribute: (name: string) => string | null;
}

function link(href: string, id = ''): FakeLink {
  const el: FakeLink = {
    tagName: 'A',
    id,
    href,
    focused: false,
    focusId: null,
    inert: false,
    focus: vi.fn(() => {
      if (el.inert) return;
      el.focused = true;
      doc.activeElement = el as unknown;
    }),
    getAttribute: (name: string) => (name === 'href' ? href : name === 'data-focus-id' ? el.focusId : null),
  };
  return el;
}

let doc: { activeElement: unknown; body: object; scroller: { scrollTop: number } | null; links: FakeLink[]; querySelector: (s: string) => unknown; querySelectorAll: (s: string) => FakeLink[] };

function installFakes(initial: string) {
  const listeners = new Map<string, Set<() => void>>();
  const loc = { pathname: '/', search: '' };
  const setUrl = (url: string) => {
    const q = url.indexOf('?');
    loc.pathname = q < 0 ? url : url.slice(0, q);
    loc.search = q < 0 ? '' : url.slice(q);
  };
  setUrl(initial);
  const hist = {
    state: null as unknown,
    scrollRestoration: 'auto',
    pushState: vi.fn((state: unknown, _t: string, url: string) => {
      hist.state = state;
      setUrl(url);
    }),
    replaceState: vi.fn((state: unknown, _t: string, url?: string) => {
      hist.state = state;
      if (url !== undefined) setUrl(url);
    }),
    back: vi.fn(),
  };
  const body = {};
  doc = {
    activeElement: body,
    body,
    scroller: { scrollTop: 0 },
    links: [],
    querySelector: (selector: string) => {
      if (selector === '.oct-page') return doc.scroller;
      const id = /^\[data-focus-id="(.*)"\]$/.exec(selector)?.[1];
      return id === undefined ? null : (doc.links.find(l => l.focusId === id) ?? null);
    },
    querySelectorAll: () => doc.links,
  };
  const win = {
    location: loc,
    history: hist,
    addEventListener: vi.fn((type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: () => void) => listeners.get(type)?.delete(fn)),
  };
  (globalThis as unknown as { window: unknown }).window = win;
  (globalThis as unknown as { document: unknown }).document = doc;
  return { hist, setUrl, fire: (type: string) => listeners.get(type)?.forEach(fn => fn()) };
}

describe('history entries (spec 7.9)', () => {
  let env: ReturnType<typeof installFakes>;
  beforeEach(() => {
    env = installFakes('/@veyra');
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it("a push records the page it left as the new entry's opener, at depth 0", () => {
    navigate('/@veyra/vault-os');
    expect(entryState()).toEqual({ scrollY: 0, focusId: null, opener: '/@veyra', depth: 0 });
  });

  it("a push within the same path (a world's ?view=) keeps the opener and goes one deeper", () => {
    navigate('/@veyra/vault-os');
    navigate('/@veyra/vault-os?view=overview');
    expect(entryState()).toMatchObject({ opener: '/@veyra', depth: 1 });
    navigate('/@veyra/vault-os?view=detail');
    expect(entryState()).toMatchObject({ opener: '/@veyra', depth: 2 });
  });

  it('a push within the same path remembers the address of the entry before it, and the first entry of a visit has none', () => {
    navigate('/@veyra/vault-os');
    expect(entryState()?.prev).toBeUndefined();
    navigate('/@veyra/vault-os?view=overview');
    expect(entryState()?.prev).toBe('/@veyra/vault-os');
    navigate('/@veyra/vault-os?view=detail');
    expect(entryState()?.prev).toBe('/@veyra/vault-os?view=overview');
  });

  it("a push stores the leaving entry's scroll and the control that was used before it moves on", () => {
    const enter = link('/@veyra/vault-os');
    doc.links = [enter];
    doc.scroller = { scrollTop: 340 };
    navigate('/@veyra/vault-os', { from: enter as unknown as Element });
    // The replace that saved the leaving entry came first; the new entry's state is the push's.
    const saved = env.hist.replaceState.mock.calls[0][0] as { platform: { scrollY: number; focusId: string } };
    expect(saved.platform.scrollY).toBe(340);
    expect(saved.platform.focusId).toBe(focusKeyOf(enter as unknown as Element));
    expect(env.hist.replaceState.mock.invocationCallOrder[0]).toBeLessThan(env.hist.pushState.mock.invocationCallOrder[0]);
    expect(entryState()).toMatchObject({ scrollY: 0, focusId: null });
  });

  it('saves nothing when there is no scroll and no focus to keep (a plain push is one history call)', () => {
    navigate('/explore');
    expect(env.hist.replaceState).not.toHaveBeenCalled();
    expect(env.hist.pushState).toHaveBeenCalledTimes(1);
  });

  it('keeps another feature\'s state on the entry it saves into (the landing marks its How It Works entry)', () => {
    env.hist.state = { octFromIntro: true };
    doc.scroller = { scrollTop: 10 };
    navigate('/explore');
    expect(env.hist.replaceState.mock.calls[0][0]).toMatchObject({ octFromIntro: true, platform: { scrollY: 10 } });
  });

  it('a focus key names a link by its address and its place among the links to it, and finds it again', () => {
    const a = link('/@veyra/vault-os');
    const b = link('/@veyra/vault-os');
    const other = link('/explore');
    doc.links = [other, a, b];
    expect(focusKeyOf(a as unknown as Element)).not.toBe(focusKeyOf(b as unknown as Element));
    expect(elementForFocusKey(focusKeyOf(b as unknown as Element)!)).toBe(b);
    expect(elementForFocusKey(focusKeyOf(a as unknown as Element)!)).toBe(a);
    expect(elementForFocusKey('/gone|0')).toBeNull();
    expect(focusKeyOf(doc.body as unknown as Element)).toBeNull();
    expect(focusKeyOf(null)).toBeNull();
  });

  it('a control with a stable focus id (data-focus-id) is named by it, not by its address, so a link whose address changes is still found', () => {
    const preview = link('/create/preview?project=a');
    preview.focusId = 'see-live-preview';
    doc.links = [preview];
    const key = focusKeyOf(preview as unknown as Element)!;
    expect(key).toBe('@see-live-preview');
    // The address is different when Back lands (another project is selected): the control is still found.
    const again = link('/create/preview?project=b');
    again.focusId = 'see-live-preview';
    doc.links = [again];
    expect(elementForFocusKey(key)).toBe(again);
    doc.links = [];
    expect(elementForFocusKey(key)).toBeNull();
  });

  it('a hostile stable focus key (a selector break-out, a prototype name, a huge string, an empty name) is ignored: no selector is built from it and nothing is focused', () => {
    const real = link('/create/preview');
    real.focusId = 'see-live-preview';
    doc.links = [real];
    const asked: string[] = [];
    const query = doc.querySelector;
    doc.querySelector = (selector: string) => (asked.push(selector), query(selector));
    for (const key of ['@a"]', '@a"] , [id', '@', '@ ', '@a b', '@name\n', '@' + 'x'.repeat(65), '@' + 'x'.repeat(100000), '@<img src=x>', '@a\\"]']) {
      expect(elementForFocusKey(key), key.slice(0, 20)).toBeNull();
    }
    expect(asked).toEqual([]);
    // A plain name is looked up; a prototype-ish name is just a name that nothing has.
    expect(elementForFocusKey('@see-live-preview')).toBe(real);
    expect(elementForFocusKey('@__proto__')).toBeNull();
    expect(elementForFocusKey('@constructor')).toBeNull();
    expect(asked.length).toBe(3);
  });

  it('a hostile focus key left in a history entry does not break the arrival restore (the scroll is still put back, nothing is focused)', () => {
    const off = subscribe(() => {});
    env.hist.state = { platform: { scrollY: 77, focusId: '@a"]' } };
    env.fire('popstate');
    doc.scroller = { scrollTop: 0 };
    doc.links = [];
    expect(() => restoreArrival()).not.toThrow();
    expect(doc.scroller.scrollTop).toBe(77);
    off();
  });

  it('a popstate arrival restores the stored scroll and puts focus back on the control', () => {
    const enter = link('/@veyra/vault-os');
    doc.links = [enter];
    env.hist.state = { platform: { scrollY: 420, focusId: focusKeyOf(enter as unknown as Element), opener: '', depth: 0 } };
    const off = subscribe(() => {});
    env.fire('popstate');
    doc.scroller = { scrollTop: 0 };
    restoreArrival();
    expect(doc.scroller.scrollTop).toBe(420);
    expect(enter.focus).toHaveBeenCalledWith({ preventScroll: true });
    off();
  });

  describe('a page that mounts late (a lazy chunk on a cold cache)', () => {
    let observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[];
    beforeEach(() => {
      vi.useFakeTimers();
      observers = [];
      (globalThis as unknown as { MutationObserver: unknown }).MutationObserver = class {
        callback: () => void;
        disconnect = vi.fn();
        constructor(callback: () => void) {
          this.callback = callback;
          observers.push(this);
        }
        observe() {}
      };
    });
    afterEach(() => {
      vi.useRealTimers();
      delete (globalThis as unknown as { MutationObserver?: unknown }).MutationObserver;
    });
    const popTo = (state: unknown) => {
      const off = subscribe(() => {});
      env.hist.state = state;
      env.fire('popstate');
      return off;
    };

    it('waits for the scroller and the control, then restores once and stops watching', () => {
      const enter = link('/@veyra/vault-os');
      const key = '/@veyra/vault-os|0';
      const off = popTo({ platform: { scrollY: 420, focusId: key } });
      doc.scroller = null;
      doc.links = [];
      restoreArrival();
      expect(observers).toHaveLength(1);
      // The page mounts: the scroller first, the control a moment later.
      doc.scroller = { scrollTop: 0 };
      observers[0].callback();
      expect(observers[0].disconnect).not.toHaveBeenCalled();
      doc.links = [enter];
      observers[0].callback();
      expect(doc.scroller.scrollTop).toBe(420);
      expect(enter.focus).toHaveBeenCalledTimes(1);
      expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(RESTORE_WAIT_MS * 2);
      expect(enter.focus).toHaveBeenCalledTimes(1);
      off();
    });

    it('a control that is on the page but cannot take focus yet (inside an inert part) is waited for, and focused when it can', () => {
      const button = link('/create/preview');
      button.focusId = 'see-live-preview';
      button.inert = true;
      const off = popTo({ platform: { scrollY: 30, focusId: '@see-live-preview' } });
      doc.scroller = { scrollTop: 0 };
      doc.links = [button];
      restoreArrival();
      expect(button.focus).toHaveBeenCalledTimes(1);
      expect(doc.activeElement).not.toBe(button);
      expect(observers).toHaveLength(1);
      expect(observers[0].disconnect).not.toHaveBeenCalled();
      // The page becomes editable (inert lifted): the next change of the document puts focus on it, once.
      button.inert = false;
      observers[0].callback();
      expect(doc.activeElement).toBe(button);
      expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
      off();
    });

    it('gives up after a bounded wait, restoring what is there', () => {
      const off = popTo({ platform: { scrollY: 90, focusId: '/gone|0' } });
      doc.scroller = { scrollTop: 0 };
      doc.links = [];
      restoreArrival();
      expect(doc.scroller.scrollTop).toBe(90);
      expect(observers).toHaveLength(1);
      vi.advanceTimersByTime(RESTORE_WAIT_MS + 1);
      expect(observers[0].disconnect).toHaveBeenCalled();
      off();
    });

    it('a newer navigation cancels the wait, and an entry with nothing to restore waits for nothing', () => {
      const off = popTo({ platform: { scrollY: 90, focusId: null } });
      doc.scroller = null;
      restoreArrival();
      expect(observers).toHaveLength(1);
      navigate('/explore');
      expect(observers[0].disconnect).toHaveBeenCalled();
      env.hist.state = { platform: { scrollY: 0, focusId: null } };
      env.fire('popstate');
      restoreArrival();
      expect(observers).toHaveLength(1);
      off();
    });
  });

  it('a push arrival restores nothing (a new page starts at its top)', () => {
    const enter = link('/@veyra/vault-os');
    doc.links = [enter];
    const off = subscribe(() => {});
    navigate('/explore');
    env.hist.state = { platform: { scrollY: 420, focusId: focusKeyOf(enter as unknown as Element), opener: '', depth: 0 } };
    doc.scroller = { scrollTop: 0 };
    restoreArrival();
    expect(doc.scroller.scrollTop).toBe(0);
    expect(enter.focus).not.toHaveBeenCalled();
    off();
  });

  it('takes over scroll restoration from the browser, which would restore before the page is swapped in', () => {
    const off = subscribe(() => {});
    expect(env.hist.scrollRestoration).toBe('manual');
    off();
  });

  describe('entryState reads what a history entry holds, which is whatever the page or the browser left there', () => {
    it.each([
      ['null', null],
      ['a number', 42],
      ['a string', 'x'],
      ['an array', []],
      ['no platform key', { octFromIntro: true }],
      ['platform a string', { platform: 'x' }],
      ['platform null', { platform: null }],
      ['platform an array', { platform: [] }],
      ['platform empty', { platform: {} }],
      ['scrollY a string', { platform: { scrollY: 'a', focusId: null } }],
      ['scrollY not finite', { platform: { scrollY: Number.NaN, focusId: null } }],
      ['focusId a number', { platform: { scrollY: 0, focusId: 7 } }],
    ])('is no state for %s', (_name, state) => {
      env.hist.state = state;
      expect(entryState()).toBeNull();
    });

    it('drops a field of the wrong type and keeps the rest, and ignores extra keys', () => {
      env.hist.state = { platform: { scrollY: 12, focusId: null, opener: 5, depth: 'x', prev: {}, extra: true }, other: 1 };
      expect(entryState()).toEqual({ scrollY: 12, focusId: null });
      env.hist.state = { platform: { scrollY: 3, focusId: 'a|0', opener: '/@veyra', depth: 2, prev: '/@veyra/vault-os' } };
      expect(entryState()).toEqual({ scrollY: 3, focusId: 'a|0', opener: '/@veyra', depth: 2, prev: '/@veyra/vault-os' });
    });

    it('restoreArrival, a push and insertOpener survive a malformed entry without throwing', () => {
      const off = subscribe(() => {});
      for (const state of [{ platform: 'x' }, { platform: { focusId: 7, scrollY: 'a', opener: 4 } }, 42]) {
        env.hist.state = state;
        env.fire('popstate');
        expect(() => restoreArrival()).not.toThrow();
        expect(() => navigate('/explore')).not.toThrow();
        env.hist.state = state;
        expect(() => insertOpener('/@veyra')).not.toThrow();
      }
      off();
    });

    it('a replace within the same path keeps what the entry before it is (the opener, the entry before and the depth stay true)', () => {
      navigate('/@veyra/vault-os');
      navigate('/@veyra/vault-os?view=overview');
      navigate('/@veyra/vault-os?view=detail');
      const was = entryState();
      navigate('/@veyra/vault-os?view=overview', { replace: true });
      expect(entryState()).toEqual(was);
    });
  });

  describe('insertOpener: a deep link has no page behind it in this tab', () => {
    it('puts the opener before the current entry, so Back goes there', () => {
      env.setUrl('/@veyra/vault-os?view=detail');
      insertOpener('/@veyra');
      expect(env.hist.replaceState).toHaveBeenCalledTimes(1);
      expect(env.hist.replaceState.mock.calls[0][2]).toBe('/@veyra');
      expect(env.hist.pushState).toHaveBeenCalledTimes(1);
      expect(env.hist.pushState.mock.calls[0][2]).toBe('/@veyra/vault-os?view=detail');
      expect(entryState()).toMatchObject({ opener: '/@veyra', depth: 0 });
    });

    it('does nothing on an entry the platform made (a reload of one, or the second run of a development effect)', () => {
      env.setUrl('/@veyra/vault-os?view=detail');
      insertOpener('/@veyra');
      env.hist.replaceState.mockClear();
      env.hist.pushState.mockClear();
      insertOpener('/@veyra');
      expect(env.hist.replaceState).not.toHaveBeenCalled();
      expect(env.hist.pushState).not.toHaveBeenCalled();
    });
  });
});
