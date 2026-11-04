import type { WorldConfig } from './types';

/** How much of the world is drawn: all of it, the kit lit in real time (no near.glb), or only the water's fog. */
export type WorldLevel = 0 | 1 | 2;
export const LAST_LEVEL: WorldLevel = 2;

/** The world as `level` draws it: the baked near world is given up at level 1. */
export function worldAtLevel(world: WorldConfig, level: WorldLevel): WorldConfig {
  return level === 0 ? world : { ...world, near: undefined };
}

/** The next, poorer level after a failure, or null when there is none left. */
export function nextLevel(level: WorldLevel): WorldLevel | null {
  return level < LAST_LEVEL ? ((level + 1) as WorldLevel) : null;
}

/**
 * The level after `failed` level's kit gave up (an error, or a request that never answered). Only
 * a failure of the level now shown steps it: the same failure reported twice (StrictMode calls
 * componentDidCatch twice), or one from a level already left, changes nothing.
 */
export function stepFrom(current: WorldLevel, failed: WorldLevel): WorldLevel {
  return current === failed ? (nextLevel(current) ?? current) : current;
}
