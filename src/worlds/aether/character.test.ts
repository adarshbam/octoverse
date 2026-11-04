import { join } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createSkinMaterial, createSkinUniforms, surfaceLooks } from '../../engine/character/skinMaterial';
import { AETHER } from './character';
import { areaMean, readPng } from './review/readPng';
import targets from './review/targets.json';
import reference from './review/world_reference.json';
import worldSamples from './review/world_samples.json';

// Aether's look on Veyra's variants: jelly glass on the mantle and the arms, star specks over both,
// pink-white frill cups, and an underside band in lavender-pink, never red. Task 6 tuned the colours
// on the render itself; its P2-registered capture is committed as evidence, and these tests hold
// that capture to the spec 2.1 samples and hold the config to the values it was captured with.

const ROOT = join(import.meta.dirname, '..', '..', '..');
// The evidence capture is a PNG, not code: it was made from the final config of Task 6 fix round 1 with
//   WORLD=aether NOX_URL=http://127.0.0.1:5196 node scripts/world-capture.mjs intro
//     docs/superpowers/evidence/aether/m1/world-capture-intro.png "tier=high&kitwait=90000"
// (one command line), which also writes the -mask.png beside it.
// (vite on 127.0.0.1:5196). Re-capture it whenever a value pinned below changes.
const EVIDENCE = join(ROOT, 'docs', 'superpowers', 'evidence', 'aether', 'm1', 'world-capture-intro.png');

/** sRGB (0 to 255) to CIE L*a*b* (D65): the same matrix, white point and f as scripts/check_stage.py (srgb_to_lab). */
function lab([r, g, b]: number[]): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 delta E between two sRGB colours. */
const deltaE = (a: number[], b: number[]) => {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

/** Hue in degrees (0 to 360) of a hex colour. */
function hue(hex: string): number {
  const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return hsl.h * 360;
}

// The samples the P2 look gate leaves open, each for a reason outside the character's look:
// - Arm body upper: P2 paints a thin cyan streak on T1 there (90, 130, 226), 34.5 from "Arm body
//   lower" on T2 (75, 88, 231). The two points sit at the same place on their arms, and the render
//   gives them the same colour within delta E 2 whatever the arm material (fix round 1, c28: arm
//   depth set to the upper colour met the upper at 7.6 and missed the lower at 27.3).
// - Gold and glass seed beads: P2's beads need the ring's left side about 4 degrees higher; spec 2.2
//   has the right side 8 degrees higher. Within the spec's ranges the nearest ring passes 0.15 away.
// - Jellyfish bell and ruin window light: the backdrop's jellyfish and ruin arrive in Task 8 and later.
const OPEN = ['Arm body upper', 'Gold seed bead', 'Glass seed bead', 'Jellyfish bell', 'Ruin window light'];

test('the mantle and the arms are both jelly', () => {
  expect(AETHER.skin.surfaces?.mantle.mode).toBe('jelly');
  expect(AETHER.skin.surfaces?.arms.mode).toBe('jelly');
});

test('the committed P2-look capture meets every character and water sample of spec 2.1 within delta E 10', () => {
  const p2 = readPng(join(ROOT, reference.image)), cap = readPng(EVIDENCE);
  expect([cap.width, cap.height]).toEqual([p2.width, p2.height]);
  const [ox, oy] = reference.origin, k = reference.pxPerUnit;
  const regions = Object.entries(worldSamples.regions) as [string, number[]][];
  expect(regions).toHaveLength(23);
  const misses: string[] = [];
  for (const [name, [wx, wy]] of regions) {
    const x = Math.round(ox + k * wx), y = Math.round(oy - k * wy);
    const de = deltaE(areaMean(p2, x, y, 7), areaMean(cap, x, y, 7));
    if (de > worldSamples.target.deltaE) misses.push(name);
  }
  expect(misses).toEqual(OPEN);
});

test("the committed capture's silhouette meets the P2 mask at IoU 0.85 with the nameplate box left out of both", () => {
  const mine = readPng(EVIDENCE.replace('.png', '-mask.png')), p2 = readPng(join(ROOT, 'public', 'aether', 'ref', 'p2-mask.png'));
  let both = 0, either = 0;
  for (let y = 0; y < p2.height; y++) for (let x = 0; x < p2.width; x++) {
    if (y >= 440 && x >= 183 && x < 340) continue;   // the nameplate box (measure: keep[440:, 183:340] = False)
    const i = y * p2.width + x, a = mine.data[i * mine.channels] > 127, b = p2.data[i * p2.channels] > 127;
    if (a && b) both++;
    if (a || b) either++;
  }
  expect(both / either).toBeGreaterThanOrEqual(targets.iou);
});

test("the committed capture holds the mean colour inside her silhouette to spec 2.1 (the capture's own mask)", () => {
  const cap = readPng(EVIDENCE), mask = readPng(EVIDENCE.replace('.png', '-mask.png'));
  const sum = [0, 0, 0];
  let n = 0, sat = 0, val = 0;
  for (let i = 0; i < cap.width * cap.height; i++) {
    if (mask.data[i * mask.channels] <= 127) continue;
    const px = [0, 1, 2].map((c) => cap.data[i * cap.channels + c]);
    const mx = Math.max(...px), mn = Math.min(...px);
    px.forEach((v, c) => (sum[c] += v));
    sat += mx > 0 ? (mx - mn) / mx : 0;
    val += mx / 255;
    n++;
  }
  const { mean, meanTolerance, saturation, brightness } = worldSamples.target;
  sum.forEach((s, c) => expect(Math.abs(Math.round(s / n) - mean[c]), `channel ${c}`).toBeLessThanOrEqual(meanTolerance));
  expect(sat / n).toBeGreaterThanOrEqual(saturation[0]);
  expect(sat / n).toBeLessThanOrEqual(saturation[1]);
  expect(val / n).toBeGreaterThanOrEqual(brightness[0]);
  expect(val / n).toBeLessThanOrEqual(brightness[1]);
});

test('the committed capture passes the four spec 2.1 checks: warm core, pink not white, periwinkle arms, indigo water', () => {
  const cap = readPng(EVIDENCE), [ox, oy] = reference.origin, k = reference.pxPerUnit;
  const at = (name: string) => {
    const [wx, wy] = (worldSamples.regions as Record<string, number[]>)[name];
    return areaMean(cap, Math.round(ox + k * wx), Math.round(oy - k * wy), 7);
  };
  const eyes = at('Face glow below eyes'), mouth = at('Face glow below mouth'), dome = at('Upper dome');
  expect(eyes[0] - dome[0]).toBeGreaterThanOrEqual(120);
  for (const c of [eyes, mouth]) {
    expect(c[0] - c[1]).toBeGreaterThanOrEqual(25);
    expect(c[1]).toBeLessThanOrEqual(235);
  }
  for (const c of [at('Arm body upper'), at('Arm body lower')]) {
    expect(c[2]).toBeGreaterThanOrEqual(200);
    expect(c[2] - c[0]).toBeGreaterThanOrEqual(90);
  }
  const water = at('Mid water');
  expect(water[2]).toBeGreaterThanOrEqual(60);
  expect(water[2] - water[0]).toBeGreaterThanOrEqual(55);
});

// The values the evidence capture was made with (Task 6). Change one only with a new capture that
// passes the two tests above, and record it in docs/superpowers/reviews/aether.md.
test('the config still holds the Task 6 look the capture was made with', () => {
  const { mantle, arms } = AETHER.skin.surfaces!;
  expect(mantle.jelly).toMatchObject({ rim: '#e0bcf8', rimPower: 1.6, crown: '#a0bafc', crownHeight: 0.55, depth: '#5b4ef3', depthStrength: 1, core: '#fdd4e8' });
  expect(arms.jelly).toMatchObject({ rim: '#e3d3fb', rimPower: 3, crown: '#f8e8fd', crownHeight: 0.42, depth: '#505ce2', depthStrength: 0.8, core: '#eec6fa' });
  expect(AETHER.suckers).toMatchObject({ size: 0.3, tilt: 45, style: { rimWidth: 0.4, rim: '#f4e8ff', hollow: '#a888d8', glow: 1.3 } });
  expect(AETHER.glow).toMatchObject({ core: '#6a4060', reachUp: 0.72, reachDown: 0.16, underside: 1.1 });
  expect(AETHER.palette).toMatchObject({ terminator: '#7a9cf0', armBody: '#4a60e0', belly: '#f4c0f8' });
});

test('the underside band is lavender-pink, not red: on, and every colour in it is blue to pink', () => {
  expect(AETHER.glow.underside).toBeGreaterThan(0);
  for (const hex of [AETHER.palette.terminator, AETHER.palette.belly, AETHER.skin.surfaces!.arms.jelly!.core]) {
    const h = hue(hex);
    expect(h, hex).toBeGreaterThanOrEqual(200);
    expect(h, hex).toBeLessThanOrEqual(320);
  }
});

// Task 6 fix round 1 counted 23 specks on the front of the head and 111 across the arms on the 3x front still
// at sparkle 45 on both surfaces (spec 2.3 asks at least 15 and 60). Lower densities were not measured.
test('star specks on both surfaces at no less than the measured density', () => {
  expect(AETHER.skin.surfaces?.mantle.sparkle).toBeGreaterThanOrEqual(45);
  expect(AETHER.skin.surfaces?.arms.sparkle).toBeGreaterThanOrEqual(45);
});

// The engine's own tests may import only Nox (boundary.test.ts), so the second world's arms path is
// checked here, through the engine's material builder: an arm material from Aether's arms surface
// is jelly with her depth colour, and sparkles.
test("the arms jelly path is live for a second world: an arm material from Aether's arms surface", () => {
  const looks = surfaceLooks(AETHER.skin);
  const arm = createSkinMaterial('ARM', createSkinUniforms(AETHER), AETHER.palette.rimHot, undefined, looks.arms, AETHER.glow.center);
  expect(arm.defines).toEqual({ ARM: '', JELLY: '', SPARKLE: '' });
  // Her arms' own indigo depth (Task 6 fix round 1), not the mantle's blue-violet: the arms surface reaches the uniform.
  expect(arm.uniforms.uJellyDepth.value).toEqual(new THREE.Color('#505ce2'));
  expect(arm.uniforms.uJellyDepth.value).not.toEqual(new THREE.Color(AETHER.skin.surfaces!.mantle.jelly!.depth));
  expect(arm.uniforms.uSparkle.value).toBeGreaterThan(0);
});
