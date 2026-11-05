import { afterEach, describe, expect, it, vi } from 'vitest';
import { HANDOFF_TTL_MS, clearHandoff, handOff, peekHandoff } from './previewHandoff';
import { previewDraftFrom } from './previewDraft';
import { SAMPLE_DRAFT } from './sampleDraft';
import type { CreatorDraft } from './types';

// The creator's hand-off to its preview: the draft as it is on screen, taken by the preview even though the autosave (800 ms) has not run
// and even when the browser cannot keep drafts at all.

const draftNamed = (name: string, images: string[] = []): CreatorDraft => ({
  ...structuredClone(SAMPLE_DRAFT),
  octopus: { ...SAMPLE_DRAFT.octopus, name },
  projects: [{ ...SAMPLE_DRAFT.projects[0], media: images.map(id => ({ id, name: `${id}.png`, type: 'image/png' as const, size: 1 })) }],
});

afterEach(() => clearHandoff());

describe('the hand-off', () => {
  it('holds nothing until the creator hands a draft over', () => {
    expect(peekHandoff()).toBeNull();
  });

  it('holds the draft as it was when See live preview was pressed, and stays until it is cleared (a development double effect reads it twice)', () => {
    const edited = draftNamed('Edited a moment ago');
    handOff(edited, 'sample-project', undefined);
    expect(peekHandoff()?.draft).toBe(edited);
    expect(peekHandoff()?.draft).toBe(edited);
    expect(peekHandoff()?.project).toBe('sample-project');
    clearHandoff();
    expect(peekHandoff()).toBeNull();
  });

  it('a newer press replaces the older', () => {
    handOff(draftNamed('one'), null, undefined);
    handOff(draftNamed('two'), null, undefined);
    expect(peekHandoff()?.draft.octopus.name).toBe('two');
  });

  it('is stale after the time to live: a hand-off the visitor did not arrive from is ignored and dropped', () => {
    handOff(draftNamed('old'), null, undefined, 1000);
    expect(peekHandoff(1000 + HANDOFF_TTL_MS)).not.toBeNull();
    expect(peekHandoff(1000 + HANDOFF_TTL_MS + 1)).toBeNull();
    expect(peekHandoff(1000)).toBeNull();
  });

  it('starts reading the project\'s images AT THE PRESS (the creator\'s store closes when it unmounts), and an unreadable one is null', async () => {
    const calls: string[] = [];
    const blob = new Blob(['x']);
    const get = vi.fn((id: string) => {
      calls.push(id);
      return id === 'bad' ? Promise.reject(new Error('gone')) : Promise.resolve(blob);
    });
    handOff(draftNamed('with images', ['m1', 'bad']), 'sample-project', get);
    expect(calls, 'both reads started during the press, before any await').toEqual(['m1', 'bad']);
    const held = peekHandoff()!;
    expect(await held.media.m1).toBe(blob);
    expect(await held.media.bad).toBeNull();
  });

  it('has no images to read for a draft with no project or no reader', async () => {
    const get = vi.fn(() => Promise.resolve(null));
    handOff({ ...draftNamed('none'), projects: [] }, null, get);
    expect(get).not.toHaveBeenCalled();
    expect(peekHandoff()!.media).toEqual({});
    handOff(draftNamed('no reader', ['m1']), null, undefined);
    expect(await peekHandoff()!.media.m1).toBeNull();
  });
});

describe('which draft the preview shows: the hand-off, then the stored draft, then the sample', () => {
  const stale = { ...structuredClone(SAMPLE_DRAFT), octopus: { ...SAMPLE_DRAFT.octopus, name: 'Saved earlier' } };

  it('prefers the hand-off over a stored draft that is older (an edit under 800 ms old is not saved yet)', () => {
    const edited = draftNamed('Edited just now');
    expect(previewDraftFrom(edited, stale)).toBe(edited);
    expect(previewDraftFrom(edited, null)).toBe(edited);
  });

  it('shows a draft the browser cannot keep (nothing stored at all) from the hand-off, not the sample', () => {
    const inMemory = draftNamed('Only in this tab');
    expect(previewDraftFrom(inMemory, null).octopus.name).toBe('Only in this tab');
  });

  it('with no hand-off it reads the stored draft, and with neither it is the sample', () => {
    expect(previewDraftFrom(null, stale).octopus.name).toBe('Saved earlier');
    expect(previewDraftFrom(null, null)).toBe(SAMPLE_DRAFT);
  });
});
