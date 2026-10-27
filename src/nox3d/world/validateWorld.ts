import type { Placement, Vec3, WorldConfig, WorldLayout } from './types';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const colour = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Optional placement fields and what each must hold when present. */
const PLACEMENT_FIELDS: Record<string, (v: unknown) => boolean> = {
  rotY: finite,
  tilt: finite,
  scale: v => (finite(v) && v > 0) || (vec3(v) && v.every(n => n > 0)),
  runes: v => Number.isInteger(v) && (v as number) >= 0,
  light: v => typeof v === 'boolean',
};

/**
 * What is wrong with raw layout data (layout.json) against `WorldLayout`, in words; an empty list
 * means it is one. Unknown keys are reported too: the Blender kit script reads the same file and
 * would pass over a misspelt key without a word.
 */
export function layoutProblems(data: unknown): string[] {
  if (!record(data)) return ['the layout is not an object'];
  const problems: string[] = [];
  const known = ['floorY', 'pillars', 'rocks', 'corals', 'chains', 'coralLights'];
  for (const key of Object.keys(data)) if (!known.includes(key)) problems.push(`the layout has an unknown key "${key}"`);
  if (!finite(data.floorY)) problems.push('floorY is not a number');

  const list = (name: string, check: (item: unknown, at: string) => void) => {
    const items = data[name];
    if (!Array.isArray(items)) problems.push(`${name} is not a list`);
    else items.forEach((item, i) => check(item, `${name}[${i}]`));
  };
  const placement = (item: unknown, at: string) => {
    if (!record(item)) {
      problems.push(`${at} is not an object`);
      return;
    }
    if (typeof item.piece !== 'string' || item.piece === '') problems.push(`${at} has no piece name`);
    if (!vec3(item.position)) problems.push(`${at} has no x, y, z position`);
    for (const [key, value] of Object.entries(item)) {
      if (key === 'piece' || key === 'position') continue;
      const check = PLACEMENT_FIELDS[key];
      if (!check) problems.push(`${at} has an unknown key "${key}"`);
      else if (!check(value)) problems.push(`${at}.${key} is not valid`);
    }
  };
  list('pillars', placement);
  list('rocks', placement);
  list('corals', placement);
  list('chains', (item, at) => {
    if (!record(item) || !vec3(item.from) || !vec3(item.to) || !finite(item.sag) || item.sag < 0) problems.push(`${at} needs from, to and a sag of 0 or more`);
    else for (const key of Object.keys(item)) if (!['from', 'to', 'sag'].includes(key)) problems.push(`${at} has an unknown key "${key}"`);
  });
  list('coralLights', (item, at) => vec3(item) || problems.push(`${at} is not an x, y, z position`));
  return problems;
}

/** Raw layout data as a `WorldLayout`, once it is checked to be one; throws the problems otherwise. */
export function asWorldLayout(data: unknown): WorldLayout {
  const problems = layoutProblems(data);
  if (problems.length > 0) throw new Error(`invalid world layout:\n${problems.join('\n')}`);
  return data as WorldLayout;
}

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

  for (const [name, value] of Object.entries(world.relics)) if (!finite(value) || value <= 0) problems.push(`relics.${name} must be above 0`);
  for (const [name, value] of Object.entries(palette)) if (!colour(value)) problems.push(`palette.${name} is not a #rrggbb colour`);
  if (!colour(lights.surface.color) || !colour(lights.fill.color)) problems.push('the surface and fill lights need #rrggbb colours');
  if (!vec3(lights.surface.position) || !vec3(lights.surface.target) || !vec3(lights.fill.position)) problems.push('the surface and fill lights need positions');
  if (!vec3(water.surfaceDir) || water.surfaceDir.every(n => n === 0)) problems.push('water.surfaceDir needs a direction');
  if (!finite(water.fogDensity) || water.fogDensity < 0) problems.push('water.fogDensity must be 0 or more');
  if (!finite(water.environmentIntensity) || water.environmentIntensity < 0) problems.push('water.environmentIntensity must be 0 or more');
  for (const [name, share] of Object.entries(live)) if (!finite(share) || share < 0 || share > 1) problems.push(`live.${name} must be between 0 and 1`);
  return problems;
}
