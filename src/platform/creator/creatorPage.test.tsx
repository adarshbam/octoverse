import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CreatorPage } from './CreatorPage';
import { addProject, withOctopus, withProfile, withProject } from './draftEdits';
import { PALETTE_IDS, PALETTE_NAMES, PERSONALITY_IDS, TEMPLATE_IDS } from './types';
import { SAMPLE_DRAFT } from './sampleDraft';
import { SWATCH_COLOURS } from './swatchColours';
import { technologyName } from './technologies';

// Server rendering stands in for jsdom (not installed): what the creator says, in what order and with which names is checked on the
// markup. Where things sit on screen, and the tabs by keyboard, are tests/e2e/platform-creator.spec.ts's.
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const noop = () => {};
const render = (layout: 'wide' | 'phone' = 'wide', draft = SAMPLE_DRAFT) => renderToStaticMarkup(createElement(CreatorPage, { draft, onChange: noop, layout }));
const buttonsIn = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({ attrs: m[1], text: textOf(m[2]) }));
const nameOf = (button: { attrs: string; text: string }) => /aria-label="([^"]*)"/.exec(button.attrs)?.[1] ?? button.text;

describe('the creator composition (spec 7.13)', () => {
  const html = render();
  const text = textOf(html);

  it('says its parts in order: Your Octopus, the picture, Your Projects, See live preview, Publish', () => {
    const at = (needle: string | RegExp) => {
      const i = typeof needle === 'string' ? html.indexOf(needle) : html.search(needle);
      expect(i, String(needle)).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = [at(/<h2[^>]*>Your Octopus<\/h2>/), at('data-slot="preview"'), at(/<h2[^>]*>Your Projects<\/h2>/), at('See live preview'), at('Publishing arrives with accounts')];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('Your Octopus: four template thumbnails (a creator still of each template at its Original palette, labelled by name), nine swatches, four personality pills, Name', () => {
    const left = html.slice(html.indexOf('Your Octopus</h2>'), html.indexOf('Your Projects</h2>'));
    const templates = [...left.matchAll(/<button\b[^>]*data-template="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
    expect(templates.map(m => m[1])).toEqual(['veyra', 'flux', 'nox', 'aether']);
    expect(templates.map(m => textOf(m[2]))).toEqual(['Veyra', 'Flux', 'Nox', 'Aether']);
    for (const m of templates) expect(m[2]).toContain(`src="/platform/stills/creator-${m[1]}-original.webp"`);
    const swatches = [...left.matchAll(/<button\b[^>]*data-palette="([^"]+)"[^>]*>/g)];
    expect(swatches.map(m => m[1])).toEqual([...PALETTE_IDS]);
    const pills = [...left.matchAll(/<button\b[^>]*data-personality="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
    expect(pills.map(m => textOf(m[2]))).toEqual(['Calm', 'Energetic', 'Mysterious', 'Playful']);
    expect(left).toMatch(/<label\b[^>]*>\s*Name\s*<input\b[^>]*value="Your Octopus"/);
    // The order inside the panel: templates, swatches, personality, name.
    const positions = ['data-template=', 'data-palette=', 'data-personality=', 'Name'].map(s => left.indexOf(s));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('the swatch buttons are named by their palette (Original, Lavender, Teal, Mauve, Rose, Coral, Peach, Violet, Lilac grey)', () => {
    const swatches = buttonsIn(html).filter(b => b.attrs.includes('data-palette='));
    expect(swatches.map(nameOf)).toEqual(['Original', 'Lavender', 'Teal', 'Mauve', 'Rose', 'Coral', 'Peach', 'Violet', 'Lilac grey']);
    expect(PALETTE_IDS.map(id => PALETTE_NAMES[id])).toEqual(swatches.map(nameOf));
    // The draft's own choices are the pressed ones: Aether, peach, Playful (spec 7.10's sample).
    const pressed = buttonsIn(html).filter(b => b.attrs.includes('aria-pressed="true"') && /data-(?:template|palette|personality)=/.test(b.attrs));
    expect(pressed.map(b => /data-(?:template|palette|personality)="([^"]+)"/.exec(b.attrs)![1])).toEqual(['aether', 'peach', 'playful']);
  });

  it('the eight swatch colours are the ones sampled from P4, each with its pixel coordinate', () => {
    expect(Object.keys(SWATCH_COLOURS)).toEqual(PALETTE_IDS.filter(id => id !== 'original'));
    for (const [id, swatch] of Object.entries(SWATCH_COLOURS)) {
      expect(swatch.hex, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(swatch.at.x).toBeGreaterThan(0);
      expect(swatch.at.y).toBeGreaterThan(0);
      expect(html, id).toContain(swatch.hex);
    }
  });

  it('has the four personalities of spec 7.13', () => {
    expect(PERSONALITY_IDS).toEqual(['calm', 'energetic', 'mysterious', 'playful']);
    expect(TEMPLATE_IDS).toEqual(['veyra', 'flux', 'nox', 'aether']);
  });

  it("the picture slot is the creator still of the draft's template and palette (nothing live on a server render: the preview starts in the browser) and says the draft name", () => {
    expect(html).toContain('src="/platform/stills/creator-aether-peach.webp"');
    expect(html).not.toContain('data-glyph="octopus"');
    expect(html).not.toContain('<canvas');
    expect(text).toContain('Aether');
    expect(text).toContain('Peach');
  });

  it('the live preview slot carries the draft presets and the still, starts as a still, and has an Overview toggle (not pressed)', () => {
    const slot = html.slice(html.indexOf('class="oct-creator-picture"'), html.indexOf('</section>', html.indexOf('class="oct-creator-picture"')));
    expect(slot).toContain('data-state="still"');
    expect(slot).toContain('data-template="aether"');
    expect(slot).toContain('data-palette="peach"');
    expect(slot).toContain('data-personality="playful"');
    expect(slot).toContain('data-project="sample-project"');
    expect(slot).toMatch(/data-tech="react,typescript,postgresql,redis,docker"/);
    expect(slot).toContain('data-still="/platform/stills/creator-aether-peach.webp"');
    expect(slot).toMatch(/<button[^>]*aria-pressed="false"[^>]*>\s*Overview\s*<\/button>/);
    expect(slot).not.toContain('data-creator-layer');
  });

  it('Your Projects: the project list with an add button, the selected project, and the profile section collapsed', () => {
    const right = html.slice(html.indexOf('Your Projects</h2>'));
    expect(right).toMatch(/aria-label="Add project"/);
    expect(right).toContain('Sample project');
    expect(right).toMatch(/<label\b[^>]*>\s*Title\s*<input\b[^>]*value="Sample project"/);
    expect(right).toMatch(/<label\b[^>]*>\s*Tagline\s*<input\b/);
    expect(right).toMatch(/<label\b[^>]*>\s*Live link\s*<input\b[^>]*type="url"/);
    expect(right).toMatch(/<label\b[^>]*>\s*Repository\s*<input\b[^>]*type="url"/);
    expect(right).toContain('Technologies');
    for (const id of SAMPLE_DRAFT.projects[0].technologies) expect(right).toContain(technologyName(id));
    expect(right).toMatch(/aria-label="Move project up"/);
    expect(right).toMatch(/aria-label="Delete project"/);
    expect(right).toContain('Images');
    // A collapsible profile section, closed (no `open` attribute).
    const details = /<details\b([^>]*)>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(right);
    expect(details).not.toBeNull();
    expect(textOf(details![2])).toBe('Profile');
    expect(details![1]).not.toMatch(/\bopen\b/);
  });

  it('See live preview is a link to the full preview of the selected project, with a stable focus id, and Publish is disabled with the exact text', () => {
    expect(html).toMatch(/<a\b[^>]*href="\/create\/preview\?project=sample-project"[^>]*>[\s\S]*?See live preview/);
    expect(html).toMatch(/<a\b[^>]*data-focus-id="see-live-preview"[^>]*>[\s\S]*?See live preview/);
    const publish = buttonsIn(html).filter(b => b.text === 'Publishing arrives with accounts');
    expect(publish).toHaveLength(1);
    expect(publish[0].attrs).toMatch(/\bdisabled\b/);
    expect(textOf(html.slice(html.indexOf('Publishing arrives')))).toMatch(/^Publishing arrives with accounts/);
  });

  it('edits only presets and content: no colour picker, slider, file path or geometry control', () => {
    for (const phone of [false, true]) {
      const page = render(phone ? 'phone' : 'wide');
      expect(page).not.toMatch(/type="color"/);
      expect(page).not.toMatch(/type="range"/);
      // The only file input is the project images' (Task 19a): PNG, JPEG or WebP, never a free path.
      expect([...page.matchAll(/<input[^>]*type="file"[^>]*>/g)].every(m => m[0].includes('accept="image/png,image/jpeg,image/webp"'))).toBe(true);
      expect(page).not.toContain('<select');
      const types = [...page.matchAll(/<input\b[^>]*>/g)].map(m => /type="([^"]+)"/.exec(m[0])?.[1] ?? 'text');
      for (const type of types) expect(['text', 'url', 'file']).toContain(type);
      expect(page).not.toMatch(/geometry|curve|\bpose\b|slider|\.glb|\.gltf|\.obj\b/i);
    }
  });

  it('every input has a visible label (a wrapping label)', () => {
    const inputs = [...html.matchAll(/<(input|textarea)\b/g)].length;
    const labelled = [...html.matchAll(/<label\b[^>]*>(?:[^<]|<span[^>]*>[^<]*<\/span>)*<(?:input|textarea)\b/g)].length;
    expect(labelled).toBe(inputs);
  });

  it('shows no sentence that promises more than it does, and no fake counts', () => {
    expect(text).not.toMatch(/\bPro\b|upgrade|followers/i);
  });

  it('wide: no tab list (both panels show)', () => {
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
  });
});

describe('the creator on a phone (spec 7.15)', () => {
  const html = render('phone');

  it('puts the preview first, then the two panels as the tabs Octopus and Projects, then the actions', () => {
    expect(html).toContain('role="tablist"');
    const tabs = [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map(m => textOf(m[1]));
    expect(tabs).toEqual(['Octopus', 'Projects']);
    const order = [html.indexOf('data-slot="preview"'), html.indexOf('role="tablist"'), html.indexOf('See live preview')];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(i => i >= 0)).toBe(true);
  });

  it('wires each tab to its panel, and only the selected panel shows', () => {
    const tabTags = [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map(m => m[0]);
    const panels = [...html.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>/g)].map(m => m[0]);
    expect(panels).toHaveLength(2);
    expect(tabTags.map(t => /aria-selected="(true|false)"/.exec(t)![1])).toEqual(['true', 'false']);
    expect(tabTags.map(t => /tabindex="(-?\d)"/.exec(t)![1])).toEqual(['0', '-1']);
    for (const [i, tab] of tabTags.entries()) {
      expect(panels[i]).toContain(`id="${/aria-controls="([^"]+)"/.exec(tab)![1]}"`);
      expect(panels[i]).toContain(`aria-labelledby="${/\bid="([^"]+)"/.exec(tab)![1]}"`);
    }
    expect(panels.map(p => p.includes(' hidden'))).toEqual([false, true]);
  });

  it('keeps both panels in the page and the same controls as the wide layout', () => {
    expect(html).toMatch(/<h2[^>]*>Your Octopus<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>Your Projects<\/h2>/);
    expect(buttonsIn(html).filter(b => b.attrs.includes('data-palette=')).map(nameOf)).toHaveLength(9);
    expect(buttonsIn(html).some(b => b.text === 'Publishing arrives with accounts')).toBe(true);
  });
});

describe('draft edits (pure; the draft is a copy, never the sample itself)', () => {
  it('changes one preset and stamps updatedAt, leaving the sample untouched', () => {
    const next = withOctopus(SAMPLE_DRAFT, { palette: 'teal' });
    expect(next.octopus).toEqual({ ...SAMPLE_DRAFT.octopus, palette: 'teal' });
    expect(next).not.toBe(SAMPLE_DRAFT);
    expect(SAMPLE_DRAFT.octopus.palette).toBe('peach');
    expect(next.updatedAt >= SAMPLE_DRAFT.updatedAt).toBe(true);
  });

  it('edits the profile and a project by id, and adds a project up to eight', () => {
    expect(withProfile(SAMPLE_DRAFT, { tagline: 'x' }).profile.tagline).toBe('x');
    const id = SAMPLE_DRAFT.projects[0].id;
    expect(withProject(SAMPLE_DRAFT, id, { title: 'New title' }).projects[0].title).toBe('New title');
    expect(withProject(SAMPLE_DRAFT, 'nope', { title: 'x' })).toEqual(SAMPLE_DRAFT);
    let draft = SAMPLE_DRAFT;
    for (let i = 0; i < 12; i++) draft = addProject(draft);
    expect(draft.projects).toHaveLength(8);
    expect(new Set(draft.projects.map(p => p.id)).size).toBe(8);
    expect(new Set(draft.projects.map(p => p.slug)).size).toBe(8);
    expect(draft.projects[1]).toMatchObject({ title: '', technologies: [], media: [] });
  });

  it('the sample is Aether, peach, one project of at most 30 known technologies, and is deeply frozen', () => {
    expect(SAMPLE_DRAFT.version).toBe(1);
    expect(SAMPLE_DRAFT.octopus).toMatchObject({ template: 'aether', palette: 'peach' });
    expect(SAMPLE_DRAFT.projects).toHaveLength(1);
    const techs = SAMPLE_DRAFT.projects[0].technologies;
    expect(techs.length).toBeGreaterThan(2);
    expect(techs.length).toBeLessThanOrEqual(30);
    for (const id of techs) expect(technologyName(id)).not.toBe(id);
    expect(Object.isFrozen(SAMPLE_DRAFT)).toBe(true);
    expect(Object.isFrozen(SAMPLE_DRAFT.projects[0])).toBe(true);
  });
});
