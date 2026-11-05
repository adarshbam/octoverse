import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { searchTechnologies } from './techSearch';

describe('searchTechnologies (the picker over the catalog)', () => {
  it('finds a technology by part of its name, ignoring case', () => {
    const names = searchTechnologies('type', []).matches.map(t => t.name);
    expect(names).toContain('TypeScript');
    expect(searchTechnologies('TYPESCRIPT', []).matches.map(t => t.id)).toContain('typescript');
    expect(searchTechnologies('  three ', []).matches.map(t => t.name)).toContain('Three.js');
  });

  it('puts names that start with the text before names that only contain it', () => {
    const matches = searchTechnologies('re', []).matches;
    const firstContaining = matches.findIndex(t => !t.name.toLowerCase().startsWith('re'));
    const lastStarting = matches.map(t => t.name.toLowerCase().startsWith('re')).lastIndexOf(true);
    if (firstContaining >= 0) expect(lastStarting).toBeLessThan(firstContaining);
    expect(matches[0].name.toLowerCase().startsWith('re')).toBe(true);
  });

  it('leaves out technologies already chosen, and says how many matched in all', () => {
    const all = searchTechnologies('', [], 1000);
    expect(all.total).toBe(CATALOG.length);
    const without = searchTechnologies('', ['react', 'vue'], 1000);
    expect(without.total).toBe(CATALOG.length - 2);
    expect(without.matches.map(t => t.id)).not.toContain('react');
  });

  it('shows at most `limit` and an empty query lists the catalog in its own order', () => {
    const out = searchTechnologies('', [], 5);
    expect(out.matches).toHaveLength(5);
    expect(out.matches.map(t => t.id)).toEqual(CATALOG.slice(0, 5).map(t => t.id));
    expect(out.total).toBe(CATALOG.length);
  });

  it('finds nothing for text no technology has, and never matches free text into a new technology', () => {
    expect(searchTechnologies('zzzzqqq', [])).toEqual({ matches: [], total: 0 });
  });

  it('also matches the category (typing "database" finds data stores)', () => {
    expect(searchTechnologies('data', []).matches.length).toBeGreaterThan(0);
  });
});
