import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementForFocusKey, entryState, focusKeyOf, insertOpener, navigate, restoreArrival, subscribe } from './history';

// What a history entry remembers (spec 7.9): where the page was scrolled and which control had focus (restored when Back lands on it),
// and which page opened the world it holds. Kept in `history.state.platform`, so it survives a reload and goes with the entry.

interface FakeLink {
  tagName: string;
  id: string;
  href: string;
  focused: boolean;
  focus: ReturnType<typeof vi.fn>;
  getAttribute: (name: string) => string | null;
}

function link(href: string, id = ''): FakeLink {
  const el: FakeLink = {
    tagName: 'A',
    id,
    href,
    focused: false,
    focus: vi.fn(() => {
      el.focused = true;
      doc.activeElement = el as unknown;
    }),
    getAttribute: (name: string) => (name === 'href' ? href : null),
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
    querySelector: (selector: string) => (selector === '.oct-page' ? doc.scroller : null),
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
