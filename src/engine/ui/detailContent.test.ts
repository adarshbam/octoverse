import { expect, test } from 'vitest';
import { noxProject } from '../../nox3d/content/noxProject';
import { noxTechnologies } from '../../nox3d/content/noxTechnologies';
import type { Project } from '../content/projectTypes';
import { DETAIL_PANEL_BOX, detailPages, detailTechnologies, featureCards, overviewText, safeHref } from './detailContent';
import { NOX_STAGE_FRAMES } from '../../nox3d/bundle.nox';
import { stageBoxFor } from './useStageBox';

test('the sections listed are the overview, then every section with something in it, in order', () => {
  expect(detailPages(noxProject, true).map(page => page.title)).toEqual(['Overview', 'Features', 'Vulnerabilities', 'Writeups', 'Challenges', 'What I Learned']);
});

test('sections with nothing in them are left out; with none, there is only the overview', () => {
  const blank: Project = { ...noxProject, sections: [{ id: 'empty', title: 'Empty', summary: '  ', items: [' '] }, { id: 'untitled', title: ' ', summary: 'Text' }] };
  expect(detailPages(blank, true).map(page => page.id)).toEqual(['overview']);
  expect(detailPages({ ...noxProject, sections: [] }, true).map(page => page.id)).toEqual(['overview']);
});

test('storyboard sections show only while developing', () => {
  expect(detailPages(noxProject, false).map(page => page.id)).toEqual(['overview']);
  expect(featureCards(noxProject, false)).toEqual([]);
  expect(overviewText(noxProject, false)).toEqual({ text: noxProject.introduction.join(' '), placeholder: false });
});

test('the overview text is the overview section, or else the introduction', () => {
  expect(overviewText(noxProject, true).text).toMatch(/^A hands-on web security lab where I explore/);
  expect(overviewText(noxProject, true).placeholder).toBe(true);
  expect(overviewText({ ...noxProject, sections: [] }, true)).toEqual({ text: noxProject.introduction.join(' '), placeholder: false });
});

test('feature cards come from the Features items, each split into a title and a line', () => {
  expect(featureCards(noxProject, true)).toEqual([
    { title: 'Vulnerable Apps', text: 'Intentional vulnerabilities for learning' },
    { title: 'Exploitation Labs', text: 'SQLi, XSS, CSRF, IDOR and more' },
    { title: 'Writeups', text: 'Detailed explanations and fixes' },
    { title: 'Tool Integration', text: 'Burp Suite, Nmap, Metasploit, custom tools' },
  ]);
  expect(featureCards({ ...noxProject, sections: [{ id: 'features', title: 'Features', items: ['Plain item'] }] }, true)).toEqual([{ title: 'Plain item', text: '' }]);
  expect(featureCards({ ...noxProject, sections: [] }, true)).toEqual([]);
});

test('only web links open', () => {
  expect(safeHref('https://yourvaultstorage.com/')).toBe('https://yourvaultstorage.com/');
  expect(safeHref('javascript:alert(1)')).toBeUndefined();
  expect(safeHref('not a url')).toBeUndefined();
});

test('the panel lands where panel 5 paints it, framed as panel 5', () => {
  // The high-quality panel 5 is 1672 x 941; its panel spans (722, 222) to (1637, 846).
  const box = stageBoxFor(NOX_STAGE_FRAMES.detail, DETAIL_PANEL_BOX, { width: 1672, height: 941 });
  expect(Math.abs(box.left - 722)).toBeLessThan(4);
  expect(Math.abs(box.top - 222)).toBeLessThan(4);
  expect(Math.abs(box.left + box.width - 1637)).toBeLessThan(4);
  expect(Math.abs(box.top + box.height - 846)).toBeLessThan(4);
});

test('the technology chips follow the project order, then any other technology it uses; unknown ones are left out', () => {
  expect(detailTechnologies(noxProject, noxTechnologies).map(technology => technology.id)).toEqual(noxProject.primaryTechnologyIds);
  const other: Project = { ...noxProject, primaryTechnologyIds: ['docker', 'nope'], technologyUsages: [{ id: 'u1', technologyId: 'python' }, { id: 'u2', technologyId: 'docker' }] };
  expect(detailTechnologies(other, noxTechnologies).map(technology => technology.id)).toEqual(['docker', 'python']);
});
