import * as THREE from 'three';
import type { Placement, Vec3, WorldConfig, WorldLayout } from './types';

// The near world's baked light. blender/security/bake_world.py builds the kit's pieces with a
// second UV set, lays layout.json out with the glyph and lava lights, the fill and the surface
// light, and bakes their light on the stone, rock, coral and seabed into lightmaps. near.glb
// carries the pieces, the lightmaps (KTX2) and a record of the bake (its scene's `nox_bake` extras).

/** One piece's place in its atlas, as three's texture transform: offset u, offset v, repeat u, repeat v. */
export type LightRect = readonly [number, number, number, number];

/** A point light as the bake had it, in the page's units (WorldLight without the skin's range). */
export interface BakedPointLight {
  position: Vec3;
  color: string;
  intensity: number;
  distance: number;
}

/** What bake_world.py records in near.glb. */
export interface BakeRecord {
  /** Lightmap texels hold irradiance divided by this, sRGB-encoded: the materials' `lightMapIntensity`. */
  intensity: number;
  /** The nodes whose material carries each atlas as its emissive map: full detail, lod1, seabed. */
  atlases: { lod0: string; lod1: string; seabed: string };
  /** Each placement as layout.json had it, and its rect in the lod0 and lod1 atlases. */
  instances: Record<'pillars' | 'rocks' | 'corals', { placement: Placement; lod0: LightRect; lod1: LightRect }[]>;
  /** The seabed grid the bake built, and heights it sampled from its copy of floorHeight: [x, z, y]. */
  seabed: { width: number; nearZ: number; farZ: number; segments: [number, number]; samples: [number, number, number][] };
  /** The lights baked: glyph and lava as point lights, the fill, and the surface light (its bounce only). */
  lights: { glyph: BakedPointLight[]; lava: BakedPointLight[]; fill: WorldConfig['lights']['fill']; surface: WorldConfig['lights']['surface'] };
  /** The relics' spill: the glyph lights' rise over the WorldLight data. */
  spill: number;
  /** How it was baked (resolutions, samples, occlusion), for the record. */
  settings: Record<string, unknown>;
}

const isRect = (r: unknown) => Array.isArray(r) && r.length === 4 && r.every(n => typeof n === 'number' && Number.isFinite(n));

/** near.glb's bake record, once its parts are there; throws naming what is missing. */
export function asBakeRecord(data: unknown): BakeRecord {
  const r = data as Partial<BakeRecord> | undefined;
  const problems: string[] = [];
  if (!r || typeof r !== 'object') throw new Error('near.glb has no bake record (scene extras nox_bake)');
  if (typeof r.intensity !== 'number' || !(r.intensity > 0)) problems.push('intensity');
  if (!r.atlases || !['lod0', 'lod1', 'seabed'].every(k => typeof r.atlases?.[k as keyof BakeRecord['atlases']] === 'string')) problems.push('atlases');
  for (const group of ['pillars', 'rocks', 'corals'] as const) {
    const list = r.instances?.[group];
    if (!Array.isArray(list) || !list.every(i => i?.placement && isRect(i.lod0) && isRect(i.lod1))) problems.push(`instances.${group}`);
  }
  if (!Array.isArray(r.seabed?.samples) || !Array.isArray(r.seabed?.segments)) problems.push('seabed');
  if (!Array.isArray(r.lights?.glyph) || !Array.isArray(r.lights?.lava) || !r.lights?.fill || !r.lights?.surface) problems.push('lights');
  if (typeof r.spill !== 'number') problems.push('spill');
  if (problems.length > 0) throw new Error(`near.glb's bake record lacks ${problems.join(', ')}`);
  return r as BakeRecord;
}

/**
 * The real-time lights on the world's stone. With the near world baked, the glyph, lava and fill
 * light are in its lightmaps, so there are none: the glyph and lava lights stay only as WorldLight
 * data for Nox's accents. Without near.glb the stone is lit as before the bake.
 */
export function stoneLights(world: WorldConfig) {
  return world.near ? { points: [], fill: null } : { points: world.lights.points, fill: world.lights.fill };
}

/** near.glb's baked light, read from its loaded scene: the record and the three atlases. */
export interface BakedLight {
  record: BakeRecord;
  atlases: Record<keyof BakeRecord['atlases'], THREE.Texture>;
}

/** The baked light in near.glb's scene; throws if it was baked from another layout than `layout`. */
export function bakedLightOf(scene: THREE.Object3D, layout: WorldLayout): BakedLight {
  const record = asBakeRecord(scene.userData.nox_bake);
  for (const group of ['pillars', 'rocks', 'corals'] as const) {
    const baked = record.instances[group].map(i => i.placement.piece).join();
    if (baked !== layout[group].map(p => p.piece).join()) throw new Error(`near.glb was baked from another layout (${group}): run blender/security/bake_world.py`);
  }
  const atlas = (name: string) => {
    const map = ((scene.getObjectByName(name) as THREE.Mesh | undefined)?.material as THREE.MeshStandardMaterial | undefined)?.emissiveMap;
    if (!map) throw new Error(`near.glb has no lightmap on ${name}`);
    return map;
  };
  const { lod0, lod1, seabed } = record.atlases;
  return { record, atlases: { lod0: atlas(lod0), lod1: atlas(lod1), seabed: atlas(seabed) } };
}

/**
 * A lightmap: a copy of an atlas read through the lightmap UV set (uv1), framed on one piece's rect
 * when it has one, clamped at the atlas's edges. Copies share the atlas's image, which the GPU holds
 * once.
 */
export function lightMapOf(atlas: THREE.Texture, rect?: LightRect) {
  const map = atlas.clone();
  map.channel = 1;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  if (rect) {
    map.offset.set(rect[0], rect[1]);
    map.repeat.set(rect[2], rect[3]);
  }
  return map;
}

/**
 * Lightmaps carry diffuse light only, but the real lights they replace also lit the stone's sheen,
 * which on dark wet rock is most of what shows. Patched into a lit material's fragment shader, this
 * gives its specular the baked light back as radiance (irradiance / π), weighted by how squarely the
 * surface faces the camera: the light arrives from in front of the surface, so a reflection that
 * grazes it, as the low camera sees the seabed, looks away from that light. The sheen keeps its
 * average strength, not its highlights. Without a lightmap it does nothing.
 */
export function withBakedSheen(fragmentShader: string) {
  return fragmentShader.replace(
    '#include <lights_fragment_maps>',
    `#include <lights_fragment_maps>
    #ifdef USE_LIGHTMAP
      radiance += lightMapIrradiance * RECIPROCAL_PI * saturate( dot( geometryNormal, geometryViewDir ) );
    #endif`,
  );
}
