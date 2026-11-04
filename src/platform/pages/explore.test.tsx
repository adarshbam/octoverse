import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Explore } from './Explore';
import { NotFound } from './NotFound';

const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

describe('Explore', () => {
  const html = renderToStaticMarkup(createElement(Explore));
  // Each tile is the markup from its data-tile to the next one (the last to the page's footer).
  const tiles = html
    .split('data-tile="')
    .slice(1)
    .map(piece => ({ id: piece.slice(0, piece.indexOf('"')), html: piece.split('<footer')[0] }));

  it('has five tiles in order: Veyra, Flux, Nox, Aether, then Your Octopus', () => {
    expect(tiles.map(t => t.id)).toEqual(['veyra', 'flux', 'nox', 'aether', 'yours']);
  });

  it("each world tile has the world's still, name, epithet, project title, three chips in declared order and the Showcase badge", () => {
    const expected = {
      veyra: ['Veyra', 'The Keeper of Files', 'Vault OS', ['React', 'TypeScript', 'JavaScript']],
      flux: ['Flux', 'The Pipeline Runner', 'GitHub Pipeline Engine', ['GitHub Actions', 'TypeScript', 'Node.js']],
      nox: ['Nox', 'The Watcher', 'Security Lab', ['HTML', 'CSS', 'JavaScript']],
      aether: ['Aether', 'The Curious Mind', 'AI Playground', ['OpenAI', 'Python', 'TypeScript']],
    } as const;
    for (const tile of tiles.slice(0, 4)) {
      const [name, epithet, project, chips] = expected[tile.id as keyof typeof expected];
      const text = textOf(tile.html);
      expect(text).toContain(name);
      expect(text).toContain(epithet);
      expect(text).toContain(project);
      expect(text).toContain('Showcase');
      expect(tile.html).toContain(`src="/platform/stills/${tile.id}.webp"`);
      expect([...tile.html.matchAll(/<li\b[^>]*class="oct-chip"[^>]*>([^<]*)<\/li>/g)].map(m => decode(m[1]))).toEqual([...chips]);
    }
  });

  it('opens each profile from its tile, and the creator from Your Octopus', () => {
    expect(tiles.map(t => /<a\b[^>]*href="([^"]+)"/.exec(t.html)![1])).toEqual(['/@veyra', '/@flux', '/@nox', '/@aether', '/create']);
  });

  it('gives Your Octopus the gold glyph picture, no still, no Showcase badge', () => {
    const yours = tiles[4].html;
    expect(yours).toContain('data-glyph="octopus"');
    expect(yours).not.toContain('<img');
    expect(textOf(yours)).toContain('Your Octopus');
    expect(textOf(yours)).not.toContain('Showcase');
  });

  it('has one heading, and the footer', () => {
    expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textOf(html)).toContain('Showcase portfolios by the OctoVerse team.');
  });

  it('shows no search, pricing, sign-in or follow', () => {
    expect(textOf(html)).not.toMatch(/search|pricing|sign in|follow/i);
  });
});

describe('Not found', () => {
  const html = renderToStaticMarkup(createElement(NotFound));
  it('says the part of the ocean is unexplored, with a way home and to Explore', () => {
    expect(html).toMatch(/<h1[^>]*>This part of the ocean is unexplored<\/h1>/);
    const main = html.slice(html.indexOf('<main'));
    const links = [...main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(m => [m[1], m[2]]);
    expect(links).toEqual([['/', 'Back to OctoVerse'], ['/explore', 'Explore']]);
  });
});
