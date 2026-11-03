import * as THREE from 'three';
import type { Palette, SuckerSettings } from '../config/types';
import type { SkinUniforms } from './skinMaterial';
import { CUP_EMBED, CUP_FACE, type SuckerRow } from './suckerRow';

/** How many arms' cups can flare on their own (`uFlare`, one value per arm). */
export const FLARE_ARMS = 8;

/**
 * Each cup's arm and how far along it the cup sits (0 root, 1 tip), in the instance order the
 * rows write them (arm by arm): the `aCup` attribute that picks a cup's arm's `uFlare`.
 */
export function createCupArmAttribute(rows: readonly { row: SuckerRow; length: number }[]) {
  const total = rows.reduce((n, r) => n + r.row.count, 0);
  const data = new Float32Array(total * 2);
  let k = 0;
  rows.forEach(({ row, length }, arm) => {
    for (const sucker of row.suckers) {
      data[k++] = arm;
      data[k++] = sucker.arc / length;
    }
  });
  return new THREE.InstancedBufferAttribute(data, 2);
}

/** The stage lights the cups share with the skin, so cups and arm are lit as one surface. */
export type CupLighting = Pick<SkinUniforms, 'uKeyDir' | 'uKeyLight' | 'uUnderglow' | 'uSkyLight' | 'uGroundLight' | 'uHaze' | 'uHazeColor' | 'uFarHazeColor'>;

/**
 * Cup space bent to the skin: each cup carries its bend across the arm (x) and along it (y) in
 * `aBend`, and its vertices fall away by cupBend (see suckerRow) so the cup hugs the arm.
 * Normals are carried to world space with the inverse transpose of the cup's scaled axes.
 */
const bendCupSpace = /* glsl */ `
  attribute vec2 aBend;
  float cupBend(float curve, float d) {
    return curve * d * d / (1.0 + sqrt(max(0.0, 1.0 - curve * curve * d * d)));
  }
  float cupSlope(float curve, float d) {
    return curve * d / sqrt(max(0.05, 1.0 - curve * curve * d * d));
  }
  vec3 bentPosition(vec3 p) {
    return vec3(p.xy, p.z - cupBend(aBend.x, p.y) - cupBend(aBend.y, p.x));
  }
  vec3 bentNormal(mat4 m, vec3 p, vec3 n) {
    n += n.z * vec3(cupSlope(aBend.y, p.x), cupSlope(aBend.x, p.y), 0.0);
    vec3 s2 = vec3(dot(m[0].xyz, m[0].xyz), dot(m[1].xyz, m[1].xyz), dot(m[2].xyz, m[2].xyz));
    return normalize(mat3(m) * (n / s2));
  }
`;

/**
 * Sucker cups, as in the high-quality panel: shallow coral-peach discs sunk into the arm's red
 * band, each with a short red slit of a hollow lying along the arm, a lighter low rim and a
 * deeper edge where it meets the skin. Shaded in the cup's own space (radius 1, opening along +z).
 * The cups glow on their own; the skin's key light, bounce and underglow model them on top.
 */
export function createSuckerMaterial(palette: Palette, light: CupLighting) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEdge: { value: new THREE.Color(palette.suckerEdge) },
      uBody: { value: new THREE.Color(palette.suckerBody) },
      uHot: { value: new THREE.Color(palette.suckerHot) },
      uHollow: { value: new THREE.Color(palette.suckerHollow) },
      uKeyDir: light.uKeyDir,
      uKeyLight: light.uKeyLight,
      uUnderglow: light.uUnderglow,
      uSkyLight: light.uSkyLight,
      uGroundLight: light.uGroundLight,
      uHaze: light.uHaze,
      uHazeColor: light.uHazeColor,
      uBoost: { value: 1.22 },
      uFace: { value: CUP_FACE },
      /** How far the cups fade into the far water (0 to 1): far away, or veiled as Nox comes out of the murk (0 otherwise). */
      uVeil: { value: 0 },
      uVeilColor: light.uFarHazeColor,
      /**
       * How far each arm's cups flare (0 to 1), as the arm takes a bubble in the suction hold
       * (artifacts/suctionHold.ts): the rim opens and rises, the hollow opens from a slit toward a
       * round mouth; more toward the tip. 0 at rest, where the cups are exactly as approved.
       */
      uFlare: { value: new Float32Array(FLARE_ARMS) },
    },
    vertexShader: /* glsl */ `
      ${bendCupSpace}
      attribute vec2 aCup;
      uniform float uFace;
      uniform float uFlare[${FLARE_ARMS}];
      varying vec3 vLocal;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vWorld;
      varying float vFlare;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        // Cups the viewer sees edge-on, along the arm's outline, flatten toward their face so they
        // never break its silhouette; the face stays just above the skin.
        float facing = dot(normalize(mat3(m)[2]), normalize(cameraPosition - m[3].xyz));
        vec3 p = position;
        // Flaring: the rim spreads a little and rises, the dimple sinks.
        float flare = uFlare[int(aCup.x + 0.5)] * mix(0.45, 1.0, smoothstep(0.3, 0.95, aCup.y));
        float r0 = length(p.xy);
        p.xy *= 1.0 + 0.12 * flare * smoothstep(0.25, 0.9, r0);
        p.z += flare * (0.12 * smoothstep(0.45, 0.75, r0) * (1.0 - smoothstep(0.9, 1.0, r0)) - 0.06 * (1.0 - smoothstep(0.0, 0.5, r0)));
        vFlare = flare;
        p.z = mix(p.z, uFace + (p.z - uFace) * 0.3, 1.0 - smoothstep(0.05, 0.35, facing));
        vec4 world = m * vec4(bentPosition(p), 1.0);
        vLocal = position;
        vN = bentNormal(m, position, normal);
        vV = normalize(cameraPosition - world.xyz);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uEdge;
      uniform vec3 uBody;
      uniform vec3 uHot;
      uniform vec3 uHollow;
      uniform vec3 uKeyDir;
      uniform vec3 uKeyLight;
      uniform vec4 uUnderglow;
      uniform vec3 uSkyLight;
      uniform vec3 uGroundLight;
      uniform vec3 uHaze;
      uniform vec3 uHazeColor;
      uniform float uBoost;
      uniform float uVeil;
      uniform vec3 uVeilColor;
      varying vec3 vLocal;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vWorld;
      varying float vFlare;
      void main() {
        // Seen from below, the disc's underside shows: light whichever side is seen.
        vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 V = normalize(vV);
        vec3 L = normalize(uKeyDir);
        float r = length(vLocal.xy);
        // A coral-peach disc, lighter on its low raised rim, deepening to red at the edge where it
        // sinks into the band.
        vec3 c = mix(uBody, uHot, smoothstep(0.3, 0.68, r) * (1.0 - smoothstep(0.84, 0.97, r)));
        c = mix(c, uEdge, smoothstep(0.88, 1.0, r));
        // The red slit of the hollow, lying along the arm, darkest along its middle.
        // Flaring, the slit opens toward a round mouth and the rim warms.
        vec2 hollow = vLocal.xy / vec2(1.0 + 0.25 * vFlare, 1.0 + 2.2 * vFlare);
        float slit = (1.0 - smoothstep(0.045, 0.1, abs(hollow.y))) * (1.0 - smoothstep(0.26, 0.4, abs(hollow.x)));
        c = mix(c, uHollow, slit);
        c *= 1.0 - 0.35 * slit * (1.0 - smoothstep(0.0, 0.05, abs(hollow.y)));
        c = mix(c, uHot, 0.3 * vFlare * smoothstep(0.45, 0.7, r) * (1.0 - smoothstep(0.85, 0.97, r)));
        // Cups seen edge-on darken a little; cups facing the viewer glow.
        c *= mix(0.72, 1.0, smoothstep(0.0, 0.6, abs(dot(N, V))));
        // The key light models the cup: the lip facing it brightens, the far side falls into
        // shade; bounce and the warm underglow fill from below.
        float key = max(0.0, (dot(N, L) + 0.4) / 1.4);
        vec3 bounce = mix(uGroundLight, uSkyLight, smoothstep(-0.6, 0.6, N.y));
        float below = max(0.0, (-N.y + uUnderglow.w) / (1.0 + uUnderglow.w));
        c *= vec3(0.6) + uKeyLight * key * 0.5 + bounce + uUnderglow.rgb * below * 0.7;
        // A small wet highlight on the rim.
        float rim = smoothstep(0.5, 0.72, r) * (1.0 - smoothstep(0.85, 0.97, r));
        float spec = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
        c += uKeyLight * vec3(1.0, 0.9, 0.84) * spec * 0.5 * rim;
        c *= uBoost;
        // Far cups fade into the water like the skin they sit on.
        c = mix(c, uHazeColor, smoothstep(uHaze.x, uHaze.y, -vWorld.z) * uHaze.z);
        c = mix(c, uVeilColor, uVeil);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * The soft contact shadow each cup casts onto the band round it, drawn on the ring from
 * createCupShadow: lifted onto the skin and bent with it, darkest at the cup's edge, deeper on the
 * side away from the key light, and faded where the skin turns edge-on.
 */
export function createCupShadowMaterial(palette: Palette, settings: SuckerSettings, light: Pick<SkinUniforms, 'uKeyDir'>) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(palette.suckerShadow) },
      uStrength: { value: settings.shadow },
      uKeyDir: light.uKeyDir,
      uSkin: { value: CUP_EMBED },
    },
    vertexShader: /* glsl */ `
      ${bendCupSpace}
      uniform vec3 uKeyDir;
      uniform float uSkin;
      varying vec2 vLocal;
      varying float vFade;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        // On the skin, a hair above it.
        vec3 p = vec3(position.xy, uSkin + 0.02);
        vec4 world = m * vec4(bentPosition(p), 1.0);
        vLocal = position.xy;
        vec3 n = bentNormal(m, p, vec3(0.0, 0.0, 1.0));
        vec3 outward = normalize(mat3(m) * vec3(position.xy, 0.0));
        float away = 0.5 - 0.5 * dot(outward, normalize(uKeyDir));
        vFade = mix(0.55, 1.0, away) * smoothstep(0.1, 0.4, dot(n, normalize(cameraPosition - world.xyz)));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vLocal;
      varying float vFade;
      void main() {
        float a = (1.0 - smoothstep(1.0, 1.55, length(vLocal))) * uStrength * vFade;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
}
