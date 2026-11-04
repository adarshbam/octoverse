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
  const kind = { ...NOX_BUNDLE, artifacts: { ...NOX_BUNDLE.artifacts, select: { kind: 'armLift' } } };
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
