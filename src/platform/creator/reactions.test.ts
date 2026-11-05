import { describe, expect, it } from 'vitest';
import { REACTION_CHANGES, REMOUNT_FADE_MS, reactionFor, wigglePath } from './reactions';

describe('reactionFor (spec 7.13: the octopus reacts to every preset change)', () => {
  it('a palette change shimmers and wiggles, with no face of its own', () => {
    const r = reactionFor('palette');
    expect(r).toMatchObject({ shimmer: true, wiggle: true });
    expect(r).not.toHaveProperty('expression');
    expect((r as { holdMs: number }).holdMs).toBeGreaterThan(0);
  });

  it("a personality change shows the new personality's idle for 3 seconds: no face, no shimmer, no wiggle", () => {
    const r = reactionFor('personality');
    expect(r).toEqual({ holdMs: 3000 });
  });

  it('a name change blinks and smiles with the happy face', () => {
    const r = reactionFor('name');
    expect(r).toMatchObject({ blink: true, expression: 'happy' });
    expect(['gentle', 'happy', 'focused', 'attentive', 'curious', 'restful', 'blow']).toContain((r as { expression: string }).expression);
  });

  it('a template change is a remount (with the 200 ms fade)', () => {
    expect(reactionFor('template')).toBe('remount');
    expect(REMOUNT_FADE_MS).toBe(200);
  });

  it('every change has a reaction and every held one has a hold time', () => {
    for (const change of REACTION_CHANGES) {
      const r = reactionFor(change);
      if (r !== 'remount') expect(r.holdMs).toBeGreaterThan(0);
    }
    expect(REACTION_CHANGES).toEqual(['palette', 'personality', 'name', 'template']);
  });

  it('is pure: the same answer each time, and an answer cannot change the next', () => {
    const a = reactionFor('name') as { holdMs: number };
    a.holdMs = 1;
    expect((reactionFor('name') as { holdMs: number }).holdMs).not.toBe(1);
  });
});

describe('wigglePath (the small happy wiggle as gaze targets, in canvas pixels)', () => {
  it('swings to one side, the other and back, around the canvas centre, and ends released', () => {
    const steps = wigglePath(400, 300);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    const targets = steps.flatMap(s => (s.target ? [s.target] : []));
    expect(targets[0].x).toBeLessThan(200);
    expect(targets[1].x).toBeGreaterThan(200);
    for (const t of targets) {
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(400);
    }
    expect(steps.at(-1)?.target).toBeNull();
  });
  it('is in time order, from 0', () => {
    const ats = wigglePath(400, 300).map(s => s.at);
    expect(ats[0]).toBe(0);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
  });
});
