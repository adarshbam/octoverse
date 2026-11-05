import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONFIRM_TEXT, DraftBar } from './DraftBar';
import { DISCARD_ERROR } from './draftController';

// Markup of the save status and the Discard draft flow in each state (server render: jsdom is not installed). The clicks, the focus and
// the real clear and its failure are tests/e2e/platform-creator-editor.spec.ts's.
const textOf = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/&#x27;/g, "'").trim();
const noop = async () => ({ cleared: true });
const bar = (over: Partial<Parameters<typeof DraftBar>[0]> = {}) =>
  renderToStaticMarkup(createElement(DraftBar, { ready: true, status: 'saved', discardError: null, discarding: false, onDiscard: noop, ...over }));
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({ attrs: m[1], text: textOf(m[2]) }));
const statusOf = (html: string) => /<p\b[^>]*data-draft-status="([^"]*)"[^>]*>([\s\S]*?)<\/p>/.exec(html);

describe('the visible status line', () => {
  it('says what the draft is doing, in plain text on the screen (not only for a screen reader)', () => {
    const cases: [Partial<Parameters<typeof DraftBar>[0]>, string, string][] = [
      [{ ready: false }, 'loading', 'Loading…'],
      [{ status: 'saving' }, 'saving', 'Saving…'],
      [{ status: 'saved' }, 'saved', 'Saved in this browser'],
      [{ status: 'memory' }, 'memory', "Can't save in this browser"],
      [{ discarding: true }, 'discarding', 'Discarding…'],
    ];
    for (const [over, state, words] of cases) {
      const m = statusOf(bar(over))!;
      expect(m[1]).toBe(state);
      expect(textOf(m[2])).toBe(words);
      expect(bar(over)).not.toMatch(/oct-sr-only[^>]*data-draft-status/);
    }
  });

  it('is not a second live region (the route has the one that speaks, and only on change)', () => {
    const m = /<p\b[^>]*data-draft-status[^>]*>/.exec(bar())![0];
    expect(m).not.toMatch(/role=|aria-live/);
  });
});

describe('Discard draft', () => {
  it('is a button outside the confirmation, enabled once the draft is loaded', () => {
    const b = buttons(bar());
    expect(b.map(x => x.text)).toEqual(['Discard draft']);
    expect(b[0].attrs).not.toMatch(/\sdisabled/);
    expect(bar()).not.toContain(CONFIRM_TEXT);
  });

  it('is disabled while loading and while discarding (and says so)', () => {
    expect(buttons(bar({ ready: false }))[0].attrs).toMatch(/\sdisabled/);
    const discarding = buttons(bar({ discarding: true }));
    expect(discarding[0].attrs).toMatch(/\sdisabled/);
    expect(discarding[0].text).toBe('Discarding…');
  });

  it('asks first: the question, then Confirm and Cancel, in that order', () => {
    const html = bar({ confirming: true });
    expect(textOf(html)).toContain('Discard this draft? This clears it from this browser.');
    expect(CONFIRM_TEXT).toBe('Discard this draft? This clears it from this browser.');
    expect(buttons(html).map(b => b.text)).toEqual(['Confirm', 'Cancel']);
    expect(html).toMatch(/role="group"[^>]*aria-labelledby="([^"]+)"/);
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)![1];
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toMatch(/tabindex="-1"/);
    // The Discard draft button is replaced by the question, not shown beside it.
    expect(buttons(html).map(b => b.text)).not.toContain('Discard draft');
  });

  it('a clear that failed keeps saying so: the exact message, the status of the store, and Retry', () => {
    const html = bar({ discardError: DISCARD_ERROR });
    expect(textOf(html)).toContain("Could not clear this browser's copy. Your draft is still here. Try again.");
    expect(/data-discard-error/.test(html)).toBe(true);
    expect(buttons(html).map(b => b.text)).toEqual(['Retry', 'Discard draft']);
    expect(statusOf(html)![1]).toBe('saved');
  });

  it('no Retry without an error', () => {
    expect(buttons(bar()).map(b => b.text)).not.toContain('Retry');
    expect(bar()).not.toContain('data-discard-error');
  });

  it('every button is a real button of at least the shared small-button class (44 px by CSS)', () => {
    for (const html of [bar(), bar({ confirming: true }), bar({ discardError: DISCARD_ERROR })]) for (const b of buttons(html)) expect(b.attrs).toContain('oct-small-button');
  });
});
