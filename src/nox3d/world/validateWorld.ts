import type { Placement, Vec3, WorldConfig } from './types';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const colour = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** What is wrong with a world, in words; an empty list means it is valid. */
export function validateWorld(world: WorldConfig): string[] {
  const problems: string[] = [];
  const { layout, lights, palette, water, live } = world;
  const pieces = new Set(world.kit.pieces);

  const placements = (group: string, list: readonly Placement[]) =>
    list.forEach((p, i) => {
      if (!pieces.has(p.piece)) problems.push(`${group}[${i}] names "${p.piece}", which is not in the kit`);
      if (!vec3(p.position)) problems.push(`${group}[${i}] has no valid position`);
    });
  placements('pillars', layout.pillars);
  placements('rocks', layout.rocks);
  placements('corals', layout.corals);

  if (!finite(layout.floorY)) problems.push('layout.floorY is not a number');
  if (layout.chains.length > 0 && !pieces.has('chain')) problems.push('chains need a "chain" piece in the kit');
  layout.chains.forEach((c, i) => {
    if (!vec3(c.from) || !vec3(c.to) || !finite(c.sag) || c.sag < 0) problems.push(`chains[${i}] needs from, to and a sag of 0 or more`);
  });
  layout.coralLights.forEach((v, i) => vec3(v) || problems.push(`coralLights[${i}] is not a position`));

  lights.points.forEach((light, i) => {
    const name = `light ${i} (${light.kind})`;
    if (!finite(light.skinRange) || light.skinRange <= 0) problems.push(`${name} has no skinRange`);
    if (!vec3(light.position)) problems.push(`${name} has no valid position`);
    if (!finite(light.intensity) || light.intensity < 0) problems.push(`${name} has no valid intensity`);
    if (!finite(light.distance) || light.distance <= 0) problems.push(`${name} has no valid distance`);
    if (!colour(light.color)) problems.push(`${name} has no valid colour`);
  });
  // Each lit pillar carries one glyph light, and each coral light one lava light.
  const litPillars = layout.pillars.filter(p => p.light).length;
  const glyphLights = lights.points.filter(l => l.kind === 'glyph').length;
  if (glyphLights !== litPillars) problems.push(`${litPillars} pillars are lit but there are ${glyphLights} glyph lights`);
  const lavaLights = lights.points.filter(l => l.kind === 'lava').length;
  if (lavaLights !== layout.coralLights.length) problems.push(`${layout.coralLights.length} coral lights but ${lavaLights} lava lights`);

  for (const [name, value] of Object.entries(palette)) if (!colour(value)) problems.push(`palette.${name} is not a #rrggbb colour`);
  if (!colour(lights.surface.color) || !colour(lights.fill.color)) problems.push('the surface and fill lights need #rrggbb colours');
  if (!vec3(lights.surface.position) || !vec3(lights.surface.target) || !vec3(lights.fill.position)) problems.push('the surface and fill lights need positions');
  if (!vec3(water.surfaceDir) || water.surfaceDir.every(n => n === 0)) problems.push('water.surfaceDir needs a direction');
  if (!finite(water.fogDensity) || water.fogDensity < 0) problems.push('water.fogDensity must be 0 or more');
  if (!finite(water.environmentIntensity) || water.environmentIntensity < 0) problems.push('water.environmentIntensity must be 0 or more');
  for (const [name, share] of Object.entries(live)) if (!finite(share) || share < 0 || share > 1) problems.push(`live.${name} must be between 0 and 1`);
  return problems;
}
