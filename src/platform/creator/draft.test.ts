import { describe, expect, it } from 'vitest';
import { WORLDS } from '../../worlds';
import { RESERVED_HANDLES } from '../router/routes';
import { MAX_MEDIA_BYTES, SHOWCASE_HANDLES, emptyDraft, migrateDraft, validateDraft } from './draft';
import { SAMPLE_DRAFT } from './sampleDraft';
import type { CreatorDraft, DraftProject } from './types';

const fields = (d: unknown) => validateDraft(d as CreatorDraft).map(i => i.field);
const project = (patch: Partial<DraftProject> = {}): DraftProject => ({ id: 'p1', slug: 'p1', title: 'P', tagline: '', sections: [], links: {}, technologies: [], usage: {}, media: [], ...patch });
const draftWith = (patch: Partial<CreatorDraft>): CreatorDraft => ({ ...SAMPLE_DRAFT, ...patch });

describe('emptyDraft', () => {
  it('is a version 1 draft with no projects, a fresh object each time', () => {
    const a = emptyDraft();
    expect(a.version).toBe(1);
    expect(a.projects).toEqual([]);
    expect(a.octopus.name).toBe('');
    expect(emptyDraft()).not.toBe(a);
    expect(emptyDraft().projects).not.toBe(a.projects);
  });

  it('is incomplete (name and handle), but never throws to say so', () => {
    expect(fields(emptyDraft())).toEqual(expect.arrayContaining(['octopus.name', 'profile.handle']));
  });
});

describe('validateDraft', () => {
  it('passes the sample draft', () => {
    expect(validateDraft(SAMPLE_DRAFT)).toEqual([]);
  });

  it('names rule: 1 to 24 of letters, digits, space . - and the apostrophe', () => {
    const name = (n: string) => fields(draftWith({ octopus: { ...SAMPLE_DRAFT.octopus, name: n } }));
    expect(name("Mo's Octo-1.0")).toEqual([]);
    expect(name('')).toContain('octopus.name');
    expect(name('x'.repeat(25))).toContain('octopus.name');
    expect(name('<b>')).toContain('octopus.name');
    expect(name('x'.repeat(24))).toEqual([]);
  });

  it('a name of spaces only is not a name', () => {
    const name = (n: string) => fields(draftWith({ octopus: { ...SAMPLE_DRAFT.octopus, name: n } }));
    for (const blank of [' ', '    ', '   ']) expect(name(blank), JSON.stringify(blank)).toContain('octopus.name');
  });

  it('handle rule: pattern and reserved words', () => {
    const handle = (h: string) => fields(draftWith({ profile: { ...SAMPLE_DRAFT.profile, handle: h } }));
    expect(handle('ab')).toEqual([]);
    for (const bad of ['', 'a', '1abc', 'Abc', 'a_b', 'a'.repeat(25), 'ab cd']) expect(handle(bad), bad).toContain('profile.handle');
    for (const reserved of ['explore', 'create', 'how-it-works', 'about', 'pricing', 'signin', 'api', 'assets']) expect(handle(reserved), reserved).toContain('profile.handle');
  });

  it('the showcase handles are taken, with their own message (RESERVED_HANDLES is not the place for them)', () => {
    for (const handle of ['nox', 'veyra', 'flux', 'aether', 'octoverse']) {
      const issues = validateDraft(draftWith({ profile: { ...SAMPLE_DRAFT.profile, handle } }));
      expect(issues, handle).toEqual([{ field: 'profile.handle', message: 'That handle is used by a showcase portfolio' }]);
    }
    expect(RESERVED_HANDLES).not.toContain('nox');
  });

  it('the showcase handles are exactly the world registry ids (a new world cannot be taken by a creator)', () => {
    expect([...SHOWCASE_HANDLES].sort()).toEqual(Object.keys(WORLDS).sort());
  });

  it('never echoes more than 40 characters of a value in a message', () => {
    const long = 'q'.repeat(500);
    const issues = validateDraft(draftWith({ projects: [project({ technologies: [long, long], usage: { [long]: 3 as never } })] }));
    expect(issues.length).toBeGreaterThan(1);
    for (const issue of issues) expect(issue.message.length + issue.field.length).toBeLessThan(200);
  });

  it('projects 0 to 8', () => {
    const many = (n: number) => fields(draftWith({ projects: Array.from({ length: n }, (_, i) => project({ id: `p${i}`, slug: `p${i}` })) }));
    expect(many(0)).toEqual([]);
    expect(many(8)).toEqual([]);
    expect(many(9)).toContain('projects');
  });

  it('technologies: 0 to 30, from the catalog, no repeats', () => {
    const tech = (technologies: string[]) => fields(draftWith({ projects: [project({ technologies })] }));
    expect(tech([])).toEqual([]);
    expect(tech(['react', 'nope'])).toContain('projects[0].technologies[1]');
    expect(tech(['react', 'react'])).toContain('projects[0].technologies[1]');
    const thirtyOne = ['vue', 'angular', 'svelte', 'tailwind', 'sass', 'vite', 'threejs', 'go', 'rust', 'java', 'cpp', 'php', 'swift', 'kotlin', 'django', 'flask', 'fastapi', 'graphql', 'mysql', 'sqlite', 'firebase', 'vercel', 'kubernetes', 'terraform', 'nginx', 'figma', 'react', 'typescript', 'postgresql', 'redis', 'docker'];
    expect(tech(thirtyOne)).toContain('projects[0].technologies');
    expect(tech(thirtyOne.slice(0, 30))).toEqual([]);
  });

  it('links: https only; a bad link is flagged', () => {
    const link = (links: DraftProject['links']) => fields(draftWith({ projects: [project({ links })] }));
    expect(link({ live: 'https://example.com/x', repo: 'https://github.com/a/b' })).toEqual([]);
    expect(link({ live: 'http://example.com' })).toEqual(['projects[0].links.live']);
    expect(link({ repo: 'javascript:alert(1)' })).toEqual(['projects[0].links.repo']);
    expect(link({ live: 'not a url' })).toEqual(['projects[0].links.live']);
    expect(fields(draftWith({ profile: { ...SAMPLE_DRAFT.profile, link: 'http://x.example' } }))).toEqual(['profile.link']);
  });

  it('media: 0 to 4 per project, at most 2 MB, png/jpeg/webp', () => {
    const ref = (i: number, patch: object = {}) => ({ id: `m${i}`, name: `m${i}.png`, type: 'image/png' as const, size: 10, ...patch });
    const media = (m: object[]) => fields(draftWith({ projects: [project({ media: m as DraftProject['media'] })] }));
    expect(media([0, 1, 2, 3].map(i => ref(i)))).toEqual([]);
    expect(media([0, 1, 2, 3, 4].map(i => ref(i)))).toContain('projects[0].media');
    expect(media([ref(0, { size: MAX_MEDIA_BYTES + 1 })])).toContain('projects[0].media[0]');
    expect(media([ref(0, { size: MAX_MEDIA_BYTES })])).toEqual([]);
    expect(media([ref(0, { type: 'image/gif' })])).toContain('projects[0].media[0]');
  });

  it('project ids and slugs are unique, and a slug is a route slug', () => {
    expect(fields(draftWith({ projects: [project(), project()] }))).toEqual(expect.arrayContaining(['projects[1].id', 'projects[1].slug']));
    expect(fields(draftWith({ projects: [project({ slug: 'Bad Slug' })] }))).toContain('projects[0].slug');
  });

  it('reports and never throws on a draft with every field wrong', () => {
    const bad = {
      version: 7,
      octopus: { template: 'kraken', palette: 'plaid', personality: 'angry', name: '<<<' },
      profile: { handle: 'API', tagline: 3, about: null, location: 9, link: 'ftp://x' },
      projects: [{ id: 4, slug: '!', title: 1, tagline: 2, sections: 'x', links: { live: 'http://a', repo: 5 }, technologies: ['zzz', 7], usage: 'x', media: [{ id: 1, type: 'text/html', size: -1 }, null] }, null, 'x'],
      updatedAt: 12,
    };
    let issues: { field: string; message: string }[] = [];
    expect(() => (issues = validateDraft(bad as never))).not.toThrow();
    expect(issues.length).toBeGreaterThan(10);
    for (const issue of issues) {
      expect(typeof issue.field).toBe('string');
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });

  it.each([null, undefined, 42, 'x', [], true, { projects: 3 }, { octopus: null, profile: null, projects: null }])('never throws on %j', input => {
    let issues: unknown[] = [];
    expect(() => (issues = validateDraft(input as never))).not.toThrow();
    expect(issues.length).toBeGreaterThan(0);
  });

  it('never changes the draft it checks', () => {
    const before = JSON.stringify(SAMPLE_DRAFT);
    validateDraft(SAMPLE_DRAFT);
    expect(JSON.stringify(SAMPLE_DRAFT)).toBe(before);
  });
});

describe('migrateDraft', () => {
  it.each([42, null, undefined, 'x', [], {}, { version: 2 }, { version: 1, octopus: 5 }])('gives an empty draft for %j (or a normalised one)', raw => {
    const out = migrateDraft(raw);
    expect(out.version).toBe(1);
    expect(out.projects).toEqual([]);
    expect(typeof out.octopus.name).toBe('string');
  });

  it('migrateDraft(42) is an empty draft', () => {
    const out = migrateDraft(42);
    expect({ ...out, updatedAt: '' }).toEqual({ ...emptyDraft(), updatedAt: '' });
  });

  it('a hostile usage key (__proto__, constructor) stays a plain key and never reaches the prototype', () => {
    const raw = JSON.parse('{"version":1,"projects":[{"id":"a","slug":"a","usage":{"__proto__":"x","constructor":"y","react":"z"}}]}');
    const usage = migrateDraft(raw).projects[0].usage;
    expect(Object.getPrototypeOf(usage)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(Object.keys(usage).sort()).toEqual(['__proto__', 'constructor', 'react']);
  });

  it('keeps a valid draft exactly (a copy, not the same object)', () => {
    const out = migrateDraft(JSON.parse(JSON.stringify(SAMPLE_DRAFT)));
    expect(out).toEqual(SAMPLE_DRAFT);
    expect(out).not.toBe(SAMPLE_DRAFT);
    expect(Object.isFrozen(out)).toBe(false);
  });

  it('repairs types so the editor cannot crash on a damaged draft, and keeps what is good', () => {
    const out = migrateDraft({
      version: 1,
      octopus: { template: 'kraken', palette: 'rose', personality: 5, name: 7 },
      profile: { handle: 'zed', tagline: null },
      projects: [{ id: 'a', slug: 'a', title: 'T', technologies: 'x', media: [{ id: 'm', name: 'n', type: 'image/png', size: 3 }, { id: 'bad' }], links: { live: 5 } }, 'junk'],
    });
    expect(out.octopus).toEqual({ template: emptyDraft().octopus.template, palette: 'rose', personality: emptyDraft().octopus.personality, name: '' });
    expect(out.profile.handle).toBe('zed');
    expect(out.profile.tagline).toBe('');
    expect(out.projects).toHaveLength(1);
    expect(out.projects[0]).toMatchObject({ id: 'a', title: 'T', technologies: [], links: {}, sections: [], usage: {} });
    expect(out.projects[0].media).toEqual([{ id: 'm', name: 'n', type: 'image/png', size: 3 }]);
  });
});
