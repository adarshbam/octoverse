import { describe, expect, it } from 'vitest';
import { validateBundle } from '../../engine/types/bundle';
import { SHOWCASE } from '../fixtures/showcase';
import { emptyDraft } from './draft';
import { chooseProject, draftOrSample, mediaIdsOf, PROJECT_PARAM, previewBundleFor, previewHref, projectIdFrom } from './previewDraft';
import { SAMPLE_DRAFT } from './sampleDraft';
import { TEMPLATES } from './templates';
import { TEMPLATE_IDS, type CreatorDraft, type DraftProject } from './types';

// The full draft preview's pure parts (platform Task 20; spec 7.13, 2.6): which draft and which project the page shows, and the bundle
// it hands to the engine. A draft with no project, a project with no technologies or no sections, an unknown selected id and a
// malformed stored draft all still give a bundle the engine accepts (the page opens the intro with an empty overview, never an error).

const project = (over: Partial<DraftProject> = {}): DraftProject => ({ id: 'p1', slug: 'p1', title: 'One', tagline: 'First', sections: [], links: {}, technologies: ['react'], usage: {}, media: [], ...over });
const draftWith = (projects: DraftProject[], over: Partial<CreatorDraft['octopus']> = {}): CreatorDraft => ({
  ...structuredClone(SAMPLE_DRAFT),
  octopus: { ...SAMPLE_DRAFT.octopus, template: 'veyra', ...over },
  profile: { ...SAMPLE_DRAFT.profile, handle: 'mira' },
  projects,
});

describe('which draft the page shows', () => {
  it('is the sample when nothing is stored (as in the creator)', () => {
    expect(draftOrSample(null)).toBe(SAMPLE_DRAFT);
    expect(draftOrSample(undefined)).toBe(SAMPLE_DRAFT);
  });

  it('is the stored draft, migrated like the creator does', () => {
    const stored = { ...structuredClone(SAMPLE_DRAFT), octopus: { ...SAMPLE_DRAFT.octopus, template: 'nox', palette: 'teal', name: 'Mira' } };
    expect(draftOrSample(stored).octopus).toMatchObject({ template: 'nox', palette: 'teal', name: 'Mira' });
  });

  it.each([['a number', 42], ['a string', 'x'], ['an array', []], ['another version', { version: 9 }], ['an empty object', {}]])('does not throw for a malformed stored draft (%s): it is the creator\'s empty draft', (_n, stored) => {
    expect({ ...draftOrSample(stored), updatedAt: '' }).toEqual({ ...emptyDraft(), updatedAt: '' });
  });

  it('survives hostile stored values: a prototype-polluting key, a huge string, deep nesting, a throwing getter-free odd shape', () => {
    const hostile = JSON.parse('{"version":1,"__proto__":{"polluted":true},"octopus":{"template":"__proto__","palette":"constructor","name":"' + 'x'.repeat(100000) + '"},"profile":{"handle":"__proto__"},"projects":[{"id":"__proto__","technologies":["__proto__","constructor"],"usage":{"__proto__":"x"},"media":[null,5]},null,7]}');
    for (const stored of [hostile, [[[[[[]]]]]], Object.create(null), { version: 1, projects: [{}], octopus: [] }]) {
      const draft = draftOrSample(stored);
      const id = chooseProject(draft, 'constructor');
      expect(() => validateBundle(previewBundleFor(draft, id, {}))).not.toThrow();
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('repairs fields of a version-1 draft that are the wrong type', () => {
    const draft = draftOrSample({ version: 1, octopus: { template: 'nope', palette: 7, name: null }, profile: 5, projects: 'x' });
    expect(TEMPLATE_IDS).toContain(draft.octopus.template);
    expect(draft.projects).toEqual([]);
  });
});

describe('which project the page shows', () => {
  const draft = draftWith([project({ id: 'a' }), project({ id: 'b', slug: 'b', title: 'Two' })]);

  it('is the one named, the first when it is not named or unknown, null when the draft has none', () => {
    expect(chooseProject(draft, 'b')).toBe('b');
    expect(chooseProject(draft, null)).toBe('a');
    expect(chooseProject(draft, 'gone')).toBe('a');
    expect(chooseProject(draft, '')).toBe('a');
    expect(chooseProject(draftWith([]), 'a')).toBeNull();
    expect(chooseProject(draftWith([]), null)).toBeNull();
  });

  it('is read from the address (?project=)', () => {
    expect(PROJECT_PARAM).toBe('project');
    expect(projectIdFrom('?project=beta')).toBe('beta');
    expect(projectIdFrom('?view=overview&project=beta')).toBe('beta');
    expect(projectIdFrom('?project=')).toBeNull();
    expect(projectIdFrom('?view=overview')).toBeNull();
    expect(projectIdFrom('')).toBeNull();
  });

  it('is put in the link the creator opens (See live preview), encoded', () => {
    expect(previewHref(null)).toBe('/create/preview');
    expect(previewHref('beta')).toBe('/create/preview?project=beta');
    expect(previewHref('a b&c')).toBe('/create/preview?project=a+b%26c');
    expect(projectIdFrom(previewHref('a b&c').slice('/create/preview'.length))).toBe('a b&c');
  });
});

describe('the bundle the page gives the engine', () => {
  it('is the template world in the draft colours with the chosen project, as u-<handle>', () => {
    const draft = draftWith([project({ id: 'a', title: 'Alpha' }), project({ id: 'b', slug: 'b', title: 'Beta', technologies: ['rust'] })], { palette: 'teal', name: 'Mira' });
    const bundle = previewBundleFor(draft, 'b', {});
    expect(bundle.id).toBe('u-mira');
    expect(bundle.content.project.name).toBe('Beta');
    expect(bundle.content.technologies.map(t => t.id)).toEqual(['rust']);
    expect(bundle.theme.pageTitle).toBe('Mira · Beta');
    // The template's FULL world: its place (kit) is the template's own, not a backdrop.
    expect(bundle.place).toBe(TEMPLATES.veyra.bundle.place);
    expect(() => validateBundle(bundle)).not.toThrow();
  });

  it.each(TEMPLATE_IDS)('is accepted by the engine for %s, with a draft of no projects, a project with no technologies and a project with no sections', template => {
    const cases: Array<[string, CreatorDraft, string | null]> = [
      ['no projects', draftWith([], { template }), null],
      ['no technologies', draftWith([project({ technologies: [] })], { template }), 'p1'],
      ['no sections', draftWith([project({ sections: [] })], { template }), 'p1'],
      ['an unknown selected id', draftWith([project()], { template }), 'gone'],
      ['an empty name and handle', { ...draftWith([project()], { template, name: '' }), profile: { handle: '', tagline: '', about: '' } }, 'p1'],
      ['an unknown technology id', draftWith([project({ technologies: ['not-a-technology'] })], { template }), 'p1'],
    ];
    for (const [what, draft, id] of cases) {
      const bundle = previewBundleFor(draft, chooseProject(draft, id), {});
      expect(() => validateBundle(bundle), what).not.toThrow();
    }
    const none = previewBundleFor(draftWith([], { template }), null, {});
    expect(none.content.technologies).toEqual([]);
    expect(none.content.project.name).toBe('Untitled project');
    expect(none.id).toBe('u-mira');
    expect(previewBundleFor({ ...draftWith([project()], { template }), profile: { handle: '', tagline: '', about: '' } }, 'p1', {}).id).toBe('u-preview');
  });

  it('shows only the images whose stored file was read, at the address it was given', () => {
    const draft = draftWith([project({ media: [{ id: 'm1', name: 'one.png', type: 'image/png', size: 5 }, { id: 'm2', name: 'two.png', type: 'image/png', size: 5 }] })]);
    expect(mediaIdsOf(draft, 'p1')).toEqual(['m1', 'm2']);
    expect(mediaIdsOf(draft, 'gone')).toEqual(['m1', 'm2']);
    expect(mediaIdsOf(draftWith([]), null)).toEqual([]);
    const bundle = previewBundleFor(draft, 'p1', { m1: 'blob:http://localhost/abc' });
    expect(bundle.content.project.media).toEqual([expect.objectContaining({ id: 'm1', url: 'blob:http://localhost/abc', alt: 'one.png' })]);
    expect(previewBundleFor(draft, 'p1', {}).content.project.media).toEqual([]);
  });
});

describe('fixture isolation (spec 2.6): building a preview never changes a showcase profile or a template', () => {
  const snapshot = () => JSON.stringify({ showcase: SHOWCASE, templates: TEMPLATE_IDS.map(id => TEMPLATES[id].bundle) });

  it('leaves SHOWCASE and every template bundle exactly as they were, over many kinds of draft', () => {
    const before = snapshot();
    const media = [{ id: 'm1', name: 'one.png', type: 'image/png' as const, size: 5 }];
    for (const template of TEMPLATE_IDS) {
      for (const palette of ['original', 'teal', 'rose', 'lilacGrey'] as const) {
        const draft = draftWith([project({ title: 'Edited', technologies: ['react', 'rust', 'docker'], media, usage: { react: 'note' } }), project({ id: 'q', slug: 'q', technologies: [] })], { template, palette, name: 'Changed' });
        previewBundleFor(draft, 'p1', { m1: 'blob:x' });
        previewBundleFor(draft, 'q', {});
      }
      previewBundleFor(draftWith([], { template }), null, {});
    }
    expect(snapshot()).toBe(before);
  });

  it('a Veyra-template draft never aliases the showcase Veyra profile\'s bundle or content', () => {
    const veyra = SHOWCASE.find(p => p.world === 'veyra')!;
    const draft = draftWith([project({ title: 'Mine' })], { template: 'veyra', name: veyra.name });
    const bundle = previewBundleFor(draft, 'p1', {});
    expect(bundle.content.project.name).toBe('Mine');
    expect(JSON.stringify(SHOWCASE.find(p => p.world === 'veyra'))).toBe(JSON.stringify(veyra));
    // Different content object: the template's own, with its content removed, is not touched.
    expect(Object.hasOwn(TEMPLATES.veyra.bundle, 'content')).toBe(false);
  });
});
