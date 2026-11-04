import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOADABLE_WORLDS, loadWorld } from './loadWorld';

describe('loadWorld', () => {
  it('names the four showcase worlds', () => {
    expect([...LOADABLE_WORLDS]).toEqual(['nox', 'veyra', 'flux', 'aether']);
  });

  for (const id of ['nox', 'veyra', 'flux', 'aether']) {
    it(`resolves ${id} to its own bundle`, async () => {
      const bundle = await loadWorld(id);
      expect(bundle.id).toBe(id);
      expect(bundle.content.project.id).toBeTruthy();
    });
  }

  it('resolves the same promise value for a world loaded twice', async () => {
    expect(await loadWorld('nox')).toBe(await loadWorld('nox'));
  });

  it('rejects an unknown id, the host and inherited object keys included', async () => {
    for (const id of ['nobody', 'octoverse', '', 'constructor', '__proto__', 'toString']) {
      await expect(loadWorld(id), id).rejects.toThrow(/unknown world/i);
    }
  });

  it('imports each bundle dynamically, once, and never statically (so each world is its own chunk)', () => {
    const source = readFileSync(new URL('./loadWorld.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const dynamic = [...source.matchAll(/\bimport\(\s*(['"])([^'"]+)\1\s*\)/g)].map(m => m[2]);
    expect(dynamic).toEqual(['../../worlds/nox/bundle', '../../worlds/veyra/bundle', '../../worlds/flux/bundle', '../../worlds/aether/bundle']);
    expect(source).not.toMatch(/from\s*['"][^'"]*worlds\/[^'"]*['"]/);
    expect(source).not.toMatch(/worlds\/index|from\s*['"][^'"]*\/worlds['"]/);
  });
});
