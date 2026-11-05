import { describe, expect, it } from 'vitest';
import { clip } from './clip';

describe('clip (text echoed into a toast, a note or a count line)', () => {
  it('leaves short text alone', () => {
    expect(clip('Sample project')).toBe('Sample project');
    expect(clip('x'.repeat(40))).toBe('x'.repeat(40));
  });

  it('cuts longer text to 40 characters and adds an ellipsis', () => {
    const out = clip('y'.repeat(500));
    expect(out).toBe(`${'y'.repeat(40)}…`);
    expect(clip('z'.repeat(41))).toBe(`${'z'.repeat(40)}…`);
  });

  it('counts a character outside the basic plane as one (it never splits a pair)', () => {
    const out = clip('😀'.repeat(50));
    expect(Array.from(out)).toHaveLength(41);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, -1)).toBe('😀'.repeat(40));
  });

  it('takes another limit', () => {
    expect(clip('abcdef', 3)).toBe('abc…');
  });
});
