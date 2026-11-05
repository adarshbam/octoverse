import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { NOX } from '../../../worlds/nox/character';
import { type HeadDraw, headDraw, restingSwell } from '../../sequences/headSwell';
import { HEAD_EFFECTS } from './index';
import { PIPELINE_NODES, pipelineRunState } from './pipelineRun';

afterEach(() => vi.unstubAllGlobals());

const sha1 = (x: string) => createHash('sha1').update(x).digest('hex');
const STEPS = 1000;
const sweep = (reduced = false) => Array.from({ length: STEPS + 1 }, (_, k) => pipelineRunState(k / STEPS, reduced));
const frame = (open: boolean): HeadDraw => headDraw(restingSwell(open), {} as HeadDraw);
/** Three solid colours that are not Nox's (a character with another palette). */
const EFFECT = { halo: '#112233', stroke: '#445566', core: '#778899' };

/** The swell at which a curve first reaches `level`. */
const firstAbove = (values: number[], level: number) => values.findIndex(v => v >= level) / STEPS;
/** The curve's strict local maxima: where it rises and then falls (a plateau is no new peak). */
function peaks(values: number[]) {
  const found: number[] = [];
  let rising = false;
  for (let k = 1; k < values.length; k++) {
    if (values[k] > values[k - 1] + 1e-9) rising = true;
    else if (values[k] < values[k - 1] - 1e-9) {
      if (rising) found.push((k - 1) / STEPS);
      rising = false;
    }
  }
  return found;
}

test('every value is 0 at swell 0, and the fade is 1 at swell 1', () => {
  const start = pipelineRunState(0);
  expect(start).toEqual({ ring: [0, 0, 0, 0], fill: [0, 0, 0, 0], bead: 0, ripple: 0, fade: 0 });
  expect(pipelineRunState(1).fade).toBe(1);
  // Out of range reads as the nearest end; nothing is NaN.
  expect(pipelineRunState(-3)).toEqual(start);
  expect(pipelineRunState(7).fade).toBe(1);
  expect(Number.isNaN(pipelineRunState(Number.NaN).fade)).toBe(false);
});

test('the phases are the spec\'s: rings 0 to 0.3, the bead and the fills 0.3 to 0.75, the ripple and the fade 0.75 to 1', () => {
  const states = sweep();
  const at = (s: number) => states[Math.round(s * STEPS)];
  // Rings are all in by 0.3 and none has begun to fade, nothing else has moved before 0.3.
  for (const ring of at(0.3).ring) expect(ring).toBe(1);
  for (const s of [0, 0.1, 0.2, 0.3]) {
    expect(at(s).bead).toBe(0);
    expect(at(s).fill).toEqual([0, 0, 0, 0]);
    expect(at(s).ripple).toBe(0);
    expect(at(s).fade).toBe(0);
  }
  // The bead runs 0.3 to 0.75, left to right, and is at the last node at 0.75.
  expect(at(0.3).bead).toBe(0);
  expect(at(0.75).bead).toBe(1);
  states.reduce((last, state) => (expect(state.bead).toBeGreaterThanOrEqual(last), state.bead), 0);
  // The ripple and the fade begin with the last phase; the ripple has spread by the end.
  expect(at(0.75).ripple).toBe(0);
  expect(at(0.76).ripple).toBeGreaterThan(0);
  expect(at(1).ripple).toBe(1);
  expect(at(0.75).fade).toBe(0);
  expect(at(0.9).fade).toBeGreaterThan(0);
  // Every value stays in 0..1.
  for (const state of states) for (const v of [...state.ring, ...state.fill, state.bead, state.ripple, state.fade]) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
});

test('node i fills before node i + 1, and each fill waits for the bead to reach it', () => {
  const states = sweep();
  const filled = Array.from({ length: PIPELINE_NODES }, (_, i) => firstAbove(states.map(s => s.fill[i]), 0.5));
  for (let i = 0; i < PIPELINE_NODES - 1; i++) expect(filled[i], `node ${i} before ${i + 1}`).toBeLessThan(filled[i + 1]);
  // The first node fills as the bead leaves 0.3; the last at 0.75 or a little after; none before the bead is there.
  expect(filled[0]).toBeGreaterThanOrEqual(0.3);
  for (const [i, s] of filled.entries()) {
    const beadThere = states.findIndex(state => state.bead >= i / (PIPELINE_NODES - 1) - 1e-9) / STEPS;
    expect(s, `node ${i} fills after the bead arrives`).toBeGreaterThanOrEqual(beadThere);
  }
  // The rings come in order too (left to right).
  const rings = Array.from({ length: PIPELINE_NODES }, (_, i) => firstAbove(states.map(s => s.ring[i]), 0.5));
  for (let i = 0; i < PIPELINE_NODES - 1; i++) expect(rings[i]).toBeLessThan(rings[i + 1]);
});

test('there are exactly four fill peaks, one per node, in order, the last inside the final phase', () => {
  const states = sweep();
  const all = Array.from({ length: PIPELINE_NODES }, (_, i) => peaks(states.map(s => s.fill[i])));
  for (const found of all) expect(found).toHaveLength(1);
  expect(all.flat()).toHaveLength(4);
  const times = all.flat();
  expect([...times].sort((a, b) => a - b)).toEqual(times);
  expect(times[0]).toBeGreaterThanOrEqual(0.3);
  expect(times[3]).toBeGreaterThan(0.75);
  // The peak is the flash: the node is brighter at it than once settled.
  for (const [i, [t]] of all.entries()) {
    expect(states[Math.round(t * STEPS)].fill[i]).toBeGreaterThan(states[STEPS].fill[i]);
  }
});

test('the fade starts after the last node\'s flash has begun, so it is seen', () => {
  const states = sweep();
  const lastPeak = peaks(states.map(s => s.fill[PIPELINE_NODES - 1]))[0];
  expect(states[Math.round(lastPeak * STEPS)].fade).toBeLessThan(0.15);
});

test('reduced motion crossfades: the nodes come in together and go together, with no bead and no ripple', () => {
  const states = sweep(true);
  for (const state of states) {
    expect(state.bead).toBe(0);
    expect(state.ripple).toBe(0);
    // No order and no travel: the four nodes are alike at every moment.
    expect(new Set(state.ring).size).toBe(1);
    expect(new Set(state.fill).size).toBe(1);
  }
  expect(states[0]).toEqual({ ring: [0, 0, 0, 0], fill: [0, 0, 0, 0], bead: 0, ripple: 0, fade: 0 });
  expect(states[STEPS].fade).toBe(1);
  // It comes in (some swell has the nodes shown) and fades out; the fills never peak one after another.
  expect(Math.max(...states.map(s => s.ring[0]))).toBe(1);
  expect(peaks(states.map(s => s.fill[0])).length).toBeLessThanOrEqual(0);
});

test('the module builds one drawn quad from the palette and follows the swell', () => {
  const runtime = HEAD_EFFECTS.pipelineRun.create(NOX.dome, { ...NOX.palette, effect: EFFECT });
  const mesh = runtime.root as THREE.Mesh;
  const material = mesh.material as THREE.ShaderMaterial;
  expect(mesh.visible).toBe(false);
  // Seated at the dome's foot like the other effects.
  expect(mesh.position.toArray()).toEqual([NOX.dome.center[0], NOX.dome.center[1] - NOX.dome.halfHeight, 0]);
  // The nodes are cyan (stroke), lavender (halo), pink (core), cyan: the palette's, in that order.
  const colours = (material.uniforms.uColour.value as THREE.Color[]).map(c => c.getHexString());
  const hex = (x: string) => new THREE.Color(x).getHexString();
  expect(colours).toEqual([hex(EFFECT.stroke), hex(EFFECT.halo), hex(EFFECT.core), hex(EFFECT.stroke)]);

  const open = frame(true);
  runtime.update(0.5, open, 3);
  expect(mesh.visible).toBe(true);
  const want = pipelineRunState(0.5);
  expect(material.uniforms.uRing.value).toEqual(want.ring);
  expect(material.uniforms.uFill.value).toEqual(want.fill);
  expect([material.uniforms.uBead.value, material.uniforms.uRipple.value, material.uniforms.uFade.value]).toEqual([want.bead, want.ripple, want.fade]);
  expect(mesh.scale.toArray()).toEqual([open.scale, open.scale, open.scale]);
  // Swollen past full, the quad rides the glass.
  runtime.update(0.5, headDraw({ morph: 1.07, squeeze: 0, push: 0, effect: 1 }, {} as HeadDraw), 0);
  expect(mesh.scale.x).toBeCloseTo(1.07, 6);
  // With motion off the bead does not travel.
  runtime.update(0.6, open, 0, true);
  expect(material.uniforms.uBead.value).toBe(0);
  expect(material.uniforms.uFill.value).toEqual(pipelineRunState(0.6, true).fill);
  // No effect hides it, and it is hidden again once the pipeline has faded.
  runtime.update(0, frame(false), 0);
  expect(mesh.visible).toBe(false);
  runtime.update(1, open, 0);
  expect(mesh.visible).toBe(false);
  runtime.dispose();
});

test('disposing is idempotent, and frees what is uploaded each time (a StrictMode remount reuses the runtime)', () => {
  const runtime = HEAD_EFFECTS.pipelineRun.create(NOX.dome, { ...NOX.palette, effect: EFFECT });
  const mesh = runtime.root as THREE.Mesh;
  const material = mesh.material as THREE.ShaderMaterial;
  const freed = { geometry: vi.fn(), material: vi.fn() };
  mesh.geometry.addEventListener('dispose', freed.geometry);
  material.addEventListener('dispose', freed.material);
  expect(() => {
    runtime.dispose();
    runtime.dispose();
  }).not.toThrow();
  runtime.update(0.4, frame(true), 1);
  runtime.dispose();
  for (const call of Object.values(freed)) expect(call).toHaveBeenCalledTimes(3);
});

test('the module holds no colour literal: the hues come from the palette\'s effect colours', () => {
  const source = readFileSync(resolve(__dirname, 'pipelineRun.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-fA-F]{6}\b/);
  // Another palette, other colours in the nodes; nothing of the first is left.
  const other = { halo: '#ab12cd', stroke: '#12ab34', core: '#cd34ef' };
  const runtime = HEAD_EFFECTS.pipelineRun.create(NOX.dome, { ...NOX.palette, effect: other });
  const material = (runtime.root as THREE.Mesh).material as THREE.ShaderMaterial;
  expect((material.uniforms.uColour.value as THREE.Color[]).map(c => c.getHexString())).toEqual([other.stroke, other.halo, other.core, other.stroke].map(c => c.slice(1)));
  runtime.dispose();
});

test('Nox\'s glyphs output is unchanged: the same canvas calls, the same shader', () => {
  const log: unknown[] = [];
  const ctx = new Proxy({}, {
    get: (_target, name) => (...args: unknown[]) => void log.push([String(name), ...args]),
    set: (_target, name, value) => (log.push(['set', String(name), value]), true),
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  const runtime = HEAD_EFFECTS.glyphs.create(NOX.dome, NOX.palette);
  expect(log).toHaveLength(374);
  expect(sha1(JSON.stringify(log))).toBe('0aed84af1006b32e11a51e7f60de968a4d9b1004');
  const material = (runtime.root as THREE.InstancedMesh).material as THREE.ShaderMaterial;
  expect(sha1(material.vertexShader + '|' + material.fragmentShader)).toBe('50e6b5226bd13ac5ced9f17807d95a5bef704655');
  runtime.dispose();
  // (Veyra's vaultDial head effect is not in this tree: its output-unchanged test arrives with it.)
});
