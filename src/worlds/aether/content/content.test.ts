import { expect, test } from 'vitest';
import { aetherProject, aetherProjectFor } from './aetherProject';
import { aetherTechnologies } from './aetherTechnologies';
import { AETHER_TECHNOLOGIES_15 } from './testSets';
import { validateProject } from '../../../engine/content/validateProject';
import { MAX_PRIMARY_TECHNOLOGIES } from '../../../engine/content/projectTypes';

test('the shipped technologies are the ten of panel 5, most important first', () => {
  expect(aetherTechnologies.map(t => t.name)).toEqual(['OpenAI', 'Python', 'TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Vector DB']);
  expect(new Set(aetherTechnologies.map(t => t.id)).size).toBe(10);
});

test('the project validates against its catalog, and its primary list is the catalog in order', () => {
  expect(validateProject(aetherProject, aetherTechnologies).issues).toEqual([]);
  expect(aetherProject.primaryTechnologyIds).toEqual(aetherTechnologies.map(t => t.id));
});

test('all storyboard copy is flagged placeholder, and every technology has a usage', () => {
  expect(aetherProject.technologyUsages).toHaveLength(10);
  expect(aetherProject.technologyUsages!.every(u => u.placeholder === true)).toBe(true);
  expect(aetherProject.sections!.every(s => s.placeholder === true)).toBe(true);
  expect(aetherProject.sections!.map(s => s.title)).toEqual(['Overview', 'Features', 'Tech Stack', 'Architecture', 'Experiments', 'Challenges', 'What I Learned']);
});

test("panel 4's OpenAI list is the model for usage notes: each shipped technology has 3 or 4 short placeholder lines and the wonder face; the test five have none", () => {
  const openai = aetherProject.technologyUsages!.find(u => u.technologyId === 'openai')!;
  expect(openai.details).toEqual(['LLM integration', 'Text / image generation', 'Function calling', 'Prompt engineering']);
  for (const usage of aetherProject.technologyUsages!) {
    expect(usage.placeholder).toBe(true);
    expect(usage.reaction).toBe('curious');
    expect(usage.role).toBeTruthy();
    expect(usage.details!.length).toBeGreaterThanOrEqual(3);
    expect(usage.details!.length).toBeLessThanOrEqual(4);
    for (const line of usage.details!) expect(line.length).toBeLessThanOrEqual(28);
  }
  const testFive = aetherProjectFor(AETHER_TECHNOLOGIES_15).technologyUsages!.slice(10);
  expect(testFive).toHaveLength(5);
  for (const usage of testFive) expect([usage.details, usage.role, usage.reaction, usage.placeholder]).toEqual([undefined, undefined, undefined, true]);
});

test('the identity is panels 2 and 5: name, epithet, project, tagline, links, a three-slide carousel', () => {
  expect([aetherProject.characterName, aetherProject.characterEpithet, aetherProject.name]).toEqual(['Aether', 'The Curious Mind', 'AI Playground']);
  expect(aetherProject.tagline).toBe('A collection of AI-powered tools and experiments.');
  expect(aetherProject.introduction.join(' ')).toBe("Experimenting with AI, building intelligent tools and exploring what's next.");
  expect(aetherProject.links!.map(l => l.label)).toEqual(['Live Demo', 'GitHub']);
  expect(aetherProject.media).toHaveLength(3);
});

test('the fifteen-technology test set is the ten plus five placeholder names, and validates as a project', () => {
  expect(AETHER_TECHNOLOGIES_15).toHaveLength(MAX_PRIMARY_TECHNOLOGIES);
  expect(AETHER_TECHNOLOGIES_15.slice(0, 10)).toEqual(aetherTechnologies);
  expect(AETHER_TECHNOLOGIES_15.slice(10).map(t => t.name)).toEqual(['Atom', 'Block', 'Mascot', 'Spark', 'Vite']);
  expect(validateProject(aetherProjectFor(AETHER_TECHNOLOGIES_15), AETHER_TECHNOLOGIES_15).issues).toEqual([]);
});
