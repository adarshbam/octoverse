import * as THREE from 'three';

// The `led` kit material (KIT_MATERIAL_VARIANTS, kitMaterials.ts): the status lights of a rack or a
// tower, each blinking on its own beat. A world assigns it to a kit node by name
// (`WorldConfig.materials`) and gives its pace; nothing here is any world's. The colour of each light
// is the kit's own vertex colour (glTF `COLOR_0`), its beat the custom attribute `_PHASE` (0 to 1,
// the same over a whole light): the phase sets where in its cycle the light is, and also, through
// `ledRate`, how fast it cycles within the params' `rate` range, so no two lights blink together.
//
// It draws only light (a black surface with an emissive term), so its brightest value is known from
// its config alone (`ledBrightest`): a vertex colour is at most white, so no light passes `intensity`.

/** The led's pace and strength, from the world's config. */
export interface LedParams {
  /** The emissive strength of a light that is on, as a multiple of its vertex colour (the brightest it draws). */
  intensity: number;
  /** The slowest and the fastest a light blinks, in cycles a second. */
  rate: readonly [number, number];
  /** The share of each cycle a light is on, above 0 and below 1. */
  duty: number;
}

/** How long a light takes to go from off to on (or back), in seconds: a soft edge, not a snap. */
export const LED_EDGE_SECONDS = 0.04;

/** Mixes `phase` into a fraction (0 to 1) for the rate; shared by the shader. */
const RATE_SPREAD = { scale: 7.31, offset: 0.137 };

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const f = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return f * f * (3 - 2 * f);
};

/** The blink rate of the light whose phase is `phase`: somewhere in `rate`, always the same for that phase. Mirrors the GLSL. */
export function ledRate(phase: number, rate: readonly [number, number]): number {
  const spread = phase * RATE_SPREAD.scale + RATE_SPREAD.offset;
  return rate[0] + (rate[1] - rate[0]) * (spread - Math.floor(spread));
}

/**
 * The level (0 off, 1 on) of a light at world time `t`, `phase` in cycles into its cycle, blinking
 * `rate` times a second and on for `duty` of each cycle. Off and on are exact; between them it ramps
 * over `LED_EDGE_SECONDS` (centred on the edge, so the share of time on stays `duty`). With
 * `motion` 0 (the world's motion held: ?freeze, reduced motion) it is the constant `duty`, the
 * mean of the blinking. Mirrors the GLSL.
 */
export function ledLevel(t: number, phase: number, rate: number, duty: number, motion = 1): number {
  const cycle = t * rate + phase;
  const c = cycle - Math.floor(cycle);
  // Half the edge in cycles, kept so the two edges of a cycle never overlap.
  const h = Math.min((LED_EDGE_SECONDS * rate) / 2, duty / 2, (1 - duty) / 2);
  const x = c > (1 + duty) / 2 ? c - 1 : c;
  const level = smoothstep(-h, h, x) * (1 - smoothstep(duty - h, duty + h, x));
  return duty + (level - duty) * motion;
}

/** The brightest emissive luminance (linear) a led can draw: a vertex colour is at most white, so its `intensity`. */
export function ledBrightest(params: LedParams): number {
  return params.intensity;
}

/** What is wrong with led params, in words (an empty list: they are valid). */
export function ledProblems(params: LedParams, at: string): string[] {
  const problems: string[] = [];
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!finite(params?.intensity) || params.intensity < 0) problems.push(`${at}.intensity must be 0 or more`);
  const rate: unknown = params?.rate;
  if (!Array.isArray(rate) || rate.length !== 2 || !rate.every(r => finite(r) && r > 0) || rate[0] > rate[1]) problems.push(`${at}.rate must be two rates above 0, the slower first`);
  if (!finite(params?.duty) || params.duty <= 0 || params.duty >= 1) problems.push(`${at}.duty must be above 0 and below 1`);
  return problems;
}

/**
 * The led's fragment term: each light's rate from its phase, its level (ramped over the edge, centred
 * on it, the two edges kept apart), held at the duty while the world's motion is, and the light
 * is the vertex colour times that level (the emissive strength is the material's own intensity).
 */
export const LED_GLSL = /* glsl */ `
  {
    float rate = mix(uLedRate.x, uLedRate.y, fract(vLedPhase * ${RATE_SPREAD.scale} + ${RATE_SPREAD.offset}));
    float cycle = uTime * rate + vLedPhase;
    float c = fract(cycle);
    float h = min(${LED_EDGE_SECONDS / 2} * rate, min(uLedDuty * 0.5, (1.0 - uLedDuty) * 0.5));
    float x = c > (1.0 + uLedDuty) * 0.5 ? c - 1.0 : c;
    float level = smoothstep(-h, h, x) * (1.0 - smoothstep(uLedDuty - h, uLedDuty + h, x));
    level = mix(uLedDuty, level, uMotion);
    totalEmissiveRadiance *= vColor.rgb * level;
  }`;

/**
 * A led material for `params` (shared by every node it is assigned to: each light blinks on its own
 * beat), and its per-frame update: the world time and whether its motion runs.
 */
export function makeLedMaterial(params: LedParams) {
  const uniforms = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uLedRate: { value: new THREE.Vector2(params.rate[0], params.rate[1]) },
    uLedDuty: { value: params.duty },
  };
  // A black surface that only emits, in the colour of the vertex: white emissive at the intensity,
  // scaled in the shader by the vertex colour and the level.
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 0, 0),
    roughness: 0.55,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: params.intensity,
    vertexColors: true,
  });
  material.name = 'led';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float _phase;\nvarying float vLedPhase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLedPhase = _phase;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uMotion;\nuniform vec2 uLedRate;\nuniform float uLedDuty;\nvarying float vLedPhase;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${LED_GLSL}`);
  };
  // One program for every led: the shader text above is the same whatever the params.
  material.customProgramCacheKey = () => 'kit-led';
  return {
    material,
    uniforms,
    update(t: number, motion: number) {
      uniforms.uTime.value = t;
      uniforms.uMotion.value = motion;
    },
  };
}
