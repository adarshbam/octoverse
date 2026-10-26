import * as THREE from 'three';
import type { AuraSettings } from '../config/types';
import type { RGB } from './worldAccent';

/** The aura is all `low` this far below the body's middle, as a share of its radius. */
const RED_BELOW = 0.75;

const linear = (hex: string): RGB => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/**
 * The aura's colour (linear) `dy` world units above the body's middle: magenta-violet (`inner`) at
 * and above it, turning deep red (`low`) below. Mirrors the GLSL.
 */
export function auraColour(dy: number, aura: AuraSettings): RGB {
  const t = THREE.MathUtils.smoothstep(-dy, 0, RED_BELOW * aura.radius);
  const [a, b] = [linear(aura.inner), linear(aura.low)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * The aura card: a soft disc of light turned to face the camera about the point it is placed at,
 * reaching `radius` (body units), brightest in the middle. It adds its light to the water behind
 * Nox and writes no depth; his skin, in front, hides its middle.
 */
export function createAuraMaterial(aura: AuraSettings) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uInner: { value: new THREE.Color(aura.inner) },
      uLow: { value: new THREE.Color(aura.low) },
      uRadius: { value: aura.radius },
      uStrength: { value: aura.strength },
    },
    vertexShader: /* glsl */ `
      uniform float uRadius;
      varying vec2 vOffset;
      void main() {
        // Facing the camera whatever way the body turns, sized with the body's scale.
        vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vOffset = position.xy * uRadius;
        gl_Position = projectionMatrix * (centre + vec4(vOffset * length(modelMatrix[0].xyz), 0.0, 0.0));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInner;
      uniform vec3 uLow;
      uniform float uRadius;
      uniform float uStrength;
      varying vec2 vOffset;
      void main() {
        float fade = 1.0 - smoothstep(0.0, uRadius, length(vOffset));
        vec3 colour = mix(uInner, uLow, smoothstep(0.0, ${RED_BELOW} * uRadius, -vOffset.y));
        gl_FragColor = vec4(colour * uStrength, fade * fade);
      }
    `,
  });
}
