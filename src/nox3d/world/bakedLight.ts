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
  /**
   * Each placement as layout.json had it, its rect in the lod0 and lod1 atlases, and where the bake
   * stood it: its matrix in stage space (column-major, as three's `Matrix4.elements`) and, for coral,
   * what it came to rest on.
   */
  instances: Record<'pillars' | 'rocks' | 'corals', { placement: Placement; lod0: LightRect; lod1: LightRect; matrix: number[]; restsOn?: 'rock' | 'seabed' }[]>;
  /** The seabed grid the bake built, and heights it sampled from its copy of floorHeight: [x, z, y]. */
  seabed: { width: number; nearZ: number; farZ: number; segments: [number, number]; samples: [number, number, number][] };
  /** The lights baked: glyph and lava as point lights, the fill, and the surface light (its bounce only). */
  lights: { glyph: BakedPointLight[]; lava: BakedPointLight[]; back: BakedPointLight[]; fill: WorldConfig['lights']['fill']; surface: WorldConfig['lights']['surface'] };
  /** The relics' spill: the glyph lights' rise over the WorldLight data. */
  spill: number;
  /** The lava lights' rise over the WorldLight data (`glow.lava`), and the intensity of the lights behind the rock heaps in times the lava data's (`glow.back`). */
  lavaRise: number;
  backRise: number;
  /**
   * The relief maps beside the lightmaps (each atlas quad's normal map): per texel the glyph and
   * lava light's main direction in stage space, its length s / (s + scale) for their strength s
   * along it, stored linear as (v + 1) / 2.
   */
  relief: { scale: number; encoding: string };
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
    const placed = (i: BakeRecord['instances'][typeof group][number]) => Array.isArray(i?.matrix) && i.matrix.length === 16 && (group !== 'corals' || i.restsOn === 'rock' || i.restsOn === 'seabed');
    if (!Array.isArray(list) || !list.every(i => i?.placement && isRect(i.lod0) && isRect(i.lod1) && placed(i))) problems.push(`instances.${group}`);
  }
  if (!Array.isArray(r.seabed?.samples) || !Array.isArray(r.seabed?.segments)) problems.push('seabed');
  if (!Array.isArray(r.lights?.glyph) || !Array.isArray(r.lights?.lava) || !Array.isArray(r.lights?.back) || !r.lights?.fill || !r.lights?.surface) problems.push('lights');
  if (typeof r.spill !== 'number') problems.push('spill');
  if (typeof r.lavaRise !== 'number' || typeof r.backRise !== 'number') problems.push('lavaRise, backRise');
  if (typeof r.relief?.scale !== 'number' || !(r.relief.scale > 0)) problems.push('relief');
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

/** near.glb's baked light, read from its loaded scene: the record, and the three atlases with their relief maps. */
export interface BakedLight {
  record: BakeRecord;
  atlases: Record<keyof BakeRecord['atlases'], THREE.Texture>;
  /** The relief map beside each atlas, for withBakedLight. */
  reliefMaps: Record<keyof BakeRecord['atlases'], THREE.Texture>;
}

/** The baked light in near.glb's scene; throws if it was baked from another layout than `layout`. */
export function bakedLightOf(scene: THREE.Object3D, layout: WorldLayout): BakedLight {
  const record = asBakeRecord(scene.userData.nox_bake);
  for (const group of ['pillars', 'rocks', 'corals'] as const) {
    const baked = record.instances[group].map(i => i.placement.piece).join();
    if (baked !== layout[group].map(p => p.piece).join()) throw new Error(`near.glb was baked from another layout (${group}): run blender/security/bake_world.py`);
  }
  const quad = (name: string, slot: 'emissiveMap' | 'normalMap') => {
    const map = ((scene.getObjectByName(name) as THREE.Mesh | undefined)?.material as THREE.MeshStandardMaterial | undefined)?.[slot];
    if (!map) throw new Error(`near.glb has no ${slot === 'emissiveMap' ? 'lightmap' : 'relief map'} on ${name}`);
    return map;
  };
  const { lod0, lod1, seabed } = record.atlases;
  return {
    record,
    atlases: { lod0: quad(lod0, 'emissiveMap'), lod1: quad(lod1, 'emissiveMap'), seabed: quad(seabed, 'emissiveMap') },
    reliefMaps: { lod0: quad(lod0, 'normalMap'), lod1: quad(lod1, 'normalMap'), seabed: quad(seabed, 'normalMap') },
  };
}

/**
 * A lightmap: a copy of an atlas read through the lightmap UV set (uv1), framed on one piece's rect
 * when it has one, clamped at the atlas's edges. Copies share the atlas's image, which the GPU holds
 * once. A relief map's copy is clamped the same way; it is read where its lightmap is.
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

/** What withBakedLight shades relief from: the relief map beside the material's lightmap, and the scale the bake stored its strengths with. */
export interface Relief {
  map: THREE.Texture;
  scale: number;
}

/** The relief from one of near.glb's relief maps (or a copy of one). */
export function reliefOf(light: BakedLight, map: THREE.Texture): Relief {
  return { map, scale: light.record.relief.scale };
}

/**
 * Patches a lit material's shader for its lightmap; without a lightmap it does nothing.
 *
 * Relief, with `relief` (stone, rock, seabed): a lightmap texel is far coarser than the normal
 * map's grain, so the baked light lands as if the surface were smooth. The relief map holds, per
 * texel, the main direction the glyph, lava and fill light came from and its strength along it
 * (weakened where the bake had less light: shadow, occlusion). That light is shaded again here,
 * once with the normal map and once with the surface's own normal, in the lightmap's colour, and
 * the difference goes onto the baked light. It never takes more than the bake gave. Its specular is shaded the same way, from the same direction. One
 * texture read; no light is looped over.
 *
 * Sheen: lightmaps carry diffuse light only, but the real lights they replace also lit the stone's
 * sheen, which on dark wet rock is most of what shows. Its specular gets the baked light back as
 * radiance (irradiance / π), weighted by how squarely the surface faces the camera: the light
 * arrives from in front of the surface, so a reflection that grazes it, as the low camera sees the
 * seabed, looks away from that light. The sheen keeps its average strength, not its highlights.
 */
export function withBakedLight(shader: { fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, relief: Relief | null) {
  // The direction is in stage (world) space, turned into view space here. An 8-bit zero is 128
  // in each channel, a length of 0.007 after decoding: below that there is no light.
  const reliefCode = relief
    ? /* glsl */ `
      {
        vec3 v = texture2D( bakedReliefMap, vLightMapUv ).xyz * 2.0 - 1.0;
        float m = length( v );
        float strength = bakedReliefScale * max( m - 0.007, 0.0 ) / max( 1.0 - m, 1e-3 );
        vec3 l = ( viewMatrix * vec4( v / max( m, 1e-4 ), 0.0 ) ).xyz;
        vec3 light = lightMapIrradiance * ( strength / max( dot( lightMapIrradiance, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 ) );
        vec3 relief = max( light * ( saturate( dot( geometryNormal, l ) ) - saturate( dot( nonPerturbedNormal, l ) ) ), -lightMapIrradiance );
        irradiance += relief;
        lightMapIrradiance += relief;
        vec3 specular = saturate( dot( geometryNormal, l ) ) * BRDF_GGX( l, geometryViewDir, geometryNormal, material )
          - saturate( dot( nonPerturbedNormal, l ) ) * BRDF_GGX( l, geometryViewDir, nonPerturbedNormal, material );
        reflectedLight.directSpecular += light * specular;
      }`
    : '';
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_maps>',
    /* glsl */ `#include <lights_fragment_maps>
    #ifdef USE_LIGHTMAP${reliefCode}
      radiance += lightMapIrradiance * RECIPROCAL_PI * saturate( dot( geometryNormal, geometryViewDir ) );
    #endif`,
  );
  if (relief) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `#include <common>
      uniform sampler2D bakedReliefMap;
      uniform float bakedReliefScale;`,
    );
    Object.assign(shader.uniforms, { bakedReliefMap: { value: relief.map }, bakedReliefScale: { value: relief.scale } });
  }
}
