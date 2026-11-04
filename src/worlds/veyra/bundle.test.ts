import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { LOGO_SLUGS, logoIcon } from '../../engine/artifacts/logoTexture';
import { EXPRESSIONS, EXPRESSION_IDS, resolveExpressions } from '../../engine/behavior/expressions';
import { ARM_IDS } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { type WorldBundle, faceAnchor, validateBundle } from '../../engine/types/bundle';
import { THEME_COLOURS } from '../../engine/ui/theme';
import { VEYRA_BUNDLE } from './bundle';
import { VEYRA } from './character';
import { VEYRA_POSES } from './poses';

// The registry's own test (src/worlds/index.test.ts) holds `?world=veyra`, the unique Theatre
// project id and the `u-` rule: a world's files may not import the registry or another world.

const ROOT = join(import.meta.dirname, '..', '..', '..');
const DEGREES = 180 / Math.PI;

/** A colour's sRGB channels, 0 to 1 (three reads hex, rgb(), rgba(); `color(srgb-linear r g b)` is read here). */
const channels = (colour: string) => {
  const linear = /^color\(srgb-linear ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(colour);
  const c = linear ? new THREE.Color().setRGB(+linear[1], +linear[2], +linear[3], THREE.LinearSRGBColorSpace) : new THREE.Color(colour);
  return c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
};
/** Red or pink: a saturated colour whose hue is within 25 degrees of red, or from magenta round to it. Gold, cream and orange are not. */
const isRed = (colour: string) => {
  const { r, g, b } = channels(colour);
  const hsl = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  const degrees = hsl.h * 360;
  return hsl.s > 0.3 && hsl.l > 0.15 && (degrees < 25 || degrees > 300);
};

/** Every string in `value` with the path it sits at. */
function strings(value: unknown, path: string, out: [string, string][] = []) {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, i) => strings(item, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) strings(item, `${path}.${key}`, out);
  return out;
}

const refusal = (bundle: WorldBundle) => {
  try {
    validateBundle(bundle);
  } catch (error) {
    return error as { field?: string };
  }
  return {};
};

test('Veyra validates', () => {
  expect(() => validateBundle(VEYRA_BUNDLE)).not.toThrow();
  expect(VEYRA_BUNDLE.id).toBe('veyra');
});

test('every stage has exactly the eight arms, T1 to T8', () => {
  expect(Object.keys(VEYRA_POSES.intro.arms)).toEqual([...ARM_IDS]);
  for (const stage of Object.values(VEYRA_POSES)) expect(Object.keys(stage.arms)).toEqual([...ARM_IDS]);
  expect(VEYRA.arms.map(arm => arm.id)).toEqual([...ARM_IDS]);
});

test('the head: small cheek lobes, a wide tall dome (spec 2.2)', () => {
  expect(VEYRA.head.cheeks.radius).toBeGreaterThanOrEqual(0.08);
  expect(VEYRA.head.cheeks.radius).toBeLessThanOrEqual(0.12);
  expect(VEYRA.head.halfWidth).toBeGreaterThanOrEqual(0.88);
  expect(VEYRA.head.halfWidth).toBeLessThanOrEqual(0.96);
  expect(VEYRA.head.top).toBeGreaterThanOrEqual(0.44);
  expect(VEYRA.head.top).toBeLessThanOrEqual(0.52);
});

test('the eyes land at about y -0.50 in the intro, the head leaning about ten degrees', () => {
  expect(Math.abs(faceAnchor(VEYRA_BUNDLE, 'intro')[1] - -0.5)).toBeLessThan(0.05);
  expect(VEYRA.head.faceOrigin[1] + VEYRA.face.eye.centers[0][1]).toBeCloseTo(-0.5, 2);
  const tilt = (VEYRA_POSES.intro.tilt ?? 0) * DEGREES;
  expect(tilt).toBeGreaterThan(8);
  expect(tilt).toBeLessThan(12);
});

test('every authored character value is already in range (the clamp changes nothing)', () => {
  expect(clampCharacterConfig(VEYRA)).toEqual(VEYRA);
});

test('twelve technologies, each with a logo the engine can draw, but AWS (simple-icons has no mark for it)', () => {
  const { technologies } = VEYRA_BUNDLE.content;
  expect(technologies.length).toBe(12);
  expect(new Set(technologies.map(t => t.id)).size).toBe(12);
  for (const technology of technologies) {
    if (technology.iconKey === 'aws') {
      expect(LOGO_SLUGS.aws).toBeUndefined();
      continue;
    }
    expect(LOGO_SLUGS[technology.iconKey], technology.iconKey).toBeDefined();
    expect(logoIcon(technology.iconKey), technology.iconKey).toBeDefined();
  }
});

test('the project is Vault OS by Veyra, and every storyboard string is flagged a placeholder', () => {
  const { project } = VEYRA_BUNDLE.content;
  expect([project.characterName, project.characterEpithet, project.name, project.tagline]).toEqual(['Veyra', 'The Keeper of Files', 'Vault OS', 'A secure cloud storage platform.']);
  expect(project.sections!.map(s => s.title)).toEqual(['Overview', 'Features', 'Tech Stack', 'Architecture', 'Challenges', 'What I Learned']);
  expect(project.sections!.every(s => s.placeholder === true)).toBe(true);
  expect(project.technologyUsages!.every(u => u.placeholder === true)).toBe(true);
  expect(project.technologyUsages).toHaveLength(12);
  expect(project.links!.find(l => l.kind === 'live')!.label).toBe('Live Demo');
});

test("the four character tints are set explicitly: none reads Nox's fallback", () => {
  const { palette } = VEYRA;
  const bare = { ...palette, rimHot: undefined, domeRimHot: undefined, suckerSpecular: undefined, orbGlass: undefined } as never;
  const fallback = clampCharacterConfig({ ...VEYRA, palette: bare }).palette;
  expect(palette.rimHot).not.toBe(fallback.rimHot);
  expect(palette.domeRimHot).not.toBe(fallback.domeRimHot);
  expect(palette.suckerSpecular).not.toBe(fallback.suckerSpecular);
  for (const key of ['below', 'above', 'side', 'base'] as const) expect(palette.orbGlass[key], key).not.toBe(fallback.orbGlass[key]);
});

test('her cups are the frill style: raised cream cups at the P2 sample with a darker teal-cream hollow (spec 7.1, 2.3)', () => {
  const style = VEYRA.suckers.style!;
  expect(style).toBeDefined();
  expect([style.scallop, style.rimWidth, style.glow]).toEqual([0.6, 0.22, 1.5]);
  // The edge within 15 points per channel of the P2 cup sample (224, 220, 156), set a little
  // brighter since the stage's key light and bounce darken it; the rim's crest brighter still (45).
  const rgb = (c: string) => Object.values(channels(c)).map(v => Math.round(v * 255));
  const sample = [224, 220, 156];
  for (const [key, within] of [['edge', 15], ['rim', 45]] as const) rgb(style[key]).forEach((v, i) => expect(Math.abs(v - sample[i]), `${key} channel ${i}`).toBeLessThanOrEqual(within));
  expect(rgb(style.rim).reduce((a, b) => a + b)).toBeGreaterThan(rgb(style.edge).reduce((a, b) => a + b));
  // The hollow: darker than the edge, and teal-cream (green over red and over blue), not grey.
  const [r, g, b] = rgb(style.hollow);
  expect(r + g + b).toBeLessThan(0.7 * rgb(style.edge).reduce((x, y) => x + y));
  expect(g).toBeGreaterThan(r);
  expect(g).toBeGreaterThan(b);
  for (const key of ['edge', 'rim', 'hollow'] as const) expect(isRed(style[key]), key).toBe(false);
});

test("her face (spec 7.3): two outer lashes, the iris toward the nose, green irises, brows thinner than Nox's, a peach blush", () => {
  const { eye, brow } = VEYRA.face;
  expect(eye.lashes.length).toBe(2);
  expect(eye.iris.inset).toBeGreaterThan(0);
  const rgb = (c: string) => Object.values(channels(c)).map(v => Math.round(v * 255));
  // Dark green at the top to bright green-gold at the bottom: green leads every stop.
  for (const stop of VEYRA.facePalette.iris) {
    const [r, g, b] = rgb(stop);
    expect(g, stop).toBeGreaterThan(r);
    expect(g, stop).toBeGreaterThan(b);
  }
  // Thin arcs (src/worlds/index.test.ts holds them thinner than Nox's: a world's tests may not import another world).
  expect(brow.thickness).toBeLessThan(0.025);
  // Peach-pink: red high, green between red and blue, so it is neither red nor orange-brown.
  const [r, g, b] = rgb(VEYRA.facePalette.blush);
  expect(r).toBeGreaterThanOrEqual(230);
  expect(g).toBeLessThan(r);
  expect(g).toBeGreaterThan(b);
});

test("her focused face is an interested look, not Nox's narrowed grin; every other face is the base one", () => {
  const faces = resolveExpressions(VEYRA);
  // Brows up, eyes a little wider (a lower resting lid), the smile small.
  expect(faces.focused.browLift).toBeGreaterThan(EXPRESSIONS.focused.browLift);
  expect(faces.focused.browTilt).toBeGreaterThan(EXPRESSIONS.focused.browTilt);
  expect(faces.focused.lidRest).toBeLessThan(EXPRESSIONS.focused.lidRest);
  expect(faces.focused.mouthOpen).toBeLessThan(EXPRESSIONS.focused.mouthOpen);
  for (const id of EXPRESSION_IDS) if (id !== 'focused') expect(faces[id], id).toEqual(EXPRESSIONS[id]);
  // Her own values are already in the range the face can draw.
  expect(clampCharacterConfig(VEYRA).expressions).toEqual(VEYRA.expressions);
});

test('the place supplies its water, floor glow and live colours, and no seabed glow band', () => {
  const { water, palette, live, glow } = VEYRA_BUNDLE.place;
  expect(Object.keys(water.colours).sort()).toEqual(['deep', 'fish', 'glow', 'opening', 'rays', 'raysWide', 'zenith']);
  expect(water.environment.seabedGlow).toBeNull();
  expect(Object.keys(palette.floorGlow).sort()).toEqual(['cracks', 'lava', 'pores', 'sheen']);
  expect(Object.keys(live.colours).sort()).toEqual(['bubbles', 'embers', 'motes', 'snow']);
  expect(glow).toMatchObject({ lava: 0, back: 0, floor: 0, crevice: 0, embers: 0 });
  expect(live.embers).toBe(0);
  expect(VEYRA_BUNDLE.place.lights.points).toEqual([]);
});

test('the theme gives every colour token, a poster, a title and a padlock', () => {
  const { theme } = VEYRA_BUNDLE;
  for (const key of THEME_COLOURS) expect(theme[key], key).toBeDefined();
  expect(theme.titleIcon).toBe('padlock');
  expect(theme.accent).toBe('#3fe0c5');
  expect(theme.pageTitle).toContain('Vault OS');
  // A bundle without one of them is refused by name.
  const { ink: _ink, ...bare } = theme;
  expect(refusal({ ...VEYRA_BUNDLE, theme: bare as never }).field).toBe('theme.ink');
});

test('no red anywhere in her world: the character, the place and the UI hold no red hue', () => {
  const red: string[] = [];
  const NOT_COLOUR = /(?:^|\.)(?:id|depth|headEffect|url|kind|piece|alt|src|pageTitle|titleIcon)$|\.pieces\[\d+\]$/;
  for (const [path, value] of [...strings(VEYRA, 'character'), ...strings(VEYRA_BUNDLE.place, 'place'), ...strings(VEYRA_BUNDLE.theme, 'theme')]) {
    if (NOT_COLOUR.test(path)) continue;
    // The peach blush and an open smile's dark maroon inside and pink tongue (as P3 paints them) are the
    // face's own warm accents (spec 7.3; ruling R-V8).
    if (/facePalette\.(?:blush|blushGlow|mouthInside|tongue)$/.test(path)) continue;
    if (isRed(value)) red.push(`${path}: ${value}`);
  }
  expect(red).toEqual([]);
});

test('the stage backdrop is a kit with one empty scene, the layout names no piece, and the camera is calmer than Nox\'s', () => {
  const { place } = VEYRA_BUNDLE;
  expect(place.kit.pieces).toEqual([]);
  expect(place.near).toBeUndefined();
  expect(place.farPlate).toBeUndefined();
  const { floorY, ...groups } = place.layout;
  expect(floorY).toBeLessThan(0);
  expect(Object.values(groups).flat()).toEqual([]);
  // Spec 7.7 and the plan: a lean of 0.04, and 0.8 and 0.75 of Nox's drift (his amount and pace are both 1).
  expect(place.camera).toEqual({ tilt: 0.04, hover: { amount: 0.8, pace: 0.75 } });
  // The glb the kit names exists, is a glTF 2 binary and holds one scene with no nodes, meshes or materials.
  expect(place.kit.url).toBe('/veyra/world/stage.glb');
  const data = readFileSync(join(ROOT, 'public', place.kit.url));
  expect(data.subarray(0, 4).toString()).toBe('glTF');
  expect(data.readUInt32LE(4)).toBe(2);
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8')) as Record<string, unknown>;
  expect(doc.scenes).toHaveLength(1);
  expect((doc.scenes as { nodes?: unknown[] }[])[0].nodes ?? []).toEqual([]);
  for (const group of ['nodes', 'meshes', 'materials', 'textures', 'animations']) expect(doc[group] ?? [], group).toEqual([]);
});

test('her artifacts have no places yet: no shells, nothing chosen in any stage (the pendants task adds them)', () => {
  expect(VEYRA_BUNDLE.artifacts.placement).toMatchObject({ kind: 'orbit', shells: [] });
  expect(VEYRA_BUNDLE.artifacts.choosableIn).toEqual([]);
});

test('the sequences are her own project, and the entrance placeholder holds her landed in the intro', () => {
  expect(VEYRA_BUNDLE.sequences.projectId).toBe('OctoVerse-Veyra');
  const { props, keys } = VEYRA_BUNDLE.sequences.defaults.entrance!.objects.main;
  expect(keys).toEqual({});
  expect(props).toMatchObject({ forward: 1, open: 1, settle: 1, reveal: 1, spin: 0 });
});

test('the poster the theme names exists in public/ as a webp of the size the theme says', () => {
  const { poster } = VEYRA_BUNDLE.theme;
  const data = readFileSync(join(ROOT, 'public', poster.src));
  expect(data.subarray(0, 4).toString()).toBe('RIFF');
  expect(data.subarray(8, 12).toString()).toBe('WEBP');
  expect([poster.width, poster.height]).toEqual([1536, 1024]);
});
