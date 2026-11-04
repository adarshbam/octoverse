import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { resolveExpressions } from '../../engine/behavior/expressions';
import { createSkinMaterial, createSkinUniforms, surfaceLooks } from '../../engine/character/skinMaterial';
import { clampCharacterConfig } from '../../engine/config/validate';
import { HOST, HOST_FACES } from './character';
import { HOST_POSES } from './poses';
import targets from './review/targets.json';

// The host's look (platform spec 7.2, 7.3; Task 3): jelly glass on the mantle and the arms with
// sparkle specks over both, peach-amber frill cups round a violet hollow, and the face's four
// presets as overrides of the engine's existing expression ids, `welcome` the intro face. The spec
// 2.1 global checks (what keeps the host from reading as Aether) hold on the config's own colours
// here; the render is checked against them by scripts/host_delta_e.py.

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** A colour's lightness, roughly: the sum of its channels. */
const lightness = (hex: string) => rgb(hex).reduce((sum, v) => sum + v, 0);

const mantle = HOST.skin.surfaces?.mantle;
const arms = HOST.skin.surfaces?.arms;
const cups = HOST.suckers.style;
const checks = targets.checks;

describe('the jelly', () => {
  test('the mantle and the arms are both jelly, with sparkle specks', () => {
    expect(mantle?.mode).toBe('jelly');
    expect(arms?.mode).toBe('jelly');
    expect(mantle?.sparkle).toBeGreaterThan(0);
    expect(arms?.sparkle).toBeGreaterThan(0);
  });

  test("the mantle's crown, depth and core are spec 7.2's, and the rim is lavender", () => {
    expect(mantle?.jelly?.crown).toBe('#5565fc');
    expect(mantle?.jelly?.depth).toBe('#804ee6');
    expect(mantle?.jelly?.core).toBe('#feafb5');
    const [r, g, b] = rgb(mantle!.jelly!.rim);
    // Lavender: light, blue above red above green.
    expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(150);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
  });
});

describe("spec 2.1's global checks on the config's own colours", () => {
  test('blue crown over a violet head: crown B - R >= 140, upper head R - G >= 30', () => {
    const [cr, , cb] = rgb(mantle!.jelly!.crown);
    expect(cb - cr).toBeGreaterThanOrEqual(checks.crownBminusRmin);
    const [ur, ug] = rgb(mantle!.jelly!.depth);
    expect(ur - ug).toBeGreaterThanOrEqual(checks.upperHeadRminusGmin);
  });

  test('warm core on a cool body: core R is at least 100 over upper-head R', () => {
    expect(rgb(mantle!.jelly!.core)[0] - rgb(mantle!.jelly!.depth)[0]).toBeGreaterThanOrEqual(checks.coreOverHeadRmin);
  });

  test('peach face, not pink-white: the core keeps B - G <= 15 and R - B >= 60', () => {
    const [r, g, b] = rgb(mantle!.jelly!.core);
    expect(b - g).toBeLessThanOrEqual(checks.faceBminusGmax);
    expect(r - b).toBeGreaterThanOrEqual(checks.faceRminusBmin);
  });

  test('warm cups: cup rim R - B >= 60, round a violet hollow', () => {
    expect(cups?.rim).toBe('#f8c59f');
    const [r, , b] = rgb(cups!.rim);
    expect(r - b).toBeGreaterThanOrEqual(checks.cupRminusBmin);
    const [hr, hg, hb] = rgb(cups!.hollow);
    // Violet: blue over red over green, darker than the rim.
    expect(hb).toBeGreaterThan(hr);
    expect(hr).toBeGreaterThan(hg);
    expect(lightness(cups!.hollow)).toBeLessThan(lightness(cups!.rim));
  });
});

describe('the look, round 2 (P2 side by side)', () => {
  test('the arm tops are a lighter lavender than the blue-violet arm body', () => {
    const [r, g, b] = rgb(arms!.jelly!.crown);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
    expect(lightness(arms!.jelly!.crown)).toBeGreaterThan(lightness(arms!.jelly!.depth));
  });

  test('the cup wall is a saturated amber-orange, deeper than the peach rim', () => {
    const [r, g, b] = rgb(cups!.edge);
    expect(r - b).toBeGreaterThanOrEqual(120);
    expect(g).toBeGreaterThan(b);
    expect(rgb(cups!.rim)[2] - b).toBeGreaterThan(40);
  });
});

describe('the face', () => {
  const faces = resolveExpressions(HOST);

  test('the four presets map onto existing expression ids, welcome the intro face', () => {
    expect(Object.keys(HOST_FACES).sort()).toEqual(['delighted', 'presenting', 'restful', 'welcome']);
    expect(HOST_POSES.intro.expression).toBe(HOST_FACES.welcome);
    for (const id of Object.values(HOST_FACES)) expect(HOST.expressions?.[id], id).toBeDefined();
  });

  test('the intro expression is a big open smile (P2), never a small closed one', () => {
    const intro = faces[HOST_POSES.intro.expression];
    expect(intro.mouthOpen).toBeGreaterThanOrEqual(0.6);
    expect(intro.mouthCurve).toBeGreaterThanOrEqual(0.8);
  });

  test("the rest face is the welcome too: the engine's settling face (gentle) is the open smile", () => {
    expect(faces.gentle.mouthOpen).toBe(faces[HOST_FACES.welcome].mouthOpen);
    expect(faces.gentle.mouthCurve).toBe(faces[HOST_FACES.welcome].mouthCurve);
  });

  test('presenting: open smile, brows up, eyes a little wider than the welcome', () => {
    const p = faces[HOST_FACES.presenting];
    const w = faces[HOST_FACES.welcome];
    expect(p.mouthOpen).toBeGreaterThan(0.3);
    expect(p.browLift).toBeGreaterThan(w.browLift);
    expect(p.lidRest).toBeLessThan(w.lidRest);
  });

  test('delighted: eyes squeezed into happy arcs, mouth wide', () => {
    const d = faces[HOST_FACES.delighted];
    expect(d.lidBottom).toBeGreaterThanOrEqual(0.5);
    expect(d.lidRest).toBeGreaterThanOrEqual(0.3);
    expect(d.mouthOpen).toBeGreaterThanOrEqual(faces[HOST_FACES.welcome].mouthOpen);
  });

  test('restful: a soft closed smile', () => {
    const r = faces[HOST_FACES.restful];
    expect(r.mouthOpen).toBe(0);
    expect(r.mouthCurve).toBeGreaterThan(0);
  });
});

test('no head effect', () => {
  expect(HOST.headEffect).toBeNull();
});

test('the validator keeps every value as authored', () => {
  expect(clampCharacterConfig(HOST)).toEqual(HOST);
});

// The engine's material builder takes the host's surfaces: both are jelly with sparkle, the arm in
// its own depth colour.
test("the engine builds jelly with sparkle from the host's surfaces", () => {
  const looks = surfaceLooks(HOST.skin);
  const arm = createSkinMaterial('ARM', createSkinUniforms(HOST), HOST.palette.rimHot, undefined, looks.arms, HOST.glow.center);
  expect(arm.defines).toEqual({ ARM: '', JELLY: '', SPARKLE: '' });
  expect(arm.uniforms.uJellyDepth.value).toEqual(new THREE.Color(arms!.jelly!.depth));
});
