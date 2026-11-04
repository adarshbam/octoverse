import * as THREE from 'three';
import type { DomeShape, EffectColours } from '../../config/types';
import { RUNES } from '../../world/textures';
import type { HeadEffectModule } from './index';

// Nox's head effect (ledger R57, the owner's words: "Glowing red glyphs"): as the head swells into
// its glass dome, a crown of red runes rises out of the glass and glows above it, the same runes,
// strokes and reds as the world's glyph panels and rune pillars. They come in from the middle out
// as the swell settles and go back into the glass as it closes. One instanced quad per rune, one
// small atlas, no post pass; nothing is allocated per frame. Drawn premultiplied (black is empty).

/** The runes across the crown, left to right, from the world's own (world/textures.ts). */
export const GLYPH_RUNES = ['zig', 'eye', 'arrow', 'diamond', 'gate', 'hook', 'fork'] as const;
/** A rune's quad, in world units, and how far above the dome's top the crown floats. */
export const GLYPH_SIZE = 0.26;
const GAP = 0.04;
/** How much higher the crown stands in the middle than at its ends. */
const ARCH = 0.06;
/** How far across the dome the crown spans, as a fraction of its half-width. */
const SPAN = 0.72;
/** The last rune (the crown's ends) starts coming in this far through the effect. */
const STAGGER = 0.35;

export interface GlyphPlace {
  /** Its centre, from the dome's seat (the middle of its lower edge), in the head's space. */
  x: number;
  y: number;
  /** Its rune: a cell of the atlas. */
  cell: number;
  /** How far through the effect it starts to come in. */
  delay: number;
  /** Its own phase for the glow's slow pulse. */
  phase: number;
}

/** Where the runes float: an arched crown just above the dome's top, the middle one first. */
export function glyphLayout(dome: DomeShape): GlyphPlace[] {
  const n = GLYPH_RUNES.length;
  return GLYPH_RUNES.map((_, i) => {
    const u = (i / (n - 1)) * 2 - 1;
    return {
      x: u * dome.halfWidth * SPAN,
      y: 2 * dome.halfHeight + GAP + GLYPH_SIZE / 2 + ARCH * (1 - u * u),
      cell: i,
      delay: Math.abs(u) * STAGGER,
      phase: i * 1.7,
    };
  });
}

const CELL = 128;

/** The runes side by side, each drawn as the world's panels draw theirs: a soft glow, the red stroke and a hot core, on black. */
function createGlyphAtlas(effect: EffectColours) {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * GLYPH_RUNES.length;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const r = CELL * 0.3;
  GLYPH_RUNES.forEach((name, k) => {
    const rune = RUNES[name];
    const cx = CELL * (k + 0.5);
    const cy = CELL / 2;
    for (const [width, color, blur] of [[15, effect.halo, 26], [8, effect.stroke, 10], [3, effect.core, 3]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      for (const line of rune.lines) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * r, cy - y * r) : ctx.moveTo(cx + x * r, cy - y * r)));
        ctx.stroke();
      }
      for (const [x, y, rr] of rune.rings ?? []) {
        ctx.beginPath();
        ctx.arc(cx + x * r, cy - y * r, rr * r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The crown of glyphs: an instanced quad per rune, its glow premultiplied (black is empty). Its uniforms:
 * `uEffect` (0 to 1, the swell's effect: each rune rises out of the glass and brightens in turn),
 * `uTime` (seconds; held at 0 with motion off, so the runes stand still) and `uStrength` (the
 * glow's brightness). Place the mesh at the dome's seat; scaling it scales the crown with the glass.
 */
export function createHeadGlyphs(dome: DomeShape, effect: EffectColours, strength = 1.3) {
  const places = glyphLayout(dome);
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(Float32Array.from(places, p => p.cell), 1));
  geometry.setAttribute('aDelay', new THREE.InstancedBufferAttribute(Float32Array.from(places, p => p.delay), 1));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(Float32Array.from(places, p => p.phase), 1));
  const map = createGlyphAtlas(effect);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uEffect: { value: 0 },
      uTime: { value: 0 },
      uStrength: { value: strength },
    },
    vertexShader: /* glsl */ `
      attribute float aCell;
      attribute float aDelay;
      attribute float aPhase;
      uniform float uEffect;
      uniform float uTime;
      varying vec2 vUv;
      varying float vShow;
      void main() {
        float s = clamp((uEffect - aDelay) / ${(1 - STAGGER).toFixed(3)}, 0.0, 1.0);
        s = s * s * (3.0 - 2.0 * s);
        vShow = s * (0.85 + 0.15 * sin(uTime * 1.7 + aPhase));
        vUv = vec2((uv.x + aCell) / ${GLYPH_RUNES.length.toFixed(1)}, uv.y);
        vec4 local = instanceMatrix * vec4(position * (0.75 + 0.25 * s), 1.0);
        // Rising out of the glass as it comes in, then bobbing a little.
        local.y += (s - 1.0) * 0.12 + 0.012 * sin(uTime * 0.8 + aPhase);
        gl_Position = projectionMatrix * modelViewMatrix * local;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uStrength;
      varying vec2 vUv;
      varying float vShow;
      void main() {
        // Premultiplied: the glow adds its red and covers what is behind it as much as it is bright,
        // so the runes read red over the blue water too, not pink.
        vec3 c = texture2D(uMap, vUv).rgb;
        float cover = clamp(max(c.r, max(c.g, c.b)) * 1.4, 0.0, 1.0);
        gl_FragColor = vec4(c * uStrength, cover) * vShow;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, places.length);
  const at = new THREE.Matrix4();
  places.forEach((p, i) => mesh.setMatrixAt(i, at.makeScale(GLYPH_SIZE, GLYPH_SIZE, 1).setPosition(p.x, p.y, 0.1)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return {
    mesh,
    uniforms: material.uniforms as { uMap: { value: THREE.Texture }; uEffect: { value: number }; uTime: { value: number }; uStrength: { value: number } },
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}

/**
 * The `'glyphs'` head effect (HEAD_EFFECTS): the crown, its colours from the character's
 * `palette.effect`, seated at the bottom of the dome. Each frame it follows the swell: shown once
 * the effect has begun, scaled with the glass, brightening as the effect comes in; `clockSeconds`
 * is the runes' glow clock (the caller holds it at 0 with motion off, so they stand still).
 */
export const glyphsEffect: HeadEffectModule = {
  create(dome, palette) {
    const glyphs = createHeadGlyphs(dome, palette.effect);
    glyphs.mesh.position.set(dome.center[0], dome.center[1] - dome.halfHeight, 0);
    return {
      root: glyphs.mesh,
      update(swell, frame, clockSeconds) {
        glyphs.mesh.visible = swell > 0.001;
        glyphs.mesh.scale.setScalar(frame.scale);
        glyphs.uniforms.uEffect.value = swell;
        glyphs.uniforms.uTime.value = clockSeconds;
      },
      // Every call frees the GPU objects (three's dispose is safe to repeat). No "already done" flag:
      // StrictMode's development mount cleans the effect up and draws the same runtime again (three
      // uploads it anew), and the real unmount must free that upload too.
      dispose() {
        glyphs.dispose();
      },
    };
  },
};
