import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { issueFor, issueText } from './issueText';
import { LinkField } from './LinkField';
import { ProjectsPanel, UNDO_MS } from './ProjectsPanel';
import { TechnologyPicker, PICKER_LIMIT } from './TechnologyPicker';
import { addMedia, addProject, setLink, setUsage, updateProject, withProfile } from './draftEdits';
import { CATALOG } from './catalog';
import { SAMPLE_DRAFT } from './sampleDraft';

// Server rendering stands in for jsdom (not installed): the markup of each part of the editor in each state. Clicks, timers, focus and
// object urls are tests/e2e/platform-creator-editor.spec.ts's.
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const textOf = (html: string) => decode(html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const noop = () => {};
const panel = (draft = SAMPLE_DRAFT, media?: { put: (b: Blob) => Promise<string>; get: (id: string) => Promise<Blob | null> }) => renderToStaticMarkup(createElement(ProjectsPanel, { draft, onChange: noop, media }));
const picker = (over: Partial<Parameters<typeof TechnologyPicker>[0]> = {}) =>
  renderToStaticMarkup(createElement(TechnologyPicker, { chosen: [], usage: {}, onAdd: noop, onRemove: noop, onNote: noop, ...over }));
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({ attrs: m[1], text: textOf(m[2]), label: /aria-label="([^"]*)"/.exec(m[1])?.[1] }));

describe('issue text', () => {
  it('puts the field name before a message that starts mid-sentence, and leaves a full sentence alone', () => {
    expect(issueText('Handle', 'needs 2 to 24 lower case letters')).toBe('Handle needs 2 to 24 lower case letters');
    expect(issueText('Handle', '"x" is reserved')).toBe('Handle "x" is reserved');
    expect(issueText('Handle', 'That handle is used by a showcase portfolio')).toBe('That handle is used by a showcase portfolio');
    expect(issueFor([{ field: 'a', message: 'needs x' }], 'a', 'Name')).toBe('Name needs x');
    expect(issueFor([], 'a', 'Name')).toBeUndefined();
  });
});

describe('a project link (https only; a bad one is kept, flagged and not linked)', () => {
  const field = (value: string) => renderToStaticMarkup(createElement(LinkField, { label: 'Live link', value, onChange: noop }));

  it('an https link has no flag and is a link that opens safely in a new tab', () => {
    const html = field('https://example.com/demo');
    expect(html).not.toContain('data-issue');
    expect(html).not.toContain('aria-invalid');
    expect(html).toMatch(/<a\b[^>]*href="https:\/\/example.com\/demo"[^>]*rel="noopener noreferrer"[^>]*>/);
  });

  it('a bad link keeps its text, is flagged with the message, and is plain text, never an anchor', () => {
    for (const bad of ['http://example.com', 'example.com', 'javascript:alert(1)', 'ftp://x.y/z']) {
      const html = field(bad);
      expect(html, bad).toContain(`value="${bad}"`);
      expect(html, bad).toContain('aria-invalid="true"');
      expect(textOf(html), bad).toContain('This link must start with https://');
      expect(html, bad).not.toContain('<a ');
      expect(html, bad).not.toContain('href=');
      expect(html, bad).toMatch(/data-link-plain/);
      const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
      expect(html, bad).toContain(`id="${describedBy}"`);
    }
  });

  it('an empty link shows nothing but the field', () => {
    const html = field('');
    expect(html).not.toContain('data-issue');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('data-link-plain');
  });
});

describe('the technology picker (a search over the catalog)', () => {
  it('lists catalog entries as buttons named for the technology, at most a short page, with how many there are in all', () => {
    const html = picker();
    const items = buttons(html).filter(b => b.attrs.includes('data-picker-id'));
    expect(items).toHaveLength(PICKER_LIMIT);
    expect(items[0].text.startsWith(CATALOG[0].name)).toBe(true);
    expect(textOf(html)).toContain(`Showing ${PICKER_LIMIT} of ${CATALOG.length}`);
  });

  it('a filter narrows the list by name, ignoring case', () => {
    const html = picker({ initialQuery: 'TYPESC' });
    const items = buttons(html).filter(b => b.attrs.includes('data-picker-id'));
    expect(items.map(b => b.text)).toEqual([expect.stringMatching(/^TypeScript/)]);
    expect(textOf(html)).toContain('1 match.');
  });

  it('says when nothing matches, and offers no free-text add', () => {
    const html = picker({ initialQuery: 'zzzzqqq' });
    expect(buttons(html).filter(b => b.attrs.includes('data-picker-id'))).toEqual([]);
    expect(textOf(html)).toContain('No technology matches "zzzzqqq".');
    expect(textOf(html)).not.toMatch(/add "zzzzqqq"|create/i);
  });

  it('the filter is a labelled input', () => {
    expect(picker()).toMatch(/<label\b[^>]*>\s*Search technologies\s*<input\b[^>]*type="text"/);
  });

  it('the chosen ones are chips in the order picked, each removable by name, with an optional usage note; picked ones show as pressed', () => {
    const html = picker({ chosen: ['rust', 'react'], usage: { react: 'The whole UI' }, initialQuery: 'react' });
    const chips = [...html.matchAll(/data-tech-id="([^"]+)"/g)].map(m => m[1]);
    expect(chips).toEqual(['rust', 'react']);
    expect(buttons(html).map(b => b.label)).toEqual(expect.arrayContaining(['Remove Rust', 'Remove React']));
    expect(html).toMatch(/<label\b[^>]*>\s*Usage note for React \(optional\)\s*<input\b[^>]*value="The whole UI"/);
    expect(html).toMatch(/<label\b[^>]*>\s*Usage note for Rust \(optional\)\s*<input\b[^>]*value=""/);
    expect(textOf(html)).toContain('Shown in the order you picked them.');
    const reactItem = buttons(html).find(b => b.attrs.includes('data-picker-id="react"'))!;
    expect(reactItem.attrs).toContain('aria-pressed="true"');
  });

  it('at 30 technologies the unpicked buttons are disabled and it says why', () => {
    const chosen = CATALOG.slice(0, 30).map(t => t.id);
    const html = picker({ chosen, initialQuery: 'figma' });
    expect(textOf(html)).toContain('at most 30 technologies');
    const items = buttons(html).filter(b => b.attrs.includes('data-picker-id'));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.attrs.includes('disabled')).toBe(!item.attrs.includes('aria-pressed="true"'));
  });

  it('with none chosen it says "None yet"', () => {
    expect(textOf(picker())).toContain('None yet');
  });
});

describe('Your Projects (the editor)', () => {
  it('lists the projects, an Add button, and actions for the selected one: move up, move down, delete', () => {
    const html = panel(addProject(SAMPLE_DRAFT));
    const names = buttons(html).map(b => b.label ?? b.text);
    for (const name of ['Add project', 'Move project up', 'Move project down', 'Delete project']) expect(names).toContain(name);
    expect(html).toMatch(/role="group"[^>]*aria-label="Selected project actions"/);
    // The first of two is selected: Up is unavailable but stays focusable (aria-disabled), Down works.
    const up = buttons(html).find(b => b.label === 'Move project up')!;
    const down = buttons(html).find(b => b.label === 'Move project down')!;
    expect(up.attrs).toContain('aria-disabled="true"');
    expect(down.attrs).not.toContain('aria-disabled');
    expect(up.attrs).not.toMatch(/\sdisabled/);
  });

  it('an untitled project is listed as "Untitled project" and its title field says so', () => {
    const draft = updateProject(SAMPLE_DRAFT, 'sample-project', { title: '' });
    const html = panel(draft);
    const row = /<button\b[^>]*data-project-id="sample-project"[^>]*>([\s\S]*?)<\/button>/.exec(html)!;
    expect(textOf(row[1])).toBe('Untitled project');
    expect(html).toMatch(/<label\b[^>]*>\s*Title\s*<input\b[^>]*value=""[^>]*placeholder="Untitled project"|<label\b[^>]*>\s*Title\s*<input\b[^>]*placeholder="Untitled project"[^>]*value=""/);
    expect(textOf(html)).toContain('shows as "Untitled project"');
  });

  it('with no project it says so and offers only Add', () => {
    const html = panel({ ...SAMPLE_DRAFT, projects: [] });
    expect(textOf(html)).toContain('No projects yet');
    expect(buttons(html).map(b => b.label ?? b.text)).not.toContain('Delete project');
  });

  it('Add project is disabled at eight', () => {
    let draft = SAMPLE_DRAFT;
    for (let i = 0; i < 8; i++) draft = addProject(draft);
    const add = buttons(panel(draft)).find(b => b.label === 'Add project')!;
    expect(add.attrs).toMatch(/\sdisabled/);
  });

  it('the selected project: title, tagline, description, two links, technologies, images', () => {
    const html = panel();
    const labels = [...html.matchAll(/<label\b[^>]*>\s*([^<]+?)\s*<(?:input|textarea)\b/g)].map(m => decode(m[1]));
    expect(labels).toEqual(expect.arrayContaining(['Title', 'Tagline', 'Description', 'Live link', 'Repository', 'Search technologies']));
    expect(textOf(html)).toContain('Technologies');
    expect(textOf(html)).toContain('Images');
  });

  it('a project with a bad link shows the flag, and the same link as plain text', () => {
    const draft = setLink(SAMPLE_DRAFT, 'sample-project', 'repo', 'github.com/me/app');
    const html = panel(draft);
    expect(textOf(html)).toContain('This link must start with https://');
    expect(html).toContain('data-link-plain');
  });

  it('chosen technologies and their usage notes are in the panel, in declared order', () => {
    const draft = setUsage(SAMPLE_DRAFT, 'sample-project', 'docker', 'Ships it');
    const html = panel(draft);
    const chips = [...html.matchAll(/class="oct-selected-tech" data-tech-id="([^"]+)"/g)].map(m => m[1]);
    expect(chips).toEqual(SAMPLE_DRAFT.projects[0].technologies);
    expect(html).toContain('value="Ships it"');
  });

  it('images say "Saved in this browser only", accept PNG, JPEG and WebP only, and the file input has a visible label', () => {
    const html = panel();
    expect(textOf(html)).toContain('Saved in this browser only');
    const input = /<input\b[^>]*type="file"[^>]*>/.exec(html)![0];
    expect(input).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).toMatch(/<label\b[^>]*class="oct-file"[^>]*>[\s\S]*?<span[^>]*>Add image<\/span>\s*<input\b[^>]*type="file"/);
  });

  it('without a media store (server render, tests) adding an image is disabled', () => {
    expect(/<input\b[^>]*type="file"[^>]*>/.exec(panel())![0]).toMatch(/\sdisabled/);
    const media = { put: async () => 'x', get: async () => null };
    expect(/<input\b[^>]*type="file"[^>]*>/.exec(panel(SAMPLE_DRAFT, media))![0]).not.toMatch(/\sdisabled/);
  });

  it('a project with images lists each by name with a Remove button; at four the add control is disabled', () => {
    let draft = SAMPLE_DRAFT;
    for (let n = 1; n <= 4; n++) draft = addMedia(draft, 'sample-project', { id: `m${n}`, name: `shot-${n}.png`, type: 'image/png', size: 10 });
    const media = { put: async () => 'x', get: async () => null };
    const html = panel(draft, media);
    for (let n = 1; n <= 4; n++) expect(buttons(html).map(b => b.label)).toContain(`Remove image shot-${n}.png`);
    expect(/<input\b[^>]*type="file"[^>]*>/.exec(html)![0]).toMatch(/\sdisabled/);
    expect(textOf(html)).toContain('at most 4 images');
  });

  it('the Profile section is collapsed, labelled, with handle, tagline, about, location and link, and flags a bad handle and link inline', () => {
    const draft = withProfile(SAMPLE_DRAFT, { handle: 'Bad Handle', link: 'http://nope.example' });
    const html = panel(draft);
    const fold = /<details\b([^>]*)>([\s\S]*?)<\/details>/.exec(html)!;
    expect(fold[1]).not.toMatch(/\bopen\b/);
    const text = textOf(fold[2]);
    expect(text).toContain('Handle needs 2 to 24 lower case letters');
    expect(text).toContain('Link needs an https:// address');
    expect(fold[2]).toContain('aria-invalid="true"');
    // The summary says something needs a look, since the section is closed.
    expect(textOf(/<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(html)![1])).toMatch(/^Profile.*needs a look/);
    // A valid profile does not.
    expect(textOf(/<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(panel())![1])).toBe('Profile');
  });

  it('the undo window is five seconds', () => {
    expect(UNDO_MS).toBe(5000);
  });

  it('every input and textarea has a wrapping label with its text before it', () => {
    const html = panel(setUsage(SAMPLE_DRAFT, 'sample-project', 'react', 'x'), { put: async () => 'x', get: async () => null });
    const inputs = [...html.matchAll(/<(input|textarea)\b/g)].length;
    const labelled = [...html.matchAll(/<label\b[^>]*>(?:[^<]|<span[^>]*>[^<]*<\/span>)*<(?:input|textarea)\b/g)].length;
    expect(labelled).toBe(inputs);
  });
});
