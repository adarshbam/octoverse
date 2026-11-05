import { describe, expect, it } from 'vitest';
import { aether } from '../../worlds/aether/content/aether';
import { flux } from '../../worlds/flux/content/flux';
import { nox } from '../../worlds/nox/content/nox';
import { veyra } from '../../worlds/veyra/content/veyra';
import { veyraProject } from '../../worlds/veyra/content/veyraProject';
import { veyraTechnologies } from '../../worlds/veyra/content/veyraTechnologies';
import { aetherProject } from '../../worlds/aether/content/aetherProject';
import { aetherTechnologies } from '../../worlds/aether/content/aetherTechnologies';
import { fluxProject } from '../../worlds/flux/content/fluxProject';
import { fluxTechnologies } from '../../worlds/flux/content/fluxTechnologies';
import { noxProject } from '../../worlds/nox/content/noxProject';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { contentFor } from './worldContent';
import { SHOWCASE, profileFor } from './showcase';

const CONTENT = { veyra, flux, nox, aether };
const SOURCES = {
  veyra: { project: veyraProject, technologies: veyraTechnologies },
  flux: { project: fluxProject, technologies: fluxTechnologies },
  nox: { project: noxProject, technologies: noxTechnologies },
  aether: { project: aetherProject, technologies: aetherTechnologies },
} as const;
const WORLDS = ['veyra', 'flux', 'nox', 'aether'] as const;

/** Whether a value, and everything reachable from it, is frozen. */
function deeplyFrozen(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every(inner => deeplyFrozen(inner, seen));
}

describe('SHOWCASE', () => {
  it('is deeply frozen', () => {
    expect(deeplyFrozen(SHOWCASE)).toBe(true);
    expect(() => {
      (SHOWCASE as unknown as unknown[]).push({});
    }).toThrow();
  });

  it('has the four showcase handles in the order Veyra, Flux, Nox, Aether', () => {
    expect(SHOWCASE.map(p => p.handle)).toEqual(['veyra', 'flux', 'nox', 'aether']);
    expect(SHOWCASE.map(p => p.world)).toEqual(['veyra', 'flux', 'nox', 'aether']);
  });

  it('has exactly one project each, with a slug the route grammar accepts', () => {
    for (const p of SHOWCASE) {
      expect(p.projects).toHaveLength(1);
      expect(p.projects[0].slug).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(p.projects[0].bundle).toBe(p.world);
    }
    expect(SHOWCASE.map(p => p.projects[0].slug)).toEqual(['vault-os', 'github-pipeline-engine', 'security-lab', 'ai-playground']);
  });

  it("takes each name and epithet from the world's own content, not a copy", () => {
    for (const p of SHOWCASE) {
      expect(p.name).toBe(CONTENT[p.handle].name);
      expect(p.epithet).toBe(CONTENT[p.handle].epithet);
    }
    expect(profileFor('veyra')?.epithet).toBe('The Keeper of Files');
  });

  it('has a location or a link only where the content supplies one', () => {
    for (const p of SHOWCASE) {
      const raw = CONTENT[p.handle] as Record<string, unknown>;
      expect('location' in p).toBe(typeof raw.location === 'string');
      expect('link' in p).toBe(typeof raw.link === 'string');
    }
  });

  it('finds a profile by handle, and nothing for an unknown one', () => {
    expect(profileFor('nox')?.name).toBe('Nox');
    expect(profileFor('alex')).toBeUndefined();
    expect(profileFor('constructor')).toBeUndefined();
    expect(profileFor('')).toBeUndefined();
  });
});

describe('contentFor (what the pages show, from the content modules)', () => {
  it("lists each world's technologies in declared order, and says nothing the content does not", () => {
    expect(contentFor('veyra').technologies.slice(0, 3).map(t => t.name)).toEqual(['React', 'TypeScript', 'JavaScript']);
    expect(contentFor('flux').technologies.slice(0, 3).map(t => t.name)).toEqual(['GitHub Actions', 'TypeScript', 'Node.js']);
    expect(contentFor('nox').technologies.slice(0, 3).map(t => t.name)).toEqual(['HTML', 'CSS', 'JavaScript']);
    expect(contentFor('aether').technologies.slice(0, 3).map(t => t.name)).toEqual(['OpenAI', 'Python', 'TypeScript']);
  });

  // The expected notes are read from each world's own content modules (never typed here), so a content change cannot leave this test behind.
  it("gives a technology the usage note its world's content declares, and only that: the same set, in the content's order, with the same text", () => {
    for (const w of WORLDS) {
      const { project, technologies } = SOURCES[w];
      const declared = technologies.flatMap(t => {
        const usage = project.technologyUsages?.find(u => u.technologyId === t.id);
        const note = usage?.summary ?? usage?.role;
        return note === undefined ? [] : [[t.id, note] as const];
      });
      const shown = contentFor(w).technologies.filter(t => t.note !== undefined).map(t => [t.id, t.note] as const);
      expect(shown, w).toEqual(declared);
      // Every technology of the content is shown, in the content's order, with its own name and category.
      expect(contentFor(w).technologies.map(t => [t.id, t.name, t.category]), w).toEqual(technologies.map(t => [t.id, t.name, t.category]));
    }
  });

  it('does not invent a note: no technology shows one that the content does not declare for it', () => {
    for (const w of WORLDS) {
      const usages = SOURCES[w].project.technologyUsages ?? [];
      for (const t of contentFor(w).technologies) {
        const usage = usages.find(u => u.technologyId === t.id);
        if (t.note !== undefined) expect([usage?.summary, usage?.role], `${w} ${t.id}`).toContain(t.note);
        else expect(usage?.summary ?? usage?.role, `${w} ${t.id}`).toBeUndefined();
      }
    }
  });

  it("carries the content's placeholder flag with each note, so the page can say so (and only where the content flags it)", () => {
    for (const w of WORLDS) {
      const usages = SOURCES[w].project.technologyUsages ?? [];
      for (const t of contentFor(w).technologies) {
        const usage = usages.find(u => u.technologyId === t.id);
        const expected = t.note !== undefined && usage?.placeholder === true ? true : undefined;
        expect(t.placeholder, `${w} ${t.id}`).toBe(expected);
      }
    }
  });

  it('has a screenshot only where the content has one', () => {
    expect(contentFor('veyra').screenshot).toBeUndefined();
    expect(contentFor('flux').screenshot).toBeUndefined();
    expect(contentFor('nox').screenshot?.src).toBe('/images/projects/security-lab-preview.webp');
    expect(contentFor('aether').screenshot?.src).toBe('/aether/ai-playground-screenshot.webp');
  });
});
