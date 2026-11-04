import { expect, test } from 'vitest';
import { noxTechnologies } from '../../nox3d/content/noxTechnologies';
import { placeholderUsages } from '../../nox3d/content/placeholders';
import { tooltipContent } from './tooltipContent';

const usages = placeholderUsages(noxTechnologies);
const kali = noxTechnologies.find(t => t.id === 'kali')!;
const typescript = noxTechnologies.find(t => t.id === 'typescript')!;
const usage = (id: string) => usages.find(u => u.technologyId === id);

test('while developing, storyboard text shows with a Placeholder badge', () => {
  const c = tooltipContent(kali, usage('kali'), true);
  expect(c.badge).toBe(true);
  expect(c.details).toContain('Used for penetration testing');
});

test('while developing, a technology with no text yet says so plainly instead of inventing any', () => {
  const c = tooltipContent(typescript, usage('typescript'), true);
  expect(c.badge).toBe(true);
  expect(c.details).toEqual([]);
  expect(c.summary).toMatch(/to come/i);
});

test('in the public build no placeholder text or badge appears: just the name and its kind', () => {
  for (const id of ['kali', 'typescript']) {
    const tech = noxTechnologies.find(t => t.id === id)!;
    const c = tooltipContent(tech, usage(id), false);
    expect(c.badge).toBe(false);
    expect(c.details).toEqual([]);
    expect(c.summary).toBeUndefined();
    expect(c.role).toBe(tech.category.charAt(0).toUpperCase() + tech.category.slice(1));
  }
});

test('no technology gets invented usage claims: only Kali carries storyboard text, all flagged', () => {
  for (const u of usages) {
    expect(u.placeholder, u.technologyId).toBe(true);
    if (u.technologyId !== 'kali') {
      expect(u.details ?? [], u.technologyId).toEqual([]);
      expect(u.summary, u.technologyId).toBeUndefined();
    }
  }
  expect(usage('kali')?.reaction).toBe('focused');
});
