import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { NOX_BUNDLE, NOX_THEME } from '../../nox3d/bundle.nox';
import { THEME_COLOURS, THEME_VARS, type UiTheme, themeVars } from './theme';
import { TITLE_ICONS } from './titleIcons';

const UI = new URL('./', import.meta.url);
const sheets = readdirSync(UI)
  .filter(name => name.endsWith('.css'))
  .map(name => ({ name, css: readFileSync(new URL(name, UI), 'utf8') }));

/** Spaces after commas dropped and lower case: `rgba(26, 20, 40, 0.92)` and `rgba(26,20,40,0.92)` are one colour. */
const norm = (colour: string) => colour.replace(/\s+/g, '').toLowerCase();

/** Every `var(--oct-*, <fallback>)` in the stylesheets: the property, its fallback and where it is. */
const uses = sheets.flatMap(({ name, css }) => [...css.matchAll(/var\((--oct-[a-z-]+),\s*((?:[^()]|\([^()]*\))+?)\s*\)/g)].map(m => ({ name, property: m[1], fallback: m[2] })));

test('themeVars writes every colour token as its --oct-* property, and only those', () => {
  const vars = themeVars(NOX_THEME);
  expect(Object.keys(vars).sort()).toEqual(Object.values(THEME_VARS).sort());
  for (const key of THEME_COLOURS) expect(vars[THEME_VARS[key]]).toBe(NOX_THEME[key]);
  expect(Object.keys(vars)).not.toContain('--oct-title-icon');
  // Another theme writes its own values.
  const other: UiTheme = { ...NOX_THEME, accent: '#00ff88', focusRing: 'teal' };
  expect(themeVars(other)['--oct-accent']).toBe('#00ff88');
  expect(themeVars(other)['--oct-focus-ring']).toBe('teal');
});

test("the stylesheets read every --oct-* property, each with Nox's value as its fallback", () => {
  const vars = themeVars(NOX_BUNDLE.theme);
  expect(uses.length).toBeGreaterThan(0);
  for (const use of uses) {
    expect(Object.keys(vars), `${use.name}: ${use.property}`).toContain(use.property);
    expect(norm(use.fallback), `${use.name}: ${use.property}`).toBe(norm(vars[use.property]));
  }
  // Every token is used by some stylesheet: a token no rule reads would be a theme field that does nothing.
  expect(new Set(uses.map(use => use.property))).toEqual(new Set(Object.keys(vars)));
});

test("no stylesheet writes one of Nox's theme colours bare (outside its var()), so a world's theme reaches every place it is used", () => {
  const values = THEME_COLOURS.map(key => norm(NOX_THEME[key]));
  for (const { name, css } of sheets) {
    const bare = norm(css.replace(/var\(--oct-[a-z-]+,\s*(?:[^()]|\([^()]*\))+?\s*\)/g, ''));
    for (const value of values) expect(bare.includes(value), `${name} writes ${value} bare`).toBe(false);
  }
});

test('the host sets the theme on its root: every title icon renders, and Nox carries the flame', () => {
  expect(NOX_THEME.titleIcon).toBe('flame');
  for (const [id, Icon] of Object.entries(TITLE_ICONS)) expect(renderToStaticMarkup(createElement(Icon)), id).toMatch(/^<svg/);
  const host = readFileSync(new URL('../host/WorldHost.tsx', import.meta.url), 'utf8');
  expect(host).toMatch(/themeVars\(bundle\.theme\)/);
  expect(host).toMatch(/className="spike" ref=\{frame\} style=\{theme\}/);
});
