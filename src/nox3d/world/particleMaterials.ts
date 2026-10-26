import * as THREE from 'three';
import { GLOW_LIGHT_GLSL, type GlowLightUniforms, NO_NOX_LIGHT } from '../character/glowLight';

// The particles' materials. Each takes Nox's face glow as a tint worked out per particle from the
// shared glow uniforms (passed by reference, never copied), and adds it to its own colour; outside
// a world the tint is black and each draws exactly as before.

/** Glassy bubbles: clear centre, bright fresnel rim, one specular glint. The glow lights them as it does their tint. */
export function createBubbleMaterial(glow: GlowLightUniforms = NO_NOX_LIGHT) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uRim: { value: new THREE.Color('#ff6a9a') }, uTint: { value: new THREE.Color('#7a4aa8') }, ...glow },
    vertexShader: /* glsl */ `
      ${GLOW_LIGHT_GLSL}
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vGlow;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 world = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal);
        vV = normalize(cameraPosition - world.xyz);
        vGlow = noxGlow(world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uRim;
      uniform vec3 uTint;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vGlow;
      void main() {
        vec3 N = normalize(vN);
        float f = pow(1.0 - abs(dot(N, normalize(vV))), 2.2);
        float spec = pow(max(dot(N, normalize(vec3(-0.45, 0.6, 0.7))), 0.0), 70.0);
        vec3 c = mix(uTint, uRim, f) * (0.4 + f * 1.4) + vGlow * (0.4 + f * 1.4) + spec * 2.2;
        gl_FragColor = vec4(c, 0.05 + f * 0.7 + spec);
      }
    `,
  });
}

/** Drifting crimson motes, each taking the glow by its own brightness. */
export function createEmberMaterial(glow: GlowLightUniforms = NO_NOX_LIGHT) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1000 }, uColor: { value: new THREE.Color('#ff2c3c') }, uHot: { value: new THREE.Color('#ff8a5a') }, ...glow },
    vertexShader: /* glsl */ `
      ${GLOW_LIGHT_GLSL}
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      varying float vHot;
      varying vec3 vGlow;
      void main() {
        vec3 p = position;
        p.y += fract(uTime * 0.012 + aPhase) * 0.5 - 0.25;
        p.x += sin(uTime * 0.4 + aPhase * 6.28) * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, aSize * uScale / -mv.z);
        vA = 0.45 + 0.55 * sin(uTime * 1.7 + aPhase * 40.0);
        vHot = step(0.85, fract(aPhase * 7.0));
        vGlow = noxGlow((modelMatrix * vec4(p, 1.0)).xyz);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uHot;
      varying float vA;
      varying float vHot;
      varying vec3 vGlow;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(mix(uColor, uHot, vHot) * 2.6 * vA + vGlow * vA, a);
      }
    `,
  });
}

/** Red motes rising off the seabed: the nearest blur into soft discs; each takes the glow by its own brightness. */
export function createMoteMaterial(glow: GlowLightUniforms = NO_NOX_LIGHT) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1000 },
      uColor: { value: new THREE.Color('#ff2238') },
      uHot: { value: new THREE.Color('#ff9a6a') },
      ...glow,
    },
    vertexShader: /* glsl */ `
      ${GLOW_LIGHT_GLSL}
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      varying float vSoft;
      varying float vHot;
      varying vec3 vGlow;
      void main() {
        vec3 p = position;
        float ph = aSeed.x * 6.2831;
        // Rising slowly, wandering, and starting over near where each began.
        float rise = fract(uTime * (0.015 + aSeed.z * 0.02) + aSeed.x);
        p.y += rise * 1.2;
        p.x += sin(uTime * 0.37 + ph) * 0.12;
        p.z += cos(uTime * 0.29 + ph * 1.7) * 0.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        // Nearer than the stage, motes blur into soft discs.
        float blur = smoothstep(10.0, 6.0, depth);
        gl_PointSize = clamp(aSeed.y * uScale / depth * (1.0 + blur * 3.5), 1.5, 48.0);
        vSoft = blur;
        float life = smoothstep(0.0, 0.15, rise) * (1.0 - smoothstep(0.7, 1.0, rise));
        float flicker = 0.55 + 0.45 * sin(uTime * (1.3 + aSeed.z * 2.0) + ph * 7.0);
        vA = life * flicker * mix(1.0, 0.35, blur) * exp(-max(depth - 12.0, 0.0) * 0.05);
        vHot = step(0.86, aSeed.z);
        vGlow = noxGlow((modelMatrix * vec4(p, 1.0)).xyz);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uHot;
      varying float vA;
      varying float vSoft;
      varying float vHot;
      varying vec3 vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float sharp = smoothstep(1.0, 0.1, d);
        float disc = smoothstep(1.0, 0.75, d) * 0.6 + smoothstep(0.9, 0.0, d) * 0.4;
        float a = mix(sharp, disc, vSoft);
        gl_FragColor = vec4(mix(uColor, uHot, vHot * (1.0 - vSoft)) * a * vA * 2.2 + vGlow * a * vA, 1.0);
      }
    `,
  });
}

/** Marine snow: fine flecks drifting down, catching the light from above, fading with distance; each takes the glow by its own brightness. */
export function createSnowMaterial(glow: GlowLightUniforms = NO_NOX_LIGHT) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1000 }, uColor: { value: new THREE.Color('#a8c0ff') }, ...glow },
    vertexShader: /* glsl */ `
      ${GLOW_LIGHT_GLSL}
      attribute vec2 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      varying vec3 vGlow;
      void main() {
        vec3 p = position;
        float ph = aSeed.x * 6.2831;
        p.y = -2.4 + mod(p.y + 2.4 - uTime * (0.03 + aSeed.x * 0.04), 10.0);
        p.x += sin(uTime * 0.21 + ph) * 0.25 + sin(uTime * 0.5 + ph * 3.0) * 0.05;
        p.z += cos(uTime * 0.17 + ph) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        gl_PointSize = clamp(aSeed.y * uScale / depth, 1.0, 9.0);
        float lit = 0.25 + 0.75 * smoothstep(-2.0, 6.0, p.y);
        float far = exp(-depth * depth * 0.0011);
        float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed.x) + ph * 5.0);
        vA = lit * far * twinkle * smoothstep(1.5, 4.0, depth);
        vGlow = noxGlow((modelMatrix * vec4(p, 1.0)).xyz);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      varying vec3 vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(uColor * a * vA * 0.55 + vGlow * a * vA, 1.0);
      }
    `,
  });
}
