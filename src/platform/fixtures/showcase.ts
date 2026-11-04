import type { WorldId } from '../../engine/types/bundle';
import { contentFor, type ShowcaseWorld } from './worldContent';

// The showcase portfolios (platform spec 2.5, 7.11, 7.12): the OctoVerse team's four example profiles, each its
// world's octopus with the one project that world hosts. Fixture data: it is built from each world's content, so no
// name, epithet or slug is written twice, and it is deep-frozen so nothing (the creator's draft included) can change it.
// A link or a location appears only if the world's content supplies one; none does yet.

export interface ShowcaseProfile {
  handle: ShowcaseWorld;
  world: WorldId;
  name: string;
  epithet: string;
  projects: readonly { slug: string; bundle: WorldId }[];
  link?: string;
  location?: string;
}

/** The order Explore, the landing's cards and these profiles keep: Veyra, Flux, Nox, Aether. */
const HANDLES: readonly ShowcaseWorld[] = ['veyra', 'flux', 'nox', 'aether'];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

function profile(handle: ShowcaseWorld): ShowcaseProfile {
  const content = contentFor(handle);
  return {
    handle,
    world: handle,
    name: content.name,
    epithet: content.epithet,
    projects: [{ slug: content.slug, bundle: handle }],
    ...(content.link !== undefined && { link: content.link }),
    ...(content.location !== undefined && { location: content.location }),
  };
}

export const SHOWCASE: readonly ShowcaseProfile[] = deepFreeze(HANDLES.map(profile));

/** The showcase profile for a handle, or undefined (an unknown handle is the not-found page, never a guess). */
export function profileFor(handle: string): ShowcaseProfile | undefined {
  return SHOWCASE.find(p => p.handle === handle);
}
