import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { pendantFixture } from '../artifacts/fixtures/pendant';
import { ARM_IDS, STAGE_IDS } from '../config/types';
import { dummyCharacter } from '../config/fixtures/dummy.character';
import { clampCharacterConfig } from '../config/validate';
import { dummyWorld } from '../world/fixtures/dummy.world';
import { BundleError, type WorldBundle, faceAnchor, faceOrigin, validateBundle } from './bundle';

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
  // A creator id is fine until it names a shipped world (the caller that knows the shipped ids passes them; the registry test does).
  expect(refusal({ ...NOX_BUNDLE, id: 'u-nox' }, ['nox', 'u-nox']).message).toMatch(/reserved for creator bundles/);
});

test('a number that is not finite is refused loudly, by field, where the clamp would quietly read a default', () => {
  const nan = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, armBend: Number.NaN } };
  expect(refusal(nan).field).toBe('character.armBend');
  const inf = { ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, camera: { ...NOX_BUNDLE.place.camera, tilt: Infinity } } };
  expect(refusal(inf).field).toBe('place.camera.tilt');
  const frame = { ...NOX_BUNDLE, stage: { ...NOX_BUNDLE.stage, frames: { ...NOX_BUNDLE.stage.frames, detail: { width: Number.NaN, height: 4 } } } };
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
  const kind = { ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, select: { kind: 'armLeft' } } };
  expect(refusal(kind as unknown as WorldBundle).field).toBe('artifacts.select.kind');
  const { bubbleBlow: _bubbleBlow, ...noBlow } = NOX_BUNDLE.sequences.defaults;
  expect(refusal({ ...NOX_BUNDLE, sequences: { ...NOX_BUNDLE.sequences, defaults: noBlow } }).field).toBe('sequences.defaults.bubbleBlow');
  const icon = { ...NOX_BUNDLE, theme: { ...NOX_BUNDLE.theme, titleIcon: 'moon' } };
  expect(refusal(icon as unknown as WorldBundle).field).toBe('theme.titleIcon');
  const world = { ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, layout: { ...NOX_BUNDLE.place.layout, groups: { ...NOX_BUNDLE.place.layout.groups, pillars: [{ piece: 'nope', position: [0, 0, 0] as const }] } } } };
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

test("the face anchor follows the pose's body scale: the face is drawn at body + scale x its origin", () => {
  // Octopus draws the character at body + scale * content (its float group is placed at the body and
  // scaled), so a stage pose with scale 1.5 carries the face 1.5 times as far from the body, the eye
  // line's 0.1 drop and the head's front with it.
  const scaled = { ...NOX_BUNDLE, poses: { ...NOX_BUNDLE.poses, overview: { ...NOX_BUNDLE.poses.overview, body: { x: -0.4, y: 0.25, scale: 1.5, yaw: 0 } } } };
  const { head } = NOX_BUNDLE.character;
  const [ox, oy] = head.faceOrigin;
  expect(faceOrigin(scaled, 'overview')[0]).toBeCloseTo(-0.4 + 1.5 * ox, 12);
  expect(faceOrigin(scaled, 'overview')[1]).toBeCloseTo(0.25 + 1.5 * oy, 12);
  const [x, y, z] = faceAnchor(scaled, 'overview');
  expect(x).toBeCloseTo(-0.4 + 1.5 * ox, 12);
  expect(y).toBeCloseTo(0.25 + 1.5 * (oy - 0.1), 12);
  expect(z).toBeCloseTo(1.5 * head.depth * head.halfWidth, 12);
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
    'sequences', 'sequences.defaults', 'theme', 'stage', 'stage.frames', 'stage.panels', 'stage.introTitle', 'content', 'content.project', 'content.technologies', 'poses.intro.body', 'poses.detail.body',
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

test('the parts of the place, the sequences project id and a pose body that a creator bundle may lack are BundleErrors naming the field', () => {
  for (const field of [
    'place.kit', 'place.kit.pieces', 'place.layout', 'place.layout.groups', 'place.layout.chains', 'place.layout.coralLights',
    'place.camera', 'place.camera.hover', 'place.post', 'place.post.contactShadow', 'place.post.bloom', 'place.post.vignette', 'place.relics', 'place.palette',
    'place.lights', 'place.lights.surface', 'place.lights.fill', 'place.lights.points', 'place.glow', 'place.water', 'place.water.colours', 'place.water.environment', 'place.palette.floorGlow', 'place.live', 'place.live.colours',
    'sequences.projectId', 'poses.intro.body.x', 'poses.intro.body.y', 'poses.overview.body.scale', 'poses.detail.body.yaw',
  ]) {
    expect(refusal(without(field)).field, field).toBe(field);
  }
  // Items of a list are objects too.
  const lights = copyOf(NOX_BUNDLE) as unknown as { place: { lights: { points: unknown[] }; layout: { groups: { pillars: unknown[] } } } };
  lights.place.lights.points[1] = null;
  expect(refusal(lights as unknown as WorldBundle).field).toBe('place.lights.points[1]');
  const pillars = copyOf(NOX_BUNDLE) as unknown as { place: { layout: { groups: { pillars: unknown[]; rocks: unknown } } } };
  pillars.place.layout.groups.pillars[0] = 7;
  expect(refusal(pillars as unknown as WorldBundle).field).toBe('place.layout.groups.pillars[0]');
  pillars.place.layout.groups.pillars.length = 0;
  pillars.place.layout.groups.rocks = 'none';
  expect(refusal(pillars as unknown as WorldBundle).field).toBe('place.layout.groups.rocks');
  // Wrong form, not just missing.
  expect(refusal({ ...NOX_BUNDLE, sequences: { ...NOX_BUNDLE.sequences, projectId: '' } }).field).toBe('sequences.projectId');
  expect(refusal({ ...NOX_BUNDLE, sequences: { ...NOX_BUNDLE.sequences, projectId: 7 as unknown as string } }).field).toBe('sequences.projectId');
  expect(refusal(withPoses(poses => ((poses.intro as { body?: unknown }).body = { x: 0, y: Number.NaN, scale: 1, yaw: 0 }))).field).toBe('poses.intro.body.y');
  expect(refusal(withPoses(poses => ((poses.intro as { body?: unknown }).body = { x: '0', y: 0, scale: 1, yaw: 0 }))).field).toBe('poses.intro.body.x');
});

test('a far plate with no cut, or a layer with no url, is refused by validateBundle (place), and one without a plate validates', () => {
  const plate = NOX_BUNDLE.place.farPlate!;
  const place = (farPlate: unknown) => ({ ...NOX_BUNDLE, place: { ...NOX_BUNDLE.place, farPlate } }) as WorldBundle;
  const error = refusal(place({ ...plate, cutZ: Number.NaN }));
  expect(error.field).toBe('place.farPlate.cutZ');
  expect(refusal(place({ ...plate, cutZ: undefined })).field).toBe('place');
  expect(refusal(place({ ...plate, layers: undefined })).field).toBe('place.farPlate.layers');
  expect(refusal(place({ cutZ: -5, layers: [{ url: '', z: -9 }] })).message).toContain('farPlate.layers[0] has no url');
  expect(refusal(place(7)).field).toBe('place.farPlate');
  expect(() => validateBundle(place(undefined))).not.toThrow();
});

test("the poster and the page title are the world's: a bundle without them, or with a poster that cannot be drawn, is refused by name", () => {
  const theme = (edit: object) => ({ ...NOX_BUNDLE, theme: { ...NOX_BUNDLE.theme, ...edit } }) as unknown as WorldBundle;
  expect(refusal(theme({ poster: undefined })).field).toBe('theme.poster');
  expect(refusal(theme({ poster: { ...NOX_BUNDLE.theme.poster, src: '' } })).field).toBe('theme.poster');
  expect(refusal(theme({ poster: { ...NOX_BUNDLE.theme.poster, alt: '' } })).field).toBe('theme.poster');
  expect(refusal(theme({ poster: { ...NOX_BUNDLE.theme.poster, width: 0 } })).field).toBe('theme.poster');
  expect(refusal(theme({ poster: { ...NOX_BUNDLE.theme.poster, height: Number.NaN } })).field).toBe('theme.poster');
  expect(refusal(theme({ pageTitle: undefined })).field).toBe('theme.pageTitle');
  expect(refusal(theme({ pageTitle: '' })).field).toBe('theme.pageTitle');
  // Nox's values, as the page held them before the bundle carried them.
  expect(NOX_BUNDLE.theme.poster).toEqual({ src: 'nox/poster-intro.webp', alt: 'Nox, the octopus guide to Security Lab, in the dark water of his lab', width: 1536, height: 1024 });
  expect(NOX_BUNDLE.theme.pageTitle).toBe('Nox · Security Lab');
});

test("the traced UI boxes are the world's own (stage.panels, stage.introTitle): Nox's values as they were, and a box that cannot place a panel is refused by name", () => {
  expect(NOX_BUNDLE.stage.panels).toEqual({ overview: [-1.22, 1.14, 1.33, 0.06], detail: [-0.57, 1.2425, 4.005, -1.8775] });
  expect(NOX_BUNDLE.stage.introTitle).toEqual({ halfWidth: 1.4, top: 1.55 });
  const stage = (edit: object) => ({ ...NOX_BUNDLE, stage: { ...NOX_BUNDLE.stage, ...edit } }) as unknown as WorldBundle;
  const panels = (edit: object) => stage({ panels: { ...NOX_BUNDLE.stage.panels, ...edit } });
  expect(refusal(panels({ overview: [0, 1, 2] })).field).toBe('stage.panels.overview');
  expect(refusal(panels({ detail: [0, 1, 2, Number.NaN] })).field).toBe('stage.panels.detail');
  expect(refusal(panels({ detail: ['0', 1, 2, 0] })).field).toBe('stage.panels.detail');
  // Left of right, and top above bottom.
  expect(refusal(panels({ overview: [2, 1, 1, 0] })).field).toBe('stage.panels.overview');
  expect(refusal(panels({ overview: [0, 0, 1, 1] })).field).toBe('stage.panels.overview');
  expect(refusal(stage({ introTitle: { halfWidth: 0, top: 1 } })).field).toBe('stage.introTitle');
  expect(refusal(stage({ introTitle: { halfWidth: 1, top: Number.POSITIVE_INFINITY } })).field).toBe('stage.introTitle');
});

test('a layout whose groups are not an object, or whose old top-level lists are left behind, is a BundleError naming the field', () => {
  for (const groups of ['pillars', 7, null, [], [{ piece: 'rock_0', position: [0, 0, 0] }]]) {
    const bundle = copyOf(NOX_BUNDLE) as unknown as { place: { layout: { groups: unknown } } };
    bundle.place.layout.groups = groups;
    expect(refusal(bundle as unknown as WorldBundle).field, JSON.stringify(groups)).toBe('place.layout.groups');
  }
});

test('a bundle whose world runs packets on a path validates: the path name is not read as a colour, the colours are', () => {
  const place = {
    ...NOX_BUNDLE.place,
    layout: { ...NOX_BUNDLE.place.layout, paths: { bridge: [[-4, 0, -4], [4, 0, -6]] as const } },
    live: { ...NOX_BUNDLE.place.live, elements: { packets: { path: 'bridge', count: { high: 8, medium: 4, low: 2 }, speed: 1, length: 0.4, colours: ['#4aa6d0', '#a0d8ff'] as const } } },
  };
  expect(validateBundle({ ...NOX_BUNDLE, place }).place.live.elements?.packets?.path).toBe('bridge');
  const typo = { ...place, live: { ...place.live, elements: { packets: { ...place.live.elements.packets, colours: ['#4aa6d0', 'bluish'] as const } } } };
  expect(refusal({ ...NOX_BUNDLE, place: typo }).field).toBe('place.live.elements.packets.colours[1]');
});

// --- The pendant placement (Veyra's) ------------------------------------------------------------

/** Nox's bundle with a pendant placement (the engine's fixture), `edit`ed. */
function withPendants(edit: (placement: Record<string, any>) => void = () => {}): WorldBundle {
  const placement = pendantFixture() as unknown as Record<string, any>;
  edit(placement);
  return { ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, placement: placement as never } };
}

test('a pendant placement validates, and each part of it is refused by name when wrong', () => {
  expect(() => validateBundle(withPendants())).not.toThrow();
  const field = (edit: (p: Record<string, any>) => void) => refusal(withPendants(edit)).field;
  expect(field(p => { p.slots.intro[0].arm = 'T9'; })).toBe('artifacts.placement.slots.intro[0].arm');
  expect(field(p => { p.slots.overview[2].at = 1.2; })).toBe('artifacts.placement.slots.overview[2].at');
  expect(field(p => { p.slots.overview[2].order = 0.5; })).toBe('artifacts.placement.slots.overview[2].order');
  expect(field(p => { p.slots.overview[3].order = p.slots.overview[0].order; })).toBe('artifacts.placement.slots.overview[3].order');
  expect(field(p => { delete p.slots.intro; })).toBe('artifacts.placement.slots.intro');
  expect(field(p => { p.sizes.overview = 0; })).toBe('artifacts.placement.sizes.overview');
  expect(field(p => { p.maxPerArm = 3; })).toBe('artifacts.placement.maxPerArm');
  expect(field(p => { p.tether.length = -0.1; })).toBe('artifacts.placement.tether.length');
  expect(field(p => { p.tether.width = 0; })).toBe('artifacts.placement.tether.width');
  expect(field(p => { p.tether.sag = 2; })).toBe('artifacts.placement.tether.sag');
  expect(field(p => { p.tether.color = 'cyanish'; })).toBe('artifacts.placement.tether.color');
  expect(field(p => { p.tether.cap = 3; })).toBe('artifacts.placement.tether.cap');
  expect(field(p => { p.swing = { maxAngle: 0, settle: 1 }; })).toBe('artifacts.placement.swing.maxAngle');
  expect(field(p => { p.swing = { maxAngle: 0.3, settle: 0 }; })).toBe('artifacts.placement.swing.settle');
  expect(field(p => { p.reveal = { start: -1, span: 1, step: 0.1 }; })).toBe('artifacts.placement.reveal.start');
  expect(field(p => { p.reveal = { start: 0, span: 0, step: 0.1 }; })).toBe('artifacts.placement.reveal.span');
  expect(field(p => { p.reveal = { start: 0, span: 1, step: -0.1 }; })).toBe('artifacts.placement.reveal.step');
});

test('a third pendant on one arm is refused', () => {
  const crowded = withPendants(p => {
    const arm = p.slots.overview[0].arm;
    p.slots.overview.push({ arm, at: 0.3, order: 40 }, { arm, at: 0.2, order: 41 });
  });
  expect(refusal(crowded).field).toMatch(/^artifacts\.placement\.slots\.overview\[\d+\]\.arm$/);
});

test('a swing and a reveal in range, a tether of length 0 and a slot table with no slots validate', () => {
  expect(() => validateBundle(withPendants(p => { p.swing = { maxAngle: (18 * Math.PI) / 180, settle: 0.8 }; p.reveal = { start: 0.2, span: 0.9, step: 0.1 }; }))).not.toThrow();
  expect(() => validateBundle(withPendants(p => { p.tether.length = 0; }))).not.toThrow();
  expect(() => validateBundle(withPendants(p => { p.slots.intro = []; }))).not.toThrow();
});

test("an orb style (rim beads and cap) is optional; given, its count, colours and cap size are checked by name", () => {
  const style = { rimBeads: 16, rimColour: '#e4d9f8', cap: { colour: '#d99982', size: 0.05 } };
  const withStyle = (orbStyle: unknown): WorldBundle => ({ ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, orbStyle } as WorldBundle['artifacts'] });
  expect(validateBundle(withStyle(style)).artifacts.orbStyle).toEqual(style);
  expect(validateBundle(withStyle({ ...style, rimBeads: 0, cap: null })).artifacts.orbStyle?.cap).toBeNull();
  expect(NOX_BUNDLE.artifacts.orbStyle).toBeUndefined();
  for (const [bad, field] of [
    [{ ...style, rimBeads: -1 }, 'artifacts.orbStyle.rimBeads'],
    [{ ...style, rimBeads: 2.5 }, 'artifacts.orbStyle.rimBeads'],
    [{ ...style, rimBeads: 65 }, 'artifacts.orbStyle.rimBeads'],
    [{ ...style, rimColour: 'not-a-colour' }, 'artifacts.orbStyle.rimColour'],
    [{ ...style, cap: { colour: '#zzzzzz', size: 0.05 } }, 'artifacts.orbStyle.cap.colour'],
    [{ ...style, cap: { colour: '#d99982', size: 0 } }, 'artifacts.orbStyle.cap.size'],
    [{ ...style, cap: undefined }, 'artifacts.orbStyle.cap'],
    ['gold', 'artifacts.orbStyle'],
  ] as const) expect(refusal(withStyle(bad)).field).toBe(field);
});

test("a satellite's active form (slots, sizes, tether, swing) is checked by name, all three or none", () => {
  const ring = { radius: 1.25, tilt: 1.36, roll: 0.14, centreY: -0.28, beadCount: 5, beadSize: 0.075, homes: [1.3, 2.2, 3.1, 4.1, 5], sway: { amplitude: 0.21, period: [6, 9] }, keepOut: Math.PI / 4, line: { color: '#d99982', width: 1.4, constellation: '#d99982', flicker: 0.5 }, beads: { glass: '#93699a', rim: '#d99982', lit: [1, 3] } };
  const slots = ARM_IDS.flatMap((arm, i) => [{ arm, at: 0.9, order: 2 * i }, { arm, at: 0.5, order: 2 * i + 1 }]);
  const active = { kind: 'satellite', ring, slots: { overview: slots }, sizes: { overview: 0.3 }, tether: { length: 0.16, color: '#d99982', width: 0.012, sag: 0.2, cap: '#d99982' } };
  const withPlacement = (placement: unknown): WorldBundle => ({ ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, placement } as WorldBundle['artifacts'] });
  expect(validateBundle(withPlacement(active)).artifacts.placement).toBe(active);
  // The ring alone (no active form) is a satellite too.
  expect(() => validateBundle(withPlacement({ kind: 'satellite', ring }))).not.toThrow();
  for (const [bad, field] of [
    [{ ...active, tether: undefined }, 'artifacts.placement.tether'],
    [{ ...active, sizes: { overview: 0 } }, 'artifacts.placement.sizes.overview'],
    [{ ...active, slots: { overview: [...slots, { arm: 'T1', at: 0.3, order: 16 }] } }, 'artifacts.placement.slots.overview[16].arm'],
    [{ ...active, slots: { overview: [{ arm: 'T9', at: 0.3, order: 0 }] } }, 'artifacts.placement.slots.overview[0].arm'],
    [{ ...active, tether: { ...active.tether, color: 'gold-ish' } }, 'artifacts.placement.tether.color'],
    [{ ...active, swing: { maxAngle: 0, settle: 1.4 } }, 'artifacts.placement.swing.maxAngle'],
  ] as const) expect(refusal(withPlacement(bad)).field).toBe(field);
});

// --- Task 19: the bloom and the arm lift (Veyra's appear and select) ---------------------------

/** Nox's bundle with a pendant placement, the bloom and the arm lift, and a bloom sheet; `edit`ed. */
function withBloomLift(edit: (artifacts: Record<string, any>, defaults: Record<string, unknown>) => void = () => {}): WorldBundle {
  const artifacts: Record<string, any> = {
    ...NOX_BUNDLE.artifacts,
    placement: pendantFixture(),
    appear: { kind: 'bloom', duration: 1.2 },
    select: { kind: 'armLift', ease: 0.45, scale: 1.25, threadShorten: 0.3 },
  };
  const defaults: Record<string, unknown> = { ...NOX_BUNDLE.sequences.defaults, bloom: { length: 1.2, objects: { main: { props: { ripple: 0 }, keys: { ripple: [[0, 0], [1.2, 1]] } } } } };
  edit(artifacts, defaults);
  return { ...NOX_BUNDLE, artifacts: artifacts as never, sequences: { ...NOX_BUNDLE.sequences, defaults: defaults as never } };
}

test('the bloom and the arm lift validate with their parameters and the bloom sheet', () => {
  expect(() => validateBundle(withBloomLift())).not.toThrow();
  expect(() => validateBundle(withBloomLift(a => { a.select = { kind: 'armLift', ease: 0.2, scale: 1, threadShorten: 0 }; }))).not.toThrow();
});

test('the bloom and the arm lift are refused by field name when a parameter is out of range', () => {
  const field = (edit: (a: Record<string, any>, d: Record<string, unknown>) => void) => refusal(withBloomLift(edit)).field;
  expect(field(a => { a.appear.duration = 0; })).toBe('artifacts.appear.duration');
  expect(field(a => { a.appear.duration = Number.NaN; })).toBe('artifacts.appear.duration');
  expect(field(a => { delete a.appear.duration; })).toBe('artifacts.appear.duration');
  expect(field(a => { a.select.ease = 0; })).toBe('artifacts.select.ease');
  expect(field(a => { a.select.ease = 3; })).toBe('artifacts.select.ease');
  expect(field(a => { a.select.scale = 0.9; })).toBe('artifacts.select.scale');
  expect(field(a => { a.select.scale = 2.5; })).toBe('artifacts.select.scale');
  expect(field(a => { a.select.threadShorten = -0.1; })).toBe('artifacts.select.threadShorten');
  expect(field(a => { a.select.threadShorten = 1; })).toBe('artifacts.select.threadShorten');
  expect(field(a => { delete a.select.scale; })).toBe('artifacts.select.scale');
});

test('a bloom needs its sheet, and the bloom and the arm lift need a placement that hangs pendants', () => {
  expect(refusal(withBloomLift((_, d) => { delete d.bloom; })).field).toBe('sequences.defaults.bloom');
  expect(refusal(withBloomLift(a => { a.placement = NOX_BUNDLE.artifacts.placement; a.select = { kind: 'suctionHold' }; })).field).toBe('artifacts.appear.kind');
  expect(refusal(withBloomLift(a => { a.placement = NOX_BUNDLE.artifacts.placement; a.appear = { kind: 'blow' }; })).field).toBe('artifacts.select.kind');
  // Nox's set (no bloom sheet) stays valid: he blows.
  expect(() => validateBundle(NOX_BUNDLE)).not.toThrow();
  expect('bloom' in NOX_BUNDLE.sequences.defaults).toBe(false);
});

// --- The twinkle (Aether's appear): the ring forms --------------------------------------------

/** Nox's bundle with a ring-only satellite placement, the twinkle and a twinkle sheet; `edit`ed. */
function withTwinkle(edit: (artifacts: Record<string, any>, defaults: Record<string, unknown>) => void = () => {}): WorldBundle {
  const ring = { radius: 1.25, tilt: 1.36, roll: 0.14, centreY: -0.28, beadCount: 5, beadSize: 0.075, homes: [1.3, 2.2, 3.1, 4.1, 5], sway: { amplitude: 0.21, period: [6, 9] }, keepOut: Math.PI / 4, line: { color: '#d99982', width: 1.4, constellation: '#d99982', flicker: 0.5 }, beads: { glass: '#93699a', rim: '#d99982', lit: [1, 3] } };
  const artifacts: Record<string, any> = { ...NOX_BUNDLE.artifacts, placement: { kind: 'satellite', ring }, appear: { kind: 'twinkle', duration: 1.4 } };
  const defaults: Record<string, unknown> = { ...NOX_BUNDLE.sequences.defaults, twinkle: { length: 1.4, objects: { main: { props: { clock: 0 }, keys: { clock: [[0, 0], [1.4, 1]] } } } } };
  edit(artifacts, defaults);
  return { ...NOX_BUNDLE, artifacts: artifacts as never, sequences: { ...NOX_BUNDLE.sequences, defaults: defaults as never } };
}

test('the twinkle validates with its duration and its sheet, and needs the satellite placement', () => {
  expect(() => validateBundle(withTwinkle())).not.toThrow();
  expect(refusal(withTwinkle(a => { a.placement = NOX_BUNDLE.artifacts.placement; })).field).toBe('artifacts.appear.kind');
  for (const duration of [0, -1, 11, Number.NaN]) expect(refusal(withTwinkle(a => { a.appear.duration = duration; })).field, String(duration)).toBe('artifacts.appear.duration');
  expect(refusal(withTwinkle(a => { delete a.appear.duration; })).field).toBe('artifacts.appear.duration');
});

test('a bundle that names the twinkle without a twinkle sheet is refused, naming the sheet', () => {
  const refused = refusal(withTwinkle((_, d) => { delete d.twinkle; }));
  expect(refused.field).toBe('sequences.defaults.twinkle');
  expect(refused.message).toContain('twinkle');
  // Nox and Veyra's own sets name no twinkle and have none.
  expect('twinkle' in NOX_BUNDLE.sequences.defaults).toBe(false);
});

// --- Task 16: the personality's motion variants (engine contract 14.1) -------------------------

/** Nox's bundle with these personality fields. */
const withPersonality = (fields: Record<string, unknown>) => ({ ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, personality: { ...NOX_BUNDLE.character.personality, ...fields } } }) as WorldBundle;

test('settle, glideBias and flourishRate validate unset (Nox) and in range, and the clamp keeps them', () => {
  expect(validateBundle(NOX_BUNDLE).character.personality.settle).toBeUndefined();
  const calm = validateBundle(withPersonality({ settle: 0.6, glideBias: 1.6, flourishRate: 4 })).character.personality;
  expect([calm.settle, calm.glideBias, calm.flourishRate]).toEqual([0.6, 1.6, 4]);
  for (const fields of [{ settle: 0 }, { settle: 1 }, { flourishRate: 0 }, { glideBias: 0.01 }]) expect(() => validateBundle(withPersonality(fields))).not.toThrow();
});

test('settle outside 0 to 1, or not a finite number, is refused by name', () => {
  for (const settle of [-0.1, 1.2, Number.NaN, Infinity, '0.6']) expect(refusal(withPersonality({ settle })).field, String(settle)).toBe('character.personality.settle');
});

test('glideBias at or below 0, or not a finite number, is refused by name', () => {
  for (const glideBias of [0, -1, Number.NaN, Infinity, null]) expect(refusal(withPersonality({ glideBias })).field, String(glideBias)).toBe('character.personality.glideBias');
});

test('flourishRate below 0, or not a finite number, is refused by name', () => {
  for (const flourishRate of [-1, -0.001, Number.NaN, Infinity, '4']) expect(refusal(withPersonality({ flourishRate })).field, String(flourishRate)).toBe('character.personality.flourishRate');
});

// --- Task 15: idle tilt and look points ---------------------------------------------------------

test('idleTilt validates unset (Nox, Veyra) and in range, and the clamp keeps it', () => {
  expect(validateBundle(NOX_BUNDLE).character.personality.idleTilt).toBeUndefined();
  const tilt = validateBundle(withPersonality({ idleTilt: { amplitude: 0.105, period: [5, 9] } })).character.personality.idleTilt;
  expect(tilt).toEqual({ amplitude: 0.105, period: [5, 9] });
  for (const idleTilt of [{ amplitude: 0, period: [5, 9] }, { amplitude: 0.1, period: [5, 5] }]) expect(() => validateBundle(withPersonality({ idleTilt }))).not.toThrow();
});

test('the clamp holds idleTilt in range (a head tilt of at most 0.35 rad, a period of at least 4.5 s so tilts never overlap)', () => {
  const held = clampCharacterConfig({ ...NOX_BUNDLE.character, personality: { ...NOX_BUNDLE.character.personality, idleTilt: { amplitude: 3, period: [0.1, 9000] } } }).personality.idleTilt!;
  expect(held.amplitude).toBe(0.35);
  expect(held.period[0]).toBeGreaterThanOrEqual(4.5);
  expect(held.period[1]).toBeGreaterThanOrEqual(held.period[0]);
  expect(clampCharacterConfig(NOX_BUNDLE.character).personality.idleTilt).toBeUndefined();
});

test('idleTilt that is not { amplitude 0 or more, period [low, high] above 0 } is refused by name', () => {
  const bad: unknown[] = [
    null,
    5,
    {},
    { amplitude: -0.1, period: [5, 9] },
    { amplitude: Number.NaN, period: [5, 9] },
    { amplitude: Infinity, period: [5, 9] },
    { amplitude: '0.1', period: [5, 9] },
  ];
  for (const idleTilt of bad) expect(refusal(withPersonality({ idleTilt })).field, JSON.stringify(idleTilt)).toMatch(/^character\.personality\.idleTilt(\.amplitude)?$/);
  expect(refusal(withPersonality({ idleTilt: { amplitude: -0.1, period: [5, 9] } })).field).toBe('character.personality.idleTilt.amplitude');
  const periods: unknown[] = [undefined, 5, [5], [5, 9, 12], [9, 5], [0, 5], [-1, 5], [5, 0], [Number.NaN, 5], [5, Infinity], ['5', 9]];
  for (const period of periods) expect(refusal(withPersonality({ idleTilt: { amplitude: 0.1, period } })).field, JSON.stringify(period)).toMatch(/^character\.personality\.idleTilt\.period(\[\d\])?$/);
});

/** Nox's bundle with this on the intro pose. */
const withLookPoints = (lookPoints: unknown) => withPoses(poses => Object.assign(poses.intro, { lookPoints }));

test('lookPoints validate unset and as finite points, and an empty list is none', () => {
  expect(() => validateBundle(NOX_BUNDLE)).not.toThrow();
  expect(() => validateBundle(withLookPoints([[-1, 0.2], [1.2, 0.4]]))).not.toThrow();
  expect(() => validateBundle(withLookPoints([]))).not.toThrow();
});

test('lookPoints that are not a list of [x, y] finite points are refused by name', () => {
  for (const lookPoints of [5, {}, 'a', [5], [[1]], [[1, 2, 3]], [[1, Number.NaN]], [[Infinity, 0]], [['1', 0]], [[0, 0], null]]) {
    expect(refusal(withLookPoints(lookPoints)).field, JSON.stringify(lookPoints)).toBe('poses.intro.lookPoints');
  }
});

// --- The entrance's shape (Task 17, gap G2): one test per field, by name ---------------------------

/** Nox with his entrance shape replaced (cast: the point is what the type does not stop). */
const withEntrance = (entrance: unknown): WorldBundle => ({ ...NOX_BUNDLE, sequences: { ...NOX_BUNDLE.sequences, entrance: entrance as WorldBundle['sequences']['entrance'] } });
const NOX_SHAPE = NOX_BUNDLE.sequences.entrance;

test('the entrance shape: Nox states a full turn on the spiral, and a glide-turn of 200 degrees is a shape too', () => {
  expect(NOX_SHAPE).toMatchObject({ turn: 2 * Math.PI, spiral: true });
  expect(() => validateBundle(NOX_BUNDLE)).not.toThrow();
  expect(() => validateBundle(withEntrance({ turn: (200 * Math.PI) / 180, spiral: false }))).not.toThrow();
  // The smallest turn above 0 and the full turn both pass.
  expect(() => validateBundle(withEntrance({ turn: 1e-6, spiral: false }))).not.toThrow();
  expect(() => validateBundle(withEntrance({ turn: 2 * Math.PI, spiral: false }))).not.toThrow();
});

test('sequences.entrance missing is refused by name', () => {
  for (const entrance of [undefined, null, 5]) expect(refusal(withEntrance(entrance)).field, String(entrance)).toBe('sequences.entrance');
});

test('sequences.entrance.turn must be finite, above 0 and at most a full turn', () => {
  for (const turn of [0, -1, -0.001, 2 * Math.PI + 0.001, 7, Number.NaN, Infinity, -Infinity, '3', undefined]) {
    expect(refusal(withEntrance({ ...NOX_SHAPE, turn })).field, String(turn)).toBe('sequences.entrance.turn');
    expect(refusal(withEntrance({ turn, spiral: false })).field, String(turn)).toBe('sequences.entrance.turn');
  }
});

test('sequences.entrance.spiral must be a boolean', () => {
  for (const spiral of [undefined, null, 1, 0, 'true', 'false']) expect(refusal(withEntrance({ ...NOX_SHAPE, spiral })).field, String(spiral)).toBe('sequences.entrance.spiral');
});

test('sequences.entrance.arc: a spiral needs its start (r0 above 0, a finite phase); a glide-turn needs none', () => {
  expect(refusal(withEntrance({ turn: 2 * Math.PI, spiral: true })).field).toBe('sequences.entrance.arc');
  for (const r0 of [0, -1, Number.NaN, Infinity, '1']) expect(refusal(withEntrance({ ...NOX_SHAPE, arc: { r0, phase: 0 } })).field, String(r0)).toBe('sequences.entrance.arc.r0');
  for (const phase of [Number.NaN, Infinity, '0']) expect(refusal(withEntrance({ ...NOX_SHAPE, arc: { r0: 1, phase } })).field, String(phase)).toBe('sequences.entrance.arc.phase');
  expect(() => validateBundle(withEntrance({ turn: Math.PI, spiral: false }))).not.toThrow();
});

// --- The kit props the entrance drives (Task 18) --------------------------------------------------

const withKitDrives = (kitDrives: unknown, props?: WorldBundle['place']['props']): WorldBundle => ({
  ...NOX_BUNDLE,
  place: { ...NOX_BUNDLE.place, props: props ?? [{ id: 'lockRing', node: NOX_BUNDLE.place.kit.pieces[0], drive: 'rotateZ' }] },
  sequences: { ...NOX_BUNDLE.sequences, kitDrives: kitDrives as Record<string, string> },
});

test('sequences.kitDrives: each key a prop of the place, each value a prop of the entrance sheet; Nox has none', () => {
  expect(NOX_BUNDLE.sequences.kitDrives).toBeUndefined();
  expect(() => validateBundle(NOX_BUNDLE)).not.toThrow();
  expect(() => validateBundle(withKitDrives({ lockRing: 'spin' }))).not.toThrow();
  expect(() => validateBundle(withKitDrives({}))).not.toThrow();
});

test('sequences.kitDrives naming a prop the place lacks, or a sheet prop the entrance lacks, is refused by name', () => {
  expect(refusal(withKitDrives({ ghost: 'spin' })).field).toBe('sequences.kitDrives.ghost');
  expect(refusal(withKitDrives({ lockRing: 'nothing' })).field).toBe('sequences.kitDrives.lockRing');
  expect(refusal(withKitDrives(5)).field).toBe('sequences.kitDrives');
});
