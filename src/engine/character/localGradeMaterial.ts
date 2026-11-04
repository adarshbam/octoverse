import * as THREE from 'three';
import type { GradeSettings } from '../config/types';

// The local grade, in a world: the water near Nox darker and warmer than the far blue, as in
// panel 2. It is drawn in the scene, not after it: discs facing the camera just behind Nox, each
// mixing what lies behind it toward the grade colour. They are depth-tested and write no depth,
// and they draw after the opaque world and before every transparent layer. So only what lies
// behind them is graded: Nox's skin, nearer, fails the depth test, and his own glow layers (the
// halo, the aura, the orbs, the dome glass and the face's glow card) draw after them, ungraded.
// Several discs, each a share of the grade, ramp it in over a unit of depth, so the seabed shows
// no line where it passes behind them.

/** How far Nox's back (his rear arms, where the aura sits) lies behind his face glow along the view axis, world units: nothing of him is deeper. */
export const NOX_BACK = 1.4;
/** The grade starts this far behind his back... */
export const GRADE_START = 0.3;
/** ...and is full this much deeper. */
export const GRADE_RAMP = 1;
/** Discs in the ramp, evenly spaced from its start to its end. */
export const GRADE_LAYERS = 8;
/** The discs draw before every transparent layer (all of Nox's are at 0 or above). */
export const GRADE_ORDER = -1000;
/** The discs reach this far past the grade's radius, so the polygon's edge never cuts the falloff. */
const MARGIN = 1.05;
const SEGMENTS = 48;

/** How much of the grade applies `distance` world units from Nox: 1 at him, easing to 0 at the radius. Mirrors the GLSL. */
export function gradeWeight(distance: number, grade: GradeSettings): number {
  return 1 - THREE.MathUtils.smoothstep(distance, 0, grade.radius);
}

/** One disc's alpha, so that `layers` of them over each other mix by `weight`. Mirrors the GLSL. */
export function layerAlpha(weight: number, layers = GRADE_LAYERS): number {
  return 1 - (1 - weight) ** (1 / layers);
}

/** GRADE_LAYERS unit discs, each tagged (`aBehind`) with how far behind Nox's back it lies. */
export function createGradeGeometry() {
  const position = new Float32Array(GRADE_LAYERS * SEGMENTS * 9);
  const behind = new Float32Array(GRADE_LAYERS * SEGMENTS * 3);
  let p = 0;
  let b = 0;
  for (let layer = 0; layer < GRADE_LAYERS; layer++) {
    const depth = GRADE_START + (GRADE_RAMP * layer) / (GRADE_LAYERS - 1);
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = (i / SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
      position.set([0, 0, 0, Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0], p);
      behind.fill(depth, b, b + 3);
      p += 9;
      b += 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aBehind', new THREE.BufferAttribute(behind, 1));
  return geometry;
}

/**
 * The grade's discs, following `glow` (Nox's face glow, world space; read each frame as it is
 * drawn). Each disc lies on the line of sight through the glow, NOX_BACK plus its own `aBehind`
 * deeper than the glow along the view axis, facing the camera wherever it moves.
 */
export function createGradeMaterial(grade: GradeSettings, glow: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uGlow: { value: glow },
      uColor: { value: new THREE.Color(grade.color) },
      uRadius: { value: grade.radius },
      uStrength: { value: grade.strength },
      uSize: { value: grade.radius * MARGIN },
    },
    vertexShader: /* glsl */ `
      attribute float aBehind;
      uniform vec3 uGlow;
      uniform float uSize;
      varying vec2 vPlane;
      void main() {
        vec4 glow = viewMatrix * vec4(uGlow, 1.0);
        float depth = max(-glow.z, 1e-3);
        vec3 centre = glow.xyz * ((depth + ${NOX_BACK.toFixed(4)} + aBehind) / depth);
        vPlane = position.xy * uSize;
        gl_Position = projectionMatrix * vec4(centre + vec3(vPlane, 0.0), 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uRadius;
      uniform float uStrength;
      varying vec2 vPlane;
      void main() {
        float weight = min(uStrength * (1.0 - smoothstep(0.0, uRadius, length(vPlane))), 1.0);
        gl_FragColor = vec4(uColor, 1.0 - pow(1.0 - weight, ${(1 / GRADE_LAYERS).toFixed(6)}));
      }
    `,
  });
}
