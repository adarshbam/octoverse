import type { Technology } from '../../../engine/content/projectTypes';
import { aetherTechnologies } from './aetherTechnologies';

// TEST ONLY: imported by tests, and later by the stills and perf scripts; nothing the bundle
// imports (bundle.ts and what it pulls in) may import this file, so none of these names ships.
// A test (bundle.test.ts) holds that, by reading the bundle path's sources.

/**
 * TEST ONLY, never part of the shipped bundle: the ten above plus five placeholder-named
 * technologies for the five marks panels 3 and 4 show without names (an atom-like mark, a golden
 * block, a white animal mascot, a gold-and-violet mark, and Vite's "V"). They give the overview
 * its full fifteen for the stills, the overview frame-rate run and the slot-table tests. The
 * owner names the real five later; until then none of these ships.
 */
export const AETHER_TECHNOLOGIES_15: readonly Technology[] = [
  ...aetherTechnologies,
  { id: 'atom', name: 'Atom', category: 'placeholder', iconKey: 'atom' },
  { id: 'block', name: 'Block', category: 'placeholder', iconKey: 'block' },
  { id: 'mascot', name: 'Mascot', category: 'placeholder', iconKey: 'mascot' },
  { id: 'spark', name: 'Spark', category: 'placeholder', iconKey: 'spark' },
  { id: 'vite', name: 'Vite', category: 'placeholder', iconKey: 'vite' },
];
