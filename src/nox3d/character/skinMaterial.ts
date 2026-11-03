import * as THREE from 'three';
import { headMorphVertex } from './headMorph';
import type { StageLighting } from '../config/lighting';
import type { CharacterConfig } from '../config/types';
import { cheekCentres } from './headGeometry';
import { ACCENT_GLSL, createAccentUniforms } from './worldAccent';

/**
 * Mantle colour ramp texture: raw sRGB bytes, tagged sRGB so the GPU decodes
 * them once. Stops are (glow strength, hex) sampled from the reference.
 */
export function createRampTexture(stops: readonly (readonly [number, string])[]) {
  const size = 256;
  const data = new Uint8Array(size * 4);
  const colors = stops.map(([at, hex]) => [at, [1, 3, 5].map(o => parseInt(hex.slice(o, o + 2), 16))] as const);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    let k = 0;
    while (k < colors.length - 2 && t > colors[k + 1][0]) k++;
    const [a, ca] = colors[k];
    const [b, cb] = colors[k + 1];
    const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
    data.set([0, 1, 2].map(c => Math.round(ca[c] + (cb[c] - ca[c]) * u)).concat(255), i * 4);
  }
  const texture = new THREE.DataTexture(data, size, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Facing (the surface normal's z in the head's own space) below which no face feature shows, and where it shows in full. */
const FACE_FACING = [0.1, 0.3] as const;

/**
 * How much of the face texture's projection shows on a surface whose normal has `normalZ` in the
 * head's own space: none on the sides and back (normalZ < 0.1), so the projection never comes
 * through from behind, in full facing forward. The skin shader's faceWeight is the same curve.
 */
export function faceWeight(normalZ: number) {
  const t = Math.min(1, Math.max(0, (normalZ - FACE_FACING[0]) / (FACE_FACING[1] - FACE_FACING[0])));
  return t * t * (3 - 2 * t);
}

/**
 * The face glow, and its warmth on the cheeks, lie on the skin as a projection along z, so without
 * a limit they would come through on the back too. They fade out between these facings (body-local
 * normal z): full wherever the front views (normal z >= -0.5, which covers turns up to 30 degrees,
 * as the detail stage's), gone round the middle of the back.
 */
const GLOW_FACING = [-0.85, -0.5] as const;

const glsl = (v: number) => v.toFixed(3);

export type SkinUniforms = ReturnType<typeof createSkinUniforms>;

/** One uniform set per character, shared by every skin surface so glow moves together. */
export function createSkinUniforms(config: CharacterConfig, lighting: StageLighting = config.lighting) {
  const { palette: p, glow, skin } = config;
  const color = (hex: string) => ({ value: new THREE.Color(hex) });
  const [[lx, ly], [rx, ry]] = config.face.eye.centers;
  const [fx, fy] = config.head.faceOrigin;
  const [cheekL, cheekR] = cheekCentres(config.head);
  return {
    /** Cheek lobes in head-local units (x, y, x, y), their radius, and how much the face glow warms them. */
    uCheekCentres: { value: new THREE.Vector4(cheekL.x - fx, cheekL.y - fy, cheekR.x - fx, cheekR.y - fy) },
    uCheekShape: { value: new THREE.Vector2(config.head.cheeks.radius, glow.cheekWarmth) },
    /** Eye sockets in head-local units: both centres (x, y, x, y) and the eye radii. */
    uEyeCenters: { value: new THREE.Vector4(lx, ly, rx, ry) },
    uEyeRadii: { value: new THREE.Vector2(config.face.eye.rx, config.face.eye.ry) },
    uGlowRamp: { value: createRampTexture(glow.ramp) },
    uGlowPos: { value: new THREE.Vector3(...glow.center) },
    /** Face glow extent: x spread, upward reach, downward reach. */
    uGlowShape: { value: new THREE.Vector3(glow.spreadX, glow.reachUp, glow.reachDown) },
    uGlowStrength: { value: 1.0 },
    /** How far the head has opened into the overview dome (0..1): the mantle top sinks under it. */
    uMorph: { value: 0 },
    uArmBody: color(p.armBody),
    uTerminator: color(p.terminator),
    uArmGlow: color(p.armGlow),
    uBelly: color(p.belly),
    /** How brightly the red oral band glows along the arms' undersides. */
    uUnderside: { value: glow.underside },
    uRimTop: color(p.rimTop),
    uRimLow: color(p.rimLow),
    uSky: color(p.sky),
    uHeadEdge: color(p.headEdge),
    uCheek: color(p.cheek),
    uBlotchColor: color(p.blotch),
    uTintCool: color(p.tintCool),
    uTintWarm: color(p.tintWarm),
    uWetColor: color(p.wet),
    /** Droplet bumps: density, smallest and largest radius (fractions of a cell), cells per unit. */
    uSpeck: { value: new THREE.Vector4(skin.speckDensity, skin.speckSize[0], skin.speckSize[1], skin.speckScale) },
    /** Blotch density and cells per unit, tint strength, translucency. */
    uBlotch: { value: new THREE.Vector4(skin.blotchDensity, skin.blotchScale, skin.tint, skin.translucency) },
    /** Wet gloss strength and sharpness, streak stretch and depth. */
    uWet: { value: new THREE.Vector4(skin.wetness, skin.gloss, skin.streakScale, skin.streakStrength) },
    uKeyDir: { value: new THREE.Vector3(...lighting.key.direction).normalize() },
    uKeyLight: { value: new THREE.Color(lighting.key.color).multiplyScalar(lighting.key.intensity) },
    uWrap: { value: lighting.key.wrap },
    /** Warm underglow colour times intensity, and its wrap. */
    uUnderglow: { value: new THREE.Vector4(...new THREE.Color(lighting.underglow.color).multiplyScalar(lighting.underglow.intensity).toArray(), lighting.underglow.wrap) },
    uSkyLight: { value: new THREE.Color(lighting.ambient.sky).multiplyScalar(lighting.ambient.intensity) },
    uGroundLight: { value: new THREE.Color(lighting.ambient.ground).multiplyScalar(lighting.ambient.intensity) },
    uHaze: { value: new THREE.Vector3(lighting.haze.near, lighting.haze.far, lighting.haze.strength) },
    uHazeColor: { value: new THREE.Color(lighting.haze.color) },
    /** The world's accents on the skin: none until a world feeds them. */
    ...createAccentUniforms(),
  };
}

const skinVertex = /* glsl */ `
  attribute float aUnder;
  attribute float aU;
  attribute vec3 aSpeck;
  #ifdef HEAD
    ${headMorphVertex}
  #endif
  uniform vec4 uFaceRect;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vUnder;
  varying float vU;
  varying vec3 vSurf;
  varying vec2 vFaceUv;
  varying float vFront;
  void main() {
    #ifdef HEAD
      vec3 p = morphedPosition();
      vec3 n = morphedNormal();
    #else
      vec3 p = position;
      vec3 n = normal;
    #endif
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    #ifdef ARM
      vUnder = aUnder;
      vU = aU;
      // Skin detail rides on the surface: along the arm, and round it at the arm's rest radius,
      // so it stays put as the arm bends and keeps its proportions as the arm tapers.
      vSurf = vec3(aSpeck.x, cos(aSpeck.y) * aSpeck.z, sin(aSpeck.y) * aSpeck.z);
    #else
      vUnder = 0.0;
      vU = 1.0;
      vSurf = p;
    #endif
    vFaceUv = (p.xy - uFaceRect.xy) / uFaceRect.zw;
    vFront = n.z;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skinFragment = /* glsl */ `
  uniform sampler2D uGlowRamp;
  uniform vec3 uGlowPos;
  uniform vec3 uGlowShape;
  uniform float uGlowStrength;
  uniform float uMorph;
  uniform vec3 uArmBody;
  uniform vec3 uTerminator;
  uniform vec3 uKeyLight;
  uniform float uWrap;
  uniform vec4 uUnderglow;
  uniform vec3 uSkyLight;
  uniform vec3 uGroundLight;
  uniform vec3 uHaze;
  uniform vec3 uHazeColor;
  uniform vec3 uArmGlow;
  uniform vec3 uBelly;
  uniform float uUnderside;
  uniform vec3 uRimTop;
  uniform vec3 uRimLow;
  uniform vec3 uSky;
  uniform vec3 uHeadEdge;
  uniform vec3 uCheek;
  uniform vec3 uBlotchColor;
  uniform vec3 uTintCool;
  uniform vec3 uTintWarm;
  uniform vec3 uWetColor;
  uniform vec4 uSpeck;
  uniform vec4 uBlotch;
  uniform vec4 uWet;
  uniform vec3 uKeyDir;
  uniform sampler2D uFace;
  uniform vec4 uFaceRect;
  uniform vec4 uEyeCenters;
  uniform vec2 uEyeRadii;
  uniform vec4 uCheekCentres;
  uniform vec2 uCheekShape;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vUnder;
  varying float vU;
  varying vec3 vSurf;
  varying vec2 vFaceUv;
  varying float vFront;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.103, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  // Smooth value noise, 0 to 1.
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), u.x);
    float b = mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x);
    float c = mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x);
    float d = mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x);
    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
  }

  // Distance to the nearest scattered point and that point's cell, for droplets, blotches and
  // glints; offset is the vector from the point to p, in cells. Points sit in the middle half of
  // their cells, so the eight cells round p always hold the nearest one closer than 0.45.
  vec4 nearestPoint(vec3 p, out vec3 offset) {
    vec3 i = floor(p - 0.5);
    float best = 8.0;
    vec3 cell = i;
    offset = vec3(0.0);
    for (int x = 0; x <= 1; x++) {
      for (int y = 0; y <= 1; y++) {
        for (int z = 0; z <= 1; z++) {
          vec3 c = i + vec3(float(x), float(y), float(z));
          vec3 r = c + 0.25 + 0.5 * hash33(c) - p;
          float d = dot(r, r);
          if (d < best) { best = d; cell = c; offset = -r; }
        }
      }
    }
    return vec4(sqrt(best), cell);
  }

  // Normal tilted by a surface height, given the height's screen-space derivatives (no tangents needed).
  vec3 bumpNormal(vec3 N, float dhx, float dhy) {
    vec3 dpdx = dFdx(vWorld);
    vec3 dpdy = dFdy(vWorld);
    vec3 r1 = cross(dpdy, N);
    vec3 r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    return normalize(abs(det) * N - grad);
  }

  ${ACCENT_GLSL}

  // The face texture's weight on a surface facing normalZ (head space): see faceWeight in skinMaterial.ts.
  float faceWeight(float normalZ) {
    return smoothstep(${glsl(FACE_FACING[0])}, ${glsl(FACE_FACING[1])}, normalZ);
  }

  void main() {
    // Webs and the cups' insides render double-sided; light the side the camera sees.
    float facing = gl_FrontFacing ? 1.0 : -1.0;
    vec3 N = normalize(vNormalW) * facing;
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec2 d = vWorld.xy - uGlowPos.xy;
    float sy = d.y > 0.0 ? uGlowShape.y : uGlowShape.z;
    // The face glow lies on the front; it never comes through on the back (see GLOW_FACING). A
    // double-sided web's facing is that of the side the camera sees.
    float frontSide = smoothstep(${glsl(GLOW_FACING[0])}, ${glsl(GLOW_FACING[1])}, vFront * facing);
    float faceGlow = exp(-(d.x * d.x) / (uGlowShape.x * uGlowShape.x) - (d.y * d.y) / (sy * sy)) * uGlowStrength * frontSide;
    float up = N.y * 0.5 + 0.5;
    vec3 L = normalize(uKeyDir);
    vec3 col;
    float under = 0.0;
    float join = 0.0;
    float headShade = 0.0;

    #ifdef ARM
      under = smoothstep(0.42, 0.98, vUnder);
      // The head shades the arms' roots from the light above: near the body they stay dark violet,
      // lit mostly by the red glow from below, as in the painting.
      float fromHead = length(vWorld.xy - uGlowPos.xy - vec2(-0.04, 0.53));
      headShade = (1.0 - smoothstep(0.75, 1.3, fromHead)) * 0.75;
      // One strong key light from above left, wrapped softly round into the shadow side.
      float nl = dot(N, L);
      float key = max(0.0, (nl + uWrap) / (1.0 + uWrap)) * (1.0 - headShade);
      // Bounce light: cool from the water above, warm from the lava below.
      vec3 bounce = mix(uGroundLight, uSkyLight, smoothstep(-0.6, 0.6, N.y));
      // The subtle warm underglow, wrapped up from below.
      float below = max(0.0, (-N.y + uUnderglow.w) / (1.0 + uUnderglow.w));
      col = uArmBody * (uKeyLight * key + bounce + uUnderglow.rgb * below);
      // Just past where the key fades, light scattered through the flesh shows as magenta.
      float scatter = smoothstep(-0.6, -0.2, nl) * (1.0 - smoothstep(-0.05, 0.25, nl));
      col += uTerminator * scatter * 0.22 * (1.0 - 0.6 * headShade);
      // The bioluminescent oral band glows red at its core and fades softly up through magenta
      // into the body: a subsurface glow, not a flat fill.
      float band = smoothstep(0.05, 0.95, vUnder);
      col += mix(uTerminator, uBelly, smoothstep(0.45, 0.95, vUnder)) * pow(band, 1.6) * uUnderside;
      vec3 toGlow = uGlowPos - vWorld;
      float near = exp(-dot(toGlow, toGlow) / 0.14);
      col = mix(col, uArmGlow * 0.75, near * 0.45);
      vec3 rootGlow = texture2D(uGlowRamp, vec2(clamp(faceGlow * 0.9, 0.0, 1.0), 0.5)).rgb;
      col = mix(col, rootGlow, smoothstep(0.3, 0.8, faceGlow) * 0.7);
      vec3 mantle = texture2D(uGlowRamp, vec2(clamp(faceGlow, 0.0, 1.0), 0.5)).rgb;
      mantle = mix(mantle, uCheek, smoothstep(-0.3, -0.72, vWorld.y) * 0.85 * (1.0 - smoothstep(0.3, 0.7, faceGlow)));
      join = 1.0 - smoothstep(0.05, 0.28, vU);
      col = mix(col, mantle, join);
      // A crisp neon rim: cool violet along the top, hot pink below, white-hot right at the edge.
      vec3 rim = mix(uRimLow, uRimTop, smoothstep(0.45, 0.9, up) * (1.0 - under));
      float rimLine = pow(1.0 - ndv, 5.0);
      // No neon line over the glowing neck, where the arms rise out of the body.
      float rimFade = (1.0 - join) * (1.0 - smoothstep(0.3, 0.65, faceGlow));
      col += rim * rimLine * 3.0 * rimFade * (1.0 - 0.4 * headShade);
      col += mix(rim, vec3(1.0, 0.85, 1.0), 0.3) * pow(1.0 - ndv, 14.0) * 1.6 * rimFade;
      col += uRimLow * pow(1.0 - ndv, 7.0) * 0.6 * (1.0 - join);
    #else
      col = texture2D(uGlowRamp, vec2(clamp(faceGlow, 0.0, 1.0), 0.5)).rgb;
      col = mix(col, uCheek, smoothstep(-0.3, -0.72, vWorld.y) * 0.85 * (1.0 - smoothstep(0.3, 0.7, faceGlow)));
      col += uSky * pow(max(N.y, 0.0), 4.0) * 0.3 * (1.0 - faceGlow);
      col += uRimTop * pow(max(N.y, 0.0), 10.0) * pow(1.0 - ndv, 1.5) * 0.5;
      vec3 rim = mix(uRimLow, uRimTop, smoothstep(-0.25, 0.2, vWorld.y - uGlowPos.y - 0.9));
      // Rim and edge colour run down around the cheeks, and fade out on the neck between the arms.
      float belowChin = smoothstep(uGlowPos.y - 0.05, uGlowPos.y + 0.15, vWorld.y);
      col += uHeadEdge * pow(1.0 - ndv, 2.0) * 0.32 * (1.0 - faceGlow) * belowChin;
      col += rim * pow(1.0 - ndv, 7.0) * 4.0 * (1.0 - faceGlow * 0.6) * mix(0.6, 1.0, smoothstep(-0.45, 0.1, vWorld.y)) * belowChin;
      col += mix(rim, vec3(1.0, 0.85, 1.0), 0.6) * pow(1.0 - ndv, 16.0) * 1.6 * belowChin;
      // Crown sheen: a tight highlight toward the upper left; the forehead stays dark navy.
      col += uHeadEdge * pow(max(dot(N, normalize(vec3(-0.5, 0.7, 0.5))), 0.0), 14.0) * 0.22 * (1.0 - faceGlow);
      // Light glowing through the thin edge of the mantle.
      col += uRimLow * pow(1.0 - ndv, 3.0) * uBlotch.w * 0.25 * (1.0 - faceGlow);
      // The face glow warms each cheek lobe from the face side, so the cheeks read as part of the
      // face; their outer edge stays magenta.
      vec2 cheekLocal = vFaceUv * uFaceRect.zw + uFaceRect.xy;
      float lobeL = 1.0 - smoothstep(0.2, 1.6, length((cheekLocal - uCheekCentres.xy - vec2(0.05, 0.0)) / uCheekShape.x));
      float lobeR = 1.0 - smoothstep(0.2, 1.6, length((cheekLocal - uCheekCentres.zw + vec2(0.05, 0.0)) / uCheekShape.x));
      vec3 warm = texture2D(uGlowRamp, vec2(0.5, 0.5)).rgb;
      col = mix(col, warm, max(lobeL, lobeR) * uCheekShape.y * smoothstep(0.15, 0.6, ndv) * frontSide);
      #ifdef HEAD
        // Opened into the dome, the mantle's sunk top tucks into the glass's shadow, with no rim
        // light round it, so the face rises out of the dome instead of a lidded box.
        float capped = smoothstep(0.45, 1.0, uMorph) * smoothstep(-0.2, -0.04, cheekLocal.y);
        col = mix(col, col * 0.4, capped);
      #endif
    #endif

    // Living skin. Detail stays off the face, its glow and the red underside.
    vec3 p = vSurf;
    float detail = (1.0 - smoothstep(0.15, 0.5, faceGlow)) * (1.0 - under * 0.85) * (1.0 - join);
    #ifdef HEAD
      // Keep the face itself clean: brows, eyes, cheeks and mouth.
      vec2 faceLocal = vFaceUv * uFaceRect.zw + uFaceRect.xy;
      float faceZone = 1.0 - smoothstep(0.85, 1.05, length((faceLocal - vec2(0.0, -0.15)) / vec2(0.72, 0.52)));
      detail *= 1.0 - faceZone * smoothstep(0.2, 0.5, vFront);
    #endif

    // Screen-space derivatives of the detail coordinates, for anti-aliasing, for fading out detail
    // too small to draw cleanly, and for exact bump normals. Taken here, outside the branch below,
    // where derivatives are defined.
    vec3 dpx = dFdx(p);
    vec3 dpy = dFdy(p);
    float footprint = max(length(abs(dpx) + abs(dpy)), 1e-6);

    // The detail below is costly, so it is only worked out where it shows.
    float dome = 0.0;
    vec3 domeGrad = vec3(0.0);
    float streak = 0.0;
    float micro = 0.0;
    float glint = 0.0;
    if (detail > 0.002) {
      // Cool and warm drift, lighter and darker, like light through uneven flesh.
      float drift = noise3(p * 2.2) * 0.65 + noise3(p * 5.3 + 7.1) * 0.35;
      vec3 tint = mix(uTintCool, uTintWarm, smoothstep(0.3, 0.7, drift)) * 1.8;
      col = mix(col, col * tint, uBlotch.z * detail);
      #ifdef HEAD
        // Lighter translucent patches on the dark dome, each with a faint darker edge.
        float patchIn = smoothstep(0.56, 0.66, drift);
        float patchEdge = smoothstep(0.5, 0.56, drift) * (1.0 - patchIn);
        col += uTintCool * 0.16 * patchIn * uBlotch.z * detail;
        col *= 1.0 - patchEdge * 0.18 * uBlotch.z * detail;
      #endif

      // Darker blotches.
      vec3 offset;
      vec4 b = nearestPoint(p * uBlotch.y, offset);
      float blotch = step(hash31(b.yzw + 3.7), uBlotch.x) * (1.0 - smoothstep(0.25, 0.5, b.x));
      col = mix(col, uBlotchColor, blotch * 0.45 * detail);

      // Droplet bumps: round glassy domes, lit by the bumped normal below. Up close each is a 3D
      // bead; too small to shade cleanly, it becomes a soft light speck instead.
      vec4 s = nearestPoint(p * uSpeck.w, offset);
      float radius = mix(uSpeck.y, uSpeck.z, hash31(s.yzw + 11.3));
      float cellAA = footprint * uSpeck.w;
      float near3d = smoothstep(3.0, 7.0, radius / cellAA);
      // Droplets fade out where the surface turns away, so they never read as scratched outlines at the rim.
      float present = step(hash31(s.yzw + 5.9), uSpeck.x) * detail * smoothstep(0.25, 0.55, ndv);
      float rise2 = radius * radius - dot(offset, offset);
      dome = sqrt(max(0.0, rise2)) / radius * present * near3d;
      // The droplet's height slope in detail coordinates, worked out exactly: a flattened sphere cap,
      // its rim slope capped so the edge stays smooth.
      domeGrad = -offset / sqrt(max(rise2, radius * radius * 0.05)) * 0.8 * step(0.0, rise2) * present * near3d;
      float edge = smoothstep(radius * 0.75, radius, s.x) * (1.0 - smoothstep(radius, radius * 1.15, s.x)) * present * near3d;
      col *= 1.0 - edge * 0.06;
      // Glassy: a droplet is a little lighter than the skin under it.
      col = mix(col, col * 1.35 + uWetColor * 0.08, dome * 0.75);
      float speckDot = 1.0 - smoothstep(radius * 0.5 - cellAA, radius * 0.5 + cellAA, s.x);
      col += uWetColor * 0.34 * speckDot * present * (1.0 - near3d);

      // Fine wet streaks, stretched along the arms; they fade before they are too fine to draw.
      #ifdef ARM
        streak = noise3(vec3(p.x * 2.0 / uWet.z, p.y * 60.0, p.z * 60.0)) - 0.5;
        streak *= smoothstep(2.0, 4.0, 1.0 / (footprint * 60.0));
      #else
        streak = noise3(p * vec3(30.0, 8.0, 30.0) / uWet.z) - 0.5;
        streak *= smoothstep(2.0, 4.0, 1.0 / (footprint * 30.0 / uWet.z));
      #endif

      // Micro-surface unevenness: tiny bumps that break the highlights into small irregular patches,
      // faded out before they are too fine to draw, and wherever they loom large in any direction on
      // screen (up close, or stretched along an arm seen at a grazing angle), where they would smear
      // the highlights instead of breaking them; there the droplets and glints carry the wet look.
      float ja = dot(dpx, dpx);
      float jb = dot(dpx, dpy);
      float jc = dot(dpy, dpy);
      float leastChange = sqrt(max(0.5 * (ja + jc) - sqrt(0.25 * (ja - jc) * (ja - jc) + jb * jb), 1e-12));
      micro = (noise3(p * 55.0) - 0.5) * smoothstep(2.0, 4.0, 1.0 / (footprint * 55.0)) * (1.0 - smoothstep(9.0, 16.0, 1.0 / (leastChange * 55.0)));

      // Wet glints: short curved strokes of light, each an arc of a small ring facing the key light.
      #ifdef ARM
        float glintScale = 5.0;
      #else
        float glintScale = 7.0;
      #endif
      vec4 g = nearestPoint(p * glintScale, offset);
      float ringR = mix(0.18, 0.34, hash31(g.yzw + 2.3));
      // An anti-aliased band round the ring, never thinner than a pixel; thin bands dim to match.
      float glintAA = footprint * glintScale;
      float band = max(ringR * 0.12, glintAA * 0.7);
      float arc = (1.0 - smoothstep(band - glintAA, band + glintAA, abs(g.x - ringR * 0.88))) * (ringR * 0.12 / band);
      // Measure the arc in the surface's tangent plane, and keep only points lying close to the
      // surface: a point far off it would cut the skin in a small full ring instead of an arc.
      #ifdef ARM
        vec3 across = normalize(vec3(0.0, p.y, p.z));
        float glintDensity = 0.55;
      #else
        vec3 across = N;
        float glintDensity = 0.9;
      #endif
      vec3 along = offset - across * dot(offset, across);
      float onSurface = smoothstep(0.8, 0.97, length(along) / max(length(offset), 1e-4));
      float facing = smoothstep(0.45, 0.85, dot(normalize(along + 1e-4), normalize(vec3(-0.6, 0.7, 0.4)))) * onSurface;
      glint = arc * facing * step(hash31(g.yzw + 9.1), glintDensity) * detail * smoothstep(0.2, 0.5, ndv);
    }

    // Bumps light up toward the key light. Derivatives are taken here, outside the branch.
    float streakHeight = streak * 0.004 * uWet.w * detail + micro * 0.0016 * detail;
    vec3 Nb = bumpNormal(N, dFdx(streakHeight) + dot(domeGrad, dpx), dFdy(streakHeight) + dot(domeGrad, dpy));
    col *= 1.0 + clamp((dot(Nb, L) - dot(N, L)) * 0.9, -0.15, 0.6);

    // Wet gloss: sharp highlights from the key light, broken into patches and streaks.
    float spec = pow(max(dot(Nb, normalize(L + V)), 0.0), uWet.y);
    #ifdef ARM
      // Broken into crisp-edged patches, like painted wet strokes, so the highlight never runs as one
      // stripe down the arm or smears; the edge is anti-aliased to the pixel.
      float wetNoise = noise3(vec3(p.x * 5.0, p.y * 14.0, p.z * 14.0));
      float wetAA = fwidth(wetNoise) + 1e-4;
      float wetPatch = smoothstep(0.6 - wetAA, 0.6 + wetAA, wetNoise);
    #else
      // The dome is too large and smooth for patchy gloss (it reads as fog): only droplets glint.
      float wetPatch = 0.0;
    #endif
    col += uWetColor * spec * uWet.x * max(wetPatch, dome) * mix(0.3, 1.0, detail) * (1.0 - headShade * 0.7) * (1.0 - join);
    // Wet, not plastic: no broad sheen. The surroundings reflect at grazing angles instead, cool
    // water above and the ruin's warm glow below, tinting the edges.
    vec3 R = reflect(-V, Nb);
    vec3 surround = mix(uGroundLight, uSkyLight, smoothstep(-0.5, 0.5, R.y));
    #ifdef ARM
      float grazing = pow(1.0 - ndv, 3.0);
    #else
      float grazing = pow(1.0 - ndv, 5.0);
    #endif
    col += surround * grazing * 2.2 * (1.0 - join);
    col += uWetColor * glint * uWet.x * 0.75;

    // A crisp wet line along the lit top edge: a broad neon line on the arms, a thin one on the
    // dome, whose top stays dark navy inside its rim.
    #ifdef ARM
      float edgeLine = pow(1.0 - ndv, 4.0);
    #else
      float edgeLine = pow(1.0 - ndv, 9.0);
    #endif
    col += uWetColor * edgeLine * smoothstep(0.55, 0.95, up) * uWet.x * 1.1 * (1.0 - join) * (1.0 - 0.6 * headShade);

    // The world's light: small capped accents on the skin's own lighting, none outside a world, and
    // none on the face glow or where the arms join the body.
    col = worldAccent(col, N, ndv, (1.0 - join) * (1.0 - smoothstep(0.3, 0.65, faceGlow)));

    // Atmospheric depth: parts behind the body blend into the water's haze.
    col = mix(col, uHazeColor, smoothstep(uHaze.x, uHaze.y, -vWorld.z) * uHaze.z);

    // Richer, more vivid arms, as in the painting; the head and its face glow already match it,
    // so the boost fades out where the arms join the body and inside the face glow (no seam).
    #ifdef ARM
      float vivid = 0.2 * (1.0 - join) * (1.0 - smoothstep(0.2, 0.6, faceGlow));
      col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 1.0 + vivid), 0.0);
    #endif

    #ifdef HEAD
      // Eye sockets: the skin darkens (at most 18%) within 1.25x each eye's radii, so the eyes sit in the face.
      vec2 local = vFaceUv * uFaceRect.zw + uFaceRect.xy;
      vec2 radii = uEyeRadii * 1.25;
      float socket = max(
        1.0 - smoothstep(0.55, 1.0, length((local - uEyeCenters.xy) / radii)),
        1.0 - smoothstep(0.55, 1.0, length((local - uEyeCenters.zw) / radii)));
      col *= 1.0 - 0.18 * socket * smoothstep(0.05, 0.3, vFront);
      // A slightly finer mip than the default keeps the eyes and lashes crisp at stage size.
      vec4 face = texture2D(uFace, vFaceUv, -0.5);
      float inside = step(0.0, vFaceUv.x) * step(vFaceUv.x, 1.0) * step(0.0, vFaceUv.y) * step(vFaceUv.y, 1.0);
      float mask = face.a * inside * faceWeight(vFront);
      // The face fades into the far water with the skin (none at the stage).
      col = mix(col, mix(face.rgb, uFarHazeColor, noxVeil()), mask);
    #endif
    gl_FragColor = vec4(col, 1.0);
  }
`;

export type SkinKind = 'HEAD' | 'ARM' | 'BODY';

export function createSkinMaterial(kind: SkinKind, uniforms: SkinUniforms, face?: { texture: THREE.Texture; rect: THREE.Vector4 }) {
  return new THREE.ShaderMaterial({
    defines: { [kind]: '' },
    uniforms: {
      ...uniforms,
      uFace: { value: face?.texture ?? null },
      uFaceRect: { value: face?.rect ?? new THREE.Vector4(0, 0, 1, 1) },
    },
    vertexShader: skinVertex,
    fragmentShader: skinFragment,
  });
}
