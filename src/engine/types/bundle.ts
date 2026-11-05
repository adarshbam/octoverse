import { APPEARS, PLACEMENTS, SELECTS } from '../artifacts/strategies';
import { MAX_PER_ARM } from '../artifacts/pendant';
import { ARM_IDS, type ArtifactConfig, CHOOSING_STAGES, type CharacterConfig, type PendantPlacement, SKIN_MODES, STAGE_IDS, type SatellitePlacement, type StageId, isChoosingStage } from '../config/types';
import { clampCharacterConfig } from '../config/validate';
import type { Project, Technology } from '../content/projectTypes';
import { validateProject } from '../content/validateProject';
import type { StagePose, SwimPoseSet } from '../poses/types';
import type { SequenceSet } from '../sequences/keys';
import type { IntroTitleBox, StageFrame, StagePanels } from '../stage/framing';
import { THEME_COLOURS, type UiTheme } from '../ui/theme';
import { TITLE_ICONS } from '../ui/titleIcons';
import { isColour, isWorldColour } from '../world/colour';
import type { Vec3, WorldConfig } from '../world/types';
import { validateWorld } from '../world/validateWorld';

// A world as one value (spec 6.2, trimmed to what E02 builds, spec 14.1): the character, its
// poses and swim, its artifacts and sequences, the place, the stage's framing, the content and the
// UI theme. The host (host/WorldHost.tsx) reads only this and the page's options; nothing in the
// engine imports a world's files.

/**
 * A world's id: lower case letters, digits and hyphens, starting with a letter, 2 to 32 long. The
 * `u-` prefix is reserved for creator bundles (amendment A2, P4): no shipped world uses it (the
 * engine does not list the shipped worlds: the registry's test, src/worlds/index.test.ts, holds the rule
 * against the registry's own ids).
 */
export type WorldId = string;

const WORLD_ID = /^[a-z][a-z0-9-]{1,31}$/;
const CREATOR_PREFIX = 'u-';

export interface WorldBundle {
  id: WorldId;
  character: CharacterConfig;
  /** One pose per stage, each with exactly the eight arms (validateBundle checks both). */
  poses: Record<StageId, StagePose>;
  swim: SwimPoseSet;
  artifacts: ArtifactConfig;
  sequences: SequenceSet;
  place: WorldConfig;
  /**
   * What each stage frames (stage/framing.ts `fovFor`), where the overview's and the detail's HTML
   * panels sit in world units, and the intro title's box: all traced from the world's own storyboard
   * (they are placed on the 3D scene, so they belong with its framing, not with the theme's colours).
   */
  stage: { frames: Record<StageId, StageFrame>; panels: StagePanels; introTitle: IntroTitleBox };
  content: { project: Project; technologies: readonly Technology[] };
  theme: UiTheme;
}

/** A bundle that is not a world the engine can draw: `field` names the part that is wrong. */
export class BundleError extends Error {
  /** The bundle field that is wrong, as a path (`poses.intro.arms`, `theme.accent`). */
  readonly field: string;

  constructor(field: string, problem: string) {
    super(`WorldBundle ${field}: ${problem}`);
    this.name = 'BundleError';
    this.field = field;
  }
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The string fields of the character and the place that are not colours: ids, the arms' depth
 * layer, the head effect, file urls, kinds, the kit's piece names, and the path a packets element runs on. Every other string in them
 * is a colour and must parse (`isColour`): a field added later is checked as one until it is named
 * here, so a colour three would draw black never passes unnoticed. The fields WORLD_COLOUR names
 * have the world's grammar (world/colour.ts `isWorldColour`).
 */
const NOT_COLOUR = /(?:^|\.)(?:id|depth|headEffect|url|kind|piece|mode|node|drive|material)$|\.(?:pieces|nodes)\[\d+\]$|\.elements\.packets\.path$/;

/**
 * The colour fields that may hold an amount of light 8-bit hex cannot say, `color(srgb-linear r g
 * b)` (world/colour.ts `isWorldColour`): the skin accent and the colours a shader compiles in.
 */
const WORLD_COLOUR = /\.skinAccent$|\.floorGlow\.[a-zA-Z]+$|^character\.palette\.(?:rimHot|domeRimHot|suckerSpecular|orbGlass\.[a-zA-Z]+)$/;

/** Every number in `value` is finite and every colour parses, or a BundleError names the field. */
function checkLeaves(value: unknown, path: string, colours: boolean) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BundleError(path, `${value} is not a finite number`);
  } else if (typeof value === 'string') {
    if (!colours || NOT_COLOUR.test(path)) return;
    const ok = WORLD_COLOUR.test(path) ? isWorldColour(value) : isColour(value);
    if (!ok) throw new BundleError(path, `"${value}" is not a colour three can read`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => checkLeaves(item, `${path}[${i}]`, colours));
  } else if (record(value)) {
    for (const [key, item] of Object.entries(value)) checkLeaves(item, `${path}.${key}`, colours);
  }
}

/** The parts of the place (`WorldConfig`) that validateWorld and the host read without a guard of their own: each is there, as an object or a list, or a BundleError names it. */
function checkPlacePresent(place: WorldBundle['place'], need: (field: string, value: unknown, what?: string) => void) {
  const parts = place as unknown as Record<string, unknown>;
  for (const part of ['kit', 'layout', 'camera', 'post', 'relics', 'palette', 'lights', 'glow', 'water', 'live']) need(`place.${part}`, parts[part]);
  const list = (field: string, value: unknown) => {
    if (!Array.isArray(value)) throw new BundleError(field, 'is missing (a list is needed here)');
  };
  list('place.kit.pieces', place.kit.pieces);
  for (const part of ['chains', 'coralLights'] as const) list(`place.layout.${part}`, place.layout[part]);
  need('place.layout.groups', place.layout.groups);
  for (const [group, placements] of Object.entries(place.layout.groups)) list(`place.layout.groups.${group}`, placements);
  need('place.camera.hover', place.camera.hover);
  need('place.water.colours', place.water.colours);
  need('place.water.environment', place.water.environment);
  need('place.palette.floorGlow', place.palette.floorGlow);
  need('place.live.colours', place.live.colours);
  for (const part of ['contactShadow', 'bloom', 'vignette'] as const) need(`place.post.${part}`, place.post[part]);
  need('place.lights.surface', place.lights.surface);
  need('place.lights.fill', place.lights.fill);
  list('place.lights.points', place.lights.points);
  place.lights.points.forEach((light, i) => need(`place.lights.points[${i}]`, light));
  for (const [group, placements] of Object.entries(place.layout.groups)) placements.forEach((item, i) => need(`place.layout.groups.${group}[${i}]`, item));
  place.layout.chains.forEach((item, i) => need(`place.layout.chains[${i}]`, item));
  if (place.farPlate !== undefined) {
    need('place.farPlate', place.farPlate);
    list('place.farPlate.layers', place.farPlate.layers);
  }
}

/** One stage's pendant slots, checked by name: each on an arm the character has, at an arc fraction, with its own whole-number order, never more than `maxPerArm` to an arm. */
function checkSlots(at: string, stage: string, slots: unknown, maxPerArm: number) {
  if (!Array.isArray(slots)) throw new BundleError(`${at}.slots.${stage}`, 'is missing (the slots a pendant can hang from in this stage, as a list)');
  const onArm = new Map<string, number>();
  const orders = new Set<number>();
  slots.forEach((slot: { arm?: unknown; at?: unknown; order?: unknown }, i) => {
    const field = `${at}.slots.${stage}[${i}]`;
    if (!record(slot)) throw new BundleError(field, 'is not a slot ({ arm, at, order })');
    if (!ARM_IDS.includes(slot.arm as never)) throw new BundleError(`${field}.arm`, `"${String(slot.arm)}" is not one of the arms ${ARM_IDS.join(', ')}`);
    if (!(finite(slot.at) && slot.at >= 0 && slot.at <= 1)) throw new BundleError(`${field}.at`, `${String(slot.at)} is not an arc fraction from 0 (the root) to 1 (the tip)`);
    if (!(finite(slot.order) && Number.isInteger(slot.order) && slot.order >= 0)) throw new BundleError(`${field}.order`, `${String(slot.order)} is not a whole number from 0 (the technology's rank for the slot)`);
    if (orders.has(slot.order)) throw new BundleError(`${field}.order`, `${slot.order} is the order of another slot in this stage (each technology has one place)`);
    orders.add(slot.order);
    const taken = (onArm.get(slot.arm as string) ?? 0) + 1;
    onArm.set(slot.arm as string, taken);
    if (taken > maxPerArm) throw new BundleError(`${field}.arm`, `${String(slot.arm)} carries more than ${maxPerArm} pendants in the ${stage} (never more than two to an arm)`);
  });
}

/** A pendant's thread and its swing, checked by name. */
function checkHanging(at: string, tether: unknown, swing: unknown) {
  if (!record(tether)) throw new BundleError(`${at}.tether`, 'is missing (the thread each pendant hangs on)');
  if (!(finite(tether.length) && tether.length >= 0)) throw new BundleError(`${at}.tether.length`, `${String(tether.length)} is not 0 or more (0 is a cap only)`);
  if (!(finite(tether.width) && tether.width > 0)) throw new BundleError(`${at}.tether.width`, `${String(tether.width)} is not above 0`);
  if (!(finite(tether.sag) && tether.sag >= 0 && tether.sag <= 1)) throw new BundleError(`${at}.tether.sag`, `${String(tether.sag)} is not from 0 to 1 (a fraction of the thread's length)`);
  for (const key of ['color', 'cap'] as const) if (!isColour(tether[key])) throw new BundleError(`${at}.tether.${key}`, `"${String(tether[key])}" is not a colour`);
  if (swing !== undefined) {
    const limits = swing as { maxAngle?: unknown; settle?: unknown } | null;
    if (!(finite(limits?.maxAngle) && limits.maxAngle > 0 && limits.maxAngle <= Math.PI / 2)) throw new BundleError(`${at}.swing.maxAngle`, `${String(limits?.maxAngle)} is not above 0 and at most a quarter turn (radians)`);
    if (!(finite(limits.settle) && limits.settle > 0)) throw new BundleError(`${at}.swing.settle`, `${String(limits.settle)} is not above 0 (seconds)`);
  }
}

/**
 * A pendant placement's slots, sizes, tether and optional swing and reveal are what the engine reads
 * each frame, so each is checked by name: a slot on an arm the character lacks, a ninth number, a
 * colour three would draw black, or a swing that never settles must not surface as a bad frame.
 */
function checkPendants(placement: PendantPlacement) {
  const at = 'artifacts.placement';
  if (placement.maxPerArm !== 2) throw new BundleError(`${at}.maxPerArm`, `${String(placement.maxPerArm)} is not 2 (an arm carries at most two pendants)`);
  for (const stage of CHOOSING_STAGES) {
    checkSlots(at, stage, placement.slots?.[stage], placement.maxPerArm);
    if (!(finite(placement.sizes?.[stage]) && placement.sizes[stage] > 0)) throw new BundleError(`${at}.sizes.${stage}`, `${String(placement.sizes?.[stage])} is not above 0 (the orb's radius)`);
  }
  checkHanging(at, placement.tether, placement.swing);
  const { reveal } = placement;
  if (reveal !== undefined) {
    if (!(finite(reveal?.start) && reveal.start >= 0)) throw new BundleError(`${at}.reveal.start`, `${String(reveal?.start)} is not 0 or more (seconds)`);
    if (!(finite(reveal.span) && reveal.span > 0)) throw new BundleError(`${at}.reveal.span`, `${String(reveal.span)} is not above 0 (seconds)`);
    if (!(finite(reveal.step) && reveal.step >= 0)) throw new BundleError(`${at}.reveal.step`, `${String(reveal.step)} is not 0 or more (seconds)`);
  }
}

/**
 * A satellite's active form (its overview slots, the orbs' size there, their thread and swing), by
 * name, as a pendant's: all three of slots, sizes and tether, or none (the ring alone).
 */
function checkSatellite(placement: SatellitePlacement) {
  const at = 'artifacts.placement';
  const { slots, sizes, tether, swing } = placement;
  if (slots === undefined && sizes === undefined && tether === undefined) return;
  if (!record(slots)) throw new BundleError(`${at}.slots`, 'is missing (an active form needs its slots, sizes and tether)');
  checkSlots(at, 'overview', slots.overview, MAX_PER_ARM);
  if (!(finite(sizes?.overview) && sizes.overview > 0)) throw new BundleError(`${at}.sizes.overview`, `${String(sizes?.overview)} is not above 0 (the orb's radius)`);
  checkHanging(at, tether, swing);
}

/** The most rim beads an orb carries: past this they would touch one another round an orb's outline. */
export const MAX_RIM_BEADS = 64;

/** An orb style's bead count, colours and cap, by name: a colour three would draw black, or a cap of no size, must not surface as a bad frame. */
function checkOrbStyle(style: unknown) {
  const at = 'artifacts.orbStyle';
  if (!record(style)) throw new BundleError(at, 'is not an orb style ({ rimBeads, rimColour, cap })');
  const { rimBeads, rimColour, cap } = style;
  if (!(finite(rimBeads) && Number.isInteger(rimBeads) && rimBeads >= 0 && rimBeads <= MAX_RIM_BEADS)) throw new BundleError(`${at}.rimBeads`, `${String(rimBeads)} is not a whole number from 0 to ${MAX_RIM_BEADS}`);
  if (!isColour(rimColour)) throw new BundleError(`${at}.rimColour`, `"${String(rimColour)}" is not a colour`);
  if (cap === null) return;
  if (!record(cap)) throw new BundleError(`${at}.cap`, 'is missing (a cap { colour, size }, or null for none)');
  if (!isColour(cap.colour)) throw new BundleError(`${at}.cap.colour`, `"${String(cap.colour)}" is not a colour`);
  if (!(finite(cap.size) && cap.size > 0)) throw new BundleError(`${at}.cap.size`, `${String(cap.size)} is not above 0 (the cap's radius)`);
}

/**
 * The appear's and the select's own parameters, by field name (Task 19): the bloom's `duration`
 * (seconds, above 0, at most 10) and the arm lift's `ease` (seconds, above 0, at most 2), `scale`
 * (1 to 2) and `threadShorten` (0 to under 1). Both grow out of and lift a pendant, so both need a
 * placement that hangs pendants (refused at the kind otherwise): the bloom the pendant placement, the
 * arm lift the pendant placement or the satellite's active form (Aether). The twinkle's `duration` has the same
 * range, and it forms the satellite's ring, so it needs the satellite placement.
 */
function checkAppearSelect(artifacts: ArtifactConfig) {
  const { placement, appear, select } = artifacts;
  if (appear.kind === 'bloom') {
    if (placement.kind !== 'pendant') throw new BundleError('artifacts.appear.kind', `"bloom" grows each artifact out of a cup on its arm: it needs the pendant placement, not "${placement.kind}"`);
    const { duration } = appear as { duration?: unknown };
    if (!(finite(duration) && duration > 0 && duration <= 10)) throw new BundleError('artifacts.appear.duration', `${String(duration)} is not above 0 and at most 10 (seconds the bloom takes in all)`);
  }
  if (appear.kind === 'twinkle') {
    if (placement.kind !== 'satellite') throw new BundleError('artifacts.appear.kind', `"twinkle" forms the satellite's ring: it needs the satellite placement, not "${placement.kind}"`);
    const { duration } = appear as { duration?: unknown };
    if (!(finite(duration) && duration > 0 && duration <= 10)) throw new BundleError('artifacts.appear.duration', `${String(duration)} is not above 0 and at most 10 (seconds the twinkle takes in all)`);
  }
  if (select.kind === 'armLift') {
    // The satellite hangs its technologies as pendants in its active form (Aether), so its arms lift them as the pendant placement's do.
    if (placement.kind === 'satellite' && !placement.slots) throw new BundleError('artifacts.select.kind', '"armLift" lifts the arm an artifact hangs from: the satellite placement needs its active form (slots, sizes, tether) for it');
    if (placement.kind !== 'pendant' && placement.kind !== 'satellite') throw new BundleError('artifacts.select.kind', `"armLift" lifts the arm an artifact hangs from: it needs the pendant or the satellite placement, not "${placement.kind}"`);
    const { ease, scale, threadShorten } = select as { ease?: unknown; scale?: unknown; threadShorten?: unknown };
    if (!(finite(ease) && ease > 0 && ease <= 2)) throw new BundleError('artifacts.select.ease', `${String(ease)} is not above 0 and at most 2 (seconds the lift eases over)`);
    if (!(finite(scale) && scale >= 1 && scale <= 2)) throw new BundleError('artifacts.select.scale', `${String(scale)} is not from 1 to 2 (how much the chosen orb grows)`);
    if (!(finite(threadShorten) && threadShorten >= 0 && threadShorten < 1)) throw new BundleError('artifacts.select.threadShorten', `${String(threadShorten)} is not from 0 to under 1 (the share of its thread the chosen orb loses)`);
  }
}

/**
 * The personality's motion variants (engine contract 14.1), each optional (unset reads Nox's value),
 * refused by name when set out of range: `settle` 0 to 1, `glideBias` above 0, `flourishRate` 0 or more,
 * `idleTilt` an amplitude of 0 or more (radians) and a period [low, high] of seconds, 0 < low <= high.
 */
function checkPersonalityVariants(personality: unknown) {
  if (!record(personality)) return;
  const at = 'character.personality';
  const { settle, glideBias, flourishRate, idleTilt } = personality;
  if (settle !== undefined && !(finite(settle) && settle >= 0 && settle <= 1)) throw new BundleError(`${at}.settle`, `${String(settle)} is not from 0 to 1 (a share of the approved overshoot)`);
  if (glideBias !== undefined && !(finite(glideBias) && glideBias > 0)) throw new BundleError(`${at}.glideBias`, `${String(glideBias)} is not above 0 (a scale on the glide)`);
  if (flourishRate !== undefined && !(finite(flourishRate) && flourishRate >= 0)) throw new BundleError(`${at}.flourishRate`, `${String(flourishRate)} is not 0 or more (flourishes per minute)`);
  if (idleTilt !== undefined) {
    if (!record(idleTilt)) throw new BundleError(`${at}.idleTilt`, 'is not an object (an idleTilt { amplitude, period: [low, high] })');
    const { amplitude, period } = idleTilt;
    if (!(finite(amplitude) && amplitude >= 0)) throw new BundleError(`${at}.idleTilt.amplitude`, `${String(amplitude)} is not 0 or more (the lean, in radians)`);
    if (!(Array.isArray(period) && period.length === 2 && finite(period[0]) && finite(period[1]) && period[0] > 0 && period[0] <= period[1])) {
      throw new BundleError(`${at}.idleTilt.period`, `${JSON.stringify(period)} is not [low, high] seconds above 0 with low at most high (the wait between tilts)`);
    }
  }
}

/**
 * Every part of the bundle the checks below (and the host) read is there, and of the form it is read
 * in, or a BundleError names the field: a missing part must not surface later as a TypeError.
 */
function checkPresent(bundle: WorldBundle) {
  const need = (field: string, value: unknown, what = 'an object') => {
    if (!record(value)) throw new BundleError(field, `is missing (the bundle needs ${what} here)`);
  };
  need('character', bundle.character);
  need('character.head', (bundle.character as Partial<CharacterConfig>)?.head);
  const arms = bundle.character.arms as readonly { id?: unknown }[] | undefined;
  if (!Array.isArray(arms)) throw new BundleError('character.arms', 'is missing (a character has exactly eight arms)');
  if (arms.length !== ARM_IDS.length || arms.some((arm, i) => arm?.id !== ARM_IDS[i])) throw new BundleError('character.arms', `needs exactly the eight arms ${ARM_IDS.join(', ')}, in order`);
  need('place', bundle.place);
  checkPlacePresent(bundle.place, need);
  need('poses', bundle.poses);
  need('swim', bundle.swim);
  need('artifacts', bundle.artifacts);
  need('artifacts.placement', bundle.artifacts.placement);
  need('artifacts.appear', bundle.artifacts.appear);
  need('artifacts.select', bundle.artifacts.select);
  if (!Array.isArray(bundle.artifacts.choosableIn)) throw new BundleError('artifacts.choosableIn', 'is missing (the stages a technology can be chosen in, as a list)');
  need('sequences', bundle.sequences);
  need('sequences.defaults', bundle.sequences.defaults);
  if (typeof bundle.sequences.projectId !== 'string' || bundle.sequences.projectId === '') throw new BundleError('sequences.projectId', 'is missing (the sequences belong to a Theatre project, named by this id)');
  need('theme', bundle.theme);
  need('stage', bundle.stage);
  need('stage.frames', bundle.stage.frames);
  need('stage.panels', bundle.stage.panels);
  need('stage.introTitle', bundle.stage.introTitle);
  need('content', bundle.content);
  need('content.project', bundle.content.project);
  if (!Array.isArray(bundle.content.technologies)) throw new BundleError('content.technologies', 'is missing (the technologies, as a list)');
}

/**
 * The entrance's shape (`sequences.entrance`, EntranceShape), by field: a turn above 0 and at most
 * a full turn; `spiral` a boolean; on the spiral, an arc with a finite `r0` above 0 and a finite `phase`.
 */
function checkEntranceShape(shape: unknown) {
  if (!record(shape)) throw new BundleError('sequences.entrance', 'is missing (the entrance\'s turn and path: { turn, spiral })');
  const { turn, spiral } = shape;
  if (!(finite(turn) && turn > 0 && turn <= 2 * Math.PI)) throw new BundleError('sequences.entrance.turn', `${String(turn)} is not a turn above 0 and at most 2 pi (radians)`);
  if (typeof spiral !== 'boolean') throw new BundleError('sequences.entrance.spiral', `${String(spiral)} is not true or false (whether the entrance ends on the golden-spiral arc)`);
  if (!spiral) return;
  const arc = shape.arc;
  if (!record(arc)) throw new BundleError('sequences.entrance.arc', 'is missing (the spiral needs its start: { r0, phase })');
  if (!(finite(arc.r0) && arc.r0 > 0)) throw new BundleError('sequences.entrance.arc.r0', `${String(arc.r0)} is not above 0 (stage units from the stage spot)`);
  if (!finite(arc.phase)) throw new BundleError('sequences.entrance.arc.phase', `${String(arc.phase)} is not a finite angle (radians)`);
}

/**
 * The kit props the entrance drives (`sequences.kitDrives`), by field: each key a prop the place
 * declares (`place.props`), each value a prop the entrance sheet's `main` object has.
 */
function checkKitDrives(sequences: SequenceSet, place: WorldConfig) {
  const { kitDrives } = sequences;
  if (kitDrives === undefined) return;
  if (!record(kitDrives)) throw new BundleError('sequences.kitDrives', 'is not an object (kit prop id to the entrance sheet prop that drives it)');
  const sheetProps = sequences.defaults.entrance?.objects.main?.props ?? {};
  for (const [id, sheetProp] of Object.entries(kitDrives)) {
    if (!(place.props ?? []).some(prop => prop.id === id)) throw new BundleError(`sequences.kitDrives.${id}`, `names no prop of the place (place.props has ${(place.props ?? []).map(prop => prop.id).join(', ') || 'none'})`);
    if (typeof sheetProp !== 'string' || !Object.hasOwn(sheetProps, sheetProp)) throw new BundleError(`sequences.kitDrives.${id}`, `names the entrance sheet prop "${String(sheetProp)}", which the entrance's main object does not have`);
  }
}

/** Each stage has a pose, and each pose has exactly the eight arms, T1..T8. */
function checkPoses(poses: unknown) {
  if (!record(poses)) throw new BundleError('poses', 'is not an object');
  for (const stage of STAGE_IDS) {
    const pose = poses[stage];
    if (!record(pose) || !record(pose.arms)) throw new BundleError(`poses.${stage}`, 'is missing (every stage needs a pose with its arms)');
    if (!record(pose.body)) throw new BundleError(`poses.${stage}.body`, 'is missing (every pose places the body: x, y, scale and yaw)');
    for (const key of ['x', 'y', 'scale', 'yaw'] as const) {
      if (!finite(pose.body[key])) throw new BundleError(`poses.${stage}.body.${key}`, 'is missing (every pose places the body: x, y, scale and yaw, as numbers)');
    }
    // The points the eyes wander between: absent, or a list of [x, y] finite numbers (an empty list is none).
    const lookPoints: unknown = pose.lookPoints;
    if (lookPoints !== undefined && !(Array.isArray(lookPoints) && lookPoints.every(point => Array.isArray(point) && point.length === 2 && point.every(finite)))) {
      throw new BundleError(`poses.${stage}.lookPoints`, 'is not a list of [x, y] points (finite numbers, world units)');
    }
    const keys: string[] = Object.keys(pose.arms);
    const missing = ARM_IDS.filter(id => !keys.includes(id));
    if (missing.length > 0) throw new BundleError(`poses.${stage}.arms`, `is missing ${missing.join(', ')} (a pose has exactly the arms ${ARM_IDS.join(', ')})`);
    const extra = keys.filter(key => !(ARM_IDS as readonly string[]).includes(key));
    if (extra.length > 0) throw new BundleError(`poses.${stage}.arms`, `has ${extra.join(', ')}, which is not an arm (a pose has exactly the arms ${ARM_IDS.join(', ')})`);
  }
}

/**
 * The bundle checked and its character clamped, or a BundleError naming what is wrong: the id's
 * form (and the creator prefix), every stage's pose with exactly the eight arms, every stage's
 * frame, the artifact kinds and the sheets they play, the title icon, the world (validateWorld) and
 * the project (validateProject, against the bundle's technologies). Numbers that are not finite and
 * colours that do not parse are refused here, by name, before the character's clamp would quietly
 * read a default in their place. `worlds` is the list of shipped worlds' ids, which only a caller that
 * has the registry knows (default: none): a bundle with the creator prefix that claims one of them is refused.
 */
export function validateBundle(bundle: WorldBundle, worlds: readonly WorldId[] = []): WorldBundle {
  const { id } = bundle;
  if (typeof id !== 'string' || !WORLD_ID.test(id)) throw new BundleError('id', `"${String(id)}" is not a world id (lower case letters, digits and hyphens, starting with a letter, 2 to 32 long)`);
  if (id.startsWith(CREATOR_PREFIX) && worlds.includes(id)) throw new BundleError('id', `"${id}" is a shipped world, but the "${CREATOR_PREFIX}" prefix is reserved for creator bundles`);

  checkPresent(bundle);
  checkPoses(bundle.poses);
  for (const stage of STAGE_IDS) {
    const frame = bundle.stage.frames[stage];
    if (!frame || !(finite(frame.width) && frame.width > 0) || !(finite(frame.height) && frame.height > 0)) throw new BundleError(`stage.frames.${stage}`, 'needs a width and a height above 0');
  }
  for (const panel of ['overview', 'detail'] as const) {
    const box: unknown = bundle.stage.panels[panel];
    if (!Array.isArray(box) || box.length !== 4 || !box.every(finite)) throw new BundleError(`stage.panels.${panel}`, 'needs four finite numbers [left, top, right, bottom] (world units)');
    const [left, top, right, bottom] = box as number[];
    if (!(left < right) || !(top > bottom)) throw new BundleError(`stage.panels.${panel}`, 'needs left < right and top > bottom (a box on the z = 0 plane, y up)');
  }
  const { halfWidth, top: titleTop } = bundle.stage.introTitle;
  if (!(finite(halfWidth) && halfWidth > 0) || !finite(titleTop)) throw new BundleError('stage.introTitle', 'needs a halfWidth above 0 and a finite top (world units)');
  if (!finite(bundle.swim.stretch) || !finite(bundle.swim.bodyX)) throw new BundleError('swim', 'needs a finite stretch and bodyX');

  // Every number, everywhere but the swim (its poses are built on first read) and the sequences' state (a loader).
  const { swim: _swim, sequences, ...rest } = bundle;
  const { state: _state, ...sequenceData } = sequences;
  // A skin surface's mode, by name, before its colours: the engine draws only the modes it has.
  const surfaces = bundle.character.skin?.surfaces as Record<string, { mode?: unknown } | undefined> | undefined;
  for (const surface of ['mantle', 'arms']) {
    const mode = surfaces?.[surface]?.mode;
    if (surfaces && !(SKIN_MODES as readonly unknown[]).includes(mode)) throw new BundleError(`character.skin.surfaces.${surface}.mode`, `"${String(mode)}" is not a skin mode the engine has (${SKIN_MODES.join(', ')})`);
  }
  checkLeaves(rest.character, 'character', true);
  checkPersonalityVariants(bundle.character.personality);
  // The face glow's spread and reach divide in the skin and jelly shaders: each must be above zero.
  for (const key of ['spreadX', 'reachUp', 'reachDown'] as const) {
    const value: unknown = bundle.character.glow?.[key];
    if (!(finite(value) && value > 0)) throw new BundleError(`character.glow.${key}`, `${String(value)} is not above 0 (the face glow divides by it)`);
  }
  checkLeaves(rest.place, 'place', true);
  checkLeaves(rest.poses, 'poses', false);
  checkLeaves(rest.artifacts, 'artifacts', false);
  checkLeaves(rest.stage, 'stage', false);
  checkLeaves(rest.content, 'content', false);
  checkLeaves(sequenceData, 'sequences', false);
  // Every colour token, by name: a token a theme leaves out would show Nox's value (the stylesheets' fallback).
  for (const key of THEME_COLOURS) {
    const value: unknown = bundle.theme[key];
    if (value === undefined) throw new BundleError(`theme.${key}`, 'is missing (every colour token is needed: a missing one would show the stylesheet fallback, Nox\'s)');
    if (!isColour(value)) throw new BundleError(`theme.${key}`, `"${String(value)}" is not a colour`);
  }
  const { poster, pageTitle } = bundle.theme;
  if (!record(poster) || typeof poster.src !== 'string' || poster.src === '' || typeof poster.alt !== 'string' || poster.alt === '') throw new BundleError('theme.poster', 'needs a src and an alt (the still shown where there is no WebGL)');
  if (!(finite(poster.width) && poster.width > 0) || !(finite(poster.height) && poster.height > 0)) throw new BundleError('theme.poster', 'needs a width and a height above 0 (in pixels)');
  if (typeof pageTitle !== 'string' || pageTitle === '') throw new BundleError('theme.pageTitle', 'is missing (the document title once the world is up)');
  if (!Object.hasOwn(TITLE_ICONS, bundle.theme.titleIcon)) throw new BundleError('theme.titleIcon', `"${bundle.theme.titleIcon}" is not one of the engine's title icons (${Object.keys(TITLE_ICONS).join(', ')})`);

  const { placement, appear, select, choosableIn } = bundle.artifacts;
  if (!Object.hasOwn(PLACEMENTS, placement.kind)) throw new BundleError('artifacts.placement.kind', `"${placement.kind}" is not a placement the engine has (${Object.keys(PLACEMENTS).join(', ')})`);
  if (placement.kind === 'pendant') checkPendants(placement);
  if (placement.kind === 'satellite') checkSatellite(placement);
  if (bundle.artifacts.orbStyle !== undefined) checkOrbStyle(bundle.artifacts.orbStyle);
  if (!Object.hasOwn(APPEARS, appear.kind)) throw new BundleError('artifacts.appear.kind', `"${appear.kind}" is not an appear the engine has (${Object.keys(APPEARS).join(', ')})`);
  if (!Object.hasOwn(SELECTS, select.kind)) throw new BundleError('artifacts.select.kind', `"${select.kind}" is not a select the engine has (${Object.keys(SELECTS).join(', ')})`);
  checkAppearSelect(bundle.artifacts);
  for (const stage of choosableIn) if (!isChoosingStage(stage)) throw new BundleError('artifacts.choosableIn', `"${stage}" is not a stage a technology can be chosen in`);
  for (const sheet of ['entrance', 'headSwell', 'arrival', APPEARS[appear.kind].sheet] as const) {
    if (!sequences.defaults[sheet]) throw new BundleError(`sequences.defaults.${sheet}`, 'is missing (the engine plays this sheet)');
  }
  checkEntranceShape(sequences.entrance);
  checkKitDrives(sequences, bundle.place);

  const world = validateWorld(bundle.place);
  if (world.length > 0) throw new BundleError('place', world.join('; '));
  const project = validateProject(bundle.content.project, { catalog: bundle.content.technologies });
  if (!project.valid) throw new BundleError('content.project', project.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));

  let character: CharacterConfig;
  try {
    character = clampCharacterConfig(bundle.character);
  } catch (error) {
    // The arms were checked above, so what the clamp throws now is about the character as a whole.
    throw new BundleError('character', error instanceof Error ? error.message : String(error));
  }
  return { ...bundle, character };
}

/** The stages a face anchor is worked out for: a technology focus keeps the overview's, the entrance lands in the intro's. */
export type FaceStage = 'intro' | 'overview' | 'detail';

/**
 * The character's face origin in a stage, x and y on the stage plane: the pose's body plus the head's
 * face origin, scaled with the body as Octopus draws it (body + scale x content). At scale 1 (every
 * Nox stage) the sums are exactly the unscaled ones.
 */
export function faceOrigin(bundle: Pick<WorldBundle, 'character' | 'poses'>, stage: FaceStage): readonly [number, number] {
  const { body } = bundle.poses[stage];
  const [ox, oy] = bundle.character.head.faceOrigin;
  return [body.x + body.scale * ox, body.y + body.scale * oy];
}

/**
 * The character's face in the intro, the overview or the detail: the point the overlays stay
 * attached to and the world camera's lens shift keeps in place, and the one the overview's face
 * spot is projected from, at the head's front. Derived from the character's head and the stage's
 * pose, so every character has its own with no second table.
 */
export function faceAnchor(bundle: Pick<WorldBundle, 'character' | 'poses'>, stage: FaceStage): Vec3 {
  const [x, y] = faceOrigin(bundle, stage);
  const { head } = bundle.character;
  const { scale } = bundle.poses[stage].body;
  return [x, y - 0.1 * scale, head.depth * head.halfWidth * scale];
}
