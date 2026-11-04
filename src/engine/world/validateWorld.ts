import { isWorldColour } from './colour';
import { DEFAULT_FLOOR, FLOOR_MATERIALS } from './floors';
import { silhouetteProblems } from './fish';
import { LIVE_ELEMENT_IDS, MAX_JELLYFISH, MAX_STRANDS, STRAND_ELEMENT_IDS } from './live';
import { kitMaterialProblems } from './kitMaterials';
import { PROP_DRIVE_IDS } from './props';
import type { FloorGlow, Placement, Vec3, WaterColours, WorldConfig, WorldLayout } from './types';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const colour = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The water's own colours (`WorldConfig['water']['colours']`), every one required. */
const WATER_COLOURS = ['deep', 'zenith', 'glow', 'opening', 'rays', 'raysWide', 'fish'] as const satisfies readonly (keyof WaterColours)[];

/** The seabed's glow colours (`WorldConfig['palette']['floorGlow']`), every one required. */
const FLOOR_GLOW = ['cracks', 'lava', 'sheen', 'pores'] as const satisfies readonly (keyof FloorGlow)[];

/** The palette colours the engine reads by name (the rest are named by lights, relics or the floor), and the relics it reads. */
const ENGINE_PALETTE = ['stone', 'coral', 'floor', 'waterFar'] as const;
const ENGINE_RELICS = ['glyph', 'coral', 'spill'] as const;

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
  const known = ['floorY', 'groups', 'chains', 'coralLights'];
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
  if (!record(data.groups)) problems.push('groups is not an object (a list of placements for each group name)');
  else
    for (const [name, items] of Object.entries(data.groups)) {
      if (name === '') problems.push('groups has a group with no name');
      if (!Array.isArray(items)) problems.push(`groups.${name} is not a list`);
      else items.forEach((item, i) => placement(item, `groups.${name}[${i}]`));
    }
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

/** The quality tiers a per-tier count names, lowest first: a count never rises as the tier falls. */
const TIERS_LOW_FIRST = ['low', 'medium', 'high'] as const;

/** What is wrong with a jellyfish element (`JellyfishConfig`), in words, each naming its field under `at`. */
function jellyfishProblems(jelly: unknown, at: string): string[] {
  if (!record(jelly)) return [`${at} needs count, size, bell, filament, pulse, drift and region`];
  const problems: string[] = [];
  const count = record(jelly.count) ? jelly.count : {};
  if (!record(jelly.count)) problems.push(`${at}.count needs a whole number for each tier (high, medium, low)`);
  for (const tier of TIERS_LOW_FIRST) {
    const n = count[tier];
    if (!finite(n) || !Number.isInteger(n) || n < 0) problems.push(`${at}.count.${tier} must be a whole number, 0 or more`);
    else if (n > MAX_JELLYFISH) problems.push(`${at}.count.${tier} must be at most ${MAX_JELLYFISH}`);
  }
  const [low, medium, high] = TIERS_LOW_FIRST.map(tier => count[tier]);
  if (finite(low) && finite(high) && low > high) problems.push(`${at}.count.low (${low}) must be at most count.high (${high}): a lower tier never draws more`);
  if (finite(medium) && ((finite(low) && medium < low) || (finite(high) && medium > high))) problems.push(`${at}.count.medium (${medium}) must be between count.low and count.high`);
  const range = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(finite) && v[0] > 0 && v[0] <= v[1];
  if (!range(jelly.size)) problems.push(`${at}.size must be [smallest, largest] bell radius, above 0, smallest first`);
  if (!range(jelly.pulse)) problems.push(`${at}.pulse must be [shortest, longest] seconds a beat, above 0, shortest first`);
  for (const name of ['bell', 'filament'] as const) if (!colour(jelly[name])) problems.push(`${at}.${name} is not a #rrggbb colour`);
  if (!finite(jelly.drift) || jelly.drift < 0) problems.push(`${at}.drift must be 0 or more`);
  const region = jelly.region;
  if (!record(region) || !vec3(region.min) || !vec3(region.max) || !region.min.every((v, i) => v < (region.max as Vec3)[i])) problems.push(`${at}.region needs min and max corners, min below max on every axis`);
  return problems;
}

/** What is wrong with a world, in words; an empty list means it is valid. */
export function validateWorld(world: WorldConfig): string[] {
  const problems: string[] = [];
  const { layout, lights, palette, water, live, camera, post } = world;
  const pieces = new Set(world.kit.pieces);
  const groups = Object.entries(layout.groups);

  const placements = (group: string, list: readonly Placement[]) =>
    list.forEach((p, i) => {
      if (!pieces.has(p.piece)) problems.push(`${group}[${i}] names "${p.piece}", which is not in the kit`);
      if (!vec3(p.position)) problems.push(`${group}[${i}] has no valid position`);
    });
  for (const [name, list] of groups) placements(name, list);

  if (!finite(layout.floorY)) problems.push('layout.floorY is not a number');
  if (layout.chains.length > 0 && !pieces.has('chain')) problems.push('chains need a "chain" piece in the kit');
  layout.chains.forEach((c, i) => {
    if (!vec3(c.from) || !vec3(c.to) || !finite(c.sag) || c.sag < 0) problems.push(`chains[${i}] needs from, to and a sag of 0 or more`);
  });
  layout.coralLights.forEach((v, i) => vec3(v) || problems.push(`coralLights[${i}] is not a position`));

  lights.points.forEach((light, i) => {
    const name = `light ${i} (${light.kind})`;
    if (typeof light.kind !== 'string' || light.kind === '') problems.push(`light ${i} has no kind`);
    if (!finite(light.skinRange) || light.skinRange <= 0) problems.push(`${name} has no skinRange`);
    if (!vec3(light.position)) problems.push(`${name} has no valid position`);
    if (!finite(light.intensity) || light.intensity < 0) problems.push(`${name} has no valid intensity`);
    if (!finite(light.distance) || light.distance <= 0) problems.push(`${name} has no valid distance`);
    if (!colour(light.color)) problems.push(`${name} has no valid colour`);
  });
  // Each lit pillar carries one glyph light, and each coral light one lava light.
  // Only pillars are lit: the kit dresses glyph panels, and the bake lights, the `pillars` group alone.
  for (const [name, list] of groups) if (name !== 'pillars') list.forEach((p, i) => p.light && problems.push(`${name}[${i}] is lit, but only pillars carry glyph lights`));
  const litPillars = (layout.groups.pillars ?? []).filter(p => p.light).length;
  const glyphLights = lights.points.filter(l => l.kind === 'glyph').length;
  if (glyphLights !== litPillars) problems.push(`${litPillars} pillars are lit but there are ${glyphLights} glyph lights`);
  const lavaLights = lights.points.filter(l => l.kind === 'lava').length;
  if (lavaLights !== layout.coralLights.length) problems.push(`${layout.coralLights.length} coral lights but ${lavaLights} lava lights`);

  for (const [name, value] of Object.entries(world.relics)) if (!finite(value) || value <= 0) problems.push(`relics.${name} must be above 0`);
  for (const name of ENGINE_RELICS) if (!(name in world.relics)) problems.push(`relics.${name} is missing (the engine reads it)`);
  const { floorGlow, ...flat } = palette;
  for (const [name, value] of Object.entries(flat)) if (!colour(value)) problems.push(`palette.${name} is not a #rrggbb colour`);
  for (const name of ENGINE_PALETTE) if (!(name in flat)) problems.push(`palette.${name} is missing (the engine reads it)`);
  if (!record(floorGlow)) problems.push('palette.floorGlow is missing (cracks, lava, sheen, pores)');
  else for (const name of FLOOR_GLOW) if (!isWorldColour(floorGlow[name])) problems.push(`palette.floorGlow.${name} is not a colour (#rrggbb, or color(srgb-linear r g b); black for none)`);
  // The palette's other colours are the ones lights, relics and the floor name: a colour nothing names is a mistake.
  const floorMaterial = world.floor?.material ?? DEFAULT_FLOOR;
  if (!Object.hasOwn(FLOOR_MATERIALS, floorMaterial)) problems.push(`floor.material "${String(floorMaterial)}" is not one of ${Object.keys(FLOOR_MATERIALS).join(', ')}`);
  else {
    const floorColours: readonly string[] = FLOOR_MATERIALS[floorMaterial].palette;
    for (const name of floorColours) if (!(name in flat)) problems.push(`palette.${name} is missing (the ${floorMaterial} floor reads it)`);
    const named = new Set<string>([...ENGINE_PALETTE, ...lights.points.map(l => l.kind), ...Object.keys(world.relics), ...floorColours]);
    for (const name of Object.keys(flat)) if (!named.has(name)) problems.push(`palette.${name} is named by no light, relic or floor`);
  }
  if (!colour(lights.surface.color) || !colour(lights.fill.color)) problems.push('the surface and fill lights need #rrggbb colours');
  if (!vec3(lights.surface.position) || !vec3(lights.surface.target) || !vec3(lights.fill.position)) problems.push('the surface and fill lights need positions');
  if (!vec3(water.surfaceDir) || water.surfaceDir.every(n => n === 0)) problems.push('water.surfaceDir needs a direction');
  if (!finite(water.fogDensity) || water.fogDensity < 0) problems.push('water.fogDensity must be 0 or more');
  if (!finite(water.environmentIntensity) || water.environmentIntensity < 0) problems.push('water.environmentIntensity must be 0 or more');
  if (!finite(water.causticStrength) || water.causticStrength < 0) problems.push('water.causticStrength must be 0 or more');
  if (!record(water.colours)) problems.push('water.colours is missing (deep, zenith, glow, opening, rays, raysWide, fish)');
  else for (const name of WATER_COLOURS) if (!colour(water.colours[name])) problems.push(`water.colours.${name} is not a #rrggbb colour`);
  if (!record(water.environment)) problems.push('water.environment is missing (top, horizon, low, seabedGlow)');
  else {
    for (const name of ['top', 'horizon', 'low'] as const) if (!colour(water.environment[name])) problems.push(`water.environment.${name} is not a #rrggbb colour`);
    const glow = water.environment.seabedGlow;
    if (glow !== null && !colour(glow)) problems.push('water.environment.seabedGlow is not a #rrggbb colour (or null for none)');
  }
  if (!isWorldColour(world.skinAccent)) problems.push('skinAccent is not a colour (#rrggbb, or color(srgb-linear r g b))');
  if (!finite(camera.tilt)) problems.push('camera.tilt is not a number');
  if (!finite(camera.hover.amount) || camera.hover.amount < 0) problems.push('camera.hover.amount must be 0 or more');
  if (!finite(camera.hover.pace) || camera.hover.pace < 0) problems.push('camera.hover.pace must be 0 or more');
  const { contactShadow, bloom, vignette } = post;
  for (const name of ['reach', 'minGap', 'maxGap', 'near', 'far'] as const) if (!finite(contactShadow[name])) problems.push(`post.contactShadow.${name} is not a number`);
  if (!colour(contactShadow.color)) problems.push('post.contactShadow.color is not a #rrggbb colour');
  if (!finite(contactShadow.strength) || contactShadow.strength < 0 || contactShadow.strength > 1) problems.push('post.contactShadow.strength must be between 0 and 1');
  if (finite(contactShadow.near) && finite(contactShadow.far) && contactShadow.near >= contactShadow.far) problems.push('post.contactShadow.near must be before far');
  for (const [name, value] of Object.entries(bloom)) if (!finite(value) || value < 0) problems.push(`post.bloom.${name} must be 0 or more`);
  for (const [name, value] of Object.entries(vignette)) if (!finite(value) || value < 0) problems.push(`post.vignette.${name} must be 0 or more`);
  if (world.farPlate) {
    const { cutZ, layers } = world.farPlate;
    if (!finite(cutZ)) problems.push('farPlate.cutZ is not a number');
    if (!Array.isArray(layers)) problems.push('farPlate.layers is not a list');
    else
      layers.forEach((layer, i) => {
        if (typeof layer?.url !== 'string' || layer.url === '') problems.push(`farPlate.layers[${i}] has no url`);
        if (!finite(layer?.z)) problems.push(`farPlate.layers[${i}].z is not a number`);
      });
  }
  const nodes = new Set([...world.kit.pieces, ...(world.kit.nodes ?? [])]);
  const propIds = new Set<string>();
  (world.props ?? []).forEach((prop, i) => {
    const at = `props[${i}] (${prop.id})`;
    if (typeof prop.id !== 'string' || prop.id === '') problems.push(`props[${i}] has no id`);
    else if (propIds.has(prop.id)) problems.push(`${at} repeats the id "${prop.id}"`);
    propIds.add(prop.id);
    if (!nodes.has(prop.node)) problems.push(`${at} names the kit node "${prop.node}", which is not in the kit`);
    if (!PROP_DRIVE_IDS.includes(prop.drive)) problems.push(`${at} has drive "${String(prop.drive)}", which is not one of ${PROP_DRIVE_IDS.join(', ')}`);
  });
  const kitNodes = new Set(world.kit.nodes ?? []);
  (world.kit.attached ?? []).forEach((a, i) => {
    if (!kitNodes.has(a?.node)) problems.push(`kit.attached[${i}] names "${String(a?.node)}", which is not one of kit.nodes`);
    if (!pieces.has(a?.piece)) problems.push(`kit.attached[${i}] (${String(a?.node)}) names the piece "${String(a?.piece)}", which is not in the kit`);
  });
  // What the page draws: the laid-out pieces, and the nodes attached to one of them.
  const laidOut = new Set(Object.values(world.layout.groups ?? {}).flatMap(list => (Array.isArray(list) ? list.map(p => p?.piece) : [])));
  const drawn = new Set([...laidOut, ...(world.kit.attached ?? []).filter(a => laidOut.has(a?.piece)).map(a => a?.node)]);
  const assigned = new Set<string>();
  (world.materials ?? []).forEach((m, i) => {
    const at = `materials[${i}] (${String(m?.node)})`;
    if (!nodes.has(m?.node)) problems.push(`${at} names the kit node "${String(m?.node)}", which is not in the kit`);
    else if (assigned.has(m.node)) problems.push(`${at} assigns "${m.node}" a second material`);
    else if (!drawn.has(m.node)) problems.push(`${at} names "${m.node}", which is neither laid out nor attached to a laid-out piece, so it is never drawn`);
    assigned.add(m?.node);
    if (record(m)) problems.push(...kitMaterialProblems(m, at));
  });
  // A glow's brightest value is its colour times its strength; an emissive drive would raise it past that bound.
  (world.props ?? []).forEach((prop, i) => {
    const material = (world.materials ?? []).find(m => m?.node === prop.node)?.material;
    if (prop.drive === 'emissive' && material === 'glow') problems.push(`props[${i}] (${prop.id}) drives the emissive of "${prop.node}", which has a glow material: a glow sets its own level`);
  });
  const { colours: liveColours, elements, fishSilhouette, ...shares } = live;
  if (fishSilhouette !== undefined) problems.push(...silhouetteProblems(fishSilhouette, 'live.fishSilhouette'));
  for (const [id, strand] of Object.entries((elements ?? {}) as Record<string, unknown>)) {
    const at = `live.elements.${id}`;
    if (!(LIVE_ELEMENT_IDS as string[]).includes(id)) problems.push(`${at} is not a live element (${LIVE_ELEMENT_IDS.join(', ')})`);
    else if (!(STRAND_ELEMENT_IDS as string[]).includes(id)) problems.push(...jellyfishProblems(strand, at));
    else if (!record(strand)) problems.push(`${at} needs count, height, sway and color`);
    else {
      if (!finite(strand.count) || !Number.isInteger(strand.count) || strand.count < 0) problems.push(`${at}.count must be a whole number, 0 or more`);
      else if (strand.count > MAX_STRANDS) problems.push(`${at}.count must be at most ${MAX_STRANDS}`);
      for (const name of ['height', 'sway'] as const) if (!finite(strand[name]) || strand[name] < 0) problems.push(`${at}.${name} must be 0 or more`);
      if (!colour(strand.color)) problems.push(`${at}.color is not a #rrggbb colour`);
    }
  }
  for (const [name, share] of Object.entries(shares)) if (!finite(share) || share < 0 || share > 1) problems.push(`live.${name} must be between 0 and 1`);
  if (!record(liveColours)) problems.push('live.colours is missing (bubbles, embers, motes, snow)');
  else {
    for (const [element, keys] of [['bubbles', ['rim', 'tint']], ['embers', ['color', 'hot']], ['motes', ['color', 'hot']]] as const) {
      const pair: unknown = liveColours[element];
      if (!record(pair)) problems.push(`live.colours.${element} is missing (${keys.join(', ')})`);
      else for (const key of keys) if (!colour(pair[key])) problems.push(`live.colours.${element}.${key} is not a #rrggbb colour`);
    }
    if (!colour(liveColours.snow)) problems.push('live.colours.snow is not a #rrggbb colour');
  }
  return problems;
}
