import * as THREE from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { NOX } from '../../../worlds/nox/character';
import type { DomeShape } from '../../config/types';
import { clampCharacterConfig } from '../../config/validate';
import { type HeadDraw, headDraw, restingSwell } from '../../sequences/headSwell';
import { HEAD_EFFECTS } from './index';
import { SYNAPSE_NODES, createSynapse, synapseDissolve, synapseLayout, synapsePulse } from './synapse';

afterEach(() => vi.unstubAllGlobals());

// A dome shaped like Aether's (the engine's tests may read Nox's world only): wide, deep, a square-ish glass.
const dome: DomeShape = { center: [0.07, 0.355], halfWidth: 1.38, halfHeight: 0.805, depth: 1.0, power: 3.2, mantleTop: -0.42 };
const palette = { ...NOX.palette, effect: { halo: 'rgba(201,214,255,0.5)', stroke: '#d99982', core: '#c9d6ff' } };
const frame: HeadDraw = headDraw(restingSwell(true), {} as HeadDraw);
const max = (a: ArrayLike<number>) => Math.max(...Array.from(a));
const grid = Array.from({ length: 1001 }, (_, i) => i / 1000);

test('the head-effect table holds the synapse effect beside Nox\'s, and the id union follows it', () => {
  expect(Object.keys(HEAD_EFFECTS)).toEqual(['none', 'glyphs', 'synapse']);
});

test('one points draw of 24 nodes and one line draw, allocated once, from the palette alone', () => {
  const synapse = createSynapse(dome, palette);
  const root = synapse.root;
  expect(root.children).toHaveLength(2);
  const [points, lines] = root.children as [THREE.Points, THREE.LineSegments];
  expect(points.isPoints).toBe(true);
  expect(lines.isLineSegments).toBe(true);
  expect(points.geometry.getAttribute('position').count).toBe(SYNAPSE_NODES);
  expect(SYNAPSE_NODES).toBe(24);
  const layout = synapseLayout(dome);
  expect(lines.geometry.getAttribute('position').count).toBe(layout.edgeCount * 2);
  // Edges join near neighbours, at most three to a node.
  const degree = new Array(SYNAPSE_NODES).fill(0);
  for (let e = 0; e < layout.edgeCount; e++) {
    degree[layout.edges[2 * e]]++;
    degree[layout.edges[2 * e + 1]]++;
  }
  expect(max(degree)).toBeLessThanOrEqual(3);
  expect(layout.edgeCount).toBeGreaterThanOrEqual(SYNAPSE_NODES - 4);
  // The colours are the palette's: nodes its core, lines its stroke.
  const nodeColour = (points.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color;
  const lineColour = (lines.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color;
  expect(nodeColour.getHex()).toBe(new THREE.Color(palette.effect.core).getHex());
  expect(lineColour.getHex()).toBe(new THREE.Color(palette.effect.stroke).getHex());
  synapse.dispose();
});

test('the nodes stand deterministically inside the dome\'s volume, in front, and the layout does not change', () => {
  const a = synapseLayout(dome);
  const b = synapseLayout(dome);
  expect(Array.from(a.nodes)).toEqual(Array.from(b.nodes));
  expect(Array.from(a.edges)).toEqual(Array.from(b.edges));
  for (let i = 0; i < SYNAPSE_NODES; i++) {
    const x = (a.nodes[3 * i] - 0) / dome.halfWidth;
    const y = (a.nodes[3 * i + 1] - dome.halfHeight) / dome.halfHeight;
    const z = a.nodes[3 * i + 2];
    expect(Math.abs(x) ** dome.power + Math.abs(y) ** dome.power).toBeLessThan(1);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(dome.depth);
  }
});

test('node and line opacity are 0 at swell 0 and at swell 1', () => {
  for (const reducedMotion of [false, true]) {
    const synapse = createSynapse(dome, palette, { reducedMotion });
    for (const s of [0, 1]) {
      synapse.update(s, frame, 0);
      expect(max(synapse.nodeAlpha), `nodes at ${s}`).toBe(0);
      expect(max(synapse.lineAlpha), `lines at ${s}`).toBe(0);
    }
    synapse.dispose();
    const mid = createSynapse(dome, palette, { reducedMotion });
    mid.update(0.5, frame, 0);
    expect(max(mid.nodeAlpha)).toBeGreaterThan(0);
    expect(max(mid.lineAlpha)).toBeGreaterThan(0);
    mid.dispose();
  }
});

test('the network pulses exactly once, peaking in [0.65, 0.8], and the pulse is nothing outside it', () => {
  const values = grid.map(synapsePulse);
  const peaks = values.filter((v, i) => i > 0 && i < 1000 && v > values[i - 1] && v >= values[i + 1] && v > 0.5);
  expect(peaks).toHaveLength(1);
  const peakAt = grid[values.indexOf(Math.max(...values))];
  expect(peakAt).toBeGreaterThanOrEqual(0.65);
  expect(peakAt).toBeLessThanOrEqual(0.8);
  expect(Math.max(...values)).toBeCloseTo(1, 6);
  for (const s of grid) if (s < 0.65 || s > 0.8) expect(synapsePulse(s)).toBe(0);
  // What the runtime draws agrees: its pulse state peaks once, there.
  const synapse = createSynapse(dome, palette);
  const drawn = grid.map(s => (synapse.update(s, frame, 0), synapse.pulse));
  expect(grid[drawn.indexOf(Math.max(...drawn))]).toBeGreaterThanOrEqual(0.65);
  expect(grid[drawn.indexOf(Math.max(...drawn))]).toBeLessThanOrEqual(0.8);
  synapse.dispose();
});

test('the phases run as the spec has them: nodes by 0.3, lines wired from 0.3 to 0.65, lines thin and nodes dissolve over 0.8 to 1', () => {
  const synapse = createSynapse(dome, palette);
  synapse.update(0.3, frame, 0);
  expect(Math.min(...Array.from(synapse.nodeAlpha))).toBeGreaterThan(0);
  expect(max(synapse.lineAlpha)).toBe(0);
  synapse.update(0.65, frame, 0);
  for (let e = 0; e < synapse.layout.edgeCount; e++) expect(synapse.wired[e]).toBe(1);
  expect(synapseDissolve(0.8)).toBe(0);
  expect(synapseDissolve(1)).toBe(1);
  // Past 0.8 the nodes only fade, down to nothing.
  let last = Infinity;
  for (const s of [0.8, 0.85, 0.9, 0.95, 1]) {
    synapse.update(s, frame, 0);
    const total = synapse.nodeAlpha.reduce((a, v) => a + v, 0);
    expect(total).toBeLessThan(last);
    last = total;
  }
  synapse.dispose();
});

test('the wave rises from the face: a lower edge\'s wire time precedes a higher one\'s, all inside 0.3 to 0.65', () => {
  const layout = synapseLayout(dome);
  const mid = (e: number) => (layout.nodes[3 * layout.edges[2 * e] + 1] + layout.nodes[3 * layout.edges[2 * e + 1] + 1]) / 2;
  let compared = 0;
  for (let a = 0; a < layout.edgeCount; a++) {
    expect(layout.wireAt[a]).toBeGreaterThanOrEqual(0.3);
    expect(layout.wireAt[a]).toBeLessThanOrEqual(0.55 + 1e-6);
    for (let b = 0; b < layout.edgeCount; b++) {
      if (mid(a) < mid(b) - 1e-9) {
        expect(layout.wireAt[a]).toBeLessThan(layout.wireAt[b]);
        compared++;
      }
    }
  }
  expect(compared).toBeGreaterThan(100);
  // Wired in time too: part-way, the lowest edge is further along than the highest.
  const synapse = createSynapse(dome, palette);
  const order = Array.from({ length: layout.edgeCount }, (_, e) => e).sort((a, b) => mid(a) - mid(b));
  synapse.update(0.42, frame, 0);
  expect(synapse.wired[order[0]]).toBeGreaterThan(synapse.wired[order[order.length - 1]]);
  expect(synapse.wired[order[0]]).toBe(1);
  expect(synapse.wired[order[order.length - 1]]).toBe(0);
  synapse.dispose();
});

test('reduced motion is a crossfade: no wave, no pulse, every node and line on together', () => {
  const synapse = createSynapse(dome, palette, { reducedMotion: true });
  synapse.update(0.5, frame, 0);
  expect(new Set(Array.from(synapse.nodeAlpha)).size).toBe(1);
  expect(new Set(Array.from(synapse.lineAlpha.slice(0, synapse.layout.edgeCount * 2))).size).toBe(1);
  for (let e = 0; e < synapse.layout.edgeCount; e++) expect(synapse.wired[e]).toBe(1);
  expect(grid.every(s => (synapse.update(s, frame, 0), synapse.pulse === 0))).toBe(true);
  // The same moment of the full effect has a wave in it.
  const full = createSynapse(dome, palette);
  full.update(0.15, frame, 0);
  expect(new Set(Array.from(full.nodeAlpha)).size).toBeGreaterThan(1);
  synapse.dispose();
  full.dispose();
});

/** The swell playing at 60 fps on the effect's clock: `rate` of progress a second, from `from` to `to`; returns the last clock. */
function play(synapse: ReturnType<typeof createSynapse>, from: number, to: number, clock: number, rate = 1 / 1.15) {
  const dt = 1 / 60;
  const steps = Math.round(Math.abs(to - from) / (rate * dt));
  for (let i = 1; i <= steps; i++) synapse.update(from + ((to - from) * i) / steps, frame, (clock += dt));
  return clock;
}

test('closing runs at twice the speed while the swell plays: the effect is gone when the swell is half undone', () => {
  const synapse = createSynapse(dome, palette);
  // Opening 60 fps: progress is the swell exactly, never hurried.
  let clock = play(synapse, 0, 0.6, 1);
  expect(synapse.progress).toBeCloseTo(0.6, 6);
  // Closing from 0.6 at the sheet's pace: when the swell has fallen by 0.1 the effect has fallen by 0.2.
  clock = play(synapse, 0.6, 0.5, clock);
  expect(synapse.progress).toBeCloseTo(0.4, 6);
  // Mid-swell reversal: turned round it catches up with the swell, never jumps (each frame's change is small).
  const before = synapse.progress;
  synapse.update(0.5 + 0.0145, frame, clock + 1 / 60);
  expect(Math.abs(synapse.progress - before)).toBeLessThan(0.04);
  clock = play(synapse, 0.5145, 0.6, clock + 1 / 60);
  expect(synapse.progress).toBeCloseTo(0.6, 6);
  // All the way closed: gone when the swell is half undone.
  const closing = createSynapse(dome, palette);
  clock = play(closing, 0, 1, 1);
  clock = play(closing, 1, 0.5, clock);
  expect(closing.progress).toBeCloseTo(0, 2);
  // A stall of 0.4 s while closing is still the swell running, not a seek.
  const stall = createSynapse(dome, palette);
  clock = play(stall, 0, 0.8, 1);
  stall.update(0.8 - 0.35, frame, clock + 0.4);
  expect(stall.progress).toBeCloseTo(0.1, 6);
  synapse.dispose();
  closing.dispose();
  stall.dispose();
});

test('a scrub or a still shows the swell own progress exactly, whatever it was before', () => {
  const synapse = createSynapse(dome, palette);
  play(synapse, 0, 0.5, 1);
  // One update back to 0.3 on the same frame time, and one a frame later: both are seeks.
  synapse.update(0.3, frame, 3);
  expect(synapse.progress).toBeCloseTo(0.3, 9);
  synapse.update(0.9, frame, 3 + 1 / 60);
  synapse.update(0.26, frame, 3 + 2 / 60);
  expect(synapse.progress).toBeCloseTo(0.26, 9);
  // With the clock held at 0 (motion off) every update is a seek.
  synapse.update(0.9, frame, 0);
  synapse.update(0.2, frame, 0);
  expect(synapse.progress).toBeCloseTo(0.2, 9);
  // A fresh load at that moment draws the same alphas as the runtime scrubbed to it.
  const fresh = createSynapse(dome, palette);
  fresh.update(0.2, frame, 0);
  expect(Array.from(synapse.nodeAlpha)).toEqual(Array.from(fresh.nodeAlpha));
  expect(Array.from(synapse.lineAlpha)).toEqual(Array.from(fresh.lineAlpha));
  synapse.dispose();
  fresh.dispose();
});

test('nodes and line ends show only inside the glass that has formed: the reveal gates them', () => {
  const layout = synapseLayout(dome);
  const synapse = createSynapse(dome, palette);
  const open = (reveal: number): HeadDraw => ({ ...frame, reveal });
  const index = Array.from({ length: SYNAPSE_NODES }, (_, i) => i).sort((a, b) => layout.reach[a] - layout.reach[b]);
  const low = index[0];
  const high = index[SYNAPSE_NODES - 1];
  expect(layout.reach[high]).toBeGreaterThan(layout.reach[low]);
  // Every node is lit by 0.3: with the glass revealed only to the low node, the high one is dark.
  synapse.update(0.3, open(layout.reach[low] + 0.001), 0);
  expect(synapse.nodeAlpha[high]).toBe(0);
  expect(synapse.nodeAlpha[low]).toBeGreaterThan(0);
  // Revealed past the high node it is as bright as with the glass whole.
  synapse.update(0.3, open(layout.reach[high] + 0.08), 0);
  const covered = synapse.nodeAlpha[high];
  synapse.update(0.3, open(1.5), 0);
  expect(covered).toBeGreaterThan(0);
  expect(covered).toBe(synapse.nodeAlpha[high]);
  // A line end follows the same gate: wired to its top, an edge's upper end is dark until the glass reaches it.
  const top = Array.from({ length: layout.edgeCount }, (_, e) => e).sort((a, b) => layout.reach[layout.edges[2 * b + 1]] - layout.reach[layout.edges[2 * a + 1]])[0];
  synapse.update(0.65, open(layout.reach[layout.edges[2 * top]] + 0.001), 0);
  expect(synapse.lineAlpha[2 * top + 1]).toBe(0);
  synapse.update(0.65, open(1.5), 0);
  expect(synapse.lineAlpha[2 * top + 1]).toBeGreaterThan(0);
  synapse.dispose();
});

test('an rgba halo is split into colour and alpha: no three.js warning, the alpha is the halo strength', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const synapse = createSynapse(dome, palette);
  const [points] = synapse.root.children as [THREE.Points];
  const uniforms = (points.material as THREE.ShaderMaterial).uniforms;
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
  expect((uniforms.uHalo.value as THREE.Color).getHex()).toBe(new THREE.Color('#c9d6ff').getHex());
  expect(uniforms.uHaloAlpha.value).toBeCloseTo(0.5, 9);
  synapse.dispose();
});

test('update allocates no Float32Array', () => {
  const synapse = createSynapse(dome, palette);
  const Real = Float32Array;
  let made = 0;
  vi.stubGlobal('Float32Array', new Proxy(Real, { construct(target, args) { made++; return Reflect.construct(target, args); } }));
  for (let i = 0; i <= 400; i++) synapse.update(i / 400, frame, i / 10);
  for (let i = 400; i >= 0; i--) synapse.update(i / 400, frame, i / 10);
  vi.unstubAllGlobals();
  expect(made).toBe(0);
  synapse.dispose();
});

test('dispose is idempotent and frees the geometry and materials each time', () => {
  const synapse = createSynapse(dome, palette);
  const [points, lines] = synapse.root.children as [THREE.Points, THREE.LineSegments];
  const freed = vi.fn();
  for (const o of [points.geometry, lines.geometry, points.material as THREE.Material, lines.material as THREE.Material]) o.addEventListener('dispose', freed);
  expect(() => { synapse.dispose(); synapse.dispose(); }).not.toThrow();
  expect(freed).toHaveBeenCalledTimes(8);
  // The StrictMode remount draws the same runtime again.
  expect(() => synapse.update(0.5, frame, 0)).not.toThrow();
  synapse.dispose();
});

test('the table\'s synapse effect seats at the dome\'s foot, follows the glass, and is hidden at swell 0', () => {
  const runtime = HEAD_EFFECTS.synapse.create(dome, palette);
  const root = runtime.root as THREE.Object3D;
  expect(root.position.toArray()).toEqual([dome.center[0], dome.center[1] - dome.halfHeight, 0]);
  runtime.update(0, frame, 0);
  expect(root.visible).toBe(false);
  runtime.update(0.5, frame, 0);
  expect(root.visible).toBe(true);
  runtime.update(1, headDraw({ morph: 1.07, squeeze: 0, push: 0, effect: 1 }, {} as HeadDraw), 1);
  expect(root.scale.x).toBeCloseTo(1.07, 6);
  runtime.dispose();
  runtime.dispose();
});

test('a config naming the synapse and its palette passes validation as written', () => {
  const clamped = clampCharacterConfig({ ...NOX, headEffect: 'synapse', palette: { ...NOX.palette, effect: { halo: 'rgba(201,214,255,0.5)', stroke: '#d99982', core: '#c9d6ff' } } });
  expect(clamped.headEffect).toBe('synapse');
  expect(clamped.palette.effect).toEqual({ halo: 'rgba(201,214,255,0.5)', stroke: '#d99982', core: '#c9d6ff' });
});
