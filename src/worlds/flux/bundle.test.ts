import * as THREE from 'three';
import { expect, test } from 'vitest';
import { resolveExpressions } from '../../engine/behavior/expressions';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { projectToScreen } from '../../engine/stage/anchors';
import { fovFor } from '../../engine/stage/framing';
import { faceAnchor, validateBundle } from '../../engine/types/bundle';
import { FLUX_BUNDLE, FLUX_STAGE_FRAMES, FLUX_STAGE_PANELS } from './bundle';
import { FLUX } from './character';
import { FLUX_POSES, OVERVIEW_TRACED } from './poses';
import { FLUX_STROKE_SECONDS } from './sequences/defaults';
import p3 from './review/p3_targets.json';
import targets from './review/targets.json';

/** Distance from a point to a polyline, projecting onto its segments. */
const distanceToPolyline = (points: number[][], x: number, y: number) => {
  let best = Infinity;
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k];
    const sx = points[k + 1][0] - ax;
    const sy = points[k + 1][1] - ay;
    const t = Math.min(1, Math.max(0, ((x - ax) * sx + (y - ay) * sy) / (sx * sx + sy * sy || 1)));
    best = Math.min(best, Math.hypot(ax + sx * t - x, ay + sy * t - y));
  }
  return best;
};

// Flux's bundle (spec 6.2, 7.1, 7.8, 7.10): the shape checks the engine's validateBundle does not
// make for us, and the values the spec fixes for the head and the face anchor. That `?world=flux`
// resolves to this bundle is held in src/worlds/index.test.ts: a world's tests may not import the registry.

test('the bundle is one the engine can draw', () => {
  expect(() => validateBundle(FLUX_BUNDLE)).not.toThrow();
  expect(FLUX_BUNDLE.id).toBe('flux');
  expect(FLUX_BUNDLE.character).toBe(FLUX);
});

test('the intro pose has exactly the eight arms', () => {
  expect(Object.keys(FLUX_POSES.intro.arms)).toEqual([...ARM_IDS]);
});

test('the head: dome half width 0.70 to 0.78, top 0.22 to 0.30, small cheek lobes (spec 2.2)', () => {
  expect(FLUX.head.halfWidth).toBeGreaterThanOrEqual(0.7);
  expect(FLUX.head.halfWidth).toBeLessThanOrEqual(0.78);
  expect(FLUX.head.top).toBeGreaterThanOrEqual(0.22);
  expect(FLUX.head.top).toBeLessThanOrEqual(0.3);
  expect(FLUX.head.cheeks.radius).toBeGreaterThanOrEqual(0.06);
  expect(FLUX.head.cheeks.radius).toBeLessThanOrEqual(0.1);
});

test('the face anchor in the intro is at the eyes, y -0.54 within 0.05', () => {
  // faceAnchor is a Vec3 [x, y, z]: y is the second.
  const [, y] = faceAnchor(FLUX_BUNDLE, 'intro');
  expect(Math.abs(y - -0.54)).toBeLessThanOrEqual(0.05);
});

test("the character's own values are inside the engine's clamp: clamping changes nothing", () => {
  expect(clampCharacterConfig(FLUX)).toEqual(FLUX);
});

test('twelve technologies (spec 7.10), chosen in the overview only (ruling R1)', () => {
  expect(FLUX_BUNDLE.content.technologies.length).toBe(12);
  expect(FLUX_BUNDLE.artifacts.choosableIn).toEqual(['overview']);
});

test("the entrance's stroke is Flux's own stroke: recovery + power + glide (spec 7.8)", () => {
  const { recovery, power, glide } = FLUX.personality.swim;
  expect(recovery + power + glide).toBeCloseTo(FLUX_STROKE_SECONDS, 9);
});

test('every piece of storyboard copy is flagged as a placeholder, and the Live Demo link is labelled', () => {
  const { project } = FLUX_BUNDLE.content;
  expect(project.technologyUsages!.length).toBe(12);
  expect(project.technologyUsages!.every(u => u.placeholder === true)).toBe(true);
  expect(project.sections!.every(s => s.placeholder === true)).toBe(true);
  expect(project.sections!.map(s => s.title)).toEqual(['Overview', 'Features', 'Tech Stack', 'Architecture', 'Challenges', 'What I Learned']);
  expect(project.links!.find(l => l.kind === 'live')!.label).toBe('Live Demo');
});

// Task 3: Flux's jelly body, sparkles and cups (spec 7.2). The colour samples are the spec 2.1
// measurements of panel 2, read from the review targets (colour truth), compared as CIE76 delta E.

const sample = (name: string): readonly [number, number, number] => {
  const s = targets.samples.find(t => t.name === name);
  if (!s) throw new Error(`no sample ${name}`);
  return s.rgb as [number, number, number];
};

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** sRGB (0-255) to CIE Lab, D65. */
const toLab = ([r, g, b]: readonly [number, number, number]): [number, number, number] => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const deltaE76 = (hex: string, rgb: readonly [number, number, number]): number => {
  const a = toLab(hexToRgb(hex));
  const b = toLab(rgb);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

const surfaces = FLUX.skin.surfaces!;

test('the mantle and the arms are jelly, with sparkles (spec 7.2)', () => {
  expect(surfaces.mantle.mode).toBe('jelly');
  expect(surfaces.arms.mode).toBe('jelly');
  expect(surfaces.mantle.jelly).toBeDefined();
  expect(surfaces.arms.jelly).toBeDefined();
  expect(surfaces.mantle.sparkle).toBeGreaterThanOrEqual(40);
  expect(surfaces.arms.sparkle).toBeGreaterThan(0);
});

test("the sparkles are denser than Veyra's on both surfaces (spec 7.2; 'twinkling faster' has no config field)", () => {
  // A world's tests may not import a sibling world (src/engine/boundary.test.ts), so Veyra's values are pinned.
  const veyraMantleSparkle = 50; // Veyra mantle sparkle, src/worlds/veyra/character.ts
  const veyraArmsSparkle = 35; // Veyra arms sparkle, src/worlds/veyra/character.ts
  expect(surfaces.mantle.sparkle).toBeGreaterThan(veyraMantleSparkle);
  expect(surfaces.arms.sparkle).toBeGreaterThan(veyraArmsSparkle);
});

test('the core sits just below the mouth, glowing warm', () => {
  const j = surfaces.mantle.jelly!;
  expect(j.coreCenter[1]).toBeLessThan(0);
  expect(j.coreWarmth).toBeGreaterThanOrEqual(1);
});

test.each([
  ['mantle crown', () => surfaces.mantle.jelly!.crown, 'crown'],
  ['mantle depth (head middle)', () => surfaces.mantle.jelly!.depth, 'headMiddle'],
  ['mantle core (face glow)', () => surfaces.mantle.jelly!.core, 'faceGlow'],
  ['mantle rim', () => surfaces.mantle.jelly!.rim, 'headRim'],
  ['arm rim (highlight)', () => surfaces.arms.jelly!.rim, 'armTopHighlight'],
  ['arm depth (body)', () => surfaces.arms.jelly!.depth, 'armBody'],
  ['cup rim', () => FLUX.suckers.style!.rim, 'cupGlow'],
  ['cup edge', () => FLUX.suckers.style!.edge, 'cupGlow'],
])('%s is within delta E 25 of the spec 2.1 sample', (_label, colour, name) => {
  expect(deltaE76(colour(), sample(name))).toBeLessThanOrEqual(25);
});

test('the glow light is violet #d070ff', () => {
  expect(FLUX.glow.light.color.toLowerCase()).toBe('#d070ff');
});

test('the cups are separate ovals with a glowing rim, not a frill (spec 7.2)', () => {
  const style = FLUX.suckers.style!;
  expect(style.scallop).toBeLessThanOrEqual(0.15);
  expect(style.rimWidth).toBeCloseTo(0.18, 9);
  expect(style.glow).toBeGreaterThanOrEqual(1);
});

test('no stray red: only the core, blush, mouth and cups have red above both green and blue', () => {
  // Allowed: the face glow's pink core (`core`, ramp stops 4 and 5), the blush, the mouth (`mouth*`, `tongue`: P2's red-pink mouth), and the cups.
  const allowed = /core|blush|mouth|tongue|sucker|style\.(edge|rim|hollow)|glow\.ramp\[[45]\]/i;
  const strays: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        const [r, g, b] = hexToRgb(value);
        if (r > g && r > b && !allowed.test(path)) strays.push(`${path} ${value}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(FLUX, '');
  expect(strays).toEqual([]);
});

// Task 4: Flux's face (spec 2.3, 7.3), traced from panel 2.

test("his face: two short outer lashes, brows thicker than Nox's, a navy-to-violet iris, a strong pink blush", () => {
  const { eye, brow } = FLUX.face;
  expect(eye.lashes.length).toBe(2);
  const noxBrowThickness = 0.028; // Nox brow thickness, src/worlds/nox/character.ts
  expect(brow.thickness).toBeGreaterThan(noxBrowThickness);
  const iris = FLUX.facePalette.iris;
  // Navy-black at the top: blue leads red, and every channel stays dark.
  const [tr, tg, tb] = hexToRgb(iris[0]);
  expect(tb).toBeGreaterThan(tr);
  for (const v of [tr, tg, tb]) expect(v).toBeLessThan(60);
  // Violet-lavender at the bottom: blue over green, red over green.
  const [br, bg, bb] = hexToRgb(iris[iris.length - 1]);
  expect(bb).toBeGreaterThan(bg);
  expect(br).toBeGreaterThan(bg);
  expect(hexToRgb(FLUX.facePalette.blush)[0]).toBeGreaterThanOrEqual(240);
});

test("his eager face (the focused override) opens the mouth and the eyes wider than Nox's focused face", () => {
  const flux = resolveExpressions(FLUX).focused;
  // Nox's resolved `focused` expression (src/worlds/nox/character.ts through resolveExpressions), pinned: no sibling-world import.
  const nox = { lidRest: 0.12, browLift: 0 };
  expect(flux.mouthOpen).toBeGreaterThan(0);
  // Lid open is one less the resting lid.
  expect(1 - flux.lidRest).toBeGreaterThan(1 - nox.lidRest);
  expect(flux.browLift).toBeGreaterThan(nox.browLift);
});

test('the intro face is the big open smile (P2)', () => {
  const intro = resolveExpressions(FLUX)[FLUX_POSES.intro.expression];
  expect(intro.mouthOpen).toBeGreaterThanOrEqual(0.6);
  expect(intro.mouthCurve).toBeGreaterThan(0.5);
});

test('his expression overrides are in the range the face can draw', () => {
  expect(clampCharacterConfig(FLUX).expressions).toEqual(FLUX.expressions);
});

// Task 11: the overview (P3). The head opens into a wide blue glass capsule holding the project
// panel, the face at its bottom, and the eight arms spread in a ring round it (spec 7.2, 7.4).

test('the overview pose has exactly the eight arms', () => {
  expect(Object.keys(FLUX_POSES.overview.arms)).toEqual([...ARM_IDS]);
});

/** The overview dome's outline on the stage plane: its z = 0 section (a superellipse), placed by the overview body. */
const domeOutline = (steps = 720): THREE.Vector3[] => {
  const { center, halfWidth, halfHeight, power } = FLUX.dome;
  const { x, y, scale } = FLUX_POSES.overview.body;
  const bend = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / power);
  return Array.from({ length: steps }, (_, i) => {
    const a = (2 * Math.PI * i) / steps;
    return new THREE.Vector3(x + scale * (center[0] + halfWidth * bend(Math.cos(a))), y + scale * (center[1] + halfHeight * bend(Math.sin(a))), 0);
  });
};

/** Even-odd test of a screen point against a closed screen polygon. */
const insidePolygon = (p: { x: number; y: number }, poly: { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

test.each([
  ['1536 x 1024', 1536, 1024],
  ['1024 x 1024', 1024, 1024],
  ['1280 x 720', 1280, 720],
])('the dome, projected at the overview frame (%s), holds the HTML panel box with a 0.04 margin', (_label, width, height) => {
  // The same camera the panel box is laid out with (ui/useStageBox: the stage camera framing the overview, on z = 0).
  const size = { width, height };
  const camera = new THREE.PerspectiveCamera(fovFor(FLUX_STAGE_FRAMES.overview, size), width / height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  // The dome's z = 0 section is the smallest outline it shows (its front bulges toward the camera), so this is the strict case.
  const dome = domeOutline().map(p => projectToScreen(p, camera, size));
  const [left, top, right, bottom] = FLUX_STAGE_PANELS.overview;
  const m = 0.04;
  for (const [x, y] of [[left - m, top + m], [right + m, top + m], [right + m, bottom - m], [left - m, bottom - m]]) {
    expect(insidePolygon(projectToScreen(new THREE.Vector3(x, y, 0), camera, size), dome), `corner (${x}, ${y})`).toBe(true);
  }
});

test('the face anchor sits at the dome bottom in the overview, within 0.1', () => {
  const [, y] = faceAnchor(FLUX_BUNDLE, 'overview');
  const { body } = FLUX_POSES.overview;
  const domeBottom = body.y + body.scale * (FLUX.dome.center[1] - FLUX.dome.halfHeight);
  expect(Math.abs(y - domeBottom)).toBeLessThanOrEqual(0.1);
});

test('overview: seen from the stage camera, every arm lies on its P3 trace', () => {
  const { body } = FLUX_POSES.overview;
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(FLUX_POSES.overview.arms[id]), FLUX.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f * body.scale + body.x, chain.py[k] * f * body.scale + body.y];
    });
    for (const [tx, ty] of OVERVIEW_TRACED[id]) {
      expect(distanceToPolyline(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.03);
    }
  });
});

test('the overview dome is P3\'s: placed and sized as the review targets fit it, within 0.03', () => {
  const { center, halfWidth, halfHeight, power } = FLUX.dome;
  const { x, y, scale } = FLUX_POSES.overview.body;
  const fit = p3.dome;
  expect(Math.abs(x + scale * center[0] - fit.center[0])).toBeLessThanOrEqual(0.03);
  expect(Math.abs(y + scale * center[1] - fit.center[1])).toBeLessThanOrEqual(0.03);
  expect(Math.abs(scale * halfWidth - fit.halfWidth)).toBeLessThanOrEqual(0.03);
  expect(Math.abs(scale * halfHeight - fit.halfHeight)).toBeLessThanOrEqual(0.03);
  expect(Math.abs(power - fit.power)).toBeLessThanOrEqual(0.3);
});

test('the overview face is P3\'s: the eyes at P3\'s height, an open smile, the head open', () => {
  const pose = FLUX_POSES.overview;
  const [, eyeY] = FLUX.face.eye.centers[0];
  const eyes = pose.body.y + pose.body.scale * (FLUX.head.faceOrigin[1] + eyeY);
  expect(Math.abs(eyes - p3.eyes.y)).toBeLessThanOrEqual(0.03);
  expect(pose.headMorph).toBe(1);
  expect(pose.orbs).toBe(1);
  expect(resolveExpressions(FLUX)[pose.expression].mouthOpen).toBeGreaterThanOrEqual(0.6);
});

test('the dome palette: an electric-blue rim, a bright blue-white crown rim, a deep navy body (spec 7.2)', () => {
  const { domeTint, domeRim, domeRimTop } = FLUX.palette;
  const [tr, tg, tb] = hexToRgb(domeTint);
  // Deep navy: dark, blue well over red and green.
  expect(tb).toBeLessThan(170);
  expect(tb).toBeGreaterThan(2 * Math.max(tr, tg));
  const [rr, rg, rb] = hexToRgb(domeRim);
  // Electric blue: blue at full, over green, over red.
  expect(rb).toBeGreaterThanOrEqual(230);
  expect(rb).toBeGreaterThan(rg);
  expect(rg).toBeGreaterThan(rr);
  const [cr, cg, cb] = hexToRgb(domeRimTop);
  expect(cb).toBeGreaterThanOrEqual(230);
  expect(cg).toBeGreaterThan(rg);
  expect(cr).toBeLessThan(cb);
});
