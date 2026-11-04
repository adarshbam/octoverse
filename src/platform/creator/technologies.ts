import { contentFor, type ShowcaseWorld } from '../fixtures/worldContent';
import type { TechnologyId } from './types';

// A stand-in for the shared technology catalogue (spec 7.13, Task 19): the union of the four worlds' own technology lists, read from
// their content (never a bundle). The first world to declare an id names it.
const WORLDS: readonly ShowcaseWorld[] = ['veyra', 'flux', 'nox', 'aether'];
const NAMES = new Map<string, string>();
for (const world of WORLDS) for (const tech of contentFor(world).technologies) if (!NAMES.has(tech.id)) NAMES.set(tech.id, tech.name);

/** The display name of a technology id, or the id itself when the catalogue does not know it. */
export const technologyName = (id: TechnologyId): string => NAMES.get(id) ?? id;
