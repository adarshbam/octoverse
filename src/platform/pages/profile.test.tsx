import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { profileFor } from '../fixtures/showcase';
import { aetherProject } from '../../worlds/aether/content/aetherProject';
import { aetherTechnologies } from '../../worlds/aether/content/aetherTechnologies';
import { fluxProject } from '../../worlds/flux/content/fluxProject';
import { fluxTechnologies } from '../../worlds/flux/content/fluxTechnologies';
import { noxProject } from '../../worlds/nox/content/noxProject';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { veyraProject } from '../../worlds/veyra/content/veyraProject';
import { veyraTechnologies } from '../../worlds/veyra/content/veyraTechnologies';
import { Profile } from './Profile';

// Server rendering stands in for jsdom (not installed). The tabs' keyboard logic is a pure function (tabKeys.test.ts).
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const render = (handle: 'veyra' | 'flux' | 'nox' | 'aether') => renderToStaticMarkup(createElement(Profile, { profile: profileFor(handle)! }));

// What the Tech Stack panel says of each technology is what the world's own content declares: read here from the content modules, never typed.
describe('the Tech Stack panel follows the world content', () => {
  const SOURCES = {
    veyra: { project: veyraProject, technologies: veyraTechnologies },
    flux: { project: fluxProject, technologies: fluxTechnologies },
    nox: { project: noxProject, technologies: noxTechnologies },
    aether: { project: aetherProject, technologies: aetherTechnologies },
  } as const;
  it.each(['veyra', 'flux', 'nox', 'aether'] as const)('%s: every technology in the content order, each with exactly its declared note, and the placeholder label only on notes the content flags', world => {
    const html = render(world);
    const items = [...html.matchAll(/<li\b[^>]*data-tech="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)].map(m => ({ id: m[1], text: textOf(m[2]), note: /<p>([\s\S]*?)<\/p>/.exec(m[2]) }));
    const { project, technologies } = SOURCES[world];
    expect(items.map(i => i.id)).toEqual(technologies.map(t => t.id));
    for (const [i, t] of technologies.entries()) {
      const usage = project.technologyUsages?.find(u => u.technologyId === t.id);
      const note = usage?.summary ?? usage?.role;
      const item = items[i];
      if (note === undefined) {
        expect(item.note, `${world} ${t.id} shows no note`).toBeNull();
        continue;
      }
      expect(item.note, `${world} ${t.id} shows its note`).not.toBeNull();
      expect(textOf(item.note![1]).startsWith(note)).toBe(true);
      expect(item.text.includes('placeholder text'), `${world} ${t.id} placeholder label`).toBe(usage?.placeholder === true);
    }
  });
});

describe('a profile', () => {
  const html = render('veyra');
  const text = textOf(html);

  it('names the octopus with the Showcase badge, never Pro, and says its epithet and tagline', () => {
    expect(html).toMatch(/<h1[^>]*>Veyra<\/h1>/);
    expect(text).toContain('Showcase');
    expect(text).not.toMatch(/\bPro\b/);
    expect(text).toContain('The Keeper of Files');
    expect(text).toContain('A secure cloud storage platform.');
  });

  it('has the primary action Enter <name> world, opening the project', () => {
    expect(html).toMatch(/<a\b[^>]*href="\/@veyra\/vault-os"[^>]*>Enter Veyra&#x27;s world<\/a>/);
  });

  it('shows the octopus as an engine still', () => {
    expect(html).toContain('src="/platform/stills/veyra.webp"');
  });

  it('has an accessible tab list: Projects (1), About, Tech Stack, wired to their panels', () => {
    expect(html).toContain('role="tablist"');
    const tabs = [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map(m => textOf(m[1]));
    expect(tabs).toEqual(['Projects (1)', 'About', 'Tech Stack']);
    const tabTags = [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map(m => m[0]);
    expect(tabTags.map(t => /aria-selected="(true|false)"/.exec(t)![1])).toEqual(['true', 'false', 'false']);
    expect(tabTags.map(t => /tabindex="(-?\d)"/.exec(t)![1])).toEqual(['0', '-1', '-1']);
    const panels = [...html.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>/g)].map(m => m[0]);
    expect(panels).toHaveLength(3);
    for (const [i, tab] of tabTags.entries()) {
      const controls = /aria-controls="([^"]+)"/.exec(tab)![1];
      const id = /\bid="([^"]+)"/.exec(tab)![1];
      expect(panels[i]).toContain(`id="${controls}"`);
      expect(panels[i]).toContain(`aria-labelledby="${id}"`);
    }
    // Only the selected panel shows.
    expect(panels.map(p => p.includes(' hidden'))).toEqual([false, true, true]);
  });

  it('Projects: one card with the title, tagline and technology chips, and an honest placeholder where there is no screenshot', () => {
    expect(text).toContain('Vault OS');
    expect(html).toMatch(/class="oct-shot-missing"[^>]*>[^<]*No screenshot yet/);
    expect(html).not.toMatch(/<img[^>]*screenshot/);
    expect(html).toMatch(/<a\b[^>]*href="\/@veyra\/vault-os"/);
  });

  it('About is the overview text of the world, and Tech Stack lists every technology in declared order', () => {
    const panels = [...html.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>([\s\S]*?)(?=<div\b[^>]*role="tabpanel"|<footer)/g)].map(m => textOf(m[1]));
    expect(panels[1]).toContain('A Google Drive clone with file upload, sharing and secure access control.');
    const stack = [...html.matchAll(/data-tech="([^"]+)"/g)].map(m => m[1]);
    expect(stack).toEqual(['react', 'typescript', 'javascript', 'node', 'express', 'mongodb', 'redis', 'docker', 'linux', 'aws', 'cloudflare', 'github']);
  });

  it('has no Follow, counts, social links, location or link the content does not supply', () => {
    expect(text).not.toMatch(/follow/i);
    expect(text).not.toMatch(/\b\d+\s*(followers|following|stars|likes|views)\b/i);
    expect(html).not.toMatch(/twitter|linkedin|instagram|facebook/i);
    expect(html).not.toMatch(/href="https?:/);
    expect(html).not.toContain('oct-profile-location');
  });

  it('says in its footer that the portfolios are showcase examples by the OctoVerse team', () => {
    expect(text).toContain('Showcase portfolios by the OctoVerse team.');
  });

  it('shows a screenshot where the content has one (Nox), with the content alt text', () => {
    const nox = render('nox');
    expect(nox).toContain('src="/images/projects/security-lab-preview.webp"');
    expect(nox).toContain('alt="Security Lab project homepage screenshot"');
    expect(nox).not.toContain('No screenshot yet');
    expect(nox).toContain('src="/platform/stills/nox.webp"');
  });

  it('renders each of the four showcase profiles with its own epithet and Enter button', () => {
    for (const [handle, name, epithet] of [['veyra', 'Veyra', 'The Keeper of Files'], ['flux', 'Flux', 'The Pipeline Runner'], ['nox', 'Nox', 'The Watcher'], ['aether', 'Aether', 'The Curious Mind']] as const) {
      const page = render(handle);
      expect(textOf(page)).toContain(epithet);
      expect(textOf(page)).toContain(`Enter ${name}'s world`);
      expect(textOf(page)).toContain('Projects (1)');
    }
  });
});
