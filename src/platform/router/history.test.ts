import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalise, getRoute, goBack, navigate, subscribe } from './history';

type Listener = () => void;

function installFakeWindow(initial: string) {
  const listeners = new Map<string, Set<Listener>>();
  const loc = { pathname: '/', search: '' };
  const setUrl = (url: string) => {
    const q = url.indexOf('?');
    loc.pathname = q < 0 ? url : url.slice(0, q);
    loc.search = q < 0 ? '' : url.slice(q);
  };
  setUrl(initial);
  const hist = {
    pushState: vi.fn((_s: unknown, _t: string, url: string) => setUrl(url)),
    replaceState: vi.fn((_s: unknown, _t: string, url: string) => setUrl(url)),
    back: vi.fn(),
  };
  const win = {
    location: loc,
    history: hist,
    addEventListener: vi.fn((type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    }),
  };
  (globalThis as unknown as { window: unknown }).window = win;
  const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
  const count = (type: string) => listeners.get(type)?.size ?? 0;
  return { win, hist, loc, setUrl, fire, count };
}

describe('history', () => {
  let env: ReturnType<typeof installFakeWindow>;
  beforeEach(() => {
    env = installFakeWindow('/');
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('navigate pushes by default and notifies subscribers', () => {
    const cb = vi.fn();
    const off = subscribe(cb);
    navigate('/explore');
    expect(env.hist.pushState).toHaveBeenCalledTimes(1);
    expect(env.hist.pushState.mock.calls[0][2]).toBe('/explore');
    expect(env.hist.replaceState).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(getRoute()).toEqual({ name: 'explore' });
    off();
  });

  it('navigate with replace uses replaceState', () => {
    const off = subscribe(() => {});
    navigate('/create', { replace: true });
    expect(env.hist.replaceState).toHaveBeenCalledTimes(1);
    expect(env.hist.pushState).not.toHaveBeenCalled();
    expect(getRoute()).toEqual({ name: 'create' });
    off();
  });

  it('navigate to the url already shown replaces instead of pushing a duplicate entry', () => {
    env.setUrl('/explore');
    const cb = vi.fn();
    const off = subscribe(cb);
    navigate('/explore');
    expect(env.hist.pushState).not.toHaveBeenCalled();
    expect(env.hist.replaceState).toHaveBeenCalledTimes(1);
    expect(getRoute()).toEqual({ name: 'explore' });
    env.setUrl('/@veyra/vault-os?view=detail');
    navigate('/@veyra/vault-os?view=detail');
    expect(env.hist.pushState).not.toHaveBeenCalled();
    // A different search on the same path is a different address: pushed.
    navigate('/@veyra/vault-os?view=overview');
    expect(env.hist.pushState).toHaveBeenCalledTimes(1);
    off();
  });

  it('goBack wraps history.back', () => {
    goBack();
    expect(env.hist.back).toHaveBeenCalledTimes(1);
  });

  it('adds one popstate listener on first subscribe and removes it after the last', () => {
    const a = subscribe(() => {});
    const b = subscribe(() => {});
    expect(env.count('popstate')).toBe(1);
    expect(env.win.addEventListener).toHaveBeenCalledTimes(1);
    a();
    expect(env.count('popstate')).toBe(1);
    a(); // double unsubscribe is harmless
    expect(env.count('popstate')).toBe(1);
    b();
    expect(env.count('popstate')).toBe(0);
    expect(env.win.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('notifies on popstate', () => {
    const cb = vi.fn();
    const off = subscribe(cb);
    env.setUrl('/how-it-works');
    env.fire('popstate');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(getRoute()).toEqual({ name: 'howItWorks' });
    off();
  });

  it('getRoute returns a stable object while the route is unchanged', () => {
    env.setUrl('/@veyra/vault-os?view=detail');
    expect(getRoute()).toBe(getRoute());
  });

  it('canonicalise replaces a bad view without pushing', () => {
    env.setUrl('/@veyra/vault-os?view=techFocus');
    expect(canonicalise()).toBe(true);
    expect(env.hist.replaceState).toHaveBeenCalledTimes(1);
    expect(env.hist.replaceState.mock.calls[0][2]).toBe('/@veyra/vault-os');
    expect(env.hist.pushState).not.toHaveBeenCalled();
    expect(env.loc.search).toBe('');
    expect(canonicalise()).toBe(false);
  });

  it('canonicalises on first subscribe and after popstate', () => {
    env.setUrl('/@veyra/vault-os?view=x');
    const off = subscribe(() => {});
    expect(env.hist.replaceState).toHaveBeenCalledTimes(1);
    env.setUrl('/@veyra/vault-os?view=techFocus');
    env.fire('popstate');
    expect(env.hist.replaceState).toHaveBeenCalledTimes(2);
    expect(env.loc.search).toBe('');
    off();
  });

  it('navigate to a non-canonical url ends canonical via replaceState', () => {
    const off = subscribe(() => {});
    navigate('/@veyra/vault-os?view=bogus');
    expect(env.hist.pushState).toHaveBeenCalledTimes(1);
    expect(env.hist.replaceState).toHaveBeenCalledTimes(1);
    expect(env.loc.search).toBe('');
    off();
  });
});
