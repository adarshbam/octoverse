import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { beforeAll, expect, test, vi } from 'vitest';
import { NOX_SHELLS, layoutOrbits, orbitPoint } from '../artifacts/bubbleOrbits';
import { createDomeMaterial } from '../character/domeMaterial';
import { GLYPH_SIZE, drawsGlyphs, glyphLayout, glyphsFor } from '../character/headGlyphs';
import { NOX } from '../config/nox.character';
import { DOME_PANEL_BOX } from '../ui/OverviewPanel';
import { SEQUENCE_DEFAULTS, SWELL_PUSH_PEAK, SWELL_PUSH_SETTLED } from './keys';
import { type HeadDraw, SWELL_SECONDS, type SwellFrame, SwellRun, headDraw, restingSwell, swellFrame } from './headSwell';
import { loadNoxSequences } from './nox.sequences';
import type { Sequences } from './theatre';

let seq: Sequences;
beforeAll(async () => {
  seq = await loadNoxSequences();
});

const STEP = 1 / 120;
const frames = (opening: boolean) => {
  const out: (SwellFrame & { t: number })[] = [];
  for (let t = 0; t <= SWELL_SECONDS + 1e-9; t += STEP) out.push({ t, ...swellFrame(seq, t, opening) });
  return out;
};

test('the swell squeezes first, overshoots, then settles at 1', () => {
  const f = frames(true);
  // It starts closed.
  expect(f[0].morph).toBeCloseTo(0, 6);
  expect(f[0].squeeze).toBeCloseTo(0, 6);
  // The squeeze comes first: at its height the head has not begun to swell.
  const squeezePeak = f.reduce((a, b) => (b.squeeze > a.squeeze ? b : a));
  expect(squeezePeak.squeeze).toBeGreaterThan(0.9);
  expect(squeezePeak.morph).toBeLessThan(0.01);
  // Then the swell runs past full...
  const swellPeak = f.reduce((a, b) => (b.morph > a.morph ? b : a));
  expect(swellPeak.t).toBeGreaterThan(squeezePeak.t);
  expect(swellPeak.morph).toBeGreaterThan(1.03);
  expect(swellPeak.morph).toBeLessThan(1.15);
  // ...and the squeeze is over before it gets there.
  expect(swellPeak.squeeze).toBeCloseTo(0, 6);
  // It settles at 1, with nothing left of the squeeze, the effect full and the bubbles pushed out.
  const end = f.at(-1)!;
  expect(end.morph).toBeCloseTo(1, 6);
  expect(end.squeeze).toBeCloseTo(0, 6);
  expect(end.effect).toBeCloseTo(1, 6);
  expect(end.push).toBeCloseTo(SWELL_PUSH_SETTLED, 6);
  // The sheet ends where the head rests open, so a finished swell hands over without a jump.
  expect(restingSwell(true)).toEqual({ morph: 1, squeeze: 0, push: SWELL_PUSH_SETTLED, effect: 1 });
  for (const key of ['morph', 'squeeze', 'push', 'effect'] as const) expect(end[key]).toBeCloseTo(restingSwell(true)[key], 6);
  // The effect comes in with the swell, not before it.
  expect(f.find(x => x.effect > 0.01)!.morph).toBeGreaterThan(0.5);
});

test('closing reverses the opening', () => {
  const open = frames(true);
  const close = frames(false);
  // Each closing frame is the sheet itself, sampled straight from Theatre at the mirrored moment
  // (not through swellFrame's opening branch).
  for (const c of close) {
    const raw = seq.sample<SwellFrame>('headSwell', 'main', SWELL_SECONDS - c.t);
    expect(c.morph, `morph at ${c.t.toFixed(3)}`).toBeCloseTo(raw.morph, 6);
    expect(c.squeeze, `squeeze at ${c.t.toFixed(3)}`).toBeCloseTo(Math.max(0, raw.squeeze), 6);
    expect(c.push, `push at ${c.t.toFixed(3)}`).toBeCloseTo(Math.max(0, raw.push), 6);
    expect(c.effect, `effect at ${c.t.toFixed(3)}`).toBeCloseTo(Math.min(1, Math.max(0, raw.effect)), 6);
  }
  // And it passes every authored key in reverse: the key at opening second k comes at closing
  // second L - k, with the key's own value (from the code defaults, independent of any sampling).
  for (const [prop, keys] of Object.entries(SEQUENCE_DEFAULTS.headSwell.objects.main.keys)) {
    for (const [k, v] of keys) expect(swellFrame(seq, SWELL_SECONDS - k, false)[prop as keyof SwellFrame], `${prop} key at ${k}`).toBeCloseTo(v, 6);
  }
  // The reversed order shows: closing, the overshoot comes before the head folds and the squeeze after it.
  const closingPeak = close.reduce((a, b) => (b.morph > a.morph ? b : a));
  const closingSqueeze = close.reduce((a, b) => (b.squeeze > a.squeeze ? b : a));
  expect(closingPeak.morph).toBeGreaterThan(1.03);
  expect(closingSqueeze.t).toBeGreaterThan(closingPeak.t);
  expect(closingSqueeze.morph).toBeLessThan(0.01);
  // It starts open and ends closed: the glyphs go first, then the head folds back.
  expect(close[0].morph).toBeCloseTo(1, 6);
  expect(close.at(-1)!.morph).toBeCloseTo(0, 6);
  expect(close.at(-1)!.effect).toBeCloseTo(0, 6);
  expect(close.find(x => x.effect < 0.01)!.morph).toBeGreaterThan(0.5);
  expect(open.length).toBe(close.length);

  // Turned round part-way, the run carries on from the same moment, the other way: no jump.
  const run = new SwellRun();
  const out = { morph: 0, squeeze: 0, push: 0, effect: 0 };
  run.step({ open: false, still: false, dt: 0 });
  for (let i = 0; i < 60; i++) run.step({ open: true, still: false, dt: 1 / 60 });
  const before = { ...run.frame(seq, 0, out) };
  run.step({ open: false, still: false, dt: 0 });
  const after = run.frame(seq, 0, out);
  expect(after.morph).toBeCloseTo(before.morph, 6);
  expect(after.push).toBeCloseTo(before.push, 6);
  // And it plays to closed.
  for (let i = 0; i < 200; i++) run.step({ open: false, still: false, dt: 1 / 60 });
  expect(run.frame(seq, 0, out)).toEqual(restingSwell(false));
});

test('the head starts where the page opens it, and with motion off it jumps to its end', () => {
  const out = { morph: 0, squeeze: 0, push: 0, effect: 0 };
  const opened = new SwellRun();
  opened.step({ open: true, still: false, dt: 1 / 60 });
  expect(opened.moving).toBe(false);
  expect(opened.frame(seq, 1, out)).toEqual(restingSwell(true));
  // Reduced motion or ?freeze: no anticipation, no overshoot, straight to the end state.
  const still = new SwellRun();
  still.step({ open: false, still: true, dt: 1 / 60 });
  still.step({ open: true, still: true, dt: 1 / 60 });
  expect(still.moving).toBe(false);
  expect(still.frame(seq, 0, out)).toEqual(restingSwell(true));
  still.step({ open: false, still: true, dt: 1 / 60 });
  expect(still.frame(seq, 1, out)).toEqual(restingSwell(false));
  // Even without its sheet (it is not loaded with motion off) and with the stage blend part-way.
  still.step({ open: true, still: true, dt: 1 / 60 });
  expect(still.frame(null, 0.001, out)).toEqual(restingSwell(true));
  // A review still (`?freeze&swell=<s>`) holds that moment of the opening.
  const shot = new SwellRun();
  shot.step({ open: true, still: true, dt: 1 / 60, at: 0.2 });
  expect(shot.frame(seq, 1, out).squeeze).toBeCloseTo(swellFrame(seq, 0.2, true).squeeze, 6);
  // Without its sheet, the stage blend's own easing drives the head: no squeeze, no overshoot.
  const bare = new SwellRun();
  bare.step({ open: true, still: false, dt: 1 / 60 });
  expect(bare.frame(null, 0.5, out)).toMatchObject({ morph: 0.5, squeeze: 0 });
  expect(bare.frame(null, 1, out)).toEqual(restingSwell(true));
  expect(bare.frame(null, 0, out)).toEqual(restingSwell(false));
});

test('bubbles are pushed out while swollen', () => {
  const calm = new THREE.Vector3();
  const pushed = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const settled = restingSwell(true);
  expect(settled.push).toBeGreaterThan(0);
  expect(restingSwell(false).push).toBe(0);
  for (const o of layoutOrbits(15, NOX_SHELLS, 'overview')) {
    for (let t = 0; t < 30; t += 3) {
      orbitPoint(o, t, 0, calm);
      orbitPoint(o, t, settled.push, pushed);
      expect(pushed.distanceTo(origin)).toBeGreaterThan(calm.distanceTo(origin));
    }
  }
  // They go out with the swell and never further than its peak, which bubbleOrbits.test keeps in
  // the frame and clear of the face and the dome's panel.
  let most = 0;
  for (const f of frames(true)) {
    most = Math.max(most, f.push);
    expect(f.push).toBeGreaterThanOrEqual(0);
  }
  expect(most).toBeGreaterThan(SWELL_PUSH_SETTLED);
  expect(most).toBeLessThanOrEqual(SWELL_PUSH_PEAK + 1e-6);
  // Pushed out most as the head is biggest.
  const peak = frames(true).reduce((a, b) => (b.morph > a.morph ? b : a));
  expect(peak.push).toBeGreaterThan(SWELL_PUSH_SETTLED);
});

test('headEffect none renders the approved dome', () => {
  // No glyph mesh or material is built for 'none' or null; Nox's 'glyphs' builds one (Octopus.tsx
  // draws exactly what glyphsFor returns). A silhouette capture builds none either.
  const sentinel = { mesh: 'glyphs' };
  for (const effect of ['none', null] as const) {
    const make = vi.fn(() => sentinel);
    expect(glyphsFor({ ...NOX, headEffect: effect }, false, make)).toBeNull();
    expect(make).not.toHaveBeenCalled();
  }
  const make = vi.fn(() => sentinel);
  expect(glyphsFor(NOX, false, make)).toBe(sentinel);
  expect(make).toHaveBeenCalledWith(NOX.dome, NOX.palette.effect);
  const masked = vi.fn(() => sentinel);
  expect(glyphsFor(NOX, true, masked)).toBeNull();
  expect(masked).not.toHaveBeenCalled();
  expect(drawsGlyphs('none')).toBe(false);
  expect(drawsGlyphs(null)).toBe(false);

  // Settled open, the head and dome draw the approved dome's parameters as recorded before this
  // task (9f9a61d: domeState(1) = visible, scale 1, offset 0, reveal DOME_REACH 1.5, opacity 1; the
  // dome at config.dome.center, no lift; the head unsqueezed). Closed: no dome.
  const draw = (f: SwellFrame) => headDraw(f, {} as HeadDraw);
  expect(draw(restingSwell(true))).toEqual({ morph: 1, visible: true, reveal: 1.5, opacity: 1, scale: 1, lift: 0, across: 1, up: 1 });
  expect(draw(restingSwell(false))).toEqual({ morph: 0, visible: false, reveal: 0, opacity: 0, scale: 1, lift: 0, across: 1, up: 1 });
  // The dome's glass material is the approved one, unchanged: its uniforms, and its shaders' hash as
  // at 9f9a61d (character/domeMaterial.ts is untouched by this task).
  const glass = createDomeMaterial(NOX.palette, NOX.dome);
  const u = glass.uniforms;
  expect([u.uTint, u.uRim, u.uRimTop, u.uSheen].map(x => (x.value as THREE.Color).getHexString())).toEqual(['0c0720', 'ff3a78', 'ff86c4', 'ff8fc8']);
  expect([u.uHalfHeight.value, u.uHalfWidth.value]).toEqual([0.625, 1.445]);
  expect(createHash('sha256').update(glass.vertexShader + glass.fragmentShader).digest('hex')).toBe('9d2e1c47405fea8ac9dd2cdc02cad7fd1b6e3d8fa4b4aae43e1bd3dc1bbe6882');
  glass.dispose();
  // The overshoot swells the glass about its seat, and only while it lasts.
  const over = draw({ morph: 1.07, squeeze: 0, push: 0, effect: 0 });
  expect(over.scale).toBeCloseTo(1.07, 6);
  expect(over.lift).toBeCloseTo(0.07, 6);
  expect(over.morph).toBe(1);
});

test('the glyphs float clear of the face and the dome\'s panel', () => {
  const { dome } = NOX;
  const seat = { x: dome.center[0], y: dome.center[1] - dome.halfHeight };
  const [, panelTop] = DOME_PANEL_BOX;
  // OVERVIEW body placement (poses/nox.poses.ts): the panel box is in world units on the page.
  const body = { x: 0.03, y: 0.353 };
  for (const g of glyphLayout(dome)) {
    const y = seat.y + g.y + body.y;
    // Above the dome's top, so they never sit over the panel or the face below it.
    expect(y - GLYPH_SIZE / 2).toBeGreaterThan(dome.center[1] + dome.halfHeight + body.y);
    expect(y - GLYPH_SIZE / 2).toBeGreaterThan(panelTop);
    expect(Math.abs(seat.x + g.x)).toBeLessThan(dome.halfWidth);
  }
});
