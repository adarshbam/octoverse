import * as THREE from 'three';
import { isColour } from './colour';
import { kitFogProblems, kitFogShare, withKitFog } from './kitFog';

// The `membrane` kit material (KIT_MATERIAL_VARIANTS, kitMaterials.ts): an energy membrane across a
// doorway, slow light lines flowing over it, brightest at its edge. A world assigns it to a kit node
// by name (`WorldConfig.materials`) and gives its colours; nothing here is any world's. The node's
// second UV set is the flow map the kit script writes: u round the doorway's edge (0 to 1, the
// seam one loop), v from 0 at the edge to 1 at the middle.
//
// It draws only light (a black surface with an emissive term), so its brightest value is known
// from its config alone (`membraneBrightest`): the relic rule of a world can be checked without a
// renderer. Its `emissiveIntensity` is the flash level a sequence may raise through the `emissive`
// prop drive (props.ts): 1 is its resting light, and the shader never draws more than `1 + flash`.

/** The membrane's colours and motion, from the world's config. */
export interface MembraneParams {
  /** The body of the membrane, between its lines (`#rrggbb`). */
  color: string;
  /** The edge and the light lines (`#rrggbb`). */
  edge: string;
  /** Flow cycles a second (0 holds the lines still). */
  flowSpeed: number;
  /** Line density: 1 is the kit's own spacing, more packs the lines closer. */
  flowScale: number;
  /** The most a flash may add on top of the resting light, as a share of it (0.3 is 30% brighter at its peak). */
  flash: number;
  /** The share of the world's fog it takes, 0 to 1 (kitFog.ts); unset, 1: the world's fog, as any surface. */
  fog?: number;
}

/**
 * The flow's phase at world time `t`, for flow speed `speed` (cycles a second): the fractional part
 * of `t * speed`, always in [0, 1]. The shader scrolls its lines by this phase times a full turn, so
 * the wrap from 1 back to 0 is seamless and the uniform keeps its precision however long the page runs.
 */
export function membraneFlow(t: number, speed = 1): number {
  const turns = t * speed;
  if (!Number.isFinite(turns)) return 0;
  const phase = turns - Math.floor(turns);
  return Math.min(Math.max(phase, 0), 1);
}

/** Luminance of a `#rrggbb` colour in three's linear working space. */
const linearLuminance = (colour: string) => {
  const c = new THREE.Color(colour);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/**
 * The brightest emissive luminance (linear) the membrane can draw: its brighter colour at full
 * strength, raised by a full flash. The shader's level never passes 1 + flash and its colour is a
 * mix of `color` and `edge`, so no pixel of it is brighter than this.
 */
export function membraneBrightest(params: MembraneParams): number {
  return Math.max(linearLuminance(params.color), linearLuminance(params.edge)) * (1 + params.flash);
}

/** What is wrong with membrane params, in words (an empty list: they are valid). */
export function membraneProblems(params: MembraneParams, at: string): string[] {
  const problems: string[] = [];
  const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && isColour(v);
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!hex(params?.color)) problems.push(`${at}.color is not a #rrggbb colour`);
  if (!hex(params?.edge)) problems.push(`${at}.edge is not a #rrggbb colour`);
  if (!finite(params?.flowSpeed) || params.flowSpeed < 0) problems.push(`${at}.flowSpeed must be 0 or more`);
  if (!finite(params?.flowScale) || params.flowScale <= 0) problems.push(`${at}.flowScale must be above 0`);
  if (!finite(params?.flash) || params.flash < 0) problems.push(`${at}.flash must be 0 or more`);
  problems.push(...kitFogProblems(params, at));
  return problems;
}

/**
 * The membrane's fragment term. `level` is the emissive intensity (the flash drive), capped at
 * `uFlashCap`; `edge` is 1 at the doorway's edge and gone a third of the way in; two families of
 * lines wind round the doorway (whole turns in u, so the seam does not show) and drift with the
 * flow; they fade toward the middle. The colour mixes the body toward the edge colour where the
 * edge or a line is, and the strength never passes 1 before the level.
 */
export const MEMBRANE_GLSL = /* glsl */ `
  {
    float level = clamp(totalEmissiveRadiance.g, 0.0, uFlashCap);
    float edge = 1.0 - smoothstep(0.0, 0.32, vFlow.y);
    float turn = vFlow.x * 6.28318530718;
    float drift = uFlow * 6.28318530718;
    float a = 1.0 - abs(sin(turn * 5.0 + vFlow.y * 7.0 * uFlowScale - drift));
    float b = 1.0 - abs(sin(turn * 3.0 - vFlow.y * 5.0 * uFlowScale + drift + 1.3));
    float lines = (pow(a, 18.0) * 0.8 + pow(b, 24.0) * 0.6) * (1.0 - 0.6 * vFlow.y);
    float lit = clamp(max(edge, lines), 0.0, 1.0);
    totalEmissiveRadiance = mix(uMembraneColor, uMembraneEdge, lit) * (0.32 + 0.68 * lit) * level;
  }`;

/**
 * A membrane material for `params`, and its per-frame update: the flow phase at world time `t`,
 * held still while the world's motion is (`motion` 0, as under ?freeze or reduced motion).
 */
export function makeMembraneMaterial(params: MembraneParams) {
  const uniforms = {
    uMembraneColor: { value: new THREE.Color(params.color) },
    uMembraneEdge: { value: new THREE.Color(params.edge) },
    uFlow: { value: 0 },
    uFlowScale: { value: params.flowScale },
    uFlashCap: { value: 1 + params.flash },
    uKitFog: { value: kitFogShare(params) },
  };
  // A black surface that only emits: emissive white at intensity 1 is the resting level, which the
  // shader reads as its level (the `emissive` prop drive raises the intensity for a flash).
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(0, 0, 0), emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1 });
  material.name = 'membrane';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#ifndef USE_UV1\nattribute vec2 uv1;\n#endif\nvarying vec2 vFlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFlow = uv1;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uMembraneColor;\nuniform vec3 uMembraneEdge;\nuniform float uFlow;\nuniform float uFlowScale;\nuniform float uFlashCap;\nvarying vec2 vFlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${MEMBRANE_GLSL}`);
    withKitFog(shader, uniforms.uKitFog);
  };
  // One program for every membrane: the shader text above is the same whatever the params.
  material.customProgramCacheKey = () => 'kit-membrane';
  return {
    material,
    uniforms,
    update(t: number, motion: number) {
      uniforms.uFlow.value = membraneFlow(t, params.flowSpeed * motion);
    },
  };
}
