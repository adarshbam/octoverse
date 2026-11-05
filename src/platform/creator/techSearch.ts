import { CATALOG } from './catalog';
import type { Technology } from './types';

// The technology picker's search (spec 7.13): a text filter over the shared catalog. There is no free-text technology in v1, so the
// picker only ever offers catalog entries. Pure.

export interface TechnologySearch {
  /** At most `limit` entries: names that start with the text first, then names (or ids, or categories) that contain it, each in catalog order. */
  matches: readonly Technology[];
  /** How many entries matched in all (before `limit`), chosen ones excluded. */
  total: number;
}

/** Catalog entries matching `query` (case-insensitive, by name, id or category), leaving out the ids in `chosen`. An empty query matches everything. */
export function searchTechnologies(query: string, chosen: readonly string[], limit = 12): TechnologySearch {
  const text = query.trim().toLowerCase();
  const taken = new Set(chosen);
  const starts: Technology[] = [];
  const contains: Technology[] = [];
  for (const tech of CATALOG) {
    if (taken.has(tech.id)) continue;
    const name = tech.name.toLowerCase();
    if (text === '' || name.startsWith(text)) starts.push(tech);
    else if (name.includes(text) || tech.id.toLowerCase().includes(text) || tech.category.toLowerCase().includes(text)) contains.push(tech);
  }
  const all = [...starts, ...contains];
  return { matches: all.slice(0, Math.max(0, limit)), total: all.length };
}
