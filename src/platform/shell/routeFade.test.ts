import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FADE_MS, createRouteFade, type FadePhase } from './routeFade';

function setup(reduced = false) {
  const phases: FadePhase[] = [];
  const swap = vi.fn();
  const fade = createRouteFade({ reduced: () => reduced, swap, paint: p => phases.push(p) });
  return { fade, swap, phases };
}

describe('the route fade (spec 7.9: 250 ms through the deep indigo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('is 250 ms in all: cover for half, swap at the middle, uncover for half', () => {
    expect(FADE_MS).toBe(250);
    const { fade, swap, phases } = setup();
    fade.request();
    expect(phases).toEqual(['in']);
    vi.advanceTimersByTime(FADE_MS / 2 - 1);
    expect(swap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(['in', 'out']);
    vi.advanceTimersByTime(FADE_MS / 2 - 1);
    expect(fade.phase).toBe('out');
    vi.advanceTimersByTime(1);
    expect(phases).toEqual(['in', 'out', 'idle']);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with reduced motion it is an instant cut: swap now, no overlay, no timer', () => {
    const { fade, swap, phases } = setup(true);
    fade.request();
    expect(swap).toHaveBeenCalledTimes(1);
    expect(phases).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a second request while covering is folded into the one in flight (one swap, which reads the latest route)', () => {
    const { fade, swap, phases } = setup();
    fade.request();
    vi.advanceTimersByTime(40);
    fade.request();
    vi.advanceTimersByTime(FADE_MS);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(['in', 'out', 'idle']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a request while uncovering starts a new cover and swaps again', () => {
    const { fade, swap, phases } = setup();
    fade.request();
    vi.advanceTimersByTime(FADE_MS / 2 + 30);
    expect(fade.phase).toBe('out');
    fade.request();
    expect(fade.phase).toBe('in');
    vi.advanceTimersByTime(FADE_MS);
    expect(swap).toHaveBeenCalledTimes(2);
    expect(phases).toEqual(['in', 'out', 'in', 'out', 'idle']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a reduced-motion request in the middle of a fade ends it at once', () => {
    let reduced = false;
    const phases: FadePhase[] = [];
    const swap = vi.fn();
    const fade = createRouteFade({ reduced: () => reduced, swap, paint: p => phases.push(p) });
    fade.request();
    reduced = true;
    fade.request();
    expect(swap).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(['in', 'idle']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose leaves no timer and no later swap or paint, whenever it comes', () => {
    for (const at of [0, 10, FADE_MS / 2, FADE_MS / 2 + 10, FADE_MS - 1]) {
      const { fade, swap, phases } = setup();
      fade.request();
      vi.advanceTimersByTime(at);
      const swaps = swap.mock.calls.length;
      const painted = phases.length;
      fade.dispose();
      expect(vi.getTimerCount(), `at ${at}`).toBe(0);
      vi.advanceTimersByTime(FADE_MS * 2);
      expect(swap.mock.calls.length).toBe(swaps);
      expect(phases.length).toBe(painted);
      fade.request(); // after dispose a request does nothing
      expect(vi.getTimerCount()).toBe(0);
      expect(swap.mock.calls.length).toBe(swaps);
    }
  });
});
