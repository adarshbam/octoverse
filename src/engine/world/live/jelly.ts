import * as THREE from 'three';
import { seeded } from '../noise';
import type { JellyfishConfig, Vec3 } from '../types';
import type { WorldTier } from '../worldTiers';
import type { JellyShape } from './index';

// The jellyfish (Jellyfish.tsx draws them): one bell and one set of filaments, each instanced, and
// the motion the vertex shader gives them. The JS functions mirror the shader terms, so the tests
// read them; pure, like the strands.

/**
 * The pulse and the drift. A beat contracts the bell over its first `contract` share and relaxes it
 * over the rest; the bell's radius goes from `1 + swell` (relaxed) to `1 + swell - squeeze`
 * (contracted), and the beat lifts it `rise` bell radii at the full contraction. The filaments wave
 * `wave` bell radii at their tips, a wave of `waveK` radians along them running down at `waveSpeed`.
 * The bell wanders `sway` bell radii sideways at `swaySpeed`, and fades in and out over the bottom
 * and top `fade` share of the region as the drift takes it round. A jellyfish starts `band` of the
 * region's height clear of its floor and ceiling.
 */
export const JELLY = { contract: 0.3, swell: 0.1, squeeze: 0.25, rise: 0.35, wave: 0.3, waveK: 5.5, waveSpeed: 2.2, sway: 0.3, swaySpeed: 0.23, fade: 0.12, band: 0.15 };

const fract = (x: number) => x - Math.floor(x);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** How far into its contraction the bell is (0 relaxed, 1 fully contracted) at `u`, the share of its beat gone (0 to 1). */
export function jellyContraction(u: number) {
  return u < JELLY.contract ? smoothstep(0, JELLY.contract, u) : 1 - smoothstep(JELLY.contract, 1, u);
}

/**
 * A jellyfish's pulse at time `t`: `bellScale` is the bell's radius against its rest size (0.85 to
 * 1.1), `rise` how far the beat lifts it, in bell radii. Periodic in `period` (seconds); `phase`
 * (radians) is its own. `motion` 0 (reduced motion, or the world held) is the bell at rest: scale
 * 1, no rise.
 */
export function jellyPulse(t: number, phase: number, period: number, motion = 1) {
  const c = jellyContraction(fract((t * motion) / period + phase / (2 * Math.PI))) * motion;
  return { bellScale: 1 + motion * JELLY.swell - JELLY.squeeze * c + 0, rise: JELLY.rise * c + 0 };
}

/** The height of a jellyfish that started at `y0`, at time `t`: rising at the config's `drift` and round again from the region's floor. Still with `motion` 0. */
export function jellyDrift(t: number, y0: number, config: Pick<JellyfishConfig, 'drift' | 'region'>, motion = 1) {
  const lo = config.region.min[1];
  const span = config.region.max[1] - lo;
  return lo + fract((y0 - lo + config.drift * t * motion) / span) * span;
}

/** The sideways wave of a filament's point `h` (0 root to 1 tip) at time `t`, in bell radii: none at the root, at most `JELLY.wave` at the tip, none with `motion` 0. */
export function filamentWave(t: number, phase: number, h: number, motion = 1) {
  return JELLY.wave * h * Math.sin(h * JELLY.waveK - t * motion * JELLY.waveSpeed + phase) * motion + 0;
}

/** How many jellyfish the world tier draws: the config's count for its quality tier. */
export function jellyCount(config: Pick<JellyfishConfig, 'count'>, tier: Pick<WorldTier, 'quality'>) {
  return config.count[tier.quality];
}

export interface JellyPlacement {
  /** Where it starts (the drift takes it up from here). */
  position: Vec3;
  /** The bell's radius, stage units. */
  size: number;
  /** Seconds a beat. */
  period: number;
  /** Radians: its own place in the beat. */
  phase: number;
}

/** The swarm: as many as the highest tier draws, scattered in the config's region from the shape's seed. The same every call. */
export function scatterJellies(config: JellyfishConfig, shape: Pick<JellyShape, 'seed'>): JellyPlacement[] {
  const rand = seeded(shape.seed);
  const { min, max } = config.region;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const n = Math.max(0, config.count.high, config.count.medium, config.count.low);
  return Array.from({ length: n }, () => {
    const x = lerp(min[0], max[0], rand());
    const y = lerp(min[1], max[1], JELLY.band + (1 - 2 * JELLY.band) * rand());
    const z = lerp(min[2], max[2], rand());
    return { position: [x, y, z] as const, size: lerp(config.size[0], config.size[1], rand()), period: lerp(config.pulse[0], config.pulse[1], rand()), phase: rand() * Math.PI * 2 };
  });
}

/** The first `count` of the swarm, farthest first: they are see-through and write no depth, so the near ones draw last. */
export function drawOrder(jellies: readonly JellyPlacement[], count: number): JellyPlacement[] {
  return jellies.slice(0, Math.max(0, count)).sort((a, b) => a.position[2] - b.position[2]);
}

/**
 * The bell: a dome of radius 1 round the centre of its rim (the instance's scale is the bell's
 * radius), 0.75 tall, its margin turned a little in.
 */
export function bellGeometry(shape: Pick<JellyShape, 'bellSegments'>) {
  const profile = [new THREE.Vector2(0.9, -0.08), new THREE.Vector2(1, 0)];
  for (let k = 1; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    profile.push(new THREE.Vector2(k === 6 ? 0 : Math.cos(a), 0.75 * Math.sin(a)));
  }
  return new THREE.LatheGeometry(profile, shape.bellSegments);
}

/**
 * The filaments: `filaments` thin ribbons hanging from just inside the rim, `filamentLength` bell
 * radii down, each in `filamentSegments` rings of two vertices, facing the camera (+z). `aFil` is
 * each vertex's h (0 root to 1 tip) and its filament's own phase, which the wave reads.
 */
export function filamentGeometry(shape: Pick<JellyShape, 'filaments' | 'filamentSegments' | 'filamentLength' | 'filamentWidth'>) {
  const positions: number[] = [];
  const fil: number[] = [];
  const index: number[] = [];
  for (let f = 0; f < shape.filaments; f++) {
    const angle = ((f + 0.5) / shape.filaments) * Math.PI * 2;
    const [rx, rz] = [0.8 * Math.cos(angle), 0.8 * Math.sin(angle)];
    const base = positions.length / 3;
    for (let i = 0; i <= shape.filamentSegments; i++) {
      const h = i / shape.filamentSegments;
      const half = (shape.filamentWidth / 2) * (1 - 0.7 * h);
      positions.push(rx - half, -h * shape.filamentLength, rz, rx + half, -h * shape.filamentLength, rz);
      fil.push(h, f * 1.7, h, f * 1.7);
      if (i < shape.filamentSegments) {
        const a = base + 2 * i;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  geometry.setAttribute('aFil', new THREE.Float32BufferAttribute(fil, 2));
  geometry.setIndex(index);
  return geometry;
}

/** A GLSL float literal. */
const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/**
 * The shader terms, mirroring the functions above. `aJelly` is an instance's (phase, period, size);
 * its starting place is the instance matrix's translation and its radius the matrix's scale.
 * `uDrift` is the config's drift, `uSpan` the region's floor and ceiling, `uMotion` as ever.
 * `common` goes in each material's declarations, `instance` at the head of its vertex term, then
 * `bell` or `filament`.
 */
export const JELLY_GLSL = {
  common: /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uDrift;
uniform vec2 uSpan;
attribute vec3 aJelly;
float jellyContraction(float u) { return u < ${f(JELLY.contract)} ? smoothstep(0.0, ${f(JELLY.contract)}, u) : 1.0 - smoothstep(${f(JELLY.contract)}, 1.0, u); }`,
  instance: /* glsl */ `
  float jT = uTime * uMotion;
  float jC = jellyContraction(fract(jT / aJelly.y + aJelly.x / 6.2831853)) * uMotion;
  float jScale = 1.0 + uMotion * ${f(JELLY.swell)} - ${f(JELLY.squeeze)} * jC;
  float jSpan = uSpan.y - uSpan.x;
  float jV = fract((instanceMatrix[3].y - uSpan.x + uDrift * jT) / jSpan);
  float jFade = smoothstep(0.0, ${f(JELLY.fade)}, jV) * smoothstep(0.0, ${f(JELLY.fade)}, 1.0 - jV);
  vec3 jMove = vec3(${f(JELLY.sway)} * sin(jT * ${f(JELLY.swaySpeed)} + aJelly.x), (uSpan.x + jV * jSpan - instanceMatrix[3].y) / aJelly.z + ${f(JELLY.rise)} * jC, 0.0);`,
  bell: /* glsl */ `
  transformed.xz *= jScale;
  transformed.y *= mix(1.0, 1.0 / jScale, 0.6);
  transformed = transformed * jFade + jMove;`,
  filament: /* glsl */ `
  float jH = aFil.x;
  transformed.xz *= jScale;
  transformed.x += ${f(JELLY.wave)} * jH * sin(jH * ${f(JELLY.waveK)} - jT * ${f(JELLY.waveSpeed)} + aFil.y + aJelly.x) * uMotion;
  transformed = transformed * jFade + jMove;`,
};
