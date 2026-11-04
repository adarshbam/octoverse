import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { NOX_BUNDLE, NOX_THEME } from '../../worlds/nox/bundle';
import { BundleError, validateBundle } from '../types/bundle';
import { THEME_CHANNEL_VARS, THEME_COLOURS, THEME_VARS, type UiTheme, colourChannels, themeVars } from './theme';
import { TITLE_ICONS } from './titleIcons';

const UI = new URL('./', import.meta.url);
const sheets = readdirSync(UI)
  .filter(name => name.endsWith('.css'))
  .map(name => ({ name, css: readFileSync(new URL(name, UI), 'utf8') }));

/** Spaces after commas dropped and lower case: `rgba(26, 20, 40, 0.92)` and `rgba(26,20,40,0.92)` are one colour. */
const norm = (colour: string) => colour.replace(/\s+/g, '').toLowerCase();

/** Every `var(--oct-*, <fallback>)` in the stylesheets: the property, its fallback and where it is. */
const uses = sheets.flatMap(({ name, css }) => [...css.matchAll(/var\((--oct-[a-z-]+),\s*((?:[^()]|\([^()]*\))+?)\s*\)/g)].map(m => ({ name, property: m[1], fallback: m[2] })));

test('themeVars writes every colour token as its --oct-* property (and the channel tokens as r, g, b), and only those', () => {
  const vars = themeVars(NOX_THEME);
  expect(Object.keys(vars).sort()).toEqual([...Object.values(THEME_VARS), ...Object.values(THEME_CHANNEL_VARS)].sort());
  for (const [key, property] of Object.entries(THEME_VARS)) expect(vars[property]).toBe(NOX_THEME[key as keyof typeof THEME_VARS]);
  for (const [key, property] of Object.entries(THEME_CHANNEL_VARS)) expect(vars[property]).toBe(colourChannels(NOX_THEME[key as keyof typeof THEME_CHANNEL_VARS]));
  // Every colour of the theme is written one way or the other.
  expect([...THEME_COLOURS].sort()).toEqual(Object.keys(NOX_THEME).filter(key => !['titleIcon', 'poster', 'pageTitle'].includes(key)).sort());
  expect(vars['--oct-glow-rgb']).toBe('255, 40, 90');
  expect(vars['--oct-accent-rgb']).toBe('255, 59, 92');
  expect(vars['--oct-surface-edge-rgb']).toBe('255, 70, 110');
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
  // A channel token's colour, written out as the rgb()/rgba() a stylesheet would have held.
  const channels = Object.keys(THEME_CHANNEL_VARS).flatMap(key => {
    const rgb = norm(colourChannels(NOX_THEME[key as keyof typeof THEME_CHANNEL_VARS]));
    return [`rgba(${rgb},`, `rgb(${rgb})`];
  });
  for (const { name, css } of sheets) {
    const bare = norm(css.replace(/var\(--oct-[a-z-]+,\s*(?:[^()]|\([^()]*\))+?\s*\)/g, ''));
    for (const value of [...values, ...channels]) expect(bare.includes(value), `${name} writes ${value} bare`).toBe(false);
  }
});

test('colourChannels reads hex and rgb()/rgba() exactly, and anything else three reads as its 8-bit channels', () => {
  expect(colourChannels('#ff285a')).toBe('255, 40, 90');
  expect(colourChannels('#f0a')).toBe('255, 0, 170');
  expect(colourChannels('rgb(255, 40, 90)')).toBe('255, 40, 90');
  expect(colourChannels('rgba(255,70,110,0.7)')).toBe('255, 70, 110');
  expect(colourChannels('teal')).toBe('0, 128, 128');
  expect(colourChannels('hsl(0, 100%, 50%)')).toBe('255, 0, 0');
});

// The red and pink glows, lines and fills of Nox's HTML layer are tokens now (fix wave A): what is
// left bare in the stylesheets is near neutral (whites, violet-blacks, text greys) or named here.
test("the stylesheets hold no bare red or pink: every red-leaning colour outside a var() is named", () => {
  /** Colours outside a var(): the storyboard placeholder badge's amber is a status colour, not a world's. */
  const NAMED: Record<string, string> = { 'rgba(255,190,120,0.6)': 'placeholder badge border', '#ffd2a0': 'placeholder badge text' };
  const channelsOf = (colour: string) => {
    const hex = /^#([0-9a-f]{6})$/.exec(colour);
    if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
    return colour.slice(colour.indexOf('(') + 1).split(',').slice(0, 3).map(Number);
  };
  const hits: string[] = [];
  for (const { name, css } of sheets) {
    const bare = norm(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(--oct-[a-z-]+,\s*(?:[^()]|\([^()]*\))+?\s*\)/g, ''));
    for (const colour of bare.match(/#[0-9a-f]{6}\b|rgba?\([\d.,]+\)/g) ?? []) {
      const [r, g, b] = channelsOf(colour);
      // Red or pink: red the strongest channel, well above the weakest.
      if (r > g && r > b && r - Math.min(g, b) > 40 && !Object.hasOwn(NAMED, colour)) hits.push(`${name}: ${colour}`);
    }
  }
  expect(hits).toEqual([]);
});

test('the host sets the theme on its root: every title icon renders, and Nox carries the flame', () => {
  expect(NOX_THEME.titleIcon).toBe('flame');
  for (const [id, Icon] of Object.entries(TITLE_ICONS)) expect(renderToStaticMarkup(createElement(Icon)), id).toMatch(/^<svg/);
  const host = readFileSync(new URL('../host/WorldHost.tsx', import.meta.url), 'utf8');
  expect(host).toMatch(/themeVars\(bundle\.theme\)/);
  expect(host).toMatch(/className="spike" ref=\{frame\} style=\{theme\}/);
});

test('validateBundle names a theme colour token that is missing or not a colour: a world cannot fall back to Nox’s red by leaving one out', () => {
  const field = (theme: Record<string, unknown>) => {
    try {
      validateBundle({ ...NOX_BUNDLE, theme: theme as unknown as UiTheme });
    } catch (error) {
      if (error instanceof BundleError) return error.field;
      throw error;
    }
    return null;
  };
  const { glow: _glow, ...noGlow } = NOX_THEME;
  expect(field(noGlow)).toBe('theme.glow');
  expect(field({ ...NOX_THEME, lineHover: 'rose-ish' })).toBe('theme.lineHover');
  expect(field({ ...NOX_THEME, glow: 'rgb(63, 224, 197)', ink: '#04201c' })).toBeNull();
});

test('the padlock title icon is drawn in the theme button gradient and carries no colour of its own', () => {
  expect(Object.keys(TITLE_ICONS)).toEqual(['flame', 'padlock']);
  const markup = renderToStaticMarkup(createElement(TITLE_ICONS.padlock));
  expect(markup).toMatch(/^<svg/);
  expect(markup).toContain('var(--oct-button-from)');
  expect(markup).toContain('var(--oct-button-to)');
  expect(markup).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
});
