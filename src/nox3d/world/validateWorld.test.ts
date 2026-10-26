/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SECURITY_WORLD } from './security/config';
import type { WorldConfig } from './types';
import { validateWorld } from './validateWorld';

const placements = (world: WorldConfig) => [...world.layout.pillars, ...world.layout.rocks, ...world.layout.corals];

test('SECURITY_WORLD is valid', () => {
  expect(validateWorld(SECURITY_WORLD)).toEqual([]);
});

test('every placement names a kit piece', () => {
  expect(placements(SECURITY_WORLD).length).toBeGreaterThan(30);
  for (const p of placements(SECURITY_WORLD)) expect(SECURITY_WORLD.kit.pieces).toContain(p.piece);
  expect(SECURITY_WORLD.kit.pieces).toContain('chain');
});

test('the kit file holds every piece the world names', () => {
  const glb = readFileSync(new URL('../../../public/nox/world/security/kit.glb', import.meta.url));
  // A glb is a 12-byte header, then a JSON chunk (length, type, data).
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] };
  const names = new Set(json.nodes.map(n => n.name));
  for (const piece of SECURITY_WORLD.kit.pieces) expect(names.has(piece), piece).toBe(true);
});

test('a world with an unknown piece or a light without skinRange is reported', () => {
  const [first, ...rest] = SECURITY_WORLD.layout.rocks;
  const unknown: WorldConfig = { ...SECURITY_WORLD, layout: { ...SECURITY_WORLD.layout, rocks: [{ ...first, piece: 'rock_99' }, ...rest] } };
  expect(validateWorld(unknown).join('\n')).toContain('rock_99');
  const [light, ...others] = SECURITY_WORLD.lights.points;
  const unranged: WorldConfig = {
    ...SECURITY_WORLD,
    lights: { ...SECURITY_WORLD.lights, points: [{ ...light, skinRange: undefined as unknown as number }, ...others] },
  };
  expect(validateWorld(unranged).join('\n')).toContain('skinRange');
});

test('one glyph light per lit pillar', () => {
  const lit = SECURITY_WORLD.layout.pillars.filter(p => p.light).length;
  const glyphs = SECURITY_WORLD.lights.points.filter(l => l.kind === 'glyph');
  expect(glyphs).toHaveLength(lit);
  const dropped: WorldConfig = { ...SECURITY_WORLD, lights: { ...SECURITY_WORLD.lights, points: SECURITY_WORLD.lights.points.slice(1) } };
  expect(validateWorld(dropped).join('\n')).toContain('glyph');
});

test('the layout carries the test scene: 14 pillars, 16 rocks, 11 corals, 4 chains, 4 coral lights', () => {
  const { layout } = SECURITY_WORLD;
  expect([layout.pillars.length, layout.rocks.length, layout.corals.length, layout.chains.length, layout.coralLights.length]).toEqual([14, 16, 11, 4, 4]);
  expect(layout.floorY).toBe(-2.45);
});
