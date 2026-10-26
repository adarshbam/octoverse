import * as THREE from 'three';
import type { Vec3, WorldLight } from '../world/types';
import type { SkinKind } from './skinMaterial';

// The world's light on Nox, as small accents on his own lighting, never in its place. Warmth from
// nearby glyphs and lava falls on the sides and underside of the arms and lower body; the surface
// light's caustics shimmer on top. Each is capped against the skin's own colour, and none touches
// the face, the crown or the neon rim. The suckers and the halo are emitters and take none. Every
// strength defaults to zero, so a skin outside a world renders exactly as approved.

/** A linear colour: 0 to 1 per channel, more for bright light. */
export type RGB = readonly [number, number, number];

/** World light adds at most 10% to the skin's own luminance, anywhere, all accents together. */
export const WORLD_WARMTH_CAP = 0.1;
/** Caustics add at most 5%. */
export const CAUSTIC_CAP = 0.05;
/** Camera distance where depth haze may start: Nox at the stage is never hazed. */
export const HAZE_FROM = 18;
/** World lights the skin takes at once. */
export const ACCENT_LIGHTS = 8;

/** Normal heights (y) over which the crown fades world warmth out. */
const CROWN = [0.3, 0.7] as const;
/** n·v over which accents fade in from the silhouette edge, where the neon rim is. */
const RIM = [0.2, 0.45] as const;
/** How far world light wraps round into the shadow side, as through flesh. */
const WRAP = 0.45;

const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (x: number, [from, to]: readonly [number, number]) => THREE.MathUtils.smoothstep(x, from, to);
/** A number as a GLSL float literal. */
const glsl = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Scales `add` so its luminance is at most `cap` times `base`'s. Mirrors the GLSL. */
export function capAccent(base: RGB, add: RGB, cap: number): RGB {
  const room = cap * Math.max(luma(base), 0);
  const amount = luma(add);
  if (amount <= room) return add;
  const scale = room / amount;
  return [add[0] * scale, add[1] * scale, add[2] * scale];
}

/** 0 on the face rect, the crown (up-facing normals) and the silhouette edge (low n·v); 1 on sides and underside. Mirrors the GLSL. */
export function warmthMask(kind: SkinKind, normalY: number, ndv: number, inFace: number): number {
  // Only the head carries the face.
  const face = kind === 'HEAD' ? inFace : 0;
  return (1 - smooth(normalY, CROWN)) * smooth(ndv, RIM) * (1 - face);
}

/** How much of the water's colour the skin takes at `distance` from the camera: exactly 0 within HAZE_FROM. Mirrors the GLSL. */
export function farHaze(distance: number, density: number): number {
  const beyond = Math.max(distance - HAZE_FROM, 0) * density;
  return 1 - Math.exp(-beyond * beyond);
}

/** The ACCENT_LIGHTS world lights nearest `at`, farthest first dropped. */
export function pickAccentLights(lights: readonly WorldLight[], at: Vec3, max = ACCENT_LIGHTS): WorldLight[] {
  const away = ({ position: [x, y, z] }: WorldLight) => (x - at[0]) ** 2 + (y - at[1]) ** 2 + (z - at[2]) ** 2;
  return [...lights].sort((a, b) => away(a) - away(b)).slice(0, max);
}

export type AccentUniforms = ReturnType<typeof createAccentUniforms>;

/** The skin's world accents, all zero: no world light, no caustics, no far haze. */
export function createAccentUniforms() {
  return {
    /** The world lights reaching the skin: position, colour times intensity (black in an unused slot), and reach. */
    uAccentPos: { value: Array.from({ length: ACCENT_LIGHTS }, () => new THREE.Vector3()) },
    uAccentColor: { value: Array.from({ length: ACCENT_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
    uAccentRange: { value: new Array<number>(ACCENT_LIGHTS).fill(1) },
    /** How the skin takes world light, per channel. */
    uAccentWarmth: { value: new THREE.Color(0, 0, 0) },
    /** The surface light's caustic cookie and its projection, the direction up to the light, and the caustics' colour times strength. */
    uCausticMap: { value: null as THREE.Texture | null },
    uCausticMatrix: { value: new THREE.Matrix4() },
    uSurfaceDir: { value: new THREE.Vector3(0, 1, 0) },
    uCausticLight: { value: new THREE.Color(0, 0, 0) },
    /** Depth haze beyond HAZE_FROM: its density, and the water's colour. */
    uFarHaze: { value: 0 },
    uFarHazeColor: { value: new THREE.Color(0, 0, 0) },
  };
}

/** Writes `lights` into the accent slots, in order; slots left over go dark. */
export function writeAccentLights(uniforms: AccentUniforms, lights: readonly WorldLight[]) {
  for (let k = 0; k < ACCENT_LIGHTS; k++) {
    const light = lights[k];
    const color = uniforms.uAccentColor.value[k];
    if (!light) {
      color.setScalar(0);
      continue;
    }
    uniforms.uAccentPos.value[k].set(...light.position);
    color.set(light.color).multiplyScalar(light.intensity);
    uniforms.uAccentRange.value[k] = light.skinRange;
  }
}

/** What a world shares with Nox: the accents it feeds his skin each frame, and where his face glow is (Octopus keeps it up to date). */
export interface AccentLink {
  uniforms: AccentUniforms;
  at: THREE.Vector3;
}

/**
 * Declarations and `worldAccent(col, N, ndv)`, which the skin calls just before its atmospheric
 * depth. It reads the skin's `vWorld` and `vFaceUv`.
 */
export const ACCENT_GLSL = /* glsl */ `
  #define ACCENT_LIGHTS ${ACCENT_LIGHTS}
  #define WORLD_WARMTH_CAP ${glsl(WORLD_WARMTH_CAP)}
  #define CAUSTIC_CAP ${glsl(CAUSTIC_CAP)}
  #define HAZE_FROM ${glsl(HAZE_FROM)}
  uniform vec3 uAccentPos[ACCENT_LIGHTS];
  uniform vec3 uAccentColor[ACCENT_LIGHTS];
  uniform float uAccentRange[ACCENT_LIGHTS];
  uniform vec3 uAccentWarmth;
  uniform sampler2D uCausticMap;
  uniform mat4 uCausticMatrix;
  uniform vec3 uSurfaceDir;
  uniform vec3 uCausticLight;
  uniform float uFarHaze;
  uniform vec3 uFarHazeColor;

  vec3 capAccent(vec3 base, vec3 add, float cap) {
    float room = cap * max(dot(base, vec3(0.2126, 0.7152, 0.0722)), 0.0);
    float amount = dot(add, vec3(0.2126, 0.7152, 0.0722));
    return amount > room ? add * (room / amount) : add;
  }

  float warmthMask(float normalY, float ndv, float inFace) {
    return (1.0 - smoothstep(${glsl(CROWN[0])}, ${glsl(CROWN[1])}, normalY)) * smoothstep(${glsl(RIM[0])}, ${glsl(RIM[1])}, ndv) * (1.0 - inFace);
  }

  float farHaze(float dist, float density) {
    float beyond = max(dist - HAZE_FROM, 0.0) * density;
    return 1.0 - exp(-beyond * beyond);
  }

  vec3 worldAccent(vec3 col, vec3 N, float ndv) {
    #ifdef HEAD
      vec2 fromMiddle = abs(vFaceUv - 0.5);
      float inFace = 1.0 - smoothstep(0.45, 0.5, max(fromMiddle.x, fromMiddle.y));
    #else
      float inFace = 0.0;
    #endif
    // Warmth: each nearby world light, wrapped softly round, fading out at its reach on the skin.
    vec3 light = vec3(0.0);
    for (int k = 0; k < ACCENT_LIGHTS; k++) {
      vec3 toLight = uAccentPos[k] - vWorld;
      float d2 = max(dot(toLight, toLight), 1e-4);
      float r2 = d2 / (uAccentRange[k] * uAccentRange[k]);
      float reach = clamp(1.0 - r2 * r2, 0.0, 1.0);
      float wrapped = max(0.0, (dot(N, toLight * inversesqrt(d2)) + ${glsl(WRAP)}) / ${glsl(1 + WRAP)});
      light += uAccentColor[k] * (reach * reach / (1.0 + d2) * wrapped);
    }
    vec3 warmth = light * uAccentWarmth * warmthMask(N.y, ndv, inFace);
    // Caustics: the surface light's cookie on skin facing up toward it, the head top included.
    vec4 cookie = uCausticMatrix * vec4(vWorld, 1.0);
    float fromAbove = smoothstep(0.2, 0.8, dot(N, uSurfaceDir));
    vec3 caustic = uCausticLight * texture2D(uCausticMap, cookie.xy / cookie.w).rgb * fromAbove * smoothstep(${glsl(RIM[0])}, ${glsl(RIM[1])}, ndv);
    vec3 accent = capAccent(col, capAccent(col, warmth, WORLD_WARMTH_CAP) + capAccent(col, caustic, CAUSTIC_CAP), WORLD_WARMTH_CAP);
    col += accent;
    // Far away, Nox fades into the water from his own shading; the world's fog never reaches him.
    col = mix(col, uFarHazeColor, farHaze(length(cameraPosition - vWorld), uFarHaze));
    return col;
  }
`;
