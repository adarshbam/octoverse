import * as THREE from 'three';
import type { DomeShape, EffectColours } from '../../config/types';
import type { HeadEffectModule } from './index';

// Flux's head effect (spec 7.6, contract F3): as his head swells into its glass dome, a pipeline runs
// inside it, the dome's own data run. Four small rings of light come up in a gentle arc across the
// lower half of the glass, joined by a thin dim line; a bright bead runs the line left to right and
// each node fills as it arrives (cyan, lavender, pink, cyan) with a small flash; the last flash sends
// a soft ripple across the glass, and the nodes and the line fade as the project panel comes in.
// One quad, one fragment shader, no texture, no post pass; nothing is allocated per frame. It reads
// only the swell's progress and the dome's frame. Drawn premultiplied (black is empty).

/** How many nodes the pipeline has (P5's four-node graph). */
export const PIPELINE_NODES = 4;

// The phases (spec 7.6), as fractions of the effect's progress.
/** The rings appear from 0 to here, each a little after the one to its left. */
export const RINGS_END = 0.3;
/** The bead runs, and the nodes fill in order, from here to `RUN_END`. */
export const RUN_START = 0.3;
export const RUN_END = 0.75;
/** The ripple spreads from `RUN_END` to 1; the nodes and line fade from here to 1 (after the last flash has begun). */
export const FADE_START = 0.82;

/** One ring's own appearing takes this long, and each starts this much after the last. */
const RING_SPAN = 0.15;
const RING_STAGGER = (RINGS_END - RING_SPAN) / (PIPELINE_NODES - 1);
/** A node's fill flashes up over `FLASH_RISE`, then settles to `FILLED` over `FLASH_SETTLE`. */
const FLASH_RISE = 0.06;
const FLASH_SETTLE = 0.09;
const FILLED = 0.7;
/** With motion off the nodes simply come in over this much of the effect (and go with the fade). */
const CROSSFADE_IN = 0.3;

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

export interface PipelineRunState {
  /** How far each ring has appeared, 0 to 1, left to right. */
  ring: number[];
  /** How full each node is: 0 empty, 1 at its flash, then `FILLED` once settled. */
  fill: number[];
  /** Where the bead is along the line: 0 at the first node, 1 at the last. */
  bead: number;
  /** How far the ripple has spread: 0 not begun, 1 across the glass. */
  ripple: number;
  /** How far the nodes and the line have faded: 0 shown, 1 gone. */
  fade: number;
}

/** When the bead (and so the fill) reaches node `i`, in the effect's progress. */
export function nodeArrival(i: number) {
  return RUN_START + ((RUN_END - RUN_START) * i) / (PIPELINE_NODES - 1);
}

/**
 * The pipeline at `swell` (0 to 1, how far the effect has come in), written into `out` if given. With
 * `reducedMotion` it is a crossfade: the four rings and fills come in together and go with the fade,
 * and the bead and the ripple do not move.
 */
export function pipelineRunState(swell: number, reducedMotion = false, out: PipelineRunState = { ring: [0, 0, 0, 0], fill: [0, 0, 0, 0], bead: 0, ripple: 0, fade: 0 }): PipelineRunState {
  const s = clamp01(swell);
  out.fade = smooth((s - FADE_START) / (1 - FADE_START));
  if (reducedMotion) {
    const shown = smooth(s / CROSSFADE_IN);
    for (let i = 0; i < PIPELINE_NODES; i++) {
      out.ring[i] = shown;
      out.fill[i] = shown * FILLED;
    }
    out.bead = 0;
    out.ripple = 0;
    return out;
  }
  for (let i = 0; i < PIPELINE_NODES; i++) {
    out.ring[i] = smooth((s - i * RING_STAGGER) / RING_SPAN);
    const since = s - nodeArrival(i);
    out.fill[i] = smooth(since / FLASH_RISE) * (1 - (1 - FILLED) * smooth((since - FLASH_RISE) / FLASH_SETTLE));
  }
  out.bead = clamp01((s - RUN_START) / (RUN_END - RUN_START));
  out.ripple = clamp01((s - RUN_END) / (1 - RUN_END));
  return out;
}

/** The nodes' places on the quad, as fractions of the dome's half width across (-1 to 1) and of its half height up from its foot. */
const NODE_X = [-0.62, -0.21, 0.21, 0.62];
const NODE_LOW = 0.46;
const NODE_ARCH = 0.2;
/** A node ring's radius, and the line's half width, in head units. */
const RING_RADIUS = 0.12;
const LINE_WIDTH = 0.012;

/** Where the nodes sit, from the dome's foot (the middle of its lower edge), in the head's space: a gentle arc across the lower half, the middle highest. */
export function nodeLayout(dome: DomeShape): THREE.Vector2[] {
  return NODE_X.map(u => new THREE.Vector2(u * dome.halfWidth, dome.halfHeight * (NODE_LOW + NODE_ARCH * (1 - (u / NODE_X[3]) ** 2))));
}

/** The node colours, left to right, from the palette's effect colours: cyan (`stroke`), lavender (`halo`), pink (`core`), cyan. */
export function nodeColours(effect: EffectColours): THREE.Color[] {
  const [cyan, lavender, pink] = [new THREE.Color(effect.stroke), new THREE.Color(effect.halo), new THREE.Color(effect.core)];
  return [cyan, lavender, pink, cyan.clone()];
}

/**
 * The pipeline's quad: covers the dome, seated at its foot, and draws everything in its fragment
 * shader, clipped to the glass's own outline. Its uniforms: `uRing`, `uFill` (per node), `uBead`,
 * `uRipple` and `uFade` (see `pipelineRunState`), `uNodes` and `uColour` (per node).
 */
function createPipeline(dome: DomeShape, effect: EffectColours) {
  const geometry = new THREE.PlaneGeometry(dome.halfWidth * 2, dome.halfHeight * 2);
  geometry.translate(0, dome.halfHeight, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uRing: { value: [0, 0, 0, 0] },
      uFill: { value: [0, 0, 0, 0] },
      uBead: { value: 0 },
      uRipple: { value: 0 },
      uFade: { value: 0 },
      uNodes: { value: nodeLayout(dome) },
      uColour: { value: nodeColours(effect) },
      uHalf: { value: new THREE.Vector2(dome.halfWidth, dome.halfHeight) },
      uPower: { value: dome.power },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRing[4];
      uniform float uFill[4];
      uniform float uBead;
      uniform float uRipple;
      uniform float uFade;
      uniform vec2 uNodes[4];
      uniform vec3 uColour[4];
      uniform vec2 uHalf;
      uniform float uPower;
      varying vec2 vPos;

      const float RADIUS = ${RING_RADIUS.toFixed(3)};
      const float LINE = ${LINE_WIDTH.toFixed(4)};

      // Where along segment ab the point p projects (0 to 1), and how far from it.
      vec2 along(vec2 p, vec2 a, vec2 b) {
        vec2 ab = b - a;
        float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
        return vec2(h, length(p - a - ab * h));
      }
      vec2 nodeAt(int i) {
        if (i == 0) return uNodes[0];
        if (i == 1) return uNodes[1];
        if (i == 2) return uNodes[2];
        return uNodes[3];
      }
      float ringAt(int i) { return i == 0 ? uRing[0] : i == 1 ? uRing[1] : i == 2 ? uRing[2] : uRing[3]; }
      float fillAt(int i) { return i == 0 ? uFill[0] : i == 1 ? uFill[1] : i == 2 ? uFill[2] : uFill[3]; }
      vec3 colourAt(int i) { return i == 0 ? uColour[0] : i == 1 ? uColour[1] : i == 2 ? uColour[2] : uColour[3]; }

      void main() {
        // Clip to the glass: the dome's own outline (a rounded capsule of power uPower), drawn from its foot.
        vec2 q = vec2(vPos.x / uHalf.x, (vPos.y - uHalf.y) / uHalf.y);
        float edge = pow(abs(q.x), uPower) + pow(abs(q.y), uPower);
        float inside = 1.0 - smoothstep(0.86, 0.98, edge);

        vec3 light = vec3(0.0);
        float cover = 0.0;
        float beadPlace = uBead * 3.0;
        for (int i = 0; i < 4; i++) {
          vec2 c = nodeAt(i);
          vec3 col = colourAt(i);
          float d = length(vPos - c);
          float ring = ringAt(i);
          float fill = fillAt(i);
          // The ring: a thin stroke with a soft glow beside it; it brightens a little as its node fills.
          float stroke = 1.0 - smoothstep(0.006, 0.016, abs(d - RADIUS));
          float glow = exp(-abs(d - RADIUS) * 24.0) * 0.35;
          light += col * (stroke * 0.9 + glow) * ring * (0.65 + 0.5 * fill);
          cover = max(cover, (stroke + glow) * ring);
          // The fill: the node's disc, with a flash where it is brightest, and a halo that follows it.
          float disc = 1.0 - smoothstep(RADIUS * 0.7, RADIUS * 0.86, d);
          float halo = exp(-d * 11.0) * fill;
          light += mix(col, vec3(1.0), 0.35 * fill * fill) * (disc * fill * 1.3 + halo * 0.5);
          cover = max(cover, max(disc * fill, halo * 0.6));
          // The line to the next node: dim once both rings are up, bright behind the bead.
          if (i < 3) {
            vec2 seg = along(vPos, c, nodeAt(i + 1));
            float on = min(ring, ringAt(i + 1));
            float stripe = 1.0 - smoothstep(LINE * 0.5, LINE * 1.6, seg.y);
            // The rings hide the line under them.
            float clear = smoothstep(RADIUS * 0.9, RADIUS * 1.15, d) * smoothstep(RADIUS * 0.9, RADIUS * 1.15, length(vPos - nodeAt(i + 1)));
            float lit = 1.0 - smoothstep(0.0, 0.08, seg.x - clamp(beadPlace - float(i), 0.0, 1.0));
            lit *= step(0.0001, uBead) * step(float(i), beadPlace + 0.0001);
            vec3 lineColour = mix(col, colourAt(i + 1), seg.x);
            float amount = stripe * clear * on;
            light += lineColour * amount * (0.3 + 1.0 * lit);
            cover = max(cover, amount * (0.3 + 0.7 * lit));
          }
        }
        // The bead: a small hot point running the line, in the colour of the node it is heading for.
        float f = clamp(beadPlace, 0.0, 3.0);
        int seg = int(min(floor(f), 2.0));
        vec2 here = mix(nodeAt(seg), nodeAt(seg + 1), f - float(seg));
        float showBead = smoothstep(0.0, 0.03, uBead) * (1.0 - smoothstep(0.97, 1.0, uBead));
        float bd = length(vPos - here);
        vec3 beadColour = mix(colourAt(seg), colourAt(seg + 1), f - float(seg));
        float beadLight = (exp(-bd * bd * 900.0) * 1.6 + exp(-bd * 16.0) * 0.4) * showBead * mix(0.5, 1.0, smoothstep(0.0, 0.5, uBead));
        light += mix(beadColour, vec3(1.0), 0.6) * beadLight;
        cover = max(cover, min(1.0, beadLight));
        // The ripple: a soft ring spreading from the last node across the glass, thinning as it goes.
        float reach = uRipple * uHalf.x * 2.4;
        float rd = abs(length(vPos - uNodes[3]) - reach);
        float ripple = exp(-rd * rd * 80.0) * smoothstep(0.0, 0.06, uRipple) * pow(1.0 - uRipple, 1.4);
        light += colourAt(3) * ripple * 0.9;
        cover = max(cover, ripple * 0.8);

        // Premultiplied: the light adds its colour and covers what is behind it as much as it is bright.
        float shown = (1.0 - uFade) * inside;
        gl_FragColor = vec4(light * shown, clamp(cover, 0.0, 1.0) * shown);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return {
    mesh,
    uniforms: material.uniforms as {
      uRing: { value: number[] };
      uFill: { value: number[] };
      uBead: { value: number };
      uRipple: { value: number };
      uFade: { value: number };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * The `'pipelineRun'` head effect (HEAD_EFFECTS): the pipeline, its colours from the character's
 * `palette.effect` (stroke is cyan, halo lavender, core pink), seated at the bottom of the dome. Each
 * frame it follows the swell: shown while the pipeline runs, scaled with the glass; `reducedMotion`
 * makes it a crossfade (no bead, no ripple).
 */
export const pipelineRunEffect: HeadEffectModule = {
  create(dome, palette) {
    const pipeline = createPipeline(dome, palette.effect);
    const state = pipelineRunState(0);
    // The runtime's root is the mesh itself, as the glyphs' is: seated at the dome's foot, scaled and shown by `update`.
    const mesh = pipeline.mesh;
    mesh.position.set(dome.center[0], dome.center[1] - dome.halfHeight, 0);
    return {
      root: mesh,
      update(swell, frame, _clockSeconds, reducedMotion = false) {
        pipelineRunState(swell, reducedMotion, state);
        mesh.visible = swell > 0.001 && state.fade < 0.999;
        mesh.scale.setScalar(frame.scale);
        for (let i = 0; i < PIPELINE_NODES; i++) {
          pipeline.uniforms.uRing.value[i] = state.ring[i];
          pipeline.uniforms.uFill.value[i] = state.fill[i];
        }
        pipeline.uniforms.uBead.value = state.bead;
        pipeline.uniforms.uRipple.value = state.ripple;
        pipeline.uniforms.uFade.value = state.fade;
      },
      // Every call frees the GPU objects (three's dispose is safe to repeat), with no "already done"
      // flag: StrictMode's development mount cleans an effect up and draws the same runtime again
      // (three uploads it anew), and the real unmount must free that upload too.
      dispose() {
        pipeline.dispose();
      },
    };
  },
};
