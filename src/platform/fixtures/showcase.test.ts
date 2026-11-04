import { describe, expect, it } from 'vitest';
import { aether } from '../../worlds/aether/content/aether';
import { flux } from '../../worlds/flux/content/flux';
import { nox } from '../../worlds/nox/content/nox';
import { veyra } from '../../worlds/veyra/content/veyra';
import { contentFor } from './worldContent';
import { SHOWCASE, profileFor } from './showcase';

const CONTENT = { veyra, flux, nox, aether };

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

  it("gives a usage note only to the technologies whose content has one (the storyboard's panel 4 text, one per world but Veyra)", () => {
    const notes = (w: 'veyra' | 'flux' | 'nox' | 'aether') => contentFor(w).technologies.filter(t => t.note !== undefined).map(t => [t.id, t.note]);
    expect(notes('veyra')).toEqual([]);
    expect(notes('flux')).toEqual([['github-actions', 'Workflow runner integration']]);
    expect(notes('nox')).toEqual([['kali', 'Security toolchain']]);
    expect(notes('aether')).toEqual([['openai', 'LLM integration']]);
  });

  it('has a screenshot only where the content has one', () => {
    expect(contentFor('veyra').screenshot).toBeUndefined();
    expect(contentFor('flux').screenshot).toBeUndefined();
    expect(contentFor('nox').screenshot?.src).toBe('/images/projects/security-lab-preview.webp');
    expect(contentFor('aether').screenshot?.src).toBe('/aether/ai-playground-screenshot.webp');
  });
});
