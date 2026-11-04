import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { ARM_IDS, STAGE_IDS } from '../config/types';
import { dummyCharacter } from '../config/fixtures/dummy.character';
import { clampCharacterConfig } from '../config/validate';
import { dummyWorld } from '../world/fixtures/dummy.world';
import { BundleError, WORLDS, type WorldBundle, faceAnchor, faceOrigin, validateBundle } from './bundle';

/** A copy of Nox's bundle whose `poses` can be edited without touching his. */
function withPoses(edit: (poses: Record<string, { arms: Record<string, unknown> }>) => void): WorldBundle {
  const poses = Object.fromEntries(Object.entries(NOX_BUNDLE.poses).map(([stage, pose]) => [stage, { ...pose, arms: { ...pose.arms } }]));
  edit(poses as never);
  return { ...NOX_BUNDLE, poses: poses as WorldBundle['poses'] };
}

/** The error validateBundle throws for `bundle` (the test fails if it throws none). */
function refusal(bundle: WorldBundle, worlds?: readonly string[]): BundleError {
  try {
    validateBundle(bundle, worlds);
  } catch (error) {
    expect(error).toBeInstanceOf(BundleError);
    return error as BundleError;
  }
  throw new Error('validateBundle passed a bundle it should refuse');
}

test("Nox's bundle validates, with his character clamped and the rest as given", () => {
  const valid = validateBundle(NOX_BUNDLE);
  expect(valid.character).toEqual(clampCharacterConfig(NOX_BUNDLE.character));
  expect(valid.poses).toBe(NOX_BUNDLE.poses);
  expect(valid.place).toBe(NOX_BUNDLE.place);
  expect(valid.swim).toBe(NOX_BUNDLE.swim);
  // Validating a validated bundle changes nothing.
  expect(validateBundle(valid).character).toEqual(valid.character);
});

test("the dummy variant (?variant=dummy), made over Nox's bundle as the page makes it, validates too", () => {
  const dummy = { ...NOX_BUNDLE, character: dummyCharacter(NOX_BUNDLE.character), place: dummyWorld(NOX_BUNDLE.place) };
  expect(validateBundle(dummy).character.id).toBe('dummy');
});

test('a pose missing an arm is refused, naming the stage and the arm', () => {
  const error = refusal(withPoses(poses => delete poses.intro.arms.T8));
  expect(error.message).toContain('T8');
  expect(error.field).toBe('poses.intro.arms');
});

test('a pose with a ninth arm is refused, naming it', () => {
  const error = refusal(withPoses(poses => (poses.overview.arms.T9 = poses.overview.arms.T1)));
  expect(error.message).toContain('T9');
  expect(error.field).toBe('poses.overview.arms');
});

test('every stage needs a pose', () => {
  for (const stage of STAGE_IDS) {
    const error = refusal(withPoses(poses => delete poses[stage]));
    expect(error.field).toBe(`poses.${stage}`);
  }
  expect(ARM_IDS).toHaveLength(8);
});

test('the id is checked: its form, and the creator prefix that no shipped world may use', () => {
  for (const id of ['', 'n', 'Nox', '1nox', 'nox_3d', `n${'o'.repeat(32)}`, 'nox world']) expect(refusal({ ...NOX_BUNDLE, id }).field, id).toBe('id');
  for (const id of ['nox', 'veyra', 'u-adarsh', 'a1', `n${'o'.repeat(31)}`]) expect(() => validateBundle({ ...NOX_BUNDLE, id }), id).not.toThrow();
  // A creator id is fine until it names a shipped world.
  expect(refusal({ ...NOX_BUNDLE, id: 'u-nox' }, [...WORLDS, 'u-nox']).message).toMatch(/reserved for creator bundles/);
  expect(WORLDS.filter(id => id.startsWith('u-'))).toEqual([]);
});

test('a number that is not finite is refused loudly, by field, where the clamp would quietly read a default', () => {
  const nan = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, armBend: Number.NaN } };
  expect(refusal(nan).field).toBe('character.armBend');
  const inf = { ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, camera: { ...NOX_BUNDLE.place.camera, tilt: Infinity } } };
  expect(refusal(inf).field).toBe('place.camera.tilt');
  const frame = { ...NOX_BUNDLE, stage: { frames: { ...NOX_BUNDLE.stage.frames, detail: { width: Number.NaN, height: 4 } } } };
  expect(refusal(frame).field).toBe('stage.frames.detail');
  const key = { ...NOX_BUNDLE, sequences: { ...NOX_BUNDLE.sequences, entrance: { ...NOX_BUNDLE.sequences.entrance, turn: Number.NaN } } };
  expect(refusal(key).field).toBe('sequences.entrance.turn');
  const pose = withPoses(poses => (poses.detail.arms.T3 = [[0, Number.NaN]]));
  expect(refusal(pose).field).toBe('poses.detail.arms.T3[0][1]');
});

test('a colour three cannot read is refused loudly, naming the field', () => {
  const palette = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, palette: { ...NOX_BUNDLE.character.palette, belly: 'reddish' } } };
  expect(refusal(palette)).toMatchObject({ field: 'character.palette.belly', message: expect.stringContaining('reddish') });
  const face = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, facePalette: { ...NOX_BUNDLE.character.facePalette, iris: ['#1c0003', '#5c010f', '#f5241cff'] as const } } };
  expect(refusal(face as WorldBundle).field).toBe('character.facePalette.iris[2]');
  const light = { ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, lights: { ...NOX_BUNDLE.place.lights, fill: { ...NOX_BUNDLE.place.lights.fill, color: 'rgb(1 2 3)' } } } };
  expect(refusal(light).field).toBe('place.lights.fill.color');
  const theme = { ...NOX_BUNDLE, theme: { ...NOX_BUNDLE.theme, accent: 'oklch(0.6 0.2 20)' } };
  expect(refusal(theme).field).toBe('theme.accent');
  const accent = { ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, skinAccent: 'color(srgb-linear 1 2)' } };
  expect(refusal(accent).field).toBe('place.skinAccent');
  // Every colour form three reads passes: names, rgb() and hsl() too.
  const named = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, palette: { ...NOX_BUNDLE.character.palette, belly: 'crimson', wet: 'rgb(80, 48, 224)', sky: 'hsl(234, 55%, 51%)' } } };
  expect(() => validateBundle(named)).not.toThrow();
});

test("every string in Nox's character and place is a colour or a field known not to be one", () => {
  // validateBundle checks every other string as a colour: Nox's validating is this, and a new
  // string field that is not a colour must be named in NOT_COLOUR before any bundle validates.
  const strings: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') strings.push(path);
    else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
  };
  walk(NOX_BUNDLE.character, 'character');
  walk(NOX_BUNDLE.place, 'place');
  const notColour = strings.filter(path => /(?:^|\.)(?:id|depth|headEffect|url|kind|piece)$|\.pieces\[\d+\]$/.test(path));
  expect(new Set(notColour.map(path => path.replace(/\[\d+\]/g, '[]').replace(/^.*\./, '')))).toEqual(new Set(['id', 'depth', 'headEffect', 'url', 'kind', 'piece', 'pieces[]']));
  expect(strings.length - notColour.length).toBeGreaterThan(90);
  expect(() => validateBundle(NOX_BUNDLE)).not.toThrow();
});

test('the artifact kinds, the sheets they play, the title icon, the world and the project are checked', () => {
  const kind = { ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, select: { kind: 'armLift' } } };
  expect(refusal(kind as unknown as WorldBundle).field).toBe('artifacts.select.kind');
  const { bubbleBlow: _bubbleBlow, ...noBlow } = NOX_BUNDLE.sequences.defaults;
  expect(refusal({ ...NOX_BUNDLE, sequences: { ...NOX_BUNDLE.sequences, defaults: noBlow } }).field).toBe('sequences.defaults.bubbleBlow');
  const icon = { ...NOX_BUNDLE, theme: { ...NOX_BUNDLE.theme, titleIcon: 'moon' } };
  expect(refusal(icon as unknown as WorldBundle).field).toBe('theme.titleIcon');
  const world = { ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, layout: { ...NOX_BUNDLE.place.layout, pillars: [{ piece: 'nope', position: [0, 0, 0] as const }] } } };
  expect(refusal(world).field).toBe('place');
  const project = { ...NOX_BUNDLE, content: { ...NOX_BUNDLE.content, technologies: [] } };
  expect(refusal(project).field).toBe('content.project');
  const arms = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, arms: NOX_BUNDLE.character.arms.slice(1) } };
  expect(refusal(arms).field).toBe('character.arms');
});

test("the face anchor is the old one for Nox in each stage (hard-coded from the code it replaced)", () => {
  // noxFaceAnchor (stage/liveAnchors.ts) and OrbButtons' copy of it, as they computed these.
  expect(faceAnchor(NOX_BUNDLE, 'intro')).toEqual([0.035, -0.52, 0.61664]);
  expect(faceAnchor(NOX_BUNDLE, 'overview')).toEqual([0.065, -0.167, 0.61664]);
  expect(faceAnchor(NOX_BUNDLE, 'detail')).toEqual([-1.874, 0.016000000000000042, 0.61664]);
  // Bit for bit as the old sums: body + origin, then the 0.1 drop.
  for (const stage of ['intro', 'overview', 'detail'] as const) {
    const { body } = NOX_BUNDLE.poses[stage];
    const [ox, oy] = NOX_BUNDLE.character.head.faceOrigin;
    expect(faceAnchor(NOX_BUNDLE, stage)).toEqual([body.x + ox, body.y + oy - 0.1, NOX_BUNDLE.character.head.depth * NOX_BUNDLE.character.head.halfWidth]);
    expect(faceOrigin(NOX_BUNDLE, stage)).toEqual([body.x + ox, body.y + oy]);
  }
});

test("the face anchor is per character: another head or another pose moves it", () => {
  const head = { ...NOX_BUNDLE.character.head, faceOrigin: [0.5, 0.25] as const };
  const moved = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, head } };
  const { body } = NOX_BUNDLE.poses.intro;
  expect(faceAnchor(moved, 'intro')).toEqual([body.x + 0.5, body.y + 0.25 - 0.1, head.depth * head.halfWidth]);
});

/** A deep copy of plain data (functions, like the sequences' state loader, are shared). */
const copyOf = <T,>(value: T): T => (Array.isArray(value) ? (value.map(copyOf) as T) : value && typeof value === 'object' ? (Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copyOf(v)])) as T) : value);

/** A copy of Nox's bundle with the part at `path` removed (a bundle made by hand, or a creator's, may lack it). */
function without(path: string): WorldBundle {
  const copy = copyOf(NOX_BUNDLE) as unknown as Record<string, unknown>;
  const keys = path.split('.');
  let at = copy;
  for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>;
  delete at[keys[keys.length - 1]];
  return copy as unknown as WorldBundle;
}

test('a part the bundle needs but lacks is a BundleError naming its field, not a TypeError', () => {
  for (const field of [
    'character', 'character.head', 'place', 'poses', 'swim', 'artifacts', 'artifacts.placement', 'artifacts.appear', 'artifacts.select', 'artifacts.choosableIn',
    'sequences', 'sequences.defaults', 'theme', 'stage', 'stage.frames', 'content', 'content.project', 'content.technologies', 'poses.intro.body', 'poses.detail.body',
  ]) {
    expect(refusal(without(field)).field, field).toBe(field);
  }
  // A stage's frame missing is named by that stage.
  expect(refusal(without('stage.frames.overview')).field).toBe('stage.frames.overview');
  // A part of the wrong form is refused the same way.
  expect(refusal({ ...NOX_BUNDLE, theme: 'dark' } as unknown as WorldBundle).field).toBe('theme');
  expect(refusal({ ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, choosableIn: 'overview' } } as unknown as WorldBundle).field).toBe('artifacts.choosableIn');
});

test('an arm list that is not exactly T1..T8 in order is named character.arms; any other fault in the clamp is named for the character, not the arms', () => {
  const swapped = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, arms: [NOX_BUNDLE.character.arms[1], NOX_BUNDLE.character.arms[0], ...NOX_BUNDLE.character.arms.slice(2)] } };
  expect(refusal(swapped).field).toBe('character.arms');
  // A character the clamp cannot read (its skin is gone): the error is about the character, and says what threw.
  const skinless = copyOf(NOX_BUNDLE) as unknown as { character: Record<string, unknown> };
  delete skinless.character.skin;
  const error = refusal(skinless as unknown as WorldBundle);
  expect(error.field).toBe('character');
  expect(error.message).toMatch(/WorldBundle character:/);
});
