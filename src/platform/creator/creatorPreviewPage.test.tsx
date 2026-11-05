import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CreatorPreviewPage from './CreatorPreviewPage';

// The full preview's first markup (platform Task 20): until the draft is read the page is the loading card, with no navigation bar and no
// engine; the world, its exit control and the rest are the browser's (tests/e2e/platform-creator-preview.spec.ts).

describe('the full preview before the draft is read', () => {
  const html = renderToStaticMarkup(createElement(CreatorPreviewPage));

  it('is the loading card in the reef: a status, no navigation bar, no creator controls, no Publish', () => {
    expect(html).toContain('Loading preview');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('oct-nav');
    expect(html).not.toContain('Publish');
    expect(html).not.toContain('<canvas');
  });

  it('says its view and that it is the draft preview, and no world yet', () => {
    expect(html).toContain('data-preview="draft"');
    expect(html).toContain('data-view="intro"');
    expect(html).not.toContain('data-world');
    expect(renderToStaticMarkup(createElement(CreatorPreviewPage, { view: 'overview' }))).toContain('data-view="overview"');
  });
});
