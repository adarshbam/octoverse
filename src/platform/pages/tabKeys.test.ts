import { describe, expect, it } from 'vitest';
import { nextTab } from './tabKeys';

describe('nextTab (the tab list by keyboard)', () => {
  it('moves right and left, and wraps at either end', () => {
    expect(nextTab('ArrowRight', 0, 3)).toBe(1);
    expect(nextTab('ArrowRight', 2, 3)).toBe(0);
    expect(nextTab('ArrowLeft', 1, 3)).toBe(0);
    expect(nextTab('ArrowLeft', 0, 3)).toBe(2);
  });

  it('Home goes to the first and End to the last', () => {
    expect(nextTab('Home', 2, 3)).toBe(0);
    expect(nextTab('End', 0, 3)).toBe(2);
  });

  it('leaves every other key alone', () => {
    for (const key of ['Enter', ' ', 'Tab', 'a', 'ArrowDown', 'ArrowUp']) expect(nextTab(key, 1, 3)).toBeUndefined();
  });
});
