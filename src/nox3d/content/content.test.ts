import { expect, test } from 'vitest';
import { noxProject } from './noxProject';
import { noxTechnologies } from './noxTechnologies';
import { validateProject } from './validateProject';

test('nox project validates against its catalog', () => {
  expect(validateProject(noxProject, noxTechnologies).issues).toEqual([]);
});

test('every technology has a usage and all storyboard copy is flagged placeholder', () => {
  expect(noxProject.technologyUsages).toHaveLength(15);
  expect(noxProject.technologyUsages!.every(u => u.placeholder === true)).toBe(true);
  expect(noxProject.sections!.map(s => s.title)).toEqual(['Overview', 'Features', 'Vulnerabilities', 'Writeups', 'Challenges', 'What I Learned']);
});

test('live link is labelled Live Demo', () => {
  expect(noxProject.links!.find(l => l.kind === 'live')!.label).toBe('Live Demo');
});
