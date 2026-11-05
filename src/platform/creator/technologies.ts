import { CATALOG } from './catalog';
import type { TechnologyId } from './types';

// The display names of the shared technology catalogue (spec 7.13, catalog.ts): the four worlds' lists plus the approved common set.
const NAMES: ReadonlyMap<string, string> = new Map(CATALOG.map(tech => [tech.id, tech.name]));

/** The display name of a technology id, or the id itself when the catalogue does not know it. */
export const technologyName = (id: TechnologyId): string => NAMES.get(id) ?? id;
