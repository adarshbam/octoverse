import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CreatorRoute from './CreatorRoute';

describe('the creator route before the stored draft is read', () => {
  const html = renderToStaticMarkup(createElement(CreatorRoute));

  it('is inert and busy, so no edit can be made over the sample', () => {
    expect(html).toMatch(/<div[^>]*inert=""/);
    expect(html).toContain('aria-busy="true"');
  });

  it('says it is loading, not "Saved in this browser"', () => {
    expect(html).toContain('Loading your draft');
    // The status lines (the visible one and the screen reader's) do not say it is saved; the images' caption has its own words.
    expect(html).not.toMatch(/data-save-status="(saved|saving|memory)"/);
    expect(html).not.toMatch(/data-draft-status="(saved|saving|memory)"/);
    expect(html).not.toMatch(/<p[^>]*data-draft-status[^>]*>Saved in this browser/);
    expect(html).toContain('data-save-status="loading"');
  });
});
