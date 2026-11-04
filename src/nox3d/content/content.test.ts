import { expect, test } from 'vitest';
import { ARM_IDS as armsIds } from '../../engine/config/arms';
import { ARM_IDS as typesIds } from '../../engine/config/types';
import { noxProject } from './noxProject';
import { noxTechnologies } from './noxTechnologies';
import { ARM_IDS as projectIds, STAGE_PANELS } from './projectTypes';
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

test('Project has no coordinates', () => {
  expect(Object.keys(noxProject)).not.toContain('placements');
  expect(typesIds).toBe(projectIds);
  expect(typesIds).toBe(armsIds);
  expect(STAGE_PANELS.intro).toBe(2);
  expect(STAGE_PANELS.entering).toBe(1);
  expect(STAGE_PANELS.detail).toBe(5);
  expect(STAGE_PANELS.overview).toBe(3);
  expect(STAGE_PANELS.techFocus).toBe(4);
});
