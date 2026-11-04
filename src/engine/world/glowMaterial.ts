import * as THREE from 'three';
import { isColour } from './colour';

// The `glow` kit material (KIT_MATERIAL_VARIANTS, kitMaterials.ts): a piece that gives off light of
// its own, such as a bioluminescent sprig or a lit lock, pulsing slowly. A world assigns it to a kit
// node by name (`WorldConfig.materials`) and gives its colour; nothing here is any world's. With
// `tips` above 0 the glow follows the piece's baked colour (`Col`, the kit's vertex colours: dim at
// the base, bright at the tips) to that power; at 0 the piece glows evenly and needs no vertex colour.

/** The glow's colour, strength and pulse, from the world's config. */
export interface GlowParams {
  /** The light it gives off (`#rrggbb`). */
  color: string;
  /** Its strength at full: the emissive intensity. */
  strength: number;
  /** 0: an even glow; above 0, the power the piece's vertex colour (red) is raised to before it scales the glow. */
  tips: number;
  /** How deep the pulse dips, 0 (none) to 1 (to dark): the glow swings between 1 - pulse and 1 of its strength. */
  pulse: number;
  /** Seconds a pulse takes. */
  period: number;
}

/** The pulse's factor at time `t` for a piece whose phase is `phase` (radians): between 1 - pulse and 1, and 1 - pulse / 2 while the world's motion holds still. Mirrors the GLSL. */
export function glowPulse(params: Pick<GlowParams, 'pulse' | 'period'>, t: number, phase: number, motion: number) {
  return 1 - params.pulse + params.pulse * (0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / params.period + phase) * motion);
}

/** The brightest emissive luminance (linear) the glow can draw: its colour at full strength (the pulse only dims it). */
export function glowBrightest(params: GlowParams): number {
  const c = new THREE.Color(params.color);
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * params.strength;
}

/** What is wrong with glow params, in words (an empty list: they are valid). */
export function glowProblems(params: GlowParams, at: string): string[] {
  const problems: string[] = [];
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!(typeof params?.color === 'string' && /^#[0-9a-f]{6}$/i.test(params.color) && isColour(params.color))) problems.push(`${at}.color is not a #rrggbb colour`);
  if (!finite(params?.strength) || params.strength < 0) problems.push(`${at}.strength must be 0 or more`);
  if (!finite(params?.tips) || params.tips < 0) problems.push(`${at}.tips must be 0 or more`);
  if (!finite(params?.pulse) || params.pulse < 0 || params.pulse > 1) problems.push(`${at}.pulse must be between 0 and 1`);
  if (!finite(params?.period) || params.period <= 0) problems.push(`${at}.period must be above 0`);
  return problems;
}

/** The glow's fragment term: the pulse, on each piece's own beat (from where it stands), and with `TIPS` the vertex colour's red to that power. */
export const GLOW_GLSL = /* glsl */ `
  {
    float beat = vGlowPhase + uTime * 6.28318530718 / uGlowPeriod;
    totalEmissiveRadiance *= 1.0 - uGlowPulse + uGlowPulse * (0.5 + 0.5 * sin(beat) * uMotion);
    #ifdef TIPS
      totalEmissiveRadiance *= pow(max(vColor.r, 0.0), uGlowTips);
    #endif
  }`;

/**
 * A glow material for `params` (shared by every placement it is assigned to: each pulses on the
 * beat of where it stands), and its per-frame update: the world time and whether its motion runs.
 */
export function makeGlowMaterial(params: GlowParams) {
  const uniforms = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uGlowPulse: { value: params.pulse },
    uGlowPeriod: { value: params.period },
    uGlowTips: { value: params.tips },
  };
  const tips = params.tips > 0;
  // A dark surface that emits: the surface light and the water still shade it a little.
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 0, 0),
    roughness: 0.55,
    emissive: new THREE.Color(params.color),
    emissiveIntensity: params.strength,
    vertexColors: tips,
  });
  material.name = 'glow';
  if (tips) material.defines = { TIPS: '' };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGlowPhase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlowPhase = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 0.9;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uMotion;\nuniform float uGlowPulse;\nuniform float uGlowPeriod;\nuniform float uGlowTips;\nvarying float vGlowPhase;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${GLOW_GLSL}`);
  };
  material.customProgramCacheKey = () => (tips ? 'kit-glow-tips' : 'kit-glow');
  return {
    material,
    uniforms,
    update(t: number, motion: number) {
      uniforms.uTime.value = t;
      uniforms.uMotion.value = motion;
    },
  };
}
