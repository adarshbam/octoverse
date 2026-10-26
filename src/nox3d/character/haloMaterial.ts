import * as THREE from 'three';
import type { HaloSettings } from '../config/types';
import { headMorphVertex } from './headMorph';

/**
 * The soft glow round the silhouette, drawn as an inflated back-facing shell of the arm or head
 * geometry: where the shape itself covers it, the depth test hides it, so it only shows round the
 * outside. It fades from the shape's edge out to the shell's own edge, and turns red below the
 * arms' cup bands.
 */
export function createHaloMaterial(halo: HaloSettings, kind: 'ARM' | 'HEAD', centre = new THREE.Vector3(), morph?: { value: number }) {
  return new THREE.ShaderMaterial({
    defines: { [kind]: '' },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uWidth: { value: kind === 'ARM' ? halo.armWidth : halo.headWidth },
      /** The head shell grows out from this point (head-local), so it never folds into the notches by the cheeks. */
      uCentre: { value: centre },
      uColor: { value: new THREE.Color(halo.color) },
      uCrown: { value: new THREE.Color(halo.crown) },
      uBand: { value: new THREE.Color(halo.band) },
      uStrength: { value: new THREE.Vector2(halo.strength, halo.bandStrength) },
      /** The head's change into the dome, shared with the skin, so the glow follows the shape. */
      uMorph: morph ?? { value: 0 },
    },
    vertexShader: /* glsl */ `
      #ifdef ARM
        attribute float aUnder;
        attribute float aU;
        attribute vec3 aSpeck;
      #else
        ${headMorphVertex}
      #endif
      uniform float uWidth;
      uniform vec3 uCentre;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vUnder;
      varying float vEdge;
      varying float vFade;
      void main() {
        #ifdef ARM
          vUnder = aUnder;
          // No neon edge where the arm leaves the body: it would outline the arm's root over the
          // glowing face and neck, where the painting has none.
          vFade = smoothstep(0.2, 0.42, aU);
          float r = aSpeck.z;
        #else
          vUnder = 0.0;
          vFade = 1.0;
          float r = 0.75;
        #endif
        // Seen face on, the shape's own outline lies where the shell's normal is this far round
        // from the view direction; the glow is brightest there and fades to the shell's edge.
        vEdge = sqrt(max(0.0, 1.0 - (r / (r + uWidth)) * (r / (r + uWidth))));
        #ifdef ARM
          vec3 n = normal;
          vec3 grown = position + normal * uWidth;
        #else
          vec3 p = morphedPosition();
          vec3 n = morphedNormal();
          vec3 grown = p + normalize(p - uCentre) * uWidth;
        #endif
        vec4 world = modelMatrix * vec4(grown, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uCrown;
      uniform vec3 uBand;
      uniform vec2 uStrength;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vUnder;
      varying float vEdge;
      varying float vFade;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float c = clamp(-dot(normalize(vNormalW), V) / max(vEdge, 1e-3), 0.0, 1.0);
        // Steep falloff: a tight neon edge, not a soft haze.
        float glow = pow(c, 5.0);
        float band = smoothstep(0.35, 0.95, vUnder);
        vec3 edge = uColor;
        #ifdef HEAD
          edge = mix(uColor, uCrown, smoothstep(0.35, 0.85, normalize(vNormalW).y));
        #endif
        vec3 col = mix(edge * uStrength.x, uBand * uStrength.y, band);
        gl_FragColor = vec4(col * glow * vFade, 1.0);
      }
    `,
  });
}
