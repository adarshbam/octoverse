import * as THREE from 'three';
import type { DomeShape } from '../../config/types';
import type { DomeFrame, HeadEffectModule, HeadEffectOptions, HeadEffectRuntime } from './index';

// Aether's head effect (spec 7.6, ledger H02): a thought wiring itself inside the glass. As the head
// swells, small star nodes wake in the dome, gold lines wire them in a wave that rises from the face
// to the crown, the whole network pulses once, then the lines thin and the nodes melt into the glass's
// sheen. One points draw and one line draw, both allocated once; every frame only rewrites their small
// preallocated attributes. It is a pure function of the swell's progress (the sheet's `effect`, 0 to
// 1) and the dome's frame, so it needs no clock. Colours come from the character's palette alone.

/** The nodes in the dome and the most lines meeting at one. */
export const SYNAPSE_NODES = 24;
const MAX_DEGREE = 3;
/** Fixed, so the network is the same on every load. */
const SEED = 20260514;

// The phases, as fractions of the effect (spec 7.6).
/** Nodes wake over 0 to 0.3: each starts somewhere in 0 to WAKE_SPREAD and takes WAKE_TIME. */
const WAKE_SPREAD = 0.2;
const WAKE_TIME = 0.1;
/** Lines wire over 0.3 to 0.65: the lowest edge starts at WIRE_START, the highest WIRE_RISE later, and each takes WIRE_TIME. */
const WIRE_START = 0.3;
const WIRE_RISE = 0.245;
const WIRE_TIME = 0.1;
/** The one pulse, 0.65 to 0.8. */
const PULSE_FROM = 0.65;
const PULSE_TO = 0.8;
/** Lines thin out over 0.8 to 0.95 and nodes dissolve over 0.8 to 1. */
const DISSOLVE_FROM = 0.8;
const LINES_GONE = 0.95;

/**
 * The swell is playing when its progress moves no faster than this (per second of the effect's own clock)
 * and the clock moves on by no more than MAX_STEP seconds between two updates. Anything else (a scrub, a
 * still placed at a moment, the first frame, the clock held at 0 with motion off) is a seek: the effect
 * shows the swell's own progress exactly. The sheet's effect runs at about 0.9 a second.
 */
const MAX_RATE = 2;
const MAX_STEP = 1;
/** How far the dome's glass is revealed past a node before the node shows: the shader's own soft edge (domeMaterial). */
const REVEAL_EDGE = 0.07;

const NODE_ALPHA = 0.95;
const LINE_ALPHA = 0.8;
/** How much brighter the pulse makes the nodes and the lines, and how much bigger the nodes. */
const PULSE_GLOW = 0.9;
const PULSE_SWELL = 0.4;
/** A node's world size, and how much bigger it swells as it dissolves into the glass. */
const NODE_SIZE = 0.12;
const DISSOLVE_GROWTH = 0.9;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 0 until the effect has come in, then 1 as nodes and lines are gone: the dissolve into the glass's sheen, 0.8 to 1. */
export function synapseDissolve(s: number) {
  return smooth(DISSOLVE_FROM, 1, s);
}

/** The network's one pulse: 0 outside 0.65 to 0.8, one smooth peak of 1 in the middle of it. */
export function synapsePulse(s: number) {
  if (s <= PULSE_FROM || s >= PULSE_TO) return 0;
  const k = Math.sin((Math.PI * (s - PULSE_FROM)) / (PULSE_TO - PULSE_FROM));
  return k * k;
}

export interface SynapseLayout {
  /** Node positions (x, y, z per node) from the dome's seat, in the head's space. */
  nodes: Float32Array;
  /** When (0 to 1) each node starts to wake. */
  wake: Float32Array;
  /** Each node's size, as a fraction of NODE_SIZE. */
  size: Float32Array;
  /** Each node's distance from the dome's seat in the glass's own reveal measure (domeMaterial's `m`): the node shows once `frame.reveal` has passed it. */
  reach: Float32Array;
  /** Edge ends as node indices, the lower node first: [a0, b0, a1, b1, ...]. */
  edges: Uint16Array;
  /** When (0 to 1) each edge starts to wire: the lower an edge, the sooner. */
  wireAt: Float32Array;
  edgeCount: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 1831565813) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where the nodes stand and which join: 24 nodes thrown deterministically (seeded, kept apart) into
 * the dome's interior, in front of its middle so they read through the glass, and the near-neighbour
 * edges between them (each node's three nearest, kept to three lines a node). Each edge's wire time
 * rises with its height, so the wave goes from the face (the dome's foot) up to the crown.
 */
export function synapseLayout(dome: DomeShape): SynapseLayout {
  const rand = rng(SEED);
  const n = SYNAPSE_NODES;
  const nodes = new Float32Array(n * 3);
  const wake = new Float32Array(n);
  const size = new Float32Array(n);
  const revealAt = new Float32Array(n);
  // Unit coordinates of the glass (u across, v up, both -1 to 1), inside 0.8 of its superellipse, clear of the very foot (the face).
  const reach = 0.8;
  const us = new Float32Array(n);
  const vs = new Float32Array(n);
  let apart = 0.3;
  let placed = 0;
  let tries = 0;
  while (placed < n) {
    const u = (rand() * 2 - 1) * reach;
    const v = (rand() * 2 - 1) * reach;
    tries++;
    if (Math.abs(u) ** dome.power + Math.abs(v) ** dome.power > reach ** dome.power || v < -0.7) continue;
    let clear = true;
    for (let k = 0; k < placed; k++) if (Math.hypot(u - us[k], v - vs[k]) < apart) { clear = false; break; }
    if (!clear) {
      if (tries % 400 === 0) apart *= 0.92;
      continue;
    }
    us[placed] = u;
    vs[placed] = v;
    placed++;
  }
  for (let i = 0; i < n; i++) {
    // The glass is thickest in the middle: a node stands at a fraction of the depth there, in front of the plane.
    const room = Math.sqrt(Math.max(0, 1 - Math.abs(us[i]) ** 2 * 0.5 - Math.abs(vs[i]) ** 2 * 0.5));
    nodes[3 * i] = us[i] * dome.halfWidth;
    nodes[3 * i + 1] = dome.halfHeight + vs[i] * dome.halfHeight;
    nodes[3 * i + 2] = dome.depth * (0.08 + 0.4 * rand()) * room;
    revealAt[i] = Math.hypot(us[i], (1 + vs[i]) / 2);
    wake[i] = rand() * WAKE_SPREAD;
    size[i] = 0.7 + 0.6 * rand();
  }

  // Each node's three nearest; candidate pairs shortest first, kept while both ends have a line to spare.
  const dist = (a: number, b: number) => Math.hypot(nodes[3 * a] - nodes[3 * b], nodes[3 * a + 1] - nodes[3 * b + 1], nodes[3 * a + 2] - nodes[3 * b + 2]);
  const pairs: { a: number; b: number; d: number }[] = [];
  const seen = new Set<number>();
  for (let a = 0; a < n; a++) {
    const near = Array.from({ length: n }, (_, b) => b).filter(b => b !== a).sort((p, q) => dist(a, p) - dist(a, q) || p - q).slice(0, MAX_DEGREE);
    for (const b of near) {
      const key = Math.min(a, b) * n + Math.max(a, b);
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ a: Math.min(a, b), b: Math.max(a, b), d: dist(a, b) });
      }
    }
  }
  pairs.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);
  const degree = new Array<number>(n).fill(0);
  const kept: [number, number][] = [];
  for (const { a, b } of pairs) {
    if (degree[a] >= MAX_DEGREE || degree[b] >= MAX_DEGREE) continue;
    degree[a]++;
    degree[b]++;
    kept.push(nodes[3 * a + 1] <= nodes[3 * b + 1] ? [a, b] : [b, a]);
  }
  const edgeCount = kept.length;
  const edges = new Uint16Array(edgeCount * 2);
  const wireAt = new Float32Array(edgeCount);
  const height = kept.map(([a, b]) => (nodes[3 * a + 1] + nodes[3 * b + 1]) / 2);
  const low = Math.min(...height);
  const span = Math.max(...height) - low || 1;
  kept.forEach(([a, b], e) => {
    edges[2 * e] = a;
    edges[2 * e + 1] = b;
    wireAt[e] = WIRE_START + WIRE_RISE * ((height[e] - low) / span);
  });
  return { nodes, wake, size, reach: revealAt, edges, wireAt, edgeCount };
}

/** A CSS colour for the shader: three ignores an `rgba` string's alpha (and warns), so the alpha is split off and applied by the shader. */
function colourAndAlpha(css: string) {
  const m = /^\s*rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)\s*$/i.exec(css);
  if (!m) return { colour: new THREE.Color(css), alpha: 1 };
  const alpha = Number.parseFloat(m[4]);
  return { colour: new THREE.Color(`rgb(${m[1]},${m[2]},${m[3]})`), alpha: Number.isFinite(alpha) ? clamp01(alpha) : 1 };
}

export interface SynapseRuntime extends HeadEffectRuntime {
  readonly root: THREE.Group;
  readonly layout: SynapseLayout;
  /** Where the effect is (0 to 1): the swell's progress opening; closing it falls twice as fast. */
  readonly progress: number;
  /** The pulse now, 0 to 1. */
  readonly pulse: number;
  /** What is drawn: each node's alpha, each line end's alpha, and how far each edge has wired (0 to 1). */
  readonly nodeAlpha: Float32Array;
  readonly lineAlpha: Float32Array;
  readonly wired: Float32Array;
}

const POINT_VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uPx;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip;
    gl_PointSize = max(1.0, aSize * uPx / max(clip.w, 0.001));
  }
`;

// Premultiplied, as the glyphs are: the glow adds its light and covers what is behind it as much as it is bright.
const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHalo;
  uniform float uHaloAlpha;
  uniform float uGlow;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.4, 0.0, d);
    float halo = (1.0 - d) * (1.0 - d);
    vec3 rgb = (uColor * core + uHalo * halo * uHaloAlpha * 1.2) * uGlow;
    float cover = clamp(core + halo * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(rgb * vAlpha, cover * vAlpha);
  }
`;

const LINE_VERTEX = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGlow;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor * uGlow * vAlpha, vAlpha);
  }
`;

const premultiplied = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
} as const;

/** 1 once the dome's glass has been revealed past `reach`, 0 before it (the glass shader's soft edge): a node or line end shows only inside the glass that has formed. */
const shown = (reach: number, reveal: number) => 1 - smooth(reveal - REVEAL_EDGE, reveal, reach);

const dynamic = (array: Float32Array, itemSize: number) => new THREE.BufferAttribute(array, itemSize).setUsage(THREE.DynamicDrawUsage);

/**
 * The effect itself (the module below wraps it): one points draw, one line draw, built once. `palette.effect`
 * colours it: `core` the nodes, `halo` their soft glow, `stroke` the lines. With `reducedMotion` it is a plain
 * crossfade (the nodes and the whole network fade in and out together), with no wave and no pulse.
 */
export function createSynapse(dome: DomeShape, palette: { effect: { halo: string; stroke: string; core: string } }, options: HeadEffectOptions = {}): SynapseRuntime {
  const reduced = options.reducedMotion === true;
  const halo = colourAndAlpha(palette.effect.halo);
  const layout = synapseLayout(dome);
  const { edgeCount } = layout;
  const n = SYNAPSE_NODES;

  const nodeAlpha = new Float32Array(n);
  const nodeSize = new Float32Array(n);
  const lineAlpha = new Float32Array(edgeCount * 2);
  const wired = new Float32Array(edgeCount);
  const linePosition = new Float32Array(edgeCount * 6);

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(layout.nodes, 3));
  pointGeometry.setAttribute('aAlpha', dynamic(nodeAlpha, 1));
  pointGeometry.setAttribute('aSize', dynamic(nodeSize, 1));
  const pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(palette.effect.core) },
      uHalo: { value: halo.colour },
      uHaloAlpha: { value: halo.alpha },
      uGlow: { value: 1 },
      uPx: { value: 1 },
    },
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    ...premultiplied,
  });
  const points = new THREE.Points(pointGeometry, pointMaterial);

  for (let e = 0; e < edgeCount; e++) {
    const a = layout.edges[2 * e];
    for (let k = 0; k < 3; k++) {
      linePosition[6 * e + k] = layout.nodes[3 * a + k];
      linePosition[6 * e + 3 + k] = layout.nodes[3 * a + k];
    }
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', dynamic(linePosition, 3));
  lineGeometry.setAttribute('aAlpha', dynamic(lineAlpha, 1));
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(palette.effect.stroke) }, uGlow: { value: 1 } },
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    ...premultiplied,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);

  const root = new THREE.Group();
  root.add(points, lines);
  // Drawn after the glass, so the network reads over the dome's tint (the glass is nearly opaque early in the swell).
  for (const o of [points, lines]) {
    o.frustumCulled = false;
    o.renderOrder = 2;
  }
  root.frustumCulled = false;
  root.visible = false;
  root.position.set(dome.center[0], dome.center[1] - dome.halfHeight, 0);

  // A node's size in pixels: its world size over the view's pixels per unit at its depth.
  const buffer = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(buffer);
    pointMaterial.uniforms.uPx.value = 0.5 * buffer.y * camera.projectionMatrix.elements[5] * root.scale.x * NODE_SIZE;
  };

  let last = 0;
  let lastClock = 0;
  const runtime = {
    root,
    layout,
    progress: 0,
    pulse: 0,
    nodeAlpha,
    lineAlpha,
    wired,
    update(swell: number, frame: DomeFrame, clockSeconds = 0) {
      // Closing runs at twice the speed: while the swell is playing (its progress moving at a sheet's pace
      // on the effect's clock) the effect follows it down twice as fast (opening, and catching up when
      // turned round, as fast as the swell or faster, never ahead of it). A seek (a scrub, a still at a
      // moment, the first frame, the clock held at 0) shows the swell's own progress exactly. Only the last
      // swell and clock are remembered; nothing is allocated.
      const target = clamp01(Number.isFinite(swell) ? swell : 0);
      const step = target - last;
      const dt = clockSeconds - lastClock;
      last = target;
      lastClock = clockSeconds;
      const playing = dt > 0 && dt <= MAX_STEP && Math.abs(step) <= MAX_RATE * dt;
      const s = playing ? Math.min(target, Math.max(0, runtime.progress + 2 * step)) : target;
      runtime.progress = s;
      root.visible = s > 0.001 && s < 0.9995;
      root.scale.setScalar(frame.scale);
      if (!root.visible) {
        nodeAlpha.fill(0);
        lineAlpha.fill(0);
        wired.fill(0);
        runtime.pulse = 0;
        return;
      }
      const dissolve = synapseDissolve(s);
      const pulse = reduced ? 0 : synapsePulse(s);
      runtime.pulse = pulse;
      const glow = 1 + PULSE_GLOW * pulse;
      pointMaterial.uniforms.uGlow.value = glow;
      lineMaterial.uniforms.uGlow.value = glow;
      // Reduced motion: one envelope for everything, no wave.
      const fade = smooth(0, 0.25, s) * (1 - smooth(0.75, 1, s));
      for (let i = 0; i < n; i++) {
        const lit = (reduced ? fade : smooth(layout.wake[i], layout.wake[i] + WAKE_TIME, s) * (1 - dissolve)) * shown(layout.reach[i], frame.reveal);
        nodeAlpha[i] = Math.min(1, NODE_ALPHA * lit * (1 + 0.35 * pulse));
        nodeSize[i] = layout.size[i] * (reduced ? 1 : 0.6 + 0.4 * lit) * (1 + DISSOLVE_GROWTH * (reduced ? 0 : dissolve) + PULSE_SWELL * pulse);
      }
      const thin = 1 - smooth(DISSOLVE_FROM, LINES_GONE, s);
      for (let e = 0; e < edgeCount; e++) {
        const run = reduced ? 1 : clamp01((s - layout.wireAt[e]) / WIRE_TIME);
        const w = run * run * (3 - 2 * run);
        wired[e] = w;
        const alpha = Math.min(1, LINE_ALPHA * (reduced ? fade : Math.min(1, run * 3) * thin) * (1 + 0.5 * pulse));
        // The line grows from its lower node to its upper; the glass's reveal gates each end by its own reach.
        const a = layout.edges[2 * e];
        const b = layout.edges[2 * e + 1];
        lineAlpha[2 * e] = alpha * shown(layout.reach[a], frame.reveal);
        lineAlpha[2 * e + 1] = alpha * shown(layout.reach[a] + (layout.reach[b] - layout.reach[a]) * w, frame.reveal);
        for (let k = 0; k < 3; k++) {
          const from = layout.nodes[3 * a + k];
          linePosition[6 * e + 3 + k] = from + (layout.nodes[3 * b + k] - from) * w;
        }
      }
      pointGeometry.getAttribute('aAlpha').needsUpdate = true;
      pointGeometry.getAttribute('aSize').needsUpdate = true;
      lineGeometry.getAttribute('aAlpha').needsUpdate = true;
      lineGeometry.getAttribute('position').needsUpdate = true;
    },
    // Every call frees the GPU objects (three's dispose is safe to repeat), as the glyphs do: a StrictMode
    // remount draws the same runtime again and the real unmount must free that upload too.
    dispose() {
      pointGeometry.dispose();
      pointMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
  };
  return runtime;
}

/**
 * The `'synapse'` head effect (HEAD_EFFECTS): the network seated at the bottom of the dome and scaled
 * with the glass, hidden until the effect begins and again once it has dissolved.
 */
export const synapseEffect: HeadEffectModule = {
  create(dome, palette, options) {
    return createSynapse(dome, palette, options);
  },
};
