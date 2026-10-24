import * as icons from 'simple-icons';
import { expect, test } from 'vitest';
import { noxTechnologies } from '../content/noxTechnologies';
import { LOGO_SLUGS, logoColour } from './logoTexture';

test('every Nox technology has a logo slug that resolves in simple-icons', () => {
  for (const technology of noxTechnologies) {
    const slug = LOGO_SLUGS[technology.iconKey];
    expect(slug, technology.iconKey).toBeDefined();
    expect((icons as Record<string, unknown>)[slug], slug).toBeDefined();
  }
});

test('logos keep their brand colour, but near-black marks turn white so they show on dark glass', () => {
  expect(logoColour('html')).toBe('#E34F26');
  expect(logoColour('github')).toBe('#FFFFFF');
  expect(logoColour('express')).toBe('#FFFFFF');
  expect(logoColour('kali')).toBe('#FFFFFF');
});
