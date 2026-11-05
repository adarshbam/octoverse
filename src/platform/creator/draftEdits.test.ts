import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { MAX_MEDIA, MAX_MEDIA_TOTAL_BYTES, MAX_PROJECTS, MAX_TECHNOLOGIES, validateDraft } from './draft';
import {
  LINK_ISSUE,
  addMedia,
  addProject,
  addTechnology,
  deleteProject,
  linkIssues,
  mediaErrorMessage,
  moveProject,
  removeMedia,
  removeTechnology,
  safeHref,
  sectionBody,
  setLink,
  setSectionBody,
  setUsage,
  undoDelete,
  updateProject,
} from './draftEdits';
import { SAMPLE_DRAFT } from './sampleDraft';
import { MediaError } from './storage';
import type { CreatorDraft, DraftMediaRef } from './types';

const withThree = (): CreatorDraft => {
  let draft = addProject(addProject(SAMPLE_DRAFT));
  draft = updateProject(draft, draft.projects[1].id, { title: 'Second' });
  return updateProject(draft, draft.projects[2].id, { title: 'Third' });
};
const titles = (d: CreatorDraft) => d.projects.map(p => p.title);
const pid = (d: CreatorDraft, i: number) => d.projects[i].id;
const ref = (n: number): DraftMediaRef => ({ id: `m${n}`, name: `shot-${n}.png`, type: 'image/png', size: 1000 });

describe('addProject', () => {
  it('adds an untitled, empty project at the end with a unique id and slug, up to eight', () => {
    const one = addProject(SAMPLE_DRAFT);
    expect(one.projects).toHaveLength(2);
    expect(one.projects[1]).toMatchObject({ title: '', tagline: '', sections: [], links: {}, technologies: [], usage: {}, media: [] });
    let draft = SAMPLE_DRAFT;
    for (let i = 0; i < 12; i++) draft = addProject(draft);
    expect(draft.projects).toHaveLength(MAX_PROJECTS);
    expect(new Set(draft.projects.map(p => p.id)).size).toBe(MAX_PROJECTS);
    expect(new Set(draft.projects.map(p => p.slug)).size).toBe(MAX_PROJECTS);
  });

  it('never reuses the id of a project that was deleted and restored', () => {
    let draft = withThree();
    const removed = deleteProject(draft, pid(draft, 1))!;
    draft = addProject(removed.draft);
    draft = undoDelete(draft, removed.project, removed.index);
    expect(new Set(draft.projects.map(p => p.id)).size).toBe(draft.projects.length);
  });

  it('never takes an id that a deleted (still undoable) project holds, when those are passed as reserved', () => {
    let draft = withThree();
    const last = deleteProject(draft, pid(draft, 2))!;
    // Without the reservation the new project would take the freed id and the undo would find it taken.
    expect(addProject(last.draft).projects.map(p => p.id)).toContain(last.project.id);
    draft = addProject(last.draft, [last.project.id]);
    expect(draft.projects.map(p => p.id)).not.toContain(last.project.id);
    expect(draft.projects.map(p => p.slug)).not.toContain(last.project.slug);
    expect(undoDelete(draft, last.project, last.index).projects).toHaveLength(4);
  });

  it('a new project passes validation of its own fields (the empty title is allowed)', () => {
    const draft = addProject(SAMPLE_DRAFT);
    expect(validateDraft(draft).filter(i => i.field.startsWith('projects[1]'))).toEqual([]);
  });
});

describe('updateProject', () => {
  it('patches one project by id, leaves the argument alone and ignores an unknown id', () => {
    const draft = withThree();
    const next = updateProject(draft, pid(draft, 1), { tagline: 'hello' });
    expect(next.projects[1].tagline).toBe('hello');
    expect(draft.projects[1].tagline).toBe('');
    expect(updateProject(draft, 'nope', { title: 'x' })).toBe(draft);
  });
});

describe('moveProject (reorder)', () => {
  it('moves a project up or down by one', () => {
    const draft = withThree();
    expect(titles(moveProject(draft, pid(draft, 2), 'up'))).toEqual(['Sample project', 'Third', 'Second']);
    expect(titles(moveProject(draft, pid(draft, 0), 'down'))).toEqual(['Second', 'Sample project', 'Third']);
  });

  it('does nothing at the ends and for an unknown id (the same draft object comes back)', () => {
    const draft = withThree();
    expect(moveProject(draft, pid(draft, 0), 'up')).toBe(draft);
    expect(moveProject(draft, pid(draft, 2), 'down')).toBe(draft);
    expect(moveProject(draft, 'nope', 'up')).toBe(draft);
  });

  it('keeps every project and never changes the argument', () => {
    const draft = withThree();
    const next = moveProject(draft, pid(draft, 1), 'down');
    expect(next.projects.map(p => p.id).sort()).toEqual(draft.projects.map(p => p.id).sort());
    expect(titles(draft)).toEqual(['Sample project', 'Second', 'Third']);
  });
});

describe('deleteProject and undoDelete (5 s undo)', () => {
  it('returns the new draft, the removed project and its index', () => {
    const draft = withThree();
    const out = deleteProject(draft, pid(draft, 1))!;
    expect(titles(out.draft)).toEqual(['Sample project', 'Third']);
    expect(out.project).toBe(draft.projects[1]);
    expect(out.index).toBe(1);
    expect(deleteProject(draft, 'nope')).toBeNull();
  });

  it('undo restores the project at its index, whole', () => {
    const draft = withThree();
    for (const i of [0, 1, 2]) {
      const out = deleteProject(draft, pid(draft, i))!;
      const back = undoDelete(out.draft, out.project, out.index);
      expect(back.projects).toEqual(draft.projects);
    }
  });

  it('undo after other edits still restores at the index, clamped to the end', () => {
    const draft = withThree();
    const out = deleteProject(draft, pid(draft, 2))!;
    const fewer = deleteProject(out.draft, pid(out.draft, 1))!;
    const back = undoDelete(fewer.draft, out.project, out.index);
    expect(titles(back)).toEqual(['Sample project', 'Third']);
  });

  it('undo cannot go past eight projects or restore a project twice', () => {
    let draft = SAMPLE_DRAFT;
    for (let i = 0; i < 8; i++) draft = addProject(draft);
    const out = deleteProject(draft, pid(draft, 3))!;
    const full = addProject(out.draft);
    expect(full.projects).toHaveLength(MAX_PROJECTS);
    expect(undoDelete(full, out.project, out.index)).toBe(full);
    const once = undoDelete(out.draft, out.project, out.index);
    expect(undoDelete(once, out.project, out.index)).toBe(once);
  });

  it('deleting the last project leaves an empty list (zero projects is a valid draft)', () => {
    const out = deleteProject(SAMPLE_DRAFT, pid(SAMPLE_DRAFT, 0))!;
    expect(out.draft.projects).toEqual([]);
    expect(validateDraft(out.draft).filter(i => i.field.startsWith('projects'))).toEqual([]);
  });
});

describe('technologies (catalog only, declared order, at most 30)', () => {
  const id = pid(SAMPLE_DRAFT, 0);
  const empty = () => addProject(SAMPLE_DRAFT);

  it('adds a catalog technology at the end, in the order added', () => {
    let draft = empty();
    const target = pid(draft, 1);
    draft = addTechnology(draft, target, 'vue');
    draft = addTechnology(draft, target, 'rust');
    draft = addTechnology(draft, target, 'go');
    expect(draft.projects[1].technologies).toEqual(['vue', 'rust', 'go']);
  });

  it('refuses an id that is not in the catalog (no free text) and a duplicate', () => {
    const draft = empty();
    const target = pid(draft, 1);
    expect(addTechnology(draft, target, 'my-own-thing')).toBe(draft);
    expect(addTechnology(draft, target, '')).toBe(draft);
    const once = addTechnology(draft, target, 'vue');
    expect(addTechnology(once, target, 'vue')).toBe(once);
    expect(addTechnology(draft, 'nope', 'vue')).toBe(draft);
  });

  it('stops at 30', () => {
    let draft = empty();
    const target = pid(draft, 1);
    for (const tech of CATALOG) draft = addTechnology(draft, target, tech.id);
    expect(CATALOG.length).toBeGreaterThan(MAX_TECHNOLOGIES);
    expect(draft.projects[1].technologies).toHaveLength(MAX_TECHNOLOGIES);
    expect(draft.projects[1].technologies).toEqual(CATALOG.slice(0, MAX_TECHNOLOGIES).map(t => t.id));
    expect(validateDraft(draft).filter(i => i.field.includes('technologies'))).toEqual([]);
  });

  it('removes a technology and its usage note, keeping the order of the rest', () => {
    let draft = SAMPLE_DRAFT;
    draft = setUsage(draft, id, 'react', 'The whole UI');
    draft = setUsage(draft, id, 'redis', 'Cache');
    const next = removeTechnology(draft, id, 'react');
    expect(next.projects[0].technologies).toEqual(['typescript', 'postgresql', 'redis', 'docker']);
    expect(next.projects[0].usage).toEqual({ redis: 'Cache' });
    expect(removeTechnology(draft, id, 'vue')).toBe(draft);
  });

  it('keeps a usage note for a chosen technology only; an empty note removes it', () => {
    let draft = setUsage(SAMPLE_DRAFT, id, 'react', 'The whole UI');
    expect(draft.projects[0].usage).toEqual({ react: 'The whole UI' });
    expect(setUsage(draft, id, 'vue', 'x')).toBe(draft);
    draft = setUsage(draft, id, 'react', '');
    expect(draft.projects[0].usage).toEqual({});
    expect(validateDraft(draft).filter(i => i.field.includes('usage'))).toEqual([]);
  });

  it('a usage note under a prototype-like key never reaches the prototype', () => {
    const odd = updateProject(SAMPLE_DRAFT, id, { technologies: ['__proto__'] });
    expect(setUsage(odd, id, '__proto__', 'x')).toBe(odd);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe('links (https only; a bad link is kept but not linked)', () => {
  const id = pid(SAMPLE_DRAFT, 0);

  it('sets and clears a link, and keeps a bad one in the draft as typed', () => {
    let draft = setLink(SAMPLE_DRAFT, id, 'live', 'https://example.com');
    expect(draft.projects[0].links).toEqual({ live: 'https://example.com' });
    draft = setLink(draft, id, 'repo', 'ftp://example.com/x');
    expect(draft.projects[0].links).toEqual({ live: 'https://example.com', repo: 'ftp://example.com/x' });
    draft = setLink(draft, id, 'live', '');
    expect(draft.projects[0].links).toEqual({ repo: 'ftp://example.com/x' });
  });

  it('linkIssues flags only a non-empty value that is not https', () => {
    expect(linkIssues({})).toEqual({});
    expect(linkIssues({ live: '', repo: 'https://github.com/a/b' })).toEqual({});
    expect(linkIssues({ live: 'http://example.com', repo: 'example.com' })).toEqual({ live: LINK_ISSUE, repo: LINK_ISSUE });
    expect(linkIssues({ live: 'javascript:alert(1)' })).toEqual({ live: LINK_ISSUE });
    expect(LINK_ISSUE).toBe('This link must start with https://');
  });

  it('safeHref gives the PARSED address of an https link and undefined for anything else (plain text then)', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHref('HTTPS://X.COM')).toBe('https://x.com/');
    expect(safeHref('https://exämple.com')).toBe('https://xn--exmple-cua.com/');
    const bad = ['http://example.com', 'javascript:alert(1)', 'data:text/html,x', '//x.com', 'example.com', '', ' https://x.com', 'https://x.com ', 'https://user:pass@host.com', 'https:x.com', 'https://', 'https:///x', 'https://x.com/' + 'a'.repeat(3000), undefined];
    for (const value of bad) expect(safeHref(value), String(value).slice(0, 30)).toBeUndefined();
  });

  it('flagged and not linked are one rule: every value safeHref refuses is flagged, every one it accepts is not', () => {
    const values = ['https://x.com', 'HTTPS://X.COM', ' https://x.com', 'https://x.com ', 'https:x.com', 'https://user:pass@host', 'http://x.com', 'javascript:alert(1)', '//x.com', 'https:///x', 'https://', 'https://exämple.com'];
    for (const value of values) expect(linkIssues({ live: value }).live === undefined, value).toBe(safeHref(value) !== undefined);
  });

  it('the validator and the flag agree', () => {
    const draft = setLink(SAMPLE_DRAFT, id, 'live', 'http://example.com');
    expect(validateDraft(draft).map(i => i.field)).toContain('projects[0].links.live');
  });
});

describe('sections', () => {
  const id = pid(SAMPLE_DRAFT, 0);

  it('sets the overview text, reads it back and removes it when emptied', () => {
    expect(sectionBody(SAMPLE_DRAFT.projects[0])).toBe('');
    const draft = setSectionBody(SAMPLE_DRAFT, id, 'Built for a class.');
    expect(draft.projects[0].sections).toEqual([{ id: 'overview', body: 'Built for a class.' }]);
    expect(sectionBody(draft.projects[0])).toBe('Built for a class.');
    expect(setSectionBody(draft, id, 'Edited').projects[0].sections).toEqual([{ id: 'overview', body: 'Edited' }]);
    expect(setSectionBody(draft, id, '').projects[0].sections).toEqual([]);
  });
});

describe('media metadata (the blob goes through the store)', () => {
  const id = pid(SAMPLE_DRAFT, 0);

  it('adds up to four images and removes one by id', () => {
    let draft = SAMPLE_DRAFT;
    for (let n = 1; n <= 6; n++) draft = addMedia(draft, id, ref(n));
    expect(draft.projects[0].media.map(m => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(draft.projects[0].media).toHaveLength(MAX_MEDIA);
    const next = removeMedia(draft, id, 'm2');
    expect(next.projects[0].media.map(m => m.id)).toEqual(['m1', 'm3', 'm4']);
    expect(removeMedia(draft, id, 'nope')).toBe(draft);
    expect(addMedia(draft, 'nope', ref(9))).toBe(draft);
  });

  it('refuses an image that would take a draft past 24 MB of images in all', () => {
    const big = (n: number): DraftMediaRef => ({ id: `big${n}`, name: 'b.png', type: 'image/png', size: 2 * 1024 * 1024 });
    let draft = addProject(addProject(addProject(SAMPLE_DRAFT)));
    for (let n = 0; n < 12; n++) draft = addMedia(draft, pid(draft, Math.floor(n / 4)), big(n));
    expect(draft.projects.flatMap(p => p.media)).toHaveLength(12);
    expect(MAX_MEDIA_TOTAL_BYTES).toBe(24 * 1024 * 1024);
    expect(addMedia(draft, pid(draft, 3), ref(1))).toBe(draft); // even one small image: the draft is full
    const freed = removeMedia(draft, pid(draft, 0), 'big0');
    expect(addMedia(freed, pid(freed, 3), ref(1)).projects[3].media).toHaveLength(1);
  });

  it('refuses a second image with the same id', () => {
    const once = addMedia(SAMPLE_DRAFT, id, ref(1));
    expect(addMedia(once, id, ref(1))).toBe(once);
  });

  it('maps each MediaError to a plain sentence, and anything else to a generic one', () => {
    expect(mediaErrorMessage(new MediaError('too-large', 'x'))).toBe('That image is over 2 MB. Pick a smaller one.');
    expect(mediaErrorMessage(new MediaError('bad-type', 'x'))).toBe('Images must be PNG, JPEG or WebP.');
    expect(mediaErrorMessage(new MediaError('unreadable', 'x'))).toBe('That file could not be read. Try another image.');
    expect(mediaErrorMessage(new Error('boom'))).toBe('That image could not be added. Try again.');
    expect(mediaErrorMessage('weird')).toBe('That image could not be added. Try again.');
  });
});
