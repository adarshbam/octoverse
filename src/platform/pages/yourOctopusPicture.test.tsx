import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OctopusPicture, YourOctopusPicture } from './YourOctopusPicture';

// The "Your Octopus" card's picture (spec 7.10, J01): the glyph while the draft is read, the labelled sample without a draft, the
// visitor's own still with its name (or "Your draft") with one.

const render = (own: Parameters<typeof OctopusPicture>[0]['own']) => renderToStaticMarkup(createElement(OctopusPicture, { own }));

describe('the Your Octopus picture', () => {
  it('is the gold glyph card while the draft is being read (and on the server)', () => {
    const html = render(undefined);
    expect(html).toContain('data-glyph="octopus"');
    expect(html).not.toContain('<img');
    expect(renderToStaticMarkup(createElement(YourOctopusPicture))).toContain('data-glyph="octopus"');
  });

  it('is the sample creator octopus, labelled a sample, when there is no draft', () => {
    const html = render(null);
    expect(html).toContain('src="/platform/stills/creator-aether-peach.webp"');
    expect(html).toContain('data-picture="sample"');
    expect(html).toMatch(/<span class="oct-still-tag" aria-hidden="true">Sample octopus<\/span>/);
    expect(html).not.toContain('data-glyph');
  });

  it("is the draft's own still with its name when the draft has one", () => {
    const html = render({ template: 'nox', palette: 'violet', name: 'Mira' });
    expect(html).toContain('src="/platform/stills/creator-nox-violet.webp"');
    expect(html).toContain('data-picture="draft"');
    expect(html).toMatch(/<span class="oct-still-tag" aria-hidden="true">Mira<\/span>/);
    expect(html).not.toContain('Sample octopus');
  });

  it('says "Your draft" when the draft has no name, and follows the template and the palette', () => {
    const html = render({ template: 'veyra', palette: 'lilacGrey', name: '' });
    expect(html).toContain('src="/platform/stills/creator-veyra-lilacGrey.webp"');
    expect(html).toMatch(/<span class="oct-still-tag" aria-hidden="true">Your draft<\/span>/);
  });
});
