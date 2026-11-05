import { describe, expect, it } from 'vitest';
import { validateBundle } from '../../engine/types/bundle';
import { SHOWCASE } from '../fixtures/showcase';
import { assembleBundle } from './assembleBundle';
import { CATALOG } from './catalog';
import { emptyDraft } from './draft';
import { draftToContent } from './draftToContent';
import { faceRuleHolds } from './palettes';
import { PERSONALITIES } from './personalities';
import { SAMPLE_DRAFT } from './sampleDraft';
import { TEMPLATES } from './templates';
import { PALETTE_IDS, PERSONALITY_IDS, TEMPLATE_IDS, type CreatorDraft, type DraftProject } from './types';

const SWATCH_PALETTES = PALETTE_IDS.filter(p => p !== 'original');
const WORLD_ID = /^[a-z][a-z0-9-]{1,31}$/;
const emptyContent = draftToContent(emptyDraft(), null);
const presets = (palette: (typeof PALETTE_IDS)[number], personality: (typeof PERSONALITY_IDS)[number]) => ({ palette, personality, name: '', handle: 'review' });

/** A stable text of a value: functions (a sequence loader) are named, not followed. */
const snap = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === 'function' ? '[function]' : v));
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

describe('draftToContent', () => {
  const project = (patch: Partial<DraftProject> = {}): DraftProject => ({ id: 'p1', slug: 'my-app', title: 'My App', tagline: 'Fast.', sections: [], links: {}, technologies: [], usage: {}, media: [], ...patch });
  const draft = (projects: DraftProject[], over: Partial<CreatorDraft['octopus']> = {}): CreatorDraft => ({ ...emptyDraft(), octopus: { ...emptyDraft().octopus, name: 'Mo', ...over }, projects });

  it('no project: "Untitled project" with no technologies', () => {
    const { project: p, technologies } = draftToContent(emptyDraft(), null);
    expect(p.name).toBe('Untitled project');
    expect(technologies).toEqual([]);
    expect(p.technologyUsages ?? []).toEqual([]);
    expect(p.primaryTechnologyIds ?? []).toEqual([]);
  });

  it('an empty octopus name previews as "Your Octopus"; a name is kept', () => {
    expect(draftToContent(draft([project()], { name: '' }), 'p1').project.characterName).toBe('Your Octopus');
    expect(draftToContent(draft([project()], { name: 'Mo' }), 'p1').project.characterName).toBe('Mo');
  });

  it('an untitled project previews as "Untitled project"', () => {
    expect(draftToContent(draft([project({ title: '  ' })]), 'p1').project.name).toBe('Untitled project');
  });

  it('picks the project by id; null or an unknown id picks the first', () => {
    const d = draft([project(), project({ id: 'p2', slug: 'two', title: 'Two' })]);
    expect(draftToContent(d, 'p2').project.name).toBe('Two');
    expect(draftToContent(d, null).project.name).toBe('My App');
    expect(draftToContent(d, 'zzz').project.name).toBe('My App');
  });

  it('technologies are the catalog entries, in declared order; unknown ids and repeats are left out; at most 30', () => {
    const ids = ['typescript', 'nope', 'react', 'typescript', ...CATALOG.slice(0, 40).map(t => t.id)];
    const { project: p, technologies } = draftToContent(draft([project({ technologies: ids })]), 'p1');
    expect(technologies.map(t => t.id).slice(0, 2)).toEqual(['typescript', 'react']);
    expect(technologies).toHaveLength(30);
    expect(new Set(technologies.map(t => t.id)).size).toBe(30);
    expect(p.technologyUsages).toHaveLength(30);
    expect(p.primaryTechnologyIds).toHaveLength(15);
    expect(p.primaryTechnologyIds).toEqual(technologies.slice(0, 15).map(t => t.id));
  });

  it('a usage note becomes the technology usage summary', () => {
    const { project: p } = draftToContent(draft([project({ technologies: ['react'], usage: { react: 'The UI.' } })]), 'p1');
    expect(p.technologyUsages?.[0]).toMatchObject({ technologyId: 'react', summary: 'The UI.' });
  });

  it('links: only https links are kept', () => {
    const { project: p } = draftToContent(draft([project({ links: { live: 'https://a.example', repo: 'http://b.example' } })]), 'p1');
    // The normalised address is passed on (a trailing slash, a lower-case host), not the text as typed.
    expect(p.links?.map(l => l.url)).toEqual(['https://a.example/']);
  });

  it('links: an upper-case scheme and host come out normalised', () => {
    const { project: p } = draftToContent(draft([project({ links: { live: 'HTTPS://X.COM', repo: 'https://github.com/a/b' } })]), 'p1');
    expect(p.links?.map(l => l.url)).toEqual(['https://x.com/', 'https://github.com/a/b']);
  });

  it('media: refs become project media, url from the map or a local placeholder', () => {
    const media = [{ id: 'm1', name: 'shot.png', type: 'image/png' as const, size: 4 }];
    const withUrl = draftToContent(draft([project({ media })]), 'p1', { m1: 'blob:abc' });
    expect(withUrl.project.media?.[0]).toMatchObject({ id: 'm1', url: 'blob:abc', alt: 'shot.png' });
    expect(draftToContent(draft([project({ media })]), 'p1').project.media?.[0].url).toBe('local-media:m1');
  });

  it('hostile ids (constructor, __proto__, toString) get the placeholder url, never an inherited value', () => {
    const media = ['constructor', '__proto__', 'toString', 'hasOwnProperty'].map(id => ({ id, name: `${id}.png`, type: 'image/png' as const, size: 4 }));
    const { project: p } = draftToContent(draft([project({ media, technologies: ['react'], usage: { react: 'ok' } })]), 'p1', { real: 'blob:1' });
    expect(p.media?.map(m => m.url)).toEqual(media.map(m => `local-media:${m.id}`));
    const hostileUsage = JSON.parse('{"constructor":"x","__proto__":"y"}') as Record<string, string>;
    expect(draftToContent(draft([project({ technologies: ['react'], usage: hostileUsage })]), 'p1').project.technologyUsages?.[0]).toEqual({ id: 'usage-react', technologyId: 'react' });
  });

  it('sections with a body become sections with a title from their id', () => {
    const { project: p } = draftToContent(draft([project({ sections: [{ id: 'the-problem', body: 'Text.' }, { id: 'empty', body: '' }] })]), 'p1');
    expect(p.sections?.map(s => [s.id, s.title, s.content])).toEqual([['the-problem', 'The problem', 'Text.']]);
  });

  it('never returns a frozen or shared object the caller could use to change a fixture', () => {
    const a = draftToContent(SAMPLE_DRAFT, null);
    expect(Object.isFrozen(a.project)).toBe(false);
    expect(a.project).not.toBe(draftToContent(SAMPLE_DRAFT, null).project);
  });
});

describe('assembleBundle: the 128 combinations', () => {
  it('has the numbers the plan says', () => {
    expect(TEMPLATE_IDS.length * SWATCH_PALETTES.length * PERSONALITY_IDS.length).toBe(128);
  });

  it('every combination validates, keeps eight arms and the face rule, and has a creator id', () => {
    let count = 0;
    for (const t of TEMPLATE_IDS) {
      const template = TEMPLATES[t];
      for (const palette of SWATCH_PALETTES) {
        for (const personality of PERSONALITY_IDS) {
          const label = `${t}.${palette}.${personality}`;
          const bundle = assembleBundle(template, presets(palette, personality), emptyContent);
          expect(() => validateBundle(bundle), label).not.toThrow();
          expect(bundle.character.arms, label).toHaveLength(8);
          expect(Object.keys(bundle.poses.intro.arms), label).toHaveLength(8);
          expect(faceRuleHolds(bundle.character, template), label).toBe(true);
          expect(bundle.id, label).toBe('u-review');
          expect(bundle.id, label).toMatch(WORLD_ID);
          expect(bundle.sequences.projectId, label).toBe(template.bundle.sequences.projectId);
          expect(bundle.character.personality, label).toEqual(PERSONALITIES[personality]);
          count += 1;
        }
      }
    }
    expect(count).toBe(128);
  });

  it('Original palette keeps the template colours, with any personality', () => {
    for (const t of TEMPLATE_IDS) {
      const bundle = assembleBundle(TEMPLATES[t], presets('original', 'calm'), emptyContent);
      expect({ ...bundle.character, personality: null }).toEqual({ ...TEMPLATES[t].bundle.character, personality: null });
      expect(() => validateBundle(bundle)).not.toThrow();
    }
  });

  it('is immutable: no template, personality or character is changed, by all 128 combinations nor by the Original ones', () => {
    const before = TEMPLATE_IDS.map(t => snap(TEMPLATES[t].bundle));
    const personalitiesBefore = snap(PERSONALITIES);
    const sharedBefore = TEMPLATE_IDS.map(t => TEMPLATES[t].bundle.character);
    for (const t of TEMPLATE_IDS) {
      for (const palette of PALETTE_IDS) {
        for (const personality of PERSONALITY_IDS) {
          const bundle = assembleBundle(TEMPLATES[t], presets(palette, personality), emptyContent);
          expect(bundle.character, `${t}.${palette}`).not.toBe(TEMPLATES[t].bundle.character);
        }
      }
    }
    expect(TEMPLATE_IDS.map(t => snap(TEMPLATES[t].bundle))).toEqual(before);
    expect(snap(PERSONALITIES)).toBe(personalitiesBefore);
    expect(TEMPLATE_IDS.map(t => TEMPLATES[t].bundle.character)).toEqual(sharedBefore);
    TEMPLATE_IDS.forEach((t, i) => expect(TEMPLATES[t].bundle.character).toBe(sharedBefore[i]));
  });

  it('works over a deeply frozen template, content and presets (any assignment would throw)', () => {
    for (const t of TEMPLATE_IDS) {
      const template = { ...TEMPLATES[t], bundle: { ...TEMPLATES[t].bundle, character: deepFreeze(structuredClone(TEMPLATES[t].bundle.character)) } };
      const content = deepFreeze(structuredClone(draftToContent(SAMPLE_DRAFT, null)));
      const frozenPresets = deepFreeze({ palette: 'rose' as const, personality: 'calm' as const, name: 'Mo', handle: 'mo' });
      expect(() => assembleBundle(template, frozenPresets, content)).not.toThrow();
    }
  });
});

describe('assembleBundle: content', () => {
  it('zero projects and zero technologies still assemble and validate, in every template', () => {
    const noProject = draftToContent(emptyDraft(), null);
    const noTech = draftToContent({ ...emptyDraft(), projects: [{ id: 'p', slug: 'p', title: 'P', tagline: '', sections: [], links: {}, technologies: [], usage: {}, media: [] }] }, 'p');
    for (const t of TEMPLATE_IDS) {
      for (const content of [noProject, noTech]) {
        const bundle = assembleBundle(TEMPLATES[t], presets('teal', 'mysterious'), content);
        expect(() => validateBundle(bundle)).not.toThrow();
        expect(bundle.content.technologies).toEqual([]);
      }
    }
  });

  it('the sample draft, with 30 technologies too, validates', () => {
    const thirty: CreatorDraft = { ...SAMPLE_DRAFT, projects: [{ ...SAMPLE_DRAFT.projects[0], technologies: CATALOG.slice(0, 30).map(t => t.id) }] };
    for (const draft of [SAMPLE_DRAFT, thirty]) {
      const { octopus, profile } = draft;
      const bundle = assembleBundle(TEMPLATES[octopus.template], { ...octopus, handle: profile.handle }, draftToContent(draft, null));
      expect(() => validateBundle(bundle)).not.toThrow();
      expect(bundle.id).toBe('u-your-octopus');
    }
  });

  it('the id is u- plus the handle; an unusable handle gets a safe id instead of an invalid bundle', () => {
    const id = (handle: string) => assembleBundle(TEMPLATES.nox, { ...presets('original', 'mysterious'), handle }, emptyContent).id;
    expect(id('mo')).toBe('u-mo');
    expect(id('a'.repeat(24))).toMatch(WORLD_ID);
    for (const bad of ['', 'Mo', '9x', 'a b']) expect(id(bad), bad).toBe('u-preview');
  });

  it('the page title names the octopus ("Your Octopus" when it has no name)', () => {
    expect(assembleBundle(TEMPLATES.nox, { ...presets('original', 'mysterious'), name: 'Mo' }, emptyContent).theme.pageTitle).toContain('Mo');
    expect(assembleBundle(TEMPLATES.nox, presets('original', 'mysterious'), emptyContent).theme.pageTitle).toContain('Your Octopus');
  });

  it('uses the content it is given, unchanged', () => {
    const content = draftToContent(SAMPLE_DRAFT, null);
    const bundle = assembleBundle(TEMPLATES.aether, presets('peach', 'playful'), content);
    expect(bundle.content.project).toEqual(content.project);
    expect(bundle.content.technologies).toEqual(content.technologies);
  });
});

describe('showcase fixtures stay frozen', () => {
  it('SHOWCASE deep-equals its snapshot after assembling a bundle for every template and palette', () => {
    const before = structuredClone(SHOWCASE);
    expect(Object.isFrozen(SHOWCASE)).toBe(true);
    for (const t of TEMPLATE_IDS) for (const palette of PALETTE_IDS) assembleBundle(TEMPLATES[t], presets(palette, 'calm'), draftToContent(SAMPLE_DRAFT, null));
    expect(SHOWCASE).toEqual(before);
    expect(snap(SHOWCASE)).toBe(snap(before));
  });

  it('a preview bundle shares no object with a fixture and mutating it leaves the fixtures alone', () => {
    const fixtureObjects = new Set<unknown>();
    const walk = (v: unknown) => {
      if (v !== null && typeof v === 'object' && !fixtureObjects.has(v)) {
        fixtureObjects.add(v);
        Object.values(v).forEach(walk);
      }
    };
    walk(SHOWCASE);
    const before = snap(SHOWCASE);
    const bundle = assembleBundle(TEMPLATES.veyra, presets('rose', 'calm'), draftToContent(SAMPLE_DRAFT, null));
    expect(fixtureObjects.has(bundle)).toBe(false);
    expect(fixtureObjects.has(bundle.content)).toBe(false);
    expect(fixtureObjects.has(bundle.content.project)).toBe(false);
    bundle.content.project = { ...bundle.content.project, name: 'changed' };
    expect(snap(SHOWCASE)).toBe(before);
  });
});
