import { PALETTE_IDS, TEMPLATE_IDS, type PaletteId, type TemplateId } from './types';

// The dev-only creator review address, `?creator=<template>.<palette>` (platform spec 7.14): kept in a file of its own, with no
// import but the id lists, so src/app/main.tsx can read it without loading the templates (the landing's payload stays what it is).
// The bundle it names is built in review.ts.

export interface CreatorReview {
  template: TemplateId;
  palette: PaletteId;
}

/**
 * The template and palette a review address names, or null: `?creator=nox.rose`. `dev` is the build's own switch,
 * `import.meta.env.DEV` (main.tsx passes it, so a production build's bundler sees a constant false): when false the parameter is
 * ignored whatever it says. An unknown template or palette, or any other form, is null too (the address then means what it
 * meant before: the landing, or `?world=`).
 */
export function parseCreatorParam(search: string, dev: boolean): CreatorReview | null {
  if (!dev) return null;
  const value = new URLSearchParams(search).get('creator');
  if (value === null) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [template, palette] = parts;
  if (!(TEMPLATE_IDS as readonly string[]).includes(template) || !(PALETTE_IDS as readonly string[]).includes(palette)) return null;
  return { template: template as TemplateId, palette: palette as PaletteId };
}
