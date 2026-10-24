import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';

export interface ContactShadowSettings {
  /** How far round each point to look for something in front of it, world units. */
  reach: number;
  /** Depth gaps (world units) that cast shadow: from `minGap` up, fading out by `maxGap`. */
  minGap: number;
  maxGap: number;
  /** Only points this far from the camera are shaded, so the far backdrop never is. */
  near: number;
  far: number;
  /** How dark the shadow gets, 0 to 1, and its colour (the light it lets through). */
  strength: number;
  color: string;
}

const fragment = /* glsl */ `
  uniform vec2 uFocal;
  uniform vec4 uGap;
  uniform vec2 uRange;
  uniform vec3 uColor;
  uniform float uStrength;

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    float z = -getViewZ(depth);
    if (z < uRange.x || z > uRange.y) { outputColor = inputColor; return; }
    // The reach in screen space at this distance; uFocal is the projection's scale.
    vec2 reach = uFocal * 0.5 * uGap.x / z;
    float shade = 0.0;
    float total = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982 + 0.3926991;
      vec2 dir = vec2(cos(a), sin(a));
      // Occluders above count most: the light comes from above.
      float w = 0.55 + 0.45 * dir.y;
      for (int j = 1; j <= 3; j++) {
        float t = float(j) / 3.0;
        float sz = -getViewZ(readDepth(uv + dir * reach * t));
        float gap = z - sz;
        shade += w * (1.0 - 0.4 * t) * smoothstep(uGap.y, uGap.y * 2.5, gap) * (1.0 - smoothstep(uGap.z * 0.6, uGap.z, gap));
        total += w;
      }
    }
    // Glowing skin lights itself, so it resists shadow: the warm face, neck and cups stay bright.
    float lit = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float warm = smoothstep(0.08, 0.3, inputColor.r - max(inputColor.g, inputColor.b));
    float s = clamp(shade / total * 2.4, 0.0, 1.0) * uStrength * (1.0 - smoothstep(0.2, 0.45, lit)) * (1.0 - 0.85 * warm);
    outputColor = vec4(inputColor.rgb * mix(vec3(1.0), uColor, s), inputColor.a);
  }
`;

/**
 * Soft contact shadows in screen space: a point darkens where something lies in front of it
 * close by, such as an arm crossing over another or the head over the arm roots. Unlike ambient
 * occlusion it reaches across the gaps between the fanned-out arms, and it leaves the far
 * backdrop alone.
 */
export class ContactShadowEffect extends Effect {
  private camera: THREE.Camera | null = null;

  constructor(settings: ContactShadowSettings, camera: THREE.Camera | null = null) {
    super('ContactShadowEffect', fragment, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uFocal', new THREE.Uniform(new THREE.Vector2(1, 1))],
        ['uGap', new THREE.Uniform(new THREE.Vector4(settings.reach, settings.minGap, settings.maxGap, 0))],
        ['uRange', new THREE.Uniform(new THREE.Vector2(settings.near, settings.far))],
        ['uColor', new THREE.Uniform(new THREE.Color(settings.color))],
        ['uStrength', new THREE.Uniform(settings.strength)],
      ]),
    });
    // The composer does not always hand effects its camera, so it can be given here.
    this.camera = camera;
  }

  set mainCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  update() {
    if (!this.camera) return;
    const e = this.camera.projectionMatrix.elements;
    (this.uniforms.get('uFocal')!.value as THREE.Vector2).set(e[0], e[5]);
  }
}
