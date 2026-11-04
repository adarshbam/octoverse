import * as THREE from 'three';
import type { WaterEnvironment } from './types';

// Procedural textures for the world: tiling stone grain, glowing glyph runes and the water's
// light all round (the environment map that wet stone and iron reflect).

function hash2(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Value noise that tiles every `period` cells. */
function tileNoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const w = (v: number) => ((v % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed);
  const b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed);
  const d = hash2(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Tiling fractal height field, 0..1, `size` square. */
function heightField(size: number, basePeriod: number, octaves: number, seed: number, pits = 0) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      let period = basePeriod;
      for (let o = 0; o < octaves; o++) {
        v += amp * tileNoise((x / size) * period, (y / size) * period, period, seed + o * 17);
        amp *= 0.5;
        period *= 2;
      }
      // Small pits and chips: sharp dips where a fine noise runs low.
      if (pits > 0) {
        const p = tileNoise((x / size) * basePeriod * 6, (y / size) * basePeriod * 6, basePeriod * 6, seed + 99);
        v -= pits * Math.max(0, 0.32 - p) * 3;
      }
      h[y * size + x] = v;
    }
  }
  return h;
}

function dataTexture(data: Uint8Array, size: number, colorSpace: THREE.ColorSpace) {
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = colorSpace;
  t.needsUpdate = true;
  return t;
}

/** A stone surface: a tangent-space normal map of its grain and a mottled albedo multiplier. */
export function makeStoneMaps(seed: number, { size = 512, period = 6, strength = 5, pits = 0.6 } = {}) {
  const h = heightField(size, period, 6, seed, pits);
  const normal = new Uint8Array(size * size * 4);
  const tone = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      normal[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      normal[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      normal[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
      const v = at(x, y);
      // Lighter worn faces, darker pits; low-frequency mottling from the same field.
      const m = Math.min(1, Math.max(0, 0.55 + (v - 0.5) * 1.3));
      tone[i] = tone[i + 1] = tone[i + 2] = m * 255;
      tone[i + 3] = 255;
    }
  }
  return { normal: dataTexture(normal, size, THREE.NoColorSpace), tone: dataTexture(tone, size, THREE.NoColorSpace) };
}

/**
 * The seabed's cracks, worked out once instead of every frame: R is the crack line, G a soft glow
 * round it. Tiles every `cells` Voronoi cells (borders after Inigo Quilez), warped so no line runs
 * straight.
 */
export function makeCrackMap(size = 1024, cells = 12, seed = 5) {
  const wrap = (v: number) => ((v % cells) + cells) % cells;
  const point = (i: number, j: number, out: number[]) => {
    out[0] = hash2(wrap(i), wrap(j), seed);
    out[1] = hash2(wrap(i), wrap(j), seed + 1);
  };
  const data = new Uint8Array(size * size * 4);
  const o = [0, 0];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let x = (px / size) * cells;
      let y = (py / size) * cells;
      x += (tileNoise(x * 1.0, y * 1.0, cells, seed + 7) - 0.5) * 0.7;
      y += (tileNoise(x * 1.0 + 3.1, y * 1.0, cells, seed + 9) - 0.5) * 0.7;
      const nx = Math.floor(x);
      const ny = Math.floor(y);
      const fx = x - nx;
      const fy = y - ny;
      let best = 8;
      let mrx = 0;
      let mry = 0;
      let mgx = 0;
      let mgy = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          point(nx + i, ny + j, o);
          const rx = i + o[0] - fx;
          const ry = j + o[1] - fy;
          const d = rx * rx + ry * ry;
          if (d < best) {
            best = d;
            mrx = rx;
            mry = ry;
            mgx = i;
            mgy = j;
          }
        }
      }
      let edge = 8;
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          const gx = mgx + i;
          const gy = mgy + j;
          point(nx + gx, ny + gy, o);
          const rx = gx + o[0] - fx;
          const ry = gy + o[1] - fy;
          const dx = rx - mrx;
          const dy = ry - mry;
          const len = Math.hypot(dx, dy);
          if (len > 1e-4) edge = Math.min(edge, ((mrx + rx) * 0.5 * dx + (mry + ry) * 0.5 * dy) / len);
        }
      }
      // Wider cracks in places.
      const width = 0.012 + 0.022 * tileNoise(x * 0.5, y * 0.5, cells * 0.5, seed + 11);
      const crack = 1 - Math.min(1, Math.max(0, (edge - width * 0.4) / (width * 0.9)));
      const halo = Math.max(0, 1 - edge / 0.2);
      const k = (py * size + px) * 4;
      data[k] = crack * 255;
      data[k + 1] = halo * halo * 255;
      data[k + 2] = 0;
      data[k + 3] = 255;
    }
  }
  return dataTexture(data, size, THREE.NoColorSpace);
}

type Stroke = readonly (readonly [number, number])[];
/** Runes as polylines in a unit box (-1..1), drawn as glowing strokes. */
export const RUNES: Record<string, { lines: Stroke[]; rings?: readonly [number, number, number][] }> = {
  arrow: { lines: [[[0, 1], [0, -1]], [[-0.62, 0.38], [0, 1], [0.62, 0.38]], [[-0.5, -0.38], [0.5, -0.38]]] },
  diamond: { lines: [[[0, 1], [0.66, 0], [0, -1], [-0.66, 0], [0, 1]]], rings: [[0, 0, 0.16]] },
  eye: { lines: [[[0, 1], [0, 0.72]], [[0, -0.72], [0, -1]]], rings: [[0, 0, 0.62], [0, 0, 0.2]] },
  cross: { lines: [[[0, 1], [0, -1]], [[-0.66, 0.28], [0.66, 0.28]], [[-0.36, -0.5], [0.36, -0.5]]] },
  fork: { lines: [[[0, -1], [0, 0.2]], [[-0.62, 1], [-0.62, 0.2], [0.62, 0.2], [0.62, 1]], [[0, 0.2], [0, 0.8]]] },
  zig: { lines: [[[-0.6, 1], [0.6, 0.45], [-0.6, -0.1], [0.6, -0.65]], [[0, -0.65], [0, -1]]] },
  gate: { lines: [[[-0.6, -1], [-0.6, 0.6], [0, 1], [0.6, 0.6], [0.6, -1]], [[-0.6, -0.1], [0.6, -0.1]]] },
  hook: { lines: [[[0.5, 1], [-0.4, 0.5], [0.4, 0], [-0.4, -0.5], [0.2, -1]]], rings: [[0.45, 0.62, 0.12]] },
};
export const RUNE_SETS = [
  ['arrow', 'cross', 'diamond'],
  ['eye', 'zig', 'fork'],
  ['gate', 'hook', 'cross', 'arrow'],
  ['diamond', 'eye'],
  ['fork', 'gate', 'zig'],
  ['hook', 'arrow', 'eye'],
] as const;

/** Wear comes in this many steps, so panels share their textures. */
const WEAR_STEPS = 4;

/**
 * How one glyph panel of the world looks, from a hash of where it stands (its pillar's index in
 * the layout and its cell on that pillar), so the corridor's panels never repeat evenly:
 * `wear`, 0 (crisp) to 1 (strokes worn through in places), in four steps; `brightness`, a
 * multiplier on the panel's glow, 0.7 to 1.3 in steps of 0.05, about 1 on average. (Each panel's
 * size comes from the kit: the Blender script varies it by its own hash.)
 */
export function glyphPanelLook(pillar: number, cell: number) {
  const wear = Math.min(WEAR_STEPS - 1, Math.floor(hash2(pillar, cell, 41) * WEAR_STEPS)) / (WEAR_STEPS - 1);
  const brightness = Math.round((0.7 + 0.6 * hash2(pillar, cell, 73)) * 20) / 20;
  return { wear, brightness };
}

/**
 * A glyph panel: runes stacked down a dark recess, red strokes with a hot core and a soft glow.
 * Black is empty (the panel draws additively). Rows match the panel's height-to-width ratio.
 * `wear` (0 to 1) breaks the strokes and the seam with patches of the recess's own dark.
 */
export function makeGlyphTexture(runes: readonly string[], aspect: number, wear = 0) {
  const w = 128;
  const h = Math.round(w * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // The recess glows faintly, warmest in the middle.
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  g.addColorStop(0, 'rgb(92,8,16)');
  g.addColorStop(0.55, 'rgb(40,3,8)');
  g.addColorStop(1, 'rgb(10,1,3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const count = Math.max(1, Math.min(runes.length, Math.floor(aspect / 1.15)));
  const cell = h / count;
  const r = Math.min(w * 0.32, cell * 0.32);
  const draw = (name: string, cx: number, cy: number, width: number, color: string, blur: number) => {
    const rune = RUNES[name];
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    for (const line of rune.lines) {
      ctx.beginPath();
      line.forEach(([x, y], k) => (k ? ctx.lineTo(cx + x * r, cy - y * r) : ctx.moveTo(cx + x * r, cy - y * r)));
      ctx.stroke();
    }
    for (const [x, y, rr] of rune.rings ?? []) {
      ctx.beginPath();
      ctx.arc(cx + x * r, cy - y * r, rr * r, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  // Light leaking round the inset stone: a soft seam inside the frame, brighter in some places
  // than others (worn, chipped), never an even line.
  const inset = w * 0.08;
  const corners: [number, number][] = [
    [inset, inset],
    [w - inset, inset],
    [w - inset, h - inset],
    [inset, h - inset],
  ];
  let hash = [...runes.join('')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((hash = (hash * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.lineCap = 'round';
  corners.forEach(([x0, y0], k) => {
    const [x1, y1] = corners[(k + 1) % 4];
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const a = 0.15 + Math.pow(rand(), 1.5) * 0.6;
      const ax = x0 + ((x1 - x0) * s) / steps;
      const ay = y0 + ((y1 - y0) * s) / steps;
      const bx = x0 + ((x1 - x0) * (s + 1)) / steps;
      const by = y0 + ((y1 - y0) * (s + 1)) / steps;
      ctx.strokeStyle = `rgba(255,28,46,${a})`;
      ctx.shadowColor = 'rgba(255,24,44,0.8)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3 + a * 4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  });
  runes.slice(0, count).forEach((name, k) => {
    const cy = cell * (k + 0.5);
    draw(name, w / 2, cy, 15, 'rgba(255,24,44,0.5)', 26);
    draw(name, w / 2, cy, 8, '#ff2c3c', 10);
    draw(name, w / 2, cy, 3, '#ffb49c', 3);
  });
  // Wear: soft patches of the recess's dark over the strokes and the seam, more and larger as it grows.
  ctx.shadowBlur = 0;
  for (let k = Math.round(wear * 9); k > 0; k--) {
    const x = w * (0.12 + rand() * 0.76);
    const y = h * (0.08 + rand() * 0.84);
    const radius = w * (0.05 + rand() * 0.1) * (0.6 + wear * 0.6);
    const patch = ctx.createRadialGradient(x, y, 0, x, y, radius);
    patch.addColorStop(0, `rgba(10,1,3,${0.55 + 0.4 * wear})`);
    patch.addColorStop(1, 'rgba(10,1,3,0)');
    ctx.fillStyle = patch;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  // glTF texture coordinates run top-down.
  t.flipY = false;
  t.anisotropy = 8;
  return t;
}

/**
 * The sphere the water's environment map is rendered from: `top` from the surface above (and
 * brightest toward `sunDir`), `horizon` round the middle, `low` toward the seabed, and the seabed's
 * glow in patches along the band below the horizon (`seabedGlow`; null is none: black, so the band
 * adds nothing). The colours are the world's (`place.water.environment`).
 */
export function createWaterEnvironmentMaterial(environment: WaterEnvironment, sunDir: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uSun: { value: sunDir.clone().normalize() },
      uTop: { value: new THREE.Color(environment.top) },
      uHorizon: { value: new THREE.Color(environment.horizon) },
      uLow: { value: new THREE.Color(environment.low) },
      uRed: { value: environment.seabedGlow === null ? new THREE.Color(0, 0, 0) : new THREE.Color(environment.seabedGlow) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uLow;
      uniform vec3 uRed;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.85, d.y));
        c = mix(c, uLow, smoothstep(0.0, -0.35, d.y));
        c += uTop * 4.0 * pow(max(dot(d, uSun), 0.0), 24.0);
        // Patches of the seabed's glow along the seabed (uRed: the world's seabedGlow, black for none).
        float band = smoothstep(-0.05, -0.3, d.y) * (0.5 + 0.5 * sin(atan(d.z, d.x) * 5.0));
        c += uRed * 0.1 * band;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/**
 * The water's light from every direction, prefiltered for reflections (the world's
 * `water.environment` colours: in Nox, bright blue from the surface above, deep navy round the
 * horizon, the seabed's red glow below). Returns the render target: `.texture` is the environment
 * map, and disposing the target frees it.
 */
export function makeWaterEnvironment(renderer: THREE.WebGLRenderer, environment: WaterEnvironment, sunDir: THREE.Vector3) {
  const scene = new THREE.Scene();
  const material = createWaterEnvironmentMaterial(environment, sunDir);
  const sphere = new THREE.SphereGeometry(10, 64, 32);
  scene.add(new THREE.Mesh(sphere, material));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  material.dispose();
  sphere.dispose();
  return target;
}
