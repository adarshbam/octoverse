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
    expect(html).not.toContain('Saved in this browser');
    expect(html).toContain('data-save-status="loading"');
  });
});
